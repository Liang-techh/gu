(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGoalHandler = factory();
})(globalThis, function () {
  'use strict';

  // Qud analogue: a GoalHandler is a resumable stack frame, not a label on
  // the NPC. It can own children, wait for movement, take an action, and then
  // return control to its parent or the next decision.
  function create(goal, options = {}) {
    const clock = Number(options.createdClock) || 0;
    const ordinal = Number(options.ordinal) || 0;
    return {
      id: goal,
      instanceId: options.instanceId || `${goal}@${clock}@${ordinal}`,
      parentId: options.parentId || null,
      status: options.status || 'active',
      phase: options.phase || 'start',
      destination: options.destination || null,
      child: null,
      createdClock: clock,
      lastActionClock: null,
      attempts: 0,
      result: null,
      metadata: { ...(options.metadata || {}) }
    };
  }

  function ensure(brain) {
    brain.stack ||= [];
    brain.stack = brain.stack.map((frame, index) => typeof frame === 'string'
      ? create(frame, { ordinal: index })
      : { ...create(frame.id || 'idle', frame), ...frame, metadata: { ...(frame.metadata || {}) } });
    return brain.stack;
  }

  function top(brain) {
    ensure(brain);
    return brain.stack.at(-1) || null;
  }

  function clear(brain) {
    ensure(brain).length = 0;
    return brain;
  }

  function pushGoal(brain, goal, options = {}) {
    const parent = top(brain);
    const stack = ensure(brain);
    const frame = create(goal, {
      ...options,
      ordinal: stack.length,
      parentId: options.parentId || parent?.instanceId || null
    });
    const currentParent = stack.at(-1);
    if (currentParent && !currentParent.child) currentParent.child = frame.instanceId;
    stack.push(frame);
    return frame;
  }

  function pushChildGoal(brain, goal, options = {}) {
    return pushGoal(brain, goal, options);
  }

  function insertGoalAsParent(brain, goal, options = {}) {
    const stack = ensure(brain);
    const previous = stack.pop();
    const parent = create(goal, { ...options, ordinal: stack.length });
    if (previous) {
      parent.child = previous.instanceId;
      previous.parentId = parent.instanceId;
    }
    stack.push(parent);
    if (previous) stack.push(previous);
    return parent;
  }

  function pop(brain, result = true) {
    const stack = ensure(brain);
    const frame = stack.pop();
    if (!frame) return null;
    frame.status = result === false ? 'failed' : 'complete';
    frame.phase = 'done';
    frame.result = result;
    const parent = top(brain);
    if (parent) {
      parent.child = null;
      parent.phase = result === false ? 'recover' : 'resume';
    }
    return frame;
  }

  function finished(brain) {
    const stack = ensure(brain);
    return stack.length === 0 || stack.every(frame => ['complete', 'failed'].includes(frame.status));
  }

  function moveTowards(state, npc, destination, engine) {
    if (!destination || npc.position?.location === destination) return { status: 'reached', from: destination, to: destination, destination };
    const route = engine.findPath(state.locations, npc.position.location, destination);
    if (route.length < 2) return { status: 'blocked', from: npc.position.location, to: null, destination };
    const from = npc.position.location;
    const to = route[1];
    npc.position.location = to;
    engine.emit(state, 'npc.moved', { npcId: npc.id, from, to, destination, goal: top(npc.brain)?.id || null });
    return { status: 'moved', from, to, destination };
  }

  function takeAction(brain, engine, context) {
    const frame = top(brain);
    if (!frame) return { status: 'idle', result: false };
    frame.attempts += 1;
    frame.lastActionClock = context.state.clock;
    frame.phase = 'action';
    const result = engine.runGoal(frame.id, context);
    if (result === false) {
      pop(brain, false);
      return { status: 'failed', result: false, frame };
    }
    pop(brain, result === undefined ? true : result);
    return { status: 'complete', result: result === undefined ? true : result, frame };
  }

  function serialize(brain) {
    return ensure(brain).map(frame => ({ ...frame, metadata: { ...(frame.metadata || {}) } }));
  }

  return { create, ensure, top, clear, pushGoal, pushChildGoal, insertGoalAsParent, pop, finished, moveTowards, takeAction, serialize };
});
