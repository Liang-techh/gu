(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationSocial = factory();
})(globalThis, function () {
  'use strict';

  // Qud analogue: conversations and social actions are world interactions,
  // not UI-only callbacks. The same resolver serves the player and autonomous
  // NPCs, so both sides can leave relationship, memory and faction evidence.
  function ensure(state) {
    state.social ||= { sequence: 0, recent: [], lastActorClock: {} };
    state.social.recent ||= [];
    state.social.lastActorClock ||= {};
    state.social.sequence = Math.max(0, Number(state.social.sequence) || 0);
    return state.social;
  }

  function createRuntime({ engine, relation, remember, log, affectFaction, condition, market }) {
    function validPair(actor, target) {
      return !!actor && !!target && actor.id !== target.id && actor.alive !== false && target.alive !== false;
    }

    function name(entity) { return entity?.identity?.name || entity?.id || '某人'; }

    function record(state, actor, target, mode, result = {}) {
      const ledger = ensure(state);
      ledger.sequence += 1;
      const item = {
        id: `social-${ledger.sequence}`,
        actorId: actor.id,
        targetId: target.id,
        mode,
        location: actor.position?.location || null,
        clock: state.clock,
        ...result
      };
      ledger.recent.unshift(item);
      ledger.recent = ledger.recent.slice(0, 128);
      const event = engine.emit(state, 'social.interaction', {
        actorId: actor.id,
        targetId: target.id,
        mode,
        location: item.location,
        socialId: item.id,
        autonomous: actor.id !== state.playerId,
        rumor: actor.id === state.playerId || ['threaten', 'mediate'].includes(mode)
      });
      item.eventId = event.id;
      item.provenanceId = event.provenance?.id || null;
      return item;
    }

    function apply(state, actor, target, mode = 'listen', options = {}) {
      if (!validPair(actor, target)) return false;
      if (actor.position?.location !== target.position?.location) return false;
      const r = relation(state, actor.id, target.id);
      const memoryBoost = Number(options.memoryBoost) || 0;
      let result;
      if (mode === 'help') {
        r.trust += actor.id === state.playerId ? 7 + memoryBoost : 3 + memoryBoost * 0.25;
        r.debt += actor.id === state.playerId ? 1 : 0.5;
        if (target.faction) affectFaction(state, target.faction, actor.id === state.playerId ? 2 : 0.4, -0.5);
        remember(state, target.id, actor.id, { kind: 'help', valence: actor.id === state.playerId ? 10 : 3, text: `${name(actor)}在关键时刻帮助了你。`, facts: { helped: true } });
        remember(state, actor.id, target.id, { kind: 'help-given', valence: 2, text: `你帮助了${name(target)}。`, facts: { helpedTarget: true } });
        result = { trustDelta: actor.id === state.playerId ? 7 + memoryBoost : 3 + memoryBoost * 0.25 };
      } else if (mode === 'threaten') {
        r.fear += actor.id === state.playerId ? 9 : 4;
        r.trust -= actor.id === state.playerId ? 5 : 2;
        condition?.apply(target, 'afraid', { duration: actor.id === state.playerId ? 18 : 8, intensity: 1, source: actor.id, clock: state.clock });
        if (target.faction) affectFaction(state, target.faction, actor.id === state.playerId ? -2 : -0.4, actor.id === state.playerId ? 2 : 0.5);
        if (actor.id === state.playerId) state.director.pressure += 1;
        remember(state, target.id, actor.id, { kind: 'threat', valence: -8, text: `${name(actor)}让你感到危险。` });
        result = { fearDelta: actor.id === state.playerId ? 9 : 4 };
      } else if (mode === 'trade') {
        if (actor.id === state.playerId) {
          if (market) {
            const trade = market.trade(state, {
              actor,
              goodId: options.goodId || 'water',
              amount: options.amount || 1,
              side: options.side || 'buy',
              factionId: target.faction || actor.faction,
              location: actor.position?.location,
              reason: options.reason || 'social_trade'
            });
            if (!trade?.ok) return false;
            result = { tradeId: trade.id, goodId: trade.goodId, amount: trade.amount, side: trade.side, price: trade.price };
          } else {
            if ((actor.inventory?.stones || 0) < 1) return false;
            actor.inventory.stones -= 1;
            actor.inventory.water = (actor.inventory.water || 0) + 1;
            result = { goodId: 'water', amount: 1, side: 'buy', price: 1 };
          }
        } else if (market) {
          const trade = market.npcTrade(state, actor, actor.faction && state.factions?.[actor.faction]);
          if (!trade?.ok) return false;
          result = { tradeId: trade.id, goodId: trade.goodId, price: trade.price };
        } else return false;
        r.trust += actor.id === state.playerId ? 2 : 0.5;
        if (actor.id === state.playerId && target.faction) affectFaction(state, target.faction, 1, 0);
        remember(state, target.id, actor.id, { kind: 'trade', valence: 1, text: `${name(actor)}与你完成了一次交易。`, facts: { traded: true } });
        result ||= { goodId: 'water', amount: 1, side: 'buy', price: 1 };
      } else if (mode === 'mediate') {
        r.affinity += 1;
        if (actor.faction && state.factions?.[actor.faction]) state.factions[actor.faction].tension = Math.max(0, state.factions[actor.faction].tension - 0.3);
        if (target.faction && state.factions?.[target.faction]) state.factions[target.faction].tension = Math.max(0, state.factions[target.faction].tension - 0.3);
        remember(state, actor.id, target.id, { kind: 'mediation', valence: 1, text: `你尝试缓和与${name(target)}的关系。`, facts: { mediated: true } });
        remember(state, target.id, actor.id, { kind: 'mediation', valence: 1, text: `${name(actor)}曾尝试缓和局势。`, facts: { mediatedBy: actor.id } });
        result = { tensionDelta: -0.3 };
      } else {
        r.trust += actor.id === state.playerId ? 1 + memoryBoost * 0.2 : 0.4;
        if (actor.cultivation) actor.cultivation.insight += actor.id === state.playerId ? 1 : 0.1;
        remember(state, target.id, actor.id, { kind: 'conversation', valence: 2, text: `${name(actor)}和你谈过一次。`, facts: { conversed: true } });
        remember(state, actor.id, target.id, { kind: 'conversation', valence: 1, text: `你和${name(target)}交换了几句判断。`, facts: { conversedWith: true } });
        result = { trustDelta: actor.id === state.playerId ? 1 + memoryBoost * 0.2 : 0.4 };
      }
      const item = record(state, actor, target, mode, result);
      log(state, 'social', actor.id === state.playerId ? `你与${name(target)}完成了一次${mode === 'threaten' ? '施压' : mode === 'help' ? '帮助' : mode === 'trade' ? '交易' : '交谈'}。` : `${name(actor)}与${name(target)}发生了${mode === 'threaten' ? '冲突性接触' : mode === 'mediate' ? '调停' : '交流'}。`, { ...item });
      return { ok: true, ...item };
    }

    function chooseTarget(state, actor, goal, { engine: queryEngine = engine } = {}) {
      const nearby = queryEngine.query(state, entity => validPair(actor, entity) && entity.position?.location === actor.position?.location && entity.id !== state.playerId);
      if (!nearby.length) return null;
      const sameFaction = nearby.filter(entity => actor.faction && entity.faction === actor.faction);
      const opponents = nearby.filter(entity => actor.faction && entity.faction && entity.faction !== actor.faction);
      if (['ambush', 'threaten'].includes(goal)) return opponents.sort((a, b) => a.id.localeCompare(b.id))[0] || nearby.sort((a, b) => a.id.localeCompare(b.id))[0];
      if (['mediate', 'protectClan'].includes(goal)) return opponents.sort((a, b) => a.id.localeCompare(b.id))[0] || sameFaction[0] || nearby[0];
      return sameFaction.sort((a, b) => a.id.localeCompare(b.id))[0] || nearby.sort((a, b) => a.id.localeCompare(b.id))[0];
    }

    function act(state, actor, goal, options = {}) {
      const mode = goal === 'ambush' || goal === 'threaten' ? 'threaten' : goal === 'mediate' ? 'mediate' : goal === 'trade' ? 'trade' : goal === 'help' || goal === 'protectBrother' || goal === 'protectClan' ? 'help' : 'listen';
      const target = options.target || chooseTarget(state, actor, goal, options);
      if (!target) return false;
      const pairKey = [actor.id, target.id].sort().join('::');
      const ledger = ensure(state);
      const lastActorClock = Number(ledger.lastActorClock[actor.id]);
      if (Number.isFinite(lastActorClock) && state.clock - lastActorClock < 8) return false;
      const previous = ledger.recent.find(item => [item.actorId, item.targetId].sort().join('::') === pairKey);
      if (previous?.clock === state.clock) return false;
      const result = apply(state, actor, target, mode, options);
      if (result) ledger.lastActorClock[actor.id] = state.clock;
      return result;
    }

    function registerInteractions(targetEngine = engine) {
      for (const mode of ['help', 'threaten', 'trade', 'listen']) targetEngine.registerInteraction(mode, context => {
        const actor = context.p || context.actor;
        if (mode === 'trade' && actor?.id === context.state.playerId && (actor.inventory?.stones || 0) < 1) throw new Error('元石不足');
        return apply(context.state, actor, context.npc || context.target, mode, context);
      });
      return ['help', 'threaten', 'trade', 'listen'];
    }

    return { ensure, apply, act, chooseTarget, registerInteractions };
  }

  return { ensure, createRuntime };
});
