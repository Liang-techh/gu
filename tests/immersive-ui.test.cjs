'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('0.4 entry loads immersive layer after core engine',()=>{
  const html=read('index.html');
  assert.match(html,/assets\/immersive-v4\.css/);
  assert.match(html,/src="src\/visual-ui\.js"/);
  assert.ok(html.indexOf('src/engine.js')<html.indexOf('src/visual-ui.js'));
});

test('immersive adapter preserves engine authority',()=>{
  const js=read('src/visual-ui.js');
  assert.match(js,/data-cmd/);
  assert.doesNotMatch(js,/E\.dispatch\s*\(/);
  assert.doesNotMatch(js,/s\.v\.[A-Za-z]+\s*[+\-*/]?=/);
  assert.match(js,/assets\/portraits\/player\.svg/);
  assert.match(js,/今天，是开窍大典/);
  assert.match(js,/复制试玩状态/);
});

test('player portrait is local vector art without remote resource links',()=>{
  const svg=read('assets/portraits/player.svg');
  assert.match(svg,/<svg/);
  assert.match(svg,/玩家角色立绘/);
  assert.doesNotMatch(svg,/(?:href|src)=["']https?:\/\//i);
});

test('immersive stylesheet makes world and character primary',()=>{
  const css=read('assets/immersive-v4.css');
  for(const token of ['.v4-player','.v4-dialogue','.v4-world','.v4-dock','.v4-setup-cinematic'])assert.ok(css.includes(token),token);
  assert.match(css,/\.layout>\.character/);
  assert.match(css,/display:none!important/);
});
