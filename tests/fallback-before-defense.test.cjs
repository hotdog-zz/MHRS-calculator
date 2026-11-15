'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const D=require('../dist/data.json'),E=require('../dist/engine.js'),R=require('../dist/resource-templates.js'),S=require('../dist/share.js');
let highs;before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
const atom=(id,extra={})=>{const raw=D.atoms.find(a=>a.pool===6&&a.id===id),v=raw.values[0];return {atomId:id,value:v.value,valueIndex:v.value_index,count:1,...extra};};
const free=()=>[atom(59),atom(74,{value:6,valueIndex:2}),atom(145,{skillId:17}),atom(144,{skillId:12}),atom(89,{count:2})];
const bad=()=>[...free(),atom(71,{fallback:true})];
const query=()=>({weaponId:'DualBlades:481',skills:[{id:17,level:1},{id:12,level:1}],options:{augment:true,deleteSkills:true,defenseFallback:true,noCharm:true,seconds:3,limit:1}});
const none={id:'none',name:'不使用护石',empty:true,skills:[],slots:[]};
const plan=atoms=>({weaponId:'DualBlades:481',armors:E.PARTS.map(part=>({id:D.armors.find(a=>a.part===part&&a.seriesId===502).id,atoms:part==='head'?atoms:[]})),charm:none,decorations:[]});
const preError=e=>e.code==='DEFENSE_CANCELLED'&&e.defensePhase==='before-fallback'&&e.armorId==='Head:502';
function checkStages(data,piece){const def=piece.atoms.filter(a=>data.atoms.find(r=>r.pool===piece.pool&&r.id===a.atomId)?.category===13),ordinary=def.filter(a=>!a.fallback);assert.ok(!ordinary.length||ordinary.reduce((n,a)=>n+a.value*a.count,0)!==0);assert.ok(!def.length||def.reduce((n,a)=>n+a.value*a.count,0)!==0);const start=ordinary.filter(a=>a.value<0).reduce((n,a)=>n+a.value*a.count,0),positive=ordinary.filter(a=>a.value>0).flatMap(a=>Array(a.count).fill(a.value));function order(net,rest){return !rest.length||rest.some((v,i)=>net+v!==0&&order(net+v,rest.filter((_,j)=>j!==i)));}assert.ok(order(start,positive),'free DEF must have a non-cancelling positive permutation');}
test('manual and fixed ordinary augments reject zero-sum DEF before a nonzero closer, regardless of display order',()=>{
 const q=query(),input=bad(),before=JSON.stringify(input);for(const atoms of [input,input.slice().reverse(),E.orderedAtoms(D,D.armors.find(a=>a.id==='Head:502'),input)])assert.throws(()=>E.evaluateArmor(D,q,{id:'Head:502',atoms}),preError);
 assert.throws(()=>E.validateRequest(D,{...q,options:{...q.options,fixedArmors:{head:{id:'Head:502',atoms:input}}}}),preError);assert.equal(JSON.stringify(input),before);
 assert.throws(()=>E.evaluateArmor(D,q,{id:'Head:502',atoms:input.map(({fallback,...a})=>a)}),preError);
});
test('automatic finishing repairs a pre-closing zero-sum without changing skill/slot records or costs',()=>{
 const input=free(),before=JSON.stringify(input),out=E.finishFreeArmor(D,query(),{id:'Head:502',atoms:input}),p=E.evaluateArmor(D,query(),out);checkStages(D,p);assert.equal(p.records,7);assert.equal(p.cost,10);assert.equal(p.fallback.effect.value,2);assert.equal(p.finalDefense-p.defense,1);assert.equal(p.atoms.find(a=>a.atomId===74&&!a.fallback).value,5);assert.equal(JSON.stringify(input),before);
 assert.deepEqual(p.atoms.filter(a=>a.skillId!=null).map(a=>[a.skillId,a.value,a.count]).sort(),input.filter(a=>a.skillId!=null).map(a=>[a.skillId,a.value,a.count]).sort());
});
test('repeated DEF entries are counted individually and rerolled before closing',()=>{
 const input=[atom(60),atom(74,{value:6,valueIndex:2,count:2}),atom(144,{skillId:12}),atom(89,{count:2})],out=E.finishFreeArmor(D,query(),{id:'Head:502',atoms:input}),p=E.evaluateArmor(D,query(),out);checkStages(D,p);assert.equal(p.records,7);assert.deepEqual(p.atoms.filter(a=>a.atomId===74&&!a.fallback).map(a=>a.value).sort(),[5,6]);
});
test('six ordinary records with no DEF and negative nonzero DEF before closing remain legal',()=>{
 const noDefense=[atom(144,{skillId:12}),atom(89,{count:5})],p=E.evaluateArmor(D,query(),E.finishFreeArmor(D,query(),{id:'Head:502',atoms:noDefense}));assert.equal(p.records,7);assert.equal(p.atoms.filter(a=>a.atomId>=69&&a.atomId<=76).length,1);checkStages(D,p);
 const fixed=bad();fixed.find(a=>a.atomId===74).value=5;fixed.find(a=>a.atomId===74).valueIndex=1;checkStages(D,E.evaluateArmor(D,query(),{id:'Head:502',atoms:fixed}));
});
test('unmarked historical records can use another valid closer; an explicit invalid marker cannot be reassigned',()=>{
 const head=D.armors.find(a=>a.id==='Head:502'),data={...D,armors:D.armors.map(a=>a.id===head.id?{...a,budget:12}:a),atoms:D.atoms.map(a=>a.pool===6&&a.id===59?{...a,values:[{value:-5,value_index:0,weight:100}]}:a)},atoms=[atom(59,{value:-5}),atom(74,{value:6,valueIndex:2}),atom(74,{value:5,valueIndex:1}),atom(145,{skillId:17}),atom(144,{skillId:12}),atom(89,{count:2})];
 const p=E.evaluateArmor(data,query(),{id:head.id,atoms});assert.equal(p.fallback.effect.value,5);checkStages(data,p);assert.doesNotThrow(()=>E.evaluateArmor(data,{...query(),options:{...query().options,defenseFallback:false}},{id:head.id,atoms}));assert.throws(()=>E.evaluateArmor(data,query(),{id:head.id,atoms:atoms.map((a,i)=>({...a,...(i===1?{fallback:true}:{})}))}),preError);
});
test('ordinary JSON and compact share imports reject the old invalid result',async()=>{
 const q=query(),input=plan(bad());await assert.rejects(()=>S.parseText(D,JSON.stringify({application:'Sunbreak Forge',request:q,result:input})),preError);
 const payload=[1,D.meta.version,q.weaponId,7,q.skills.map(s=>[s.id,s.level]),input.armors.map(p=>[p.id,p.atoms.map(a=>[a.atomId,a.skillId??-1,a.valueIndex??0,a.count,a.fallback?1:0])]),[0],[]];assert.throws(()=>S.unpack(D,payload),preError);
});
test('minus three twice with six/six is impossible before closing, while six/four has a legal closing assignment',()=>{
 const head=D.armors.find(a=>a.id==='Head:502'),data={...D,armors:D.armors.map(a=>a.id===head.id?{...a,budget:11}:a),atoms:D.atoms.map(a=>a.pool===6&&a.id===59?{...a,values:[{value:-3,value_index:0,weight:100}]}:a)},rest=[atom(59,{value:-3,count:2}),atom(145,{skillId:17}),atom(144,{skillId:12}),atom(89)],six=atom(74,{value:6,valueIndex:2}),four=atom(74,{value:4,valueIndex:0});
 for(const atoms of [[...rest,six,six],[six,...rest,six]])assert.throws(()=>E.evaluateArmor(data,query(),{id:head.id,atoms}),preError);
 for(const atoms of [[...rest,four,six],[six,...rest,four]]){const p=E.evaluateArmor(data,query(),{id:head.id,atoms});assert.equal(p.fallback.effect.value,6);assert.equal(p.finalDefense-p.defense,4);checkStages(data,p);}
 assert.throws(()=>E.evaluateArmor(data,query(),{id:head.id,atoms:[...rest,six,{...four,fallback:true}]}),preError);
});
function limited(){const ids=new Set([59,74,71,144,145,89]),head=D.armors.find(a=>a.id==='Head:502'),others=E.PARTS.filter(p=>p!=='head').map(part=>({...D.armors.find(a=>a.part===part&&a.seriesId===502),pool:0,budget:0,skills:[],slots:[]}));return {...D,armors:[head,...others],decorations:[],atoms:D.atoms.filter(a=>a.pool!==6||ids.has(a.id))};}
test('resource-template replacement rebuilds positive DEF and produces a legal pre-closing state',()=>{
 const data=limited(),q=query(),out=R.completePlan(data,q,plan(bad())),p=out.pieces.find(p=>p.id==='Head:502');checkStages(data,p);assert.equal(p.fallback.effect.value,2);assert.equal(p.atoms.find(a=>a.atomId===74&&!a.fallback).value,5);assert.equal(p.finalDefense-p.defense,1);assert.equal(p.levels[17],1);assert.equal(p.levels[12],1);
 const fixed={...q,options:{...q.options,fixedArmors:{head:{id:'Head:502',atoms:bad()}}}};assert.throws(()=>R.completePlan(data,fixed,plan(bad())),preError);
});
function pin(model){const p=model.pieces.find(p=>p.a.id==='Head:502');for(const e of p.edits)model.lp.constraint([[1,e.n]],'=',e.sign>0&&[12,17].includes(e.skill)?1:0);for(const e of p.numeric)if(!e.fallback&&e.atom!==74)model.lp.constraint([[1,e.n]],'=',e.atom===59?1:e.atom===89&&e.value===-1?2:0);model.lp.constraint(p.numeric.filter(e=>!e.fallback&&e.atom===74).map(e=>[1,e.n]),'=',1);for(const c of p.choices)model.lp.constraint([[1,c.n]],'=',c.points===0?1:0);return p;}
test('full seven-record model separates pre-closing and final cuts and rebuilds a valid warm start',()=>{
 const data=limited(),q=query();Object.assign(q.options,{searchMode:'time',resultSort:'defense'});const model=E.buildModel(data,q,data.armors,[none]),p=pin(model);assert.equal(E.excludeDefenseCancellation(model,p.a.id),true);
 const v=p.numeric.find(e=>e.atom===74&&!e.fallback&&e.value===6),forced=model.lp.text().replace('Subject To\n','Subject To\n force_pre_zero: '+v.n+' = 1\n'),raw=highs.solve(forced,{output_flag:false,time_limit:2});assert.equal(raw.Status,'Optimal');assert.throws(()=>E.validateResult(data,q,E.reconstruct(model,raw,data,q)),preError);
 assert.equal(E.excludeDefenseCancellation(model,p.a.id,true),true);assert.equal(E.excludeDefenseCancellation(model,p.a.id,true),false);const good=highs.solve(model.lp.text(),{output_flag:false,time_limit:2});assert.equal(good.Status,'Optimal');const result=E.validateResult(data,q,E.reconstruct(model,good,data,q)),piece=result.pieces[0];checkStages(data,piece);const seed=E.modelSeed(data,model,result);assert.ok(seed);assert.equal(seed[model.lp.indices.get(p.defenseBeforeFallbackVars.positive)],0);assert.equal(seed[model.lp.indices.get(p.defenseCancellationVars.positive)],1);
});
test('full solver continues on the same armor after detecting pre-closing cancellation',async()=>{
 const data=limited(),q=query();Object.assign(q.options,{searchMode:'time',resultSort:'defense'});let calls=0,forced;
 const solver={solve(text,options){calls++;return highs.solve(calls===1?text.replace('Subject To\n','Subject To\n force_pre_zero: '+forced+' = 1\n'):text,options);}},result=await E.search(data,q,solver,()=>{},{bootstrap:false,refine:false,transformModel:model=>{const p=pin(model);forced=p.numeric.find(e=>e.atom===74&&!e.fallback&&e.value===6).n;}});
 assert.ok(calls>=2);assert.ok(result.results.length);assert.match(result.attempts[0].validation,/兜底前/);assert.equal(result.results[0].pieces[0].id,'Head:502');checkStages(data,result.results[0].pieces[0]);
});

