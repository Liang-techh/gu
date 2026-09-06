(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationActionCatalog = factory();
})(globalThis, function () {
  'use strict';

  const DEFINITIONS = Object.freeze([
    { id: 'cultivate', label: '修炼', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'cultivate' }) },
    { id: 'wait', label: '等待两小时', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'wait', hours: 2 }) },
    { id: 'rest', label: '休息', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'rest' }) },
    { id: 'study', label: '听课', kind: 'action', when: ({ here }) => here === 'academy', command: () => ({ type: 'action', id: 'study' }) },
    { id: 'gather', label: '探索 / 采集', kind: 'action', when: ({ here }) => ['bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'gather' }) },
    { id: 'refine', label: '炼化月光蛊', kind: 'action', when: ({ here }) => ['academy', 'village'].includes(here), command: () => ({ type: 'action', id: 'refine', guId: 'moonlight' }) },
    { id: 'arena_match', label: '参加演武', kind: 'choice', when: ({ here, state }) => here === 'merchantCity' && state.arena?.active, command: ({ state }) => ({ type: 'action', id: 'arena_match', label: `参加演武（${state.arena.wins}胜/${state.arena.matches}场）` }) },
    { id: 'inheritance_round', label: '挑战传承', kind: 'choice', when: ({ here, state }) => here === 'threeForkMountain' && state.inheritance?.active && !state.inheritance.completed, command: ({ state }) => ({ type: 'action', id: 'inheritance_round', label: `挑战传承第${state.inheritance.round + 1}轮` }) },
    { id: 'frontier_patrol', label: '北原巡逻', kind: 'choice', when: ({ here, state }) => ['northernPlains', 'blackTribeCamp'].includes(here) && state.frontier?.opened, command: ({ state }) => ({ type: 'action', id: 'frontier_patrol', label: `北原巡逻（补给 ${Math.round(state.frontier.supply)}）` }) },
    { id: 'tower_floor', label: '闯真阳楼', kind: 'choice', when: ({ here, state }) => here === 'trueYangTower' && state.tower?.active, command: ({ state }) => ({ type: 'action', id: 'tower_floor', label: `闯真阳楼第${state.tower.floors + 1}层` }) },
    { id: 'auction_lot', label: '参加仙蛊拍卖', kind: 'choice', when: ({ here, state }) => here === 'immortalAuction' && state.central?.auctionActive, command: ({ state }) => ({ type: 'action', id: 'auction_lot', mode: 'bid', label: `参加仙蛊拍卖（已成交 ${state.central.lotsSold} 笔）` }) }
  ]);

  function list(state, { locations } = {}) {
    const here = state.entities?.player?.position?.location;
    const context = { state, here };
    const actions = DEFINITIONS.filter(definition => definition.when(context)).map(definition => ({
      id: definition.id,
      label: definition.label,
      kind: definition.kind,
      command: definition.command(context)
    }));
    for (const location of locations?.[here]?.neighbors || []) actions.push({
      id: `travel:${location}`,
      label: `去${locations[location].name}`,
      kind: 'travel',
      command: { type: 'action', id: 'travel', location }
    });
    return actions;
  }

  return { DEFINITIONS, list };
});
