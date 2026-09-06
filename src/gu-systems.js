(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuSystems = factory();
})(globalThis, function () {
  'use strict';

  // Content-side systems. The engine owns ordering and dispatch; this module
  // only supplies Gu-specific state transitions through the same registry.
  function register({
    engine, history, zoneRuntime, npcAI, brain, social, combat, market, pursuit, agency,
    condition, effect, locations, phase, hour, day, random, clamp, relation, remember,
    log, relValence, consequence, damageEntity
  }) {
    engine.registerSystem('hour', 'conditionTick', ({ state }) => {
      for (const entity of engine.queryWith(state, 'conditions')) {
        const expired = condition.tick(entity, 1);
        for (const id of expired) engine.emit(state, 'condition.expired', { entityId: entity.id, conditionId: id });
      }
    }, 110);

    engine.registerSystem('hour', 'effectTick', ({ state }) => {
      for (const entity of engine.queryWith(state, 'effects')) {
        const expired = effect.tick(entity, state, 1);
        for (const item of expired) engine.emit(state, 'effect.expired', { entityId: entity.id, effectId: item.id, effectKind: item.kind });
      }
    }, 109);

    engine.registerSystem('hour', 'playerNeeds', ({ state }) => {
      const player = state.entities.player;
      player.needs.energy -= 0.7;
      player.needs.hunger += 0.55;
      player.cultivation.essence = Math.min(player.cultivation.essenceMax, player.cultivation.essence + 0.35 * player.cultivation.aptitude);
      if (player.needs.hunger > 85) player.cultivation.progress = Math.max(0, player.cultivation.progress - 0.2);
    }, 100);

    engine.registerSystem('hour', 'pursuitSimulation', ({ state }) => pursuit.tick(state), 60);
    engine.registerSystem('hour', 'npcSimulation', ({ state }) => npcAI.tick(state, {
      engine, locations, phase, hour, day, random, clamp, relation, remember, log, relValence,
      brain,
      goalAction: (world, npc, goal, context) => {
        const consequence = {};
        if (combat && ['ambush', 'patrol'].includes(goal)) {
          const exchange = combat.npcAttack(world, npc, { engine, goal });
          if (exchange) consequence.combatId = exchange.id;
        }
        if (social && ['collectRumors', 'mediate', 'protectBrother', 'protectClan', 'socialize', 'trade'].includes(goal)) {
          const interaction = social.act(world, npc, goal, { engine });
          if (interaction) consequence.interactionId = interaction.id;
        }
        return consequence;
      }
    }), 50);
    engine.registerSystem('hour', 'agencySimulation', ({ state }) => agency.tick(state), 40);

    engine.registerSystem('day', 'marketDailyTick', ({ state }) => market.dailyTick(state), 100);

    engine.registerSystem('day', 'npcDailyRecovery', ({ state }) => {
      for (const npc of engine.queryWith(state, 'needs', 'memory')) {
        if (npc.id === 'player') continue;
        npc.needs.energy = clamp(npc.needs.energy + 35, 0, 100);
        npc.needs.hunger = clamp(npc.needs.hunger - 25, 0, 100);
        for (const episode of npc.memory.episodes) episode.valence *= 0.985;
      }
    }, 90);

    engine.registerSystem('day', 'zoneDailyTick', ({ state }) => {
      const player = state.entities.player;
      zoneRuntime.dailyTick(state, {
        playerLocation: player.position.location,
        random,
        engine,
        market,
        consequence,
        remember,
        log,
        damageEntity
      });
    }, 80);

    engine.registerSystem('day', 'marketShockTick', ({ state }) => {
      const shock = state.marketShock;
      if (!shock?.active || shock.resolved) return;
      shock.days += 1;
      if (shock.phase === 'shock') {
        shock.supplyLoss += 3;
        shock.severity = clamp(shock.severity + 4 - shock.relief * 0.08, 0, 100);
        shock.priceShock = clamp(shock.priceShock + 3 - shock.relief * 0.06, 0, 100);
        state.market.supply.food = Math.max(0, state.market.supply.food - 2);
        state.market.supply.water = Math.max(0, state.market.supply.water - 1);
        for (const goodId of ['food', 'water', 'moonPetal']) state.market.prices[goodId] = Math.max(1, Math.round((state.market.prices[goodId] || 1) * (1 + shock.priceShock / 100)));
        if (state.market.supply.food < 8 || state.market.supply.water < 8) {
          shock.displaced += 1;
          state.factions.caravans.tension += 1;
          state.factions.guYue.tension += 1;
          const displaced = engine.query(state, entity => entity.id.startsWith('ambient-') && entity.alive && ['village', 'caravanCamp'].includes(entity.position?.location))[0];
          if (displaced) {
            const from = displaced.position.location;
            displaced.position.location = 'whiteBoneMountain';
            remember(state, displaced.id, 'world', { kind: 'market-migration', valence: -1, text: `${displaced.identity.name}因灾害与价格冲击离开了${locations[from].name}。`, facts: { displacedByMarketShock: true, from, to: 'whiteBoneMountain' } });
          }
          consequence(state, { kind: 'market_displacement', actorId: 'world', factionId: 'caravans', source: 'marketShockTick', location: 'caravanCamp', reason: '灾害重写了商路供给，居民被迫迁移寻找食物与水。', data: { days: shock.days, food: state.market.supply.food, water: state.market.supply.water, displaced: shock.displaced }, tension: 1, pressure: 0.12 });
        }
        if (shock.days >= 5) shock.phase = 'recovery';
      } else {
        shock.severity = Math.max(0, shock.severity - 10 - shock.relief * 0.05);
        shock.priceShock = Math.max(0, shock.priceShock - 8);
        shock.relief = Math.max(0, shock.relief - 3);
        if (shock.severity <= 4 && shock.priceShock <= 4) { shock.active = false; shock.resolved = true; shock.phase = 'resolved'; }
      }
      shock.relief = Math.max(0, shock.relief - 2);
      state.facts.marketDisasterDays = shock.days;
      engine.emit(state, 'market.disaster_tick', { day: day(state), phase: shock.phase, severity: shock.severity, priceShock: shock.priceShock, supplyLoss: shock.supplyLoss, displaced: shock.displaced });
    }, 78);

    engine.registerSystem('day', 'blessedLandTick', ({ state }) => {
      const base = state.blessedLand;
      if (!base?.active) return;
      const residents = Math.max(0, base.residents || 0);
      const production = base.upgrades.production * 1.4 + Math.min(6, residents * 0.12);
      const maintenance = 1.2 + residents * 0.18 + (base.sectPressure > 70 ? 1.5 : 0);
      base.lastTickDay = day(state);
      base.maintenance += maintenance;
      base.resources = clamp(base.resources + production - maintenance, 0, 200);
      base.soulReserve = clamp(base.soulReserve + base.upgrades.production * 0.7 - (base.sectPressure > 60 ? 1 : 0), 0, 100);
      base.sectPressure = clamp(base.sectPressure + state.central.sectPressure * 0.06 - base.defense * 0.018 - (base.hidden ? 0.35 : 0), 0, 100);
      base.defense = clamp(base.defense + base.upgrades.defense * 0.18 - base.sectPressure * 0.025, 0, 100);
      if (base.resources < 18 || base.defense < 18) {
        base.sectPressure = clamp(base.sectPressure + 2, 0, 100);
        state.central.sectPressure = clamp(state.central.sectPressure + 0.8, 0, 100);
        state.factions.centralSects.tension += 0.5;
        const displaced = engine.query(state, entity => entity.id.startsWith('ambient-') && entity.alive && entity.position?.location === 'foxFairyLand')[0];
        if (displaced && base.residents > 0) {
          displaced.position.location = base.hidden ? 'shadowSectRuins' : 'centralContinent';
          base.residents -= 1; base.reputation -= 2;
          remember(state, displaced.id, 'world', { kind: 'blessed-land-migration', valence: -2, text: `${displaced.identity.name}因狐仙福地的资源或守备恶化而离开。`, facts: { from: 'foxFairyLand', to: displaced.position.location, displacedByBlessedLand: true } });
          consequence(state, { kind: 'blessed_land_migration', actorId: 'world', factionId: 'centralSects', source: 'blessedLandTick', location: 'foxFairyLand', reason: '福地经营失败迫使驻民离开，宗门压力因此更容易渗入。', data: { resources: base.resources, defense: base.defense, residents: base.residents }, tension: 1, pressure: 0.18 });
        }
      } else if (base.defense > 65 && base.resources > 55) {
        base.reputation = clamp(base.reputation + 0.5, -100, 100);
        state.central.sectPressure = Math.max(0, state.central.sectPressure - 0.25);
      }
      if (base.sectPressure > 82) state.director.pressure = clamp(state.director.pressure + 0.4, 0, 10);
      engine.emit(state, 'blessed-land.tick', { day: day(state), resources: base.resources, defense: base.defense, soulReserve: base.soulReserve, residents: base.residents, sectPressure: base.sectPressure, maintenance });
    }, 76);

    engine.registerSystem('day', 'shadowNetworkTick', ({ state }) => {
      const network = state.shadowNetwork;
      if (!network?.active) return;
      const activeNodes = Object.values(network.nodes || {}).filter(node => node.active);
      if (!activeNodes.length) { network.active = false; return; }
      const sectPressure = state.central?.sectPressure || 0;
      const shadowFaction = state.factions.shadowSect;
      const centralFaction = state.factions.centralSects;
      const maintenance = activeNodes.length * 0.9 + network.recruits * 0.06;
      network.lastTickDay = day(state);
      network.resources = clamp(network.resources + (shadowFaction?.influence || 0) * 0.008 - maintenance, 0, 200);
      network.intelligence += activeNodes.length * 0.22 + network.cohesion * 0.004;
      network.exposure = clamp(network.exposure + sectPressure * 0.012 + network.visibility * 0.01 - activeNodes.reduce((sum, node) => sum + node.secrecy, 0) * 0.002, 0, 100);
      network.visibility = clamp(network.visibility + activeNodes.length * 0.12 - network.exposure * 0.004, 0, 100);
      network.cohesion = clamp(network.cohesion + Math.min(0.7, network.resources * 0.01) - network.exposure * 0.018 - (network.resources < 12 ? 1.2 : 0), 0, 100);
      for (const node of activeNodes) {
        node.supply = clamp(node.supply - 0.55 - network.exposure * 0.004 + network.cohesion * 0.003, 0, 100);
        node.control = clamp(node.control + (network.cohesion > 45 ? 0.25 : -0.18) - (node.supply < 12 ? 0.8 : 0), 0, 100);
        node.secrecy = clamp(node.secrecy - network.visibility * 0.006 + (network.cohesion > 60 ? 0.1 : 0), 0, 100);
        if (node.supply <= 3 || node.secrecy <= 5) {
          node.active = false; network.cohesion = Math.max(0, network.cohesion - 5); network.betrayals += 1;
          consequence(state, { kind: 'shadow_node_collapse', actorId: 'yingwuxie', factionId: 'shadowSect', source: 'shadowNetworkTick', location: node.location, reason: '影宗节点补给或隐蔽性崩溃，残脉被迫放弃一条暗线。', data: { nodeId: node.id, supply: node.supply, secrecy: node.secrecy, betrayals: network.betrayals }, tension: 1, pressure: 0.28 });
        }
      }
      if (network.nodes.blessedLand?.active && state.blessedLand?.active) { state.blessedLand.resources = Math.max(0, state.blessedLand.resources - 0.3); network.resources = Math.min(200, network.resources + 0.5); }
      if (network.nodes.central?.active) { state.central.sectPressure = clamp(state.central.sectPressure + 0.18, 0, 100); if (centralFaction) centralFaction.tension += 0.15; }
      if (day(state) % 5 === 0 && network.intelligence >= 1 && activeNodes.length >= 1) {
        network.sequence += 1; network.intelligence = Math.max(0, network.intelligence - 1); network.resources = Math.max(0, network.resources - 1.5); network.exposure = clamp(network.exposure + 1.5, 0, 100);
        const node = activeNodes.sort((a, b) => b.control - a.control)[0];
        const operation = { id: `shadow-${network.sequence}`, kind: 'intelligence_exchange', day: day(state), nodeId: node.id, location: node.location, exposure: network.exposure, intelligence: network.intelligence };
        network.operations.push(operation); network.operations = network.operations.slice(-128);
        if (shadowFaction) shadowFaction.influence = clamp(shadowFaction.influence + 0.5, 0, 100);
        if (node.location === 'centralContinent' && centralFaction) centralFaction.tension += 0.8;
        if (state.entities.yingwuxie) remember(state, 'yingwuxie', 'world', { kind: 'shadow-operation', valence: 1, text: `影宗通过${locations[node.location]?.name || node.location}交换了一条情报，代价是留下新的暴露痕迹。`, facts: { operationId: operation.id, nodeId: node.id, exposure: network.exposure } });
        engine.emit(state, 'shadow-network.operation', operation);
      }
      if (network.exposure > 75) { network.cohesion = Math.max(0, network.cohesion - 0.8); if (centralFaction) centralFaction.tension += 0.4; state.director.pressure = clamp(state.director.pressure + 0.15, 0, 10); }
      engine.emit(state, 'shadow-network.tick', { day: day(state), activeNodes: activeNodes.map(node => node.id), resources: network.resources, cohesion: network.cohesion, intelligence: network.intelligence, visibility: network.visibility, exposure: network.exposure, betrayals: network.betrayals });
    }, 74);

    engine.registerSystem('day', 'wolfCrisisTick', ({ state }) => {
      const crisis = state.wolfCrisis;
      if (!crisis?.active || crisis.phase === 'aftermath' || crisis.phase === 'resolved') return;
      const assault = crisis.phase === 'assault';
      const marketRelief = state.facts.marketActivity ? 0.6 : 0;
      const legitimacyRelief = (crisis.alliance?.legitimacy || 0) * 0.025;
      crisis.lastTickDay = day(state);
      crisis.supply = clamp(crisis.supply - (assault ? 4 : 1.5) + marketRelief + legitimacyRelief, 0, 100);
      crisis.pressure = clamp(crisis.pressure + (assault ? 5 : 1.5) - (crisis.relief > 0 ? 1.5 : 0), 0, 100);
      crisis.relief = Math.max(0, crisis.relief - 2);
      if (assault) {
        crisis.battles += 1;
        for (const locationId of ['bambooForest', 'riverbank', 'cliffCave']) state.zones[locationId].danger = clamp(state.zones[locationId].danger + 2, 0, 100);
      }
      if (crisis.supply < 25 || crisis.pressure > 72) {
        crisis.casualties += 1;
        crisis.displacement += 1;
        state.factions.guYue.tension += 1.5;
        state.factions.bai.tension += 1;
        state.factions.xiong.tension += 1;
        const displaced = engine.query(state, entity => entity.id.startsWith('ambient-') && entity.alive && ['village', 'bambooForest', 'riverbank'].includes(entity.position?.location))[0];
        if (displaced) {
          const from = displaced.position.location;
          displaced.position.location = 'caravanCamp';
          remember(state, displaced.id, 'world', { kind: 'migration', valence: -2, text: `${displaced.identity.name}因狼潮与粮道压力离开了${locations[from].name}。`, facts: { displacedByWolfTide: true, from, to: 'caravanCamp' } });
        }
        consequence(state, { kind: 'wolf_displacement', actorId: 'world', factionId: 'guYue', source: 'wolfCrisisTick', location: 'village', reason: '狼潮与补给压力迫使居民迁离安全边缘。', data: { supply: crisis.supply, pressure: crisis.pressure, casualties: crisis.casualties, displacement: crisis.displacement }, tension: 1, pressure: 0.15 });
      }
      if (crisis.pressure > 88) state.director.pressure = clamp(state.director.pressure + 0.5, 0, 10);
      engine.emit(state, 'wolf.crisis_tick', { phase: crisis.phase, day: day(state), supply: crisis.supply, pressure: crisis.pressure, casualties: crisis.casualties, displacement: crisis.displacement });
    }, 75);

    engine.registerSystem('day', 'clanPressureTick', ({ state }) => {
      const player = state.entities.player;
      const rel = relation(state, 'player', 'guYue');
      state.factions.guYue.tension += player.cultivation.rank > 1 ? 1 : 0;
      state.factions.bai.tension += state.factions.guYue.tension > 45 ? 1 : 0;
      state.factions.guYue.relations.bai = clamp((state.factions.guYue.relations.bai || 0) - (state.factions.guYue.tension > 40 ? 1 : 0), -100, 100);
      state.factions.guYue.relations.xiong = clamp((state.factions.guYue.relations.xiong || 0) - (state.factions.guYue.tension > 55 ? 1 : 0), -100, 100);
      state.factions.caravans.relations.guYue = clamp((state.factions.caravans.relations.guYue || 0) + (state.facts.marketActivity ? 1 : 0), -100, 100);
      state.director.pressure = clamp(state.director.pressure + (player.needs.hunger > 65 ? 2 : 0) + (rel.trust < 0 ? 1 : 0), 0, 10);
    }, 70);

    engine.registerSystem('day', 'frontierSupplyTick', ({ state }) => {
      if (!state.frontier?.opened) return;
      state.frontier.supply = clamp(state.frontier.supply - 0.8 + (state.facts.marketActivity ? 0.35 : 0), 0, 100);
      state.frontier.campaignPressure = clamp(state.frontier.campaignPressure + (state.frontier.supply < 25 ? 1 : 0), 0, 100);
      if (state.factions.black && state.frontier.supply < 25) state.factions.black.tension += 1;
      if (state.factions.northernTribes && state.frontier.campaignPressure > 40) state.factions.northernTribes.tension += 1;
    }, 60);

    engine.registerSystem('day', 'worldWarTick', ({ state }) => {
      if (!state.worldWar?.fiveRegions) return;
      const war = state.worldWar;
      war.lastTickDay = day(state);
      war.heat = clamp(war.heat + 0.35, 0, 100);
      if (state.factions.heavenlyCourt) state.factions.heavenlyCourt.tension += 0.25;
      if (state.factions.longLifeHeaven) state.factions.longLifeHeaven.tension += 0.2;
      for (const front of Object.values(war.fronts || {})) {
        if (!front.active) continue;
        const primary = state.factions[front.primaryFaction];
        const opposing = state.factions[front.opposingFaction];
        const logistics = state.facts.marketActivity ? 0.35 : 0;
        front.supply = clamp(front.supply - 1.2 - war.heat * 0.012 + logistics + (front.control > 70 ? -0.2 : 0), 0, 100);
        front.pressure = clamp(front.pressure + (front.supply < 25 ? 1.7 : 0.35) + (war.heat > 70 ? 0.25 : 0) - (front.control > 70 ? 0.25 : 0), 0, 100);
        front.control = clamp(front.control + ((primary?.influence || 50) - (opposing?.influence || 50)) * 0.002, 0, 100);
        if (primary) primary.tension += 0.15;
        if (opposing) opposing.tension += 0.15;
        if (front.pressure > 55 && day(state) - front.lastActionDay >= 2) {
          front.battles += 1; front.casualties += front.supply < 20 ? 2 : 1; front.lastActionDay = day(state); war.heat = clamp(war.heat + 0.8, 0, 100);
          if (primary) { primary.tension += 1; primary.influence = clamp(primary.influence + (front.control > 50 ? 0.4 : -0.5), 0, 100); }
          if (opposing) opposing.tension += 1;
          const operation = { id: `war-${front.id}-${day(state)}-${front.battles}`, frontId: front.id, kind: 'battle', day: day(state), location: front.location, commanderId: front.commanderId, supply: front.supply, pressure: front.pressure, control: front.control, casualties: front.casualties };
          war.operations.push(operation); war.operations = war.operations.slice(-128);
          if (front.commanderId && state.entities[front.commanderId]) remember(state, front.commanderId, 'world', { kind: 'war-operation', valence: -1, text: `${locations[front.location]?.name || front.location}的战线发生了一次补给与控制权争夺。`, facts: { frontId: front.id, battle: front.battles, supply: front.supply, pressure: front.pressure } });
          consequence(state, { kind: 'war_front_battle', actorId: front.commanderId || 'world', factionId: front.primaryFaction, source: 'worldWarTick', location: front.location, reason: '跨区域战线在补给和压力积累后自动爆发战斗。', data: { frontId: front.id, supply: front.supply, pressure: front.pressure, control: front.control, casualties: front.casualties }, tension: 1, pressure: 0.2 });
        }
        engine.emit(state, 'world-war.front_tick', { frontId: front.id, day: day(state), supply: front.supply, pressure: front.pressure, control: front.control, battles: front.battles, casualties: front.casualties });
      }
    }, 50);

    engine.registerSystem('day', 'eternalWarTick', ({ state }) => {
      if (!state.eternalWar?.twoHeavens) return;
      state.eternalWar.cosmicHeat = clamp(state.eternalWar.cosmicHeat + 0.3, 0, 100);
      state.eternalWar.dreamPressure = clamp(state.eternalWar.dreamPressure + (state.eternalWar.dream ? 0.2 : 0), 0, 100);
      if (state.factions.twoHeavensForces) state.factions.twoHeavensForces.tension += 0.2;
      if (state.eternalWar.cosmicHeat > 60 && state.factions.heavenlyCourt) state.factions.heavenlyCourt.tension += 0.25;
    }, 40);

    engine.registerSystem('day', 'worldDaySummary', ({ state }) => {
      engine.emit(state, 'world.day_tick', { day: day(state), pressure: state.director.pressure });
      log(state, 'day_tick', `第${day(state)}日结束，山寨、势力与人物各自推进了一步。`, { pressure: state.director.pressure });
      history.snapshot(state);
    }, 0);
  }

  return { register };
});