test('unrepairable post-solve prefix cancellation excludes only its concrete free pattern',()=>{
 const base=limited(),data={...base,atoms:base.atoms.map(a=>a.pool===6&&a.id===74?{...a,values:a.values.filter(v=>v.value===6)}:a)},q=query();q.options.searchMode='count';const model=E.buildModel(data,q,data.armors,[none]),p=model.pieces[0],fixed=[];
 for(const e of p.edits)fixed.push([e.n,e.sign>0&&[12,17].includes(e.skill)?1:0]);for(const e of p.numeric)fixed.push([e.n,e.atom===59||e.atom===74?1:e.atom===89&&e.value===-1?2:0]);for(const c of p.choices)fixed.push([c.n,c.points===0?1:0]);
 const forced=model.lp.text().replace('Subject To\n','Subject To\n'+fixed.map(([n,v],i)=>' force_'+i+': '+n+' = '+v+'\n').join('')),raw=highs.solve(forced,{output_flag:false,time_limit:2});assert.equal(raw.Status,'Optimal');assert.throws(()=>E.reconstruct(model,raw,data,q),e=>e.code==='POST_FALLBACK_INVALID'&&e.defensePhase==='before-fallback');assert.equal(E.excludeFreePattern(model,p.a.id,raw),true);
 const good=highs.solve(model.lp.text(),{output_flag:false,time_limit:2});assert.equal(good.Status,'Optimal');const result=E.validateResult(data,q,E.reconstruct(model,good,data,q));assert.equal(result.pieces[0].id,p.a.id);checkStages(data,result.pieces[0]);
});

