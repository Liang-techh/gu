'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../src/content.js');
const N=require('../src/narrative.js');

test('every current location has visual metadata',()=>{
  for(const id of Object.keys(D.locations)) assert.ok(N.scenes[id],`missing scene ${id}`);
});

test('every current person has a portrait and dialogue topics',()=>{
  for(const id of Object.keys(D.people)){
    assert.ok(N.portraits[id],`missing portrait ${id}`);
    assert.ok(N.topicsFor(id).length>=2,`missing topics ${id}`);
    assert.equal(new Set(N.topicsFor(id).map(x=>x.id)).size,N.topicsFor(id).length);
  }
});

test('topic conditions use the same safe requirement shape',()=>{
  for(const topics of Object.values(N.topics)) for(const topic of topics) for(const req of topic.requires||[]){
    assert.ok(Array.isArray(req)&&req.length===3);
    assert.ok(['>=','<=','==','!='].includes(req[1]));
  }
});

test('scheduled story graph edges point at real events',()=>{
  const ids=new Set(D.events.map(e=>e.id));
  for(const e of D.events) for(const c of e.choices) for(const [target,delay] of c.effects?.schedule||[]){
    assert.ok(ids.has(target),`${e.id} -> ${target}`);
    assert.ok(Number.isFinite(delay)&&delay>=0);
  }
});
