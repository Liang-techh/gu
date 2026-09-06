(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationAgency = factory();
})(globalThis, function () {
  'use strict';

  const KINDS = Object.freeze({
    rumor: { label: '打探情报', hours: 4, cost: 2 },
    scout: { label: '侦查地点', hours: 6, cost: 3 },
    trade: { label: '代为交易', hours: 5, cost: 2 },
    influence: { label: '游说势力', hours: 8, cost: 4 }
  });

  function ensure(state) {
    state.agency ||= { commissions: {}, sequence: 0, reputation: 0, completed: 0, failed: 0 };
    state.agency.commissions ||= {};
    state.agency.sequence = Math.max(0, Number(state.agency.sequence) || 0);
    state.agency.reputation = Math.max(-100, Math.min(100, Number(state.agency.reputation) || 0));
    state.agency.completed = Math.max(0, Number(state.agency.completed) || 0);
    state.agency.failed = Math.max(0, Number(state.agency.failed) || 0);
    return state.agency;
  }

  function createRuntime({ engine, locations, random, clamp, relation, remember, log, advance, knowledge }) {
    function activeFor(state, agentId) {
      return Object.values(ensure(state).commissions).filter(item => item.status === 'active' && item.agentId === agentId);
    }

    function recruit(state, p, command) {
      const npc = state.entities[command.target];
      const kind = KINDS[command.kind || 'rumor'];
      if (!npc || npc.id === 'player' || !npc.alive) throw new Error('找不到可委托的 NPC');
      if (npc.position.location !== p.position.location) throw new Error('委托必须在同一地点进行');
      if (npc.agent) throw new Error('这个人正在执行另一份追捕任务');
      if (!kind) throw new Error('未知的委托类型');
      if (activeFor(state, npc.id).length >= 2) throw new Error('这个 NPC 手上的委托已经太多');
      const r = relation(state, 'player', npc.id);
      if ((r.trust || 0) + (r.affinity || 0) - (r.fear || 0) < -5) throw new Error(`${npc.identity.name}不愿意替你办事`);
      if ((p.inventory.stones || 0) < kind.cost) throw new Error(`这份委托至少需要 ${kind.cost} 枚元石`);
      p.inventory.stones -= kind.cost;
      const agency = ensure(state); agency.sequence += 1;
      const id = `commission-${agency.sequence}`;
      const targetLocation = command.location && locations[command.location] ? command.location : p.position.location;
      agency.commissions[id] = { id, agentId: npc.id, requesterId: p.id, kind: command.kind || 'rumor', targetLocation, status: 'active', progress: 0, quality: 0.35 + Math.max(0, r.trust || 0) * 0.01, createdClock: state.clock, dueClock: state.clock + kind.hours, lastClock: state.clock };
      r.debt = (r.debt || 0) + 1; r.trust = (r.trust || 0) + 1;
      remember(state, npc.id, 'player', { kind: 'secret', source: `agency:${id}`, confidence: 0.7, text: `${npc.identity.name}接下了你的${kind.label}委托。`, facts: { activeCommission: id, commissionKind: command.kind || 'rumor' } });
      log(state, 'agency_commission', `你委托${npc.identity.name}${kind.label}，目标地点是${locations[targetLocation]?.name || targetLocation}。`, { commissionId: id, agentId: npc.id, kind: command.kind || 'rumor', targetLocation });
      engine.emit(state, 'agency.commission_created', { commissionId: id, agentId: npc.id, actorId: p.id, kind: command.kind || 'rumor', targetLocation });
      advance(state, 1, 'agency_commission');
      return agency.commissions[id];
    }

    function complete(state, commission, agent) {
      const player = state.entities[commission.requesterId];
      const faction = agent.faction && state.factions[agent.faction];
      const kind = KINDS[commission.kind];
      const roll = random(state) + commission.quality * 0.35 + (agent.personality?.curiosity || 0) / 500;
      const success = roll >= 0.42;
      commission.status = success ? 'completed' : 'failed';
      commission.completedClock = state.clock;
      if (success) {
        state.agency.completed += 1; state.agency.reputation = clamp(state.agency.reputation + 1, -100, 100);
        if (commission.kind === 'rumor') {
          player.cultivation.insight += 2;
          remember(state, player.id, commission.targetLocation, { kind: 'rumor', source: `agency:${commission.id}`, confidence: clamp(commission.quality + 0.25, 0.35, 0.82), provenance: [commission.id, agent.id], text: `${agent.identity.name}带回了${locations[commission.targetLocation]?.name || commission.targetLocation}的消息。`, facts: { agencyRumor: commission.id, scoutedLocation: commission.targetLocation } });
        } else if (commission.kind === 'scout') {
          const zone = state.zones[commission.targetLocation];
          if (zone) { zone.activity += 3; zone.danger = clamp(zone.danger - 2, 0, 100); }
          player.cultivation.insight += 3;
          remember(state, player.id, commission.targetLocation, { kind: 'observation', source: `agency:${commission.id}`, confidence: clamp(commission.quality + 0.35, 0.5, 0.9), provenance: [commission.id, agent.id], text: `${agent.identity.name}完成侦查，带回了关于${locations[commission.targetLocation]?.name || commission.targetLocation}的可靠观察。`, facts: { agencyScout: commission.id, zoneDanger: zone?.danger || 0 } });
        } else if (commission.kind === 'trade') {
          player.inventory.stones += 2; player.inventory.water = (player.inventory.water || 0) + 1;
          if (faction) faction.influence += 0.8;
        } else {
          if (faction) { faction.attitude += 3; faction.tension = Math.max(0, faction.tension - 1); }
          relation(state, 'player', agent.faction || agent.id).trust += 2;
        }
        remember(state, agent.id, player.id, { kind: 'help', source: `agency:${commission.id}`, confidence: 0.78, text: '你完成了这份委托，人情和报酬都记在了关系账上。', facts: { commissionCompleted: commission.id } });
      } else {
        state.agency.failed += 1; state.agency.reputation = clamp(state.agency.reputation - 2, -100, 100); relation(state, 'player', agent.id).trust -= 2;
        remember(state, player.id, agent.id, { kind: 'rumor', source: `agency:${commission.id}`, confidence: 0.35, text: `${agent.identity.name}的委托没有得到可靠结果。`, facts: { commissionFailed: commission.id } });
      }
      log(state, 'agency_result', `${agent.identity.name}${success ? '完成了' : '没能完成'}${kind.label}委托。`, { commissionId: commission.id, agentId: agent.id, kind: commission.kind, result: success ? 'success' : 'failure' });
      engine.emit(state, 'agency.commission_completed', { commissionId: commission.id, agentId: agent.id, actorId: player.id, kind: commission.kind, result: success ? 'success' : 'failure', targetLocation: commission.targetLocation });
    }

    function tick(state) {
      for (const commission of Object.values(ensure(state).commissions)) {
        if (commission.status !== 'active') continue;
        const agent = state.entities[commission.agentId];
        if (!agent?.alive) { commission.status = 'failed'; state.agency.failed += 1; continue; }
        if (state.clock <= commission.lastClock) continue;
        const kind = KINDS[commission.kind];
        const hours = state.clock - commission.lastClock;
        commission.lastClock = state.clock;
        if (agent.position.location === commission.targetLocation) commission.progress += hours * (agent.needs.energy > 20 ? 1 : 0.4);
        else {
          const route = engine.findPath(locations, agent.position.location, commission.targetLocation);
          if (route[1]) agent.position.location = route[1];
          commission.progress += hours * 0.25;
        }
        if (commission.progress >= kind.hours) complete(state, commission, agent);
      }
    }

    return { KINDS, ensure, recruit, tick };
  }

  return { KINDS, createRuntime };
});