function internalSix(){const head=D.armors.find(a=>a.id==='Head:502'),ids=new Set([59,74,71,144,145]),data={...D,armors:[{...head,budget:16},...E.PARTS.filter(p=>p!=='head').map(part=>({...D.armors.find(a=>a.part===part&&a.seriesId===502),pool:0,budget:0,skills:[],slots:[]}))],decorations:[],atoms:D.atoms.filter(a=>a.pool!==6||ids.has(a.id)).map(a=>a.pool===6&&a.id===59?{...a,values:[{value:-3,value_index:0,weight:100}]}:a)},core=[atom(59,{value:-3,count:2}),atom(145,{skillId:17}),atom(144,{skillId:12})];return {data,core};}
test('the six ordinary records themselves distinguish -3/-3/+6/+6 from -3/-3/+6/+4',()=>{
 const {data,core}=internalSix(),six=atom(74,{value:6,valueIndex:2}),four=atom(74,{value:4,valueIndex:0}),closing=atom(71,{fallback:true}),bad=[...core,{...six,count:2},closing];assert.throws(()=>E.evaluateArmor(data,query(),{id:'Head:502',atoms:bad}),e=>preError(e)&&e.defenseFailure==='order');
 for(const positives of [[six,four],[four,six]]){const p=E.evaluateArmor(data,query(),{id:'Head:502',atoms:[...core,...positives,closing]});assert.equal(p.records,7);assert.equal(p.finalDefense-p.defense,6);assert.equal(p.fallback.effect.atomId,71);checkStages(data,p);}
 const p=E.evaluateArmor(data,query(),E.finishFreeArmor(data,query(),{id:'Head:502',atoms:[...core,{...six,count:2}]}));assert.deepEqual(p.atoms.filter(a=>a.atomId===74&&!a.fallback).map(a=>a.value).sort(),[5,6]);checkStages(data,p);
});
test('full-model order failures cut the concrete pattern even when the free and final DEF sums are nonzero',async()=>{
 const {data}=internalSix(),q=query();Object.assign(q.options,{searchMode:'time',resultSort:'defense'});let calls=0;
 const solver={solve(text,options){calls++;return highs.solve(text,options);}},response=await E.search(data,q,solver,()=>{},{bootstrap:false,refine:false,transformModel:model=>{const p=model.pieces[0];for(const e of p.edits)model.lp.constraint([[1,e.n]],'=',e.sign>0&&[12,17].includes(e.skill)?1:0);for(const e of p.numeric)if(!e.fallback&&e.atom!==74)model.lp.constraint([[1,e.n]],'=',e.atom===59?2:0);model.lp.constraint(p.numeric.filter(e=>!e.fallback&&e.atom===74).map(e=>[1,e.n]),'=',2);for(const c of p.choices)model.lp.constraint([[1,c.n]],'=',c.points===0?1:0);}});
 assert.ok(calls>=2);assert.match(response.attempts[0].validation,/兜底前/);assert.ok(response.results.length);assert.deepEqual(response.results[0].pieces[0].atoms.filter(a=>a.atomId===74&&!a.fallback).map(a=>a.value).sort(),[5,6]);checkStages(data,response.results[0].pieces[0]);
});
test('free DEF ordering agrees with independent permutation enumeration for 5,532 mixed profiles',()=>{
 const data={atoms:[{pool:1,id:59,category:13,cost:-1,values:Array.from({length:12},(_,i)=>({value:-i-1,value_index:i,weight:1}))},{pool:1,id:69,category:13,cost:1,values:Array.from({length:6},(_,i)=>({value:i+1,value_index:i,weight:1}))},{pool:1,id:89,category:14,cost:1,values:[{value:1,value_index:0,weight:1}]}]},armor={id:'synthetic',part:'head',pool:1,budget:5};let checked=0;
 function possible(net,values){if(!values.length)return true;for(let i=0;i<values.length;i++)if(net+values[i]!==0&&possible(net+values[i],values.filter((_,j)=>j!==i)))return true;return false;}
 for(let negative=1;negative<=12;negative++)for(let size=1;size<=5;size++){const values=[];function enumerate(min){if(values.length<size){for(let v=min;v<=6;v++){values.push(v);enumerate(v);values.pop();}return;}const atoms=[{atomId:59,value:-negative,valueIndex:negative-1,count:1},...values.map(v=>({atomId:69,value:v,valueIndex:v-1,count:1})),...(size<5?[{atomId:89,value:1,valueIndex:0,count:5-size}]:[]),{atomId:69,value:1,valueIndex:0,count:1,fallback:true}],expected=possible(-negative,values);let actual=true;try{E.splitFallback(data,armor,atoms,7,5);}catch(e){assert.equal(e.defensePhase,'before-fallback');actual=false;}assert.equal(actual,expected,JSON.stringify({negative,values}));checked++;}enumerate(1);}
 assert.equal(checked,5532);
});
