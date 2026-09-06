(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuListeners = factory();
})(globalThis, function () {
  'use strict';

  function register({ engine, rumor, locations, remember, clamp, identity, knowledge, log }) {
    engine.registerEventListener('*', 'rumorPropagation', ({ state, event }) => {
      if (event.type === 'social.interaction' && event.payload?.rumor === false) return;
      rumor.propagate(state, event, { locations, query: engine.query, remember });
    });
    engine.registerEventListener('world.travel', 'zoneVisitAccounting', ({ state, event }) => {
      const zone = state.zones[event.payload.to];
      if (!zone) return;
      zone.visits += 1;
      zone.activity += 2;
    });
    engine.registerEventListener('arena.match', 'arenaCrowdActivity', ({ state, event }) => {
      const zone = state.zones.merchantCity;
      if (zone) zone.activity += event.payload.result === 'win' ? 5 : 3;
    });
    engine.registerEventListener('inheritance.round', 'inheritanceFrontierPressure', ({ state, event }) => {
      const zone = state.zones.threeForkMountain;
      if (zone) {
        zone.activity += event.payload.result === 'success' ? 5 : 2;
        zone.danger += event.payload.result === 'success' ? 1 : 0.5;
      }
    });
    engine.registerEventListener('frontier.patrol', 'frontierWarPressure', ({ state, event }) => {
      const zone = state.zones[state.frontier.location];
      if (zone) zone.activity += event.payload.result === 'success' ? 8 : 5;
      if (state.factions.black) state.factions.black.tension += event.payload.result === 'success' ? 0.5 : 1.5;
    });
    engine.registerEventListener('tower.floor', 'towerCompetitionPressure', ({ state, event }) => {
      const zone = state.zones.trueYangTower;
      if (zone) { zone.activity += event.payload.result === 'success' ? 7 : 4; zone.danger += event.payload.result === 'success' ? 1 : 2; }
      if (state.factions.giantSun) state.factions.giantSun.tension += event.payload.result === 'success' ? 0.5 : 1;
    });
    engine.registerEventListener('auction.lot', 'auctionMarketActivity', ({ state, event }) => {
      const zone = state.zones.immortalAuction;
      if (zone) zone.activity += event.payload.result === 'bid' ? 8 : 4;
      if (state.factions.auctionImmortals) state.factions.auctionImmortals.tension += event.payload.result === 'bid' ? 0.8 : ['raise', 'rumor'].includes(event.payload.result) ? 1.2 : 0.2;
      if (event.payload.trace >= 10) {
        state.director.pressure = clamp(state.director.pressure + Math.min(0.5, event.payload.trace * 0.005), 0, 10);
        const qin = state.entities.qinbaisheng;
        if (qin) identity.exposeTrace(state.entities.player, qin, state.clock, knowledge, '拍卖追踪');
      }
    });
    engine.registerEventListener('market.trade', 'marketActivity', ({ state, event }) => {
      const zone = state.zones[event.payload.location];
      if (zone) zone.activity += event.payload.side === 'buy' ? 2 : 1;
      const faction = event.payload.factionId && state.factions[event.payload.factionId];
      if (faction) faction.influence += event.payload.side === 'buy' ? 0.15 : 0.1;
      const actor = state.entities[event.payload.actorId];
      log(state, 'market_trade', `${actor?.identity?.name || '某人'}在${locations[event.payload.location]?.name || event.payload.location}完成了一笔${event.payload.side === 'buy' ? '买入' : '卖出'}。`, { ...event.payload });
    });
    engine.registerEventListener('dream.dive', 'dreamRealmPressure', ({ state, event }) => {
      const zone = state.zones.dreamRealms;
      if (zone) { zone.activity += event.payload.result === 'success' ? 8 : 12; zone.danger += event.payload.result === 'success' ? 1 : 3; }
      if (state.factions.dreamPathForces) state.factions.dreamPathForces.tension += event.payload.result === 'success' ? 0.4 : 1.2;
    });
    engine.registerEventListener('local.resource_gathered', 'localResourceActivity', ({ state, event }) => {
      const zone = state.zones[event.payload.location];
      if (zone) zone.activity += event.payload.actorId === 'player' ? 2 : 1;
      const actor = state.entities[event.payload.actorId];
      const faction = actor?.faction && state.factions[actor.faction];
      if (faction && event.payload.actorId !== 'player') faction.influence += 0.15;
      if ((state.localObjects?.[event.payload.location]?.objects || []).some(object => object.id === event.payload.objectId && !object.active)) {
        if (zone) zone.activity += 1;
        engine.emit(state, 'local.object_depleted', { location: event.payload.location, objectId: event.payload.objectId, resourceId: event.payload.resourceId });
      }
    });
    engine.registerEventListener('local.object_follow', 'localTracePressure', ({ state, event }) => {
      if (['trace', 'relic'].includes(event.payload.kind)) state.director.pressure = clamp(state.director.pressure + (event.payload.actorId === 'player' ? 0.1 : 0.06), 0, 10);
    });
    engine.registerEventListener('npc.local_contact', 'localContactEncounter', ({ state, event }) => {
      const npc = state.entities[event.payload.npcId];
      if (!npc) return;
      state.encounters ||= { sequence: 0, recent: [], lastByNpc: {}, contactState: {} };
      state.encounters.lastByNpc ||= {}; state.encounters.contactState ||= {};
      if (state.encounters.lastByNpc[npc.id] === state.clock) return;
      state.encounters.sequence = (Number(state.encounters.sequence) || 0) + 1;
      const encounter = {
        id: `enc-${state.encounters.sequence}`,
        npcId: npc.id,
        targetId: event.payload.targetId || 'player',
        location: event.payload.location,
        cell: { ...(event.payload.cell || npc.position.cell) },
        goal: event.payload.goal || npc.goals?.active || 'idle',
        clock: state.clock,
        status: 'new'
      };
      state.encounters.recent.unshift(encounter);
      state.encounters.recent = state.encounters.recent.slice(0, 128);
      state.encounters.lastByNpc[npc.id] = state.clock;
      remember(state, 'player', npc.id, { kind: 'local-contact', valence: 1, text: `你在${locations[encounter.location]?.name || encounter.location}内与${npc.identity.name}近距离擦肩而过。`, facts: { lastLocalContact: state.clock, lastContactLocation: encounter.location, lastContactCell: encounter.cell } });
      if (event.payload.reason === 'player_approach') remember(state, npc.id, 'player', { kind: 'local-contact', valence: 1, text: `你感觉到${state.entities.player.identity.name}主动走近了你。`, facts: { playerApproached: true, lastLocalContact: state.clock, lastContactLocation: encounter.location } });
      log(state, 'local_contact', `${npc.identity.name}进入了你的近距离遭遇范围。`, { npcId: npc.id, location: encounter.location, cell: encounter.cell, goal: encounter.goal });
      const zone = state.zones[encounter.location];
      if (zone) zone.activity += 1;
    });
    engine.registerEventListener('social.interaction', 'encounterInteraction', ({ state, event }) => {
      if (event.payload.actorId !== 'player' && event.payload.targetId !== 'player') return;
      const npcId = event.payload.actorId === 'player' ? event.payload.targetId : event.payload.actorId;
      const encounter = [...(state.encounters?.recent || [])].find(item => item.npcId === npcId && item.status === 'new');
      if (encounter) encounter.status = 'engaged';
    });
    engine.registerEventListener('combat.started', 'encounterCombat', ({ state, event }) => {
      if (event.payload.attackerId !== 'player' && event.payload.defenderId !== 'player') return;
      const npcId = event.payload.attackerId === 'player' ? event.payload.defenderId : event.payload.attackerId;
      const encounter = [...(state.encounters?.recent || [])].find(item => item.npcId === npcId && item.status === 'new');
      if (encounter) encounter.status = 'engaged';
    });
    return ['rumorPropagation', 'zoneVisitAccounting', 'arenaCrowdActivity', 'inheritanceFrontierPressure', 'frontierWarPressure', 'towerCompetitionPressure', 'auctionMarketActivity', 'marketActivity', 'dreamRealmPressure', 'localResourceActivity', 'localTracePressure', 'localContactEncounter', 'encounterInteraction', 'encounterCombat'];
  }

  return { register };
});
