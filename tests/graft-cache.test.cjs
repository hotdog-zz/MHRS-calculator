'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../dist/probability.js'),D=require('../dist/data.json');
const source=D.armors.find(a=>a.id==='Leg:426'),population=data=>data.skills.filter(s=>s.cost===12&&s.max===3&&!source.skills.some(n=>n.skill_id===s.id)).length,close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,a+' != '+b);
function options(id,level){return {graftTargets:[{native:[{id,level,min:0}],minimumChanges:[],maxNetRemoved:0,maxPositiveRecords:7,maxRecords:7,completeOutcome:true}]};}
function cache(ns,ff){return {schema:2,prepared:true,group:'mutable-test',n:1,records:[{points:0,records:1,removed:0,positive:1,ns,ff,count:1}]};}
test('shared interval factors do not retain stale mutable foreign vectors across queries',()=>{
 const vector=[1],raw=cache(new Map(),new Map([['12:3',vector]])),q=options(219,2);close(P.query(D,source,raw,q).p,1);vector[0]=2;raw.records[0].positive=raw.records[0].records=2;close(P.query(D,source,raw,q).p,(population(D)-1)/population(D));vector[0]=1;raw.records[0].positive=raw.records[0].records=1;close(P.query(D,source,raw,q).p,1);
});
test('shared interval factors distinguish different source skill populations',()=>{
 const raw=cache(new Map(),new Map([['12:3',[2]]])),q=options(219,2);raw.records[0].positive=raw.records[0].records=2;const other=D.skills.find(s=>s.cost===12&&s.max===3&&![219,204].includes(s.id)),changed={...D,skills:D.skills.filter(s=>s.id!==other.id)};
 close(P.query(D,source,raw,q).p,(population(D)-1)/population(D));close(P.query(changed,source,raw,q).p,(population(changed)-1)/population(changed));close(P.query(D,source,raw,q).p,(population(D)-1)/population(D));
});
test('source-native positive vectors are refreshed when their contents change',()=>{
 const vector=[1],raw=cache(new Map([['9:5:2',vector]]),new Map()),q=options(90,4);close(P.query(D,source,raw,q).p,1);vector[0]=2;raw.records[0].positive=raw.records[0].records=2;close(P.query(D,source,raw,q).p,0);vector[0]=1;raw.records[0].positive=raw.records[0].records=1;close(P.query(D,source,raw,q).p,1);
});
test('query keys preserve the whole skill-overlap graph under foreign label permutations',async()=>{
 const q={minimumChanges:[{id:203,min:1}],minRawSlots:1,graftTargets:[{native:[{id:233,level:1,min:0},{id:219,level:1,min:0},{id:232,level:1,min:0}],minimumChanges:[{id:203,min:1}],maxNetRemoved:0,maxPositiveRecords:7,maxRecords:7,completeOutcome:true}]},rename=id=>id===203?233:id===233?203:id,swapped={...q,minimumChanges:q.minimumChanges.map(r=>({...r,id:rename(r.id)})),graftTargets:q.graftTargets.map(t=>({...t,native:t.native.map(n=>({...n,id:rename(n.id)})),minimumChanges:t.minimumChanges.map(n=>({...n,id:rename(n.id)}))}))};
 assert.equal(P.queryKey(D,source,q),P.queryKey(D,source,swapped));
 const raw=cache(new Map([['9:5:2',[-1]]]),new Map([['9:3',[1,1]]]));raw.records[0].removed=1;raw.records[0].positive=2;raw.records[0].records=3;raw.records[0].points=1;const index={armors:{[source.id]:{normal:raw.group}},groups:{[raw.group]:{n:1}}},bank=P.createBank(D,index,async()=>raw);assert.deepEqual(await bank.queryExact(source,'normal',q),P.query(D,source,raw,q));assert.deepEqual(await bank.queryExact(source,'normal',swapped),P.query(D,source,raw,swapped));assert.equal(bank.stats().queries,1);assert.equal(bank.stats().hits,1);
 const partial={...q,graftTargets:q.graftTargets.map(t=>({...t,native:t.native.map(n=>({...n,id:rename(n.id)}))}))};assert.notEqual(P.queryKey(D,source,q),P.queryKey(D,source,partial));
});
test('source-native and source-foreign identities cannot share a graft result key',()=>{
 const t={native:[{id:232,level:1,min:0}],minimumChanges:[],maxNetRemoved:0,maxPositiveRecords:7,maxRecords:7,completeOutcome:true};assert.notEqual(P.queryKey(D,source,{minimumChanges:[{id:204,min:1}],graftTargets:[t]}),P.queryKey(D,source,{minimumChanges:[{id:219,min:1}],graftTargets:[t]}));
});
test('joint predicates retain shared versus distinct required names',()=>{
 const target=id=>({native:[{id:232,level:1,min:0}],minimumChanges:[{id,min:1}],maxNetRemoved:0,maxPositiveRecords:7,maxRecords:7,completeOutcome:true}),same={graftTargets:[target(219),target(219)]},different={graftTargets:[target(219),target(212)]};assert.notEqual(P.queryKey(D,source,same),P.queryKey(D,source,different));
});
