(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationRumor = factory();
})(globalThis, function () {
  'use strict';

  const RULES = {
    'social.interaction': { kind: 'rumor-social', valence: 1, confidence: 0.5, fact: 'heardInteraction', text: '你听说附近有人与{subject}发生了交涉。' },
    'social.conversation': { kind: 'rumor-social', valence: 1, confidence: 0.48, fact: 'heardConversation', text: '你听说{subject}最近与人交换了话语和立场。' },
    'combat.started': { kind: 'rumor-conflict', valence: -2, confidence: 0.58, fact: 'heardConflict', text: '你听说{subject}在{location}主动挑起了冲突。' },
    'combat.damage': { kind: 'rumor-violence', valence: -3, confidence: 0.62, fact: 'heardViolence', text: '你听说{subject}在{location}留下了伤势或伤痕。' },
    'world.resource_gathered': { kind: 'rumor-resource', valence: 1, confidence: 0.42, fact: 'heardResourceClaim', text: '你听说{subject}正在{location}争夺资源。' },
    'auction.lot': { kind: 'rumor-market', valence: 1, confidence: 0.5, fact: 'heardAuctionMove', text: '你听说{subject}在{location}改变了一笔交易的价格和关系。' },
    'market.trade': { kind: 'rumor-market', valence: 1, confidence: 0.36, fact: 'heardMarketTrade', text: '你听说{subject}在{location}完成了一笔交易。' },
    'identity.revealed': { kind: 'rumor-social', valence: 1, confidence: 0.68, fact: 'heardIdentityReveal', text: '你听说{subject}在{location}向某个对象透露了自己的身份。' },
    'frontier.patrol': { kind: 'rumor-war', valence: -1, confidence: 0.46, fact: 'heardWarReport', text: '你听说北原巡逻线又发生了变化。' },
    'tower.floor': { kind: 'rumor-inheritance', valence: 1, confidence: 0.52, fact: 'heardTowerAttempt', text: '你听说真阳楼的闯关者又改变了一层传承记录。' }
  };

  function factionPath(state, from, target) {
    if (!from || !target) return [];
    if (from === target) return [from];
    const queue = [[from]];
    const seen = new Set([from]);
    while (queue.length) {
      const path = queue.shift();
      const current = path[path.length - 1];
      for (const next of Object.keys(state.factions || {})) {
        if (seen.has(next)) continue;
        const forward = Number(state.factions[current]?.relations?.[next] || 0);
        const reverse = Number(state.factions[next]?.relations?.[current] || 0);
        if (Math.abs(forward) < 1 && Math.abs(reverse) < 1) continue;
        const nextPath = [...path, next];
        if (next === target) return nextPath;
        seen.add(next);
        if (nextPath.length < 3) queue.push(nextPath);
      }
    }
    return [];
  }

  function caseImpact(rule, event) {
    if (event.type === 'market.trade') return 0;
    if (event.type === 'identity.revealed') return 3;
    if (event.type === 'auction.lot') return event.payload?.trace >= 10 ? 2.5 : 1;
    if (rule.kind.includes('conflict') || rule.kind.includes('violence')) return 2;
    return 1;
  }

  function locationOf(state, event) {
    const payload = event.payload || {};
    if (payload.location && state.locations[payload.location]) return payload.location;
    for (const id of [payload.actorId, payload.sourceId, payload.targetId]) {
      if (id && state.entities[id]?.position?.location) return state.entities[id].position.location;
    }
    return null;
  }

  function subjectOf(state, event) {
    const payload = event.payload || {};
    return payload.targetId || payload.actorId || payload.sourceId || 'world';
  }

  function driftMarker(eventId, listenerId, pathLength = 0) {
    const key = `${eventId}:${listenerId}:${pathLength}`;
    const score = [...key].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) % 997, 17);
    return pathLength > 1 || score % 100 < 28;
  }

  function propagate(state, event, { locations, query, remember }) {
    const rule = RULES[event.type];
    if (!rule) return 0;
    const location = locationOf(state, event);
    if (!location || !locations[location]) return 0;
    const subjectId = subjectOf(state, event);
    const subject = state.entities[subjectId];
    const subjectName = subject?.identity?.name || '那个人';
    const text = rule.text.replace('{subject}', subjectName).replace('{location}', locations[location].name);
    const payload = event.payload || {};
    const excluded = new Set([payload.actorId, payload.sourceId, payload.targetId].filter(Boolean));
    const subjectFactions = new Set([subject?.faction, state.entities[payload.actorId]?.faction, state.entities[payload.sourceId]?.faction].filter(Boolean));
    const facts = { [rule.fact]: event.id, rumorEvent: event.id };
    if (payload.maskId) facts.observedMask = payload.maskId;
    if (payload.trace >= 10) facts.marketTrace = payload.trace;
    if (event.type === 'identity.revealed') facts.identityReveal = event.id;
    facts.rumorConfidence = rule.confidence || 0.45;
    facts.requiresVerification = (rule.confidence || 0.45) < 0.7;
    state.intel ||= { leads: [], cases: {} };
    const caseState = state.intel.cases[subjectId] ||= { pressure: 0, lastClock: state.clock, events: 0, factions: {} };
    caseState.pressure = Math.min(100, caseState.pressure + caseImpact(rule, event));
    caseState.lastClock = state.clock;
    caseState.events += 1;
    for (const factionId of subjectFactions) {
      const factionCase = caseState.factions[factionId] ||= { pressure: 0, confidence: 0, reports: 0, lastClock: state.clock };
      factionCase.pressure = Math.min(100, factionCase.pressure + caseImpact(rule, event));
      factionCase.confidence = Math.max(factionCase.confidence, rule.confidence || 0.45);
      factionCase.lastClock = state.clock;
    }
    if (payload.actorId && payload.actorId !== subjectId) {
      const actor = state.entities[payload.actorId];
      const actorCase = state.intel.cases[payload.actorId] ||= { pressure: 0, lastClock: state.clock, events: 0, factions: {} };
      actorCase.pressure = Math.min(100, actorCase.pressure + caseImpact(rule, event) * 0.8);
      actorCase.lastClock = state.clock;
      actorCase.events += 1;
      if (actor?.faction) {
        const factionCase = actorCase.factions[actor.faction] ||= { pressure: 0, confidence: 0, reports: 0, lastClock: state.clock };
        factionCase.pressure = Math.min(100, factionCase.pressure + caseImpact(rule, event) * 0.8);
        factionCase.confidence = Math.max(factionCase.confidence, (rule.confidence || 0.45) * 0.8);
        factionCase.lastClock = state.clock;
      }
    }
    let count = 0;
    const localAudience = new Set();
    const knownBy = [];
    for (const listener of query(state, entity => entity.alive && entity.position?.location === location && !excluded.has(entity.id))) {
      const localFacts = { ...facts, rumorDistorted: driftMarker(event.id, listener.id) };
      remember(state, listener.id, subjectId, {
        kind: rule.kind,
        valence: rule.valence,
        text,
        confidence: rule.confidence,
        source: `rumor:${event.type}:local`,
        provenance: [event.id],
        facts: localFacts
      });
      localAudience.add(listener.id);
      knownBy.push({ entityId: listener.id, faction: listener.faction, path: [listener.faction || 'local'], confidence: rule.confidence || 0.45 });
      count += 1;
    }
    let factionCount = 0;
    for (const listener of query(state, entity => entity.alive && !excluded.has(entity.id) && !localAudience.has(entity.id) && subjectFactions.has(entity.faction))) {
      remember(state, listener.id, subjectId, {
        kind: 'faction-rumor',
        valence: rule.valence * 0.5,
        text: `你从${state.factions[listener.faction]?.name || '所属势力'}的关系网中听到：${text}`,
        confidence: (rule.confidence || 0.45) * 0.72,
        source: `rumor:${event.type}:faction`,
        provenance: [event.id, `faction:${listener.faction}`],
        facts: { ...facts, heardFactionNews: event.id, rumorDistorted: driftMarker(event.id, listener.id, 1) }
      });
      const factionCase = caseState.factions[listener.faction] ||= { pressure: 0, confidence: 0, reports: 0, lastClock: state.clock };
      factionCase.pressure = Math.min(100, factionCase.pressure + caseImpact(rule, event) * 0.72);
      factionCase.confidence = Math.max(factionCase.confidence, (rule.confidence || 0.45) * 0.72);
      factionCase.reports += 1; factionCase.lastClock = state.clock;
      knownBy.push({ entityId: listener.id, faction: listener.faction, path: [listener.faction], confidence: (rule.confidence || 0.45) * 0.72 });
      factionCount += 1;
    }
    let networkCount = 0;
    for (const listener of query(state, entity => entity.alive && !excluded.has(entity.id) && !localAudience.has(entity.id) && !subjectFactions.has(entity.faction))) {
      const routes = [...subjectFactions].map(sourceFaction => factionPath(state, sourceFaction, listener.faction)).filter(path => path.length);
      routes.sort((a, b) => a.length - b.length);
      const path = routes[0];
      if (!path || path.length > 2) continue;
      const confidence = (rule.confidence || 0.45) * (path.length === 1 ? 0.72 : 0.45);
      remember(state, listener.id, subjectId, {
        kind: 'faction-rumor',
        valence: rule.valence * 0.35,
        confidence,
        source: `rumor:${event.type}:network`,
        provenance: [event.id, ...path.map(faction => `faction:${faction}`)],
        text: `你从势力关系网（${path.join('→')}）中听到：${text}`,
        facts: { ...facts, heardFactionNews: event.id, rumorPath: path, rumorDistorted: driftMarker(event.id, listener.id, path.length) }
      });
      const factionCase = caseState.factions[listener.faction] ||= { pressure: 0, confidence: 0, reports: 0, lastClock: state.clock };
      factionCase.pressure = Math.min(100, factionCase.pressure + caseImpact(rule, event) * 0.45);
      factionCase.confidence = Math.max(factionCase.confidence, confidence);
      factionCase.reports += 1; factionCase.lastClock = state.clock;
      knownBy.push({ entityId: listener.id, faction: listener.faction, path, confidence });
      networkCount += 1;
    }
    state.intel.leads.unshift({ eventId: event.id, type: event.type, subjectId, location, sourceFactions: [...subjectFactions], knownBy: knownBy.slice(0, 32), clock: state.clock, confidence: rule.confidence || 0.45 });
    state.intel.leads = state.intel.leads.slice(0, 256);
    state.facts.rumors ||= [];
    state.facts.rumors.unshift({ eventId: event.id, type: event.type, location, subjectId, heardBy: count, factionHeardBy: factionCount, networkHeardBy: networkCount, casePressure: caseState.pressure });
    state.facts.rumors = state.facts.rumors.slice(0, 128);
    return count;
  }

  return { RULES, propagate };
});
