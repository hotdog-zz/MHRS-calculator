'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),D=require('../dist/data.json'),P=require('../dist/probability.js'),S=require('../dist/stargazing.js');
const source=D.armors.find(a=>a.id==='Leg:426'),A=219,B=233,unknown=232,pop=(cost,max)=>D.skills.filter(s=>s.cost===cost&&s.max===max&&!source.skills.some(n=>n.skill_id===s.id)).length;
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-11*Math.max(1e-12,Math.abs(b)),a+' != '+b);
function row({k=1,gain=1,pair=false,nativePositive=false}={}){const ns=new Map([['9:5:2',[k===2?-1:-k]]]);if(k===2)ns.set('12:3:2',[-1]);if(nativePositive){ns.set('9:5:2',[1]);ns.set('12:3:2',[-1]);}return {points:0,slotRecords:0,records:k+(pair?2:gain),removed:k,positive:pair?2:gain,ns,ff:nativePositive?new Map():new Map([[pair?'12:3':gain===0?'9:3':'12:3',pair?[1,1]:gain?[gain]:[1]]]),count:1};}
function cache(r){return {schema:2,prepared:true,group:'inverse-test',n:1,records:[r]};}
function target(native=[{id:A,level:1,min:0},{id:unknown,level:1,min:0},{id:80,level:3,min:0}],extra={}){return {native,minimumChanges:[],maxNetRemoved:0,maxPositiveRecords:7,maxRecords:7,...extra};}
const query=(r,t,extra={})=>P.query(D,source,cache(r),{minimumChanges:[],minRawSlots:0,maxRemoved:0,graftTargets:Array.isArray(t)?t:[t],...extra});
test('inverse no-loss query includes a palace deletion compensated by a target-native addition',()=>{
 const r=row(),result=query(r,target());close(result.p,1/(3*pop(12,3)));assert.equal(P.query(D,source,cache(r),{maxRemoved:0}).p,0);
});
test('native net +1 after one deletion requires a source +2, not merely +1',()=>{
 const t=target([{id:A,level:1,min:1},{id:unknown,level:1,min:0},{id:80,level:3,min:0}],{minimumChanges:[{id:A,min:1}],maxPositiveRecords:1});
 assert.equal(query(row(),t,{minimumChanges:[{id:A,min:1}],maxPositiveRecords:1}).p,0);
 close(query(row({gain:2}),t,{minimumChanges:[{id:A,min:1}],maxPositiveRecords:1}).p,1/(3*pop(12,3)));
});
test('compensation can satisfy positive and total record limits after target cancellation',()=>{
 const t=target(undefined,{maxPositiveRecords:0,maxRecords:0});close(query(row(),t,{maxPositiveRecords:0,maxRecords:0}).p,1/(3*pop(12,3)));
});
test('two compensated native skills use disjoint positions and joint label assignment',()=>{
 const other=D.skills.find(s=>s.cost===12&&s.max===3&&![A,204].includes(s.id)).id,t=target([{id:A,level:1,min:0},{id:other,level:1,min:0},{id:unknown,level:1,min:0}]);
 close(query(row({k:2,pair:true}),t).p,4/(9*pop(12,3)*(pop(12,3)-1)));
 assert.equal(query(row({k:2,gain:2}),t).p,0);
});
test('previous simple 1/3 and 1/9 cases are retained when gains cannot compensate other natives',()=>{
 for(const k of [1,2]){const r=row({k,gain:0}),t=target([{id:unknown,level:1,min:0},{id:6,level:1,min:0},{id:80,level:3,min:-2}],{minimumChanges:[{id:B,min:1}],maxNetRemoved:2});r.positive=1;r.records=k+1;
  close(query(r,t,{minimumChanges:[{id:B,min:1}]}).p,1/(3**k*pop(9,3)));
 }
});
test('joint numeric intersections retain optimistic marginal coupling without extra position penalties',()=>{
 const three=target(),two=target([{id:A,level:1,min:0},{id:unknown,level:1,min:0}]);close(query(row(),[three,two]).p,1/(3*pop(12,3)));
});
test('source-native positives remain identifiable and source-negative entries represent zero positive gain',()=>{
 const t=target([{id:90,level:1,min:0},{id:unknown,level:1,min:0},{id:80,level:3,min:0}]);close(query(row({nativePositive:true}),t).p,1/3);
});
test('inverse keys share exchangeable names while preserving required/native overlaps',async()=>{
 const other=D.skills.find(s=>s.cost===12&&s.max===3&&![A,204].includes(s.id)).id,t1=target(),t2=target([{id:other,level:1,min:0},{id:unknown,level:1,min:0},{id:80,level:3,min:0}]),q1={graftTargets:[t1]},q2={graftTargets:[t2]};assert.equal(P.queryKey(D,source,q1),P.queryKey(D,source,q2));assert.notEqual(P.queryKey(D,source,{...q1,minimumChanges:[{id:A,min:1}]}),P.queryKey(D,source,{...q2,minimumChanges:[{id:A,min:1}]}));
 const index={armors:{[source.id]:{normal:'inverse-test'}},groups:{'inverse-test':{n:1}}},bank=P.createBank(D,index,async()=>cache(row()));
 const a=await bank.queryExact(source,'normal',q1),b=await bank.queryExact(source,'normal',q1);close(a.p,1/(3*pop(12,3)));assert.deepEqual(a,b);assert.equal(bank.stats().queries,1);
});
test('family relabeling rebuilds compensation requirements instead of keeping the starting labels',()=>{
 const s={native:[[B,1],[unknown,1]],baseline:[{id:B,min:0},{id:unknown,min:0}],positive:[[203,1]],growth:0,maxRemoved:0,maxPositiveRecords:7,maxRecords:7,graftInverse:true};
 const a=S.donorOptions(s),b=S.donorOptions({...s,positive:[[B,1]]});assert.deepEqual(a.graftTargets[0].minimumChanges,[{id:203,min:1}]);assert.deepEqual(b.graftTargets[0].minimumChanges,[{id:B,min:1}]);assert.equal(b.graftTargets[0].native.find(n=>n.id===B).min,1);assert.notEqual(S.signature(s),S.signature({...s,positive:[[B,1]]}));
});
test('inverse result agrees with explicit label and target-position enumeration',()=>{
 const labels=D.skills.filter(s=>s.cost===12&&s.max===3&&!source.skills.some(n=>n.skill_id===s.id)).map(s=>s.id),other=labels.find(id=>id!==A);
 for(const[n,k,partition,minA,netLimit,positiveLimit]of [[2,1,[1],0,0,7],[3,2,[1,1],0,0,1],[3,2,[2],-1,1,1],[4,1,[2],1,0,1],[4,2,[2,1],0,1,2]]){
  const natives=[{id:A,level:2,min:minA},{id:other,level:1,min:0},...(n>=3?[{id:unknown,level:1,min:0}]:[]),...(n===4?[{id:6,level:1,min:0}]:[])],t=target(natives,{maxNetRemoved:netLimit,maxPositiveRecords:positiveLimit}),r={...row({k}),ff:new Map([['12:3',partition]]),positive:partition.reduce((a,b)=>a+b,0),records:k+partition.reduce((a,b)=>a+b,0)},gain=new Map();let hits=0,total=0;
  function positions(at,losses){if(at===k){total++;if(losses.some((d,i)=>d>natives[i].level))return;let compensation=0,removed=0;for(let i=0;i<n;i++){const a=gain.get(natives[i].id)||0,d=losses[i];if(a-d<natives[i].min)return;compensation+=Math.min(a,d);removed+=Math.max(0,d-a);}if(removed<=netLimit&&r.positive-compensation<=positiveLimit&&r.records-2*compensation<=7)hits++;return;}for(let i=0;i<n;i++){const next=losses.slice();next[i]++;positions(at+1,next);}}
  function assign(i){if(i===partition.length){positions(0,Array(n).fill(0));return;}for(const id of labels)if(!gain.has(id)){gain.set(id,partition[i]);assign(i+1);gain.delete(id);}}
  assign(0);close(query(r,t).p,hits/total);
 }
});
test('search pricing and lower-bound queries use the same inverse model',async()=>{
 const Q=require('../dist/equivalent-objective.js'),H=require('../dist/handcraft.js'),fixture=require('./handcraft-route-fixture.cjs').routes().a,seen=[],bank={async queryExact(_base,_mode,opts){seen.push(opts);return {p:.01,n:1};}},config=H.config({graftInverseCorrection:true,modes:['normal']}),ev=Q.createEvaluator(D,{options:{}},null,bank,config);
 const p=fixture.pieces[0];await ev.price({guide:{baseId:p.baseId,goal:p.goal,pool:6,expectedRolls:100}});await ev.lowerBound({...fixture,pieces:[p]},Date.now()+5000);
 assert.ok(seen.length>1);assert.ok(seen.every(o=>o.graftTargets?.length));assert.equal(config.graftInverseCorrection,true);assert.equal(H.config().graftInverseCorrection,false);
});
