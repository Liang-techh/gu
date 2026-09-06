(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationHistory = factory();
})(globalThis, function () {
  'use strict';

  const HISTORY_SCHEMA = 1;
  const SIGNIFICANT_TYPES = new Set(['world_started', 'director_event', 'choice', 'day_tick', 'npc_goal_action', 'damage', 'death', 'faction', 'travel', 'combat_start', 'ability_used', 'arena_match', 'inheritance_round', 'contract', 'conversation', 'frontier_patrol', 'tower_floor', 'auction_lot']);

  function create(seed, content) {
    return {
      schema: HISTORY_SCHEMA,
      origin: { seed: String(seed), contentId: content.id, contentVersion: content.version },
      sequence: 0,
      events: [],
      snapshots: [],
      facts: { region: '青茅山', daysObserved: 0, eventCounts: {} }
    };
  }

  function ensure(state) {
    if (!state.history) state.history = create(state.seed || '青茅山', state.content || { id: 'unknown', version: 0 });
    state.history.events ||= [];
    state.history.snapshots ||= [];
    state.history.facts ||= { region: '青茅山', daysObserved: 0, eventCounts: {} };
    state.history.facts.eventCounts ||= {};
    state.history.sequence = Number(state.history.sequence) || 0;
    return state.history;
  }

  function record(state, event) {
    if (!SIGNIFICANT_TYPES.has(event.type)) return null;
    const history = ensure(state);
    history.sequence += 1;
    const item = {
      id: `h${history.sequence}`,
      clock: event.clock ?? state.clock,
      day: event.day ?? Math.floor((state.clock || 0) / 24) + 1,
      type: event.type,
      text: event.text || '',
      data: event.data || {}
    };
    history.events.unshift(item);
    history.events = history.events.slice(0, 256);
    history.facts.eventCounts[event.type] = (history.facts.eventCounts[event.type] || 0) + 1;
    if (event.type === 'day_tick') history.facts.daysObserved = Math.max(history.facts.daysObserved, item.day);
    return item;
  }

  function snapshot(state) {
    const history = ensure(state);
    const factions = Object.fromEntries(Object.values(state.factions || {}).map(faction => [faction.id, {
      influence: Math.round(faction.influence), tension: Math.round(faction.tension), attitude: Math.round(faction.attitude)
    }]));
    const zones = Object.fromEntries(Object.values(state.zones || {}).map(zone => [zone.id, {
      danger: Math.round(zone.danger), activity: Math.round(zone.activity), population: zone.population
    }]));
    const item = { clock: state.clock, day: Math.floor((state.clock || 0) / 24) + 1, factions, zones };
    history.snapshots.unshift(item);
    history.snapshots = history.snapshots.slice(0, 64);
    return item;
  }

  function summary(state, limit = 12) {
    const history = ensure(state);
    return {
      origin: { ...history.origin },
      facts: { ...history.facts, eventCounts: { ...history.facts.eventCounts } },
      recent: history.events.slice(0, limit).map(event => ({ id: event.id, day: event.day, type: event.type, text: event.text }))
    };
  }

  return { HISTORY_SCHEMA, create, ensure, record, snapshot, summary };
});
