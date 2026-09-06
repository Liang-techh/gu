(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationEngine = factory();
})(globalThis, function () {
  'use strict';

  const COMPONENTS = Object.freeze([
    'identity', 'position', 'faction', 'personality', 'cultivation', 'schedule',
    'goals', 'needs', 'body', 'abilities', 'inventory', 'memory', 'conditions', 'alive'
  ]);
  const goalHandlers = new Map();
  const interactionHandlers = new Map();
  const eventHandlers = new Map();
  const eventListeners = new Map();
  const actionHandlers = new Map();
  const actionHooks = new Map();
  const systemHandlers = new Map();
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
    entity[component] = value;
    return value;
  }

  function detach(entity, component) {
    if (!entity || !component) return undefined;
    const previous = entity[component];
    delete entity[component];
    return previous;
  }

  function patchComponent(entity, component, patch) {
    if (!entity || !component || !patch || typeof patch !== 'object') throw new Error('组件补丁无效');
    if (!entity[component] || typeof entity[component] !== 'object') entity[component] = {};
    Object.assign(entity[component], patch);
    return entity[component];
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
    const event = { id: `ev${state.events.sequence}`, type, clock: state.clock, payload };
    state.events.pending.push(event);
    if (state.events.pending.length > 128) state.events.pending.shift();
    state.events.recent.push(event);
    if (state.events.recent.length > 256) state.events.recent.shift();
    for (const listener of [...(eventListeners.get(type) || []), ...(eventListeners.get('*') || [])]) listener.handler({ state, event });
    return event;
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

  function registerEventListener(type, id, handler) {
    if (!type || !id || typeof handler !== 'function') throw new Error('事件监听器必须有 type、id 和函数');
    const listeners = eventListeners.get(type) || [];
    const next = { id, handler };
    const index = listeners.findIndex(listener => listener.id === id);
    if (index >= 0) listeners[index] = next;
    else listeners.push(next);
    eventListeners.set(type, listeners);
    return handler;
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
    for (const rule of directorRules) if (rule.when(state)) return rule.build(state);
    return null;
  }

  function registries() {
    return {
      goals: [...goalHandlers.keys()],
      interactions: [...interactionHandlers.keys()],
      events: [...eventHandlers.keys()],
      listeners: Object.fromEntries([...eventListeners.entries()].map(([type, listeners]) => [type, listeners.map(listener => listener.id)])),
      actions: [...actionHandlers.keys()],
      actionHooks: Object.fromEntries([...actionHooks.entries()].map(([key, hooks]) => [key, hooks.map(hook => hook.id)])),
      systems: Object.fromEntries([...systemHandlers.entries()].map(([phase, systems]) => [phase, systems.map(system => system.id)])),
      directorRules: directorRules.map(rule => rule.id)
    };
  }

  return { COMPONENTS, has, query, queryWith, attach, detach, patchComponent, findPath, emit, drain, registerGoal, runGoal, registerInteraction, runInteraction, registerEvent, runEvent, registerEventListener, registerAction, registerActionHook, runAction, registerSystem, runSystems, registerDirectorRule, findDirectorEvent, registries };
});
