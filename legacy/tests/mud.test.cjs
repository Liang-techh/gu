'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../mud/data.js');
const E=require('../mud/upgrade.js');

function fresh(){
  const s=E.newGame({name:'测试者',grade:'甲等',seed:'mud-test'});
  const r=E.dispatch(s,{type:'event',id:'academy'});
  assert.equal(r.ok,true);
  s.seen=D.EVENTS.map(e=>e.id);
  s.event=null;
  return s;
}
function refill(s){
  s.p.hp=100;s.p.spirit=100;s.p.stamina=100;s.p.aperture.stability=100;s.p.aperture.essence=E.essenceMax(s);s.p.immortal=100;
  s.mat.immortalMaterial=100;s.mat.formation=100;s.mat.petal=100;s.mat.ore=100;s.mat.bone=100;s.mat.blood=100;s.mat.wine=100;
}
function refineMoon(s){
  const g=s.gu.find(x=>x.id==='moon');
  for(let i=0;i<8&&!g.refined;i++){
    s.p.aperture.essence=E.essenceMax(s);
    assert.equal(E.dispatch(s,{type:'refine',id:g.uid}).ok,true);
  }
  assert.equal(g.refined,true);
  return g;
}

test('new game begins in Guyue Village with an unrefined Moonlight Gu',()=>{
  const s=E.newGame({grade:'丙等',seed:'start'});
  assert.equal(s.loc,'village');
  assert.equal(s.p.rank,1);
  assert.match(D.LOCATIONS[s.loc].region,/青茅山/);
  assert.equal(s.gu.some(g=>g.id==='moon'&&!g.refined),true);
  assert.equal(E.context(s).mode,'event');
  assert.equal(E.choices(s).length,3);
});

test('opening choices alter persistent state',()=>{
  const a=E.newGame({seed:'branch'}),b=E.newGame({seed:'branch'});
  E.dispatch(a,{type:'event',id:'academy'});
  E.dispatch(b,{type:'event',id:'outside'});
  assert.notDeepEqual(a.flags,b.flags);
  assert.notEqual(a.p.clue,b.p.clue);
});

test('only following the wine trail unlocks the waterfall crevice',()=>{
  const hide=E.newGame({seed:'hide'});E.dispatch(hide,{type:'event',id:'outside'});hide.event='wineTrail';E.dispatch(hide,{type:'event',id:'hide'});
  assert.equal(Boolean(hide.flags.wineTrailFollow),false);
  const follow=E.newGame({seed:'follow'});E.dispatch(follow,{type:'event',id:'outside'});follow.event='wineTrail';E.dispatch(follow,{type:'event',id:'follow'});
  assert.equal(Boolean(follow.flags.wineTrailFollow),true);
  assert.equal(follow.ach.includes('wineSecret'),true);
});

test('refining the first Gu establishes the vital Gu',()=>{
  const s=fresh(),g=refineMoon(s);
  assert.equal(s.vital,g.uid);
  assert.equal(s.ach.includes('firstGu'),true);
});

test('mortal killer moves can be deduced from refined core Gu',()=>{
  const s=fresh();refineMoon(s);s.p.insight=100;
  const r=E.dispatch(s,{type:'learn',id:'moonChain'});
  assert.equal(r.ok,true);
  assert.equal(s.moves.includes('moonChain'),true);
  assert.equal(s.ach.includes('mortalMove'),true);
});

test('vital Gu survives fusion and transforms into the result',()=>{
  const s=fresh(),moon=refineMoon(s);s.p.stones=500;s.p.stats.refinement=100;s.p.stats.luck=100;
  s.loc='guRoom';s.mat.petal=100;s.mat.ore=100;
  for(let tries=0;tries<6&&!s.gu.some(g=>g.id==='moonGlow');tries++){
    if(!s.gu.some(g=>g.id==='littleLight'))assert.equal(E.dispatch(s,{type:'buy',kind:'gu',id:'littleLight',currency:'stones'}).ok,true);
    s.mat.petal=100;s.mat.ore=100;
    E.dispatch(s,{type:'fuse',id:'moonGlow'});
  }
  assert.equal(s.gu.find(g=>g.uid===moon.uid)?.id,'moonGlow');
  assert.equal(s.vital,moon.uid);
  assert.equal(s.ach.includes('fuse'),true);
});

