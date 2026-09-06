/* Pure, deterministic, transactional game engine. No DOM, eval, network, or clock dependency. */
(function(root,factory){const e=factory(typeof module==='object'?require('./content.js'):root.GuContent);if(typeof module==='object')module.exports=e;else root.GuEngine=e;})(globalThis,D=>{
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const round=x=>Math.round(x*1000)/1000;
const eventMap=Object.fromEntries(D.events.map(e=>[e.id,e]));
const fail=m=>{throw new Error(m);};
function random(s){let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0||1;}
function day(s){return Math.floor(s.clock/24)+1;}
function capacity(s){return round(s.v.aptitude*(1+(s.v.rank-1)*.4+s.v.stage*.1));}
function add(s,values){for(const [k,n] of Object.entries(values||{})){const spec=D.variables[k];if(!spec)fail('未知变量：'+k);s.v[k]=round(clamp(s.v[k]+n,spec[2],spec[3]));}}
function read(s,path){const parts=path.split('.');let x=s;for(const p of parts){if(!x||!Object.hasOwn(x,p))return undefined;x=x[p];}return x;}
function meets(s,requirements=[]){return requirements.every(([p,op,value])=>{const a=read(s,p);if(a===undefined)return false;return op==='>='?a>=value:op==='<='?a<=value:op==='=='?a===value:op==='!='?a!==value:false;});}
function say(s,text,kind='action',source=''){s.log.push({at:s.clock,text,kind,source});if(s.log.length>160)s.log.shift();}
function remember(s,id,text){const n=s.npcs[id];n.memory.push({at:s.clock,text});if(n.memory.length>8)n.memory.shift();}
function relationship(s,id,values,reason){const n=s.npcs[id];if(!n)fail('未知人物');for(const[k,v]of Object.entries(values)){const lo=k==='trust'?-100:0;const hi=k==='resources'?9999:k==='favor'?20:100;n[k]=round(clamp(n[k]+v,lo,hi));}remember(s,id,reason);}
function schedule(s,id,delay,source){if(!eventMap[id])fail('未知事件');if(!s.queue.some(q=>q.id===id)&&s.pending?.id!==id)s.queue.push({id,due:s.clock+delay,source});}
function gu(s,id){if(!D.gus[id])fail('未知蛊虫');if(!s.gu[id])s.gu[id]={tame:0,hunger:0,health:100,practice:0,uses:0,vital:false,lastFed:s.clock};}
function newGame({grade='丙等',seed='青茅山',name='古月族人'}={}){
 if(!Object.hasOwn(D.grades,grade))fail('请选择甲、乙、丙、丁中的一种资质');
 const v=Object.fromEntries(Object.entries(D.variables).map(([id,a])=>[id,a[1]]));v.aptitude=D.grades[grade];v.essence=v.aptitude;
 const s={version:D.VERSION,name:String(name).trim().slice(0,20)||'古月族人',seed:String(seed).slice(0,80),rng:hash(seed),clock:6,alive:true,location:'school',weather:'晴',autoFeed:true,autoEat:true,v,bag:{food:6,water:6,petals:20,wine:1,riceWine:0,grass:0,dummy:0},market:{},gu:{},npcs:{},flags:Object.fromEntries(D.flagKeys.map(k=>[k,''])),seen:{},queue:[],pending:{id:'opening',source:'开窍之后'},combat:null,log:[],history:[],visited:['school'],lastSocial:{},ledger:{actions:0,choices:0,spent:0,earned:0,feeds:0,combatTurns:0}};
 for(const[k,g]of Object.entries(D.goods))s.market[k]=g.stock;
 for(const[k,n]of Object.entries(D.people))s.npcs[k]={trust:n.trust,fear:0,anger:0,favor:0,resources:n.resources,power:12,progress:0,memory:[]};
 gu(s,'moon');
 for(const[id,h]of [['classmate',24],['purse',48],['patron',72],['exam',168],['caravan',264],['chapterEnd',552]])schedule(s,id,h,'开窍后的日程');
 say(s,'你已开窍。原著人物与用词保持出处；你的选择将展开不同于原著的分支。','story');return s;
}
function feed(s,id,quiet=false){
 const g=s.gu[id],spec=D.gus[id];if(!g||g.health<=0)fail('没有可喂养的蛊虫');if(g.hunger<15&&!quiet)fail('它现在还不饿，不必浪费食料');
 if(id==='moon'){
  if(s.bag.grass>=1&&s.bag.petals>=1){s.bag.grass--;s.bag.petals--;}
  else if(s.bag.petals>=2)s.bag.petals-=2;else{if(quiet)return false;fail('需要两片月兰花瓣，或一片花瓣加一根知心草');}
 }else if(s.bag.wine>=1)s.bag.wine--;
 else if(s.bag.riceWine>=3){s.bag.riceWine-=3;g.hunger=75;g.lastFed=s.clock;s.ledger.feeds++;return true;}
 else{if(quiet)return false;fail('需要青竹酒，或三坛米酒');}
 g.hunger=0;g.health=clamp(g.health+2,0,100);g.lastFed=s.clock;s.ledger.feeds++;
 if(!quiet)say(s,`你喂养了${spec.name}。`,'good');return true;
}
function normalize(s){s.v.essence=clamp(s.v.essence,0,capacity(s));for(const k of Object.keys(s.v)){const[, ,lo,hi]=D.variables[k];s.v[k]=round(clamp(s.v[k],lo,hi));}if(s.v.health<=0&&s.alive){s.alive=false;s.pending=null;s.combat=null;say(s,'你的身体再也无法支撑。此局结束；可查看往事、读取存档，或重新开局。','bad');}}
function tick(s,hours){
 for(let i=0;i<hours&&s.alive;i++){
  s.clock++;
  add(s,{hunger:1.15,thirst:1.5,fatigue:.7,essence:s.v.aptitude/11,spirit:.25});
  if(s.autoEat){if(s.v.hunger>45&&s.bag.food>0){s.bag.food--;add(s,{hunger:-35});}if(s.v.thirst>45&&s.bag.water>0){s.bag.water--;add(s,{thirst:-40});}}
  if(s.v.hunger>80)add(s,{health:-2});if(s.v.thirst>80)add(s,{health:-3});if(s.v.fatigue>92)add(s,{health:-1,spirit:-2});
  if(s.v.poison>0)add(s,{health:-s.v.poison/30,poison:-.1});
  for(const[id,g]of Object.entries(s.gu)){
   if(g.health<=0)continue;
   if(g.tame<100&&g.tame>0)g.tame=round(Math.max(0,g.tame-1.5));
   g.hunger=round(clamp(g.hunger+100/D.gus[id].interval,0,100));
   if(s.autoFeed&&g.hunger>=99)feed(s,id,true);
   if(g.hunger>=100){g.health=clamp(g.health-2,0,100);if(g.health===0){say(s,`${D.gus[id].name}因断粮而死亡。`,'bad');if(g.vital)add(s,{health:-35,injury:20});}}
  }
  if(s.clock%24===0){
   s.weather=D.weather[Math.floor(random(s)*D.weather.length)];add(s,{danger:random(s)<.4?1:-.3,supply:-.5});
   for(const n of Object.values(s.npcs)){n.progress=round(n.progress+3);n.resources=round(Math.min(9999,n.resources+.25));if(n.progress>=100){n.progress-=100;n.power=clamp(n.power+2,0,100);}}
   if(day(s)%7===0){for(const[k,g]of Object.entries(D.goods))s.market[k]=Math.min(g.stock*2,s.market[k]+Math.ceil(g.stock*.35));s.market.petals+=Math.floor(s.v.caravanStock/4);if(s.v.reputation>=0&&s.flags.patron!=='broken'){add(s,{stones:3});s.ledger.earned+=3;say(s,'学堂发下三块元石补贴。','good');}}
   if(day(s)===12){add(s,{supply:20});for(const[k,g]of Object.entries(D.goods))s.market[k]+=g.stock;s.market.wine=Math.max(0,s.market.wine-7);say(s,'商队到了，食料补入铺子，但青竹酒也被收购了一批。','world');}
  }
  normalize(s);
 }
}
function availableEvent(s,e){return(!e.locations||e.locations.includes(s.location))&&meets(s,e.requires);}
function pump(s){
 if(!s.alive||s.pending||s.combat)return;
 for(const id of ['trail','inheritance','shortage'])if(!s.seen[id]&&availableEvent(s,eventMap[id])&&(id!=='shortage'||day(s)>2))schedule(s,id,0,'你当前的处境');
 if(s.v.suspicion>=65&&!s.seen.audit)schedule(s,'audit',0,'积累的怀疑');
 s.queue.sort((a,b)=>a.due-b.due);
 for(let i=0;i<s.queue.length;i++){
  const q=s.queue[i];if(q.due>s.clock)continue;
  if(['debtDue','collection'].includes(q.id)&&s.v.debt<=0){s.queue.splice(i--,1);continue;}
  if(availableEvent(s,eventMap[q.id])){s.pending={id:q.id,source:q.source};s.queue.splice(i,1);break;}
 }
}
function startCombat(s,kind){
 const rival=kind==='rival',rank=s.v.rank;
 const power=rival?Math.max(s.npcs.fangyuan.power,s.npcs.mobei.power)+Math.max(s.npcs.fangyuan.anger,s.npcs.mobei.anger)/10:9+s.v.hunts*.3+s.v.victories*.08;
 s.combat={kind,name:rival?'蛊师':'黑皮野猪',health:Math.round((rival?48:36)+rank*5),maxHealth:Math.round((rival?48:36)+rank*5),attack:Math.round(power*.55+rank*2),round:0};
 say(s,`你遭遇了${s.combat.name}。可逐回合攻击、防守，或选择逃离。`,'bad');
}
function price(s,id,selling=false){if(!D.goods[id])fail('未知物资');const base=D.goods[id].price;const discount=clamp((s.npcs.jiangya.trust+s.v.caravanTrust)/700,-.2,.15);const markup=1+(70-s.v.supply)/200+s.v.suspicion/300;
 const p=base*markup*(1-discount);return Math.max(.01,Math.round(p*(selling?.5:1)*100)/100);}
function choiceReason(s,c){
 if(!meets(s,c.requires))return '尚未满足条件';
 for(const[k,v]of Object.entries(c.effects.add||{}))if(v<0&&['stones','essence'].includes(k)&&s.v[k]<-v)return `${D.variables[k][0]}不足`;
 for(const[k,v]of Object.entries(c.effects.items||{}))if(v<0&&s.bag[k]<-v)return `${D.goods[k].name}不足`;
 if(c.effects.special==='repay'&&s.v.stones<s.v.debt)return `需 ${s.v.debt.toFixed(2)} 块元石`;
 return '';
}
function effects(s,f,reason){
 add(s,f.add);for(const[k,n]of Object.entries(f.items||{}))s.bag[k]+=n;
 for(const[id,values]of Object.entries(f.relation||{}))relationship(s,id,values,reason);
 for(const[k,value]of Object.entries(f.set||{})){if(!D.flagKeys.includes(k))fail('未知剧情记录');s.flags[k]=value;}
 if(f.gu)gu(s,f.gu);
 if(f.special==='repay'){add(s,{stones:-s.v.debt,debt:-s.v.debt});s.queue=s.queue.filter(q=>!['debtDue','collection'].includes(q.id));}
 if(f.special==='interest')add(s,{debt:Math.max(.5,s.v.debt*.1)});
 if(f.special==='exam'){
  const score=s.v.combatSkill+s.v.memory*.6+s.v.knowledge*.3+Math.min(s.v.studies,20)*.3+s.v.readiness*.2-s.v.fatigue*.25-s.v.injury*.3;
  if(score>=28){add(s,{stones:10,reputation:10});relationship(s,'elder',{trust:8},'月刃考核表现出色');s.flags.exam='passed';say(s,'你通过了考核，领取十块元石奖励。','good');}
  else{add(s,{reputation:-2});s.flags.exam='failed';say(s,'你的表现还不够稳。考核奖励未能到手，但练习仍会保留。','bad');}
 }
 if(f.special==='conceal'){
  const chance=clamp((s.v.secrecy+s.v.patience-s.v.suspicion*.4)/130,.1,.9);
  if(random(s)<chance){add(s,{secrecy:5});say(s,'你没有露出明显破绽。','good');}
  else{add(s,{suspicion:12,secrecy:-15});schedule(s,'audit',48,'隐瞒遗藏时露出的破绽');say(s,'你的说辞出现矛盾，消息将向家族传去。','bad');}
 }
 if(f.special==='escapeEvent'){
  if(random(s)<clamp(.35+s.v.agility/100+s.v.readiness/200-s.v.fatigue/200,.1,.9)){add(s,{fatigue:12,readiness:-8});}
  else{s.flags.ambush='caught';startCombat(s,'rival');}
 }
 for(const[id,h]of f.schedule||[])schedule(s,id,h,reason);
 if(f.combat)startCombat(s,f.combat);
 normalize(s);
}
function combatTurn(s,id){
 const c=s.combat;if(!c)fail('现在没有战斗');if(!['strike','moon','guard','escape'].includes(id))fail('未知战斗选择');
 let damage=0;
 if(id==='moon'){
  const g=s.gu.moon;if(!g||g.tame<100||g.health<=0)fail('需要已经炼化且存活的月光蛊');if(s.v.essence<8)fail('真元不足，需要八点真元');
  add(s,{essence:-8});g.uses++;g.practice=clamp(g.practice+1,0,100);damage=12+s.v.combatSkill*.32+g.practice*.1+s.v.rank*4+s.v.stage*2;
 }else if(id==='strike')damage=4+s.v.strength*.55+s.v.rank*2;
 else if(id==='escape'){
  if(random(s)<clamp(.35+s.v.agility/100+s.v.readiness/200-s.v.fatigue/200,.1,.9)){say(s,'你成功脱离了战斗。','good');s.combat=null;add(s,{fatigue:6});tick(s,1);return;}
  say(s,'这一次没能脱身。','bad');
 }
 c.round++;s.ledger.combatTurns++;
 damage=Math.round(damage*(.85+random(s)*.3)*(1-s.v.fatigue/250));c.health=Math.max(0,c.health-damage);
 if(damage)say(s,`你对${c.name}造成 ${damage} 点伤害。`,'combat');
 if(c.health<=0){
  add(s,{victories:1,fame:2,readiness:-5});if(c.kind==='boar'){s.bag.food+=4;add(s,{strength:1});say(s,'狩猎成功，获得四份食物。','good');}
  else{add(s,{stones:2,infamy:2});relationship(s,'fangyuan',{fear:5},'你从争斗中胜出');say(s,'对方退走，你取回了两块元石。','good');}
  s.combat=null;tick(s,1);return;
 }
 const incoming=Math.max(1,Math.round((c.attack+c.round*.35+s.v.injury*.03-s.v.readiness*.03)*(id==='guard'?.35:1)));
 add(s,{health:-incoming,fatigue:1.5,readiness:-1});say(s,`${c.name}反击，身体受损 ${incoming} 点。`,'bad');normalize(s);
}
function actionReason(s,id){
 const a=D.actions.find(a=>a.id===id);if(!a)return '未知行动';if(a.locations&&!a.locations.includes(s.location))return '这里不能进行这项行动';
 if(id==='train'&&(!s.gu.moon||s.gu.moon.tame<100||s.gu.moon.health<=0))return '先炼化月光蛊';
 if(id==='train'&&s.v.essence<8)return '真元不足';
 if(id==='cultivate'&&s.v.essence<capacity(s)*.2)return '真元不足，先冥想、休息或汲取元石';
 if(id==='cultivate'&&s.v.progress>=100)return '修为已满，请尝试突破';
 if(id==='lure'&&s.bag.wine<1)return '需要一坛青竹酒';
 if(['heal','absorb'].includes(id)&&s.v.stones<1)return '需要一块元石';
 if(id==='breakthrough'&&s.v.progress<100)return '修为尚未达到一百';
 if(id==='breakthrough'&&s.v.rank===5&&s.v.stage===3)return '本版修行至五转巅峰，六转系统尚未开放';
 return '';
}
function simpleAction(s,id){
 const reason=actionReason(s,id);if(reason)fail(reason);
 const a=D.actions.find(a=>a.id===id);let msg='你'+a.name+'。';
 switch(id){
 case 'cultivate':{const bonus=s.v.rank===1?s.v.purity*.1:0;const gain=Math.max(2,(12+s.v.comprehension*.35+bonus)*(1-s.v.fatigue/150)*(1-s.v.injury/150)/(1+(s.v.rank-1)*.35));add(s,{essence:-capacity(s)*.2,progress:gain,purity:-8,fatigue:4});msg=`你温养空窍，修为增加 ${gain.toFixed(1)}。`;break;}
 case 'study':add(s,{knowledge:4+s.v.memory*.05,memory:.35,comprehension:.25,studies:1});relationship(s,'elder',{trust:.5},'你来学堂听课');break;
 case 'train':{const bonus=s.bag.dummy>0?3:0;add(s,{essence:-8,combatSkill:3+bonus,training:1,agility:.4,fatigue:4});s.gu.moon.practice=clamp(s.gu.moon.practice+2,0,100);s.gu.moon.uses++;if(s.bag.dummy>0&&s.v.training%5===0){s.bag.dummy--;msg='经过多次练习，一具草人傀儡损坏了。';}break;}
 case 'meditate':add(s,{spirit:D.locations[s.location].safe?16:8,patience:.5,fatigue:-3});break;
 case 'work':{const pay=.8+Math.max(0,s.v.reputation)/100;if(s.flags.debtDue==='labor'&&s.v.debt>0){add(s,{debt:-Math.min(s.v.debt,pay)});msg='这次劳作抵扣了欠债，没有获得现钱。';if(s.v.debt<=0)s.flags.debtDue='paid';}else{add(s,{stones:pay});s.ledger.earned+=pay;msg=`你做完杂务，得到 ${pay.toFixed(2)} 块元石。`;}add(s,{fatigue:4,reputation:.3});break;}
 case 'explore':add(s,{clue:4+s.v.agility*.06,explorations:1,fatigue:5,secrecy:-.5});if(random(s)<clamp(s.v.danger/220+s.v.suspicion/500,.03,.65)){startCombat(s,'boar');}break;
 case 'lure':s.bag.wine--;add(s,{clue:s.weather==='雨'?5:18,secrecy:-3});msg=s.weather==='雨'?'雨水冲散酒香，只得到少许线索。':'你洒下青竹酒，留意竹林中的动静。';break;
 case 'hunt':add(s,{hunts:1,fatigue:4});startCombat(s,'boar');break;
 case 'forage':s.bag.food+=2;if(random(s)<s.v.danger/400)add(s,{poison:5,health:-3});break;
 case 'water':s.bag.water+=3;break;
 case 'rest':add(s,{fatigue:-55,health:22,injury:-4,spirit:20});break;
 case 'heal':add(s,{stones:-1,health:12,injury:-20,poison:-40});break;
 case 'prepare':add(s,{readiness:15,will:.3});break;
 case 'absorb':add(s,{stones:-1,essence:capacity(s)});break;
 case 'breakthrough':{
  const p=clamp(.4+s.v.aptitude/250+s.v.will/350-s.v.injury/180-s.v.fatigue/250-(s.v.rank-1)*.06,.1,.95);
  if(random(s)<p){if(s.v.stage<3)s.v.stage++;else{s.v.stage=0;s.v.rank++;}s.v.progress=0;add(s,{reputation:3});msg='空窍发生变化，你突破了原有境界。';}
  else{add(s,{progress:-25,health:-8,injury:8});msg='突破失败，空窍受到冲击。你的修行并未归零。';}break;}
 }
 say(s,msg,'action');tick(s,a.hours);
}
function dispatch(input,command){
 const s=clone(input);try{
  if(!command||typeof command.type!=='string')fail('无效指令');
  const before=clone(s);const id=command.id;
  if(command.type==='setting'){if(!['autoFeed','autoEat'].includes(id)||typeof command.value!=='boolean')fail('无效设置');s[id]=command.value;return {ok:true,state:s,message:'设置已修改'};}
  if(!s.alive)fail('此局已经结束');
  if(s.pending&&command.type!=='choice')fail('请先处理眼前的事情');
  if(s.combat&&command.type!=='combat')fail('请先完成战斗或逃离');
  let description='',kind='action';
  if(command.type==='choice'){
   if(!s.pending)fail('现在没有待选事件');const e=eventMap[s.pending.id],c=e.choices.find(c=>c.id===id);if(!c)fail('无效选项');const reason=choiceReason(s,c);if(reason)fail(reason);
   const from=s.pending.source;s.pending=null;s.seen[e.id]=(s.seen[e.id]||0)+1;description=e.title+'：'+c.label;kind='choice';
   effects(s,c.effects,description);say(s,c.text,'story',from);s.ledger.choices++;
  }else if(command.type==='action'){simpleAction(s,id);description=D.actions.find(a=>a.id===id).name;}
  else if(command.type==='combat'){combatTurn(s,id);description='战斗：'+({strike:'攻击',moon:'月刃',guard:'防守',escape:'逃离'}[id]||id);}
  else if(command.type==='travel'){
   const place=D.locations[id];if(!place||!D.locations[s.location].neighbors.includes(id))fail('只能前往相邻地点');if(!meets(s,place.require))fail('还不知道如何进入，需要更多线索');
   s.location=id;if(!s.visited.includes(id))s.visited.push(id);add(s,{fatigue:place.safe?1:3});description='前往'+place.name;say(s,description+'。');tick(s,place.safe?1:2);
  }else if(command.type==='refine'){
   const g=s.gu[id];if(!g||g.health<=0)fail('没有这只活蛊');if(g.tame>=100)fail('它已经炼化');if(s.v.essence<10)fail('至少需要十点真元');
   const gain=9+s.v.refineSkill*.3+s.v.aptitude/9+s.v.patience/12+s.v.spirit/30;
   add(s,{essence:-10,refineSkill:.8,spirit:-4});g.tame=clamp(g.tame+gain,0,100);
   if(g.tame>=100){if(!Object.values(s.gu).some(x=>x.vital))g.vital=true;say(s,`${D.gus[id].name}炼化成功${g.vital?'，成为你的本命蛊':''}。`,'good');}
   else{say(s,`炼化进度增加 ${gain.toFixed(1)}；停手后，尚存的蛊虫意志仍会反抗。`);if(random(s)<.06){add(s,{health:-Math.max(1,5-s.v.refineSkill*.03)});say(s,'炼化时受到轻微反噬。','bad');}}
   description='炼化'+D.gus[id].name;tick(s,2);
  }else if(command.type==='feed'){feed(s,id);description='喂养'+D.gus[id].name;tick(s,1);}
  else if(command.type==='purify'){
   const g=s.gu.wine;if(!g||g.tame<100||g.health<=0)fail('需要炼化酒虫');if(s.v.rank!==1)fail('这只一转酒虫不能精炼你当前境界的真元');if(s.v.essence<10)fail('真元不足');
   add(s,{essence:-10,purity:25});g.uses++;g.practice=clamp(g.practice+1,0,100);description='以酒虫精炼真元';say(s,description+'。');tick(s,1);
  }else if(command.type==='eat'){
   if(!['food','water'].includes(id)||s.bag[id]<1)fail('缺少食物或清水');s.bag[id]--;add(s,id==='food'?{hunger:-35}:{thirst:-40});description='使用'+D.goods[id].name;
  }else if(command.type==='trade'){
   if(!D.locations[s.location].market)fail('这里没有商铺');if(!Object.hasOwn(D.goods,id))fail('未知物资');const qty=command.qty;if(!Number.isInteger(qty)||qty<1||qty>99)fail('数量必须为一至九十九的整数');
   if(!['buy','sell'].includes(command.mode))fail('无效交易方向');const selling=command.mode==='sell',p=price(s,id,selling),total=round(p*qty);
   if(selling){if(s.bag[id]<qty)fail('行囊中数量不足');s.bag[id]-=qty;s.market[id]+=qty;add(s,{stones:total});s.ledger.earned+=total;}
   else{if(s.market[id]<qty)fail('铺子存货不足');if(s.v.stones<total)fail('元石不足');s.market[id]-=qty;s.bag[id]+=qty;add(s,{stones:-total});s.ledger.spent+=total;}
   description=(selling?'卖出':'买入')+D.goods[id].name+' × '+qty;say(s,description+'，共 '+total.toFixed(2)+' 块元石。');tick(s,1);
  }else if(command.type==='social'){
   const p=D.people[id];if(!p||p.location!==s.location||(id==='jiafu'&&day(s)<12))fail('此人不在这里');const n=s.npcs[id];
   if(s.clock-(s.lastSocial[id]??-100)<6)fail('刚刚交谈过，过六个小时再来');
   const mode=command.mode;if(mode==='gift'){if(s.v.stones<1)fail('至少需要一块元石');add(s,{stones:-1});relationship(s,id,{trust:4,anger:-3,resources:1},'你赠送了一块元石');}
   else if(mode==='ask'){if(n.trust<15||n.favor<1||n.resources<2)fail('尚无可兑现的人情，或对方没有余力');add(s,{stones:2});relationship(s,id,{favor:-1,resources:-2},'他以元石回报了你先前的帮助');}
   else if(mode==='chat'){relationship(s,id,{trust:1.5+Math.max(0,s.v.fame)/100},'你们谈过修行和近况');if(id==='fangyuan')add(s,{clue:2,secrecy:-1});}
   else fail('未知交际方式');s.lastSocial[id]=s.clock;description='与'+p.name+'交谈';say(s,description+'。');tick(s,2);
  }else fail('未知指令');
  s.ledger.actions++;normalize(s);
  const changes=[];for(const[k,v]of Object.entries(s.v))if(Math.abs(v-before.v[k])>.001)changes.push(`${D.variables[k][0]} ${v-before.v[k]>=0?'+':''}${round(v-before.v[k])}`);
  for(const[k,v]of Object.entries(s.bag))if(v!==before.bag[k])changes.push(`${D.goods[k].name} ${v-before.bag[k]>=0?'+':''}${v-before.bag[k]}`);
  for(const[k,n]of Object.entries(s.npcs))for(const field of ['trust','fear','anger','favor'])if(n[field]!==before.npcs[k][field])changes.push(`${D.people[k].name}·${{trust:'信任',fear:'畏惧',anger:'敌意',favor:'人情'}[field]} ${round(n[field]-before.npcs[k][field])>=0?'+':''}${round(n[field]-before.npcs[k][field])}`);
  const flags=Object.keys(s.flags).filter(k=>s.flags[k]!==before.flags[k]).map(k=>({key:k,before:before.flags[k],after:s.flags[k]}));
  s.history.push({at:before.clock,description,kind,changes,flags});if(s.history.length>400)s.history.shift();pump(s);
  return {ok:true,state:s,message:description};
 }catch(e){return {ok:false,state:input,message:e.message||'操作失败'};}
}
function validate(raw){
 if(typeof raw!=='string'||raw.length>1500000)fail('存档为空或超过大小限制');
 let s;try{s=JSON.parse(raw);}catch{fail('存档不是有效 JSON');}
 const inspect=(x,depth=0)=>{if(depth>16)fail('存档层级过深');if(typeof x==='number'&&!Number.isFinite(x))fail('存档包含无效数字');if(typeof x==='string'&&x.length>4000)fail('存档文本过长');if(x&&typeof x==='object'){if(Array.isArray(x)&&x.length>1000)fail('存档数组过长');for(const k of Object.keys(x)){if(['__proto__','prototype','constructor'].includes(k))fail('存档包含危险字段');inspect(x[k],depth+1);}}};inspect(s);
 if(!s||s.version!==D.VERSION)fail('这是旧版或未知版本存档；旧版存档不会被覆盖，请在旧版游戏中打开');
 const requireObject=(x,label)=>{if(!x||typeof x!=='object'||Array.isArray(x))fail(label+'结构不完整');};
 const exact=(x,keys,label)=>{requireObject(x,label);if(Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))fail(label+'字段不匹配');};
 const number=(x,lo,hi,integer=false)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi||(integer&&!Number.isInteger(x)))fail('存档数字越界');};
 const template=newGame();exact(s,Object.keys(template),'存档');exact(s.v,Object.keys(D.variables),'变量');
 for(const[k,[,,lo,hi]]of Object.entries(D.variables))number(s.v[k],lo,hi,['rank','stage'].includes(k));
 if(s.v.essence>capacity(s)+.001)fail('真元超过空窍容量');
 for(const key of ['bag','market']){exact(s[key],Object.keys(D.goods),key);for(const n of Object.values(s[key]))number(n,0,99999,true);}
 if(!Object.hasOwn(D.locations,s.location)||!D.weather.includes(s.weather))fail('地点或天气不合法');
 for(const k of ['alive','autoFeed','autoEat'])if(typeof s[k]!=='boolean')fail('存档状态不合法');
 if(typeof s.name!=='string'||s.name.length>20||typeof s.seed!=='string'||s.seed.length>80)fail('名字或种子不合法');
 number(s.clock,0,10000000,true);number(s.rng,1,4294967295,true);
 exact(s.flags,D.flagKeys,'剧情标记');for(const v of Object.values(s.flags))if(typeof v!=='string'||v.length>40)fail('剧情标记不合法');
 exact(s.npcs,Object.keys(D.people),'人物');
 for(const n of Object.values(s.npcs)){exact(n,['trust','fear','anger','favor','resources','power','progress','memory'],'人物状态');for(const k of ['trust','fear','anger','favor','resources','power','progress'])number(n[k],k==='trust'?-100:0,k==='resources'?9999:k==='favor'?20:100);if(!Array.isArray(n.memory)||n.memory.length>8)fail('人物记忆不合法');for(const m of n.memory){if(!m||typeof m.text!=='string')fail('人物记忆不完整');number(m.at,0,s.clock,true);}}
 requireObject(s.gu,'蛊虫');let vital=0;for(const[id,g]of Object.entries(s.gu)){if(!D.gus[id])fail('未知蛊虫');exact(g,['tame','hunger','health','practice','uses','vital','lastFed'],'蛊虫');for(const k of ['tame','hunger','health','practice'])number(g[k],0,100);number(g.uses,0,999999,true);number(g.lastFed,0,s.clock,true);if(typeof g.vital!=='boolean')fail('本命蛊标记不合法');if(g.vital)vital++;}if(vital>1)fail('只能有一只本命蛊');
 requireObject(s.seen,'事件记录');for(const[k,n]of Object.entries(s.seen)){if(!eventMap[k])fail('未知事件记录');number(n,1,99999,true);}
 if(!Array.isArray(s.queue)||s.queue.length>100)fail('待办事件无效');for(const q of s.queue){if(!q||!eventMap[q.id]||typeof q.source!=='string')fail('待办事件不完整');number(q.due,0,10000000,true);}
 if(s.pending!==null&&(!s.pending||!eventMap[s.pending.id]||typeof s.pending.source!=='string'))fail('当前事件无效');
 if(s.combat!==null){const c=s.combat;exact(c,['kind','name','health','maxHealth','attack','round'],'战斗');if(!['boar','rival'].includes(c.kind)||typeof c.name!=='string')fail('战斗无效');number(c.maxHealth,1,10000);number(c.health,1,c.maxHealth);number(c.attack,1,10000);number(c.round,0,999999,true);}
 if(s.pending&&s.combat)fail('事件与战斗状态冲突');
 if(!Array.isArray(s.visited)||!s.visited.every(id=>Object.hasOwn(D.locations,id)))fail('探索记录无效');
 for(const key of ['log','history'])if(!Array.isArray(s[key]))fail('日志不完整');
 for(const l of s.log){if(!l||typeof l.text!=='string'||typeof l.kind!=='string'||typeof l.source!=='string')fail('日志条目无效');number(l.at,0,s.clock,true);}
 for(const h of s.history){if(!h||typeof h.description!=='string'||typeof h.kind!=='string'||!Array.isArray(h.changes)||!h.changes.every(v=>typeof v==='string')||!Array.isArray(h.flags))fail('往事记录无效');number(h.at,0,s.clock,true);for(const f of h.flags)if(!f||!D.flagKeys.includes(f.key)||typeof f.before!=='string'||typeof f.after!=='string')fail('往事标记无效');}
 requireObject(s.lastSocial,'交际间隔');for(const[k,n]of Object.entries(s.lastSocial)){if(!D.people[k])fail('未知交际对象');number(n,0,s.clock,true);}
 exact(s.ledger,Object.keys(template.ledger),'账目');for(const n of Object.values(s.ledger))number(n,0,100000000);
 if(s.v.health<=0&&s.alive)fail('生死状态冲突');return s;
}
function stats(s){let fields=Object.keys(s.v).length+Object.keys(s.bag).length+Object.keys(s.market).length+Object.keys(s.flags).length+Object.keys(s.ledger).length;fields+=Object.keys(s.npcs).length*7+Object.keys(s.gu).length*7;return {fields,events:D.events.length,choices:D.events.reduce((n,e)=>n+e.choices.length,0),day:day(s)};}
return {newGame,dispatch,validate,day,capacity,price,choiceReason,actionReason,meets,stats,events:eventMap,clone};
});
