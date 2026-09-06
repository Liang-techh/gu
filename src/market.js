(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationMarket = factory();
})(globalThis, function () {
  'use strict';

  const GOODS = Object.freeze({
    water: { base: 1, label: '清水' },
    moonPetal: { base: 2, label: '月兰花瓣' },
    food: { base: 2, label: '食物' },
    relicFragment: { base: 8, label: '遗藏碎片' }
  });

  const FACTION_POLICIES = Object.freeze({
    caravans: { buy: ['water', 'food'], sell: ['moonPetal', 'relicFragment'], motive: '流动补给与套利' },
    shang: { buy: ['moonPetal', 'relicFragment'], sell: ['food', 'water'], motive: '控制稀缺资源' },
    guYue: { buy: ['food', 'water'], sell: ['moonPetal'], motive: '维持山寨生存' },
    demonic: { buy: ['relicFragment', 'moonPetal'], sell: ['food'], motive: '高风险机会' },
    auctionImmortals: { buy: ['relicFragment', 'moonPetal'], sell: ['water', 'food'], motive: '信息与稀缺品溢价' },
    centralSects: { buy: ['relicFragment', 'water'], sell: ['food', 'moonPetal'], motive: '传承与秩序' },
    northernTribes: { buy: ['food', 'water'], sell: ['relicFragment'], motive: '战争后勤' }
  });

  function ensure(state) {
    state.market ||= { prices: {}, supply: {}, demand: {}, transactions: [], day: 1 };
    state.market.prices ||= {}; state.market.supply ||= {}; state.market.demand ||= {}; state.market.transactions ||= [];
    for (const [id, good] of Object.entries(GOODS)) {
      state.market.prices[id] ??= good.base;
      state.market.supply[id] ??= 20;
      state.market.demand[id] ??= 0;
    }
    state.market.day = Math.max(1, Number(state.market.day) || 1);
    return state.market;
  }

  function ensureFaction(faction) {
    if (!faction) return null;
    const policy = faction.interests?.market || FACTION_POLICIES[faction.id];
    faction.market ||= { volume: 0, treasury: Math.max(10, Math.round((faction.influence || 10) * 0.5)), goods: {}, lastClock: -1, motive: policy?.motive || '维持势力运转', policy: policy ? { ...policy } : null };
    faction.market.goods ||= {};
    faction.market.motive ||= policy?.motive || '维持势力运转';
    faction.market.policy ||= policy ? { ...policy } : null;
    faction.market.volume = Math.max(0, Number(faction.market.volume) || 0);
    faction.market.treasury = Math.max(0, Number(faction.market.treasury) || 0);
    return faction.market;
  }

  function createRuntime({ engine, clamp, random, factionInterests = {} }) {
    function policyFor(faction) {
      return faction?.interests?.market || factionInterests[faction?.id]?.market || FACTION_POLICIES[faction?.id] || null;
    }
    function quote(state, goodId, amount = 1) {
      const market = ensure(state); const good = GOODS[goodId];
      if (!good) throw new Error(`未知商品：${goodId}`);
      const scarcity = Math.max(0, market.demand[goodId] - market.supply[goodId] * 0.18);
      const price = Math.max(1, Math.round((good.base * (1 + scarcity * 0.025)) * amount));
      market.prices[goodId] = price / amount;
      return price;
    }

    function trade(state, { actor, goodId = 'water', amount = 1, side = 'buy', factionId = actor?.faction, location = actor?.position?.location, reason = 'npc' }) {
      if (!actor || !GOODS[goodId]) throw new Error('交易参与者或商品无效');
      const market = ensure(state); const quantity = Math.max(1, Math.floor(Number(amount) || 1)); const price = quote(state, goodId, quantity);
      actor.inventory ||= {};
      if (side === 'buy') {
        if ((actor.inventory.stones || 0) < price) return { ok: false, reason: 'stones' };
        actor.inventory.stones -= price; actor.inventory[goodId] = (actor.inventory[goodId] || 0) + quantity;
        market.supply[goodId] = Math.max(0, market.supply[goodId] - quantity); market.demand[goodId] += quantity;
      } else {
        if ((actor.inventory[goodId] || 0) < quantity) return { ok: false, reason: 'inventory' };
        actor.inventory[goodId] -= quantity; actor.inventory.stones = (actor.inventory.stones || 0) + price;
        market.supply[goodId] += quantity; market.demand[goodId] = Math.max(0, market.demand[goodId] - quantity);
      }
      const transaction = { id: `trade-${state.events.sequence + 1}-${market.transactions.length + 1}`, actorId: actor.id, factionId, goodId, amount: quantity, side, price, location, reason, clock: state.clock };
      market.transactions.unshift(transaction); market.transactions = market.transactions.slice(0, 256);
      const faction = factionId && state.factions?.[factionId];
      const factionMarket = ensureFaction(faction);
      if (factionMarket) {
        factionMarket.volume += quantity;
        factionMarket.goods[goodId] = (factionMarket.goods[goodId] || 0) + (side === 'buy' ? quantity : -quantity);
        factionMarket.treasury = Math.max(0, factionMarket.treasury + (side === 'sell' ? price : -price));
        factionMarket.lastClock = state.clock;
      }
      const event = engine.emit(state, 'market.trade', transaction);
      transaction.eventId = event.id;
      transaction.provenanceId = event.provenance?.id || null;
      return { ok: true, ...transaction };
    }

    function npcTrade(state, npc, faction) {
      npc.inventory ||= {};
      const location = npc.position.location;
      const stableRoll = [...String(npc.id)].reduce((sum, char) => sum + char.charCodeAt(0), state.clock) % 100;
      const policy = policyFor(faction);
      ensureFaction(faction);
      const policyGoods = policy?.buy || [];
      const locationGood = location === 'riverbank' || location === 'caravanCamp' ? 'water' : location === 'bambooForest' ? 'moonPetal' : stableRoll < 50 ? 'food' : 'water';
      const preferred = policyGoods.length ? policyGoods[stableRoll % policyGoods.length] : locationGood;
      npc.inventory.stones = Math.max(2, npc.inventory.stones || 0);
      if ((npc.inventory[preferred] || 0) > 0 && stableRoll < 65) return trade(state, { actor: npc, goodId: preferred, side: 'sell', factionId: faction?.id, location, reason: 'npc_goal' });
      const result = trade(state, { actor: npc, goodId: preferred, side: 'buy', factionId: faction?.id, location, reason: 'npc_goal' });
      if (!result.ok) { npc.inventory.stones += 1; return trade(state, { actor: npc, goodId: preferred, side: 'buy', factionId: faction?.id, location, reason: 'npc_credit' }); }
      return result;
    }

    function dailyTick(state) {
      const market = ensure(state);
      for (const [id, good] of Object.entries(GOODS)) {
        market.supply[id] = Math.min(100, market.supply[id] + (id === 'water' ? 4 : 2));
        market.demand[id] = Math.max(0, market.demand[id] * 0.82);
        market.prices[id] = quote(state, id, 1);
      }
      market.day += 1;
    }

    return { GOODS, FACTION_POLICIES, ensure, ensureFaction, quote, trade, npcTrade, dailyTick };
  }

  return { GOODS, FACTION_POLICIES, createRuntime };
});
