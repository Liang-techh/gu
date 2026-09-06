(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationEquipment = factory();
})(globalThis, function () {
  'use strict';

  function ensure(entity) {
    if (!entity) throw new Error('装备部件需要实体');
    entity.equipment ||= { slots: {}, history: [] };
    entity.equipment.slots ||= {};
    entity.equipment.history ||= [];
    return entity.equipment;
  }

  function definition(definitions, itemId) {
    return definitions?.[itemId] || null;
  }

  function equipped(entity, itemId) {
    return Object.values(ensure(entity).slots).find(item => item.itemId === itemId) || null;
  }

  function canUse(entity, itemId, definitions, body) {
    const def = definition(definitions, itemId);
    if (!def) return false;
    if (def.requiredLimbs?.length && body && !body.canUse(entity, { requiredLimbs: def.requiredLimbs, minLimbIntegrity: def.minLimbIntegrity || 20 })) return false;
    return true;
  }

  function equip(entity, itemId, definitions, body, clock = 0) {
    const def = definition(definitions, itemId);
    if (!def) throw new Error(`未知装备：${itemId}`);
    const rack = ensure(entity);
    if (equipped(entity, itemId)) return equipped(entity, itemId);
    if (def.guId && !entity.inventory?.gu?.[def.guId]?.refined) throw new Error(`尚未炼化${def.label || def.guId}`);
    if (!canUse(entity, itemId, definitions, body)) throw new Error(`${def.label || itemId}所需的身体部位当前不可用`);
    const slot = def.slot || 'body';
    const occupied = rack.slots[slot];
    if (occupied) throw new Error(`${slot}部位已经装备了${occupied.itemId}`);
    const item = { itemId, slot, equippedAt: Number(clock) || 0, requiredLimbs: [...(def.requiredLimbs || [])] };
    rack.slots[slot] = item;
    rack.history.unshift({ ...item, action: 'equip' });
    rack.history = rack.history.slice(0, 32);
    return item;
  }

  function unequip(entity, itemId, definitions, clock = 0) {
    const rack = ensure(entity);
    const slot = Object.keys(rack.slots).find(key => rack.slots[key]?.itemId === itemId);
    if (!slot) return null;
    const previous = rack.slots[slot];
    delete rack.slots[slot];
    rack.history.unshift({ ...previous, action: 'unequip', clock: Number(clock) || 0 });
    rack.history = rack.history.slice(0, 32);
    return previous;
  }

  function modifiers(entity, definitions) {
    const result = {};
    for (const item of Object.values(ensure(entity).slots)) {
      for (const [key, value] of Object.entries(definition(definitions, item.itemId)?.modifiers || {})) result[key] = (result[key] || 0) + Number(value || 0);
    }
    return result;
  }

  return { ensure, equipped, canUse, equip, unequip, modifiers };
});
