(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationBody = factory();
})(globalThis, function () {
  'use strict';

  const LIMBS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

  function ensure(entity) {
    entity.body ||= {};
    entity.body.maxHealth = Math.max(1, Number(entity.body.maxHealth) || 60);
    entity.body.health = Number.isFinite(Number(entity.body.health)) ? Number(entity.body.health) : entity.body.maxHealth;
    entity.body.wounds ||= [];
    entity.body.limbs ||= {};
    for (const limb of LIMBS) entity.body.limbs[limb] = Math.max(0, Math.min(100, Number(entity.body.limbs[limb] ?? 100)));
    return entity.body;
  }

  function integrity(entity, limb) {
    return ensure(entity).limbs[limb] ?? 0;
  }

  function disabled(entity, limb, threshold = 20) {
    return integrity(entity, limb) < threshold;
  }

  function canUse(entity, { requiredLimbs = [], minLimbIntegrity = 20 } = {}) {
    ensure(entity);
    return requiredLimbs.every(limb => !disabled(entity, limb, minLimbIntegrity));
  }

  function chooseLimb(entity, roll = Math.random) {
    const limbs = Object.keys(ensure(entity).limbs).filter(limb => Number.isFinite(entity.body.limbs[limb]));
    return limbs[Math.floor(Math.max(0, Math.min(0.999999, roll())) * limbs.length)] || 'torso';
  }

  function applyDamage(entity, { amount, limb, sourceId = null, kind = 'strike', roll = Math.random, clock = 0 } = {}) {
    const body = ensure(entity);
    const damage = Math.max(1, Math.round(Number(amount) || 0));
    const hitLimb = limb || chooseLimb(entity, roll);
    body.health = Math.max(0, body.health - damage);
    body.limbs[hitLimb] = Math.max(0, body.limbs[hitLimb] - Math.round(damage * 0.65));
    body.wounds.unshift({ clock, sourceId, kind, limb: hitLimb, damage });
    body.wounds = body.wounds.slice(0, 12);
    return { damage, limb: hitLimb, health: body.health, died: body.health <= 0, disabled: disabled(entity, hitLimb) };
  }

  function heal(entity, amount, limb = null) {
    const body = ensure(entity);
    const restored = Math.max(0, Number(amount) || 0);
    body.health = Math.min(body.maxHealth, body.health + restored);
    if (limb) body.limbs[limb] = Math.min(100, body.limbs[limb] + restored);
    return body;
  }

  return { LIMBS, ensure, integrity, disabled, canUse, chooseLimb, applyDamage, heal };
});
