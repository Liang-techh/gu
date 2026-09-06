(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationNpcAI = factory();
})(globalThis, function () {
  'use strict';

  function knownFact(npc, location, fact) {
    const entry = npc.knowledge?.facts?.[location]?.[fact];
    return entry && typeof entry === 'object' && typeof entry.confidence === 'number' ? entry : null;
  }

  function knowledgeAge(state, entry) {
    return entry ? Math.max(0, state.clock - Number(entry.clock || 0)) : Infinity;
  }

  function goalScore(state, npc, goal, { day, relation }) {
    const rel = relation(state, npc.id, 'player');
    const faction = npc.faction ? state.factions[npc.faction] : null;
    const queueIndex = npc.goals.queue.indexOf(goal);
    const personality = npc.personality || {};
    const ambition = Number(personality.ambition || 0);
    const curiosity = Number(personality.curiosity || 0);
    const loyalty = Number(personality.loyalty || 0);
    const greed = Number(personality.greed || 0);
    const suspicion = Number(npc.knowledge?.suspicion?.player?.value || 0);
    const caseState = state.intel?.cases?.player;
    const factionCase = npc.faction ? caseState?.factions?.[npc.faction] : null;
    const casePressure = Number(factionCase?.pressure || 0);
    const location = npc.position?.location;
    const observed = knownFact(npc, location, 'observedResources');
    const observedDanger = knownFact(npc, location, 'observedDanger');
    const relicClue = knownFact(npc, location, 'relicClue');
    const exposure = npc.effects?.active?.find(item => item.kind === 'environmentExposure');
    const fatigue = npc.effects?.active?.find(item => item.kind === 'terrainFatigue');
    let score = queueIndex >= 0 ? 2.2 - queueIndex * 0.18 : 0.05;
    if (goal === 'avoidPlayer') score += rel.fear * 0.06 + (faction?.attitude < -25 ? 3 : 0);
    if (goal === 'avoidPlayer') score += suspicion * 0.045;
    if (goal === 'findFood' || goal === 'hunt' || goal === 'forage') score += Math.max(0, npc.needs.hunger - 45) * 0.08;
    if (goal === 'survive' || goal === 'returnHome') score += Math.max(0, 65 - npc.needs.safety) * 0.05;
    if (goal === 'prepareWar' || goal === 'patrol' || goal === 'ambush') score += (faction?.tension || 0) * 0.055;
    if (goal === 'maintainOrder' || goal === 'mediate') score += (faction?.tension || 0) * 0.035;
    if (goal === 'gainRecognition' || goal === 'proveWorth') score += ambition * 0.035 + state.director.pressure * 0.4;
    if (goal === 'collectRumors' || goal === 'investigate' || goal === 'observe') score += curiosity * 0.025;
    if (goal === 'collectRumors' || goal === 'investigate' || goal === 'observe') score += suspicion * 0.035;
    if (goal === 'collectRumors' || goal === 'investigate') score += casePressure * 0.06;
    if (goal === 'ambush' || goal === 'patrol') score += casePressure * 0.04;
    if (goal === 'observe') score += observed ? Math.min(1.4, knowledgeAge(state, observed) / 96) : 0.9;
    if (goal === 'findRelic') score += relicClue ? Math.max(0, relicClue.confidence * 0.8 - 0.2) : 0.35;
    if (goal === 'secureResources' || goal === 'forage') {
      const resources = observed?.value && typeof observed.value === 'object' ? observed.value : {};
      const knownSupply = Object.values(resources).reduce((sum, value) => sum + Number(value || 0), 0);
      score += Math.min(1.2, knownSupply * 0.03) * (observed ? observed.confidence : 0.25);
    }
    if (goal === 'patrol' && observedDanger) score += Math.min(1.1, Number(observedDanger.value || 0) * 0.012) * observedDanger.confidence;
    if (goal === 'avoidPlayer' || goal === 'survive' || goal === 'returnHome') score += (Number(exposure?.intensity || 0) * 0.018) + (fatigue ? 0.35 : 0);
    if (goal === 'protectClan' || goal === 'protectBrother' || goal === 'protectFather' || goal === 'protectDaughter') score += loyalty * 0.025;
    if (goal === 'trade' || goal === 'auction') score += greed * 0.018;
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

  function localStep(state, npc, { engine, localMap, localObjects, locations, relation, remember, log, relValence }) {
    if (!localMap || !npc.position?.location || !locations[npc.position.location]) return null;
    const locationId = npc.position.location;
    const location = locations[locationId];
    const from = localMap.normalizeCell(locationId, npc.position.cell, location, npc.id);
    npc.position.cell = from;
    const player = state.entities?.player;
    const playerCell = player?.position?.location === locationId ? localMap.normalizeCell(locationId, player.position.cell, location, 'player') : null;
    const occupied = new Set(Object.values(state.entities || {}).filter(entity => entity.id !== npc.id && entity.alive && entity.position?.location === locationId && entity.position?.cell).map(entity => `${entity.position.cell.x},${entity.position.cell.y}`));
    const goal = npc.goals?.active || 'idle';
    const preferred = [];
    const objectTarget = localObjects?.visible(state, npc).filter(object => {
      if (goal === 'secureResources' || goal === 'forage') return object.kind === 'resource' && object.remaining > 0;
      if (goal === 'findRelic' || goal === 'investigate') return ['trace', 'relic', 'clue'].includes(object.kind);
      if (goal === 'observe') return true;
      return false;
    }).sort((a, b) => localMap.distance(from, a.cell) - localMap.distance(from, b.cell) || a.id.localeCompare(b.id))[0];
    if (objectTarget) {
      const dx = objectTarget.cell.x - from.x; const dy = objectTarget.cell.y - from.y;
      if (Math.abs(dx) >= Math.abs(dy) && dx) preferred.push(dx > 0 ? 'east' : 'west');
      if (dy) preferred.push(dy > 0 ? 'south' : 'north');
    } else if (playerCell && ['avoidPlayer', 'survive', 'returnHome'].includes(goal)) {
      const dx = from.x - playerCell.x; const dy = from.y - playerCell.y;
      if (Math.abs(dx) >= Math.abs(dy) && dx) preferred.push(dx > 0 ? 'east' : 'west');
      if (dy) preferred.push(dy > 0 ? 'south' : 'north');
    } else if (playerCell && ['collectRumors', 'investigate', 'observe', 'socialize', 'protectBrother', 'protectClan', 'protectFather', 'protectDaughter', 'mediate'].includes(goal)) {
      const dx = playerCell.x - from.x; const dy = playerCell.y - from.y;
      if (Math.abs(dx) >= Math.abs(dy) && dx) preferred.push(dx > 0 ? 'east' : 'west');
      if (dy) preferred.push(dy > 0 ? 'south' : 'north');
    }
    const offset = (state.clock + npc.id.length) % localMap.ORDER.length;
    for (let i = 0; i < localMap.ORDER.length; i++) preferred.push(localMap.ORDER[(offset + i) % localMap.ORDER.length]);
    for (const direction of [...new Set(preferred)]) {
      const result = localMap.step(locationId, location, from, direction);
      if (result.kind !== 'step' || occupied.has(`${result.cell.x},${result.cell.y}`)) continue;
      npc.position.cell = result.cell;
      engine.emit(state, 'npc.step', { npcId: npc.id, actorId: npc.id, location: locationId, from, to: { ...result.cell }, direction, goal });
      log(state, 'npc_step', `${npc.identity.name}在${location.name}内向${localMap.DIRECTIONS[direction].label}移动。`, { npcId: npc.id, location: locationId, from, to: { ...result.cell }, goal });
      if (playerCell && localMap.distance(result.cell, playerCell) <= 1) {
        engine.emit(state, 'npc.local_contact', { npcId: npc.id, targetId: 'player', location: locationId, cell: { ...result.cell }, goal });
        remember(state, npc.id, 'player', { kind: 'local-contact', valence: relValence(state, npc.id), text: `在${location.name}内与你擦肩而过。`, facts: { lastLocalContact: state.clock, localContactLocation: locationId } });
      }
      return { from, to: result.cell, direction };
    }
    return null;
  }

  function tick(state, { engine, locations, phase, hour, day, random, clamp, relation, remember, log, relValence, brain, goalAction, localMap, localObjects }) {
    const currentPhase = phase(state);
    for (const npc of engine.queryWith(state, 'identity', 'position', 'needs', 'goals', 'schedule')) {
      if (npc.id === 'player' || !npc.alive || npc.agent) continue;
      npc.needs.energy = clamp(npc.needs.energy - 0.8, 0, 100);
      npc.needs.hunger = clamp(npc.needs.hunger + 0.6, 0, 100);
      if (hour(state) % 4 !== 0) continue;
      const decision = brain?.decide ? brain.decide(state, npc, {
        engine, relation, day, phase, scoreGoal: (world, entity, goal) => goalScore(world, entity, goal, { day, relation }),
        candidates: (world, entity) => goalCandidates(world, entity, { relation }),
        forceGoal: (world, entity) => forcedGoal(world, entity, { relation }),
        childGoal: (world, entity, goal) => goal === 'investigate' && !entity.brain.blackboard.investigationPrepared ? (entity.brain.blackboard.investigationPrepared = true, 'collectRumors') : null
      }) : null;
      const target = decision?.destination || npc.schedule[currentPhase] || npc.position.location;
      const goal = decision?.goal || selectGoal(state, npc, { day, relation });
      npc.goals.active = goal;
      npc.goals.history ||= [];
      npc.goals.history.unshift({ goal, day: day(state), clock: state.clock, status: 'planned' });
      npc.goals.history = npc.goals.history.slice(0, 16);
      if (brain) {
        const frame = brain.topGoal(npc);
        const movement = target && npc.position.location !== target
          ? brain.moveTowards(state, npc, target, engine)
          : { status: 'reached', destination: target, from: npc.position.location, to: npc.position.location };
        if (movement.status === 'moved') {
          log(state, 'npc_move', `${npc.identity.name} 从${locations[movement.from].name}前往${locations[movement.to].name}。`, { npcId: npc.id, goal, destination: target, handler: frame?.instanceId });
          brain.consumeMove(npc.brain, target, false);
        } else if (movement.status === 'blocked') {
          brain.completeGoal(npc, false);
          npc.goals.history[0].status = 'blocked';
        } else {
          brain.consumeMove(npc.brain, target, true);
          const action = brain.takeAction(npc, engine, { state, npc, faction: npc.faction && state.factions[npc.faction] });
          npc.goals.history[0].status = action.status;
          npc.goals.history[0].result = action.result;
          const consequence = goalAction?.(state, npc, goal, { engine, result: action });
          if (consequence?.combatId) npc.goals.history[0].combatId = consequence.combatId;
          if (consequence?.interactionId) npc.goals.history[0].interactionId = consequence.interactionId;
        }
      } else {
        const route = engine.findPath(state.locations, npc.position.location, target);
        const nextStep = route[1];
        if (nextStep) {
          const previous = npc.position.location;
          npc.position.location = nextStep;
          engine.emit(state, 'npc.moved', { npcId: npc.id, from: previous, to: nextStep, destination: target, goal });
          log(state, 'npc_move', `${npc.identity.name} 从${locations[previous].name}前往${locations[nextStep].name}。`, { npcId: npc.id, goal, destination: target });
        }
        const result = engine.runGoal(goal, { state, npc, faction: npc.faction && state.factions[npc.faction] });
        if (npc.position.location === target) npc.goals.history[0].status = result === false ? 'failed' : 'complete';
        const consequence = npc.position.location === target ? goalAction?.(state, npc, goal, { engine, result }) : null;
        if (consequence?.combatId) npc.goals.history[0].combatId = consequence.combatId;
        if (consequence?.interactionId) npc.goals.history[0].interactionId = consequence.interactionId;
      }
      if (localMap && state.clock % 4 === 0 && npc.position.location === state.entities.player.position.location) localStep(state, npc, { engine, localMap, localObjects, locations, relation, remember, log, relValence });
      if (npc.position.location === state.entities.player.position.location && random(state) < 0.12) {
        remember(state, npc.id, 'player', { kind: 'encounter', valence: relValence(state, npc.id), text: `在${locations[npc.position.location].name}再次遇见了你。` });
      }
    }
  }

  return { goalScore, selectGoal, goalCandidates, localStep, tick };
});
