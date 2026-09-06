const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/simulation.js');

function ok(state, command) {
  const result = S.dispatch(state, command);
  assert.equal(result.ok, true, result.message);
  return result.state;
}

function open(state, choice = 'observe') {
  return ok(state, { type: 'resolve_event', choice });
}

test('world starts from novel-derived opening but resolves through an event contract', () => {
  const state = S.newWorld({ name: '测试者', aptitude: '乙等', seed: 'rain' });
  assert.equal(state.content.id, 'gu-multi-region-v4');
  assert.equal(S.CONTENT_INDEX.volumes[0].id, 'volume-1');
  assert.equal(S.CONTENT_INDEX.volumes[2].id, 'volume-3');
  assert.equal(S.CONTENT_INDEX.volumes[3].id, 'volume-4');
  assert.equal(state.history.origin.contentId, state.content.id);
  assert.equal(state.events.active.id, 'openingRite');
  assert.equal(state.entities.fangyuan.identity.name, '古月方源');
  const next = open(state, 'reveal');
  assert.equal(next.events.active, null);
  assert.equal(next.relationships['guYue::player'].trust, 20);
  assert.ok(next.log.some(entry => entry.type === 'choice'));
});

test('zones have population tables, resources and regeneration independent of story events', () => {
  const state = S.newWorld({ seed: 'zones' });
  assert.ok(Object.keys(state.zones).length >= 7);
  assert.ok(Object.values(state.entities).some(entity => entity.id.startsWith('ambient-')));
  const before = state.zones.bambooForest.resources.moonPetal;
  let next = open(state, 'observe');
  next = ok(next, { type: 'action', id: 'travel', location: 'village' });
  next = ok(next, { type: 'action', id: 'travel', location: 'bambooForest' });
  next = ok(next, { type: 'action', id: 'gather' });
  assert.ok(next.zones.bambooForest.resources.moonPetal < before);
  next = ok(next, { type: 'action', id: 'wait', hours: 24 });
  assert.ok(next.zones.bambooForest.resources.moonPetal > 0);
});

test('zone builder reconstructs content-driven zones without depending on the UI', () => {
  const zones = S.ZONE_BUILDER.buildZones(S.LOCATIONS);
  assert.equal(Object.keys(zones).length, Object.keys(S.LOCATIONS).length);
  assert.equal(zones.merchantCity.resources.food, 5);
  assert.equal(zones.threeForkMountain.resources.relicFragment, 6);
  assert.equal(typeof S.ZONE_BUILDER.seedPopulation, 'function');
});

test('same seed and same commands produce the same world state', () => {
  let a = S.newWorld({ seed: 'fixed' });
  let b = S.newWorld({ seed: 'fixed' });
  const commands = [
    { type: 'resolve_event', choice: 'observe' },
    { type: 'action', id: 'travel', location: 'village' },
    { type: 'action', id: 'travel', location: 'bambooForest' },
    { type: 'action', id: 'gather' },
    { type: 'action', id: 'wait', hours: 4 }
  ];
  for (const command of commands) { a = ok(a, command); b = ok(b, command); }
  assert.deepEqual(a, b);
});

test('NPC social interaction changes relation and creates durable memory', () => {
  let state = open(S.newWorld({ seed: 'social' }), 'observe');
  state = ok(state, { type: 'action', id: 'talk', target: 'fangzheng', mode: 'help' });
  const relation = state.relationships['fangzheng::player'];
  assert.ok(relation.trust >= 13);
  assert.ok(state.entities.fangzheng.memory.episodes.some(item => item.kind === 'help'));
  const before = state.entities.fangzheng.memory.episodes.length;
  state = ok(state, { type: 'action', id: 'wait', hours: 2 });
  assert.ok(state.entities.fangzheng.memory.episodes.length >= before);
});

test('domain events persist as a ledger and spread local rumors to uninvolved NPCs', () => {
  let state = open(S.newWorld({ seed: 'rumors' }), 'observe');
  const uninvolved = Object.values(state.entities).find(entity => entity.id !== 'player' && entity.id !== 'fangzheng' && entity.position.location === 'academy');
  assert.ok(uninvolved);
  state = ok(state, { type: 'action', id: 'talk', target: 'fangzheng', mode: 'threaten' });
  assert.ok(state.events.recent.some(event => event.type === 'social.interaction'));
  assert.ok(S.snapshot(state).domainEvents.some(event => event.type === 'social.interaction'));
  assert.ok(state.entities[uninvolved.id].memory.episodes.some(item => item.kind === 'rumor-social'));
  assert.equal(state.entities[uninvolved.id].memory.facts.fangzheng.heardInteraction !== undefined, true);
  const factionObserver = Object.values(state.entities).find(entity => entity.id !== 'player' && entity.id !== 'fangzheng' && entity.faction === 'guYue' && entity.position.location !== 'academy');
  assert.ok(factionObserver);
  assert.ok(state.entities[factionObserver.id].memory.episodes.some(item => item.kind === 'faction-rumor'));
});