test('equipment can be equipped into its slot',()=>{
  const s=fresh();
  assert.equal(E.dispatch(s,{type:'equip',id:'beastBracer'}).ok,true);
  assert.equal(s.equip.bracer,'beastBracer');
});

test('shops sell Gu and equipment for the correct currency',()=>{
  const s=fresh();s.loc='guRoom';s.p.stones=100;
  const before=s.p.stones;
  assert.equal(E.dispatch(s,{type:'buy',kind:'gu',id:'littleLight',currency:'stones'}).ok,true);
  assert.equal(s.gu.some(g=>g.id==='littleLight'),true);
  assert.ok(s.p.stones<before);
});

test('dungeon entry uses the unlocked dungeon state',()=>{
  const s=fresh();s.openDungeons.push('flowerWine');s.loc='inheritanceCave';
  assert.equal(E.dispatch(s,{type:'enter',id:'flowerWine'}).ok,true);
  assert.equal(s.dungeon.id,'flowerWine');
  assert.equal(E.context(s).mode,'dungeon');
});

test('clearing Flower Wine inheritance awards its achievement',()=>{
  const s=fresh();s.cleared.push('flowerWine');E.dispatch(s,{type:'train'});
  assert.equal(s.ach.includes('inheritanceOwner'),true);
});

test('sixth rank creates a blessed land and immortal economy',()=>{
  const s=fresh();s.p.rank=5;s.p.stage=3;s.p.progress=D.RANKS[5].threshold;s.p.aperture.aptitude=99;s.p.stats.will=100;refill(s);
  for(let i=0;i<12&&s.p.rank<6;i++){s.p.progress=D.RANKS[5].threshold;refill(s);E.dispatch(s,{type:'breakthrough'});s.event=null;}
  assert.equal(s.p.rank,6);
  assert.ok(s.land);
  assert.equal(s.ach.includes('immortal'),true);
  assert.equal(s.ach.includes('blessedLand'),true);
  assert.equal(s.openLoc.includes('immortalAuction'),true);
});

test('blessed land management changes its economy',()=>{
  const s=fresh();s.p.rank=6;s.land={name:'测试福地',stability:70,pool:1,nodes:1,formation:0,population:8,trib:60,last:s.time};s.p.immortal=5;
  assert.equal(E.dispatch(s,{type:'land',id:'develop'}).ok,true);
  assert.equal(s.land.nodes,2);
});

test('all nine ranks are reachable through the same breakthrough engine',()=>{
  const s=fresh();s.p.aperture.aptitude=99;s.p.stats.will=100;
  for(let guard=0;guard<120 && !(s.p.rank===9&&s.p.stage===3);guard++){
    s.event=null;s.seen=D.EVENTS.map(e=>e.id);s.p.progress=D.RANKS[s.p.rank].threshold;refill(s);
    E.dispatch(s,{type:'breakthrough'});
  }
  assert.equal(s.p.rank,9);
  assert.equal(s.p.stage,3);
  assert.equal(s.ach.includes('rankNine'),true);
});

test('rank-nine finale provides multiple endings',()=>{
  const s=fresh();s.p.rank=9;s.p.stage=3;s.event='rankNineFinal';
  const labels=E.choices(s).map(c=>c.label);
  assert.ok(labels.length>=6);
  assert.equal(E.dispatch(s,{type:'event',id:'clan'}).ok,true);
  assert.equal(s.ending,'clanGuardian');
});

test('Spring Autumn Cicada unlocks the hidden reverse-time ending',()=>{
  const s=fresh();s.p.rank=9;s.p.stage=3;s.event='rankNineFinal';
  s.gu.push({uid:'secret',id:'springAutumn',rank:6,refined:true,refine:100,hunger:0,hp:100,bond:100});
  assert.equal(E.choices(s).some(c=>c.id==='reverse'),true);
  assert.equal(E.dispatch(s,{type:'event',id:'reverse'}).ok,true);
  assert.equal(s.ending,'reverseTime');
  assert.equal(s.ach.includes('secretEnding'),true);
});

test('visiting all five major regions awards the travel achievement',()=>{
  const s=fresh();s.visited.push('central','north','east','west');E.dispatch(s,{type:'train'});
  assert.equal(s.ach.includes('fiveRegions'),true);
});

test('save roundtrip keeps progression, Gu, land, achievements and ending state',()=>{
  const s=fresh();refineMoon(s);s.p.stones=77;s.ach.push('wineSecret');
  const copy=E.load(E.save(s));
  assert.deepEqual(copy,s);
});
