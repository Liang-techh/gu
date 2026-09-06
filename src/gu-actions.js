(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuActions = factory();
})(globalThis, function () {
  'use strict';

  // Player-facing Gu actions. The kernel only dispatches a command; all
  // novel-specific costs, locations, resources and consequences live here.
  function register({
    engine, locations, guSeeds, equipmentDefs, zoneRuntime, consequence,
    remember, log, damageEntity, advance, random, copy, relation,
    requireSameLocation, beginConflict, ability, body, equipment,
    conversation, conversationDefs, day, affectFaction, identity, knowledge,
    contractRuntime, repeatableRuntime, pursuitRuntime, agencyRuntime, combatRuntime,
    marketRuntime, rebirth
  }) {
    function performConversation(state, command, p) {
      const npc = requireSameLocation(state, command.target);
      const result = conversation.resolve(conversationDefs, state, command, { day, relation, remember, log, affectFaction });
      engine.emit(state, 'social.conversation', { actorId: p.id, targetId: npc.id, conversationId: result.definition.id, choiceId: result.choice.id });
      relation(state, 'player', npc.id).lastSeen = state.clock;
      advance(state, 1, 'conversation');
    }

    function identityAction(state, command, p) {
      const mode = command.mode || 'wear';
      if (mode === 'wear') {
        const mask = identity.wear(p, command.maskId || 'anonymous', state.clock, knowledge);
        remember(state, 'player', 'world', { kind: 'secret', source: 'identity:wear', text: `你换上了“${mask.label}”的身份面具。`, facts: { activeMask: p.knowledge.activeMask, publicIdentity: mask.label } });
        log(state, 'identity_mask', `你开始以“${mask.label}”的身份行动。`, { mode, maskId: p.knowledge.activeMask, strength: mask.strength });
      } else if (mode === 'drop') {
        const mask = identity.wear(p, 'trueName', state.clock, knowledge);
        log(state, 'identity_mask', `你摘下面具，恢复公开身份“${mask.label}”。`, { mode, maskId: 'trueName' });
      } else if (mode === 'reveal') {
        const target = state.entities[command.target];
        if (!target || target.id === 'player' || target.position.location !== p.position.location) throw new Error('只能向同地点的 NPC 摊牌');
        identity.reveal(p, target, state.clock, knowledge, '主动摊牌');
        const rel = relation(state, 'player', target.id);
        rel.trust += 5; rel.fear = Math.max(0, rel.fear - 2);
        log(state, 'identity_mask', `你向${target.identity.name}摊牌，真实身份被写入对方记忆。`, { mode, targetId: target.id, maskId: p.knowledge.activeMask });
        engine.emit(state, 'identity.revealed', { actorId: 'player', targetId: target.id, maskId: p.knowledge.activeMask, location: p.position.location });
      } else throw new Error('未知的身份行动');
      advance(state, 1, 'identity_mask');
    }

    function wolfAction(state, command, p) {
      const crisis = state.wolfCrisis;
      if (!crisis?.active || ['aftermath', 'resolved'].includes(crisis.phase)) throw new Error('当前没有需要介入的狼潮危机');
      if (!['village', 'bambooForest', 'riverbank', 'cliffCave'].includes(p.position.location)) throw new Error('当前位置无法影响狼潮战线');
      const mode = command.mode || 'relief';
      if (mode === 'relief') {
        if ((p.inventory.stones || 0) >= 1) p.inventory.stones -= 1;
        else if ((p.inventory.food || 0) >= 3) p.inventory.food -= 3;
        else throw new Error('救援至少需要一枚元石或三份食物');
        crisis.supply += 8; crisis.relief += 10; crisis.pressure = Math.max(0, crisis.pressure - 4); crisis.alliance.legitimacy += 3;
        state.factions.guYue.influence += 1; state.factions.guYue.tension = Math.max(0, state.factions.guYue.tension - 1);
        remember(state, 'guyuebo', 'player', { kind: 'crisis-relief', valence: 5, text: '你把手里的资源送进狼潮防线，救援因此变成了山寨账本上的事实。', facts: { wolfRelief: true } });
        log(state, 'wolf_relief', '你向狼潮防线投入了一份真实补给，暂时压低了伤亡压力。', { supply: crisis.supply, pressure: crisis.pressure });
      } else if (mode === 'scout') {
        p.needs.energy -= 6; p.needs.safety -= 3; p.cultivation.insight += 3; crisis.pressure = Math.max(0, crisis.pressure - 2);
        state.facts.wolfIntel = (state.facts.wolfIntel || 0) + 1;
        remember(state, 'player', 'world', { kind: 'crisis-scout', valence: 2, text: '你沿着狼潮边缘侦查，确认了下一处压力会从哪里撕开防线。', facts: { wolfIntel: state.facts.wolfIntel } });
        log(state, 'wolf_scout', '你侦查了狼潮边缘，获得了一条可以改变布防的情报。', { pressure: crisis.pressure });
      } else {
        crisis.supply = Math.max(0, crisis.supply - 3); crisis.pressure = Math.min(100, crisis.pressure + 4); p.inventory.food = (p.inventory.food || 0) + 2; p.needs.safety -= 8;
        state.factions.guYue.tension += 2; state.director.pressure = Math.min(10, state.director.pressure + 0.5);
        consequence(state, { kind: 'wolf_hoard', actorId: p.id, factionId: 'guYue', source: 'wolfAction', location: p.position.location, reason: '你把公共危机转成了个人储备，防线因此少了一份补给。', data: { supply: crisis.supply, pressure: crisis.pressure }, tension: 2, pressure: 0.2 });
        log(state, 'wolf_hoard', '你趁狼潮混乱囤下了个人资源，但公共防线因此更脆弱。', { supply: crisis.supply, pressure: crisis.pressure });
      }
      crisis.supply = Math.max(0, Math.min(100, crisis.supply)); crisis.pressure = Math.max(0, Math.min(100, crisis.pressure)); crisis.alliance.legitimacy = Math.max(-100, Math.min(100, crisis.alliance.legitimacy));
      engine.emit(state, 'wolf.action', { actorId: p.id, mode, phase: crisis.phase, supply: crisis.supply, pressure: crisis.pressure, legitimacy: crisis.alliance.legitimacy });
      advance(state, mode === 'scout' ? 2 : 3, `wolf_${mode}`);
    }

    function marketShockAction(state, command, p) {
      const shock = state.marketShock;
      if (!shock?.active || shock.resolved) throw new Error('当前没有开放的市场灾害窗口');
      if (!['village', 'caravanCamp', 'whiteBoneMountain'].includes(p.position.location)) throw new Error('当前位置无法影响灾害商路');
      const mode = command.mode || 'relief';
      if (mode === 'relief') {
        if ((p.inventory.stones || 0) >= 2) p.inventory.stones -= 2;
        else if ((p.inventory.food || 0) >= 4) p.inventory.food -= 4;
        else throw new Error('救济至少需要两枚元石或四份食物');
        state.market.supply.food += 4; state.market.supply.water += 2; shock.relief += 10; shock.severity = Math.max(0, shock.severity - 8); shock.priceShock = Math.max(0, shock.priceShock - 4); state.factions.caravans.influence += 1;
        remember(state, 'jiafu', 'player', { kind: 'market-relief', valence: 3, text: '你向灾害后的商路投放补给，让价格没有继续脱离普通人的承受范围。', facts: { marketShockAction: 'relief' } });
        log(state, 'market_shock_relief', '你向灾害商路投放了补给，供给和价格压力暂时下降。', { severity: shock.severity, priceShock: shock.priceShock });
      } else if (mode === 'arbitrage') {
        p.inventory.stones += 3; shock.severity = Math.min(100, shock.severity + 6); shock.priceShock = Math.min(100, shock.priceShock + 8); state.central.tracePressure += 2; state.factions.caravans.tension += 3;
        remember(state, 'jiafu', 'player', { kind: 'suspicion', valence: -2, text: '你在灾害造成的价差中套利，商队开始把你的名字和灾情价格一起记录。', facts: { marketShockAction: 'arbitrage', disasterTrace: true } });
        log(state, 'market_shock_arbitrage', '你利用灾害价差赚取了元石，但商路的价格与追踪压力同时上升。', { severity: shock.severity, priceShock: shock.priceShock });
      } else {
        if (p.cultivation.insight < 3) throw new Error('核验灾情至少需要 3 点洞察');
        p.cultivation.insight -= 3; shock.priceShock = Math.max(0, shock.priceShock - 6); state.facts.marketDisasterVerified = (state.facts.marketDisasterVerified || 0) + 1;
        remember(state, 'player', 'world', { kind: 'observation', confidence: 0.94, text: '你核验了灾后的价格与供给，区分出真正短缺和被人利用的恐慌。', facts: { marketShockAction: 'verify', marketDisasterVerified: state.facts.marketDisasterVerified } });
        log(state, 'market_shock_verify', '你核验了市场灾情，暂时看穿了恐慌价格背后的真实缺口。', { priceShock: shock.priceShock });
      }
      shock.severity = Math.max(0, Math.min(100, shock.severity)); shock.priceShock = Math.max(0, Math.min(100, shock.priceShock)); shock.relief = Math.max(0, shock.relief);
      engine.emit(state, 'market.disaster_action', { actorId: p.id, mode, phase: shock.phase, severity: shock.severity, priceShock: shock.priceShock, supply: { food: state.market.supply.food, water: state.market.supply.water } });
      advance(state, mode === 'verify' ? 2 : 3, `market_shock_${mode}`);
    }

    engine.registerAction('wait', ({ state, command }) => {
      advance(state, Number(command.hours) || 2, 'wait');
      log(state, 'action', '你等待了一段时间，观察世界如何自行变化。');
    });
    engine.registerAction('spring_autumn_reset', ({ state, p }) => rebirth(state, p));
    engine.registerAction('wolf_action', ({ state, command, p }) => wolfAction(state, command, p));
    engine.registerAction('market_shock_action', ({ state, command, p }) => marketShockAction(state, command, p));
    engine.registerAction('travel', ({ state, command, p }) => {
      const target = command.location;
      if (!locations[target] || !locations[p.position.location].neighbors.includes(target)) throw new Error('这里无法直接到达该地点');
      const from = p.position.location;
      p.position.location = target;
      zoneRuntime.transition(state, from, target, { engine, clock: state.clock, market: marketRuntime, consequence, remember, log, damageEntity });
      engine.emit(state, 'world.travel', { actorId: 'player', from, to: target });
      remember(state, 'player', 'world', { kind: 'travel', text: `从${locations[from].name}前往${locations[target].name}。`, facts: { [target]: true } });
      log(state, 'travel', `你从${locations[from].name}前往${locations[target].name}。`);
      advance(state, 1, 'travel');
    });
    engine.registerAction('cultivate', ({ state, p }) => {
      const cost = Math.max(6, Math.round(p.cultivation.essenceMax * 0.18));
      if (p.cultivation.essence < cost) throw new Error('真元不足');
      p.cultivation.essence -= cost;
      const gain = 4 + p.cultivation.aptitude * 8 + p.cultivation.insight * 0.06;
      p.cultivation.progress += gain;
      p.needs.energy -= 8;
      remember(state, 'player', 'world', { kind: 'cultivation', text: '你在雨声中温养空窍。' });
      log(state, 'action', `你温养空窍，修为进度增加 ${gain.toFixed(1)}。`);
      advance(state, 3, 'cultivate');
    });
    engine.registerAction('study', ({ state, p }) => {
      if (p.position.location !== 'academy') throw new Error('只有在学堂才能听课');
      p.cultivation.insight += 2;
      p.cultivation.progress += 1;
      relation(state, 'player', 'guYue').trust += 1;
      log(state, 'action', '你听完一堂关于真元与蛊虫的课，家老把你的表现记在心里。');
      advance(state, 2, 'study');
    });
    engine.registerAction('gather', ({ state, p }) => {
      const loc = p.position.location;
      const zone = state.zones[loc];
      if (!zone || !['bambooForest', 'riverbank', 'cliffCave'].includes(loc)) throw new Error('当前位置没有可采集的区域资源');
      if (loc === 'riverbank') {
        const amount = Math.min(3, zone.resources.water);
        if (amount < 1) throw new Error('河滩的水源暂时不足');
        zone.resources.water -= amount;
        p.inventory.water += amount;
      }
      if (loc === 'bambooForest') {
        const petals = Math.min(2, zone.resources.moonPetal);
        if (petals < 1) throw new Error('竹林里的月兰花瓣已经被采得差不多了');
        zone.resources.moonPetal -= petals;
        zone.resources.food = Math.max(0, zone.resources.food - 1);
        p.inventory.moonPetal += petals;
        p.inventory.food = (p.inventory.food || 0) + 1;
      }
      if (loc === 'cliffCave') {
        const fragment = Math.min(1, zone.resources.relicFragment);
        if (fragment < 1) throw new Error('石缝里暂时没有新的遗藏碎片');
        zone.resources.relicFragment -= fragment;
        p.inventory.relicFragment = (p.inventory.relicFragment || 0) + fragment;
        state.flags.relicDiscovered = true;
      }
      zone.activity += 12;
      zone.visits += 1;
      engine.emit(state, 'world.resource_gathered', { actorId: 'player', location: loc, resources: copy(p.inventory) });
      if (random(state) < zone.danger / 260) {
        damageEntity(state, 'player', 4 + zone.danger * 0.08, 'world', 'environment');
        p.needs.safety -= 8;
      }
      p.cultivation.insight += random(state) < 0.35 ? 1 : 0;
      log(state, 'action', `你在${locations[loc].name}进行采集，资源与线索都发生了变化。`);
      advance(state, 2, 'gather');
    });
    engine.registerAction('rest', ({ state, p }) => {
      p.needs.energy += 42;
      p.needs.hunger += 4;
      log(state, 'action', '你休息了一晚，人物和势力仍在世界中行动。');
      advance(state, 6, 'rest');
    });
    engine.registerAction('challenge', ({ state, command }) => beginConflict(state, command.target, command.kind || 'challenge'));
    for (const id of ['attack', 'gu', 'guard', 'flee']) engine.registerAction(id, ({ state, command }) => combatRuntime.playerAction(state, command));
    engine.registerAction('refine', ({ state, command, p }) => {
      if (p.position.location !== 'academy' && p.position.location !== 'village') throw new Error('这里没有适合炼化蛊虫的安静场所');
      const guId = command.guId || 'moonlight';
      p.inventory.gu ||= {};
      const current = p.inventory.gu[guId] || { progress: 0, refined: false, hunger: 0 };
      if (current.refined) throw new Error('这只蛊已经炼化');
      const cost = 8;
      if (p.cultivation.essence < cost) throw new Error('真元不足');
      p.cultivation.essence -= cost;
      current.progress += 22 + p.cultivation.aptitude * 12;
      if (current.progress >= 100) {
        current.progress = 100;
        current.refined = true;
        ability.learn(p, guId);
        log(state, 'milestone', `你炼化了${guSeeds[guId].name}。`, { guId });
      } else log(state, 'action', `你尝试炼化${guSeeds[guId].name}，蛊虫仍在抵抗。`);
      p.inventory.gu[guId] = current;
      advance(state, 2, 'refine');
    });
    engine.registerAction('equip_gu', ({ state, command, p }) => {
      const item = equipment.equip(p, command.guId, equipmentDefs, body, state.clock);
      engine.emit(state, 'equipment.equipped', { actorId: p.id, itemId: item.itemId, slot: item.slot, location: p.position.location });
      log(state, 'equipment', `你将${equipmentDefs[command.guId].label}装备到${item.slot}。`, { itemId: item.itemId, slot: item.slot });
      advance(state, 1, 'equip_gu');
    });
    engine.registerAction('unequip_gu', ({ state, command, p }) => {
      const previous = equipment.unequip(p, command.guId, equipmentDefs, state.clock);
      if (!previous) throw new Error('这只蛊当前没有装备');
      engine.emit(state, 'equipment.unequipped', { actorId: p.id, itemId: previous.itemId, slot: previous.slot, location: p.position.location });
      log(state, 'equipment', `你卸下了${equipmentDefs[command.guId]?.label || command.guId}。`, { itemId: previous.itemId, slot: previous.slot });
      advance(state, 1, 'unequip_gu');
    });
    engine.registerAction('talk', ({ state, command, p }) => {
      const npc = requireSameLocation(state, command.target);
      const r = relation(state, 'player', npc.id);
      const mode = command.mode || 'listen';
      const memoryBoost = (p.memory.facts[npc.id]?.helped ? 6 : 0) + (r.trust > 20 ? 3 : 0);
      if (!engine.runInteraction(mode, { state, p, npc, relation: r, memoryBoost })) engine.runInteraction('listen', { state, p, npc, relation: r, memoryBoost });
      r.lastSeen = state.clock;
      advance(state, 1, 'talk');
    });
    engine.registerAction('influence', ({ state, command, p }) => {
      const faction = state.factions[command.factionId];
      if (!faction) throw new Error('未知势力');
      if ((p.inventory.stones || 0) < 1) throw new Error('至少需要一枚元石作为行动成本');
      p.inventory.stones -= 1;
      faction.attitude += 4;
      faction.tension += command.kind === 'rumor' ? 4 : -2;
      state.director.pressure += command.kind === 'rumor' ? 1 : 0;
      relation(state, 'player', command.factionId).trust += 4;
      log(state, 'faction', `你对${faction.name}施加了一次${command.kind === 'rumor' ? '传闻' : '援助'}影响。`, { factionId: command.factionId });
      advance(state, 2, 'influence');
    });
    engine.registerAction('accept_contract', ({ state, command }) => contractRuntime.accept(state, command.contractId));
    engine.registerAction('complete_contract', ({ state, command }) => contractRuntime.complete(state, command.contractId));
    engine.registerAction('arena_match', ({ state, p }) => repeatableRuntime.arenaMatch(state, p));
    engine.registerAction('inheritance_scout', ({ state, p }) => repeatableRuntime.inheritanceScout(state, p));
    engine.registerAction('inheritance_round', ({ state, command, p }) => repeatableRuntime.inheritanceRound(state, p, command));
    engine.registerAction('frontier_patrol', ({ state, p }) => repeatableRuntime.frontierPatrol(state, p));
    engine.registerAction('tower_floor', ({ state, p }) => repeatableRuntime.towerFloor(state, p));
    engine.registerAction('auction_lot', ({ state, command, p }) => repeatableRuntime.auctionLot(state, p, command));
    engine.registerAction('identity_mask', ({ state, command, p }) => identityAction(state, command, p));
    engine.registerAction('pursuit_agent', ({ state, command, p }) => pursuitRuntime.contactAction(state, p, command));
    engine.registerAction('commission_agent', ({ state, command, p }) => agencyRuntime.recruit(state, p, command));
    engine.registerAction('dream_dive', ({ state, p }) => repeatableRuntime.dreamDive(state, p));
    engine.registerAction('conversation', ({ state, command, p }) => performConversation(state, command, p));
    engine.registerActionHook('after', '*', 'actionMetrics', ({ state, command }) => {
      state.facts.actionCounts ||= {};
      state.facts.actionCounts[command.id] = (state.facts.actionCounts[command.id] || 0) + 1;
    });
    return engine.registries().actions;
  }

  return { register };
});