test('content-driven NPC contracts persist through acceptance, objective progress and delivery', () => {
  let state = open(S.newWorld({ seed: 'contracts' }), 'observe');
  state = ok(state, { type: 'action', id: 'wait', hours: 24 });
  assert.ok(state.contracts.available.includes('fangzheng-support'));
  state = ok(state, { type: 'action', id: 'wait', hours: 1 });
  state = ok(state, { type: 'action', id: 'accept_contract', contractId: 'fangzheng-support' });
  state = ok(state, { type: 'action', id: 'talk', target: 'fangzheng', mode: 'help' });
  state = ok(state, { type: 'action', id: 'complete_contract', contractId: 'fangzheng-support' });
  assert.ok(state.contracts.completed.some(item => item.id === 'fangzheng-support'));
  assert.equal(state.contracts.active['fangzheng-support'], undefined);
  assert.ok(state.history.events.some(item => item.type === 'contract'));
});

test('content-driven conversations apply conditional choices to relations, memory and history', () => {
  let state = open(S.newWorld({ seed: 'conversation' }), 'observe');
  state = ok(state, { type: 'action', id: 'wait', hours: 25 });
  assert.ok(S.CONVERSATION_RUNTIME.list(S.CONVERSATION_DEFS, state, 'fangzheng', { day: S.day }).some(item => item.id === 'fangzheng-proof'));
  state = ok(state, { type: 'action', id: 'conversation', target: 'fangzheng', conversationId: 'fangzheng-proof', choiceId: 'encourage' });
  assert.ok(state.relationships['fangzheng::player'].trust > 6);
  assert.equal(state.entities.fangzheng.memory.facts.player.encouraged, true);
  assert.ok(state.history.events.some(item => item.type === 'conversation'));
});

test('NPCs run schedules while the player waits instead of freezing the world', () => {
  let state = open(S.newWorld({ seed: 'schedule' }), 'observe');
  const start = state.entities.fangyuan.position.location;
  state = ok(state, { type: 'action', id: 'wait', hours: 8 });
  state = ok(state, { type: 'action', id: 'wait', hours: 8 });
  assert.ok(state.clock > 20);
  assert.ok(state.entities.fangyuan.goals.active);
  assert.ok(state.log.some(entry => entry.type === 'npc_move') || state.entities.fangyuan.position.location !== start);
});

test('NPC navigation follows a multi-zone route instead of requiring direct adjacency', () => {
  const state = S.newWorld({ seed: 'pathfinding' });
  assert.deepEqual(S.ENGINE.findPath(state.locations, 'bambooForest', 'academy'), ['bambooForest', 'village', 'academy']);
  assert.deepEqual(S.ENGINE.findPath(state.locations, 'cliffCave', 'academy'), ['cliffCave', 'riverbank', 'bambooForest', 'village', 'academy']);
});

test('NPC goals produce world-side consequences, not only text', () => {
  let state = open(S.newWorld({ seed: 'npc-goals' }), 'observe');
  const before = state.facts.marketActivity || 0;
  state = ok(state, { type: 'action', id: 'wait', hours: 12 });
  assert.ok((state.facts.marketActivity || 0) > before || state.log.some(entry => entry.type === 'npc_goal_action'));
  assert.ok(state.log.some(entry => entry.type === 'npc_goal_action'));
});

test('faction network records both player-facing attitude and inter-faction tension', () => {
  let state = open(S.newWorld({ seed: 'factions' }), 'observe');
  const before = state.factions.guYue.attitude;
  state = ok(state, { type: 'action', id: 'talk', target: 'fangzheng', mode: 'help' });
  assert.ok(state.factions.guYue.attitude > before);
  assert.equal(typeof state.factions.guYue.relations.bai, 'number');
  state = ok(state, { type: 'action', id: 'wait', hours: 24 });
  assert.ok(typeof state.factions.caravans.relations.guYue === 'number');
});

