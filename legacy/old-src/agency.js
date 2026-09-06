/* 0.5 Agency layer: scene objects, inner voices, and free-text intent parsing.
   It never changes state; commands still go through app.js -> engine.dispatch(). */
(function(root,factory){const a=factory(typeof module==='object'&&module.exports?require('./content.js'):root.GuContent);if(typeof module==='object'&&module.exports)module.exports=a;else root.GuAgency=a;})(globalThis,D=>{
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const P=(id,label,glyph,x,y,command,description,extra={})=>({id,label,glyph,x,y,command,description,...extra});
const objects={
 village:[
  P('school','学堂','堂',69,30,{type:'travel',id:'school'},'少年蛊师学习、考核的地方。'),
  P('inn','客栈','酒',79,58,{type:'travel',id:'inn'},'猎户、蛊师和消息在这里碰头。'),
  P('bamboo','竹林小径','竹',53,19,{type:'travel',id:'bamboo'},'山寨之外，机缘与危险都更多。'),
  P('work','家族杂务','役',38,49,{type:'action',id:'work'},'做些实际差事，换取元石与家族评价。')
 ],
 school:[
  P('fangzheng','古月方正','正',76,32,{type:'social',id:'fangzheng',mode:'chat'},'同窗。他会记得真正的帮助，也会记得利益交换。',{person:'fangzheng'}),
  P('mobei','古月漠北','漠',63,43,{type:'social',id:'mobei',mode:'chat'},'同窗，也是考核中的竞争者。',{person:'mobei'}),
  P('chicheng','古月赤城','赤',86,47,{type:'social',id:'chicheng',mode:'chat'},'另一名被家族关注的少年。',{person:'chicheng'}),
  P('elder','古月师','师',55,30,{type:'social',id:'elder',mode:'chat'},'学堂家老。你在这里的表现会落进他的眼里。',{person:'elder'}),
  P('dummy','草人傀儡','草',45,57,{type:'action',id:'train'},'用于练习月刃。没有炼化月光蛊时，练习无从谈起。'),
  P('lesson','听课位置','书',35,36,{type:'action',id:'study'},'留下来听课，积累学识、悟性和记忆。'),
  P('room','蛊室','蛊',90,23,{type:'travel',id:'room'},'蛊虫、蛊食和练习用具都在这里。'),
  P('dorm','宿舍','舍',22,27,{type:'travel',id:'dorm'},'可以休息，也适合安静炼蛊。')
 ],
 room:[
  P('jiangya','江牙','牙',72,35,{type:'social',id:'jiangya',mode:'chat'},'负责铺子的一转蛊师。',{person:'jiangya'}),
  P('petals','月兰花瓣','兰',51,46,{type:'trade',id:'petals',qty:1,mode:'buy'},'月光蛊的食料。'),
  P('dummy','草人傀儡','草',36,51,{type:'trade',id:'dummy',qty:1,mode:'buy'},'练习月刃的消耗品。'),
  P('school','回学堂','门',17,41,{type:'travel',id:'school'},'回到学堂。')
 ],
 dorm:[
  P('moon','月光蛊','月',68,37,{type:'refine',id:'moon'},'尚未炼化时，它仍有自己的意志。'),
  P('bed','床榻','榻',43,58,{type:'action',id:'rest'},'真正休息一次，时间会推进八小时。'),
  P('meditate','静坐处','静',55,30,{type:'action',id:'meditate'},'收敛杂念，恢复精神与耐心。'),
  P('school','推门出去','门',17,36,{type:'travel',id:'school'},'回到学堂。')
 ],
 inn:[
  P('work','跑堂杂务','役',38,55,{type:'action',id:'work'},'客栈总有一些能换元石的杂务。'),
  P('rest','客房','歇',59,32,{type:'action',id:'rest'},'花时间真正休息。'),
  P('shop','酒肆方向','酒',81,38,{type:'travel',id:'shop'},'顺着酒香过去。'),
  P('village','回山寨','寨',18,39,{type:'travel',id:'village'},'回到山寨街道。')
 ],
 shop:[
  P('wine','青竹酒','酒',61,44,{type:'trade',id:'wine',qty:1,mode:'buy'},'贵，但酒虫更喜欢这种酒。'),
  P('riceWine','米酒','米',43,51,{type:'trade',id:'riceWine',qty:1,mode:'buy'},'更便宜，也能勉强作为酒虫食料。'),
  P('inn','回客栈','门',18,39,{type:'travel',id:'inn'},'离开酒肆。')
 ],
 bamboo:[
  P('fangyuan','古月方源','源',78,31,{type:'social',id:'fangyuan',mode:'chat'},'他出现在这里，通常不会只是散心。',{person:'fangyuan'}),
  P('tracks','被压倒的草叶','痕',50,53,{type:'action',id:'explore'},'草叶倒向同一方向，值得仔细看看。'),
  P('lure','洒下青竹酒','酒',63,62,{type:'action',id:'lure'},'用酒香引蛊。雨天会明显削弱效果。'),
  P('hunt','兽类动静','兽',36,42,{type:'action',id:'hunt'},'主动追猎，就要准备真正交锋。'),
  P('river','溪水方向','水',88,55,{type:'travel',id:'river'},'顺着山溪向上。'),
  P('village','山寨方向','寨',14,45,{type:'travel',id:'village'},'退回家族更安全的范围。')
 ],
 river:[
  P('water','浅水','水',46,62,{type:'action',id:'water'},'补充清水。'),
  P('tracks','湿地足迹','迹',62,43,{type:'action',id:'explore'},'水会抹去一些痕迹，也会让另一些痕迹更清楚。'),
  P('crevice','瀑布后的石缝','隙',81,31,{type:'travel',id:'crevice'},'没有足够线索时，你甚至不知道该从哪里进去。'),
  P('bamboo','回竹林','竹',17,46,{type:'travel',id:'bamboo'},'沿原路返回。')
 ],
 crevice:[
  P('inside','更深的黑暗','深',70,38,{type:'action',id:'explore'},'先观察，再决定是否把自己交给黑暗。'),
  P('cave','继续深入','遗',82,52,{type:'travel',id:'cave'},'只有真正跟上那条线索，才知道路在何处。'),
  P('river','退回河滩','水',17,48,{type:'travel',id:'river'},'回到开阔处。')
 ],
 cave:[
  P('search','查看遗留痕迹','遗',61,42,{type:'action',id:'explore'},'这里每多看一眼，都可能让你知道更多，也可能留下更多痕迹。'),
  P('back','退出石缝','隙',18,45,{type:'travel',id:'crevice'},'回到入口。')
 ]
};
const aliases={fangzheng:['方正','古月方正'],fangyuan:['方源','古月方源'],mobei:['漠北','古月漠北'],chicheng:['赤城','古月赤城'],elder:['家老','古月师','学堂家老'],jiangya:['江牙'],jiafu:['贾富']};
const placeAliases={village:['山寨','古月山寨'],school:['学堂'],room:['蛊室'],dorm:['宿舍','学堂宿舍'],inn:['客栈'],shop:['酒肆'],bamboo:['竹林'],river:['河滩','溪边','山溪'],crevice:['石缝'],cave:['山壁','深处','遗藏']};
const actionLexicon=[
 ['cultivate',['修炼','吐纳','温养空窍']],['study',['听课','上课','学习']],['train',['练月刃','练习月刃','练习攻击']],['work',['干活','做杂务','赚钱','找活']],['meditate',['冥想','静坐','静心']],['explore',['探索','观察','调查','搜索','搜寻','脚印','足迹','痕迹','看看周围']],['lure',['引蛊','洒酒','用酒','酒虫']],['hunt',['狩猎','打猎','猎杀','找野猪']],['forage',['找吃的','找食物','采食']],['water',['取水','打水','装水']],['rest',['休息','睡觉','歇息']],['heal',['疗伤','治伤','解毒']],['prepare',['准备行装','准备战斗','做准备']],['absorb',['汲取元石','吸收元石','补真元']],['breakthrough',['突破','冲击境界']]
];
const goodsAliases={wine:['青竹酒'],riceWine:['米酒'],petals:['月兰花瓣','花瓣'],dummy:['草人傀儡','草人'],food:['饭菜','食物'],water:['清水'],grass:['知心草']};
function normalize(text){return String(text||'').trim().replace(/[，。！？、,.!?\s]+/g,'').toLowerCase();}
function herePerson(s,id){const p=D.people[id];return !!p&&p.location===s.location&&(id!=='jiafu'||Math.floor(s.clock/24)+1>=12);}
function meets(s,req=[]){return req.every(([path,op,v])=>{let x=s;for(const k of path.split('.'))x=x?.[k];return op==='>='?x>=v:op==='<='?x<=v:op==='=='?x===v:op==='!='?x!==v:false;});}
function objectsFor(s){const base=(objects[s.location]||[]).filter(o=>!o.requires||meets(s,o.requires));if(s.location==='village'&&Math.floor(s.clock/24)+1>=12)base.push(P('jiafu','贾富','贾',72,41,{type:'social',id:'jiafu',mode:'chat'},'商队领头人。',{person:'jiafu'}));return base.map(o=>({...o,disabled:o.command?.type==='social'&&!herePerson(s,o.command.id)}));}
function voices(s){const out=[];const push=(voice,text,score)=>out.push({voice,text,score});
 if(s.location==='school'){
  push('记忆',s.v.studies>0?'古月师讲过：真元和资质决定起点，但考核只看你最后能做到什么。':'这里每个人都在被观察。学堂不是单纯教东西的地方。',s.v.memory);
  if(s.npcs.fangzheng?.favor>0)push('悟性','方正欠你的不是“好感”，而是一份可以在关键时候兑现的人情。',s.v.comprehension+8);
 }
 if(s.location==='bamboo'){
  push('悟性',s.weather==='雨'?'雨水会迅速冲淡酒香。现在用青竹酒引蛊，效果会差很多。':'这里的风会带走气味。酒香若有用，目标不会一直停在原地。',s.v.comprehension+10);
  if(s.v.clue>=20)push('记忆','你已经见过不止一处互相呼应的痕迹。它们都把方向指向河滩。',s.v.memory+12);
  if(herePerson(s,'fangyuan'))push('直觉','方源在这里。一个刚开窍的少年反复出现在竹林，本身就值得留意。',s.v.agility+6);
 }
 if(s.location==='river'){
  push('悟性',s.v.clue>=30?'线索已经足够。瀑布后那道石缝不再只是普通裂隙。':'流水会洗掉酒香，却留下地形本身不会改变的东西。',s.v.comprehension+8);
 }
 if(['crevice','cave'].includes(s.location))push('意志','继续向前并不困难。困难的是，你是否准备承担拿走东西之后的后果。',s.v.will+10);
 if(s.gu.moon&&s.gu.moon.tame<100)push('精神','月光蛊还没有真正属于你。你停手越久，它残余的意志越会把炼化成果一点点挤出去。',s.v.spirit+5);
 if(s.v.suspicion>=30)push('悟性','最近的举动已经开始形成一个可以被旁人串起来的模式。',s.v.comprehension+15);
 if(s.v.fatigue>=60)push('身体','呼吸变沉，动作也慢了。继续做需要耐心或敏捷的事，会越来越吃亏。',100-s.v.fatigue);
 return out.sort((a,b)=>b.score-a.score).slice(0,3);
}
function preview(s,command){if(!command)return'';if(command.type==='action'){
  if(command.id==='explore'){const p=clamp(s.v.danger/220+s.v.suspicion/500,.03,.65);return `探索会推进 3 小时 · 遭遇战风险约 ${Math.round(p*100)}%`;}
  if(command.id==='forage'){const p=clamp(s.v.danger/400,0,.5);return `寻找食物会推进 2 小时 · 中毒/受伤风险约 ${Math.round(p*100)}%`;}
  if(command.id==='breakthrough'){const p=clamp(.4+s.v.aptitude/250+s.v.will/350-s.v.injury/180-s.v.fatigue/250-(s.v.rank-1)*.06,.1,.95);return `突破成功率约 ${Math.round(p*100)}% · 失败会损失修为并受伤`;}
  if(command.id==='cultivate'){const bonus=s.v.rank===1?s.v.purity*.1:0,g=Math.max(2,(12+s.v.comprehension*.35+bonus)*(1-s.v.fatigue/150)*(1-s.v.injury/150)/(1+(s.v.rank-1)*.35));return `预计修为 +${g.toFixed(1)} · 消耗约 20% 真元`;}
  if(command.id==='lure')return `${s.weather==='雨'?'雨天：预计线索 +5':'预计线索 +18'} · 消耗 1 坛青竹酒`;
  const a=D.actions.find(x=>x.id===command.id);return a?`${a.name} · ${a.hours} 小时`:'';
 }
 if(command.type==='travel'){const p=D.locations[command.id];return p?`前往 ${p.name} · ${p.safe?'约 1':'约 2'} 小时`:'';}
 if(command.type==='social')return `与 ${D.people[command.id]?.name||'此人'} 交谈 · 2 小时`;
 if(command.type==='refine')return `炼化 ${D.gus[command.id]?.name||'蛊虫'} · 2 小时 · 至少需要 10 真元`;
 if(command.type==='feed')return `喂养 ${D.gus[command.id]?.name||'蛊虫'} · 1 小时`;
 if(command.type==='trade')return `${command.mode==='sell'?'卖出':'买入'} ${D.goods[command.id]?.name||command.id} ×${command.qty}`;
 return'';
}
function parse(text,s){const q=normalize(text);if(!q)return{ok:false,message:'先说你想做什么，例如“观察脚印”“跟着方源”“去河滩”。'};
 for(const[id,names]of Object.entries(placeAliases))if(names.some(n=>q.includes(normalize(n)))&&/(去|前往|回|走|进入|到)/.test(q)){if(id===s.location)return{ok:false,message:`你已经在${D.locations[id].name}。`};if(!D.locations[s.location].neighbors.includes(id))return{ok:false,message:`${D.locations[id].name}不在一步可达范围内。先选择相邻路线。`};return{ok:true,intent:'travel',label:`前往${D.locations[id].name}`,command:{type:'travel',id}};}
 for(const[id,names]of Object.entries(aliases))if(names.some(n=>q.includes(normalize(n)))){
   if(/(跟|跟踪|尾随|远远|盯着)/.test(q)&&id==='fangyuan'&&s.location==='bamboo')return{ok:true,intent:'follow',label:'远远跟着方源的动向',command:{type:'action',id:'explore'},note:'当前规则会把“跟踪”结算为竹林探索；AI 接入后可升级为独立意图。'};
   if(/(说|聊|问|谈|试探|打听|交流|交谈)/.test(q))return herePerson(s,id)?{ok:true,intent:'social',label:`与${D.people[id].name}交谈`,command:{type:'social',id,mode:'chat'}}:{ok:false,message:`${D.people[id].name}现在不在这里。`};
 }
 if(/炼化/.test(q)){if(q.includes('酒虫'))return s.gu.wine?{ok:true,label:'炼化酒虫',command:{type:'refine',id:'wine'}}:{ok:false,message:'你现在还没有酒虫。'};return{ok:true,label:'炼化月光蛊',command:{type:'refine',id:'moon'}};}
 if(/喂/.test(q)){if(q.includes('酒虫'))return s.gu.wine?{ok:true,label:'喂养酒虫',command:{type:'feed',id:'wine'}}:{ok:false,message:'你现在还没有酒虫。'};return{ok:true,label:'喂养月光蛊',command:{type:'feed',id:'moon'}};}
 for(const[id,names]of Object.entries(goodsAliases))if(names.some(n=>q.includes(normalize(n)))&&/(买|购买|来一|要一)/.test(q))return D.locations[s.location].market?{ok:true,label:`买${D.goods[id].name}`,command:{type:'trade',id,qty:1,mode:'buy'}}:{ok:false,message:'这里没有商铺。'};
 for(const[id,words]of actionLexicon)if(words.some(w=>q.includes(normalize(w))))return{ok:true,intent:id,label:D.actions.find(a=>a.id===id)?.name||id,command:{type:'action',id}};
 const nearby=objectsFor(s).filter(x=>!x.disabled).slice(0,4).map(x=>x.label).join('、');return{ok:false,message:`没有理解这个动作。你可以直接写“观察脚印”“和方正说话”“去河滩”“炼化月光蛊”。这里还能互动：${nearby||'暂无明显对象'}。`};}
return{VERSION:1,objects,aliases,objectsFor,voices,preview,parse,normalize};
});
