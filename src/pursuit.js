(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationPursuit = factory();
})(globalThis, function () {
  'use strict';

  function ensure(state) {
    state.pursuit ||= { teams: {}, sequence: 0, alert: 0, contacts: 0 };
    state.pursuit.teams ||= {};
    state.pursuit.sequence = Math.max(0, Number(state.pursuit.sequence) || 0);
    state.pursuit.alert = Math.max(0, Math.min(100, Number(state.pursuit.alert) || 0));
    state.pursuit.contacts = Math.max(0, Number(state.pursuit.contacts) || 0);
    return state.pursuit;
  }

  function createRuntime({ engine, createEntity, locations, random, clamp, relation, remember, log, advance, knowledge }) {
    function activeTeams(state, targetId = null) {
      return Object.values(ensure(state).teams).filter(team => team.status === 'active' && (!targetId || team.targetId === targetId));
    }

    function spawnAgent(state, team, role, location, rank) {
      const agentId = `${team.id}-${role}`;
      const faction = state.factions[team.factionId];
      const agent = createEntity(agentId, {
        name: role === 'leader' ? `${faction?.name || '势力'}追查使` : `${faction?.name || '势力'}线人`,
        role: role === 'leader' ? '追捕队首领' : '追踪探子',
        faction: team.factionId,
        location,
        cultivation: { rank, stage: 1, aptitude: 0.62 },
        personality: { ambition: 62, caution: 82, loyalty: 76, greed: 48, curiosity: 92 },
        schedule: { morning: location, afternoon: location, evening: location, night: location },
        goals: ['investigate', 'patrol', 'ambush']
      });
      engine.attach(agent, 'agent', { teamId: team.id, targetId: team.targetId, role, clueConfidence: team.clueConfidence, lastSeenClock: -1, contacts: 0 });
      state.entities[agentId] = agent;
      team.members.push(agentId);
      remember(state, agentId, team.targetId, { kind: 'suspicion', source: `pursuit:${team.id}`, confidence: team.clueConfidence, text: '你接到了一份关于目标行动轨迹的追查委托。', facts: { pursuitTarget: team.targetId, pursuitTeam: team.id } });
      return agent;
    }

    function createTeam(state, { factionId, targetId = 'player', location, reason = 'intel', strength = 1 }) {
      const p = ensure(state);
      const existing = activeTeams(state, targetId).find(team => team.factionId === factionId);
      if (existing) {
        existing.clueConfidence = clamp(existing.clueConfidence + 0.08, 0, 1);
        existing.heat = clamp(existing.heat + 2, 0, 100);
        return existing;
      }
      const target = state.entities[targetId];
      if (!target) throw new Error(`追捕目标不存在：${targetId}`);
      const faction = state.factions[factionId];
      if (!faction) throw new Error(`追捕势力不存在：${factionId}`);
      p.sequence += 1;
      const id = `pursuit-${p.sequence}`;
      const targetLocation = target.position.location;
      const origin = location || state.locations[targetLocation]?.neighbors?.[0] || targetLocation;
      const team = {
        id, factionId, targetId, reason, status: 'active', origin, location: origin,
        members: [], clueConfidence: clamp(0.4 + Number(strength) * 0.08, 0.2, 0.95),
        progress: 0, heat: clamp(8 + Number(strength) * 4, 0, 100), contacts: 0,
        createdClock: state.clock, lastActionClock: state.clock, lastLeadClock: state.clock
      };
      p.teams[id] = team;
      spawnAgent(state, team, 'leader', origin, 3 + Math.min(2, Number(strength) || 0));
      if (Number(strength) >= 2) spawnAgent(state, team, 'scout', origin, 2);
      engine.emit(state, 'pursuit.created', { teamId: id, factionId, targetId, location: origin, reason });
      log(state, 'pursuit_created', `${faction.name}派出追捕队，开始追查${target.identity.name}。`, { teamId: id, factionId, targetId, reason });
      return team;
    }

    function stepToward(state, agent, targetLocation) {
      const route = engine.findPath(state.locations, agent.position.location, targetLocation);
      if (route.length < 2) return false;
      const from = agent.position.location;
      agent.position.location = route[1];
      agent.agent.lastActionClock = state.clock;
      engine.emit(state, 'pursuit.moved', { agentId: agent.id, teamId: agent.agent.teamId, from, to: route[1], targetId: agent.agent.targetId });
      return true;
    }

    function contact(state, team, agent, target) {
      const targetKnowledge = knowledge.ensure(target);
      const mask = targetKnowledge.masks?.[targetKnowledge.activeMask];
      const maskStrength = Number(mask?.strength || 100);
      const clue = clamp(team.clueConfidence + agent.agent.clueConfidence - maskStrength * 0.004 + team.heat * 0.002, 0.05, 0.95);
      const detected = random(state) < clamp(0.15 + clue * 0.55, 0.12, 0.88);
      team.contacts += 1; agent.agent.contacts += 1; agent.agent.lastSeenClock = state.clock; team.lastActionClock = state.clock;
      state.pursuit.contacts += 1;
      if (detected) {
        team.progress = clamp(team.progress + 9, 0, 100); team.clueConfidence = clamp(team.clueConfidence + 0.06, 0, 1); state.pursuit.alert = clamp(state.pursuit.alert + 8, 0, 100);
        knowledge.raiseSuspicion(agent, target.id, 10, { clock: state.clock, reason: 'pursuit_contact' });
        remember(state, agent.id, target.id, { kind: 'suspicion', source: `pursuit:${team.id}:contact`, confidence: clue, provenance: [`pursuit:${team.id}`], text: `追捕队在${state.locations[target.position.location]?.name || '当前区域'}确认了你的行动痕迹。`, facts: { lastSeenLocation: target.position.location, pursuitDetected: true } });
        log(state, 'pursuit_contact', `${agent.identity.name}在${state.locations[target.position.location]?.name || '当前区域'}捕捉到你的行动痕迹。`, { teamId: team.id, agentId: agent.id, detected: true, clue });
      } else {
        team.progress = clamp(team.progress + 2, 0, 100); team.clueConfidence = clamp(team.clueConfidence - 0.04, 0.08, 1);
        log(state, 'pursuit_contact', `你在${state.locations[target.position.location]?.name || '当前区域'}甩开了${agent.identity.name}的视线。`, { teamId: team.id, agentId: agent.id, detected: false, clue });
      }
      engine.emit(state, 'pursuit.contact', { teamId: team.id, agentId: agent.id, targetId: target.id, location: target.position.location, detected, progress: team.progress, clueConfidence: team.clueConfidence });
    }

    function tick(state) {
      for (const [targetId, caseState] of Object.entries(state.intel?.cases || {})) {
        if (caseState.pressure < 15 || !state.entities[targetId] || targetId === 'world') continue;
        for (const [factionId, factionCase] of Object.entries(caseState.factions || {})) {
          if (factionCase.pressure >= 15 && !activeTeams(state, targetId).some(team => team.factionId === factionId)) createTeam(state, { factionId, targetId, reason: 'case_pressure', strength: Math.floor(factionCase.pressure / 18) });
        }
      }
      for (const team of activeTeams(state)) {
        const target = state.entities[team.targetId];
        if (!target || !target.alive) { team.status = 'closed'; continue; }
        if (state.clock % 4 !== 0) continue;
        team.location = target.position.location;
        for (const agentId of team.members) {
          const agent = state.entities[agentId];
          if (!agent?.alive || !agent.agent) continue;
          agent.agent.clueConfidence = team.clueConfidence;
          if (agent.position.location !== target.position.location) stepToward(state, agent, target.position.location);
          if (agent.position.location === target.position.location) contact(state, team, agent, target);
        }
        if (team.progress >= 100) { team.status = 'exhausted'; team.heat = Math.max(0, team.heat - 10); }
      }
      state.pursuit.alert = clamp(state.pursuit.alert - 0.15, 0, 100);
    }

    function contactAction(state, p, command) {
      const team = activeTeams(state, p.id).find(candidate => candidate.members.some(agentId => state.entities[agentId]?.position.location === p.position.location));
      if (!team) throw new Error('当前没有可直接交涉的追捕队');
      const agent = state.entities[team.members.find(agentId => state.entities[agentId]?.position.location === p.position.location)];
      const mode = command.mode || 'mislead';
      if (mode === 'bribe') {
        if ((p.inventory.stones || 0) < 3) throw new Error('收买追捕队至少需要 3 枚元石');
        p.inventory.stones -= 3; team.progress = Math.max(0, team.progress - 18); team.clueConfidence = clamp(team.clueConfidence - 0.12, 0.05, 1); team.heat = Math.max(0, team.heat - 8); relation(state, 'player', team.factionId).debt += 1;
        remember(state, agent.id, p.id, { kind: 'rumor', source: `pursuit:${team.id}:bribe`, confidence: 0.35, text: '你收下了元石，暂时把这条线索压回了关系网。', facts: { bribeAccepted: true } });
        log(state, 'pursuit_action', `你用元石收买了${agent.identity.name}，追捕队的线索暂时变得模糊。`, { teamId: team.id, mode });
      } else if (mode === 'mislead') {
        if (p.cultivation.insight < 2) throw new Error('误导追捕队至少需要 2 点洞察');
        p.cultivation.insight -= 2; team.progress = Math.max(0, team.progress - 12); team.clueConfidence = clamp(team.clueConfidence - 0.2, 0.05, 1); team.heat = clamp(team.heat + 3, 0, 100);
        const neighbor = state.locations[p.position.location]?.neighbors?.[0];
        if (neighbor) for (const agentId of team.members) if (state.entities[agentId]) state.entities[agentId].position.location = neighbor;
        log(state, 'pursuit_action', `你放出一条假线索，把${agent.identity.name}引向${state.locations[neighbor]?.name || '远方'}。`, { teamId: team.id, mode, destination: neighbor });
      } else if (mode === 'confront') {
        team.heat = clamp(team.heat + 12, 0, 100); state.pursuit.alert = clamp(state.pursuit.alert + 12, 0, 100); relation(state, 'player', team.factionId).fear += 5;
        log(state, 'pursuit_action', `你没有避让，直接向${agent.identity.name}发出警告。`, { teamId: team.id, mode });
      } else throw new Error('未知的追捕队交涉方式');
      engine.emit(state, 'pursuit.action', { teamId: team.id, agentId: agent.id, actorId: p.id, mode, location: p.position.location, progress: team.progress, clueConfidence: team.clueConfidence });
      advance(state, 2, 'pursuit_action');
    }

    return { ensure, activeTeams, createTeam, tick, contactAction };
  }

  return { createRuntime };
});
