(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationCombat = factory();
})(globalThis, function () {
  'use strict';

  // Qud analogue: combat is a reusable interaction between Body/Effect parts,
  // not a branch that only the player can enter. Player duels, environmental
  // damage, offline conflicts and active NPC attacks all pass through this
  // runtime so memories and events cannot drift apart.
  function ensure(state) {
    state.combatLedger ||= { sequence: 0, exchanges: [], lastPairClock: {} };
    state.combatLedger.exchanges ||= [];
    state.combatLedger.lastPairClock ||= {};
    state.combatLedger.sequence = Math.max(0, Number(state.combatLedger.sequence) || 0);
    return state.combatLedger;
  }

  function createRuntime({ engine, body, condition, effect, remember, log, consequence, relation, random }) {
    function find(state, id) { return state.entities?.[id] || state.entityCache?.[id] || null; }
    function name(entity) { return entity?.identity?.name || entity?.id || '某个实体'; }
    function pairKey(a, b) { return [a, b].sort().join('::'); }

    function damage(state, targetId, amount, sourceId, kind = 'strike') {
      const target = find(state, targetId);
      if (!target?.body || !target.alive) return 0;
      const result = body.applyDamage(target, { amount, sourceId, kind, roll: () => random(state), clock: state.clock });
      const { damage: applied, limb } = result;
      condition.apply(target, 'wounded', { duration: 24, intensity: applied, source: sourceId, clock: state.clock });
      effect.apply(target, 'wound', { duration: 24, intensity: applied, source: sourceId, clock: state.clock, state, stackable: true, data: { limb, kind } });
      engine.emit(state, 'combat.damage', { targetId, sourceId, kind, limb, damage: applied, limbIntegrity: body.integrity(target, limb), disabled: result.disabled });
      remember(state, targetId, sourceId, { kind: 'injury', valence: -applied, text: `${limb}处留下了新的伤势。` });
      log(state, 'damage', `${name(target)} 受到 ${applied} 点${kind === 'gu' ? '蛊术' : '伤害'}。`, { targetId, sourceId, limb, damage: applied, disabled: result.disabled });
      if (result.died) {
        target.alive = false;
        log(state, 'death', `${name(target)} 倒下了。`, { targetId, sourceId });
        if (targetId === state.playerId && state.entities?.player?.cultivation) state.entities.player.cultivation.vitality = 0;
      }
      return applied;
    }

    function attack(state, attackerId, targetId, { kind = 'npc_strike', power, reason = 'autonomous', location = null } = {}) {
      const attacker = find(state, attackerId);
      const target = find(state, targetId);
      if (!attacker?.alive || !target?.alive || attackerId === targetId) return false;
      if (attacker.position?.location !== target.position?.location) return false;
      const here = location || attacker.position?.location || null;
      const ledger = ensure(state);
      const key = pairKey(attackerId, targetId);
      if (Number(ledger.lastPairClock[key]) === Number(state.clock)) return false;
      const damageAmount = Math.max(1, Number(power) || (6 + (attacker.cultivation?.rank || 1) * 3 + (attacker.personality?.ambition || 0) * 0.04));
      const event = engine.emit(state, 'combat.started', { attackerId, defenderId: targetId, kind, location: here, autonomous: attackerId !== state.playerId, reason });
      if (relation) relation(state, attackerId, targetId).fear += attackerId === state.playerId ? 2 : 0.5;
      remember(state, targetId, attackerId, { kind: 'conflict', valence: -4, text: `${name(attacker)}在${here || '当前区域'}对你出手。`, facts: { attackedBy: attackerId } });
      const applied = damage(state, targetId, damageAmount, attackerId, kind);
      ledger.sequence += 1;
      const exchange = {
        id: `combat-${ledger.sequence}`,
        eventId: event.id,
        attackerId,
        targetId,
        location: here,
        kind,
        damage: applied,
        killed: target.alive === false,
        clock: state.clock,
        reason
      };
      ledger.exchanges.unshift(exchange);
      ledger.exchanges = ledger.exchanges.slice(0, 128);
      ledger.lastPairClock[key] = state.clock;
      if (exchange.killed) {
        if (target.faction && state.factions?.[target.faction]) state.factions[target.faction].tension = Math.min(100, (Number(state.factions[target.faction].tension) || 0) + 4);
        consequence?.(state, { kind: 'npc_kill', actorId: attackerId, targetId, factionId: target.faction || null, source: 'combat.attack', location: here, reason: `${name(attacker)}在${here || '当前区域'}击倒了${name(target)}。`, data: { combatId: exchange.id }, tension: 0.8, pressure: 0.2 });
      }
      engine.emit(state, 'combat.exchange', exchange);
      return { ok: true, ...exchange };
    }

    function chooseOpponent(state, actor, { engine: queryEngine = engine, includePlayer = false } = {}) {
      const candidates = queryEngine.query(state, entity => entity.id !== actor.id && entity.alive && entity.position?.location === actor.position?.location && (includePlayer || entity.id !== state.playerId) && entity.faction && actor.faction && entity.faction !== actor.faction);
      return candidates.sort((a, b) => {
        const ar = Number(relation?.(state, actor.id, a.id)?.trust || 0);
        const br = Number(relation?.(state, actor.id, b.id)?.trust || 0);
        return ar - br || a.id.localeCompare(b.id);
      })[0] || null;
    }

    function npcAttack(state, actor, { engine: queryEngine = engine, goal = 'ambush', includePlayer = false } = {}) {
      if (!actor?.brain?.blackboard) return false;
      const last = Number(actor.brain.blackboard.lastCombatClock);
      if (Number.isFinite(last) && state.clock - last < 8) return false;
      const target = chooseOpponent(state, actor, { engine: queryEngine, includePlayer });
      if (!target) return false;
      const result = attack(state, actor.id, target.id, { kind: goal === 'ambush' ? 'npc_ambush' : 'npc_strike', reason: goal, location: actor.position.location });
      if (result) actor.brain.blackboard.lastCombatClock = state.clock;
      return result;
    }

    return { ensure, damage, attack, chooseOpponent, npcAttack };
  }

  return { ensure, createRuntime };
});
