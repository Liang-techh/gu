(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationEngine = factory();
})(globalThis, function () {
  'use strict';

  const COMPONENTS = Object.freeze([
    'identity', 'position', 'faction', 'personality', 'cultivation', 'schedule',
    'goals', 'needs', 'body', 'abilities', 'inventory', 'memory', 'knowledge', 'conditions', 'effects', 'brain', 'agent', 'alive'
  ]);
  const goalHandlers = new Map();
  const interactionHandlers = new Map();
  const eventHandlers = new Map();
  const eventListeners = new Map();
  const actionHandlers = new Map();
  const actionHooks = new Map();
  const systemHandlers = new Map();
  const componentDefinitions = new Map();
  const componentEventHandlers = new Map();
  const initializedComponents = new WeakMap();
  const directorRules = [];

  function has(entity, ...names) {
    return !!entity && names.every(name => entity[name] !== undefined && entity[name] !== null);
  }

  function query(state, predicate = () => true) {
    return Object.values(state.entities || {}).filter(predicate);
  }

  function queryWith(state, ...components) {
    return query(state, entity => has(entity, ...components));
  }

  function attach(entity, component, value) {
    if (!entity || !component) throw new Error('组件附着需要实体和名称');
    const definition = componentDefinitions.get(component);
    const next = definition?.onAttach ? definition.onAttach({ entity, component, value }) ?? value : value;
    entity[component] = next;
    return next;
  }

  function detach(entity, component) {
    if (!entity || !component) return undefined;
    const previous = entity[component];
    componentDefinitions.get(component)?.onDetach?.({ entity, component, value: previous });
    delete entity[component];
    return previous;
  }

  function patchComponent(entity, component, patch) {
    if (!entity || !component || !patch || typeof patch !== 'object') throw new Error('组件补丁无效');
    if (!entity[component] || typeof entity[component] !== 'object') entity[component] = {};
    Object.assign(entity[component], patch);
    componentDefinitions.get(component)?.onPatch?.({ entity, component, value: entity[component], patch });
    return entity[component];
  }

  function registerComponent(id, definition = {}) {
    if (!id || typeof definition !== 'object') throw new Error('组件定义必须有名称和对象');
    componentDefinitions.set(id, { ...definition, id });
    for (const [type, spec] of Object.entries(definition.events || {})) {
      const event = typeof spec === 'function' ? { handler: spec } : spec;
      if (event?.handler) registerComponentEvent(id, type, event.id || `${id}:${type}`, event.handler, event.priority, event.phase);
    }
    if (typeof definition.onEvent === 'function') registerComponentEvent(id, '*', `${id}:onEvent`, definition.onEvent, definition.eventPriority, definition.eventPhase);
    return componentDefinitions.get(id);
  }

  function registerComponentEvent(component, type, id, handler, priority = 0, phase = 'resolve') {
    if (!component || !type || !id || typeof handler !== 'function') throw new Error('组件事件监听器必须有组件、事件、名称和函数');
    if (!['before', 'resolve', 'after'].includes(phase)) throw new Error('组件事件阶段必须是 before、resolve 或 after');
    const byType = componentEventHandlers.get(component) || new Map();
    const listeners = byType.get(type) || [];
    const next = { id, handler, priority: Number(priority) || 0, phase };
    const index = listeners.findIndex(listener => listener.id === id && listener.phase === phase);
    if (index >= 0) listeners[index] = next;
    else listeners.push(next);
    byType.set(type, listeners);
    componentEventHandlers.set(component, byType);
    return handler;
  }

  function initializeComponents(state) {
    for (const entity of Object.values(state.entities || {})) {
      const initialized = initializedComponents.get(entity) || new Set();
      for (const definition of componentDefinitions.values()) {
        if (typeof definition.ensure === 'function') definition.ensure(entity, state);
        if (entity[definition.id] !== undefined && !initialized.has(definition.id)) {
          definition.onInitialize?.({ state, entity, component: definition.id, value: entity[definition.id] });
          initialized.add(definition.id);
        }
      }
      initializedComponents.set(entity, initialized);
    }
    return state;
  }

  function serializeEntity(entity) {
    const output = JSON.parse(JSON.stringify(entity));
    for (const definition of componentDefinitions.values()) {
      if (entity[definition.id] === undefined || typeof definition.serialize !== 'function') continue;
      const value = definition.serialize({ entity, component: definition.id, value: entity[definition.id] });
      if (value !== undefined) output[definition.id] = value;
    }
    return output;
  }

  function serializeState(state) {
    const output = JSON.parse(JSON.stringify(state));
    for (const [id, entity] of Object.entries(state.entities || {})) output.entities[id] = serializeEntity(entity);
    output.entityCache ||= {};
    for (const [id, entity] of Object.entries(state.entityCache || {})) output.entityCache[id] = serializeEntity(entity);
    return output;
  }

  function deserializeState(state) {
    for (const entity of [...Object.values(state.entities || {}), ...Object.values(state.entityCache || {})]) {
      for (const definition of componentDefinitions.values()) {
        if (entity[definition.id] === undefined || typeof definition.deserialize !== 'function') continue;
        const value = definition.deserialize({ state, entity, component: definition.id, value: entity[definition.id] });
        if (value !== undefined) entity[definition.id] = value;
        definition.onLoad?.({ state, entity, component: definition.id, value: entity[definition.id] });
      }
    }
    return initializeComponents(state);
  }

  function findPath(locations, from, to) {
    if (!locations?.[from] || !locations?.[to]) return [];
    if (from === to) return [from];
    const queue = [from];
    const previous = { [from]: null };
    while (queue.length) {
      const current = queue.shift();
      for (const next of locations[current].neighbors || []) {
        if (previous[next] !== undefined) continue;
        previous[next] = current;
        if (next === to) {
          const path = [to];
          let cursor = to;
          while (previous[cursor] !== null) { cursor = previous[cursor]; path.unshift(cursor); }
          return path;
        }
        queue.push(next);
      }
    }
    return [];
  }

  function emit(state, type, payload = {}) {
    state.events ||= { active: null, pending: [], history: [] };
    state.events.pending ||= [];
    state.events.recent ||= [];
    state.events.sequence = (Number(state.events.sequence) || 0) + 1;
    const event = { id: `ev${state.events.sequence}`, type, clock: state.clock, payload, phase: 'dispatch', phases: [], status: 'open', handled: false, cancelled: false, consumed: false };
    state.events.pending.push(event);
    if (state.events.pending.length > 128) state.events.pending.shift();
    state.events.recent.push(event);
    if (state.events.recent.length > 256) state.events.recent.shift();
    const runPhase = phase => {
      event.phase = phase;
      event.phases.push(phase);
      const listeners = [...(eventListeners.get(type) || []), ...(eventListeners.get('*') || [])]
        .filter(listener => listener.phase === phase)
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
      const componentListeners = [];
      for (const [entityId, entity] of Object.entries(state.entities || {})) {
        for (const definition of componentDefinitions.values()) {
          if (entity[definition.id] === undefined) continue;
          const byType = componentEventHandlers.get(definition.id);
          if (!byType) continue;
          for (const listener of [...(byType.get(type) || []), ...(byType.get('*') || [])]) {
            if (listener.phase !== phase) continue;
            componentListeners.push({ ...listener, id: `${entityId}:${definition.id}:${listener.id}`, component: definition.id, entityId, entity, handler: listener.handler });
          }
        }
      }
      const allListeners = [...listeners, ...componentListeners].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
      for (const listener of allListeners) {
        if (phase !== 'after' && event.cancelled) break;
        const result = listener.handler({ state, event, phase, entity: listener.entity, entityId: listener.entityId, component: listener.component, value: listener.entity?.[listener.component] });
        if (result === true) event.handled = true;
        if (result === false || result?.cancelled) { event.cancelled = true; event.status = 'cancelled'; }
        if (result?.consumed) { event.consumed = true; event.status = 'consumed'; }
      }
    };
    runPhase('before');
    if (!event.cancelled) runPhase('resolve');
    runPhase('after');
    if (event.cancelled) event.status = 'cancelled';
    else if (event.consumed) event.status = 'consumed';
    else event.status = 'settled';
    event.phase = 'settled';
    return event;
  }

  function registerEventListener(type, id, handler, priority = 0, phase = 'resolve') {
    if (!type || !id || typeof handler !== 'function') throw new Error('事件监听器必须有 type、id 和函数');
    if (!['before', 'resolve', 'after'].includes(phase)) throw new Error('事件阶段必须是 before、resolve 或 after');
    const listeners = eventListeners.get(type) || [];
    const next = { id, handler, priority: Number(priority) || 0, phase };
    const index = listeners.findIndex(listener => listener.id === id && listener.phase === phase);
    if (index >= 0) listeners[index] = next;
    else listeners.push(next);
    eventListeners.set(type, listeners);
    return handler;
  }

  function registerEventPhaseListener(phase, type, id, handler, priority = 0) {
    return registerEventListener(type, id, handler, priority, phase);
  }

  /*
   * Kept here as a comment marker for the event state machine: all listeners
   * are now phase-filtered above, so the old single-pass dispatcher cannot
   * accidentally execute a resolve rule during before/after settlement.
   */
  function legacyEventListenerRegistration(type, id, handler, priority = 0) {
    return registerEventListener(type, id, handler, priority, 'resolve');
  }

  function drain(state, consumer = () => {}) {
    const pending = state.events?.pending || [];
    while (pending.length) consumer(pending.shift());
  }

  function registerGoal(id, handler) {
    if (!id || typeof handler !== 'function') throw new Error('目标处理器必须有名称和函数');
    goalHandlers.set(id, handler);
    return handler;
  }

  function runGoal(id, context) {
    const handler = goalHandlers.get(id);
    return handler ? handler(context) : false;
  }

  function registerInteraction(id, handler) {
    if (!id || typeof handler !== 'function') throw new Error('交互处理器必须有名称和函数');
    interactionHandlers.set(id, handler);
    return handler;
  }

  function runInteraction(id, context) {
    const handler = interactionHandlers.get(id);
    return handler ? handler(context) : false;
  }

  function registerEvent(id, handler) {
    if (!id || typeof handler !== 'function') throw new Error('事件处理器必须有名称和函数');
    eventHandlers.set(id, handler);
    return handler;
  }

  function runEvent(id, context) {
    const handler = eventHandlers.get(id);
    return handler ? handler(context) : false;
  }

  function registerAction(id, handler) {
    if (!id || typeof handler !== 'function') throw new Error('动作处理器必须有 id 和函数');
    actionHandlers.set(id, handler);
    return handler;
  }

  function registerActionHook(phase, actionId, id, handler) {
    if (!['before', 'after'].includes(phase) || !actionId || !id || typeof handler !== 'function') throw new Error('动作钩子必须有阶段、动作、名称和函数');
    const key = `${phase}:${actionId}`;
    const hooks = actionHooks.get(key) || [];
    const next = { id, handler };
    const index = hooks.findIndex(hook => hook.id === id);
    if (index >= 0) hooks[index] = next;
    else hooks.push(next);
    actionHooks.set(key, hooks);
    return handler;
  }

  function runAction(id, context) {
    const handler = actionHandlers.get(id);
    if (!handler) return { handled: false, result: false };
    const before = [...(actionHooks.get(`before:${id}`) || []), ...(actionHooks.get('before:*') || [])];
    for (const hook of before) if (hook.handler(context) === false) return { handled: true, result: false, blocked: true, blockedBy: hook.id };
    const result = handler(context);
    const after = [...(actionHooks.get(`after:${id}`) || []), ...(actionHooks.get('after:*') || [])];
    for (const hook of after) hook.handler({ ...context, result });
    return { handled: true, result };
  }

  function registerSystem(phase, id, handler, priority = 0) {
    if (!phase || !id || typeof handler !== 'function') throw new Error('系统必须有 phase、id 和函数');
    const systems = systemHandlers.get(phase) || [];
    const next = { id, handler, priority };
    const index = systems.findIndex(system => system.id === id);
    if (index >= 0) systems[index] = next;
    else systems.push(next);
    systems.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    systemHandlers.set(phase, systems);
    return handler;
  }

  function runSystems(phase, context) {
    return (systemHandlers.get(phase) || []).map(system => ({ id: system.id, result: system.handler(context) }));
  }

  function registerDirectorRule(rule) {
    if (!rule?.id || typeof rule.when !== 'function' || typeof rule.build !== 'function') throw new Error('导演规则必须有 id、when 和 build');
    const index = directorRules.findIndex(item => item.id === rule.id);
    if (index >= 0) directorRules[index] = rule;
    else directorRules.push(rule);
    directorRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return rule;
  }

  function findDirectorEvent(state) {
    return findDirectorEvents(state)[0]?.event || null;
  }

  function findDirectorEvents(state) {
    const candidates = [];
    for (const rule of directorRules) if (rule.when(state)) candidates.push({ rule, event: rule.build(state) });
    return candidates;
  }

  function registries() {
    return {
      goals: [...goalHandlers.keys()],
      interactions: [...interactionHandlers.keys()],
      events: [...eventHandlers.keys()],
      listeners: Object.fromEntries([...eventListeners.entries()].map(([type, listeners]) => [type, listeners.map(listener => listener.id)])),
      listenerPhases: Object.fromEntries([...eventListeners.entries()].map(([type, listeners]) => [type, listeners.map(listener => ({ id: listener.id, phase: listener.phase, priority: listener.priority }))])),
      components: Object.fromEntries([...componentDefinitions.entries()].map(([id, definition]) => [id, { lifecycle: ['ensure', 'onAttach', 'onDetach', 'onPatch', 'onInitialize', 'onLoad', 'serialize', 'deserialize'].filter(name => typeof definition[name] === 'function'), events: Object.fromEntries([...(componentEventHandlers.get(id)?.entries() || [])].map(([type, listeners]) => [type, listeners.map(listener => ({ id: listener.id, phase: listener.phase, priority: listener.priority }))])) }])),
      actions: [...actionHandlers.keys()],
      actionHooks: Object.fromEntries([...actionHooks.entries()].map(([key, hooks]) => [key, hooks.map(hook => hook.id)])),
      systems: Object.fromEntries([...systemHandlers.entries()].map(([phase, systems]) => [phase, systems.map(system => system.id)])),
      directorRules: directorRules.map(rule => rule.id)
    };
  }

  return { COMPONENTS, has, query, queryWith, attach, detach, patchComponent, registerComponent, registerComponentEvent, initializeComponents, serializeEntity, serializeState, deserializeState, findPath, emit, drain, registerGoal, runGoal, registerInteraction, runInteraction, registerEvent, runEvent, registerEventListener, registerEventPhaseListener, legacyEventListenerRegistration, registerAction, registerActionHook, runAction, registerSystem, runSystems, registerDirectorRule, findDirectorEvents, findDirectorEvent, registries };
});
