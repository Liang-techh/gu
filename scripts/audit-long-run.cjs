'use strict';

// Deterministic, read-only headless audit for long-running world state.
const assert = require('node:assert/strict');
const S = require('../src/simulation.js');

function advance(state, command) {
  const result = S.dispatch(state, command);
  assert.equal(result.ok, true, result.message);
  return result.state;
}

let state = advance(S.newWorld({ seed: 'long-run-audit' }), { type: 'resolve_event', choice: 'observe' });
let steps = 0;
while (S.day(state) < 365 && steps < 1500) {
  if (state.events.active) state = advance(state, { type: 'resolve_event', choice: state.events.active.choices[0].id });
  else state = advance(state, { type: 'action', id: 'wait', hours: 12 });
  steps += 1;
}
assert.equal(S.day(state), 365, `world stopped at day ${S.day(state)}`);
for (const entity of Object.values(state.entities)) {
  assert.ok(S.LOCATIONS[entity.position.location], `${entity.id} has an invalid location`);
  for (const value of [entity.needs.energy, entity.needs.hunger, entity.body.health]) assert.ok(Number.isFinite(value), `${entity.id} has non-finite state`);
  assert.ok(entity.memory.episodes.length <= 24, `${entity.id} memory exceeded bound`);
}
for (const zone of Object.values(state.zones)) {
  assert.ok(Number.isFinite(zone.danger) && Number.isFinite(zone.activity), `${zone.id} has non-finite metrics`);
  for (const value of Object.values(zone.resources)) assert.ok(Number.isFinite(value), `${zone.id} has non-finite resources`);
}
assert.ok(state.events.pending.length <= 128);
assert.ok(state.events.recent.length <= 256);
assert.ok(state.history.events.length <= 256);
assert.ok(state.history.snapshots.length <= 64);
assert.doesNotThrow(() => S.validate(JSON.stringify(state)));
console.log(`PASS: 365-day world audit (${Object.keys(state.entities).length} entities, ${state.events.recent.length} recent events, ${state.history.snapshots.length} snapshots).`);
