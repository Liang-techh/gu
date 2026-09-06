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
  assert.equal(state.content.id, 'gu-eternal-war-v6');
  assert.equal(S.CONTENT_INDEX.volumes[0].id, 'volume-1');
  assert.equal(S.CONTENT_INDEX.volumes[2].id, 'volume-3');
  assert.equal(S.CONTENT_INDEX.volumes[3].id, 'volume-4');
  assert.equal(S.CONTENT_INDEX.volumes[4].id, 'volume-5');
  assert.equal(S.CONTENT_INDEX.volumes[5].id, 'volume-6');
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

test('zone runtime suspends, settles offline time and reactivates the player area', () => {
  let state = open(S.newWorld({ seed: 'zone-runtime' }), 'observe');
  assert.equal(state.zones.academy.runtime.active, true);
  assert.equal(state.zones.village.runtime.suspended, true);
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  assert.equal(state.zones.academy.runtime.suspended, true);
  assert.equal(state.zones.village.runtime.active, true);
  state = ok(state, { type: 'action', id: 'wait', hours: 24 });
  assert.ok(state.zones.academy.runtime.offline.hours > 0);
  assert.ok(state.zones.academy.runtime.offline.ticks >= 1);
  state = ok(state, { type: 'action', id: 'travel', location: 'academy' });
  assert.equal(state.zones.academy.runtime.active, true);
  assert.equal(state.zones.academy.runtime.suspended, false);
  assert.ok(state.zones.academy.runtime.offline.hours >= 24);
  assert.ok(state.zones.academy.runtime.lastSettlementClock <= state.clock);
});

test('zone residency unloads ambient entities into cache and hydrates them on entry', () => {
  let state = open(S.newWorld({ seed: 'zone-residency' }), 'observe');
  const academyAmbient = Object.keys(state.entities).find(id => id.startsWith('ambient-academy-'));
  const forestAmbient = Object.keys(state.entityCache).find(id => id.startsWith('ambient-bambooForest-'));
  assert.ok(academyAmbient);
  assert.ok(forestAmbient);
  assert.equal(state.zones.bambooForest.runtime.residency.cachedIds.includes(forestAmbient), true);
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  state = ok(state, { type: 'action', id: 'travel', location: 'bambooForest' });
  assert.equal(state.entities[forestAmbient].position.location, 'bambooForest');
  assert.equal(state.entityCache[academyAmbient].position.location, 'academy');
  assert.ok(S.snapshot(state).zones.bambooForest.residency.loaded >= 1);
  assert.ok(S.snapshot(state).zones.academy.residency.cached >= 1);
});

test('suspended zones advance cached residents through deterministic migration summaries', () => {
  const state = S.newWorld({ seed: 'offline-residents' });
  const id = Object.keys(state.entityCache).find(item => item.startsWith('ambient-bambooForest-'));
  assert.ok(id);
  state.zones.bambooForest.danger = 100;
  state.entityCache[id].goals.queue = ['travel'];
  const summary = S.ZONE_RUNTIME.settle(state, 'bambooForest', 1000, { clock: state.clock + 1000 });
  assert.ok(summary.residentMoves >= 1);
  assert.notEqual(state.entityCache[id].position.location, 'bambooForest');
  assert.ok(Number.isFinite(summary.residentConflicts));
  assert.ok(state.zones.bambooForest.runtime.offline.lastSummary.residentMoves >= 1);
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
  assert.equal(S.KNOWLEDGE.get(state.entities.fangzheng, 'player', 'helped').value, true);
  assert.ok(S.KNOWLEDGE.get(state.entities.fangzheng, 'player', 'helped').confidence >= 0.7);
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
  assert.ok(S.KNOWLEDGE.suspicion(state.entities.fangzheng, 'player') > 0);
  assert.ok(S.snapshot(state).domainEvents.some(event => event.type === 'social.interaction'));
  assert.ok(state.entities[uninvolved.id].memory.episodes.some(item => item.kind === 'rumor-social'));
  assert.equal(state.entities[uninvolved.id].memory.facts.fangzheng.heardInteraction !== undefined, true);
  const factionObserver = Object.values(state.entities).find(entity => entity.id !== 'player' && entity.id !== 'fangzheng' && entity.faction === 'guYue' && entity.position.location !== 'academy');
  assert.ok(factionObserver);
  assert.ok(state.entities[factionObserver.id].memory.episodes.some(item => item.kind === 'faction-rumor'));
  assert.ok(state.intel.leads.some(lead => lead.type === 'social.interaction'));
  assert.ok(state.intel.cases.player.pressure > 0);
  assert.ok(state.entities[uninvolved.id].knowledge.facts.fangzheng.heardInteraction.provenance.length > 0);
});

