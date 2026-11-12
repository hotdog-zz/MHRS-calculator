'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../dist/stargazing.js'),H=require('../dist/handcraft.js'),D=require('../dist/data.json');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,b),a+' != '+b),shape=(positive,other={})=>({part:'head',baseId:'Head:test',native:[],baseline:[],positive,growth:0,maxRemoved:0,maxPositiveRecords:7,maxRecords:7,...other});
test('multiplicity, alternative AA/BB/AB paths and conditional future cost are retained',()=>{
 const aa=shape([[233,2]]),bb=shape([[203,2]]),ab=shape([[203,1],[233,1]]),events=[{...aa,p:.01},{...bb,p:.01},{...ab,p:.01}];
 close(S.groupMean([[ab,ab]],events).expectedRolls,200);
 // After AB,AB,C,C only AB or the pair AA,BB is still needed.
 close(S.groupMean([[ab],[aa,bb]],events).expectedRolls,2/(3*.01));
 close(S.groupMean([[aa,bb]],events).expectedRolls,H.exclusiveMean([.01,.01]));
 const many=S.groupMean([[ab,ab,ab],[aa,bb,ab]],events);assert.ok(many.expectedRolls<300);assert.ok(many.expectedRolls>100);
});
test('3A3B2C over 2,2,2,1,1 has all nineteen unlabeled minimal families, including repeats and C relocation',()=>{
 const shapes=[shape([[233,1],[203,1]]),shape([[233,1],[203,1]]),shape([[233,1],[203,1]]),shape([[231,1]]),shape([[231,1]])],result=S.families(D,shapes);
 assert.equal(result.truncated,false);const unique=new Set(result.families.map(f=>JSON.stringify(f.map(s=>s.positive).map(JSON.stringify).sort())));assert.equal(unique.size,19);
 assert.ok(result.families.some(f=>f.some(s=>s.positive.some(([id,n])=>id===233&&n===2))&&f.some(s=>s.positive.some(([id,n])=>id===203&&n===2))));assert.ok(result.families.some(f=>f.slice(0,3).some(s=>s.positive.some(([id])=>id===231))));
 for(const row of result.families){const totals=new Map();for(const s of row)for(const[id,n]of s.positive)totals.set(id,(totals.get(id)||0)+n);assert.equal(totals.get(233),3);assert.equal(totals.get(203),3);assert.equal(totals.get(231),2);assert.deepEqual(row.map(s=>s.positive.reduce((n,[,v])=>n+v,0)),[2,2,2,1,1]);}
});
test('native levels, simultaneous removal, max five kinds, cost/max groups and destination holes guard equivalence',()=>{
 assert.equal(S.legal(D,shape([], {native:[[233,3]],baseline:[{id:233,min:0}]}),[[233,1]]),false);
 assert.equal(S.legal(D,shape([], {native:[[233,2]],baseline:[{id:233,min:-1}]}),[[233,1]]),false);
 assert.equal(S.legal(D,shape([], {native:[[0,1],[5,1],[6,1],[7,1],[10,1]]}),[[233,1]]),false);
 assert.equal(S.legal(D,shape([], {maxPositiveRecords:1,growth:1}),[[233,1]]),false);
 const rows=S.families(D,[shape([[233,1]]),shape([[223,1]])]).families;assert.equal(rows.length,1);assert.deepEqual(rows[0].map(s=>s.positive),[[[233,1]],[[223,1]]]);
 assert.equal(S.covers(shape([[233,2]],{growth:0}),shape([[233,1]],{growth:1})),false);assert.equal(S.covers(shape([[233,2]],{growth:1,maxRemoved:1}),shape([[233,1]],{growth:1,maxRemoved:0})),false);
});
test('source rate lookup retains inclusive values and never queries or subtracts AAB intersections',()=>{
 const aa=shape([[233,2]]),ab=shape([[203,1],[233,1]]),ps=new Map([[S.signature(aa),.01],[S.signature(ab),.02]]),events=S.outcomeRates([aa,ab],ps);assert.deepEqual(events.map(e=>e.p),[.01,.02]);
 const slot=shape([[233,2]],{growth:1});ps.set(S.signature(slot),.004);const tiers=S.outcomeRates([aa,slot],ps);close(tiers.reduce((n,e)=>n+e.p,0),.01);close(tiers.find(e=>e.growth===1).p,.004);
});
test('postprocessing uses the palace bank, leaves individual probabilities intact and is pure',async()=>{
 const {a}=require('./handcraft-route-fixture.cjs').routes(),before=JSON.stringify(a),queried=[];const bank={async query(base,mode,opts){queried.push({id:base.id,mode,opts});return {p:mode==='normal'?.01:.005,n:10000000,se:.0001,effectiveHits:1000};}};
 const r=await S.evaluate(D,a,{options:{}},bank,{modes:['normal'],numerical:{stateLimit:100,trials:128}});assert.ok(r.stargazingRolls>0);assert.equal(r.stargazingModel,'palace-current-group-multiplicity-v2');assert.equal(r.expectedRolls,a.expectedRolls);assert.equal(JSON.stringify(a),before);assert.ok(queried.every(q=>q.id==='Leg:426'));for(let i=0;i<r.pieces.length;i++){assert.deepEqual(r.pieces[i].probabilities,a.pieces[i].probabilities);assert.equal(r.pieces[i].donorProbabilities[0].n,10000000);}assert.ok(r.equivalentStargazing.expectedRolls>0);
});
test('non-pool6 rolling pieces stay independent, and ready pieces are never rerolled',async()=>{
 const {a}=require('./handcraft-route-fixture.cjs').routes();a.pieces=a.pieces.slice(0,2);a.pieces[0].pool=5;a.pieces[1].expectedRolls=0;const r=await S.evaluate(D,a,{options:{}},{query(){throw Error('No donor query expected');}},{modes:['normal']});close(r.stargazingRolls,a.pieces[0].expectedRolls);assert.equal(r.pieces[0].donorProbabilities,undefined);assert.equal(r.pieces[1].donorProbabilities,undefined);
});
test('jewel substitutions conserve named skills and respect real socket levels and stock',()=>{
 const a=D.skills.find(s=>s.name==='会心击【属性】'),b=D.skills.find(s=>s.name==='翔虫使'),deco=id=>D.decorations.find(d=>d.slot===2&&d.skills.length===1&&d.skills[0].skill_id===id&&d.skills[0].level===1),da=deco(a.id),db=deco(b.id),s=shape([[a.id,1]]),r={placement:[{owner:'weapon',level:2,decorationId:db.id}]};
 const unlimited=S.recipes(D,r,[s],null,{decos:'all'});assert.ok(unlimited.recipes.some(v=>v.totals.some(([id,n])=>id===b.id&&n===1)));assert.equal(S.recipes(D,r,[s],{counts:new Map()},{decos:'owned'}).recipes.length,1);
 const M=require('../dist/mod.js'),stock={counts:new Map([[M.decoToGame(da.id),1],[M.decoToGame(db.id),1]])};assert.ok(S.recipes(D,r,[s],stock,{decos:'owned'}).recipes.length>1);
 const small={placement:[{owner:'weapon',level:1,decorationId:db.id}]};assert.equal(S.recipes(D,small,[s],null,{decos:'all'}).recipes.length,1);assert.ok(!D.decorations.some(d=>d.skills.some(s=>[203,231,233].includes(s.skill_id))));
});
test('numeric fallback matches the exact lookup model within its sampling uncertainty',()=>{
 const a=shape([[233,1]]),b=shape([[203,1]]),f=[[a,b]],events=[{...a,p:.01},{...b,p:.02}],exact=S.groupMean(f,events),sample=S.groupMean(f,events,{stateLimit:0,trials:12000});assert.equal(sample.method,'event-driven-lookup-estimate');assert.ok(Math.abs(sample.expectedRolls-exact.expectedRolls)<5*sample.standardError);
});
test('different maximum skill levels cannot be exchanged even when the cost matches',()=>{
 const r=S.families(D,[shape([[233,1]]),shape([[90,1]])]);assert.equal(r.families.length,1);assert.deepEqual(r.families[0].map(s=>s.positive),[[[233,1]],[[90,1]]]);
});
test('unobserved donor probabilities never fall back to actual-armor values',async()=>{
 const {a}=require('./handcraft-route-fixture.cjs').routes(),r=await S.evaluate(D,a,{options:{}},{async query(){return {p:0,n:10000000,se:0,effectiveHits:0};}},{modes:['normal']});assert.equal(r.stargazingRolls,null);assert.equal(r.stargazingValid,false);assert.equal(r.equivalentStargazing.expectedRolls,null);for(const p of r.pieces){assert.equal(p.stargazingProbability,null);assert.equal(p.mode,null);assert.ok(p.probabilities.every(v=>v.p>0));}
});
test('nested native-skill loss caps are partitioned without changing any destination cap',()=>{
 const gs=[0,1,2].map(maxRemoved=>shape([[233,1]],{maxRemoved})),ps=new Map(gs.map((g,i)=>[S.signature(g),[.00307,.00375,.0038][i]])),events=S.outcomeRates(gs,ps);close(events.reduce((n,e)=>n+e.p,0),.0038);
 for(let i=0;i<gs.length;i++)close(events.filter(e=>S.covers(e,gs[i])).reduce((n,e)=>n+e.p,0),ps.get(S.signature(gs[i])));
 close(events.find(e=>S.covers(e,gs[0])).p,.00307);close(events.find(e=>!S.covers(e,gs[0])&&S.covers(e,gs[1])).p,.00068);close(events.find(e=>!S.covers(e,gs[1])).p,.00005);
});
test('crossing slot, deletion, positive and total-record bounds match a brute-force joint table',async()=>{
 const atoms=[[0,0,1,1,.01],[1,0,2,2,.02],[2,1,3,4,.03],[1,2,3,5,.04],[3,0,2,3,.05],[0,1,1,2,.06],[2,2,4,7,.07]],positive=[[233,1]],goals=[shape(positive,{growth:1,maxRemoved:1,maxPositiveRecords:2,maxRecords:3}),shape(positive,{growth:2,maxRemoved:2,maxPositiveRecords:3,maxRecords:5}),shape(positive,{growth:0,maxRemoved:0,maxPositiveRecords:4,maxRecords:7})],matches=(row,g)=>row[0]>=g.growth&&row[1]<=g.maxRemoved&&row[2]<=g.maxPositiveRecords&&row[3]<=g.maxRecords;
 const events=await S.loadOutcomeRates(goals,async s=>{assert.deepEqual(s.positive,positive);return {p:atoms.filter(row=>matches(row,s)).reduce((n,row)=>n+row[4],0)};}),expected=new Map(),actual=new Map();
 for(const row of atoms){const k=goals.map(g=>+matches(row,g)).join('');if(k!=='000')expected.set(k,(expected.get(k)||0)+row[4]);}for(const e of events){const k=goals.map(g=>+S.covers(e,g)).join('');actual.set(k,(actual.get(k)||0)+e.p);}assert.deepEqual([...actual.keys()].sort(),[...expected.keys()].sort());for(const[k,p]of expected)close(actual.get(k),p);
});
test('a fixed current mode cannot silently switch to a cheaper unselected mode',async()=>{
 const {a}=require('./handcraft-route-fixture.cjs').routes();a.pieces=a.pieces.slice(0,1);a.pieces[0].mode=a.pieces[0].stargazingMode='normal';a.stargazingGroups=[];const queried=[],bank={async query(_base,mode){queried.push(mode);return {p:mode==='normal'?.001:.1,n:10000000};}},r=await S.equivalent(D,a,{options:{}},bank,['normal','skills','slots'],null,{decos:'all'});close(r.expectedRolls,1000);assert.deepEqual([...new Set(queried)],['normal']);assert.equal(r.assignment.head,'normal');assert.equal(r.fixedModes,true);
});
test('the 685/563 regression retains normal/normal/normal/skills/skills and all native deletion allowances',async()=>{
 const input=require('./handcraft-route-fixture.cjs').singleSkillRoute(),before=JSON.stringify(input),P=require('../dist/probability.js'),L=require('./probability-loader.cjs'),bank=P.createBank(D,L.index.observation,g=>L.load(g)),out=await S.evaluate(D,input,{options:{}},bank,{modes:['normal','skills','slots']});close(out.stargazingRolls,846.479398196159);assert.equal(Math.round(out.equivalentStargazing.expectedRolls),818);assert.equal(out.equivalentStargazing.modeSearch,'fixed-current-group');
 const original=new Map(out.pieces.map(p=>[p.part,p]));assert.deepEqual(out.pieces.map(p=>p.mode),['normal','normal','normal','skills','skills']);for(const p of out.equivalentStargazing.example){const old=original.get(p.part),s=S.shape(D,old);assert.equal(out.equivalentStargazing.assignment[p.part],old.mode);assert.equal(p.maxRemoved,s.maxRemoved);assert.deepEqual(p.nativeMinimumChanges,s.baseline);assert.equal(p.maxPositiveRecords,s.maxPositiveRecords);assert.equal(p.maxRecords,s.maxRecords);assert.equal(p.growth,s.growth);}assert.equal(out.equivalentStargazing.example.find(p=>p.part==='leg').maxRemoved,2);assert.equal(JSON.stringify(input),before);
});
