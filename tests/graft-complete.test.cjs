'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),D=require('../dist/data.json'),P=require('../dist/probability.js'),L=require('./probability-loader.cjs'),S=require('../dist/stargazing.js');
const source=D.armors.find(a=>a.id==='Leg:426'),stamina=41,strife=233,pop=(cost,max)=>D.skills.filter(s=>s.cost===cost&&s.max===max&&!source.skills.some(n=>n.skill_id===s.id)).length,close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-11*Math.max(1e-12,Math.abs(b)),a+' != '+b);
const native=(id,level=1,min=0)=>({id,level,min});
function target(natives,changes=[{id:strife,min:1}],extra={}){return {native:natives,minimumChanges:changes,maxNetRemoved:0,maxPositiveRecords:7,maxRecords:7,completeOutcome:true,...extra};}
function row(ff,ns=[],k=0){return {points:0,slotRecords:0,records:k+ff.reduce((n,[,vs])=>n+vs.reduce((a,b)=>a+b,0),0)+ns.reduce((n,[,vs])=>n+vs.reduce((a,b)=>a+Math.max(0,b),0),0),removed:k,positive:ff.reduce((n,[,vs])=>n+vs.reduce((a,b)=>a+b,0),0)+ns.reduce((n,[,vs])=>n+vs.reduce((a,b)=>a+Math.max(0,b),0),0),ns:new Map(ns),ff:new Map(ff),count:1};}
const query=(r,t)=>P.query(D,source,{schema:2,prepared:true,group:'complete-test',n:1,records:[r]},{minimumChanges:t.minimumChanges,graftTargets:[t]});
test('extra stamina uses no new kind when native, and is rejected when it would become a sixth kind',()=>{
 const r=row([['9:3',[1]],['3:3',[1]]]),present=target([native(stamina),native(232),native(6),native(205)]),absent=target([native(219),native(232),native(6),native(205)]);
 close(query(r,present).p,1/(pop(9,3)*pop(3,3)));assert.equal(query(r,absent).p,0);assert.ok(query(r,{...absent,completeOutcome:false}).p>0);
});
test('unrequested new skills are permitted when the target still has kind capacity',()=>{
 close(query(row([['9:3',[1]],['3:3',[1]]]),target([native(219),native(232),native(6)])).p,1/pop(9,3));
});
test('two levels of one foreign skill occupy one kind, while two distinct skills need two kinds',()=>{
 const t=target([native(219),native(232),native(6),native(205)]);close(query(row([['9:3',[2]]]),t).p,1/pop(9,3));assert.equal(query(row([['9:3',[1,1]]]),t).p,0);
});
test('existing native skills still obey their final level caps',()=>{
 const r=row([['9:3',[1]],['3:3',[1]]]);assert.equal(query(r,target([native(stamina,3),native(232),native(6),native(205)])).p,0);close(query(r,target([native(stamina,2),native(232),native(6),native(205)])).p,1/(pop(9,3)*pop(3,3)));
});
test('native upper levels are checked after compensation, allowing a capped skill to be restored',()=>{
 const t=target([native(stamina,3),native(232),native(6),native(205)]),r=row([['9:3',[1]],['3:3',[1]]],[['9:5:2',[-1]]],1);close(query(r,t).p,1/(4*pop(9,3)*pop(3,3)));assert.equal(query({...r,ff:new Map([['9:3',[1]],['3:3',[2]]]),positive:3,records:4},t).p,0);
});
test('same-grade native identities are matched jointly with the required new skill',()=>{
 const t=target([native(strife),native(232),native(6),native(219)],[{id:203,min:1}]);close(query(row([['9:3',[1,1]]]),t).p,2/(pop(9,3)*(pop(9,3)-1)));
});
test('positive donor-native entries must also fit the destination kinds',()=>{
 const r=row([['9:3',[1]]],[['9:5:2',[1]]]);close(query(r,target([native(90),native(232),native(6),native(219)])).p,1/pop(9,3));assert.equal(query(r,target([native(stamina),native(232),native(6),native(219)])).p,0);
});
test('removing an original native skill does not free its reserved kind capacity',()=>{
 const r=row([['9:3',[1]],['12:3',[1]]],[['9:5:2',[-1]]],1),t=target([native(stamina,1,-1),native(232),native(6),native(223)],undefined,{maxNetRemoved:1});assert.equal(query(r,t).p,0);
});
test('zero-loss saved-table results reproduce the independent complete-outcome diagnostic',()=>{
 const cache=L.load(L.index.observation.armors[source.id].normal);for(const[id,addition,levels,growth,expected]of [['Arm:430',strife,1,2,0.000002669565217391304],['Arm:493',stamina,2,1,0.000003764583333333333],['Chest:492',17,1,2,0.00001669047619047619]]){const base=D.armors.find(a=>a.id===id),t=target(base.skills.map(s=>native(s.skill_id,s.level)),[{id:addition,min:levels}]),r=P.query(D,source,{...cache,records:cache.records.filter(r=>r.removed===0)},{minimumChanges:t.minimumChanges,minRawSlots:growth,graftTargets:[t]});close(r.p,expected);assert.equal(r.graftModel,'inverse-net-complete-v2');}
});
test('complete and partial inverse models have distinct keys and route model identities',async()=>{
 const base=D.armors.find(a=>a.id==='Arm:430'),shape=S.shape(D,{baseId:base.id,goal:{minimumChanges:base.skills.map(s=>({id:s.skill_id,min:0})).concat({id:strife,min:1}),slots:base.slots,deleteSkills:true}},{options:{}}),full=S.correctedShape(shape,{graftInverseCorrection:true}),partial=S.correctedShape(shape,{graftInverseCorrection:true,graftCompleteOutcomeCorrection:false});assert.notEqual(S.signature(full),S.signature(partial));assert.notEqual(P.queryKey(D,source,S.donorOptions(full)),P.queryKey(D,source,S.donorOptions(partial)));
 assert.equal(S.donorOptions(full).graftTargets[0].completeOutcome,true);assert.equal(S.donorOptions(partial).graftTargets[0].completeOutcome,false);
});
test('complete matching agrees with explicit foreign labels, native compensation and kind counting',()=>{
 const cases=[
  {natives:[native(stamina,2),native(232),native(6),native(205)],ff:[['9:3',[1]],['3:3',[1]]],k:0,required:strife},
  {natives:[native(stamina,3),native(232),native(6),native(205)],ff:[['9:3',[1]],['3:3',[2]]],k:2,required:strife},
  {natives:[native(strife,2),native(232),native(6),native(219)],ff:[['9:3',[2,1]]],k:1,required:203},
  {natives:[native(219),native(232),native(6)],ff:[['9:3',[1]],['3:3',[1]]],k:0,required:strife}
 ];
 const map=new Map(D.skills.map(s=>[s.id,s]));for(const c of cases){const t=target(c.natives,[{id:c.required,min:1}]),r=row(c.ff,c.k?[['9:5:2',[-Math.min(2,c.k)]]]:[],c.k);if(c.k>2)throw Error('Unexpected fixture');const gains=new Map(),nativeIds=new Set(c.natives.map(n=>n.id));let accepted=0,total=0;
  function positions(at,losses){if(at===c.k){total++;if(losses.some((d,i)=>d>c.natives[i].level)||(gains.get(c.required)||0)<1)return;if(new Set([...nativeIds,...gains.keys()]).size>5)return;let comp=0,removed=0;for(let i=0;i<c.natives.length;i++){const v=c.natives[i],a=gains.get(v.id)||0,d=losses[i],level=v.level+a-d;if(a-d<v.min||level>map.get(v.id).max)return;comp+=Math.min(a,d);removed+=Math.max(0,d-a);}if(removed<=t.maxNetRemoved&&r.positive-comp<=t.maxPositiveRecords&&r.records-2*comp<=t.maxRecords)accepted++;return;}for(let i=0;i<c.natives.length;i++){const next=losses.slice();next[i]++;positions(at+1,next);}}
  function assign(group,index){if(group===c.ff.length){positions(0,Array(c.natives.length).fill(0));return;}const[type,values]=c.ff[group];if(index===values.length){assign(group+1,0);return;}const[cost,max]=type.split(':').map(Number);for(const s of D.skills)if(s.cost===cost&&s.max===max&&!source.skills.some(n=>n.skill_id===s.id)&&!gains.has(s.id)){gains.set(s.id,values[index]);assign(group,index+1);gains.delete(s.id);}}
  assign(0,0);close(query(r,t).p,accepted/total);
 }
});
