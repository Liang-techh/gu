(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationBrain = factory();
})(globalThis, function () {
  'use strict';

  // This is the simulation-side analogue of Qud's Brain + GoalHandler stack:
  // perception is materialized first, then a scored decision becomes an
  // inspectable plan, and only the plan's next step is consumed by the turn.
  function ensure(entity) {
    entity.brain ||= { mode: 'idle', stack: [], plan: [], perceptions: [], blackboard: {}, lastDecision: null, decisions: [] };
    entity.brain.stack ||= [];
    entity.brain.plan ||= [];
    entity.brain.perceptions ||= [];
    entity.brain.blackboard ||= {};
    entity.brain.decisions ||= [];
    return entity.brain;
  }

  function perceive(state, npc, { engine, relation, day }) {
    const brain = ensure(npc);
    const location = npc.position?.location;
    const zone = state.zones?.[location] || null;
    const nearby = engine.query(state, entity => entity.id !== npc.id && entity.alive && entity.position?.location === location)
      .map(entity => {
        const rel = relation ? relation(state, npc.id, entity.id) : {};
        return { id: entity.id, faction: entity.faction, role: entity.identity?.role, distance: 0, trust: rel.trust || 0, fear: rel.fear || 0, alive: entity.alive };
      });
    const threats = nearby.filter(item => item.fear >= 10 || (state.entities[item.id]?.conditions?.active || []).some(condition => condition.id === 'afraid'));
    const perception = {
      clock: state.clock,
      day: day(state),
      location,
      zone: zone ? { danger: zone.danger, activity: zone.activity, resources: { ...zone.resources } } : null,
      nearby: nearby.slice(0, 24),
      threats: threats.slice(0, 12),
      faction: npc.faction ? { id: npc.faction, tension: state.factions?.[npc.faction]?.tension || 0, attitude: state.factions?.[npc.faction]?.attitude || 0 } : null,
      market: state.market ? { prices: { ...state.market.prices }, supply: { ...state.market.supply }, demand: { ...state.market.demand } } : null,
      needs: { ...npc.needs },
      memoryCount: Object.keys(npc.memory?.facts || {}).length
    };
    brain.perceptions.unshift(perception);
    brain.perceptions = brain.perceptions.slice(0, 8);
    brain.blackboard.lastPerceptionClock = state.clock;
    brain.blackboard.nearbyIds = nearby.map(item => item.id);
    return perception;
  }

  function candidates(npc) {
    return [...new Set([...(npc.goals?.queue || []), 'findFood', 'avoidPlayer', 'survive', 'gainRecognition'])];
  }

  function decide(state, npc, context) {
    const brain = ensure(npc);
    const perception = perceive(state, npc, context);
    const goals = context.candidates ? context.candidates(state, npc, context) : candidates(npc);
    const scores = goals.map(goal => ({ goal, score: Number(context.scoreGoal(state, npc, goal, context)) || 0 }));
    scores.sort((a, b) => b.score - a.score || a.goal.localeCompare(b.goal));
    const forced = context.forceGoal ? context.forceGoal(state, npc, context) : null;
    const selected = forced || scores[0]?.goal || 'idle';
    const destination = npc.schedule?.[context.phase(state)] || npc.position?.location;
    const plan = [];
    if (destination && destination !== npc.position.location) plan.push({ type: 'move', destination, status: 'pending' });
    plan.push({ type: 'goal', goal: selected, status: 'pending' });
    const decision = { clock: state.clock, day: context.day(state), goal: selected, forced: !!forced, destination, scores, perception: { location: perception.location, nearby: perception.nearby.length, threats: perception.threats.length, danger: perception.zone?.danger || 0 } };
    brain.mode = 'acting';
    brain.current = decision;
    brain.stack = [{ id: selected, status: 'active', createdClock: state.clock, destination }];
    brain.plan = plan;
    brain.lastDecision = decision;
    brain.decisions.unshift(decision);
    brain.decisions = brain.decisions.slice(0, 16);
    return decision;
  }

  function consumeMove(brain, destination, reached) {
    if (!brain?.plan?.length) return;
    const step = brain.plan[0];
    if (step.type !== 'move' || step.destination !== destination) return;
    if (reached) brain.plan.shift();
    else step.status = 'active';
  }

  function completeGoal(entity, result) {
    const brain = ensure(entity);
    if (brain.plan?.[0]?.type === 'goal') brain.plan.shift();
    if (brain.stack?.[0]) brain.stack[0].status = result === false ? 'failed' : 'complete';
    brain.mode = brain.plan.length ? 'acting' : 'idle';
    brain.blackboard.lastResult = result === false ? 'failed' : 'complete';
  }

  return { ensure, perceive, candidates, decide, consumeMove, completeGoal };
});