test('faction cases make investigation a real NPC utility, not just a text rumor', () => {
  let state = open(S.newWorld({ seed: 'intel-network' }), 'observe');
  state.intel.cases.player = { pressure: 18, lastClock: state.clock, events: 2, factions: { guYue: { pressure: 18, confidence: 0.7, reports: 0, lastClock: state.clock } } };
  const npc = state.entities.fangzheng;
  npc.goals.queue = ['observe'];
  const relation = (world, a, b) => world.relationships[[a, b].sort().join('::')] || { trust: 0, fear: 0 };
  assert.ok(['investigate', 'observe', 'avoidPlayer'].includes(S.NPC_AI.selectGoal(state, npc, { day: S.day, relation })));
  state = ok(state, { type: 'action', id: 'wait', hours: 4 });
  assert.ok(state.facts.investigationActivity > 0 || state.intel.cases.player.factions.guYue.reports > 0);
  assert.equal(state.entities.fangzheng.brain.lastDecision.childGoal, 'collectRumors');
  assert.ok(state.entities.fangzheng.brain.lastDecision.executionGoal);
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

test('NPC brains persist perception, scored decisions and a hierarchical next-step plan', () => {
  let state = open(S.newWorld({ seed: 'brain-pipeline' }), 'observe');
  state = ok(state, { type: 'action', id: 'wait', hours: 4 });
  const npc = state.entities.fangzheng;
  assert.ok(npc.brain);
  assert.ok(npc.brain.perceptions.length >= 1);
  assert.ok(npc.brain.lastDecision?.goal);
  assert.ok(Array.isArray(npc.brain.lastDecision.scores));
  assert.ok(npc.brain.decisions.length >= 1);
  assert.ok(npc.brain.stack.length >= 1);
  assert.ok(npc.brain.lastDecision.plan.length >= 1);
  assert.equal(typeof S.BRAIN.perceive, 'function');
});

test('goal handler supports resumable parent and child goals', () => {
  const brain = { stack: [] };
  const root = S.GOAL_HANDLER.pushGoal(brain, 'investigate', { createdClock: 3 });
  const child = S.GOAL_HANDLER.pushChildGoal(brain, 'travel', { createdClock: 4 });
  assert.equal(brain.stack.length, 2);
  assert.equal(brain.stack[0].child, child.instanceId);
  assert.equal(S.GOAL_HANDLER.top(brain).id, 'travel');
  S.GOAL_HANDLER.pop(brain, true);
  assert.equal(S.GOAL_HANDLER.top(brain).instanceId, root.instanceId);
  assert.equal(S.GOAL_HANDLER.top(brain).phase, 'resume');
  S.GOAL_HANDLER.pop(brain, false);
  assert.equal(S.GOAL_HANDLER.finished(brain), true);
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

test('faction pressure changes NPC goal selection', () => {
  const state = S.newWorld({ seed: 'faction-ai' });
  state.factions.black.tension = 82;
  const scout = { id: 'black-scout', faction: 'black', needs: { hunger: 0 }, personality: { ambition: 20 }, goals: { queue: ['prepareWar'] } };
  assert.equal(S.NPC_AI.selectGoal(state, scout, { day: S.day, relation: (world, a, b) => world.relationships[[a, b].sort().join('::')] || { trust: 0, fear: 0 } }), 'prepareWar');
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

test('director scores candidates and respects rule cooldowns', () => {
  S.ENGINE.registerDirectorRule({ id: 'test-director-high-priority', priority: 50, when: state => state.seed === 'director-scoring', build: () => ({ id: 'testHigh', title: '高优先级候选', choices: [{ id: 'ok' }] }) });
  S.ENGINE.registerDirectorRule({ id: 'test-director-contextual', priority: 10, cooldownHours: 24, score: () => 60, when: state => state.seed === 'director-scoring', build: () => ({ id: 'testContextual', title: '高效用候选', choices: [{ id: 'ok' }] }) });
  let state = open(S.newWorld({ seed: 'director-scoring' }), 'observe');
  state.events.active = null;
  state.director.cooldowns = {};
  state.director.lastTick = 0;
  const first = S.DIRECTOR.tick(state, { engine: S.ENGINE, day: S.day, log: () => {} });
  assert.equal(first.id, 'testContextual');
  assert.equal(state.director.cooldowns['test-director-contextual'], state.clock + 24);
  state.events.active = null; state.clock += 6;
  const second = S.DIRECTOR.tick(state, { engine: S.ENGINE, day: S.day, log: () => {} });
  assert.equal(second.id, 'testHigh');
});

test('NPC goal utility combines needs, personality, faction pressure and recent repetition', () => {
  const state = S.newWorld({ seed: 'goal-utility' });
  const npc = S.ENTITY.createEntity('utility-npc', { name: '效用测试者', faction: 'black', location: 'blackTribeCamp', personality: { ambition: 40, curiosity: 20, loyalty: 20 }, goals: ['socialize', 'prepareWar'] });
  state.entities[npc.id] = npc;
  state.factions.black.tension = 90;
  assert.equal(S.NPC_AI.selectGoal(state, npc, { day: S.day, relation: (world, a, b) => world.relationships[[a, b].sort().join('::')] || { trust: 0, fear: 0 } }), 'prepareWar');
  npc.goals.history = [{ goal: 'prepareWar', day: S.day(state), clock: state.clock }];
  assert.ok(S.NPC_AI.goalScore(state, npc, 'prepareWar', { day: S.day, relation: (world, a, b) => world.relationships[[a, b].sort().join('::')] || { trust: 0, fear: 0 } }) < 10);
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
    foxFairyLandReturn: 'recover', centralContinentArrival: 'trade', immortalAuction: 'observe', sectPressure: 'negotiate',
    shadowSectRebuild: 'rebuild', fiveRegionsWar: 'central', southernFront: 'negotiate', westernFront: 'trade', heavenlyCourtCampaign: 'defend'
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
  advance(168);
  assert.equal(state.flags.shadowSectRebuilt, true);
  assert.equal(state.entities.yingwuxie.identity.name, '影无邪');
  state = ok(state, { type: 'action', id: 'travel', location: 'centralContinent' });
  advance(360);
  assert.equal(state.flags.fiveRegionsWarOpened, true);
  assert.equal(state.worldWar.fiveRegions, true);
  state = ok(state, { type: 'action', id: 'travel', location: 'southernBorder' });
  advance(240);
  assert.equal(state.flags.southernFrontOpened, true);
  assert.equal(state.entities.wuyong.identity.name, '武庸');
  state = ok(state, { type: 'action', id: 'travel', location: 'westernDesert' });
  advance(240);
  assert.equal(state.flags.westernFrontOpened, true);
  assert.equal(state.entities.fangdichang.identity.name, '房睇长');
  state = ok(state, { type: 'action', id: 'travel', location: 'centralContinent' });
  state = ok(state, { type: 'action', id: 'travel', location: 'heavenlyCourt' });
  advance(480);
  assert.equal(state.flags.heavenlyCourtOpened, true);
  assert.equal(state.entities.longgong.identity.name, '龙公');
  assert.equal(state.entities.ziweixianzi.identity.name, '紫薇仙子');
  assert.ok(state.worldWar.heat > 0);
});

test('auction market supports information asymmetry, credit and trace pressure', () => {
  let state = open(S.newWorld({ seed: 'auction-market' }), 'observe');
  state.entities.player.position.location = 'immortalAuction';
  state.central.auctionActive = true;
  const catalog = S.ACTION_CATALOG.list(state, { locations: S.LOCATIONS });
  assert.ok(catalog.some(action => action.command.mode === 'bid'));
  assert.ok(catalog.some(action => action.command.mode === 'mortgage'));
  assert.ok(catalog.some(action => action.command.mode === 'verify'));

  const startingStones = state.entities.player.inventory.stones;
  state = ok(state, { type: 'action', id: 'auction_lot', mode: 'observe' });
  assert.equal(state.facts.auctionIntel, true);
  assert.ok(state.entities.player.knowledge.facts.auctionMarket.lastAuctionPrice.confidence > 0.7);
  state = ok(state, { type: 'action', id: 'auction_lot', mode: 'mortgage' });
  assert.ok(state.central.marketDebt > 0);
  assert.ok(state.entities.player.inventory.stones > startingStones);
  state = ok(state, { type: 'action', id: 'auction_lot', mode: 'raise' });
  assert.ok(state.central.tracePressure > 0);
  state = ok(state, { type: 'action', id: 'auction_lot', mode: 'rumor' });
  assert.ok(state.central.rumorCredibility < 58);
  assert.ok(state.entities.player.knowledge.facts.auctionMarket.lastRumorPayout);
  state = ok(state, { type: 'action', id: 'auction_lot', mode: 'verify' });
  assert.equal(state.facts.auctionIntelVerified, 1);
  assert.equal(state.entities.player.knowledge.facts.auctionMarket.auctionIntelVerified.confidence, 0.95);
  assert.ok(state.history.events.some(event => event.data?.result === 'verify'));
});

test('auction intent exposes market actions as explicit commands', () => {
  const state = S.newWorld({ seed: 'auction-intent' });
  assert.equal(S.interpret('抬价试探', state).command.mode, 'raise');
  assert.equal(S.interpret('抵押借元石', state).command.mode, 'mortgage');
  assert.equal(S.interpret('核验情报', state).command.mode, 'verify');
});

test('identity masks change the public view and reveal true identity selectively', () => {
  let state = open(S.newWorld({ seed: 'identity-masks' }), 'observe');
  assert.equal(state.entities.player.knowledge.activeMask, 'trueName');
  state = ok(state, { type: 'action', id: 'identity_mask', mode: 'wear', maskId: 'anonymous' });
  assert.equal(state.entities.player.knowledge.activeMask, 'anonymous');
  assert.equal(S.snapshot(state).player.name, '无名散修');
  assert.equal(S.snapshot(state).player.trueName, '古月族人');
  assert.ok(S.ACTION_CATALOG.list(state, { locations: S.LOCATIONS }).some(action => action.command.mode === 'drop'));

  state.entities.fangyuan.position.location = state.entities.player.position.location;
  state = ok(state, { type: 'action', id: 'identity_mask', mode: 'reveal', target: 'fangyuan' });
  assert.equal(S.KNOWLEDGE.get(state.entities.fangyuan, 'player', 'identityKnown').value, true);
  assert.equal(S.IDENTITY.visible(state.entities.player, 'fangyuan', S.KNOWLEDGE).name, '古月族人');
  assert.ok(state.history.events.some(event => event.type === 'identity_mask'));
  state = ok(state, { type: 'action', id: 'identity_mask', mode: 'drop' });
  assert.equal(state.entities.player.knowledge.activeMask, 'trueName');
});

test('director turns masked market traces into a recoverable pursuit event', () => {
  let state = open(S.newWorld({ seed: 'identity-pursuit' }), 'observe');
  state = ok(state, { type: 'action', id: 'identity_mask', mode: 'wear', maskId: 'anonymous' });
  state.central.tracePressure = 30;
  state.events.active = null;
  state.director.lastTick = 0;
  state = ok(state, { type: 'action', id: 'wait', hours: 2 });
  assert.equal(state.events.active.id, 'identityPursuit');
  state = ok(state, { type: 'resolve_event', choice: 'erase' });
  assert.equal(state.events.active, null);
  assert.ok(state.central.tracePressure < 30);
  assert.ok(state.history.events.some(event => event.data?.source?.source?.endsWith('第119章.txt')));
});

test('pursuit teams are world agents that can be bribed at contact', () => {
  let state = open(S.newWorld({ seed: 'pursuit-agents' }), 'observe');
  state = ok(state, { type: 'action', id: 'identity_mask', mode: 'wear', maskId: 'anonymous' });
  state.central.tracePressure = 30;
  state.events.active = null;
  state.director.lastTick = 0;
  state = ok(state, { type: 'action', id: 'wait', hours: 2 });
  state = ok(state, { type: 'resolve_event', choice: 'confront' });
  const team = Object.values(state.pursuit.teams).find(item => item.status === 'active');
  assert.ok(team);
  const agents = team.members.map(id => state.entities[id]);
  assert.ok(agents.every(agent => agent?.agent?.teamId === team.id));
  assert.ok(S.ENGINE.queryWith(state, 'agent').length >= agents.length);
  const agent = agents[0];
  agent.position.location = state.entities.player.position.location;
  const beforeStones = state.entities.player.inventory.stones;
  const beforeConfidence = team.clueConfidence;
  assert.ok(S.ACTION_CATALOG.list(state, { locations: S.LOCATIONS }).some(action => action.command.mode === 'bribe'));
  state = ok(state, { type: 'action', id: 'pursuit_agent', mode: 'bribe' });
  const updatedTeam = state.pursuit.teams[team.id];
  assert.equal(state.entities.player.inventory.stones, beforeStones - 3);
  assert.ok(updatedTeam.clueConfidence < beforeConfidence);
  assert.ok(state.events.recent.some(event => event.type === 'pursuit.action'));
});

test('agency commissions let the player outsource information work to an NPC', () => {
  let state = open(S.newWorld({ seed: 'agency' }), 'observe');
  state.entities.fangzheng.schedule = { morning: 'academy', afternoon: 'academy', evening: 'academy', night: 'academy' };
  assert.equal(S.interpret('委托方正打探情报', state).command.id, 'commission_agent');
  const beforeStones = state.entities.player.inventory.stones;
  state = ok(state, { type: 'action', id: 'commission_agent', mode: 'recruit', target: 'fangzheng', kind: 'rumor' });
  const commission = Object.values(state.agency.commissions)[0];
  assert.equal(commission.status, 'active');
  assert.equal(state.entities.player.inventory.stones, beforeStones - 2);
  state = ok(state, { type: 'action', id: 'wait', hours: 5 });
  const completed = state.agency.commissions[commission.id];
  assert.notEqual(completed.status, 'active');
  assert.ok(state.history.events.some(event => event.type === 'agency_result'));
});

test('NPC trade goals mutate a shared market and enter the rumor/history pipeline', () => {
  let state = open(S.newWorld({ seed: 'npc-market' }), 'observe');
  const npc = state.entities.jiafu;
  npc.position.location = 'caravanCamp';
  npc.schedule = { morning: 'caravanCamp', afternoon: 'caravanCamp', evening: 'caravanCamp', night: 'caravanCamp' };
  npc.goals.queue = ['trade'];
  npc.inventory.stones = 20;
  const beforeSupply = state.market.supply.water;
  state = ok(state, { type: 'action', id: 'wait', hours: 4 });
  assert.ok(state.market.transactions.length >= 1);
  assert.ok(state.factions.caravans.market.volume >= 1);
  assert.equal(state.factions.caravans.market.motive, S.FACTION_INTERESTS.caravans.market.motive);
  assert.ok(state.factions.black.interests.war.mobilization > 0.7);
  assert.ok(state.market.supply.water !== beforeSupply || state.market.supply.food !== 20);
  assert.ok(state.events.recent.some(event => event.type === 'market.trade'));
  assert.ok(state.log.some(event => event.type === 'market_trade'));
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
  assert.equal(S.interpret('去中洲', state).command.location, 'centralContinent');
  assert.equal(S.interpret('去狐仙福地', state).command.location, 'foxFairyLand');
  assert.equal(S.interpret('去仙鹤门', state).command.location, 'immortalCraneSect');
  assert.equal(S.interpret('去南疆', state).command.location, 'southernBorder');
  assert.equal(S.interpret('去西漠', state).command.location, 'westernDesert');
  assert.equal(S.interpret('去天庭', state).command.location, 'heavenlyCourt');
  assert.equal(S.interpret('去神帝城', state).command.location, 'divineEmperorCity');
  assert.equal(S.interpret('探索梦境', state).command.id, 'dream_dive');
});

test('volume six content models the eternal war as a late-world state machine', () => {
  let state = open(S.newWorld({ seed: 'volume-six' }), 'observe');
  const choices = { divineEmperorArrival: 'enter', twoHeavensConvergence: 'observe', madDemonCaveOpening: 'consult', dreamRealmSurge: 'enter', starHostPlan: 'defend' };
  const trigger = (location, clock) => {
    state.entities.player.position.location = location;
    state.clock = clock; state.director.lastTick = 0; state.events.active = null;
    state = ok(state, { type: 'action', id: 'wait', hours: 6 });
    while (state.events.active) state = ok(state, { type: 'resolve_event', choice: choices[state.events.active.id] || state.events.active.choices[0].id });
  };
  state.flags.heavenlyCourtOpened = true; state.worldWar.heavenly = true;
  trigger('divineEmperorCity', 200 * 24);
  assert.equal(state.flags.divineEmperorOpened, true);
  assert.equal(state.entities.qindingling.identity.name, '秦鼎菱');
  trigger('bookMountain', 220 * 24);
  assert.equal(state.flags.twoHeavensOpened, true);
  trigger('madDemonCave', 235 * 24);
  assert.equal(state.flags.madDemonCaveOpened, true);
  assert.equal(state.entities.luweiyin.identity.name, '陆畏因');
  trigger('dreamRealms', 245 * 24);
  assert.equal(state.flags.dreamSurgeOpened, true);
  state = ok(state, { type: 'action', id: 'dream_dive' });
  assert.equal(state.eternalWar.dives, 1);
  trigger('heavenlyCourt', 260 * 24);
  assert.equal(state.flags.starHostPlanOpened, true);
  assert.equal(state.eternalWar.starHost, true);
  assert.ok(state.history.events.some(event => event.data?.source?.source?.endsWith('第300章.txt')));
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
  assert.ok(S.CONDITION.has(state.entities.fangzheng, 'wounded'));
  assert.ok(state.entities.fangzheng.memory.episodes.some(item => item.kind === 'injury'));
  state.entities.player.inventory.gu = { moonlight: { refined: true, progress: 100 } };
  state.entities.player.abilities.gu = ['moonlight'];
  state.entities.player.cultivation.essence = 20;
  state = ok(state, { type: 'combat', id: 'gu', guId: 'moonlight' });
  assert.ok(state.history.events.some(event => event.type === 'ability_used'));
});

test('body component constraints can disable a gu ability without deleting the gu', () => {
  const state = open(S.newWorld({ seed: 'body-components' }), 'observe');
  const player = state.entities.player;
  player.inventory.gu = { moonlight: { refined: true, progress: 100 } };
  player.abilities.gu = ['moonlight'];
  player.body.limbs.rightArm = 10;
  assert.equal(S.BODY.disabled(player, 'rightArm'), true);
  assert.throws(() => S.ABILITY.activate(player, 'moonlight', S.GU_SEEDS, S.BODY), /部位/);
  assert.equal(player.inventory.gu.moonlight.refined, true);
});

test('runtime conditions affect NPC intent and expire through the hourly system', () => {
  let state = open(S.newWorld({ seed: 'conditions' }), 'observe');
  state = ok(state, { type: 'action', id: 'talk', target: 'fangzheng', mode: 'threaten' });
  assert.equal(S.CONDITION.has(state.entities.fangzheng, 'afraid'), true);
  assert.equal(S.NPC_AI.selectGoal(state, state.entities.fangzheng, { day: S.day, relation: (world, a, b) => world.relationships[[a, b].sort().join('::')] || { trust: 0, fear: 0 } }), 'avoidPlayer');
  state = ok(state, { type: 'action', id: 'wait', hours: 18 });
  assert.equal(S.CONDITION.has(state.entities.fangzheng, 'afraid'), false);
});

test('invalid actions are rejected without mutating the original state', () => {
  const state = S.newWorld({ seed: 'guard' });
  const before = JSON.stringify(state);
  const result = S.dispatch(state, { type: 'action', id: 'travel', location: 'cliffCave' });
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.equal(JSON.stringify(state), before);
});

test('component lifecycles and event settlement are extensible without special-casing the simulation', () => {
  const calls = [];
  S.ENGINE.registerComponent('testLifecycle', {
    onAttach: ({ value }) => { calls.push('attach'); return { ...value, attached: true }; },
    onPatch: () => calls.push('patch'),
    onDetach: () => calls.push('detach')
  });
  const entity = {};
  S.ENGINE.attach(entity, 'testLifecycle', { value: 1 });
  S.ENGINE.patchComponent(entity, 'testLifecycle', { changed: true });
  S.ENGINE.detach(entity, 'testLifecycle');
  assert.deepEqual(calls, ['attach', 'patch', 'detach']);
  const state = S.newWorld({ seed: 'event-settlement' });
  S.ENGINE.registerEventListener('test.settlement', 'consumeHigh', () => ({ consumed: true }), 20);
  S.ENGINE.registerEventListener('test.settlement', 'observeLow', ({ event }) => { event.payload.observed = true; }, 0);
  const event = S.ENGINE.emit(state, 'test.settlement', { value: 1 });
  assert.equal(event.status, 'consumed');
  assert.equal(event.phase, 'settled');
  assert.equal(event.payload.observed, true);
  const phases = [];
  S.ENGINE.registerEventPhaseListener('before', 'test.phases', 'beforeHook', ({ phase }) => { phases.push(phase); });
  S.ENGINE.registerEventPhaseListener('after', 'test.phases', 'afterHook', ({ phase }) => { phases.push(phase); });
  const phased = S.ENGINE.emit(state, 'test.phases', {});
  assert.deepEqual(phased.phases, ['before', 'resolve', 'after']);
  assert.deepEqual(phases, ['before', 'after']);
  S.ENGINE.registerComponent('testEventComponent', {
    onInitialize: ({ entity }) => { entity.testEventComponent.initialized = true; },
    serialize: ({ value }) => ({ ...value }),
    deserialize: ({ value }) => ({ ...value })
  });
  const componentEvents = [];
  S.ENGINE.registerComponentEvent('testEventComponent', 'test.component', 'capture', ({ entity, value }) => { componentEvents.push(`${entity.id}:${value.initialized}`); });
  state.entities.player.testEventComponent = { initialized: false };
  S.ENGINE.initializeComponents(state);
  S.ENGINE.emit(state, 'test.component', {});
  assert.deepEqual(componentEvents, ['player:true']);
  const saved = S.ENGINE.serializeState(state);
  const restored = S.ENGINE.deserializeState(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.entities.player.testEventComponent.initialized, true);
});

test('engine registries expose component queries, goal handlers, interactions and domain events', () => {
  let state = open(S.newWorld({ seed: 'engine-api' }), 'observe');
  assert.ok(S.ENGINE.COMPONENTS.includes('memory'));
  assert.ok(S.ENGINE.COMPONENTS.includes('conditions'));
  assert.ok(S.ENGINE.COMPONENTS.includes('knowledge'));
  assert.ok(S.ENGINE.COMPONENTS.includes('brain'));
  assert.equal(typeof S.ENTITY.createEntity, 'function');
  assert.equal(typeof S.NPC_AI.selectGoal, 'function');
  assert.equal(typeof S.DEFAULT_GOALS.register, 'function');
  assert.equal(typeof S.ABILITY.activate, 'function');
  assert.equal(typeof S.CONDITION.apply, 'function');
  assert.equal(typeof S.KNOWLEDGE.raiseSuspicion, 'function');
  assert.equal(typeof S.CONTRACTS.accept, 'function');
  assert.equal(typeof S.REPEATABLE_SYSTEMS.arenaMatch, 'function');
  assert.equal(typeof S.REPEATABLE_SYSTEMS.dreamDive, 'function');
  assert.equal(typeof S.MARKET.trade, 'function');
  assert.equal(typeof S.ZONE_RUNTIME.transition, 'function');
  assert.equal(typeof S.GOAL_HANDLER.pushChildGoal, 'function');
  assert.equal(typeof S.ENGINE.registerEventPhaseListener, 'function');
  assert.equal(typeof S.DIRECTOR_RULES.registerRules, 'function');
  assert.equal(typeof S.EVENT_RULES.registerHandlers, 'function');
  assert.equal(typeof S.DIRECTOR.tick, 'function');
  assert.equal(typeof S.DIRECTOR.resolve, 'function');
  assert.ok(S.ENGINE.queryWith(state, 'identity', 'position', 'memory').length >= 10);
  const before = S.snapshot(state).eventStream.length;
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  const snap = S.snapshot(state);
  assert.ok(snap.engine.registries.components.brain.lifecycle.includes('ensure'));
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
  assert.ok(snap.engine.registries.directorRules.includes('starHostPlan'));
  assert.ok(snap.engine.registries.directorRules.length >= 29);
  assert.ok(snap.engine.registries.directorRules.includes('marketArrival'));
  assert.deepEqual(snap.engine.registries.systems.hour, ['conditionTick', 'playerNeeds', 'pursuitSimulation', 'npcSimulation', 'agencySimulation']);
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
