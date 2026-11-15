'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../dist/stargazing.js'),P=require('../dist/probability.js'),D=require('../dist/data.json'),L=require('./probability-loader.cjs');
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12*Math.max(1e-12,Math.abs(b)),a+' != '+b);
function shape(id,loss){const base=D.armors.find(a=>a.id===id);return S.shape(D,{baseId:id,part:base.part,goal:{slots:base.slots,minimumChanges:base.skills.map(s=>({id:s.skill_id,min:loss[s.skill_id]||0})),deleteSkills:true}},{options:{}});}
test('marginal weights use native skill count and per-skill level caps',()=>{
 assert.deepEqual(S.deletionWeights(shape('Arm:502',{6:-1})),[1,.5]);
 const leg=S.deletionWeights(shape('Leg:502',{80:-2}));close(leg[1],1/3);close(leg[2],1/9);
 assert.deepEqual(S.deletionWeights(shape('Chest:502',{232:-1,219:-1})),[1,1,.5]);
 assert.deepEqual(S.deletionWeights(shape('Head:492',{})),[1]);
});
test('weighted donor probabilities equal the exact-loss decomposition, with separate cache entries',async()=>{
 const source=D.armors.find(a=>a.id===S.SOURCE),bank=P.createBank(D,L.index.observation,g=>L.load(g)),options={minimumChanges:[{id:203,min:1},{id:233,min:1}],maxRemoved:2,maxRecords:7,maxPositiveRecords:7},weights=[1,1/3,1/9];
 for(const mode of ['normal','skills','slots']){const raw=await bank.queryExact(source,mode,options),weighted=await bank.queryExact(source,mode,{...options,removedWeights:weights});let previous=0,expected=0;
  for(let k=0;k<=2;k++){const q=await bank.queryExact(source,mode,{...options,maxRemoved:k});expected+=(q.p-previous)*weights[k];previous=q.p;}
  close(weighted.p,expected);assert.ok(weighted.p<raw.p);assert.notEqual(P.queryKey(D,source,options),P.queryKey(D,source,{...options,removedWeights:weights}));
 }
});
test('shared events use nested marginal weights without enforcing cross-armor position identity',async()=>{
 const a={positive:[[233,1]],growth:0,maxRemoved:1,maxPositiveRecords:7,maxRecords:7,removedWeights:[1,.5]},b={...a,removedWeights:[1,1/3]},families=[[a,b]];
 const lookup=async s=>({p:.02+(s.removedWeights[1]||0)*.06}),events=await S.loadOutcomeRates([a,b],lookup);
 const probability=g=>events.filter(e=>S.covers(e,g)).reduce((n,e)=>n+e.p,0);close(probability(a),.05);close(probability(b),.04);
 assert.ok(Number.isFinite(S.groupMean(families,events).expectedRolls));
 const common=S.ratePlan([a,b])[0].points[3];assert.deepEqual(common.removedWeights,[1,1/3]);
});
