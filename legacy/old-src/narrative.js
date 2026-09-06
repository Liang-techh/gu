/* Presentation metadata only. Core state changes remain in engine.js. */
(function(root,factory){const n=factory();if(typeof module==='object'&&module.exports)module.exports=n;else root.GuNarrative=n;})(globalThis,()=>{
'use strict';
const scenes={
  village:{title:'古月山寨',glyph:'寨',tone:'pine',kicker:'族规 · 人情 · 烟火',caption:'竹楼沿山而建。这里安全，却没有真正无人注视的角落。'},
  school:{title:'学堂',glyph:'堂',tone:'jade',kicker:'同窗 · 考核 · 起步',caption:'少年们从这里学会看空窍、调真元，也第一次被家族衡量。'},
  room:{title:'蛊室',glyph:'蛊',tone:'moon',kicker:'蛊虫 · 食料 · 买卖',caption:'隔洞与器皿中存养着蛊虫。柜台另一边，是养蛊所需的日常代价。'},
  dorm:{title:'学堂宿舍',glyph:'舍',tone:'ink',kicker:'炼化 · 调息 · 整理线索',caption:'门窗一闭，山寨的喧闹远了。炼化蛊虫往往是一场耐心的消耗战。'},
  inn:{title:'客栈',glyph:'酒',tone:'ember',kicker:'客商 · 猎户 · 消息',caption:'饭菜、酒香和闲话混在一起。许多消息在成为“情报”之前，只是某人的一句话。'},
  shop:{title:'酒肆',glyph:'酿',tone:'amber',kicker:'青竹酒 · 元石 · 交易',caption:'酒坛整齐码在阴凉处。对凡人是酒，对某些蛊虫却是食料。'},
  bamboo:{title:'竹林',glyph:'竹',tone:'forest',kicker:'山风 · 酒香 · 踪迹',caption:'青矛竹层层遮住视线。机缘并不会因为玩家来到这里，就主动走到脚边。'},
  river:{title:'河滩',glyph:'水',tone:'river',kicker:'流水 · 足迹 · 追踪',caption:'浅水从石间穿过。雨会冲淡气味，也会让平日看不见的入口显出痕迹。'},
  crevice:{title:'石缝',glyph:'隙',tone:'stone',kicker:'瀑布 · 黑暗 · 入口',caption:'水声遮住了石缝里的动静。知道入口存在，与敢不敢继续深入，是两回事。'},
  cave:{title:'山壁深处',glyph:'遗',tone:'blood',kicker:'遗藏 · 选择 · 后患',caption:'石壁后的空间不属于你的命运。直到你伸手取走其中某样东西。'}
};
const portraits={
  fangzheng:{glyph:'正',role:'古月方正',subtitle:'同窗 · 修炼',stance:'bright'},
  fangyuan:{glyph:'源',role:'古月方源',subtitle:'古月族人 · 行踪难测',stance:'shadow'},
  mobei:{glyph:'漠',role:'古月漠北',subtitle:'同窗 · 考核',stance:'stone'},
  chicheng:{glyph:'赤',role:'古月赤城',subtitle:'同窗 · 考核',stance:'ember'},
  elder:{glyph:'师',role:'古月师',subtitle:'学堂家老',stance:'jade'},
  jiangya:{glyph:'牙',role:'江牙',subtitle:'一转蛊师 · 生意',stance:'amber'},
  jiafu:{glyph:'贾',role:'贾富',subtitle:'商队领头人',stance:'gold'}
};
const topics={
  fangzheng:[
    {id:'practice',label:'谈修炼',prompt:'问起最近的炼化与修行。'},
    {id:'academy',label:'谈学堂',prompt:'聊同窗、考核与学堂里的风声。'},
    {id:'favor',label:'提起旧人情',prompt:'把过去的一次帮助重新摆到桌面上。',requires:[['npcs.fangzheng.favor','>=',1]]}
  ],
  fangyuan:[
    {id:'mountain',label:'谈山外',prompt:'试探他最近是否留意过山寨之外。'},
    {id:'gu',label:'谈蛊虫',prompt:'不直接问秘密，只聊蛊虫与食料。'},
    {id:'inheritance',label:'试探遗藏',prompt:'把话题慢慢引向花酒行者。',requires:[['v.clue','>=',20]]}
  ],
  mobei:[
    {id:'exam',label:'谈考核',prompt:'询问他对月刃考核的准备。'},
    {id:'competition',label:'谈同窗',prompt:'聊最近谁的修行最快。'},
    {id:'purse',label:'提起钱袋',prompt:'看看他是否还记得那只钱袋。',requires:[['flags.purse','!=','']]}
  ],
  chicheng:[
    {id:'exam',label:'谈考核',prompt:'聊学堂里最直接的竞争。'},
    {id:'family',label:'谈家族',prompt:'试探他对家族评价和资源分配的看法。'},
    {id:'rival',label:'谈方源',prompt:'把话题放到另一个同窗身上。'}
  ],
  elder:[
    {id:'lesson',label:'请教学识',prompt:'请他解释修行与蛊虫的基础。'},
    {id:'exam',label:'问考核',prompt:'问清楚学堂会如何衡量表现。'},
    {id:'record',label:'解释近况',prompt:'主动说明最近的行动，降低误会的空间。',requires:[['v.suspicion','>=',20]]}
  ],
  jiangya:[
    {id:'food',label:'问蛊食',prompt:'问最近哪种食料最容易缺货。'},
    {id:'price',label:'谈价格',prompt:'聊元石、货源和最近的买卖。'},
    {id:'favor',label:'谈熟客价',prompt:'试着让长期往来变成实在的便利。',requires:[['npcs.jiangya.trust','>=',15]]}
  ],
  jiafu:[
    {id:'caravan',label:'问商队',prompt:'问一路上的货损和商路状况。'},
    {id:'order',label:'谈订单',prompt:'把履约、供货和之后的合作说清楚。'},
    {id:'trust',label:'谈长期合作',prompt:'试探是否能把一次买卖变成长期关系。',requires:[['v.caravanTrust','>=',15]]}
  ]
};
const eventLane={
  opening:'开局',classmate:'学堂',purse:'学堂',patron:'资源',debtDue:'债务',collection:'债务',exam:'学堂',
  trail:'遗藏',inheritance:'遗藏',bargain:'遗藏',rival:'遗藏',audit:'家族',ambush:'家族',testimony:'家族',
  caravan:'商队',shortage:'商队',order:'商队',delivery:'商队',rumor:'世界',chapterEnd:'世界'
};
const laneOrder=['开局','学堂','资源','债务','遗藏','家族','商队','世界','支线'];
function scene(id){return scenes[id]||{title:id,glyph:'山',tone:'pine',kicker:'青茅山',caption:''};}
function portrait(id){return portraits[id]||{glyph:'人',role:id||'无人',subtitle:'',stance:'jade'};}
function topicsFor(id){return topics[id]||[];}
function lane(id){return eventLane[id]||'支线';}
return {VERSION:1,scenes,portraits,topics,eventLane,laneOrder,scene,portrait,topicsFor,lane};
});
