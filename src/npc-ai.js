(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationNpcAI = factory();
})(globalThis, function () {
  'use strict';

  function selectGoal(state, npc, { day, relation }) {
    const rel = relation(state, npc.id, 'player');
    const faction = npc.faction ? state.factions[npc.faction] : null;
    if (rel.fear > 30) return 'avoidPlayer';
    if (npc.needs.hunger > 70) return 'findFood';
    if (faction?.tension > 70 && npc.goals.queue.includes('prepareWar')) return 'prepareWar';
    if (faction?.tension > 55 && npc.goals.queue.includes('patrol')) return 'patrol';
    if (faction?.attitude < -25 && npc.goals.queue.includes('avoidPlayer')) return 'avoidPlayer';
    if (npc.personality.ambition > 75 && state.director.pressure > 3) return 'gainRecognition';
    return npc.goals.queue[(day(state) + npc.id.length) % npc.goals.queue.length] || 'idle';
  }

  function tick(state, { engine, locations, phase, hour, day, random, clamp, relation, remember, log, relValence }) {
    const currentPhase = phase(state);
    for (const npc of engine.queryWith(state, 'identity', 'position', 'needs', 'goals', 'schedule')) {
      if (npc.id === 'player' || !npc.alive) continue;
      npc.needs.energy = clamp(npc.needs.energy - 0.8, 0, 100);
      npc.needs.hunger = clamp(npc.needs.hunger + 0.6, 0, 100);
      if (hour(state) % 4 !== 0) continue;
      const target = npc.schedule[currentPhase] || npc.position.location;
      const goal = selectGoal(state, npc, { day, relation });
      npc.goals.active = goal;
      const route = engine.findPath(state.locations, npc.position.location, target);
      const nextStep = route[1];
      if (nextStep) {
        const previous = npc.position.location;
        npc.position.location = nextStep;
        engine.emit(state, 'npc.moved', { npcId: npc.id, from: previous, to: nextStep, destination: target, goal });
        log(state, 'npc_move', `${npc.identity.name} 从${locations[previous].name}前往${locations[nextStep].name}。`, { npcId: npc.id, goal, destination: target });
      }
      engine.runGoal(goal, { state, npc, faction: npc.faction && state.factions[npc.faction] });
      if (npc.position.location === state.entities.player.position.location && random(state) < 0.12) {
        remember(state, npc.id, 'player', { kind: 'encounter', valence: relValence(state, npc.id), text: `在${locations[npc.position.location].name}再次遇见了你。` });
      }
    }
  }

  return { selectGoal, tick };
});
