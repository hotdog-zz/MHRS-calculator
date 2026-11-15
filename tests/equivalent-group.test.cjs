'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../dist/data.json'),H=require('../dist/handcraft.js'),S=require('../dist/stargazing.js'),F=require('./equivalent-group-fixture.json');
function group(r,config={...F.cfg,groupModePolicy:'joint'},inventory=null){const shapes=r.pieces.filter(p=>p.expectedRolls>0&&p.pool===6).map(p=>S.shape(D,p,F.request)),options=S.recipes(D,r,shapes,inventory,config),sets=options.recipes.map(recipe=>({recipe,families:S.families(D,shapes,recipe.totals).families})).filter(s=>s.families.length);return S.equivalenceGroupKey(D,r,F.request,config.modes,shapes,options,sets,config);}
function routes(){return structuredClone(F.routes).map(r=>{r.equivalenceKey=H.routeEquivalenceKey(D,r);r.equivalentStargazing.groupKey=group(r);return r;});}
test('the 627994 screenshot routes share one complete group despite different original outcomes, probabilities and redundant slots',()=>{
 const [a,b]=routes();assert.notEqual(a.equivalenceKey,b.equivalenceKey);assert.equal(group(a),group(b));assert.equal(Math.round(a.stargazingRolls),1485990);assert.equal(Math.round(b.stargazingRolls),1300476);assert.equal(H.uniqueRoutes(D,[a,b]).length,1);assert.equal(H.uniqueRoutes(D,[b,a])[0].id,a.id);
 const shapes=r=>r.pieces.map(p=>S.shape(D,p,F.request));for(const r of [a,b])assert.equal(S.families(D,shapes(r)).families.length,139);
 const original=structuredClone(a),different=structuredClone(a);original.equivalentStargazing.assignment.head='skills';original.equivalentStargazing.expectedRolls+=100;assert.equal(group(a),group(original));assert.equal(H.uniqueRoutes(D,[original,a])[0].id,a.id);
 different.equivalentStargazing.groupKey+='distinct';const kept=H.uniqueRoutes(D,[a,b,different],2);assert.equal(kept.length,2);
});
test('equal costs or examples never hide different native bounds, slot growth, quotas, sources, inventory or guarantees',()=>{
 const [a]=routes(),head=r=>r.pieces[0],mutations=[r=>head(r).goal.maxPositiveRecords=6,r=>head(r).goal.maxRecords=6,r=>head(r).goal.maxRemoved=0,r=>{head(r).goal.minimumChanges.find(v=>v.id===103).min=-1;},r=>head(r).goal.slots=[4,4,1],r=>head(r).goal.minimumChanges.find(v=>v.min>0).min++,r=>{head(r).baseId='Head:502';},r=>{head(r).source='reroll';head(r).ref={box:'equipment',index:9,fingerprint:'other'};},r=>r.charm.guideRef.index++,r=>r.totals[0]=1];
 // A redundant explicit maxRemoved=0 is the same restriction on this head.
 assert.equal(group(a),group((()=>{const r=structuredClone(a);mutations[2](r);return r;})()));
 for(const change of mutations.filter((_,i)=>i!==2)){const r=structuredClone(a);change(r);assert.notEqual(group(a),group(r));r.equivalentStargazing.groupKey=group(r);assert.equal(H.uniqueRoutes(D,[a,r]).length,2);}
 assert.notEqual(group(a),group(a,{...F.cfg,modes:['normal'],groupModePolicy:'joint'}));
 const b=structuredClone(a);b.equivalentStargazing.expectedRolls=a.equivalentStargazing.expectedRolls;b.equivalentStargazing.example=structuredClone(a.equivalentStargazing.example);b.equivalentStargazing.groupKey=group(b,{...F.cfg,modes:['normal'],groupModePolicy:'joint'});assert.equal(H.uniqueRoutes(D,[a,b]).length,2);
});
test('complete recipe alternatives are part of group identity; equal slot/skill costs do not erase stock limits',()=>{
 const [r]=routes(),skill=D.skills.find(s=>s.name==='会心击【属性】'),other=D.skills.find(s=>s.name==='翔虫使'),deco=id=>D.decorations.find(d=>d.slot===2&&d.skills.length===1&&d.skills[0].skill_id===id&&d.skills[0].level===1),M=require('../dist/mod.js'),a=deco(skill.id),b=deco(other.id);
 r.pieces[0].goal.minimumChanges.push({id:skill.id,min:1});r.placement=[{owner:r.weaponId,level:2,decorationId:b.id}];const owned={counts:new Map([[M.decoToGame(b.id),1]])};assert.notEqual(group(r),group(r,{...F.cfg,decos:'owned',groupModePolicy:'joint'},owned));
});
test('fixed legacy modes keep separate groups while joint mode trials retain the same family identity',()=>{
 const [a,b]=routes();b.pieces[0].stargazingMode='skills';assert.notEqual(group(a,{...F.cfg,groupModePolicy:'fixed'}),group(b,{...F.cfg,groupModePolicy:'fixed'}));assert.equal(group(a),group(b));
});

test('legacy donor evaluation attaches one joint group to both 627994 screenshot reconstructions',async()=>{
 const Q=require('../dist/equivalent-objective.js'),P=require('../dist/probability.js'),L=require('./probability-loader.cjs'),bank=P.createBank(D,L.index.observation,g=>L.load(g)),ev=Q.createEvaluator(D,F.request,null,bank,{...F.cfg,graftInverseCorrection:false},{maxModeAssignments:14}),out=[];
 for(const r of structuredClone(F.routes)){delete r.equivalentStargazing.groupKey;out.push(await ev.evaluate(r,10000));}
 assert.equal(out[0].equivalentStargazing.groupKey,out[1].equivalentStargazing.groupKey);assert.equal(Math.round(out[0].stargazingRolls),1485990);assert.equal(Math.round(out[1].stargazingRolls),1300476);for(const r of out)assert.equal(Math.round(r.equivalentStargazing.expectedRolls),627994);assert.equal(H.uniqueRoutes(D,out).length,1);
});