test('director emits a situation from world conditions and does not bypass dispatch', () => {
  let state = open(S.newWorld({ seed: 'director' }), 'observe');
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  state = ok(state, { type: 'action', id: 'travel', location: 'bambooForest' });
  state = ok(state, { type: 'action', id: 'wait', hours: 20 });
  assert.equal(state.events.active?.id, 'moonlightRumor');
  const resolved = ok(state, { type: 'resolve_event', choice: 'follow' });
  assert.equal(resolved.flags.moonlightRumor, true);
  assert.equal(resolved.entities.player.memory.facts.world.relicLead, true);
});

test('market, alliance and wolf crisis are persistent world events', () => {
  let state = open(S.newWorld({ seed: 'world-events' }), 'observe');
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  const choices = { marketArrival: 'listen', auction: 'observe', allianceCouncil: 'aid', wolfTide: 'mobilize' };
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    if (state.events.active) {
      const eventId = state.events.active.id;
      if (choices[eventId]) { seen.add(eventId); state = ok(state, { type: 'resolve_event', choice: choices[eventId] }); }
      else state = ok(state, { type: 'resolve_event', choice: state.events.active.choices[0].id });
    } else state = ok(state, { type: 'action', id: 'wait', hours: 12 });
  }
  assert.ok(seen.has('marketArrival'));
  assert.ok(seen.has('auction'));
  assert.ok(seen.has('allianceCouncil'));
  assert.ok(seen.has('wolfTide'));
  assert.equal(state.flags.marketArrived, true);
  assert.equal(state.flags.allianceCouncil, true);
  assert.equal(state.flags.wolfTide, true);
  assert.ok(state.director.thread.includes('wolfTide'));
});

test('late first-volume content uses delayed NPC spawning and director conditions', () => {
  let state = open(S.newWorld({ seed: 'late-volume-one' }), 'observe');
  assert.equal(state.entities.tieruonan, undefined);
  assert.equal(state.facts.latentNpcs.tieruonan, 22);
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  const choices = { marketArrival: 'listen', auction: 'observe', allianceCouncil: 'aid', wolfTide: 'mobilize', threeClanTournament: 'observe', ironInvestigation: 'cooperate' };
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    if (state.events.active) {
      const eventId = state.events.active.id;
      if (choices[eventId]) { seen.add(eventId); state = ok(state, { type: 'resolve_event', choice: choices[eventId] }); }
      else state = ok(state, { type: 'resolve_event', choice: state.events.active.choices[0].id });
    } else state = ok(state, { type: 'action', id: 'wait', hours: 12 });
  }
  assert.ok(seen.has('threeClanTournament'));
  assert.ok(seen.has('ironInvestigation'));
  assert.equal(state.flags.tournamentAnnounced, true);
  assert.equal(state.flags.investigationArrived, true);
  assert.equal(state.entities.tieruonan.identity.name, '铁若男');
  assert.equal(state.entities.tiexueleng.identity.name, '铁血冷');
});

