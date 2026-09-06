(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuGoals = factory();
})(globalThis, function () {
  'use strict';

  // Gu-specific GoalHandlers. The Brain/GoalHandler runtime stays content
  // agnostic; this package turns the novel's people, rivalries and resources
  // into world mutations registered at boot.
  function register({ engine, locations, clamp, relation, remember, log, factionPacts, affordances, localObjects }) {
    function nearbyObject(state, npc, predicate) {
      return localObjects?.visible(state, npc)
        .filter(object => predicate(object) && localObjects && Math.abs((object.cell?.x || 0) - (npc.position.cell?.x || 0)) + Math.abs((object.cell?.y || 0) - (npc.position.cell?.y || 0)) <= 1)
        .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
    }

    function recordNpcDiscovery(state, npc, result, mode) {
      const object = result.object;
      const zone = state.zones[npc.position.location];
      zone.discoveries ||= [];
      if (!zone.discoveries.some(item => item.objectId === object.id)) zone.discoveries.unshift({ objectId: object.id, kind: object.kind, label: object.label, actorId: npc.id, clock: state.clock });
      if (object.clue?.fact) {
        state.facts[object.clue.fact] = true;
        state.intel ||= { leads: [], cases: {} };
        const leadId = `local:${npc.position.location}:${object.id}`;
        if (!state.intel.leads.some(lead => lead.id === leadId)) state.intel.leads.unshift({ id: leadId, type: object.clue.kind || object.kind, location: npc.position.location, objectId: object.id, confidence: Number(object.clue.confidence || 0.5), clock: state.clock, status: 'open', discoveredBy: npc.id });
      }
      engine.emit(state, `local.object_${mode}`, { actorId: npc.id, location: npc.position.location, objectId: object.id, kind: object.kind, discovered: object.discovered, resolved: object.resolved });
      remember(state, npc.id, 'world', { kind: mode === 'follow' ? 'trace-followed' : 'local-clue', valence: 1, text: `${npc.identity.name}在${locations[npc.position.location].name}处理了${object.label}。`, facts: { [`localObject:${object.id}`]: true } });
      return object;
    }

    engine.registerGoal('secureResources', ({ state, npc, faction }) => {
      const object = nearbyObject(state, npc, item => item.kind === 'resource' && item.remaining > 0);
      if (object) {
        const result = localObjects.interact(state, npc, object.id, 'gather');
        const resourceId = object.resourceId || 'food';
        npc.inventory ||= {};
        npc.inventory[resourceId] = (npc.inventory[resourceId] || 0) + result.amount;
        const zone = state.zones[npc.position.location];
        if (zone.resources && resourceId in zone.resources) zone.resources[resourceId] = Math.max(0, zone.resources[resourceId] - result.amount);
        if (faction) faction.influence += 0.55;
        engine.emit(state, 'local.resource_gathered', { actorId: npc.id, location: npc.position.location, objectId: object.id, resourceId, amount: result.amount });
        log(state, 'npc_local_object', `${npc.identity.name}在${locations[npc.position.location].name}采集了${object.label}。`, { npcId: npc.id, objectId: object.id, goal: 'secureResources' });
        return true;
      }
      const result = affordances?.executeForActor('forage', state, npc);
      if (!result) return false;
      if (faction) faction.influence += 0.4;
      engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'secureResources', location: npc.position.location, faction: npc.faction });
      log(state, 'npc_goal_action', `${npc.identity.name}为了资源在${locations[npc.position.location].name}搜寻。`, { npcId: npc.id, goal: 'secureResources' });
      return true;
    });
    engine.registerGoal('findRelic', ({ state, npc }) => {
      const object = nearbyObject(state, npc, item => ['trace', 'relic', 'clue'].includes(item.kind) && item.active && !item.resolved);
      if (object) {
        const mode = object.discovered ? 'follow' : 'inspect';
        const result = localObjects.interact(state, npc, object.id, mode);
        recordNpcDiscovery(state, npc, result, mode);
        state.facts.relicInterest = (state.facts.relicInterest || 0) + 1;
        state.director.pressure = clamp(state.director.pressure + 0.35, 0, 10);
        log(state, 'npc_local_object', `${npc.identity.name}${mode === 'follow' ? '沿着' : '调查了'}${object.label}。`, { npcId: npc.id, objectId: object.id, goal: 'findRelic', mode });
        return true;
      }
      const result = affordances?.executeForActor('searchRelic', state, npc);
      if (!result) return false;
      state.facts.relicInterest = (state.facts.relicInterest || 0) + 1;
      state.director.pressure = clamp(state.director.pressure + 0.4, 0, 10);
      remember(state, npc.id, 'world', { kind: 'secret', valence: 2, text: '竹林深处的遗藏并不只吸引一个人。', facts: { relicInterest: true } });
      engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'findRelic', location: npc.position.location, fact: 'relicInterest' });
      log(state, 'npc_goal_action', `${npc.identity.name}在追查一条关于遗藏的线索。`, { npcId: npc.id, goal: 'findRelic' });
      return true;
    });
    engine.registerGoal('winRivalry', ({ state, npc }) => {
      if (npc.position.location !== 'academy') return false;
      state.factions.guYue.tension += 0.7;
      relation(state, npc.id, 'fangzheng').affinity -= 1;
      engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'winRivalry', location: npc.position.location, faction: npc.faction });
      log(state, 'npc_goal_action', `${npc.identity.name}在学堂争取表现，竞争压力上升。`, { npcId: npc.id, goal: 'winRivalry' });
      return true;
    });
    engine.registerGoal('trade', ({ state, npc, faction }) => {
      if (!['caravanCamp', 'village'].includes(npc.position.location)) return false;
      if (faction) faction.influence += 0.6;
      state.facts.marketActivity = (state.facts.marketActivity || 0) + 1;
      engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'trade', location: npc.position.location, faction: npc.faction });
      log(state, 'npc_goal_action', `${npc.identity.name}完成了一次交易，商路继续流动。`, { npcId: npc.id, goal: 'trade' });
      return true;
    });
    engine.registerGoal('protectBrother', ({ state }) => {
      relation(state, 'fangzheng', 'fangyuan').trust += 0.4;
      remember(state, 'fangzheng', 'fangyuan', { kind: 'family', valence: 1, text: '你仍然把方源视作需要证明自己的兄长。' });
      return true;
    });
    engine.registerGoal('avoidPlayer', ({ state, npc }) => {
      npc.needs.safety = clamp(npc.needs.safety + 2, 0, 100);
      remember(state, npc.id, 'player', { kind: 'avoidance', valence: -1, text: '你暂时不想和这个人再次碰面。' });
      return true;
    });
    engine.registerGoal('findFood', ({ state, npc }) => {
      const zone = state.zones[npc.position.location];
      if (!zone?.resources.food) return false;
      zone.resources.food -= 1;
      npc.needs.hunger = clamp(npc.needs.hunger - 18, 0, 100);
      zone.activity += 2;
      engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'findFood', location: npc.position.location });
      return true;
    });
    engine.registerGoal('gainRecognition', ({ state, npc, faction }) => {
      if (faction) faction.influence += 0.3;
      state.director.pressure = clamp(state.director.pressure + 0.1, 0, 10);
      remember(state, npc.id, 'world', { kind: 'ambition', valence: 1, text: `${npc.identity.name}在压力上升时选择争取存在感。` });
      return true;
    });
    engine.registerGoal('prepareAlliance', ({ state, npc }) => {
      state.facts.allianceInterest = (state.facts.allianceInterest || 0) + 1;
      if (npc.faction === 'guYue') { state.factions.guYue.relations.bai = (state.factions.guYue.relations.bai || 0) + 0.2; const pact = factionPacts?.upsert(state, ['guYue', 'bai'], { day: Math.floor(state.clock / 24) + 1, source: 'npcAlliancePreparation', legitimacy: 32, cohesion: 28, supply: 26 }); if (pact) { pact.legitimacy += 0.4; pact.obligations.guYue = Math.max(0, (pact.obligations.guYue || 0) - 0.1); } }
      return true;
    });
    return ['secureResources', 'findRelic', 'winRivalry', 'trade', 'protectBrother', 'avoidPlayer', 'findFood', 'gainRecognition', 'prepareAlliance'];
  }

  return { register };
});
