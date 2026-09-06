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
  assert.equal(state.content.id, 'gu-qingmao-v1');
  assert.equal(S.CONTENT_INDEX.volumes[0].id, 'volume-1');
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
  state = ok(state, { type: 'action', id: 'wait', hours: 26 });
  const snap = S.snapshot(state);
  assert.ok(state.history.sequence > 0);
  assert.ok(state.history.events.some(event => event.type === 'world_started'));
  assert.ok(state.history.events.some(event => event.type === 'day_tick'));
  assert.ok(state.history.snapshots.length >= 1);
  assert.ok(snap.history.facts.daysObserved >= 2);
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
  assert.ok(S.ENGINE.queryWith(state, 'identity', 'position', 'memory').length >= 10);
  const before = S.snapshot(state).eventStream.length;
  state = ok(state, { type: 'action', id: 'travel', location: 'village' });
  const snap = S.snapshot(state);
  assert.ok(snap.eventStream.length > before);
  assert.ok(snap.eventStream.some(event => event.type === 'world.travel'));
  assert.ok(snap.engine.registries.goals.includes('secureResources'));
  assert.ok(snap.engine.registries.interactions.includes('help'));
  assert.ok(snap.engine.registries.events.includes('wolfTide'));
  assert.ok(snap.engine.registries.directorRules.includes('marketArrival'));
});

test('domain event sequence stays unique after the bounded stream rotates', () => {
  const state = S.newWorld({ seed: 'event-sequence' });
  for (let i = 0; i < 180; i++) S.ENGINE.emit(state, 'test.pulse', { i });
  assert.equal(state.events.pending.length, 128);
  assert.equal(state.events.pending[0].id, 'ev53');
  assert.equal(state.events.pending.at(-1).id, 'ev180');
  assert.equal(new Set(state.events.pending.map(event => event.id)).size, 128);
});
