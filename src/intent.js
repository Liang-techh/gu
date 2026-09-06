(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationIntent = factory();
})(globalThis, function () {
  'use strict';

  const ALIASES = {
    academy: ['学堂'], village: ['山寨'], ancestralHall: ['祠堂'], bambooForest: ['竹林'],
    riverbank: ['河滩', '山溪'], cliffCave: ['石缝', '遗藏'], caravanCamp: ['商队', '营地'],
    whiteBoneMountain: ['白骨山'], merchantCity: ['商家城'], threeForkMountain: ['三叉山', '三王传承'],
    heavenClimbMountain: ['天梯山'], northernPlains: ['北原', '草原'], blackTribeCamp: ['黑家军营', '黑家大军营地'],
    imperialCourt: ['王庭福地'], trueYangTower: ['真阳楼', '八十八角真阳楼'], foxFairyLand: ['狐仙福地'],
    centralContinent: ['中洲'], immortalAuction: ['中洲拍卖会', '仙蛊拍卖', '拍卖大会'], immortalCraneSect: ['仙鹤门']
  };

  function normalized(text) { return String(text || '').replace(/[，。！？、,.!?\s]/g, '').toLowerCase(); }

  function parse(text, state, { locations, entities }) {
    const q = normalized(text);
    if (!q) return { ok: false, message: '输入一个行动，例如“去竹林”“观察”“修炼”“和方正说话”。' };
    if (/去|走|前往|进入|回/.test(q)) {
      const matches = [];
      for (const [id, aliases] of Object.entries(ALIASES)) for (const alias of aliases) if (q.includes(alias.toLowerCase())) matches.push({ id, length: alias.length });
      matches.sort((a, b) => b.length - a.length);
      if (matches[0] && locations[matches[0].id]) return { ok: true, command: { type: 'action', id: 'travel', location: matches[0].id }, label: `前往${locations[matches[0].id].name}` };
    }
    if (/修炼|温养|打坐/.test(q)) return { ok: true, command: { type: 'action', id: 'cultivate' }, label: '温养空窍' };
    if (/演武|比斗|擂台/.test(q)) return { ok: true, command: { type: 'action', id: 'arena_match' }, label: '参加演武' };
    if (/三王传承|传承闯关|进入传承/.test(q)) return { ok: true, command: { type: 'action', id: 'inheritance_round' }, label: '挑战传承轮次' };
    if (/北原巡逻|军帐巡逻|侦察北原/.test(q)) return { ok: true, command: { type: 'action', id: 'frontier_patrol' }, label: '执行北原巡逻' };
    if (/真阳楼闯关|闯楼|登塔/.test(q)) return { ok: true, command: { type: 'action', id: 'tower_floor' }, label: '挑战真阳楼楼层' };
    if (/拍卖|竞拍|仙蛊/.test(q)) return { ok: true, command: { type: 'action', id: 'auction_lot', mode: /观察|看看/.test(q) ? 'observe' : /情报|传闻/.test(q) ? 'rumor' : 'bid' }, label: '处理一笔拍卖会交易' };
    if (/听课|学习/.test(q)) return { ok: true, command: { type: 'action', id: 'study' }, label: '听课' };
    if (/采集|采摘|取水|调查|探索|观察/.test(q)) return { ok: true, command: { type: 'action', id: 'gather' }, label: '探索并采集' };
    if (/休息|睡觉/.test(q)) return { ok: true, command: { type: 'action', id: 'rest' }, label: '休息' };
    if (/炼化|炼蛊/.test(q)) return { ok: true, command: { type: 'action', id: 'refine', guId: q.includes('酒虫') ? 'wineWorm' : 'moonlight' }, label: '炼化蛊虫' };
    const entries = Object.entries(entities || {}).filter(([id]) => id !== 'player');
    const target = entries.find(([, entity]) => q.includes(entity.identity.name.replace('古月', '').toLowerCase()));
    if (target && /帮助|帮忙/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: target[0], mode: 'help' }, label: `帮助${target[1].identity.name}` };
    if (target && /威胁|逼问|施压/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: target[0], mode: 'threaten' }, label: `向${target[1].identity.name}施压` };
    if (target && /说|聊|问|谈/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: target[0], mode: 'listen' }, label: `与${target[1].identity.name}交谈` };
    if (/等待|等一会/.test(q)) return { ok: true, command: { type: 'action', id: 'wait', hours: 2 }, label: '等待两小时' };
    return { ok: false, message: '没有匹配到安全行动。可用：去地点、修炼、听课、探索、休息、炼化、拍卖、与 NPC 交谈或施压。' };
  }

  return { ALIASES, parse };
});
