(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationFactionPacts = factory();
})(globalThis, function () {
  'use strict';

  // A content-facing ledger for durable faction promises. It deliberately
  // stores current state instead of resolving diplomacy into one-shot flags:
  // promises can be funded, neglected, exposed, fulfilled, or betrayed by
  // the daily simulation.
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const unique = members => [...new Set((members || []).filter(Boolean).map(String))].sort();

  function key(members) { return unique(members).join('::'); }

  function ensure(state) {
    state.coalitions ||= { sequence: 0, diplomacyPressure: 0, lastTickDay: 0, pacts: {}, history: [] };
    state.coalitions.pacts ||= {};
    state.coalitions.history ||= [];
    state.coalitions.history = state.coalitions.history.slice(-128);
    state.coalitions.sequence = Math.max(0, Number(state.coalitions.sequence) || 0);
    state.coalitions.diplomacyPressure = clamp(state.coalitions.diplomacyPressure, 0, 100);
    state.coalitions.lastTickDay = Math.max(0, Number(state.coalitions.lastTickDay) || 0);
    for (const [id, pact] of Object.entries(state.coalitions.pacts)) {
      pact.id ||= id;
      pact.members = unique(pact.members);
      pact.status ||= 'active';
      pact.legitimacy = clamp(pact.legitimacy ?? 50, -100, 100);
      pact.cohesion = clamp(pact.cohesion ?? 50, 0, 100);
      pact.supply = clamp(pact.supply ?? 50, 0, 100);
      pact.obligations ||= {};
      for (const member of pact.members) pact.obligations[member] = clamp(pact.obligations[member] ?? 0, 0, 100);
      pact.createdDay = Math.max(0, Number(pact.createdDay) || 0);
      pact.lastTickDay = Math.max(0, Number(pact.lastTickDay) || 0);
      pact.lastActionDay = Math.max(0, Number(pact.lastActionDay) || 0);
      pact.actions ||= 0;
      pact.defections ||= 0;
      pact.history ||= [];
    }
    return state.coalitions;
  }

  function upsert(state, members, { day = 0, source = 'diplomacy', legitimacy = 50, cohesion = 46, supply = 44 } = {}) {
    const normalized = unique(members);
    if (normalized.length < 2) return null;
    const ledger = ensure(state);
    const id = key(normalized);
    const existing = ledger.pacts[id];
    if (existing) {
      existing.lastActionDay = day;
      existing.actions += 1;
      existing.source ||= source;
      return existing;
    }
    const pact = {
      id,
      members: normalized,
      status: 'active',
      legitimacy: clamp(legitimacy, -100, 100),
      cohesion: clamp(cohesion, 0, 100),
      supply: clamp(supply, 0, 100),
      obligations: Object.fromEntries(normalized.map(member => [member, 0])),
      source,
      createdDay: day,
      lastTickDay: day,
      lastActionDay: day,
      actions: 1,
      defections: 0,
      history: []
    };
    ledger.pacts[id] = pact;
    ledger.sequence += 1;
    return pact;
  }

  function record(state, pact, entry) {
    if (!pact) return null;
    const item = { id: `${pact.id}:${++pact.actions}`, day: entry.day || 0, ...entry };
    pact.history.unshift(item);
    pact.history = pact.history.slice(0, 24);
    const ledger = ensure(state);
    ledger.history.unshift({ pactId: pact.id, ...item });
    ledger.history = ledger.history.slice(0, 128);
    pact.lastActionDay = item.day;
    return item;
  }

  return { key, ensure, upsert, record, clamp };
});
