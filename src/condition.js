(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationCondition = factory();
})(globalThis, function () {
  'use strict';

  function ensure(entity) {
    entity.conditions ||= { active: [] };
    entity.conditions.active ||= [];
    return entity.conditions;
  }

  function apply(entity, id, { duration = 1, intensity = 1, source = null, clock = 0 } = {}) {
    if (!entity || !id) throw new Error('状态效果需要实体和 id');
    const conditions = ensure(entity);
    const current = conditions.active.find(item => item.id === id);
    if (current) {
      current.duration = Math.max(current.duration, duration);
      current.intensity = Math.max(current.intensity, intensity);
      current.source = source ?? current.source;
      current.updatedAt = clock;
      return current;
    }
    const next = { id, duration: Math.max(1, Number(duration) || 1), intensity: Math.max(0, Number(intensity) || 0), source, appliedAt: clock, updatedAt: clock };
    conditions.active.push(next);
    return next;
  }

  function has(entity, id) { return !!entity?.conditions?.active?.some(item => item.id === id); }
  function get(entity, id) { return entity?.conditions?.active?.find(item => item.id === id) || null; }
  function remove(entity, id) {
    if (!entity?.conditions?.active) return false;
    const before = entity.conditions.active.length;
    entity.conditions.active = entity.conditions.active.filter(item => item.id !== id);
    return before !== entity.conditions.active.length;
  }

  function tick(entity, amount = 1) {
    if (!entity?.conditions?.active) return [];
    const expired = [];
    for (const item of entity.conditions.active) {
      item.duration -= amount;
      if (item.duration <= 0) expired.push(item.id);
    }
    entity.conditions.active = entity.conditions.active.filter(item => item.duration > 0);
    return expired;
  }

  return { ensure, apply, has, get, remove, tick };
});
