(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationEffect = factory();
})(globalThis, function () {
  'use strict';

  const definitions = new Map();

  function ensure(entity) {
    if (!entity) throw new Error('效果架需要实体');
    entity.effects ||= { active: [], sequence: 0 };
    entity.effects.active ||= [];
    entity.effects.sequence ||= 0;
    return entity.effects;
  }

  function register(id, definition = {}) {
    if (!id || typeof definition !== 'object') throw new Error('效果定义必须有 id 和对象');
    definitions.set(id, { ...definition, id });
    return definitions.get(id);
  }

  function definitionFor(effect) {
    return definitions.get(effect?.kind || effect?.id) || null;
  }

  function normalizeDuration(value) {
    if (value === Infinity) return Infinity;
    return Math.max(1, Number(value) || 1);
  }

  function apply(entity, kind, options = {}) {
    if (!entity || !kind) throw new Error('效果需要实体和 kind');
    const rack = ensure(entity);
    const definition = definitions.get(kind);
    const stackable = options.stackable ?? definition?.stackable ?? false;
    const current = !stackable ? rack.active.find(item => item.kind === kind || item.id === kind) : null;
    const clock = Number(options.clock) || 0;
    const duration = normalizeDuration(options.duration);
    const intensity = Math.max(0, Number(options.intensity) || 0);

    if (current) {
      current.duration = current.duration === Infinity || duration === Infinity ? Infinity : Math.max(current.duration, duration);
      current.intensity = Math.max(current.intensity, intensity);
      current.source = options.source ?? current.source;
      current.updatedAt = clock;
      current.data = { ...(current.data || {}), ...(options.data || {}) };
      definition?.onRefresh?.({ entity, effect: current, state: options.state, options });
      return current;
    }

    rack.sequence += 1;
    const effect = {
      id: stackable ? `${kind}#${rack.sequence}` : kind,
      kind,
      duration,
      intensity,
      source: options.source ?? null,
      appliedAt: clock,
      updatedAt: clock,
      data: { ...(options.data || {}) }
    };
    rack.active.push(effect);
    definition?.onApply?.({ entity, effect, state: options.state, options });
    return effect;
  }

  function has(entity, kind) {
    return !!entity?.effects?.active?.some(item => item.kind === kind || item.id === kind);
  }

  function get(entity, kind) {
    return entity?.effects?.active?.find(item => item.kind === kind || item.id === kind) || null;
  }

  function remove(entity, kind, context = {}) {
    if (!entity?.effects?.active) return [];
    const removed = entity.effects.active.filter(item => item.kind === kind || item.id === kind);
    entity.effects.active = entity.effects.active.filter(item => item.kind !== kind && item.id !== kind);
    for (const effect of removed) definitionFor(effect)?.onRemove?.({ entity, effect, ...context });
    return removed;
  }

  function tick(entity, state, amount = 1) {
    if (!entity?.effects?.active) return [];
    const expired = [];
    for (const effect of [...entity.effects.active]) {
      const definition = definitionFor(effect);
      definition?.onTick?.({ entity, effect, state, amount });
      if (effect.duration !== Infinity) effect.duration -= amount;
      effect.updatedAt = Number(state?.clock) || effect.updatedAt || 0;
      if (effect.duration <= 0) expired.push(effect);
    }
    for (const effect of expired) {
      entity.effects.active = entity.effects.active.filter(item => item !== effect);
      definitionFor(effect)?.onExpire?.({ entity, effect, state });
    }
    return expired;
  }

  function clear(entity, state) {
    const rack = ensure(entity);
    const removed = [...rack.active];
    for (const effect of removed) definitionFor(effect)?.onRemove?.({ entity, effect, state });
    rack.active = [];
    return removed;
  }

  function registry() {
    return Object.fromEntries([...definitions.entries()].map(([id, definition]) => [id, { id, stackable: !!definition.stackable }]));
  }

  return { ensure, register, apply, has, get, remove, tick, clear, registry };
});
