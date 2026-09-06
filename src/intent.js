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
    centralContinent: ['中洲'], immortalAuction: ['中洲拍卖会', '仙蛊拍卖', '拍卖大会'], immortalCraneSect: ['仙鹤门'],
    southernBorder: ['南疆'], westernDesert: ['西漠'], easternSea: ['东海'], heavenlyCourt: ['天庭'], longLifeHeaven: ['长生天'], shadowSectRuins: ['影宗遗址', '影宗'], divineEmperorCity: ['神帝城'], bookMountain: ['书山'], primordialDesolateWorld: ['蛮荒大世界', '蛮荒世界'], loessWorld: ['黄土大世界', '黄土世界'], reverseFlowRiver: ['逆流河'], dreamRealms: ['梦境战场', '梦境'], madDemonCave: ['疯魔窟', '元境']
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
    if (/摘下面具|恢复真名|恢复真实身份|公开身份/.test(q)) return { ok: true, command: { type: 'action', id: 'identity_mask', mode: 'drop' }, label: '恢复真实身份' };
    if (/伪装|戴面具|换身份|隐藏身份|无名散修/.test(q)) return { ok: true, command: { type: 'action', id: 'identity_mask', mode: 'wear', maskId: 'anonymous' }, label: '戴上无名散修面具' };
    if (/收买追兵|贿赂追捕|买通追捕/.test(q)) return { ok: true, command: { type: 'action', id: 'pursuit_agent', mode: 'bribe' }, label: '收买追捕队' };
    if (/误导追兵|甩开追捕|放假线索/.test(q)) return { ok: true, command: { type: 'action', id: 'pursuit_agent', mode: 'mislead' }, label: '误导追捕队' };
    if (/警告追兵|面对追捕|反向设伏/.test(q)) return { ok: true, command: { type: 'action', id: 'pursuit_agent', mode: 'confront' }, label: '警告追捕队' };
    if (/演武|比斗|擂台/.test(q)) return { ok: true, command: { type: 'action', id: 'arena_match' }, label: '参加演武' };
    if (/三王传承|传承闯关|进入传承/.test(q)) return { ok: true, command: { type: 'action', id: 'inheritance_round' }, label: '挑战传承轮次' };
    if (/北原巡逻|军帐巡逻|侦察北原/.test(q)) return { ok: true, command: { type: 'action', id: 'frontier_patrol' }, label: '执行北原巡逻' };
    if (/真阳楼闯关|闯楼|登塔/.test(q)) return { ok: true, command: { type: 'action', id: 'tower_floor' }, label: '挑战真阳楼楼层' };
    if (/招募暗线|扩张影宗|招募影宗/.test(q)) return { ok: true, command: { type: 'action', id: 'shadow_network_action', mode: 'recruit' }, label: '扩张影宗暗线' };
    if (/整理影宗情报|影宗情报|整理暗线/.test(q)) return { ok: true, command: { type: 'action', id: 'shadow_network_action', mode: 'intel' }, label: '整理影宗情报' };
    if (/隐藏影宗|隐藏暗线|抹去暗线/.test(q)) return { ok: true, command: { type: 'action', id: 'shadow_network_action', mode: 'conceal' }, label: '隐藏影宗暗线' };
    if (/出卖影宗|出卖暗线|卖掉影宗情报/.test(q)) return { ok: true, command: { type: 'action', id: 'shadow_network_action', mode: 'betray' }, label: '出卖影宗情报' };
    if (/拍卖|竞拍|仙蛊|抬价|抵押|借元石|核验情报|验证情报/.test(q)) {
      const mode = /抬价|抬高|加价/.test(q) ? 'raise' : /抵押|借元石|借钱/.test(q) ? 'mortgage' : /核验|验证|查证/.test(q) ? 'verify' : /观察|看看/.test(q) ? 'observe' : /情报|传闻/.test(q) ? 'rumor' : 'bid';
      return { ok: true, command: { type: 'action', id: 'auction_lot', mode }, label: `处理一笔拍卖会${mode === 'bid' ? '竞拍' : mode === 'observe' ? '行情观察' : mode === 'rumor' ? '情报交易' : mode === 'raise' ? '抬价' : mode === 'mortgage' ? '信用借贷' : '情报核验'}` };
    }
    if (/梦境|入梦|梦道/.test(q)) return { ok: true, command: { type: 'action', id: 'dream_dive' }, label: '探索梦境' };
    if (/听课|学习/.test(q)) return { ok: true, command: { type: 'action', id: 'study' }, label: '听课' };
    if (/采集|采摘|取水|调查|探索|观察/.test(q)) return { ok: true, command: { type: 'action', id: 'gather' }, label: '探索并采集' };
    if (/休息|睡觉/.test(q)) return { ok: true, command: { type: 'action', id: 'rest' }, label: '休息' };
    if (/炼化|炼蛊/.test(q)) return { ok: true, command: { type: 'action', id: 'refine', guId: q.includes('酒虫') ? 'wineWorm' : 'moonlight' }, label: '炼化蛊虫' };
    const entries = Object.entries(entities || {}).filter(([id]) => id !== 'player');
    const target = entries.find(([, entity]) => q.includes(entity.identity.name.replace('古月', '').toLowerCase()));
    if (target && /帮助|帮忙/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: target[0], mode: 'help' }, label: `帮助${target[1].identity.name}` };
    if (target && /委托|派人|打探|调查|侦查|代为交易|游说/.test(q)) {
      const kind = /侦查/.test(q) ? 'scout' : /交易/.test(q) ? 'trade' : /游说/.test(q) ? 'influence' : 'rumor';
      return { ok: true, command: { type: 'action', id: 'commission_agent', mode: 'recruit', target: target[0], kind }, label: `委托${target[1].identity.name}${kind === 'scout' ? '侦查' : kind === 'trade' ? '交易' : kind === 'influence' ? '游说' : '打探情报'}` };
    }
    if (target && /威胁|逼问|施压/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: target[0], mode: 'threaten' }, label: `向${target[1].identity.name}施压` };
    if (target && /说|聊|问|谈/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: target[0], mode: 'listen' }, label: `与${target[1].identity.name}交谈` };
    if (/等待|等一会/.test(q)) return { ok: true, command: { type: 'action', id: 'wait', hours: 2 }, label: '等待两小时' };
    return { ok: false, message: '没有匹配到安全行动。可用：去地点、修炼、听课、探索、休息、炼化、拍卖、与 NPC 交谈或施压。' };
  }

  return { ALIASES, parse };
});
