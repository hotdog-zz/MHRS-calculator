const {test,before}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const E=require('../dist/engine.js');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
function fixture(){return {skills:[{id:0,name:'目标',max:7,cost:15},{id:20,name:'非目标原生',max:5,cost:3},...[1,2,3,4].map(id=>({id,name:'原生'+id,max:7,cost:6}))],weapons:[{id:'weapon',slots:[],defense:0}],armors:E.PARTS.map((part,i)=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,resistances:{fire:0,water:0,thunder:0,ice:0,dragon:0},skills:i===0?[{skill_id:20,level:2}]:[],slots:[],pool:i===0?1:0,budget:i===0?10:0})),atoms:[{pool:1,id:148,category:20,cost:15,values:[{value:1,value_index:0,weight:100}]},{pool:1,id:149,category:20,cost:-10,values:[{value:-1,value_index:0,weight:100}]}],decorations:[],fixedCharms:[]};}
function request(skills=[{id:0,level:2}]){return {weaponId:'weapon',skills,options:{noCharm:true,sex:'MaleOnly',seconds:5,limit:1}};}
async function solveFixture(data,q){const charm={id:'none',name:'无',empty:true,skills:[],slots:[]};const m=E.buildModel(data,q,data.armors,[charm]);const raw=highs.solve(m.lp.text(),{output_flag:false,time_limit:3});return {raw,m};}
test('删除未要求的原生技能，返还cost且占用7条名额',async()=>{const d=fixture(),q=request(),{raw,m}=await solveFixture(d,q);assert.equal(raw.Status,'Optimal');const r=E.validateResult(d,q,E.reconstruct(m,raw,d,q));const p=r.pieces[0];assert.equal(p.levels[20],0);assert.equal(p.levels[0],2);assert.equal(p.cost,10);assert.equal(p.records,4);});
test('禁止技能删除时，同一个预算不足的请求无整数可行解',async()=>{const d=fixture(),q=request();q.options.deleteSkills=false;assert.equal((await solveFixture(d,q)).raw.Status,'Infeasible');});
test('原生五种技能即使删除，也不释放新增技能种类名额',async()=>{const d=fixture(),q=request([{id:0,level:1}]);d.armors[0].skills=[20,1,2,3,4].map(skill_id=>({skill_id,level:1}));d.armors[0].budget=100;assert.equal((await solveFixture(d,q)).raw.Status,'Infeasible');});
test('七条上限限制技能添加，不能生成第八条',async()=>{const d=fixture(),q=request([{id:0,level:7},{id:1,level:1}]);d.armors[0].skills=[];d.armors[0].budget=200;d.atoms.push({pool:1,id:145,category:20,cost:6,values:[{value:1,value_index:0,weight:100}]});assert.equal((await solveFixture(d,q)).raw.Status,'Infeasible');});
test('独立校验拒绝同技能既增又减和伪造cost',async()=>{const d=fixture(),q=request();const {raw,m}=await solveFixture(d,q);const r=E.reconstruct(m,raw,d,q);r.armors[0].atoms.push({atomId:149,skillId:0,value:-1,count:1});assert.throws(()=>E.validateResult(d,q,r),/同时增加和删除/);});
test('非炼化装备、特殊池13不能添加技能',async()=>{const d=fixture(),q=request();d.armors[0].pool=13;d.armors[0].budget=100;d.atoms=d.atoms.map(a=>({...a,pool:13}));assert.equal((await solveFixture(d,q)).raw.Status,'Infeasible');});
test('孔位升级先补空，再从左向右升级',()=>{assert.deepEqual(E.upgradeSlots([4,3],2),[4,4,1]);assert.deepEqual(E.upgradeSlots([4,2],2),[4,3,1]);assert.deepEqual(E.upgradeSlots([],12),[4,4,4]);assert.deepEqual(E.upgradeSlots([4,4,4],3),[4,4,4]);});
test('一个4级孔不能被误当成两个2级孔',()=>{assert.throws(()=>E.packDecorations([{id:'x',slots:[4]}],[{d:{id:'d',slot:2},count:2}]),/无法容纳/);const p=E.packDecorations([{id:'x',slots:[4,1]}],[{d:{id:'d',slot:2},count:1},{d:{id:'e',slot:1},count:1}]);assert.equal(p.filter(p=>p.decorationId).length,2);});
test('未要求的原生技能虽无技能等效，仍记录可删除资源',()=>{const d=fixture(),q=request();const s=E.equivalentScore(d.armors[0],q.skills,d);assert.equal(s.native,0);assert.equal(s.refundable,2);});
test('逐件防御校验计算重复词条，不计基础防御、耐性；无防御词条与非零净变化可用',()=>{
 const d=fixture(),q=request();d.atoms.push(...[[59,-6,-3],[60,-12,-5],[74,6,5]].map(([id,value,cost])=>({pool:1,id,category:13,cost,values:[{value,value_index:0,weight:100}]})),{pool:1,id:89,category:14,cost:2,values:[{value:2,value_index:0,weight:100}]});
 const atom=(atomId,value,count=1)=>({atomId,value,valueIndex:0,count});
 for(const atoms of [[atom(59,-6),atom(74,6)],[atom(60,-12),atom(74,6,2)]])assert.throws(()=>E.evaluateArmor(d,q,{id:'head',atoms}),e=>e.code==='DEFENSE_CANCELLED'&&e.armorId==='head');
 for(const atoms of [[],[atom(59,-6)],[atom(74,6)],[atom(59,-6),atom(74,6,2)],[atom(89,2)]])assert.doesNotThrow(()=>E.evaluateArmor(d,q,{id:'head',atoms}));
 q.options.fixedArmors={head:{id:'head',atoms:[atom(59,-6),atom(74,6)]}};assert.throws(()=>E.validateRequest(d,q),/防御炼化词条之和为0/);
});
test('结果检测拒绝抵消后继续求解同一套防具，数量模式与时限模式均可恢复',async()=>{
 for(const searchMode of ['count','time']){
  const d=fixture(),q=request([{id:0,level:1}]);q.options.searchMode=searchMode;
  d.atoms.push(...[[59,-6,-3],[74,6,5]].map(([id,value,cost])=>({pool:1,id,category:13,cost,values:[{value,value_index:0,weight:100}]})));
  const m=E.buildModel(d,q,d.armors,[{id:'none',name:'无',empty:true,skills:[],slots:[]}]);const terms=m.pieces[0].numeric;let calls=0;
  const solver={solve(text,options){if(++calls===1)text=text.replace('Subject To\n','Subject To\n'+terms.map((v,i)=>` forced_def_${i}: ${v.n} = 1\n`).join(''));return highs.solve(text,options);}};
  const r=await E.search(d,q,solver);assert.equal(r.status,'feasible',JSON.stringify(r.attempts));assert.ok(calls>=2);assert.match(r.attempts[0].validation,/防御炼化词条之和为0/);
  const p=r.results[0].pieces.find(p=>p.id==='head');assert.ok(p);const defense=p.atoms.filter(a=>d.atoms.find(v=>v.id===a.atomId).category===13);assert.ok(!defense.length||defense.reduce((s,a)=>s+a.value*a.count,0)!==0);
 }
});
test('真实最终版数据：求解、独立校验与导出字段',async()=>{const d=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../dist/data.json')));const q={weaponId:'LongSword:302',skills:[{id:0,level:7},{id:5,level:7},{id:6,level:3},{id:7,level:3},{id:205,level:1}],options:{sex:'MaleOnly',seconds:15,limit:1}};const r=await E.search(d,q,highs);assert.equal(r.status,'feasible',JSON.stringify(r.attempts));const s=r.results[0];assert.equal(s.verified,true);assert.equal(s.pieces.length,5);assert.ok(q.skills.every(x=>s.totals[x.id]>=x.level));assert.ok(s.pieces.every(x=>x.records<=7&&x.cost<=x.budget));E.validateResult(d,q,s);const bad=structuredClone(s);bad.charm.slots=[4,4,4];assert.throws(()=>E.validateResult(d,q,bad),/护石孔位/);});
test('真实14项极限目标：使用负面与非目标技能删除，逐件校验通过',async()=>{const d=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../dist/data.json')));const sample=JSON.parse(fs.readFileSync(path.resolve(__dirname,'extreme-sample.json')));const r=await E.search(d,sample.request,highs);assert.equal(r.status,'feasible',JSON.stringify(r.attempts));const v=r.results[0],wanted=new Set(sample.request.skills.map(s=>s.id));assert.ok(v.records>0);assert.ok(v.pieces.some(p=>p.atoms.some(a=>a.value<0&&a.skillId!=null&&!wanted.has(a.skillId))));assert.ok(v.pieces.every(p=>p.cost<=p.budget&&p.records<=7));E.validateResult(d,sample.request,v);});
