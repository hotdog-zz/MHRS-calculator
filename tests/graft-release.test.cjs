'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),D=require('../dist/data.json'),H=require('../dist/handcraft.js'),S=require('../dist/stargazing.js'),P=require('../dist/probability.js'),L=require('./probability-loader.cjs'),F=require('./graft-release-fixture.json'),version=require('../package.json').version;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,b),a+' != '+b),bank=()=>P.createBank(D,L.index.observation,g=>L.load(g));
test('release metadata and default guide configuration select complete position-weighted graft queries',()=>{
 const cfg=H.config();assert.equal(cfg.graftInverseCorrection,false);assert.equal(cfg.graftDeletionCorrection,true);const shape=S.correctedShape(S.shape(D,F.route.pieces[0],F.request),{}),options=S.donorOptions(shape);assert.equal(options.graftTargets[0].completeOutcome,true);assert.ok(Array.isArray(options.graftTargets[0].removedWeights));
 for(const name of ['dist/config.js','dist/inventory.js','dist/handcraft-ui.js','dist/index.html','README.md'])assert.ok(fs.readFileSync(path.resolve(__dirname,'..',name),'utf8').includes(version),name);
 const page=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');assert.ok(page.includes('不计算扣后补回'));assert.ok(!page.includes('计入扣后补回'));
});
test('default release reproduces the corrected bow route while preserving original armor probabilities',async()=>{
 const output=await S.evaluate(D,F.route,F.request,bank(),{modes:['normal','skills','slots'],decos:'all'});assert.equal(output.stargazingModel,'palace-current-group-weighted-complete-v1');close(output.stargazingRolls,38027.73108262304);close(output.equivalentStargazing.expectedRolls,21661.680351629606);assert.equal(output.expectedRolls,F.route.expectedRolls);
 for(let i=0;i<output.pieces.length;i++)assert.equal(JSON.stringify(output.pieces[i].probabilities),JSON.stringify(F.route.pieces[i].probabilities));
 const legacy=await S.evaluate(D,F.route,F.request,bank(),{modes:['normal','skills','slots'],decos:'all',graftInverseCorrection:false});close(legacy.stargazingRolls,22327.046832207205);close(legacy.equivalentStargazing.expectedRolls,14287.988784063617);
});
