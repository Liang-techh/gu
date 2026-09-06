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
      brain, social, combat
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
      state.worldWar.heat = clamp(state.worldWar.heat + 0.35, 0, 100);
      if (state.factions.heavenlyCourt) state.factions.heavenlyCourt.tension += 0.25;
      if (state.factions.longLifeHeaven) state.factions.longLifeHeaven.tension += 0.2;
      if (state.factions.southernSuperClans && state.worldWar.southern) state.factions.southernSuperClans.tension += 0.15;
      if (state.factions.westernDesertFang && state.worldWar.western) state.factions.westernDesertFang.tension += 0.15;
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
