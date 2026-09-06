(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationConsequence = factory();
})(globalThis, function () {
  'use strict';

  function ensure(state) {
    state.consequences ||= { sequence: 0, records: [], counts: {} };
    state.consequences.records ||= [];
    state.consequences.counts ||= {};
    state.consequences.sequence = Math.max(0, Number(state.consequences.sequence) || 0);
    return state.consequences;
  }

  function record(state, { kind = 'failure', actorId = 'player', targetId = null, factionId = null, source = null, location = null, reason = '', data = {}, pressure = 0, tension = 0, durable = true } = {}) {
    const ledger = ensure(state);
    ledger.sequence += 1;
    const item = {
      id: `consequence-${ledger.sequence}`,
      kind,
      actorId,
      targetId,
      factionId,
      source,
      location,
      reason,
      clock: Number(state.clock) || 0,
      durable: durable !== false,
      data: data && typeof data === 'object' ? { ...data } : {}
    };
    ledger.records.unshift(item);
    ledger.records = ledger.records.slice(0, 256);
    ledger.counts[kind] = (ledger.counts[kind] || 0) + 1;
    state.facts ||= {};
    state.facts.consequenceCounts = { ...(state.facts.consequenceCounts || {}), [kind]: ledger.counts[kind] };
    if (pressure) state.director.pressure = Math.max(0, Math.min(10, (Number(state.director.pressure) || 0) + Number(pressure)));
    if (factionId && state.factions?.[factionId]) {
      const faction = state.factions[factionId];
      faction.tension = Math.max(0, Math.min(100, (Number(faction.tension) || 0) + Number(tension)));
      faction.consequences ||= [];
      faction.consequences.unshift(item.id);
      faction.consequences = faction.consequences.slice(0, 32);
    }
    const actor = actorId && state.entities?.[actorId];
    if (actor) {
      actor.memory ||= { facts: {}, episodes: [] };
      actor.memory.facts ||= {};
      actor.memory.facts.consequences ||= {};
      actor.memory.facts.consequences[item.id] = { kind, source, reason, clock: item.clock, data: item.data };
      actor.memory.episodes ||= [];
      actor.memory.episodes.unshift({ clock: item.clock, subjectId: targetId || 'world', kind: `consequence:${kind}`, valence: -1, text: reason || `留下了${kind}后果。` });
      actor.memory.episodes = actor.memory.episodes.slice(0, 24);
    }
    return item;
  }

  function recent(state, { kind, actorId } = {}) {
    return ensure(state).records.filter(item => (!kind || item.kind === kind) && (!actorId || item.actorId === actorId));
  }

  return { ensure, record, recent };
});