test('volume two content pack opens merchant city, arena, inheritance and sect frontier', () => {
  let state = open(S.newWorld({ seed: 'volume-two' }), 'observe');
  assert.deepEqual(S.ENGINE.findPath(state.locations, 'academy', 'heavenClimbMountain'), ['academy', 'village', 'caravanCamp', 'whiteBoneMountain', 'merchantCity', 'threeForkMountain', 'heavenClimbMountain']);
  const choices = { marketArrival: 'listen', auction: 'observe', allianceCouncil: 'aid', wolfTide: 'mobilize', threeClanTournament: 'observe', ironInvestigation: 'cooperate', merchantCityArrival: 'enter', merchantArena: 'recruit', threeKingsInheritance: 'scout', heavenClimbTransmission: 'follow' };
  const advance = hours => {
    for (let i = 0; i < hours / 12; i++) {
      if (state.events.active) state = ok(state, { type: 'resolve_event', choice: choices[state.events.active.id] || state.events.active.choices[0].id });
      else state = ok(state, { type: 'action', id: 'wait', hours: 12 });
    }
    while (state.events.active) state = ok(state, { type: 'resolve_event', choice: choices[state.events.active.id] || state.events.active.choices[0].id });
  };
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  advance(900);
  state = ok(state, { type: 'action', id: 'travel', location: 'caravanCamp' });
  state = ok(state, { type: 'action', id: 'travel', location: 'whiteBoneMountain' });
  if (state.events.active) state = ok(state, { type: 'resolve_event', choice: choices[state.events.active.id] });
  state = ok(state, { type: 'action', id: 'travel', location: 'merchantCity' });
  advance(60);
  state = ok(state, { type: 'action', id: 'arena_match' });
  state = ok(state, { type: 'action', id: 'arena_match' });
  assert.equal(state.arena.matches, 2);
  state = ok(state, { type: 'action', id: 'travel', location: 'threeForkMountain' });
  advance(120);
  for (let i = 0; i < 12 && state.inheritance.round < 3; i++) state = ok(state, { type: 'action', id: 'inheritance_round' });
  assert.equal(state.inheritance.round, 3);
  state = ok(state, { type: 'action', id: 'travel', location: 'heavenClimbMountain' });
  advance(120);
  assert.equal(state.flags.merchantCityOpened, true);
  assert.equal(state.flags.arenaTrial, true);
  assert.equal(state.flags.threeKingsAwakened, true);
  assert.equal(state.flags.heavenClimbRumor, true);
  assert.equal(state.entities.shangxinci.identity.name, '商心慈');
  assert.ok(state.history.events.some(entry => entry.type === 'arena_match'));
  assert.ok(state.history.events.some(entry => entry.type === 'inheritance_round'));
  assert.ok(state.history.events.some(event => event.type === 'choice' && event.data?.source?.source?.endsWith('第124章.txt')));
});

test('volume three content pack turns northern war and true yang tower into stateful frontier events', () => {
  let state = open(S.newWorld({ seed: 'volume-three' }), 'observe');
  const choices = {
    marketArrival: 'listen', auction: 'observe', allianceCouncil: 'aid', wolfTide: 'mobilize',
    threeClanTournament: 'observe', ironInvestigation: 'cooperate', merchantCityArrival: 'enter',
    merchantArena: 'recruit', threeKingsInheritance: 'scout', heavenClimbTransmission: 'follow',
    northernWarArrival: 'enter', blackCampaign: 'mediate', imperialCourtOpening: 'relief', trueYangTowerFormation: 'enter',
    foxFairyLandReturn: 'recover', centralContinentArrival: 'trade', immortalAuction: 'observe', sectPressure: 'negotiate'
  };
  const advance = hours => {
    for (let i = 0; i < hours / 12; i++) {
      if (state.events.active) state = ok(state, { type: 'resolve_event', choice: choices[state.events.active.id] || state.events.active.choices[0].id });
      else state = ok(state, { type: 'action', id: 'wait', hours: 12 });
    }
    while (state.events.active) state = ok(state, { type: 'resolve_event', choice: choices[state.events.active.id] || state.events.active.choices[0].id });
  };
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  advance(900);
  state = ok(state, { type: 'action', id: 'travel', location: 'caravanCamp' });
  state = ok(state, { type: 'action', id: 'travel', location: 'whiteBoneMountain' });
  if (state.events.active) state = ok(state, { type: 'resolve_event', choice: choices[state.events.active.id] || state.events.active.choices[0].id });
  state = ok(state, { type: 'action', id: 'travel', location: 'merchantCity' });
  advance(60);
  state = ok(state, { type: 'action', id: 'travel', location: 'threeForkMountain' });
  advance(120);
  state = ok(state, { type: 'action', id: 'travel', location: 'heavenClimbMountain' });
  advance(180);
  state = ok(state, { type: 'action', id: 'travel', location: 'northernPlains' });
  advance(120);
  state = ok(state, { type: 'action', id: 'frontier_patrol' });
  state = ok(state, { type: 'action', id: 'travel', location: 'blackTribeCamp' });
  advance(240);
  state = ok(state, { type: 'action', id: 'travel', location: 'imperialCourt' });
  advance(240);
  state = ok(state, { type: 'action', id: 'travel', location: 'trueYangTower' });
  advance(120);
  assert.equal(state.flags.northernFrontierOpened, true);
  assert.equal(state.flags.blackCampaign, true);
  assert.equal(state.flags.imperialCourtOpened, true);
  assert.equal(state.flags.trueYangTowerFormed, true);
  assert.equal(state.entities.heiloulan.identity.name, '黑楼兰');
  assert.equal(state.entities.taibaiyunsheng.identity.name, '太白云生');
  assert.ok(state.history.events.some(event => event.data?.source?.source?.endsWith('第149章.txt')));
  assert.ok(state.frontier.campaignPressure > 0);
  state = ok(state, { type: 'action', id: 'tower_floor' });
  assert.equal(state.tower.attempts, 2);
  assert.ok(state.history.events.some(event => event.type === 'tower_floor'));
  state = ok(state, { type: 'action', id: 'travel', location: 'foxFairyLand' });
  advance(288);
  state = ok(state, { type: 'action', id: 'travel', location: 'centralContinent' });
  advance(168);
  state = ok(state, { type: 'action', id: 'travel', location: 'immortalAuction' });
  advance(288);
  state = ok(state, { type: 'action', id: 'auction_lot', mode: 'bid' });
  assert.equal(state.central.lotsSold, 1);
  assert.ok(state.history.events.some(event => event.type === 'auction_lot'));
  state = ok(state, { type: 'action', id: 'travel', location: 'centralContinent' });
  advance(0);
  state = ok(state, { type: 'action', id: 'travel', location: 'foxFairyLand' });
  advance(240);
  assert.equal(state.flags.foxFairyLandOpened, true);
  assert.equal(state.flags.centralContinentOpened, true);
  assert.equal(state.flags.immortalAuctionOpened, true);
  assert.equal(state.flags.sectPressureActive, true);
  assert.equal(state.entities.tianhe.identity.name, '天鹤上人');
  assert.equal(state.entities.qinbaisheng.identity.name, '秦百胜');
  assert.ok(state.central.sectPressure > 0);
  assert.ok(state.history.events.some(event => event.data?.source?.source?.endsWith('第100章.txt')));
});

