(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationContracts = factory();
})(globalThis, function () {
  'use strict';

  function createRuntime({ definitions, day, copy, relation, affectFaction, remember, log, advance }) {
    function definition(id) { return definitions.find(item => item.id === id); }

    function refresh(state) {
      state.contracts ||= { available: [], active: {}, completed: [] };
      state.contracts.available ||= []; state.contracts.active ||= {}; state.contracts.completed ||= [];
      for (const item of definitions) {
        if (state.contracts.completed.some(done => done.id === item.id) || state.contracts.active[item.id] || state.contracts.available.includes(item.id)) continue;
        if (day(state) < item.availableFromDay) continue;
        if ((item.flags || []).some(flag => !state.flags[flag])) continue;
        if (!state.entities[item.giver]?.alive) continue;
        state.contracts.available.push(item.id);
      }
    }

    function objectiveSatisfied(state, item) {
      const objective = item.objective;
      const player = state.entities.player;
      if (objective.type === 'helpTalk') return !!state.entities[objective.target]?.memory.facts.player?.helped;
      if (objective.type === 'investigationLeverage') return !!player.memory.facts.world.investigationLeverage;
      if (objective.type === 'arenaWins') return state.arena.wins >= objective.count;
      if (objective.type === 'inheritanceRound') return state.inheritance.round >= objective.count;
      return false;
    }

    function accept(state, id) {
      refresh(state);
      const item = definition(id);
      if (!item || !state.contracts.available.includes(id)) throw new Error('当前没有这份委托');
      const player = state.entities.player; const giver = state.entities[item.giver];
      if (!giver || giver.position.location !== player.position.location || !item.locations.includes(player.position.location)) throw new Error('委托人不在当前位置');
      state.contracts.available = state.contracts.available.filter(value => value !== id);
      state.contracts.active[id] = { id, giver: item.giver, acceptedClock: state.clock, objective: copy(item.objective) };
      remember(state, item.giver, 'player', { kind: 'contract', valence: 2, text: `你接受了委托“${item.title}”。`, facts: { contractAccepted: id } });
      log(state, 'contract', `你接受了委托：${item.title}。`, { contractId: id, phase: 'accepted' });
      advance(state, 1, 'contract');
    }

    function complete(state, id) {
      refresh(state);
      const item = definition(id); const active = state.contracts.active[id];
      if (!item || !active) throw new Error('你没有接受这份委托');
      if (!objectiveSatisfied(state, item)) throw new Error('委托目标尚未完成');
      const player = state.entities.player; const reward = item.reward || {};
      if (reward.insight) player.cultivation.insight += reward.insight;
      if (reward.stones) player.inventory.stones = (player.inventory.stones || 0) + reward.stones;
      if (reward.reputation) state.arena.reputation += reward.reputation;
      if (reward.trust) relation(state, 'player', reward.trust.target).trust += reward.trust.amount;
      if (reward.faction) affectFaction(state, reward.faction.id, reward.faction.attitude || 0, reward.faction.tension || 0);
      delete state.contracts.active[id]; state.contracts.completed.push({ id, completedClock: state.clock });
      log(state, 'contract', `你完成了委托：${item.title}。`, { contractId: id, phase: 'completed', reward });
      advance(state, 1, 'contract');
    }

    return { definition, refresh, objectiveSatisfied, accept, complete };
  }

  return { createRuntime };
});
