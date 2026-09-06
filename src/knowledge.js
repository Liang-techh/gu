(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationKnowledge = factory();
})(globalThis, function () {
  'use strict';

  const CONFIDENCE_BY_KIND = Object.freeze({
    rumor: 0.35,
    'rumor-social': 0.4,
    'rumor-conflict': 0.5,
    'rumor-market': 0.45,
    observation: 0.82,
    encounter: 0.7,
    suspicion: 0.65,
    help: 0.78,
    threat: 0.75,
    secret: 0.78,
    world_arrival: 0.9
  });

  function ensure(entity) {
    entity.knowledge ||= { facts: {}, masks: {}, suspicion: {}, sources: [] };
    entity.knowledge.facts ||= {};
    entity.knowledge.masks ||= {};
    entity.knowledge.suspicion ||= {};
    entity.knowledge.sources ||= [];
    return entity.knowledge;
  }

  function record(entity, subjectId, facts, { kind = 'observation', clock = 0, source = 'memory', confidence, provenance = [] } = {}) {
    if (!entity || !subjectId || !facts || typeof facts !== 'object') return;
    const knowledge = ensure(entity);
    knowledge.facts[subjectId] ||= {};
    const certainty = Math.max(0, Math.min(1, Number(confidence ?? CONFIDENCE_BY_KIND[kind] ?? 0.6)));
    for (const [fact, value] of Object.entries(facts)) {
      const previous = knowledge.facts[subjectId][fact];
      const incoming = { value, confidence: certainty, originConfidence: certainty, kind, clock, source, provenance: Array.isArray(provenance) ? provenance.slice(-8) : [] };
      if (!previous || typeof previous !== 'object' || !Object.prototype.hasOwnProperty.call(previous, 'confidence')) {
        knowledge.facts[subjectId][fact] = incoming;
        continue;
      }
      const sameValue = JSON.stringify(previous.value) === JSON.stringify(value);
      const alternatives = Array.isArray(previous.alternatives) ? previous.alternatives.slice(-5) : [];
      if (!sameValue) alternatives.push({ value: previous.value, confidence: previous.confidence, kind: previous.kind, clock: previous.clock, source: previous.source, provenance: previous.provenance || [] });
      if (sameValue || certainty >= previous.confidence) {
        knowledge.facts[subjectId][fact] = { ...incoming, confidence: Math.max(previous.confidence, certainty), originConfidence: Math.max(previous.originConfidence || previous.confidence, certainty), alternatives };
      } else {
        knowledge.facts[subjectId][fact] = { ...previous, alternatives: [...alternatives, { value, confidence: certainty, kind, clock, source, provenance: incoming.provenance }].slice(-6) };
      }
    }
    knowledge.sources.unshift({ subjectId, kind, clock, source, confidence: certainty, provenance: Array.isArray(provenance) ? provenance.slice(-8) : [] });
    knowledge.sources = knowledge.sources.slice(0, 64);
  }

  function get(entity, subjectId, fact) {
    return ensure(entity).facts?.[subjectId]?.[fact] || null;
  }

  function knows(entity, subjectId, fact, minimumConfidence = 0) {
    const entry = get(entity, subjectId, fact);
    return !!entry && entry.confidence >= minimumConfidence;
  }

  function raiseSuspicion(entity, subjectId, amount, { clock = 0, reason = 'observation' } = {}) {
    if (!entity || !subjectId) return 0;
    const knowledge = ensure(entity);
    const current = knowledge.suspicion[subjectId] || { value: 0, lastReason: reason, clock };
    current.value = Math.max(0, Math.min(100, current.value + Number(amount || 0)));
    current.lastReason = reason;
    current.clock = clock;
    knowledge.suspicion[subjectId] = current;
    return current.value;
  }

  function suspicion(entity, subjectId) {
    return Number(ensure(entity).suspicion?.[subjectId]?.value || 0);
  }

  function alternatives(entity, subjectId, fact) {
    return [...(get(entity, subjectId, fact)?.alternatives || [])];
  }

  function decay(entity, clock, { halfLifeHours = 240, floor = 0.08 } = {}) {
    if (!entity) return 0;
    const knowledge = ensure(entity);
    let changed = 0;
    for (const facts of Object.values(knowledge.facts || {})) {
      for (const entry of Object.values(facts || {})) {
        if (!entry || typeof entry !== 'object' || typeof entry.confidence !== 'number' || !Number.isFinite(entry.clock)) continue;
        const age = Math.max(0, Number(clock) - Number(entry.clock));
        if (!age) continue;
        const origin = Number(entry.originConfidence ?? entry.confidence);
        const next = Math.max(floor, Math.min(1, origin * Math.pow(0.5, age / halfLifeHours)));
        if (Math.abs(next - entry.confidence) > 1e-9) { entry.confidence = next; changed += 1; }
      }
    }
    return changed;
  }

  function setMask(entity, maskId, patch = {}) {
    if (!entity || !maskId) return null;
    const knowledge = ensure(entity);
    knowledge.masks[maskId] = { ...(knowledge.masks[maskId] || {}), ...patch };
    return knowledge.masks[maskId];
  }

  return { CONFIDENCE_BY_KIND, ensure, record, get, knows, alternatives, decay, raiseSuspicion, suspicion, setMask };
});