test('free intent parser only returns commands; state changes remain rule-owned', () => {
  let state = open(S.newWorld({ seed: 'intent' }), 'observe');
  const parsed = S.interpret('去竹林', state);
  assert.equal(parsed.ok, true);
  assert.equal(S.dispatch(state, parsed.command).ok, false);
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  const parsed2 = S.interpret('去竹林', state);
  assert.equal(parsed2.ok, true);
  const next = ok(state, parsed2.command);
  assert.equal(next.entities.player.position.location, 'bambooForest');
});

test('save validation preserves components, memories, relationships and deterministic RNG', () => {
  let state = open(S.newWorld({ seed: 'save' }), 'observe');
  state = ok(state, { type: 'action', id: 'talk', target: 'fangzheng', mode: 'listen' });
  const restored = S.validate(JSON.stringify(state));
  assert.deepEqual(restored, state);
  assert.equal(S.snapshot(restored).player.name, '古月族人');
});

test('history ledger records significant events and daily world snapshots independently of UI logs', () => {
  let state = open(S.newWorld({ seed: 'history' }), 'observe');
  state = ok(state, { type: 'action', id: 'wait', hours: 50 });
  const snap = S.snapshot(state);
  assert.ok(state.history.sequence > 0);
  assert.ok(state.history.events.some(event => event.type === 'world_started'));
  assert.ok(state.history.events.some(event => event.type === 'day_tick'));
  assert.ok(state.history.snapshots.length >= 1);
  assert.ok(snap.history.facts.daysObserved >= 3);
  assert.ok(state.history.snapshots.length >= 2);
  assert.ok(S.validate(JSON.stringify(state)).history.origin.seed === 'history');
});

test('entity conflict uses body components, combat events and NPC memory', () => {
  let state = open(S.newWorld({ seed: 'conflict' }), 'observe');
  state = ok(state, { type: 'action', id: 'challenge', target: 'fangzheng' });
  assert.equal(state.combat.defender, 'fangzheng');
  assert.equal(S.dispatch(state, { type: 'action', id: 'rest' }).ok, false);
  const before = state.entities.fangzheng.body.health;
  state = ok(state, { type: 'combat', id: 'attack' });
  assert.ok(state.entities.fangzheng.body.health < before);
  assert.ok(state.entities.fangzheng.body.wounds.length > 0);
  assert.ok(state.entities.fangzheng.memory.episodes.some(item => item.kind === 'injury'));
});

test('invalid actions are rejected without mutating the original state', () => {
  const state = S.newWorld({ seed: 'guard' });
  const before = JSON.stringify(state);
  const result = S.dispatch(state, { type: 'action', id: 'travel', location: 'cliffCave' });
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.equal(JSON.stringify(state), before);
});

