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
    requireSameLocation, requireNearby, beginConflict, ability, body, equipment,
    conversation, conversationDefs, day, affectFaction, identity, knowledge,
    contractRuntime, repeatableRuntime, pursuitRuntime, agencyRuntime, combatRuntime,
    marketRuntime, rebirth, factionPacts, affordances, localMap
  }) {
    function performConversation(state, command, p) {
      const npc = requireNearby(state, command.target);
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

    function blessedLandAction(state, command, p) {
      const base = state.blessedLand;
      if (!base?.active || p.position.location !== 'foxFairyLand') throw new Error('只有回到狐仙福地时才能经营基地');
      const mode = command.mode || 'fortify';
      if (mode === 'fortify') {
        if ((p.inventory.stones || 0) < 2) throw new Error('加固福地至少需要两枚元石');
        p.inventory.stones -= 2; base.defense += 14; base.resources = Math.max(0, base.resources - 4); base.upgrades.defense = Math.min(10, base.upgrades.defense + 1); base.sectPressure = Math.max(0, base.sectPressure - 3);
        remember(state, 'player', 'world', { kind: 'blessed-land-fortify', valence: 3, text: '你把元石投入福地禁制，守备从一次性选择变成了长期资产。', facts: { blessedLandAction: mode } });
        log(state, 'blessed_land_fortify', '你加固了狐仙福地的防线，宗门的下一次试探会更昂贵。', { defense: base.defense });
      } else if (mode === 'cultivate') {
        if ((p.inventory.stones || 0) < 1) throw new Error('培育福地资源至少需要一枚元石');
        p.inventory.stones -= 1; base.resources += 16; base.soulReserve += 8; base.upgrades.production = Math.min(10, base.upgrades.production + 1); base.maintenance += 2;
        log(state, 'blessed_land_cultivate', '你培育福地资源，把魂魄与产出变成可以持续滚动的底盘。', { resources: base.resources, soulReserve: base.soulReserve });
      } else if (mode === 'recruit') {
        const capacity = 4 + base.upgrades.housing * 3;
        if (base.residents >= capacity) throw new Error('福地当前居所已经没有空位');
        if ((p.inventory.stones || 0) < 1) throw new Error('招募驻民至少需要一枚元石');
        p.inventory.stones -= 1;
        const recruit = Object.values(state.entities).find(entity => entity.id.startsWith('ambient-') && entity.alive && ['centralContinent', 'shadowSectRuins', 'caravanCamp'].includes(entity.position?.location));
        if (recruit) { recruit.position.location = 'foxFairyLand'; base.residents += 1; remember(state, recruit.id, 'world', { kind: 'blessed-land-recruit', valence: 2, text: `${recruit.identity.name}接受你的招募，迁入狐仙福地谋生。`, facts: { recruitedTo: 'foxFairyLand' } }); }
        else base.residents += 1;
        base.reputation += 2; log(state, 'blessed_land_recruit', '你为狐仙福地补充了一名驻民，基地开始拥有脱离玩家也能运转的人手。', { residents: base.residents });
      } else if (mode === 'hide') {
        base.hidden = true; base.sectPressure = Math.max(0, base.sectPressure - 8); base.resources = Math.max(0, base.resources - 3); state.facts.hiddenReturn = true;
        log(state, 'blessed_land_hide', '你收缩福地的外显痕迹，换取短期安全，却让资源流动变慢。', { sectPressure: base.sectPressure });
      } else throw new Error('未知的狐仙福地经营方式');
      base.resources = Math.min(200, Math.max(0, base.resources)); base.defense = Math.min(100, Math.max(0, base.defense)); base.soulReserve = Math.min(100, Math.max(0, base.soulReserve)); base.sectPressure = Math.min(100, Math.max(0, base.sectPressure));
      engine.emit(state, 'blessed-land.action', { actorId: p.id, mode, resources: base.resources, defense: base.defense, residents: base.residents, sectPressure: base.sectPressure });
      advance(state, mode === 'hide' ? 2 : 4, `blessed_land_${mode}`);
    }

    function frontAction(state, command, p) {
      const front = Object.values(state.worldWar?.fronts || {}).find(item => item.active && item.location === p.position.location);
      if (!front) throw new Error('当前位置没有开放的战争战区');
      const mode = command.mode || 'intelligence';
      const primary = state.factions[front.primaryFaction];
      const opposing = state.factions[front.opposingFaction];
      if (mode === 'reinforce') {
        if ((p.inventory.stones || 0) < 2) throw new Error('支援战区至少需要两枚元石');
        p.inventory.stones -= 2; front.supply += 14; front.pressure = Math.max(0, front.pressure - 5); front.control += 3; if (primary) primary.influence += 1;
        remember(state, 'player', 'world', { kind: 'war-reinforce', valence: 3, text: `你把资源投入${locations[front.location].name}战线，补给暂时没有断裂。`, facts: { frontId: front.id, mode } });
        log(state, 'war_front_reinforce', `你向${locations[front.location].name}投入补给，战区压力暂时下降。`, { frontId: front.id, supply: front.supply });
      } else if (mode === 'intelligence') {
        p.needs.energy -= 8; p.needs.safety -= 4; p.cultivation.insight += 4; front.pressure = Math.max(0, front.pressure - 3); state.facts[`${front.id}FrontIntel`] = (state.facts[`${front.id}FrontIntel`] || 0) + 1;
        if (front.commanderId && state.entities[front.commanderId]) remember(state, front.commanderId, 'player', { kind: 'war-intel', valence: 2, text: '你提供的战区情报足以改变下一次布防。', facts: { frontId: front.id, verified: false } });
        log(state, 'war_front_intelligence', `你侦查了${locations[front.location].name}战线，确认了下一处补给缺口。`, { frontId: front.id, pressure: front.pressure });
      } else if (mode === 'sabotage') {
        front.supply = Math.max(0, front.supply - 10); front.pressure = Math.min(100, front.pressure + 8); front.control = Math.max(0, front.control - 4); if (opposing) opposing.tension += 3; if (primary) primary.tension += 2; p.inventory.stones += 3;
        consequence(state, { kind: 'war_front_sabotage', actorId: p.id, factionId: front.opposingFaction, source: 'frontAction', location: front.location, reason: '你破坏了战区补给，把局部情报优势兑换成更大的战争压力。', data: { frontId: front.id, supply: front.supply, pressure: front.pressure }, tension: 2, pressure: 0.25 });
        log(state, 'war_front_sabotage', `你破坏了${locations[front.location].name}的补给线，短期获利但让战区更接近失控。`, { frontId: front.id, supply: front.supply, pressure: front.pressure });
      } else if (mode === 'mediate') {
        if ((p.inventory.stones || 0) < 1) throw new Error('调停战区至少需要一枚元石作为代价');
        p.inventory.stones -= 1; front.pressure = Math.max(0, front.pressure - 8); front.control = Math.min(100, front.control + 5); if (primary) primary.tension = Math.max(0, primary.tension - 3); if (opposing) opposing.tension = Math.max(0, opposing.tension - 2);
        log(state, 'war_front_mediate', `你在${locations[front.location].name}促成了一次短暂停火，双方都记住了这笔人情。`, { frontId: front.id, pressure: front.pressure });
      } else throw new Error('未知的战区行动');
      front.supply = Math.max(0, Math.min(100, front.supply)); front.pressure = Math.max(0, Math.min(100, front.pressure)); front.control = Math.max(0, Math.min(100, front.control)); front.lastActionDay = day(state);
      engine.emit(state, 'world-war.front_action', { actorId: p.id, frontId: front.id, mode, location: front.location, supply: front.supply, pressure: front.pressure, control: front.control });
      advance(state, mode === 'intelligence' ? 3 : 4, `front_${mode}`);
    }

    function shadowNetworkAction(state, command, p) {
      const network = state.shadowNetwork;
      const node = Object.values(network?.nodes || {}).find(item => item.active && item.location === p.position.location);
      if (!network?.active || !node) throw new Error('当前位置没有可接触的影宗暗线');
      const mode = command.mode || 'intel';
      if (mode === 'recruit') {
        if ((p.inventory.stones || 0) < 1) throw new Error('招募暗线至少需要一枚元石');
        p.inventory.stones -= 1; network.recruits += 1; network.resources += 3; network.cohesion += 2; network.exposure += 3; node.contacts += 1; node.control += 3;
        if (state.entities.yingwuxie) { relation(state, 'player', 'yingwuxie').trust += 1; remember(state, 'yingwuxie', 'player', { kind: 'secret', valence: 1, text: '你为影宗暗线补充了一个可以承担风险的人。', facts: { shadowRecruit: true, nodeId: node.id } }); }
        log(state, 'shadow_network_recruit', `你在${locations[node.location].name}招募了一名暗线，网络扩大但暴露风险上升。`, { nodeId: node.id, recruits: network.recruits, exposure: network.exposure });
      } else if (mode === 'intel') {
        if (p.cultivation.insight < 2) throw new Error('整理影宗情报至少需要两点洞察');
        p.cultivation.insight -= 2; network.intelligence += 3; network.exposure += 4; node.secrecy = Math.max(0, node.secrecy - 3); state.facts.shadowIntel = true;
        remember(state, 'player', 'world', { kind: 'shadow-intel', confidence: 0.62, text: `你从${locations[node.location].name}的暗线中整理出一段尚未核验的情报。`, facts: { shadowIntel: true, nodeId: node.id, confidence: 0.62 } });
        log(state, 'shadow_network_intel', '你整理了影宗暗线情报，获得优势的同时也让自己成为网络的一部分。', { nodeId: node.id, intelligence: network.intelligence });
      } else if (mode === 'conceal') {
        if ((p.inventory.stones || 0) < 2) throw new Error('隐藏暗线至少需要两枚元石');
        p.inventory.stones -= 2; network.visibility = Math.max(0, network.visibility - 9); network.exposure = Math.max(0, network.exposure - 12); node.secrecy = Math.min(100, node.secrecy + 12); network.resources = Math.max(0, network.resources - 2);
        log(state, 'shadow_network_conceal', `你为${locations[node.location].name}的暗线抹去痕迹，暂时延缓了宗门追查。`, { nodeId: node.id, secrecy: node.secrecy, exposure: network.exposure });
      } else if (mode === 'betray') {
        if (network.intelligence < 2) throw new Error('出卖暗线前至少需要两点可交易情报');
        network.intelligence -= 2; network.resources += 6; network.exposure += 14; network.cohesion = Math.max(0, network.cohesion - 8); network.betrayals += 1; node.control = Math.max(0, node.control - 10); state.factions.centralSects.influence += 2; state.factions.shadowSect.tension += 5;
        consequence(state, { kind: 'shadow_network_betrayal', actorId: p.id, factionId: 'shadowSect', source: 'shadowNetworkAction', location: node.location, reason: '你把影宗暗线情报卖给中洲势力，获得短期资源并破坏网络信任。', data: { nodeId: node.id, exposure: network.exposure, betrayals: network.betrayals }, tension: 3, pressure: 0.4 });
        log(state, 'shadow_network_betray', '你出卖了一段影宗暗线，元石到账，但影宗会记住这次背叛。', { nodeId: node.id, exposure: network.exposure, betrayals: network.betrayals });
      } else throw new Error('未知的影宗暗线行动');
      network.visibility = Math.max(0, Math.min(100, network.visibility)); network.cohesion = Math.max(0, Math.min(100, network.cohesion)); network.resources = Math.max(0, Math.min(200, network.resources)); network.exposure = Math.max(0, Math.min(100, network.exposure)); node.control = Math.max(0, Math.min(100, node.control)); node.secrecy = Math.max(0, Math.min(100, node.secrecy));
      engine.emit(state, 'shadow-network.action', { actorId: p.id, nodeId: node.id, mode, location: node.location, resources: network.resources, intelligence: network.intelligence, exposure: network.exposure });
      advance(state, mode === 'conceal' ? 2 : 3, `shadow_network_${mode}`);
    }

    function dreamRealmAction(state, command, p) {
      const realm = state.dreamRealm;
      if (!realm?.active || p.position.location !== 'dreamRealms') throw new Error('梦境战场当前没有可争夺的稳定窗口');
      const mode = command.mode || 'stake';
      if (mode === 'stake') {
        if ((p.inventory.stones || 0) < 2) throw new Error('建立梦境据点至少需要两枚元石');
        p.inventory.stones -= 2; realm.claims.centralSects += 7; realm.pressure += 5; realm.contamination += 2; realm.resources = Math.max(0, realm.resources - 3);
        remember(state, 'player', 'world', { kind: 'dream-claim', valence: 2, text: '你在梦境中留下可重复进入的认知锚点，中洲势力因此获得一处新的争夺支点。', facts: { dreamAction: mode, claim: realm.claims.centralSects } });
        log(state, 'dream_realm_stake', '你在梦境战场建立了认知锚点，控制权上升但梦境开始反噬现实。', { control: realm.control, pressure: realm.pressure });
      } else if (mode === 'harvest') {
        if (realm.resources < 6) throw new Error('梦境资源暂时不足以收割');
        realm.resources -= 6; p.inventory.stones += 4; p.cultivation.insight += 3; realm.pressure += 8; realm.contamination += 5; realm.claims.dreamPathForces += 3;
        log(state, 'dream_realm_harvest', '你收割了一部分梦道资源，获得元石与洞察，却让梦境污染继续扩散。', { resources: realm.resources, contamination: realm.contamination });
      } else if (mode === 'stabilize') {
        if (p.cultivation.insight < 3) throw new Error('稳定梦境至少需要三点洞察');
        p.cultivation.insight -= 3; realm.pressure = Math.max(0, realm.pressure - 12); realm.contamination = Math.max(0, realm.contamination - 10); realm.resources += 3; realm.claims.centralSects += 2;
        log(state, 'dream_realm_stabilize', '你用洞察稳定梦境边界，暂时阻止污染侵入现实。', { pressure: realm.pressure, contamination: realm.contamination });
      } else if (mode === 'sabotage') {
        const target = ['dreamPathForces', 'twoHeavensForces'].sort((a, b) => realm.claims[b] - realm.claims[a])[0];
        realm.claims[target] = Math.max(0, realm.claims[target] - 9); realm.pressure += 10; realm.contamination += 7; p.cultivation.insight += 2; state.factions[target].tension += 4;
        consequence(state, { kind: 'dream_realm_sabotage', actorId: p.id, factionId: target, source: 'dreamRealmAction', location: p.position.location, reason: '你破坏了梦境战场的一处争夺节点，暂时削弱对手，却让梦境边界更加不稳定。', data: { target, pressure: realm.pressure, contamination: realm.contamination }, tension: 2, pressure: 0.35 });
        log(state, 'dream_realm_sabotage', '你破坏了梦境战场的一处争夺节点，敌对势力会记住这次干预。', { target, pressure: realm.pressure });
      } else throw new Error('未知的梦境战场行动');
      realm.pressure = Math.max(0, Math.min(100, realm.pressure)); realm.contamination = Math.max(0, Math.min(100, realm.contamination)); realm.resources = Math.max(0, Math.min(200, realm.resources)); for (const id of Object.keys(realm.claims)) realm.claims[id] = Math.max(0, Math.min(100, realm.claims[id]));
      engine.emit(state, 'dream-realm.action', { actorId: p.id, mode, control: realm.control, pressure: realm.pressure, resources: realm.resources, contamination: realm.contamination, claims: { ...realm.claims } });
      advance(state, mode === 'stabilize' ? 3 : 4, `dream_realm_${mode}`);
    }

    function runAffordance(state, command, p) {
      const affordanceId = command.affordanceId;
      const result = affordances?.execute(affordanceId, { state, command, p });
      if (!result) throw new Error('当前地点没有可执行的环境交互');
      return result;
    }

    function coalitionAction(state, command, p) {
      const locationMembers = {
        village: ['guYue', 'bai', 'xiong'],
        centralContinent: ['centralSects', 'shadowSect'],
        southernBorder: ['southernSuperClans', 'centralSects'],
        westernDesert: ['westernDesertFang', 'centralSects'],
        heavenlyCourt: ['heavenlyCourt', 'twoHeavensForces'],
        longLifeHeaven: ['longLifeHeaven', 'twoHeavensForces'],
        dreamRealms: ['dreamPathForces', 'centralSects', 'twoHeavensForces']
      };
      const members = command.members?.length ? command.members : locationMembers[p.position.location];
      if (!members?.every(id => state.factions[id])) throw new Error('当前位置没有可谈判的势力关系');
      const pact = factionPacts.upsert(state, members, { day: day(state), source: 'playerDiplomacy', legitimacy: 42, cohesion: 38, supply: 36 });
      const mode = command.mode || 'broker';
      if (mode === 'broker') {
        if ((p.inventory.stones || 0) < 2) throw new Error('撮合盟约至少需要两枚元石');
        p.inventory.stones -= 2; pact.legitimacy += 12; pact.cohesion += 8; pact.supply += 5;
        for (const id of pact.members) { pact.obligations[id] = Math.min(100, (pact.obligations[id] || 0) + 4); state.factions[id].tension = Math.max(0, state.factions[id].tension - 1.5); state.factions[id].attitude += 2; }
        remember(state, 'player', 'world', { kind: 'coalition-broker', valence: 4, text: `你用资源把${pact.members.join('、')}暂时拴在同一张契约上。`, facts: { pactId: pact.id, coalitionAction: mode } });
        log(state, 'coalition_broker', '你撮合了一项可被世界继续检验的势力盟约。', { pactId: pact.id, members: pact.members, legitimacy: pact.legitimacy });
      } else if (mode === 'pledge') {
        if ((p.inventory.stones || 0) < 1) throw new Error('兑现承诺至少需要一枚元石');
        p.inventory.stones -= 1; pact.supply += 12; pact.legitimacy += 6; pact.cohesion += 4; pact.obligations[p.faction] = Math.max(0, (pact.obligations[p.faction] || 0) - 12);
        for (const id of pact.members) state.factions[id].attitude += id === p.faction ? 3 : 1;
        log(state, 'coalition_pledge', '你兑现了一笔具体承诺，盟约获得补给而不是口头上的声望。', { pactId: pact.id, supply: pact.supply, obligations: pact.obligations });
      } else if (mode === 'expose') {
        if (p.cultivation.insight < 3) throw new Error('拆穿盟约至少需要三点洞察');
        p.cultivation.insight -= 3; pact.legitimacy -= 15; pact.cohesion -= 10; pact.supply = Math.max(0, pact.supply - 3); state.coalitions.diplomacyPressure += 8;
        for (const id of pact.members) state.factions[id].tension += 3;
        consequence(state, { kind: 'coalition_exposure', actorId: p.id, factionId: pact.members[0], source: 'coalitionAction', location: p.position.location, reason: '你公开盟约中的未兑现承诺，短期制造筹码，也让多方信任一起受损。', data: { pactId: pact.id, legitimacy: pact.legitimacy, cohesion: pact.cohesion }, tension: 2, pressure: 0.35 });
        log(state, 'coalition_expose', '你揭开盟约的隐性条件，势力之间开始重新计算彼此的价格。', { pactId: pact.id, legitimacy: pact.legitimacy, status: pact.status });
      } else if (mode === 'defect') {
        if (!pact.members.includes(p.faction)) throw new Error('你不属于这项盟约，无法代表其中一方倒戈');
        pact.members = pact.members.filter(id => id !== p.faction); pact.defections += 1; pact.status = pact.members.length < 2 ? 'broken' : 'defected'; pact.legitimacy -= 18; pact.cohesion -= 14; state.coalitions.diplomacyPressure += 10;
        factionPacts.record(state, pact, { day: day(state), kind: 'player_defection', actorId: p.faction, members: [...pact.members], reason: '玩家公开退出盟约，把承诺转换为新的谈判筹码。' });
        for (const id of pact.members) { state.factions[id].tension += 4; state.factions[id].attitude -= 5; }
        consequence(state, { kind: 'player_coalition_defection', actorId: p.id, factionId: p.faction, source: 'coalitionAction', location: p.position.location, reason: '玩家退出势力盟约，剩余成员把这视为可传播的背叛范例。', data: { pactId: pact.id, departed: p.faction, members: pact.members }, tension: 3, pressure: 0.5 });
        remember(state, 'player', 'world', { kind: 'defection', valence: -2, text: '你亲手撕开了一项势力盟约，新的筹码建立在旧的信用废墟上。', facts: { pactId: pact.id, coalitionDefection: true } });
        log(state, 'coalition_defect', '你退出了当前盟约，短期摆脱义务，长期让所有势力重新评估你。', { pactId: pact.id, status: pact.status });
      } else throw new Error('未知的势力外交行动');
      pact.legitimacy = Math.max(-100, Math.min(100, pact.legitimacy)); pact.cohesion = Math.max(0, Math.min(100, pact.cohesion)); pact.supply = Math.max(0, Math.min(100, pact.supply));
      factionPacts.record(state, pact, { day: day(state), kind: mode, actorId: p.id, members: [...pact.members], legitimacy: pact.legitimacy, cohesion: pact.cohesion, supply: pact.supply });
      engine.emit(state, 'faction.coalition_changed', { actorId: p.id, pactId: pact.id, mode, status: pact.status, members: [...pact.members], legitimacy: pact.legitimacy, cohesion: pact.cohesion, supply: pact.supply });
      advance(state, mode === 'expose' ? 2 : 3, `coalition_${mode}`);
    }

    engine.registerAction('wait', ({ state, command }) => {
      advance(state, Number(command.hours) || 2, 'wait');
      log(state, 'action', '你等待了一段时间，观察世界如何自行变化。');
    });
    engine.registerAction('spring_autumn_reset', ({ state, p }) => rebirth(state, p));
    engine.registerAction('wolf_action', ({ state, command, p }) => wolfAction(state, command, p));
    engine.registerAction('market_shock_action', ({ state, command, p }) => marketShockAction(state, command, p));
    engine.registerAction('blessed_land_action', ({ state, command, p }) => blessedLandAction(state, command, p));
    engine.registerAction('front_action', ({ state, command, p }) => frontAction(state, command, p));
    engine.registerAction('shadow_network_action', ({ state, command, p }) => shadowNetworkAction(state, command, p));
    engine.registerAction('interact', ({ state, command, p }) => runAffordance(state, command, p));
    function travelTo(state, p, target, direction = null, cause = 'travel') {
      if (!locations[target] || !locations[p.position.location].neighbors.includes(target)) throw new Error('这里无法直接到达该地点');
      const from = p.position.location;
      p.position.location = target;
      p.position.cell = localMap ? localMap.entryCell(target, locations[target], direction || 'north', p.id) : p.position.cell;
      zoneRuntime.transition(state, from, target, { engine, clock: state.clock, market: marketRuntime, consequence, remember, log, damageEntity });
      engine.emit(state, 'world.travel', { actorId: 'player', from, to: target, direction, mode: direction ? 'edge' : 'region' });
      remember(state, 'player', 'world', { kind: 'travel', text: `从${locations[from].name}前往${locations[target].name}。`, facts: { [target]: true, lastTravelDirection: direction } });
      log(state, 'travel', `你从${locations[from].name}前往${locations[target].name}。`);
      advance(state, 1, cause);
    }
    engine.registerAction('step', ({ state, command, p }) => {
      if (!localMap) throw new Error('局部地图尚未加载');
      const here = p.position.location;
      p.position.cell = localMap.normalizeCell(here, p.position.cell, locations[here], p.id);
      const result = localMap.step(here, locations[here], p.position.cell, command.direction);
      if (result.kind === 'blocked') throw new Error(result.reason === 'terrain' ? '前方被地形挡住了' : '这边没有可走的路');
      if (result.kind === 'exit') return travelTo(state, p, result.location, result.direction, 'step');
      const from = { ...p.position.cell };
      p.position.cell = result.cell;
      engine.emit(state, 'world.step', { actorId: p.id, location: here, from, to: { ...result.cell }, direction: result.direction });
      remember(state, 'player', 'world', { kind: 'step', text: `你在${locations[here].name}向${localMap.DIRECTIONS[result.direction].label}走了一格。`, facts: { lastCell: { ...result.cell }, lastStepLocation: here } });
      log(state, 'step', `你在${locations[here].name}向${localMap.DIRECTIONS[result.direction].label}走了一格。`, { location: here, from, to: { ...result.cell } });
      advance(state, 1, 'step');
    });
    engine.registerAction('travel', ({ state, command, p }) => travelTo(state, p, command.location));
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
    engine.registerAction('gather', ({ state, command, p }) => runAffordance(state, { ...command, affordanceId: 'forage' }, p));
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
      const npc = requireNearby(state, command.target);
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
    engine.registerAction('dream_realm_action', ({ state, command, p }) => dreamRealmAction(state, command, p));
    engine.registerAction('coalition_action', ({ state, command, p }) => coalitionAction(state, command, p));
    engine.registerAction('conversation', ({ state, command, p }) => performConversation(state, command, p));
    engine.registerActionHook('after', '*', 'actionMetrics', ({ state, command }) => {
      state.facts.actionCounts ||= {};
      state.facts.actionCounts[command.id] = (state.facts.actionCounts[command.id] || 0) + 1;
    });
    return engine.registries().actions;
  }

  return { register };
});
