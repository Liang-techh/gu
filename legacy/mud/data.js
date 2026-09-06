/* 蛊真人背景 MUD 数据层。专有名词参考原作；新增装备、事件、数值与部分蛊虫/杀招为同人游戏设计。 */
(function(root,factory){const d=factory();if(typeof module==='object'&&module.exports)module.exports=d;else root.GuMudData=d;})(globalThis,()=>{
'use strict';
const VERSION=1;
const STAGES=['初阶','中阶','高阶','巅峰'];
const RANKS=[null,
 {rank:1,name:'一转蛊师',essence:'青铜真元',threshold:100},
 {rank:2,name:'二转蛊师',essence:'赤铁真元',threshold:135},
 {rank:3,name:'三转蛊师',essence:'白银真元',threshold:180},
 {rank:4,name:'四转蛊师',essence:'黄金真元',threshold:240},
 {rank:5,name:'五转蛊师',essence:'紫晶真元',threshold:320},
 {rank:6,name:'六转蛊仙',essence:'青提仙元',threshold:430},
 {rank:7,name:'七转蛊仙',essence:'红枣仙元',threshold:580},
 {rank:8,name:'八转蛊仙',essence:'白荔仙元',threshold:780},
 {rank:9,name:'九转尊者',essence:'黄杏仙元',threshold:1100}
];
const GRADES={甲等:{aptitude:88,label:'甲等'},乙等:{aptitude:66,label:'乙等'},丙等:{aptitude:44,label:'丙等'},丁等:{aptitude:28,label:'丁等'}};
const PATHS=[['light','光道'],['strength','力道'],['wisdom','智道'],['refinement','炼道'],['enslavement','奴道'],['transformation','变化道'],['soul','魂道'],['blood','血道'],['luck','运道'],['time','宙道'],['space','宇道'],['formation','阵道']].map(([id,name])=>({id,name}));
const MATERIALS={food:{name:'干粮',value:1},water:{name:'清水',value:1},petal:{name:'月兰花瓣',value:2},wine:{name:'青竹酒',value:18},ore:{name:'精铁',value:8},bone:{name:'兽骨',value:7},blood:{name:'兽血',value:10},wood:{name:'灵木',value:12},soul:{name:'魂砂',value:22},ink:{name:'灵墨',value:15},beastCore:{name:'兽核',value:35},formation:{name:'阵材',value:28},immortalMaterial:{name:'仙材',value:180},immortalStone:{name:'仙元石',value:220}};
const EQUIPMENT={
 bambooRobe:{id:'bambooRobe',name:'青竹短袍',slot:'robe',rank:1,desc:'山寨常见的轻便衣袍。',stats:{defense:3}},
 beastBracer:{id:'beastBracer',name:'兽皮护腕',slot:'bracer',rank:1,desc:'猎户制作的护具。',stats:{defense:2,strength:2}},
 roadBoots:{id:'roadBoots',name:'行路靴',slot:'boots',rank:1,desc:'适合长途跋涉。',stats:{agility:3}},
 clanToken:{id:'clanToken',name:'古月族令',slot:'token',rank:1,desc:'代表古月族人的身份。',stats:{reputation:3}},
 storagePouch:{id:'storagePouch',name:'储物袋',slot:'pouch',rank:2,desc:'方便携带更多蛊材。',stats:{capacity:20}},
 ironVest:{id:'ironVest',name:'精铁护心甲',slot:'robe',rank:2,desc:'沉重但可靠。',stats:{defense:8,agility:-1}},
 windBoots:{id:'windBoots',name:'风纹靴',slot:'boots',rank:3,desc:'以风道材料制成的轻靴。',stats:{agility:8}},
 inheritanceSeal:{id:'inheritanceSeal',name:'传承石印',slot:'token',rank:3,desc:'来自遗藏的信物，能压制部分机关。',stats:{insight:6}},
 cloudRobe:{id:'cloudRobe',name:'云纹仙袍',slot:'robe',rank:6,desc:'蛊仙层次的防护衣袍。',stats:{defense:28}},
 immortalPouch:{id:'immortalPouch',name:'仙窍行囊',slot:'pouch',rank:6,desc:'可稳定保存部分仙材。',stats:{capacity:120}},
 daoCrown:{id:'daoCrown',name:'道痕冠',slot:'token',rank:7,desc:'同人设计装备，可微弱放大道痕。',stats:{daoAmplify:8}}
};
const GU={
 moon:{id:'moon',name:'月光蛊',rank:1,path:'light',kind:'mortal',food:'petal',power:12,cost:8,desc:'一转蛊，催动后形成月刃。'},
 wine:{id:'wine',name:'酒虫',rank:1,path:'refinement',kind:'mortal',food:'wine',power:0,cost:0,desc:'帮助一转蛊师精炼真元。'},
 whiteBoar:{id:'whiteBoar',name:'白豕蛊',rank:1,path:'strength',kind:'mortal',food:'food',power:8,cost:6,desc:'增强肉身力量。'},
 jadeSkin:{id:'jadeSkin',name:'玉皮蛊',rank:1,path:'transformation',kind:'mortal',food:'ore',power:9,cost:7,desc:'增强表皮防护。'},
 littleLight:{id:'littleLight',name:'小光蛊',rank:1,path:'light',kind:'mortal',food:'petal',power:5,cost:4,desc:'小型光道蛊虫，可与月光蛊协同。'},
 blackBoar:{id:'blackBoar',name:'黑豕蛊',rank:2,path:'strength',kind:'mortal',food:'food',power:16,cost:10,desc:'力道蛊虫，增强力量。'},
 moonGlow:{id:'moonGlow',name:'月芒蛊',rank:2,path:'light',kind:'mortal',food:'petal',power:22,cost:13,desc:'由光道蛊虫融合而成的二转蛊。'},
 blackWhiteBoar:{id:'blackWhiteBoar',name:'黑白豕蛊',rank:2,path:'strength',kind:'mortal',food:'food',power:25,cost:14,desc:'融合黑白二豕之力。'},
 fourFlavorWine:{id:'fourFlavorWine',name:'四味酒虫',rank:2,path:'refinement',kind:'mortal',food:'wine',power:0,cost:0,desc:'酒虫的进阶形态，可继续辅助真元精炼。'},
 wolfEnslave:{id:'wolfEnslave',name:'驭狼蛊',rank:3,path:'enslavement',kind:'mortal',food:'beastCore',power:35,cost:22,desc:'奴道蛊虫，可控制部分狼兽。'},
 boneSpear:{id:'boneSpear',name:'骨枪蛊',rank:3,path:'strength',kind:'mortal',food:'bone',power:38,cost:23,desc:'同人战斗实现中的攻伐蛊。'},
 bloodBlade:{id:'bloodBlade',name:'血刃蛊',rank:4,path:'blood',kind:'mortal',food:'blood',power:58,cost:34,desc:'高风险血道攻伐蛊。'},
 soulBell:{id:'soulBell',name:'摄魂铃蛊',rank:4,path:'soul',kind:'mortal',food:'soul',power:52,cost:31,desc:'同人设计魂道蛊虫。'},
 spaceStep:{id:'spaceStep',name:'空步蛊',rank:5,path:'space',kind:'mortal',food:'formation',power:45,cost:36,desc:'同人设计宇道移动蛊。'},
 fateTrace:{id:'fateTrace',name:'运痕蛊',rank:5,path:'luck',kind:'mortal',food:'immortalMaterial',power:40,cost:32,desc:'同人设计运道蛊虫。'},
 fixedTravel:{id:'fixedTravel',name:'定仙游',rank:6,path:'space',kind:'immortal',food:'immortalMaterial',power:120,cost:1,desc:'六转仙蛊，具有极高战略价值。'},
 springAutumn:{id:'springAutumn',name:'春秋蝉',rank:6,path:'time',kind:'immortal',food:'immortalMaterial',power:0,cost:2,desc:'六转仙蛊；本游戏只用于隐藏时间线机制。'},
 attitudeGu:{id:'attitudeGu',name:'态度蛊',rank:8,path:'wisdom',kind:'immortal',food:'immortalMaterial',power:80,cost:4,desc:'高转仙蛊，偏重身份与人心博弈。'},
 wisdomGu:{id:'wisdomGu',name:'智慧蛊',rank:9,path:'wisdom',kind:'immortal',food:'immortalMaterial',power:0,cost:6,desc:'九转仙蛊；只有特殊终局路线可以接触。'},
 luckDog:{id:'luckDog',name:'狗屎运仙蛊',rank:6,path:'luck',kind:'immortal',food:'immortalMaterial',power:70,cost:1,desc:'六转运道仙蛊。'},
 immortalMoon:{id:'immortalMoon',name:'皓月仙蛊',rank:6,path:'light',kind:'immortal',food:'immortalMaterial',power:135,cost:1,desc:'同人设计光道仙蛊。'}
};
const FUSIONS={
 moonGlow:{id:'moonGlow',result:'moonGlow',requires:{gu:{moon:1,littleLight:1},materials:{petal:12,ore:2}},rank:1,chance:.72,desc:'月光蛊与小光蛊融合为月芒蛊。'},
 blackWhiteBoar:{id:'blackWhiteBoar',result:'blackWhiteBoar',requires:{gu:{whiteBoar:1,blackBoar:1},materials:{bone:8,blood:4}},rank:2,chance:.64,desc:'融合黑白二豕之力。'},
 fourFlavorWine:{id:'fourFlavorWine',result:'fourFlavorWine',requires:{gu:{wine:2},materials:{wine:4}},rank:2,chance:.58,desc:'以两只酒虫为核心进行进阶融合。'},
 immortalMoon:{id:'immortalMoon',result:'immortalMoon',requires:{gu:{moonGlow:1},materials:{immortalMaterial:8,immortalStone:5,formation:5}},rank:6,chance:.36,desc:'同人设计仙蛊炼制路线；六转后开放。'}
};
const KILLER_MOVES={
 moonChain:{id:'moonChain',name:'月刃连斩',kind:'mortal',rank:1,path:'light',requires:['moon'],cost:18,power:32,desc:'连续催动光道蛊虫形成复合攻势。'},
 boarRush:{id:'boarRush',name:'双豕冲阵',kind:'mortal',rank:2,path:'strength',requires:['blackWhiteBoar'],cost:22,power:55,desc:'借力道蛊虫爆发冲击。'},
 wolfFormation:{id:'wolfFormation',name:'狼群合围',kind:'mortal',rank:3,path:'enslavement',requires:['wolfEnslave'],cost:28,power:72,desc:'奴道杀招，依靠兽群形成围势。'},
 moonEscape:{id:'moonEscape',name:'月影遁',kind:'mortal',rank:5,path:'light',requires:['moonGlow','spaceStep'],cost:32,power:30,desc:'同人设计移动杀招。'},
 immortalMoonSea:{id:'immortalMoonSea',name:'仙道杀招·皓月天河',kind:'immortal',rank:6,path:'light',requires:['immortalMoon','moonGlow'],cost:2,power:190,desc:'以皓月仙蛊为核心的仙道杀招。'},
 fixedMoonGate:{id:'fixedMoonGate',name:'仙道杀招·定月门',kind:'immortal',rank:6,path:'space',requires:['fixedTravel','moonGlow'],cost:2,power:120,desc:'同人设计宇道/光道复合仙道杀招。'},
 myriadSelf:{id:'myriadSelf',name:'万我',kind:'immortal',rank:7,path:'strength',requires:['blackWhiteBoar'],cost:3,power:260,desc:'高阶复合杀招路线。'},
 timeReversal:{id:'timeReversal',name:'仙道杀招·逆流一瞬',kind:'immortal',rank:8,path:'time',requires:['springAutumn'],cost:4,power:0,desc:'高风险时间杀招，只在特定事件中启用。'}
};
const LOCATIONS={
 school:{id:'school',name:'古月学堂',region:'南疆·青茅山',rank:1,desc:'你的蛊师生涯从这里开始。',neighbors:['village','guRoom','dorm']},
 village:{id:'village',name:'古月山寨',region:'南疆·青茅山',rank:1,desc:'家族、商贩与各种关系汇聚之地。',neighbors:['school','inn','bamboo']},
 guRoom:{id:'guRoom',name:'蛊室',region:'南疆·青茅山',rank:1,desc:'可以买到低阶蛊食与基础材料。',neighbors:['school']},
 dorm:{id:'dorm',name:'学堂宿舍',region:'南疆·青茅山',rank:1,desc:'适合休息、炼蛊与修炼。',neighbors:['school']},
 inn:{id:'inn',name:'客栈',region:'南疆·青茅山',rank:1,desc:'商人与猎户交换消息。',neighbors:['village','marketRoad']},
 bamboo:{id:'bamboo',name:'青茅竹林',region:'南疆·青茅山',rank:1,desc:'山寨之外的第一片危险区域。',neighbors:['village','river']},
 river:{id:'river',name:'河滩',region:'南疆·青茅山',rank:1,desc:'足迹与酒香都可能在这里改变方向。',neighbors:['bamboo','crevice']},
 crevice:{id:'crevice',name:'瀑布石缝',region:'南疆·青茅山',rank:1,desc:'线索足够时才会显出真正入口。',neighbors:['river','inheritanceCave'],requiresFlag:'wineTrail'},
 inheritanceCave:{id:'inheritanceCave',name:'花酒遗藏',region:'南疆·青茅山',rank:1,desc:'一个可能改变前期命运的传承副本入口。',neighbors:['crevice']},
 marketRoad:{id:'marketRoad',name:'南疆商路',region:'南疆',rank:2,desc:'商队、散修与劫修频繁往来。',neighbors:['inn','boneMountain','regionalGate']},
 boneMountain:{id:'boneMountain',name:'白骨山外围',region:'南疆',rank:3,desc:'高风险传承地带。',neighbors:['marketRoad']},
 regionalGate:{id:'regionalGate',name:'五域行路节点',region:'五域',rank:4,desc:'四转后可选择长期离开青茅山。',neighbors:['marketRoad','central','north','east','west']},
 central:{id:'central',name:'中洲宗门地界',region:'中洲',rank:4,desc:'宗门林立，资源集中。',neighbors:['regionalGate','immortalAuction']},
 north:{id:'north',name:'北原草海',region:'北原',rank:4,desc:'部族、狼群与广阔战场。',neighbors:['regionalGate','immortalAuction']},
 east:{id:'east',name:'东海群岛',region:'东海',rank:4,desc:'岛屿众多，海中资源丰富。',neighbors:['regionalGate','immortalAuction']},
 west:{id:'west',name:'西漠商洲',region:'西漠',rank:4,desc:'绿洲与商道构成生存网络。',neighbors:['regionalGate','immortalAuction']},
 immortalAuction:{id:'immortalAuction',name:'蛊仙交易会',region:'五域',rank:6,desc:'六转后才能真正进入的仙级交易场。',neighbors:['central','north','east','west','tribulationField']},
 tribulationField:{id:'tribulationField',name:'渡劫之地',region:'仙窍',rank:6,desc:'管理福地与准备灾劫。',neighbors:['immortalAuction']}
};
const SHOPS={
 guRoom:{stones:{gu:{moon:18,littleLight:12,whiteBoar:12,jadeSkin:14},equipment:{}},immortal:{}},
 marketRoad:{stones:{gu:{wine:28,blackBoar:35},equipment:{storagePouch:25,ironVest:32}},immortal:{}},
 regionalGate:{stones:{gu:{bloodBlade:80,soulBell:78,spaceStep:110,fateTrace:120},equipment:{windBoots:55}},immortal:{}},
 immortalAuction:{stones:{gu:{},equipment:{}},immortal:{gu:{luckDog:10,attitudeGu:18,springAutumn:25},equipment:{cloudRobe:5,immortalPouch:4,daoCrown:10}}}
};
const DUNGEONS={
 flowerWine:{id:'flowerWine',name:'花酒遗藏',minRank:1,maxRank:2,location:'inheritanceCave',rooms:3,desc:'前期传承副本。可能得到酒虫、元石与传承石印。',rewards:{stones:35,gu:'wine',equipment:'inheritanceSeal'}},
 wolfTide:{id:'wolfTide',name:'狼潮围寨',minRank:2,maxRank:4,location:'village',rooms:4,desc:'大型守寨副本，会影响古月山寨存亡和人物关系。',rewards:{stones:90,gu:'wolfEnslave',equipment:'windBoots'}},
 boneInheritance:{id:'boneInheritance',name:'白骨传承',minRank:3,maxRank:5,location:'boneMountain',rooms:5,desc:'高风险传承副本。',rewards:{stones:180,gu:'boneSpear',materials:{bone:15,immortalMaterial:1}}},
 ancientBattle:{id:'ancientBattle',name:'古战场残境',minRank:5,maxRank:7,location:'regionalGate',rooms:5,desc:'凡仙交界的残破战场。',rewards:{stones:300,materials:{immortalMaterial:5,formation:8}}},
 landSpirit:{id:'landSpirit',name:'地灵考验',minRank:6,maxRank:8,location:'tribulationField',rooms:4,desc:'福地经营后出现的仙级考验。',rewards:{immortalStones:6,gu:'fixedTravel'}},
 venerableRoad:{id:'venerableRoad',name:'尊者之路残境',minRank:8,maxRank:9,location:'immortalAuction',rooms:6,desc:'仅为高转后期提供的终局副本。',rewards:{immortalStones:20,gu:'wisdomGu'}}
};
const ACHIEVEMENTS={
 firstGu:{id:'firstGu',name:'本命初定',desc:'炼化第一只本命蛊。'},wineSecret:{id:'wineSecret',name:'酒香引路',desc:'发现花酒遗藏。'},inheritanceOwner:{id:'inheritanceOwner',name:'独占传承',desc:'独占花酒遗藏的主要收益。'},clanFriend:{id:'clanFriend',name:'族中之人',desc:'古月一族声望达到 60。'},clanEnemy:{id:'clanEnemy',name:'山寨不容',desc:'恶名达到 60。'},fuse:{id:'fuse',name:'炼蛊合炼',desc:'第一次完成蛊虫融合。'},mortalMove:{id:'mortalMove',name:'杀招成形',desc:'掌握第一项凡道杀招。'},immortal:{id:'immortal',name:'仙凡之隔',desc:'晋升六转蛊仙。'},blessedLand:{id:'blessedLand',name:'一方天地',desc:'拥有自己的福地。'},immortalGu:{id:'immortalGu',name:'仙蛊在手',desc:'获得第一只仙蛊。'},immortalMove:{id:'immortalMove',name:'仙道杀招',desc:'掌握第一项仙道杀招。'},dungeonMaster:{id:'dungeonMaster',name:'传承猎手',desc:'通关四个不同副本。'},fiveRegions:{id:'fiveRegions',name:'行遍五域',desc:'踏足五个大域节点。'},rankNine:{id:'rankNine',name:'九转之巅',desc:'达到九转。'},secretEnding:{id:'secretEnding',name:'逆流而上',desc:'触发隐藏时间线结局。'}
};
const EVENTS=[
 {id:'opening',title:'开窍之后',speaker:'elder',text:'希望蛊散去，你的空窍已经形成。学堂交给你一只尚未炼化的月光蛊。接下来，家族会观察你，同窗会衡量你，而山外不会因为你年少就变得安全。',choices:[
  {id:'academy',label:'先扎稳学堂根基',text:'向古月师请教修行和蛊虫。',effects:{rep:5,insight:5,flag:['opening','academy']}},
  {id:'resources',label:'先考虑资源',text:'把有限元石花在蛊食和日常准备上。',effects:{stones:-2,materials:{petal:10,food:4},flag:['opening','resources']}},
  {id:'outside',label:'先留意山外',text:'主动搜集酒虫、花酒行者和山外传闻。',effects:{clue:12,infamy:1,flag:['opening','outside']}}
 ]},
 {id:'classmate',title:'同窗之间',speaker:'fangzheng',text:'古月方正想与你一起练习。他需要的不是一句客套，而是你愿不愿意把自己摸索出的东西交出来。',afterDay:2,location:'school',choices:[
  {id:'help',label:'无偿帮他',text:'结下真正的人情。',effects:{relation:{fangzheng:18},favor:{fangzheng:1},rep:2,flag:['classmate','help']}},
  {id:'trade',label:'两块元石换心得',text:'把经验当成交易。',effects:{stones:2,relation:{fangzheng:-6},flag:['classmate','trade']}},
  {id:'decline',label:'保留自己的东西',text:'不欠也不帮。',effects:{insight:3,flag:['classmate','decline']}}
 ]},
 {id:'purse',title:'地上的钱袋',speaker:'mobei',text:'古月漠北匆匆走过，钱袋落在学堂边。周围暂时没有人出声。',afterDay:3,location:'school',choices:[
  {id:'return',label:'当面归还',text:'这是最稳妥也最容易被记住的做法。',effects:{relation:{mobei:15},rep:4,flag:['purse','return']}},
  {id:'take',label:'收起钱袋',text:'你得到元石，也留下可能被追问的线。',effects:{stones:8,infamy:5,suspicion:10,flag:['purse','take']}},
  {id:'leave',label:'当作没看见',text:'不介入。',effects:{flag:['purse','leave']}}
 ]},
 {id:'wineTrail',title:'酒香与足迹',speaker:'fangyuan',text:'竹林里出现了不同寻常的痕迹。青竹酒的气味和一串足迹都指向河滩。',condition:{clue:20},location:'bamboo',choices:[
  {id:'follow',label:'循迹追下去',text:'开启遗藏路线。',effects:{clue:15,flag:['wineTrail','follow'],unlockDungeon:'flowerWine',unlockLocation:'crevice'}},
  {id:'hide',label:'先把痕迹藏起来',text:'减少别人跟上来的机会。',effects:{secrecy:12,flag:['wineTrail','hide']}},
  {id:'report',label:'把消息交给家族',text:'换取稳定资源，但让家族介入。',effects:{rep:12,stones:10,flag:['wineTrail','report']}}
 ]},
 {id:'wolfWarning',title:'山风里的狼嚎',speaker:'elder',text:'狼群活动越来越频繁。山寨开始调集蛊师，所有人都知道这不是普通兽患。',afterDay:12,choices:[
  {id:'defend',label:'站到守寨一边',text:'提高家族线权重，解锁狼潮副本。',effects:{rep:10,unlockDungeon:'wolfTide',flag:['wolfWarning','defend']}},
  {id:'profit',label:'趁乱囤积资源',text:'风险和收益同时提高。',effects:{stones:20,infamy:8,suspicion:6,flag:['wolfWarning','profit']}},
  {id:'leave',label:'提前准备离开',text:'更早打开商路路线。',effects:{clue:5,flag:['wolfWarning','leave'],unlockLocation:'marketRoad'}}
 ]},
 {id:'rankThreeRoad',title:'山寨之外',speaker:'fangyuan',text:'三转之后，青茅山已经不再足够大。你可以继续把这里当根，也可以真正踏上南疆。',condition:{rank:3},choices:[
  {id:'clan',label:'继续以古月山寨为根基',text:'获得稳定声望与补给。',effects:{rep:15,flag:['rankThreeRoad','clan']}},
  {id:'caravan',label:'沿商路进入南疆',text:'解锁南疆商路和白骨山外围。',effects:{unlockLocation:'marketRoad',flag:['rankThreeRoad','caravan']}},
  {id:'wander',label:'以散修身份行动',text:'自由度更高，但家族支持下降。',effects:{rep:-10,infamy:3,unlockLocation:'marketRoad',flag:['rankThreeRoad','wander']}}
 ]},
 {id:'rankFiveChoice',title:'凡途之巅',speaker:'elder',text:'五转巅峰已经触到凡人与蛊仙之间的界线。真正的飞升，不只需要修为，还需要资源、仙窍准备与承担灾劫的决心。',condition:{rank:5,stage:3},choices:[
  {id:'stable',label:'稳妥筹备飞升',text:'提高飞升稳定。',effects:{apertureStability:15,flag:['rankFiveChoice','stable']}},
  {id:'risk',label:'以险法冲击仙凡之隔',text:'节省资源但提高失败风险。',effects:{insight:12,apertureStability:-10,flag:['rankFiveChoice','risk']}},
  {id:'delay',label:'继续积累底蕴',text:'暂不飞升，优先搜集仙材和阵材。',effects:{materials:{immortalMaterial:3,formation:3},flag:['rankFiveChoice','delay']}}
 ]},
 {id:'immortalWorld',title:'仙凡两重天',speaker:'fangyuan',text:'成为六转蛊仙后，过去的元石、山寨声望和凡道争斗都还存在，却已经不再是唯一尺度。你的仙窍、仙元、仙蛊、道痕与灾劫开始决定未来。',condition:{rank:6},choices:[
  {id:'land',label:'先经营福地',text:'优先稳定仙窍内部。',effects:{blessedFocus:'land',flag:['immortalWorld','land']}},
  {id:'gu',label:'先谋仙蛊',text:'优先寻找仙蛊与炼制机会。',effects:{blessedFocus:'gu',flag:['immortalWorld','gu']}},
  {id:'move',label:'先完善仙道杀招',text:'把仙蛊当核心，构建完整战斗体系。',effects:{blessedFocus:'killer',flag:['immortalWorld','move']}}
 ]},
 {id:'rankNineFinal',title:'九转之后',speaker:'fangyuan',text:'九转并不是“没有事情可做”，而是你终于有资格决定这一局世界要以什么方式留下你的名字。',condition:{rank:9,stage:3},choices:[
  {id:'clan',label:'让青茅山成为你的根',text:'把力量投入古月一族与青茅山。',ending:'clanGuardian'},
  {id:'wander',label:'仍旧独行五域',text:'不让任何势力成为终点。',ending:'fiveRegionImmortal'},
  {id:'inheritance',label:'将所有传承归于一身',text:'以夺取、融合与推演作为最终道路。',ending:'inheritanceLord'},
  {id:'land',label:'经营自己的天地',text:'以福地、资源与长久经营作为答案。',ending:'blessedLord'},
  {id:'reverse',label:'催动春秋蝉，逆流重来',text:'只有真正持有春秋蝉时才出现的隐藏结局。',ending:'reverseTime',requiresGu:'springAutumn'}
 ]}
];
const ENDINGS={clanGuardian:{id:'clanGuardian',name:'青茅守望者',desc:'你以古月山寨为根，最终成为改变家族命运的人。'},demonWanderer:{id:'demonWanderer',name:'魔道独行',desc:'你把所有关系都当成工具，走出一条不受家族束缚的路。'},inheritanceLord:{id:'inheritanceLord',name:'传承之主',desc:'你不断夺取并整合传承，最终把它们变成自己的体系。'},blessedLord:{id:'blessedLord',name:'福地主人',desc:'你没有急着追逐最强攻伐，而是把仙窍经营成真正的一方天地。'},fiveRegionImmortal:{id:'fiveRegionImmortal',name:'五域游仙',desc:'你以游历和交易为主线，在五域留下自己的名字。'},rankNine:{id:'rankNine',name:'九转之巅',desc:'你最终抵达九转，成为这一局世界中最顶层的存在。'},reverseTime:{id:'reverseTime',name:'逆流重生',desc:'你在终局选择以时间手段逆转一切，开启一条隐藏时间线。'}};
return{VERSION,STAGES,RANKS,GRADES,PATHS,MATERIALS,EQUIPMENT,GU,FUSIONS,KILLER_MOVES,LOCATIONS,SHOPS,DUNGEONS,ACHIEVEMENTS,EVENTS,ENDINGS};
});