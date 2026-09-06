/* MUD v1.1 compatibility/branch patch. Keeps the deterministic core intact while fixing route gates and missing achievement/endings. */
(function(root,factory){
  const mod=typeof module==='object'&&module.exports;
  const D=mod?require('./data.js'):root.GuMudData;
  const Base=mod?require('./engine.js'):root.GuMudEngine;
  const E=factory(D,Base);
  if(mod)module.exports=E;else root.GuMudEngine=E;
})(globalThis,(D,Base)=>{
'use strict';
if(!D||!Base)return Base;
const trail=D.EVENTS.find(e=>e.id==='wineTrail');
if(trail){
  const follow=trail.choices.find(c=>c.id==='follow'),hide=trail.choices.find(c=>c.id==='hide'),report=trail.choices.find(c=>c.id==='report');
  if(follow)follow.effects.flag=['wineTrailFollow','yes'];
  if(hide)hide.effects.flag=['wineTrailHidden','yes'];
  if(report)report.effects.flag=['wineTrailReported','yes'];
}
if(D.LOCATIONS.crevice)D.LOCATIONS.crevice.requiresFlag='wineTrailFollow';
if(D.ACHIEVEMENTS.inheritanceOwner){D.ACHIEVEMENTS.inheritanceOwner.name='遗藏到手';D.ACHIEVEMENTS.inheritanceOwner.desc='首次通关花酒遗藏。';}
const finale=D.EVENTS.find(e=>e.id==='rankNineFinal');
if(finale){
  if(!finale.choices.some(c=>c.id==='demon'))finale.choices.splice(1,0,{id:'demon',label:'不受任何势力束缚',text:'把家族、门派和盟约都留在身后。',ending:'demonWanderer'});
  if(!finale.choices.some(c=>c.id==='summit'))finale.choices.push({id:'summit',label:'只求九转之巅',text:'不建立新的秩序，只留下自己抵达巅峰的事实。',ending:'rankNine'});
}
function award(s,id){
  if(!D.ACHIEVEMENTS[id]||s.ach.includes(id))return;
  s.ach.push(id);
  s.log.unshift({time:s.time,text:`成就「${D.ACHIEVEMENTS[id].name}」`,kind:'achievement'});
}
function migrate(s){
  if(!s)return s;
  if(s.flags?.wineTrail==='follow'&&!s.flags.wineTrailFollow)s.flags.wineTrailFollow='yes';
  if(s.flags?.wineTrail==='hide'&&!s.flags.wineTrailHidden)s.flags.wineTrailHidden='yes';
  if(s.flags?.wineTrail==='report'&&!s.flags.wineTrailReported)s.flags.wineTrailReported='yes';
  post(s);
  return s;
}
function majorRegion(name){
  for(const r of ['南疆','中洲','北原','东海','西漠'])if(String(name).includes(r))return r;
  return '';
}
function post(s){
  if(s.flags?.wineTrailFollow)award(s,'wineSecret');
  if(s.cleared?.includes('flowerWine'))award(s,'inheritanceOwner');
  const regions=new Set((s.visited||[]).map(id=>majorRegion(D.LOCATIONS[id]?.region)).filter(Boolean));
  if(['南疆','中洲','北原','东海','西漠'].every(r=>regions.has(r)))award(s,'fiveRegions');
}
const E={...Base};
E.newGame=opts=>{
  const s=Base.newGame(opts);
  s.loc='village';
  s.visited=['village'];
  return migrate(s);
};
E.load=raw=>migrate(Base.load(raw));
E.dispatch=(s,c)=>{
  const r=Base.dispatch(s,c);
  if(r.ok)post(s);
  return r;
};
return E;
});
