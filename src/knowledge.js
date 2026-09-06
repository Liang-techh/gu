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

  function record(entity, subjectId, facts, { kind = 'observation', clock = 0, source = 'memory', confidence } = {}) {
    if (!entity || !subjectId || !facts || typeof facts !== 'object') return;
    const knowledge = ensure(entity);
    knowledge.facts[subjectId] ||= {};
    const certainty = Math.max(0, Math.min(1, Number(confidence ?? CONFIDENCE_BY_KIND[kind] ?? 0.6)));
    for (const [fact, value] of Object.entries(facts)) {
      const previous = knowledge.facts[subjectId][fact];
      knowledge.facts[subjectId][fact] = {
        value,
        confidence: previous ? Math.max(previous.confidence, certainty) : certainty,
        kind,
        clock,
        source
      };
    }
    knowledge.sources.unshift({ subjectId, kind, clock, source, confidence: certainty });
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

  function setMask(entity, maskId, patch = {}) {
    if (!entity || !maskId) return null;
    const knowledge = ensure(entity);
    knowledge.masks[maskId] = { ...(knowledge.masks[maskId] || {}), ...patch };
    return knowledge.masks[maskId];
  }

  return { CONFIDENCE_BY_KIND, ensure, record, get, knows, raiseSuspicion, suspicion, setMask };
});
