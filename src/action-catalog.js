(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationActionCatalog = factory();
})(globalThis, function () {
  'use strict';

  function pursuitContactAvailable(state, here) {
    return Object.values(state.pursuit?.teams || {}).some(team => team.status === 'active' && team.members?.some(agentId => state.entities?.[agentId]?.position?.location === here));
  }

  const DEFINITIONS = Object.freeze([
    { id: 'cultivate', label: '修炼', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'cultivate' }) },
    { id: 'wait', label: '等待两小时', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'wait', hours: 2 }) },
    { id: 'rest', label: '休息', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'rest' }) },
    { id: 'identity_mask:wear', label: '戴上无名散修面具', kind: 'choice', when: ({ state }) => state.entities?.player?.knowledge?.activeMask === 'trueName', command: () => ({ type: 'action', id: 'identity_mask', mode: 'wear', maskId: 'anonymous' }) },
    { id: 'identity_mask:drop', label: '恢复真实身份', kind: 'choice', when: ({ state }) => state.entities?.player?.knowledge?.activeMask && state.entities.player.knowledge.activeMask !== 'trueName', command: () => ({ type: 'action', id: 'identity_mask', mode: 'drop' }) },
    { id: 'pursuit_agent:bribe', label: '收买追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'bribe' }) },
    { id: 'pursuit_agent:mislead', label: '误导追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'mislead' }) },
    { id: 'pursuit_agent:confront', label: '警告追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'confront' }) },
    { id: 'study', label: '听课', kind: 'action', when: ({ here }) => here === 'academy', command: () => ({ type: 'action', id: 'study' }) },
    { id: 'gather', label: '探索 / 采集', kind: 'action', when: ({ here }) => ['bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'gather' }) },
    { id: 'refine', label: '炼化月光蛊', kind: 'action', when: ({ here }) => ['academy', 'village'].includes(here), command: () => ({ type: 'action', id: 'refine', guId: 'moonlight' }) },
    { id: 'arena_match', label: '参加演武', kind: 'choice', when: ({ here, state }) => here === 'merchantCity' && state.arena?.active, command: ({ state }) => ({ type: 'action', id: 'arena_match', label: `参加演武（${state.arena.wins}胜/${state.arena.matches}场）` }) },
    { id: 'inheritance_round', label: '挑战传承', kind: 'choice', when: ({ here, state }) => here === 'threeForkMountain' && state.inheritance?.active && !state.inheritance.completed, command: ({ state }) => ({ type: 'action', id: 'inheritance_round', label: `挑战传承第${state.inheritance.round + 1}轮` }) },
    { id: 'frontier_patrol', label: '北原巡逻', kind: 'choice', when: ({ here, state }) => ['northernPlains', 'blackTribeCamp'].includes(here) && state.frontier?.opened, command: ({ state }) => ({ type: 'action', id: 'frontier_patrol', label: `北原巡逻（补给 ${Math.round(state.frontier.supply)}）` }) },
    { id: 'tower_floor', label: '闯真阳楼', kind: 'choice', when: ({ here, state }) => here === 'trueYangTower' && state.tower?.active, command: ({ state }) => ({ type: 'action', id: 'tower_floor', label: `闯真阳楼第${state.tower.floors + 1}层` }) },
    { id: 'auction_lot:bid', label: '拍卖：竞拍', kind: 'choice', when: ({ here, state }) => here === 'immortalAuction' && state.central?.auctionActive, command: ({ state }) => ({ type: 'action', id: 'auction_lot', mode: 'bid', label: `竞拍一件仙蛊（成交 ${state.central.lotsSold} 笔）` }) },
    { id: 'auction_lot:observe', label: '拍卖：观察行情', kind: 'choice', when: ({ here, state }) => here === 'immortalAuction' && state.central?.auctionActive, command: () => ({ type: 'action', id: 'auction_lot', mode: 'observe' }) },
    { id: 'auction_lot:rumor', label: '拍卖：出售情报', kind: 'choice', when: ({ here, state }) => here === 'immortalAuction' && state.central?.auctionActive, command: () => ({ type: 'action', id: 'auction_lot', mode: 'rumor' }) },
    { id: 'auction_lot:raise', label: '拍卖：抬价试探', kind: 'choice', when: ({ here, state }) => here === 'immortalAuction' && state.central?.auctionActive, command: () => ({ type: 'action', id: 'auction_lot', mode: 'raise' }) },
    { id: 'auction_lot:mortgage', label: '拍卖：抵押借元石', kind: 'choice', when: ({ here, state }) => here === 'immortalAuction' && state.central?.auctionActive, command: () => ({ type: 'action', id: 'auction_lot', mode: 'mortgage' }) },
    { id: 'auction_lot:verify', label: '拍卖：核验情报', kind: 'choice', when: ({ here, state }) => here === 'immortalAuction' && state.central?.auctionActive, command: () => ({ type: 'action', id: 'auction_lot', mode: 'verify' }) },
    { id: 'dream_dive', label: '探索梦境', kind: 'choice', when: ({ here, state }) => here === 'dreamRealms' && state.eternalWar?.dream, command: ({ state }) => ({ type: 'action', id: 'dream_dive', label: `探索梦境（深度 ${state.facts?.dreamDepth || 0}）` }) }
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
