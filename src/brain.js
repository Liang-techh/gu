(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./goal-handler.js'));
  else root.GuSimulationBrain = factory(root.GuSimulationGoalHandler);
})(globalThis, function (GoalHandler) {
  'use strict';

  if (!GoalHandler) throw new Error('GuSimulationGoalHandler must load before brain.js');

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
    GoalHandler.ensure(entity.brain);
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
    const current = GoalHandler.top(brain);
    const resume = current && !['complete', 'failed'].includes(current.status);
    const selected = resume ? current.id : forced || scores[0]?.goal || 'idle';
    const destination = resume ? (current.destination || npc.schedule?.[context.phase(state)] || npc.position?.location) : (npc.schedule?.[context.phase(state)] || npc.position?.location);
    const childGoal = !resume && context.childGoal ? context.childGoal(state, npc, selected, context) : null;
    const executionGoal = childGoal || selected;
    const plan = resume && brain.plan?.length ? brain.plan.map(step => ({ ...step })) : [];
    if (!plan.length) {
      if (destination && destination !== npc.position.location) plan.push({ type: 'move', destination, status: 'pending' });
      plan.push({ type: 'goal', goal: executionGoal, status: 'pending' });
    }
    const decision = { clock: state.clock, day: context.day(state), goal: selected, executionGoal, childGoal: childGoal || null, forced: !!forced, destination, scores, plan: plan.map(step => ({ ...step })), perception: { location: perception.location, nearby: perception.nearby.length, threats: perception.threats.length, danger: perception.zone?.danger || 0 } };
    brain.mode = 'acting';
    brain.current = decision;
    if (!resume) {
      GoalHandler.clear(brain);
      GoalHandler.pushGoal(brain, selected, { createdClock: state.clock, destination, metadata: { source: forced ? 'forced' : 'scored' } });
      if (childGoal) GoalHandler.pushChildGoal(brain, childGoal, { createdClock: state.clock, destination, metadata: { source: 'precondition', parent: selected } });
    } else {
      current.destination = destination;
      current.phase = current.phase === 'start' ? 'running' : current.phase;
    }
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
    const completed = GoalHandler.top(brain) ? GoalHandler.pop(brain, result !== false) : null;
    if (completed && !brain.stack.length) brain.stack = [{ ...completed, status: completed.status }];
    brain.mode = brain.plan.length ? 'acting' : 'idle';
    brain.blackboard.lastResult = result === false ? 'failed' : 'complete';
  }

  function pushGoal(entity, goal, options) { return GoalHandler.pushGoal(ensure(entity), goal, options); }
  function pushChildGoal(entity, goal, options) { return GoalHandler.pushChildGoal(ensure(entity), goal, options); }
  function insertGoalAsParent(entity, goal, options) { return GoalHandler.insertGoalAsParent(ensure(entity), goal, options); }
  function topGoal(entity) { return GoalHandler.top(ensure(entity)); }
  function takeAction(entity, engine, context) {
    const brain = ensure(entity);
    const result = GoalHandler.takeAction(brain, engine, context);
    if (brain.plan?.[0]?.type === 'goal') brain.plan.shift();
    if (result.frame && !brain.stack.length) brain.stack = [{ ...result.frame, status: result.status === 'failed' ? 'failed' : 'complete' }];
    brain.mode = brain.stack.length ? 'acting' : 'idle';
    brain.blackboard.lastResult = result.result === false ? 'failed' : 'complete';
    return result;
  }
  function moveTowards(state, entity, destination, engine) { return GoalHandler.moveTowards(state, entity, destination, engine); }

  return { ensure, perceive, candidates, decide, consumeMove, completeGoal, pushGoal, pushChildGoal, insertGoalAsParent, topGoal, takeAction, moveTowards, goalHandler: GoalHandler };
});
