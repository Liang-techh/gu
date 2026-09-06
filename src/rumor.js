(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationRumor = factory();
})(globalThis, function () {
  'use strict';

  const RULES = {
    'social.interaction': { kind: 'rumor-social', valence: 1, fact: 'heardInteraction', text: '你听说附近有人与{subject}发生了交涉。' },
    'social.conversation': { kind: 'rumor-social', valence: 1, fact: 'heardConversation', text: '你听说{subject}最近与人交换了话语和立场。' },
    'combat.started': { kind: 'rumor-conflict', valence: -2, fact: 'heardConflict', text: '你听说{subject}在{location}主动挑起了冲突。' },
    'combat.damage': { kind: 'rumor-violence', valence: -3, fact: 'heardViolence', text: '你听说{subject}在{location}留下了伤势或伤痕。' },
    'world.resource_gathered': { kind: 'rumor-resource', valence: 1, fact: 'heardResourceClaim', text: '你听说{subject}正在{location}争夺资源。' },
    'auction.lot': { kind: 'rumor-market', valence: 1, fact: 'heardAuctionMove', text: '你听说{subject}在{location}改变了一笔交易的价格和关系。' },
    'frontier.patrol': { kind: 'rumor-war', valence: -1, fact: 'heardWarReport', text: '你听说北原巡逻线又发生了变化。' },
    'tower.floor': { kind: 'rumor-inheritance', valence: 1, fact: 'heardTowerAttempt', text: '你听说真阳楼的闯关者又改变了一层传承记录。' }
  };

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
    let count = 0;
    for (const listener of query(state, entity => entity.alive && entity.position?.location === location && !excluded.has(entity.id))) {
      remember(state, listener.id, subjectId, {
        kind: rule.kind,
        valence: rule.valence,
        text,
        facts: { [rule.fact]: event.id }
      });
      count += 1;
    }
    state.facts.rumors ||= [];
    state.facts.rumors.unshift({ eventId: event.id, type: event.type, location, subjectId, heardBy: count });
    state.facts.rumors = state.facts.rumors.slice(0, 128);
    return count;
  }

  return { RULES, propagate };
});
