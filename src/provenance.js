(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationProvenance = factory();
})(globalThis, function () {
  'use strict';

  function ensure(state) {
    state.provenance ||= { sequence: 0, records: [] };
    state.provenance.records ||= [];
    state.provenance.sequence = Math.max(0, Number(state.provenance.sequence) || 0);
    return state.provenance;
  }

  function sourceValue(source) {
    if (source === undefined || source === null) return null;
    if (typeof source === 'string' || typeof source === 'number') return source;
    return { ...source };
  }

  function create(state, { eventId = null, type = 'unknown', source = null, actorId = null, targetId = null, location = null, parentEventId = null, parentProvenanceId = null, tags = [], data = {} } = {}) {
    const provenance = ensure(state);
    provenance.sequence += 1;
    const record = {
      id: `prov-${provenance.sequence}`,
      eventId,
      type,
      clock: Number(state.clock) || 0,
      source: sourceValue(source),
      actorId,
      targetId,
      location,
      parentEventId,
      parentProvenanceId,
      tags: Array.isArray(tags) ? tags.slice(0, 8) : [],
      data: data && typeof data === 'object' ? { ...data } : {}
    };
    provenance.records.unshift(record);
    provenance.records = provenance.records.slice(0, 512);
    return record;
  }

  function forEvent(state, eventId, type, payload = {}) {
    const active = state.events?.active;
    const parentEventId = payload.parentEventId || active?.id || null;
    return create(state, {
      eventId,
      type,
      source: payload.source || payload.reason || payload.cause || null,
      actorId: payload.actorId || payload.sourceId || payload.attackerId || null,
      targetId: payload.targetId || payload.defenderId || payload.entityId || null,
      location: payload.location || payload.locationId || payload.to || active?.location || null,
      parentEventId,
      parentProvenanceId: payload.parentProvenanceId || active?.provenance?.id || null,
      tags: payload.tags || [type],
      data: payload.provenanceData || {}
    });
  }

  function chain(state, provenanceId, limit = 8) {
    const records = ensure(state).records;
    const result = [];
    let current = records.find(item => item.id === provenanceId) || null;
    while (current && result.length < limit) {
      result.push(current);
      current = current.parentProvenanceId ? records.find(item => item.id === current.parentProvenanceId) || null : null;
    }
    return result;
  }

  return { ensure, create, forEvent, chain };
});
