'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),D=require('../dist/data.json'),P=require('../dist/probability.js'),S=require('../dist/stargazing.js'),H=require('../dist/handcraft.js');
const source=D.armors.find(a=>a.id===S.SOURCE),pop=(cost,max)=>D.skills.filter(s=>s.cost===cost&&s.max===max&&!source.skills.some(n=>n.skill_id===s.id)).length,close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12*Math.max(1e-12,Math.abs(b)),a+' != '+b),native=(id,level=1,min=0)=>({id,level,min});
function target(ns,extra={}){return {native:ns,minimumChanges:[],maxNetRemoved:2,maxPositiveRecords:7,maxRecords:7,completeOutcome:true,removedWeights:[1,1/3,1/9],...extra};}
function row(k=0,ff=[]){const positive=ff.reduce((a,[,vs])=>a+vs.reduce((n,v)=>n+v,0),0);return {points:0,slotRecords:0,records:k+positive,removed:k,positive,ns:new Map(k?[['9:5:2',[-k]]]:[]),ff:new Map(ff),count:1};}
const cache=r=>({schema:2,prepared:true,group:'position-complete-test',n:1,records:[r]}),query=(r,ts)=>P.query(D,source,cache(r),{graftTargets:Array.isArray(ts)?ts:[ts]});
test('default position mode survives configuration normalization without enabling compensation',()=>{
 const config=H.config(),base=D.armors.find(a=>a.id==='Leg:502'),s=S.shape(D,{baseId:base.id,goal:{slots:base.slots,minimumChanges:base.skills.map(n=>({id:n.skill_id,min:n.skill_id===80?-2:0}))}});
 assert.equal(config.graftInverseCorrection,false);assert.equal(config.graftDeletionCorrection,true);assert.deepEqual(H.config(config),config);
 for(const cfg of [{},config]){const opts=S.donorOptions(S.correctedShape(s,cfg));assert.equal(opts.graftTargets[0].completeOutcome,true);assert.deepEqual(opts.graftTargets[0].removedWeights,[1,1/3,1/9]);}
 const partial=S.donorOptions(S.correctedShape(s,{graftDeletionCorrection:true,graftCompleteOutcomeCorrection:false}));assert.ok(!partial.graftTargets);assert.deepEqual(partial.removedWeights,[1,1/3,1/9]);
});
test('two, three and four native skills use positional powers without allocating restoration paths',()=>{
 for(const n of [2,3,4]){const ns=[80,6,7,9].slice(0,n).map((id,i)=>native(id,3,i?0:-2)),weights=S.deletionWeights({native:ns.map(v=>[v.id,v.level]),baseline:ns.map(v=>({id:v.id,min:v.min})),maxRemoved:2,maxRecords:7}),t=target(ns,{removedWeights:weights});for(const k of [0,1,2])close(query(row(k),t).p,n**(-k));}
});
test('position-only no-loss and record limits never accept a deletion compensated by an addition',()=>{
 const ns=[native(219),native(232),native(80,3)],r=row(1,[['12:3',[1]]]),t=target(ns,{maxNetRemoved:0,removedWeights:[1]});assert.equal(query(r,t).p,0);const inverse={...t};delete inverse.removedWeights;assert.ok(query(r,inverse).p>0);
 for(const limit of [{maxPositiveRecords:0},{maxRecords:0}])assert.equal(query(r,target(ns,limit)).p,0);
});
test('complete position-only checks distinguish native extras from a sixth kind',()=>{
 const r=row(1,[['9:3',[1]],['3:3',[1]]]),common={minimumChanges:[{id:233,min:1}],removedWeights:[1,.25]},present=target([native(41),native(232),native(6),native(205)],common),absent=target([native(219),native(232),native(6),native(205)],common);close(query(r,present).p,.25/(pop(9,3)*pop(3,3)));assert.equal(query(r,absent).p,0);
});
test('native level caps do not obtain headroom from a permitted deletion',()=>{
 const t=target([native(41,3,-1),native(232),native(6),native(205)],{minimumChanges:[{id:233,min:1}],removedWeights:[1,.25]}),r=row(1,[['9:3',[1]],['3:3',[1]]]);assert.equal(query(r,t).p,0);const inverse={...t,maxNetRemoved:0};delete inverse.removedWeights;assert.ok(query(r,inverse).p>0);
});
test('joint position queries retain optimistic marginal weights without enforcing shared physical loss slots',()=>{
 const a=target([native(80,3,-1),native(6,3)],{removedWeights:[1,.5]}),b=target([native(80,3,-1),native(6,3),native(7,3)]);close(query(row(1),[a,b]).p,1/3);
});
test('result caches separate position weights and inverse models',async()=>{
 const r=row(1),t=target([native(80,3,-1),native(6,3),native(7,3)]),a={graftTargets:[t]},b={graftTargets:[{...t,removedWeights:[1,.5]}]},inverse={...t};delete inverse.removedWeights;const c={graftTargets:[inverse]};assert.notEqual(P.queryKey(D,source,a),P.queryKey(D,source,b));assert.notEqual(P.queryKey(D,source,a),P.queryKey(D,source,c));
 const raw=cache(r),bank=P.createBank(D,{armors:{[source.id]:{normal:raw.group}},groups:{[raw.group]:{n:1}}},async()=>raw);close((await bank.queryExact(source,'normal',a)).p,1/3);close((await bank.queryExact(source,'normal',b)).p,.5);assert.equal(bank.stats().queries,2);
});
test('default candidate pricing and lower bounds use position-only complete queries',async()=>{
 const Q=require('../dist/equivalent-objective.js'),fixture=require('./handcraft-route-fixture.cjs').routes().a,seen=[],bank={async queryExact(_base,_mode,options){seen.push(options);return {p:.01,n:1};}},ev=Q.createEvaluator(D,{options:{}},null,bank,H.config({modes:['normal']})),p=fixture.pieces[0];await ev.price({guide:{baseId:p.baseId,goal:p.goal,pool:6,expectedRolls:100}});await ev.lowerBound({...fixture,pieces:[p]},Date.now()+5000);assert.ok(seen.length>1);assert.ok(seen.every(o=>o.graftTargets?.every(t=>Array.isArray(t.removedWeights)&&t.completeOutcome)));
});
