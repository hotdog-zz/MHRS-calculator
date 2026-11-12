'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),H=require('../dist/handcraft.js'),D=require('../dist/data.json'),{routes}=require('./handcraft-route-fixture.cjs');
test('skill-label swaps and redundant slot minima collapse before the output limit, retaining the clearer representative',()=>{
 const {a,b}=routes();assert.equal(H.routeEquivalenceKey(D,a),H.routeEquivalenceKey(D,b));const kept=H.uniqueRoutes(D,[a,b]);assert.equal(kept.length,1);assert.equal(kept[0].id,b.id);assert.equal(Math.round(kept[0].expectedRolls),1274);assert.equal(Math.round(kept[0].stargazingRolls),718);
 const c=structuredClone(a);c.id='different-extra';c.totals[0]=1;c.stargazingRolls+=1;const two=H.uniqueRoutes(D,[a,b,c],2);assert.equal(two.length,2);assert.ok(two.some(r=>r.id===c.id));
});
test('equal displayed counts do not erase native restrictions, foreign multiplicity, skill maxima, inventory references or extra skills',()=>{
 const {a,ids}=routes(),head=r=>r.pieces.find(p=>p.part==='head'),changes=[
  r=>{head(r).goal.maxPositiveRecords=6;},r=>{head(r).goal.deleteSkills=false;},
  r=>{const p=head(r),s=p.goal.skills.find(s=>s.skill_id===ids['翔虫使']);s.level--;p.goal.minimumChanges.find(s=>s.id===ids['翔虫使']).min--;},
  r=>{const p=head(r);p.goal.minimumChanges.push({id:ids['奋斗'],min:1});p.goal.skills.push({skill_id:ids['奋斗'],level:1});},
  r=>{const p=head(r);p.goal.minimumChanges.find(s=>s.id===ids['业铠【修罗】']).min=2;p.goal.skills.find(s=>s.skill_id===ids['业铠【修罗】']).level=2;},
  r=>{r.charm.guideRef.index++;},r=>{head(r).source='reroll';head(r).ref={box:'equipment',index:2,fingerprint:'other'};},
  r=>{r.totals[0]=1;},r=>{head(r).probabilities[0].p+=.00000001;},
  r=>{head(r).baseId='Head:502';},r=>{head(r).goal.slots=[4,4,4];}
 ];for(const change of changes){const b=structuredClone(a);b.id='different';change(b);assert.notEqual(H.routeEquivalenceKey(D,a),H.routeEquivalenceKey(D,b));assert.equal(H.uniqueRoutes(D,[a,b]).length,2);}
 const c=structuredClone(a),d=structuredClone(a);for(const[r,id]of [[c,12],[d,42]]){const p=head(r);p.goal.minimumChanges=p.goal.minimumChanges.map(s=>s.id===ids['业铠【修罗】']?{id,min:1}:s);p.goal.skills=p.goal.skills.map(s=>s.skill_id===ids['业铠【修罗】']?{skill_id:id,level:1}:s);}assert.equal(D.skills.find(s=>s.id===12).cost,D.skills.find(s=>s.id===42).cost);assert.notEqual(H.routeEquivalenceKey(D,c),H.routeEquivalenceKey(D,d));
});
test('different valid jewel recipes for the same skills do not consume separate augmentation route slots',()=>{
 const {a,b}=routes(),E=require('../dist/engine.js');a.decorations=[{id:'Deco:0',count:2}];b.decorations=[{id:'MrDeco:58',count:1}];
 for(const r of [a,b]){r.totals[0]=2;r.placement=E.packDecorations([{id:r.weaponId,slots:D.weapons.find(w=>w.id===r.weaponId).slots},...r.pieces.map(p=>({id:p.id,slots:p.slots})),{id:'charm',slots:r.charm.slots}],r.decorations.map(d=>({d:D.decorations.find(v=>v.id===d.id),count:d.count})));assert.equal(r.placement.filter(p=>p.decorationId).length,r.decorations.reduce((n,d)=>n+d.count,0));}
 assert.notDeepEqual(a.decorations,b.decorations);assert.equal(H.routeEquivalenceKey(D,a),H.routeEquivalenceKey(D,b));const kept=H.uniqueRoutes(D,[a,b],1);assert.equal(kept.length,1);assert.ok(kept[0]===a||kept[0]===b);assert.ok(kept[0].placement.some(p=>p.decorationId));
 const c=structuredClone(b);c.id='extra-skill';c.totals[12]=1;assert.equal(H.uniqueRoutes(D,[a,b,c],2).length,2);
});
test('equivalent expectation controls representative selection and limits before the current-group tiebreak',()=>{
 const {a,b}=routes();a.stargazingRolls=100;a.equivalentStargazing={expectedRolls:90};b.stargazingRolls=120;b.equivalentStargazing={expectedRolls:80};assert.ok(H.compare(b,a)<0);assert.ok(H.preferRepresentative(b,a)<0);assert.equal(H.uniqueRoutes(D,[a,b],1)[0],b);
 b.equivalentStargazing.expectedRolls=90;assert.ok(H.compare(a,b)<0);assert.equal(H.uniqueRoutes(D,[a,b],1)[0],a);
});
test('unavailable equivalent estimates sort last and zero-roll equivalents remain valid',()=>{
 const r=(id,current,equivalent)=>({id,stargazingRolls:current,equivalentStargazing:equivalent,expectedRolls:current,needsRolling:1,needsCrafting:1}),unknown=r('unknown',1,{expectedRolls:null}),valid=r('valid',200,{expectedRolls:100}),zero=r('zero',0,{expectedRolls:0});assert.deepEqual([unknown,valid,zero].sort(H.compare).map(r=>r.id),['zero','valid','unknown']);assert.equal(H.equivalentScore(unknown),Infinity);assert.equal(H.equivalentScore(zero),0);assert.equal(H.equivalentScore(r('nan',1,{expectedRolls:NaN})),Infinity);assert.equal(H.equivalentScore(r('negative',1,{expectedRolls:-1})),Infinity);
});