test('engine registries expose component queries, goal handlers, interactions and domain events', () => {
  let state = open(S.newWorld({ seed: 'engine-api' }), 'observe');
  assert.ok(S.ENGINE.COMPONENTS.includes('memory'));
  assert.equal(typeof S.ENTITY.createEntity, 'function');
  assert.equal(typeof S.NPC_AI.selectGoal, 'function');
  assert.equal(typeof S.DEFAULT_GOALS.register, 'function');
  assert.equal(typeof S.DIRECTOR.tick, 'function');
  assert.equal(typeof S.DIRECTOR.resolve, 'function');
  assert.ok(S.ENGINE.queryWith(state, 'identity', 'position', 'memory').length >= 10);
  const before = S.snapshot(state).eventStream.length;
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  const snap = S.snapshot(state);
  assert.ok(snap.eventStream.length > before);
  assert.ok(snap.eventStream.some(event => event.type === 'world.travel'));
  assert.ok(snap.engine.registries.goals.includes('secureResources'));
  assert.ok(snap.engine.registries.goals.includes('study'));
  assert.ok(snap.engine.registries.goals.includes('patrol'));
  assert.ok(snap.engine.registries.interactions.includes('help'));
  assert.ok(snap.engine.registries.events.includes('wolfTide'));
  assert.deepEqual(snap.engine.registries.listeners['world.travel'], ['zoneVisitAccounting']);
  assert.ok(snap.engine.registries.actions.includes('arena_match'));
  assert.ok(snap.engine.registries.actions.includes('accept_contract'));
  assert.ok(snap.engine.registries.directorRules.includes('marketArrival'));
  assert.deepEqual(snap.engine.registries.systems.hour, ['playerNeeds', 'npcSimulation']);
  assert.deepEqual(snap.engine.registries.systems.day, ['worldDailyTick']);
});

test('action catalog derives available commands from world state instead of UI conditionals', () => {
  let state = open(S.newWorld({ seed: 'action-catalog' }), 'observe');
  let actions = S.ACTION_CATALOG.list(state, { locations: S.LOCATIONS });
  assert.ok(actions.some(action => action.id === 'study'));
  assert.ok(actions.some(action => action.command.location === 'village'));
  assert.equal(actions.some(action => action.id === 'arena_match'), false);
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  actions = S.ACTION_CATALOG.list(state, { locations: S.LOCATIONS });
  assert.ok(actions.some(action => action.id === 'refine'));
  assert.ok(actions.every(action => action.command?.type === 'action'));
});

test('domain event sequence stays unique after the bounded stream rotates', () => {
  const state = S.newWorld({ seed: 'event-sequence' });
  for (let i = 0; i < 180; i++) S.ENGINE.emit(state, 'test.pulse', { i });
  assert.equal(state.events.pending.length, 128);
  assert.equal(state.events.pending[0].id, 'ev53');
  assert.equal(state.events.pending.at(-1).id, 'ev180');
  assert.equal(new Set(state.events.pending.map(event => event.id)).size, 128);
  assert.equal(state.events.recent.length, 180);
  assert.equal(state.events.recent[0].id, 'ev1');
});

test('long-running world remains finite, recoverable and structurally valid', () => {
  let state = open(S.newWorld({ seed: 'long-run' }), 'observe');
  for (let i = 0; S.day(state) < 90 && i < 300; i++) {
    if (state.events.active) state = ok(state, { type: 'resolve_event', choice: state.events.active.choices[0].id });
    else state = ok(state, { type: 'action', id: 'wait', hours: 12 });
  }
  for (const entity of Object.values(state.entities)) {
    assert.ok(S.LOCATIONS[entity.position.location], `${entity.id} has an invalid location`);
    assert.ok(Number.isFinite(entity.needs.energy) && Number.isFinite(entity.needs.hunger), `${entity.id} has invalid needs`);
    assert.ok(Number.isFinite(entity.body.health), `${entity.id} has invalid health`);
  }
  for (const zone of Object.values(state.zones)) {
    assert.ok(Number.isFinite(zone.danger) && Number.isFinite(zone.activity), `${zone.id} has invalid zone metrics`);
    for (const value of Object.values(zone.resources)) assert.ok(Number.isFinite(value), `${zone.id} has invalid resource`);
  }
  assert.equal(state.history.snapshots.length, 64);
  assert.ok(state.history.facts.daysObserved >= 90);
  assert.doesNotThrow(() => S.validate(JSON.stringify(state)));
});
