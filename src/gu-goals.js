(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuGoals = factory();
})(globalThis, function () {
  'use strict';

  // Gu-specific GoalHandlers. The Brain/GoalHandler runtime stays content
  // agnostic; this package turns the novel's people, rivalries and resources
  // into world mutations registered at boot.
  function register({ engine, locations, clamp, relation, remember, log, factionPacts }) {
    engine.registerGoal('secureResources', ({ state, npc, faction }) => {
      if (!['bambooForest', 'riverbank'].includes(npc.position.location)) return false;
      const zone = state.zones[npc.position.location];
      if (zone?.resources.moonPetal > 0) { zone.resources.moonPetal -= 1; npc.inventory.moonPetal = (npc.inventory.moonPetal || 0) + 1; }
      if (zone) zone.activity += 4;
      if (faction) faction.influence += 0.4;
      engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'secureResources', location: npc.position.location, faction: npc.faction });
      log(state, 'npc_goal_action', `${npc.identity.name}为了资源在${locations[npc.position.location].name}搜寻。`, { npcId: npc.id, goal: 'secureResources' });
      return true;
    });
    engine.registerGoal('findRelic', ({ state, npc }) => {
      if (!['bambooForest', 'riverbank', 'cliffCave'].includes(npc.position.location)) return false;
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
