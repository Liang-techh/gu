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

  function createRuntime({ engine, body, condition, effect, remember, log, consequence, relation, random, ability, guSeeds, clamp, advance }) {
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

    function exchange(state, attackerId, targetId, { kind = 'npc_strike', power, reason = 'autonomous', location = null, emitStarted = true, updateFear = true } = {}) {
      const attacker = find(state, attackerId);
      const target = find(state, targetId);
      if (!attacker?.alive || !target?.alive || attackerId === targetId) return false;
      if (attacker.position?.location !== target.position?.location) return false;
      const here = location || attacker.position?.location || null;
      const ledger = ensure(state);
      const key = pairKey(attackerId, targetId);
      if (Number(ledger.lastPairClock[key]) === Number(state.clock)) return false;
      const damageAmount = Math.max(1, Number(power) || (6 + (attacker.cultivation?.rank || 1) * 3 + (attacker.personality?.ambition || 0) * 0.04));
      const event = emitStarted ? engine.emit(state, 'combat.started', { attackerId, defenderId: targetId, kind, location: here, autonomous: attackerId !== state.playerId, reason }) : null;
      if (relation && updateFear) relation(state, attackerId, targetId).fear += attackerId === state.playerId ? 2 : 0.5;
      if (emitStarted) remember(state, targetId, attackerId, { kind: 'conflict', valence: -4, text: `${name(attacker)}在${here || '当前区域'}对你出手。`, facts: { attackedBy: attackerId } });
      const applied = damage(state, targetId, damageAmount, attackerId, kind);
      ledger.sequence += 1;
      const exchange = {
        id: `combat-${ledger.sequence}`,
        eventId: event?.id || null,
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

    function attack(state, attackerId, targetId, options = {}) {
      return exchange(state, attackerId, targetId, options);
    }

    function playerAction(state, command) {
      const combat = state.combat;
      const player = state.entities?.[state.playerId];
      if (!combat || !player) throw new Error('当前没有冲突');
      const target = find(state, combat.defender);
      if (!target?.alive) { state.combat = null; return { ok: true, ended: true, reason: 'target_defeated' }; }
      const id = command.id;
      let playerDamage = 0;
      let playerGuard = false;
      if (id === 'attack') {
        playerDamage = 10 + (player.cultivation?.rank || 1) * 4 + (player.cultivation?.insight || 0) * 0.25;
      } else if (id === 'gu') {
        if (!ability || !guSeeds) throw new Error('蛊术运行时未注册');
        const used = ability.activate(player, command.guId || 'moonlight', guSeeds, body);
        engine.emit(state, 'ability.used', { actorId: player.id, abilityId: used.id, location: player.position?.location, cost: used.cost, kind: used.kind });
        log(state, 'ability_used', `你催动${used.name}，消耗 ${used.cost} 点真元。`, { abilityId: used.id, cost: used.cost, targetId: target.id });
        playerDamage = 6 + used.power + (player.cultivation?.rank || 1) * 5;
      } else if (id === 'guard') {
        playerGuard = true;
      } else if (id === 'flee') {
        const limit = clamp || ((value, min, max) => Math.max(min, Math.min(max, value)));
        const chance = limit(0.35 + ((player.needs?.energy || 0) / 250) - (target.cultivation?.rank || 1) * 0.04, 0.1, 0.85);
        if (random(state) < chance) {
          state.combat = null;
          log(state, 'combat_escape', '你脱离了冲突，但这段关系不会因此恢复原状。');
          advance?.(state, 1, 'combat');
          return { ok: true, escaped: true };
        }
        log(state, 'combat_escape_failed', '你试图脱身，却被对方逼回原地。');
      } else throw new Error('未知冲突动作');

      const exchangeResult = playerDamage
        ? exchange(state, player.id, target.id, { kind: id === 'gu' ? 'gu' : 'strike', power: playerDamage, reason: 'player_turn', location: player.position?.location, emitStarted: false, updateFear: false })
        : null;
      if (!target.alive) {
        if (relation) relation(state, player.id, target.id).fear += 25;
        if (target.faction && state.factions?.[target.faction]) state.factions[target.faction].tension += 8;
        state.combat = null;
        advance?.(state, 1, 'combat');
        return { ok: true, exchange: exchangeResult, ended: true };
      }
      const targetPower = 6 + (target.cultivation?.rank || 1) * 4 + (target.personality?.ambition || 0) * 0.04;
      damage(state, player.id, playerGuard ? targetPower * 0.35 : targetPower, target.id, 'npc_strike');
      player.needs.energy -= 5;
      combat.round += 1;
      if (!player.alive) state.combat = null;
      advance?.(state, 1, 'combat');
      return { ok: true, exchange: exchangeResult, ended: !state.combat };
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

    return { ensure, damage, exchange, attack, playerAction, chooseOpponent, npcAttack };
  }

  return { ensure, createRuntime };
});
