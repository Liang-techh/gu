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
    { id: 'spring_autumn_reset', label: '春秋蝉·逆流重启', kind: 'choice', when: ({ state }) => { const p = state.entities?.player; return (state.rebirth?.charges || 0) > 0 && (p?.body?.health || 0) <= (p?.body?.maxHealth || 1) * 0.24; }, command: () => ({ type: 'action', id: 'spring_autumn_reset' }) },
    { id: 'wolf_action:relief', label: '向狼潮防线送补给', kind: 'choice', when: ({ state, here }) => state.wolfCrisis?.active && !['aftermath', 'resolved'].includes(state.wolfCrisis.phase) && ['village', 'bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'wolf_action', mode: 'relief' }) },
    { id: 'wolf_action:scout', label: '侦查狼潮边缘', kind: 'choice', when: ({ state, here }) => state.wolfCrisis?.active && !['aftermath', 'resolved'].includes(state.wolfCrisis.phase) && ['village', 'bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'wolf_action', mode: 'scout' }) },
    { id: 'wolf_action:hoard', label: '趁乱囤积个人资源', kind: 'choice', when: ({ state, here }) => state.wolfCrisis?.active && !['aftermath', 'resolved'].includes(state.wolfCrisis.phase) && ['village', 'bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'wolf_action', mode: 'hoard' }) },
    { id: 'identity_mask:wear', label: '戴上无名散修面具', kind: 'choice', when: ({ state }) => state.entities?.player?.knowledge?.activeMask === 'trueName', command: () => ({ type: 'action', id: 'identity_mask', mode: 'wear', maskId: 'anonymous' }) },
    { id: 'identity_mask:drop', label: '恢复真实身份', kind: 'choice', when: ({ state }) => state.entities?.player?.knowledge?.activeMask && state.entities.player.knowledge.activeMask !== 'trueName', command: () => ({ type: 'action', id: 'identity_mask', mode: 'drop' }) },
    { id: 'pursuit_agent:bribe', label: '收买追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'bribe' }) },
    { id: 'pursuit_agent:mislead', label: '误导追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'mislead' }) },
    { id: 'pursuit_agent:confront', label: '警告追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'confront' }) },
    { id: 'study', label: '听课', kind: 'action', when: ({ here }) => here === 'academy', command: () => ({ type: 'action', id: 'study' }) },
    { id: 'gather', label: '探索 / 采集', kind: 'action', when: ({ here }) => ['bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'gather' }) },
    { id: 'refine', label: '炼化月光蛊', kind: 'action', when: ({ here }) => ['academy', 'village'].includes(here), command: () => ({ type: 'action', id: 'refine', guId: 'moonlight' }) },
    { id: 'arena_match', label: '参加演武', kind: 'choice', when: ({ here, state }) => here === 'merchantCity' && state.arena?.active, command: ({ state }) => ({ type: 'action', id: 'arena_match', label: `参加演武（${state.arena.wins}胜/${state.arena.matches}场）` }) },
    { id: 'inheritance_scout', label: '侦查三王传承', kind: 'choice', when: ({ here, state }) => here === 'threeForkMountain' && state.inheritance?.active && !state.inheritance.completed, command: () => ({ type: 'action', id: 'inheritance_scout' }) },
    { id: 'inheritance_round', label: '挑战传承', kind: 'choice', when: ({ here, state }) => here === 'threeForkMountain' && state.inheritance?.active && !state.inheritance.completed, command: ({ state }) => ({ type: 'action', id: 'inheritance_round', label: `挑战传承第${state.inheritance.round + 1}轮` }) },
    { id: 'inheritance_round:greed', label: '贪取传承捷径', kind: 'choice', when: ({ here, state }) => here === 'threeForkMountain' && state.inheritance?.active && !state.inheritance.completed, command: () => ({ type: 'action', id: 'inheritance_round', mode: 'greed' }) },
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
    for (const [guId, item] of Object.entries(state.entities?.player?.inventory?.gu || {})) {
      if (!item?.refined) continue;
      const worn = Object.values(state.entities.player.equipment?.slots || {}).some(slot => slot.itemId === guId);
      actions.push(worn
        ? { id: `unequip_gu:${guId}`, label: `卸下${guId}`, kind: 'choice', command: { type: 'action', id: 'unequip_gu', guId } }
        : { id: `equip_gu:${guId}`, label: `装备${guId}`, kind: 'choice', command: { type: 'action', id: 'equip_gu', guId } });
    }
    for (const location of locations?.[here]?.neighbors || []) actions.push({
      id: `travel:${location}`,
      label: `去${locations[location].name}`,
      kind: 'travel',
      command: { type: 'action', id: 'travel', location }
    });
    const nearbyAgents = Object.values(state.entities || {}).filter(entity => entity.id !== 'player' && entity.alive && !entity.agent && entity.position?.location === here && Object.values(state.agency?.commissions || {}).filter(item => item.status === 'active' && item.agentId === entity.id).length < 2).slice(0, 4);
    for (const npc of nearbyAgents) actions.push({ id: `commission_agent:${npc.id}`, label: `委托${npc.identity.name}打探`, kind: 'choice', command: { type: 'action', id: 'commission_agent', mode: 'recruit', target: npc.id, kind: 'rumor' } });
    return actions;
  }

  return { DEFINITIONS, list };
});
