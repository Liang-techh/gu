(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationDefaultGoals = factory();
})(globalThis, function () {
  'use strict';

  const DEFAULT_GOALS = {
    study: ({ npc }) => { npc.cultivation.insight += 0.4; npc.cultivation.progress += 0.3; },
    proveWorth: ({ npc, faction }) => { npc.cultivation.progress += 0.5; if (faction) faction.influence += 0.2; },
    observe: ({ state, npc }) => { npc.cultivation.insight += 0.2; state.facts.observationCount = (state.facts.observationCount || 0) + 1; },
    hideKnowledge: ({ state, npc, remember }) => { state.facts.hiddenKnowledge = (state.facts.hiddenKnowledge || 0) + 1; remember(state, npc.id, 'world', { kind: 'secret', valence: 0, text: `${npc.identity.name}把关键知识留在心里，没有立刻公开。` }); },
    findTalents: ({ state, npc }) => { state.facts.talentSearch = (state.facts.talentSearch || 0) + 1; npc.cultivation.insight += 0.3; },
    socialize: ({ state, npc, remember }) => { state.facts.socialActivity = (state.facts.socialActivity || 0) + 1; remember(state, npc.id, 'world', { kind: 'social', valence: 0.5, text: `${npc.identity.name}在当前区域维持关系网络。` }); },
    collectRumors: ({ state, npc, remember }) => { const count = state.facts.rumors?.length || 0; remember(state, npc.id, 'world', { kind: 'rumor', valence: 0.5, text: `${npc.identity.name}从关系网中整理了${count}条近期传闻。`, facts: { lastRumorCount: count } }); },
    auction: ({ state, npc, faction }) => { state.facts.auctionActivity = (state.facts.auctionActivity || 0) + 1; if (faction) faction.influence += 0.2; npc.cultivation.insight += 0.2; },
    investigate: ({ state, npc, remember }) => { state.facts.investigationActivity = (state.facts.investigationActivity || 0) + 1; remember(state, npc.id, 'world', { kind: 'investigation', valence: 0.5, text: `${npc.identity.name}继续整理当前区域的线索。` }); },
    recruit: ({ state, faction }) => { state.facts.recruitmentActivity = (state.facts.recruitmentActivity || 0) + 1; if (faction) faction.influence += 0.25; },
    work: ({ state, npc }) => { const zone = state.zones[npc.position.location]; if (zone) zone.activity += 1; state.facts.workActivity = (state.facts.workActivity || 0) + 1; },
    returnHome: ({ state, npc }) => { state.facts.homewardMoves = (state.facts.homewardMoves || 0) + 1; npc.needs.safety = Math.min(100, npc.needs.safety + 0.5); },
    travel: ({ state }) => { state.facts.travelActivity = (state.facts.travelActivity || 0) + 1; },
    hunt: ({ state, npc }) => { const zone = state.zones[npc.position.location]; if (zone?.resources?.food > 0) { zone.resources.food -= 1; npc.needs.hunger = Math.max(0, npc.needs.hunger - 10); } },
    forage: ({ state, npc }) => { const zone = state.zones[npc.position.location]; if (zone?.resources?.food > 0) { zone.resources.food -= 0.5; npc.needs.hunger = Math.max(0, npc.needs.hunger - 6); } },
    drink: ({ state, npc }) => { const zone = state.zones[npc.position.location]; if (zone?.resources?.water > 0) { zone.resources.water -= 0.5; npc.needs.hunger = Math.max(0, npc.needs.hunger - 3); } },
    guard: ({ state, npc }) => { const zone = state.zones[npc.position.location]; if (zone) { zone.danger = Math.max(0, zone.danger - 0.4); zone.activity += 0.5; } },
    patrol: ({ state, npc }) => { const zone = state.zones[npc.position.location]; if (zone) { zone.danger = Math.max(0, zone.danger - 0.6); zone.activity += 1; } },
    maintainOrder: ({ state, faction }) => { if (faction) faction.tension = Math.max(0, faction.tension - 0.25); state.director.pressure = Math.max(0, state.director.pressure - 0.02); },
    protectClan: ({ faction }) => { if (faction) { faction.influence += 0.15; faction.tension = Math.max(0, faction.tension - 0.1); } },
    protectFather: ({ npc }) => { npc.needs.safety = Math.min(100, npc.needs.safety + 0.8); },
    protectDaughter: ({ npc }) => { npc.needs.safety = Math.min(100, npc.needs.safety + 0.8); },
    prepareWar: ({ state, faction }) => { state.facts.warPreparation = (state.facts.warPreparation || 0) + 1; if (faction) { faction.influence += 0.2; faction.tension += 0.1; } },
    healWounded: ({ state, npc }) => { npc.needs.energy = Math.min(100, npc.needs.energy + 1); state.facts.healingActivity = (state.facts.healingActivity || 0) + 1; },
    mediate: ({ state, faction }) => { state.facts.mediationActivity = (state.facts.mediationActivity || 0) + 1; if (faction) faction.tension = Math.max(0, faction.tension - 0.3); },
    train: ({ npc }) => { npc.cultivation.progress += 0.6; npc.needs.energy = Math.max(0, npc.needs.energy - 1); },
    ambush: ({ state, npc, faction }) => { const zone = state.zones[npc.position.location]; if (zone) { zone.danger += 0.8; zone.activity += 1.2; } if (faction) faction.tension += 0.2; },
    survive: ({ npc }) => { npc.needs.safety = Math.min(100, npc.needs.safety + 0.4); }
  };

  function register({ engine, remember }) {
    for (const [id, handler] of Object.entries(DEFAULT_GOALS)) engine.registerGoal(id, context => handler({ ...context, remember }));
    return Object.keys(DEFAULT_GOALS);
  }

  return { DEFAULT_GOALS, register };
});
