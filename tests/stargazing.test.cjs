'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),H=require('../dist/handcraft.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),a+' != '+b);
function inclusion(ps){let answer=0;for(let mask=1;mask<1<<ps.length;mask++){let n=0,p=0;for(let i=0;i<ps.length;i++)if(mask&(1<<i)){n++;p+=ps[i];}answer+=(n%2?1:-1)/p;}return answer;}
function brute(pieces){let best=Infinity,individual=Infinity;const choices=[];function run(i){if(i<pieces.length){for(const c of pieces[i].probabilities){choices[i]=c;run(i+1);}return;}const groups=new Map();let sum=0;for(let j=0;j<pieces.length;j++){const p=pieces[j],c=choices[j],key=p.pool===6?[p.pool,p.budget,c.mode].join(':'):'individual:'+j;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c.p);sum+=1/c.p;}if([...groups.values()].some(ps=>ps.reduce((a,b)=>a+b,0)>1))return;const cost=[...groups.values()].reduce((a,ps)=>a+inclusion(ps),0);if(cost<best-1e-8||Math.abs(cost-best)<1e-8&&sum<individual){best=cost;individual=sum;}}run(0);return {best,individual};}
test('exclusive stargazing expectation matches two/three coupon formulas and stays stable for disparate probabilities',()=>{
 close(H.exclusiveMean([.01,.02]),116.66666666666667);close(H.exclusiveMean([.01,.02,.03]),inclusion([.01,.02,.03]));close(H.exclusiveMean([.01,.01,.01,.01,.01]),(1+1/2+1/3+1/4+1/5)/.01);assert.equal(H.exclusiveMean([]),0);assert.equal(H.exclusiveMean([1]),1);close(H.exclusiveMean([1e-12,.1]),1e12);assert.equal(H.exclusiveMean([.8,.8]),Infinity);assert.throws(()=>H.exclusiveMean([0]),/概率无效/);
});
test('joint mode selection can prefer a lower individual probability and prunes instead of enumerating every assignment',()=>{
 const pieces=[{part:'head',pool:6,budget:10,expectedRolls:1/.011,probabilities:[{mode:'normal',p:.01},{mode:'skills',p:.011}]},{part:'chest',pool:6,budget:10,expectedRolls:50,probabilities:[{mode:'normal',p:.02},{mode:'skills',p:.001}]}],r=H.optimizeModes(pieces);assert.equal(r.valid,true);assert.deepEqual(r.choices.map(c=>c.mode),['normal','normal']);close(r.stargazingRolls,116.66666666666667);close(r.expectedRolls,150);assert.equal(pieces[0].expectedRolls,1/.011);
 const five=Array.from({length:5},(_,i)=>({part:'part'+i,pool:6,budget:10,expectedRolls:100,probabilities:[{mode:'normal',p:.01},{mode:'skills',p:.009},{mode:'slots',p:.008}]})),p=H.optimizeModes(five);close(p.stargazingRolls,H.exclusiveMean(Array(5).fill(.01)));assert.equal(p.stats.totalCombinations,243);assert.ok(p.stats.pruned>0);assert.ok(p.stats.evaluated<243,JSON.stringify(p.stats));
});
test('different modes and non-graftable pools add, completed gear costs zero, and invalid probability sums stay explicit',()=>{
 const piece=(pool,mode,p)=>({pool,budget:10,expectedRolls:1/p,probabilities:[{mode,p}]}),a=piece(6,'normal',.01);close(H.optimizeModes([a,piece(6,'skills',.02)]).stargazingRolls,150);close(H.optimizeModes([a,piece(5,'normal',.02)]).stargazingRolls,150);const z=H.optimizeModes([{expectedRolls:0},a]);assert.equal(z.choices[0],null);close(z.stargazingRolls,100);assert.equal(H.optimizeModes([piece(6,'normal',.8),piece(6,'normal',.8)]).stargazingRolls,null);
});
test('only pool6 shares; equal non-pool6 pools, unknown pools and high-probability single pieces remain independent',()=>{
 const p=(part,pool,normal,skills)=>({part,pool,budget:10,expectedRolls:1/Math.max(normal,skills),probabilities:[{mode:'normal',p:normal},{mode:'skills',p:skills}]}),a=p('head',5,.01,.02),b=p('chest',5,.02,.01),independent=H.optimizeModes([a,b]);
 close(independent.stargazingRolls,100);assert.deepEqual(independent.choices.map(c=>c.mode),['skills','normal']);assert.equal(independent.groups.length,2);assert.ok(independent.groups.every(g=>g.shared===false&&g.parts.length===1));
 close(H.optimizeModes([p('head',5,.8,.1),p('arm',5,.8,.1)]).stargazingRolls,2.5);close(H.optimizeModes([p('head',undefined,.01,.02),p('arm',undefined,.01,.02)]).stargazingRolls,100);
 const mixed=H.optimizeModes([p('head',6,.01,.001),p('chest',6,.02,.001),a,b]);close(mixed.stargazingRolls,116.66666666666667+100);assert.equal(mixed.groups.filter(g=>g.shared).length,1);assert.equal(mixed.stats.totalCombinations,4);
});
test('branch-and-bound agrees with independent full enumeration on randomized small mode allocations',()=>{
 let state=91;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
 for(let iteration=0;iteration<80;iteration++){const pieces=Array.from({length:1+iteration%5},(_,i)=>({part:'part'+i,pool:random()<.8?6:5,budget:10,expectedRolls:1,probabilities:['normal','skills','slots'].filter((_,j)=>j===0||random()<.8).map(mode=>({mode,p:(1+Math.floor(random()*80))/1000}))})),reference=brute(pieces),actual=H.optimizeModes(pieces);close(actual.stargazingRolls,reference.best);close(actual.expectedRolls,reference.individual);}
});
