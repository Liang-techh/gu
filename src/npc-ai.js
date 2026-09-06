(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationNpcAI = factory();
})(globalThis, function () {
  'use strict';

  function goalScore(state, npc, goal, { day, relation }) {
    const rel = relation(state, npc.id, 'player');
    const faction = npc.faction ? state.factions[npc.faction] : null;
    const queueIndex = npc.goals.queue.indexOf(goal);
    const personality = npc.personality || {};
    const suspicion = Number(npc.knowledge?.suspicion?.player?.value || 0);
    const caseState = state.intel?.cases?.player;
    const factionCase = npc.faction ? caseState?.factions?.[npc.faction] : null;
    const casePressure = Number(factionCase?.pressure || 0);
    let score = queueIndex >= 0 ? 2.2 - queueIndex * 0.18 : 0.05;
    if (goal === 'avoidPlayer') score += rel.fear * 0.06 + (faction?.attitude < -25 ? 3 : 0);
    if (goal === 'avoidPlayer') score += suspicion * 0.045;
    if (goal === 'findFood' || goal === 'hunt' || goal === 'forage') score += Math.max(0, npc.needs.hunger - 45) * 0.08;
    if (goal === 'survive' || goal === 'returnHome') score += Math.max(0, 65 - npc.needs.safety) * 0.05;
    if (goal === 'prepareWar' || goal === 'patrol' || goal === 'ambush') score += (faction?.tension || 0) * 0.055;
    if (goal === 'maintainOrder' || goal === 'mediate') score += (faction?.tension || 0) * 0.035;
    if (goal === 'gainRecognition' || goal === 'proveWorth') score += personality.ambition * 0.035 + state.director.pressure * 0.4;
    if (goal === 'collectRumors' || goal === 'investigate' || goal === 'observe') score += personality.curiosity * 0.025;
    if (goal === 'collectRumors' || goal === 'investigate' || goal === 'observe') score += suspicion * 0.035;
    if (goal === 'collectRumors' || goal === 'investigate') score += casePressure * 0.06;
    if (goal === 'ambush' || goal === 'patrol') score += casePressure * 0.04;
    if (goal === 'protectClan' || goal === 'protectBrother' || goal === 'protectFather' || goal === 'protectDaughter') score += personality.loyalty * 0.025;
    if (goal === 'trade' || goal === 'auction') score += personality.greed * 0.018;
    const recent = (npc.goals.history || []).filter(item => item.goal === goal && day(state) - item.day <= 1).length;
    score -= recent * 0.35;
    score += ((day(state) + npc.id.length + goal.length) % 7) * 0.01;
    return score;
  }

  function selectGoal(state, npc, { day, relation }) {
    const forced = forcedGoal(state, npc, { relation });
    if (forced) return forced;
    const candidates = goalCandidates(state, npc, { relation });
    const scored = candidates.map(goal => ({ goal, score: goalScore(state, npc, goal, { day, relation }) }));
    scored.sort((a, b) => b.score - a.score || a.goal.localeCompare(b.goal));
    return scored[0]?.goal || 'idle';
  }

  function forcedGoal(state, npc, { relation }) {
    const rel = relation(state, npc.id, 'player');
    const faction = npc.faction ? state.factions[npc.faction] : null;
    const casePressure = Number(state.intel?.cases?.player?.factions?.[npc.faction]?.pressure || 0);
    if (npc.conditions?.active?.some(condition => condition.id === 'afraid')) return 'avoidPlayer';
    if (rel.fear > 30) return 'avoidPlayer';
    if (Number(npc.knowledge?.suspicion?.player?.value || 0) >= 78 && faction?.attitude < 0) return 'avoidPlayer';
    if (casePressure >= 12 && faction?.attitude >= -25) return 'investigate';
    return null;
  }

  function goalCandidates(state, npc, { relation }) {
    const rel = relation(state, npc.id, 'player');
    const faction = npc.faction ? state.factions[npc.faction] : null;
    const casePressure = Number(state.intel?.cases?.player?.factions?.[npc.faction]?.pressure || 0);
    const candidates = [...new Set([...(npc.goals.queue || []), 'findFood', 'avoidPlayer', 'survive', 'gainRecognition'])];
    if (casePressure > 0 || Number(npc.knowledge?.suspicion?.player?.value || 0) > 10) candidates.push('collectRumors', 'investigate');
    if (casePressure >= 12 && faction?.attitude < 0) candidates.push('ambush');
    if (npc.needs.hunger <= 70) candidates.splice(candidates.indexOf('findFood'), 1);
    if (rel.fear <= 30 && !npc.goals.queue.includes('avoidPlayer') && faction?.attitude >= -25) candidates.splice(candidates.indexOf('avoidPlayer'), 1);
    return [...new Set(candidates)];
  }

  function tick(state, { engine, locations, phase, hour, day, random, clamp, relation, remember, log, relValence, brain }) {
    const currentPhase = phase(state);
    for (const npc of engine.queryWith(state, 'identity', 'position', 'needs', 'goals', 'schedule')) {
      if (npc.id === 'player' || !npc.alive || npc.agent) continue;
      npc.needs.energy = clamp(npc.needs.energy - 0.8, 0, 100);
      npc.needs.hunger = clamp(npc.needs.hunger + 0.6, 0, 100);
      if (hour(state) % 4 !== 0) continue;
      const decision = brain?.decide ? brain.decide(state, npc, {
        engine, relation, day, phase, scoreGoal: (world, entity, goal) => goalScore(world, entity, goal, { day, relation }),
        candidates: (world, entity) => goalCandidates(world, entity, { relation }),
        forceGoal: (world, entity) => forcedGoal(world, entity, { relation })
      }) : null;
      const target = decision?.destination || npc.schedule[currentPhase] || npc.position.location;
      const goal = decision?.goal || selectGoal(state, npc, { day, relation });
      npc.goals.active = goal;
      npc.goals.history ||= [];
      npc.goals.history.unshift({ goal, day: day(state), clock: state.clock });
      npc.goals.history = npc.goals.history.slice(0, 16);
      const route = engine.findPath(state.locations, npc.position.location, target);
      const nextStep = route[1];
      if (nextStep) {
        const previous = npc.position.location;
        npc.position.location = nextStep;
        engine.emit(state, 'npc.moved', { npcId: npc.id, from: previous, to: nextStep, destination: target, goal });
        log(state, 'npc_move', `${npc.identity.name} 从${locations[previous].name}前往${locations[nextStep].name}。`, { npcId: npc.id, goal, destination: target });
      }
      if (brain) brain.consumeMove(npc.brain, target, npc.position.location === target);
      const result = engine.runGoal(goal, { state, npc, faction: npc.faction && state.factions[npc.faction] });
      if (brain && npc.position.location === target) brain.completeGoal(npc, result);
      if (npc.position.location === state.entities.player.position.location && random(state) < 0.12) {
        remember(state, npc.id, 'player', { kind: 'encounter', valence: relValence(state, npc.id), text: `在${locations[npc.position.location].name}再次遇见了你。` });
      }
    }
  }

  return { goalScore, selectGoal, goalCandidates, tick };
});
