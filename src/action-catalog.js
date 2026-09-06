(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationActionCatalog = factory();
})(globalThis, function () {
  'use strict';

  function pursuitContactAvailable(state, here) {
    return Object.values(state.pursuit?.teams || {}).some(team => team.status === 'active' && team.members?.some(agentId => state.entities?.[agentId]?.position?.location === here));
  }

  function locationSupports(state, here, id) {
    return state.locations?.[here]?.interactions?.includes(id) === true;
  }

  const DEFINITIONS = Object.freeze([
    { id: 'cultivate', label: '修炼', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'cultivate' }) },
    { id: 'wait', label: '等待两小时', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'wait', hours: 2 }) },
    { id: 'rest', label: '休息', kind: 'action', when: () => true, command: () => ({ type: 'action', id: 'rest' }) },
    { id: 'spring_autumn_reset', label: '春秋蝉·逆流重启', kind: 'choice', when: ({ state }) => { const p = state.entities?.player; return (state.rebirth?.charges || 0) > 0 && (p?.body?.health || 0) <= (p?.body?.maxHealth || 1) * 0.24; }, command: () => ({ type: 'action', id: 'spring_autumn_reset' }) },
    { id: 'wolf_action:relief', label: '向狼潮防线送补给', kind: 'choice', when: ({ state, here }) => state.wolfCrisis?.active && !['aftermath', 'resolved'].includes(state.wolfCrisis.phase) && ['village', 'bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'wolf_action', mode: 'relief' }) },
    { id: 'wolf_action:scout', label: '侦查狼潮边缘', kind: 'choice', when: ({ state, here }) => state.wolfCrisis?.active && !['aftermath', 'resolved'].includes(state.wolfCrisis.phase) && ['village', 'bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'wolf_action', mode: 'scout' }) },
    { id: 'wolf_action:hoard', label: '趁乱囤积个人资源', kind: 'choice', when: ({ state, here }) => state.wolfCrisis?.active && !['aftermath', 'resolved'].includes(state.wolfCrisis.phase) && ['village', 'bambooForest', 'riverbank', 'cliffCave'].includes(here), command: () => ({ type: 'action', id: 'wolf_action', mode: 'hoard' }) },
    { id: 'market_shock_action:relief', label: '救济灾后商路', kind: 'choice', when: ({ state, here }) => state.marketShock?.active && !state.marketShock.resolved && ['village', 'caravanCamp', 'whiteBoneMountain'].includes(here), command: () => ({ type: 'action', id: 'market_shock_action', mode: 'relief' }) },
    { id: 'market_shock_action:arbitrage', label: '利用灾害价差套利', kind: 'choice', when: ({ state, here }) => state.marketShock?.active && !state.marketShock.resolved && ['village', 'caravanCamp', 'whiteBoneMountain'].includes(here), command: () => ({ type: 'action', id: 'market_shock_action', mode: 'arbitrage' }) },
    { id: 'market_shock_action:verify', label: '核验灾后价格', kind: 'choice', when: ({ state, here }) => state.marketShock?.active && !state.marketShock.resolved && ['village', 'caravanCamp', 'whiteBoneMountain'].includes(here), command: () => ({ type: 'action', id: 'market_shock_action', mode: 'verify' }) },
    { id: 'blessed_land_action:fortify', label: '加固狐仙福地', kind: 'choice', when: ({ state, here }) => here === 'foxFairyLand' && state.blessedLand?.active, command: () => ({ type: 'action', id: 'blessed_land_action', mode: 'fortify' }) },
    { id: 'blessed_land_action:cultivate', label: '培育福地资源', kind: 'choice', when: ({ state, here }) => here === 'foxFairyLand' && state.blessedLand?.active, command: () => ({ type: 'action', id: 'blessed_land_action', mode: 'cultivate' }) },
    { id: 'blessed_land_action:recruit', label: '招募福地驻民', kind: 'choice', when: ({ state, here }) => here === 'foxFairyLand' && state.blessedLand?.active, command: () => ({ type: 'action', id: 'blessed_land_action', mode: 'recruit' }) },
    { id: 'blessed_land_action:hide', label: '隐藏福地外显', kind: 'choice', when: ({ state, here }) => here === 'foxFairyLand' && state.blessedLand?.active, command: () => ({ type: 'action', id: 'blessed_land_action', mode: 'hide' }) },
    { id: 'front_action:reinforce', label: '支援战争战区', kind: 'choice', when: ({ state, here }) => Object.values(state.worldWar?.fronts || {}).some(front => front.active && front.location === here), command: () => ({ type: 'action', id: 'front_action', mode: 'reinforce' }) },
    { id: 'front_action:intelligence', label: '侦查战争战区', kind: 'choice', when: ({ state, here }) => Object.values(state.worldWar?.fronts || {}).some(front => front.active && front.location === here), command: () => ({ type: 'action', id: 'front_action', mode: 'intelligence' }) },
    { id: 'front_action:sabotage', label: '破坏战区补给', kind: 'choice', when: ({ state, here }) => Object.values(state.worldWar?.fronts || {}).some(front => front.active && front.location === here), command: () => ({ type: 'action', id: 'front_action', mode: 'sabotage' }) },
    { id: 'front_action:mediate', label: '调停战争战区', kind: 'choice', when: ({ state, here }) => Object.values(state.worldWar?.fronts || {}).some(front => front.active && front.location === here), command: () => ({ type: 'action', id: 'front_action', mode: 'mediate' }) },
    { id: 'shadow_network_action:recruit', label: '扩张影宗暗线', kind: 'choice', when: ({ state, here }) => state.shadowNetwork?.active && Object.values(state.shadowNetwork.nodes || {}).some(node => node.active && node.location === here), command: () => ({ type: 'action', id: 'shadow_network_action', mode: 'recruit' }) },
    { id: 'shadow_network_action:intel', label: '整理影宗情报', kind: 'choice', when: ({ state, here }) => state.shadowNetwork?.active && Object.values(state.shadowNetwork.nodes || {}).some(node => node.active && node.location === here), command: () => ({ type: 'action', id: 'shadow_network_action', mode: 'intel' }) },
    { id: 'shadow_network_action:conceal', label: '隐藏影宗暗线', kind: 'choice', when: ({ state, here }) => state.shadowNetwork?.active && Object.values(state.shadowNetwork.nodes || {}).some(node => node.active && node.location === here), command: () => ({ type: 'action', id: 'shadow_network_action', mode: 'conceal' }) },
    { id: 'shadow_network_action:betray', label: '出卖影宗情报', kind: 'choice', when: ({ state, here }) => state.shadowNetwork?.active && Object.values(state.shadowNetwork.nodes || {}).some(node => node.active && node.location === here), command: () => ({ type: 'action', id: 'shadow_network_action', mode: 'betray' }) },
    { id: 'identity_mask:wear', label: '戴上无名散修面具', kind: 'choice', when: ({ state }) => state.entities?.player?.knowledge?.activeMask === 'trueName', command: () => ({ type: 'action', id: 'identity_mask', mode: 'wear', maskId: 'anonymous' }) },
    { id: 'identity_mask:drop', label: '恢复真实身份', kind: 'choice', when: ({ state }) => state.entities?.player?.knowledge?.activeMask && state.entities.player.knowledge.activeMask !== 'trueName', command: () => ({ type: 'action', id: 'identity_mask', mode: 'drop' }) },
    { id: 'pursuit_agent:bribe', label: '收买追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'bribe' }) },
    { id: 'pursuit_agent:mislead', label: '误导追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'mislead' }) },
    { id: 'pursuit_agent:confront', label: '警告追捕队', kind: 'choice', when: ({ state, here }) => pursuitContactAvailable(state, here), command: () => ({ type: 'action', id: 'pursuit_agent', mode: 'confront' }) },
    { id: 'study', label: '听课', kind: 'action', when: ({ here }) => here === 'academy', command: () => ({ type: 'action', id: 'study' }) },
    { id: 'gather', label: '探索 / 采集', kind: 'action', when: ({ state, here }) => locationSupports(state, here, 'forage'), command: () => ({ type: 'action', id: 'gather' }) },
    { id: 'interact:observeZone', label: '观察区域', kind: 'choice', when: ({ state }) => Boolean(state.zones?.[state.entities?.player?.position?.location]), command: () => ({ type: 'action', id: 'interact', affordanceId: 'observeZone' }) },
    { id: 'interact:forage', label: '采集区域资源', kind: 'choice', when: ({ state, here }) => locationSupports(state, here, 'forage') && Boolean(state.zones?.[here]), command: () => ({ type: 'action', id: 'interact', affordanceId: 'forage' }) },
    { id: 'interact:searchRelic', label: '搜索遗藏痕迹', kind: 'choice', when: ({ state, here }) => locationSupports(state, here, 'searchRelic') && Boolean(state.zones?.[here]), command: () => ({ type: 'action', id: 'interact', affordanceId: 'searchRelic' }) },
    { id: 'interact:scoutZone', label: '侦查区域', kind: 'choice', when: ({ state, here }) => { const tags = state.locations?.[here]?.tags || []; return tags.includes('wild') || tags.includes('route') || tags.includes('war') || Object.values(state.worldWar?.fronts || {}).some(front => front.active && front.location === here); }, command: () => ({ type: 'action', id: 'interact', affordanceId: 'scoutZone' }) },
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
    { id: 'dream_dive', label: '探索梦境', kind: 'choice', when: ({ here, state }) => here === 'dreamRealms' && state.eternalWar?.dream, command: ({ state }) => ({ type: 'action', id: 'dream_dive', label: `探索梦境（深度 ${state.facts?.dreamDepth || 0}）` }) },
    { id: 'dream_realm_action:stake', label: '建立梦境锚点', kind: 'choice', when: ({ here, state }) => here === 'dreamRealms' && state.dreamRealm?.active, command: () => ({ type: 'action', id: 'dream_realm_action', mode: 'stake' }) },
    { id: 'dream_realm_action:harvest', label: '收割梦道资源', kind: 'choice', when: ({ here, state }) => here === 'dreamRealms' && state.dreamRealm?.active, command: () => ({ type: 'action', id: 'dream_realm_action', mode: 'harvest' }) },
    { id: 'dream_realm_action:stabilize', label: '稳定梦境边界', kind: 'choice', when: ({ here, state }) => here === 'dreamRealms' && state.dreamRealm?.active, command: () => ({ type: 'action', id: 'dream_realm_action', mode: 'stabilize' }) },
    { id: 'dream_realm_action:sabotage', label: '破坏梦境争夺节点', kind: 'choice', when: ({ here, state }) => here === 'dreamRealms' && state.dreamRealm?.active, command: () => ({ type: 'action', id: 'dream_realm_action', mode: 'sabotage' }) },
    { id: 'coalition_action:broker', label: '撮合势力盟约', kind: 'choice', when: ({ here }) => ['village', 'centralContinent', 'southernBorder', 'westernDesert', 'heavenlyCourt', 'longLifeHeaven', 'dreamRealms'].includes(here), command: () => ({ type: 'action', id: 'coalition_action', mode: 'broker' }) },
    { id: 'coalition_action:pledge', label: '兑现势力承诺', kind: 'choice', when: ({ here, state }) => ['village', 'centralContinent', 'southernBorder', 'westernDesert', 'heavenlyCourt', 'longLifeHeaven', 'dreamRealms'].includes(here) && Object.keys(state.coalitions?.pacts || {}).some(id => id.split('::').includes(state.entities?.player?.faction) && id.split('::').some(member => member !== state.entities?.player?.faction)), command: () => ({ type: 'action', id: 'coalition_action', mode: 'pledge' }) },
    { id: 'coalition_action:expose', label: '揭开盟约隐性条件', kind: 'choice', when: ({ here, state }) => ['village', 'centralContinent', 'southernBorder', 'westernDesert', 'heavenlyCourt', 'longLifeHeaven', 'dreamRealms'].includes(here) && Object.keys(state.coalitions?.pacts || {}).length > 0, command: () => ({ type: 'action', id: 'coalition_action', mode: 'expose' }) },
    { id: 'coalition_action:defect', label: '公开退出盟约', kind: 'choice', when: ({ here, state }) => ['village', 'centralContinent', 'southernBorder', 'westernDesert', 'heavenlyCourt', 'longLifeHeaven', 'dreamRealms'].includes(here) && Object.keys(state.coalitions?.pacts || {}).some(id => id.split('::').includes(state.entities?.player?.faction)), command: () => ({ type: 'action', id: 'coalition_action', mode: 'defect' }) }
  ]);

  function list(state, { locations, localObjects } = {}) {
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
    if (localObjects) {
      const actor = state.entities?.player;
      for (const object of localObjects.visible(state, actor)) {
        actions.push({ id: `local:inspect:${object.id}`, label: `调查${object.label}`, kind: 'local', command: { type: 'action', id: 'local_interact', objectId: object.id, mode: 'inspect' } });
        if (object.kind === 'resource' && object.remaining > 0) actions.push({ id: `local:gather:${object.id}`, label: `采集${object.label}`, kind: 'local', command: { type: 'action', id: 'local_interact', objectId: object.id, mode: 'gather' } });
        if (object.kind === 'practice' && object.discovered) actions.push({ id: `local:practice:${object.id}`, label: `在${object.label}练习`, kind: 'local', command: { type: 'action', id: 'local_interact', objectId: object.id, mode: 'practice' } });
        if (['trace', 'relic'].includes(object.kind) && object.discovered && !object.resolved) actions.push({ id: `local:follow:${object.id}`, label: `追查${object.label}`, kind: 'local', command: { type: 'action', id: 'local_interact', objectId: object.id, mode: 'follow' } });
      }
    }
    const nearbyAgents = Object.values(state.entities || {}).filter(entity => entity.id !== 'player' && entity.alive && !entity.agent && entity.position?.location === here && Object.values(state.agency?.commissions || {}).filter(item => item.status === 'active' && item.agentId === entity.id).length < 2).slice(0, 4);
    for (const npc of nearbyAgents) actions.push({ id: `commission_agent:${npc.id}`, label: `委托${npc.identity.name}打探`, kind: 'choice', command: { type: 'action', id: 'commission_agent', mode: 'recruit', target: npc.id, kind: 'rumor' } });
    return actions;
  }

  return { DEFINITIONS, list };
});
