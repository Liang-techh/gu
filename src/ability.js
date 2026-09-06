(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationAbility = factory();
})(globalThis, function () {
  'use strict';

  function ensure(entity) {
    entity.abilities ||= {};
    entity.abilities.gu ||= [];
    entity.abilities.skills ||= [];
    return entity.abilities;
  }

  function learn(entity, guId) {
    const abilities = ensure(entity);
    if (!abilities.gu.includes(guId)) abilities.gu.push(guId);
    return abilities;
  }

  function ready(entity, guId) {
    const inventoryGu = entity.inventory?.gu?.[guId];
    return !!inventoryGu?.refined || ensure(entity).gu.includes(guId);
  }

  function activate(entity, guId, seeds) {
    const seed = seeds[guId];
    if (!seed) throw new Error(`未知蛊虫能力：${guId}`);
    if (!ready(entity, guId)) throw new Error(`尚未炼化${seed.name}`);
    const cost = Math.max(1, Number(seed.cost) || 8);
    if ((entity.cultivation.essence || 0) < cost) throw new Error(`催动${seed.name}需要至少 ${cost} 点真元`);
    entity.cultivation.essence -= cost;
    return { id: guId, name: seed.name, cost, power: Number(seed.power) || 1, kind: seed.kind || 'mortal', rank: seed.rank || 1 };
  }

  return { ensure, learn, ready, activate };
});
