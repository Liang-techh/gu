'use strict';
// Read-only verification against the user's checked-in novel. Never downloads or rewrites it.
const fs=require('node:fs'),path=require('node:path'),D=require('../src/content.js');
const root=path.resolve(__dirname,'..'),cache=new Map(),failures=[];
const entries=[...D.sources,...Object.values(D.people).map(p=>({term:p.name,path:D.chapter(p.chapter)})),...Object.values(D.locations).map(p=>({term:p.name,path:D.chapter(p.chapter)})),...Object.values(D.gus).map(p=>({term:p.name,path:D.chapter(p.chapter)}))];
for(const e of entries){
 const file=path.resolve(root,e.path);
 if(!file.startsWith(root+path.sep)){failures.push('Invalid source path: '+e.path);continue;}
 if(!cache.has(file)){try{cache.set(file,fs.readFileSync(file,'utf8'));}catch{cache.set(file,null);}}
 const text=cache.get(file);
 if(text===null)failures.push(`Missing source: ${e.path}`);
 else if(!text.includes(e.term))failures.push(`Not found: ${e.term} in ${e.path}`);
}
if(failures.length){console.error([...new Set(failures)].join('\n'));process.exitCode=1;}
else console.log(`PASS: ${entries.length} term/source checks across ${cache.size} chapters. This verifies wording, not fictional plot or numerical rules.`);
