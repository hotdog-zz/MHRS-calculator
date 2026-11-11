const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),E=require('../dist/engine.js'),X=require('../dist/extensions.js'),R=require('../dist/resource-templates.js');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
function fixture(budget=18){const costs=[3,6,9,12,15],data={skills:[{id:0,name:'目标',max:1,cost:15},...costs.map((cost,i)=>({id:i+1,name:'费用'+cost,max:3,cost}))],weapons:[{id:'w',slots:[],defense:0}],armors:E.PARTS.map(part=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,slots:[],skills:part==='chest'?[{skill_id:0,level:1}]:[],pool:part==='head'?1:0,budget:part==='head'?budget:0,resistances:{}})),atoms:[...costs.map((cost,i)=>({pool:1,id:144+i,category:20,cost,values:[{value:1,value_index:0,weight:100}]})),{pool:1,id:149,category:20,cost:-10,values:[{value:-1,value_index:0,weight:100}]},{pool:1,id:69,category:13,cost:1,values:[{value:1,value_index:0,weight:100}]}],decorations:[],fixedCharms:[]},request={weaponId:'w',skills:[{id:0,level:1}],options:{augment:true,noCharm:true,deleteSkills:true,defenseFallback:false,augmentLimits:{},fixedArmors:{}}};const result=(atoms,decorations=[])=>E.validateResult(data,request,{weaponId:'w',armors:data.armors.map(a=>({id:a.id,atoms:a.part==='head'?atoms:[]})),charm:{empty:true,skills:[],slots:[]},decorations}),entry=r=>{const v=X.vector(data,request,r,data.skills.map(s=>s.id));return {id:X.key(v),vector:v,result:r};},atom=id=>({atomId:143+id,skillId:id,value:1,valueIndex:0,count:1});return {data,request,result,entry,atom};}
const expanded=(d,q,g,ids)=>[...X.substitutions(d,q,g,ids)].filter(e=>!e.checkpoint);
test('C及以下模板更换实际技能cost词条，并重新补足防御兜底',()=>{
 const f=fixture(6);f.request.options.defenseFallback=true;const g=X.resourceGroups(f.data,f.request,[f.entry(f.result([f.atom(2)]))])[0];assert.deepEqual(g.tokens,['G:6']);const out=expanded(f.data,f.request,g,[1,2,3,4,5]);assert.deepEqual(new Set(out.map(v=>v.choices[0])),new Set([1,2]));const d=out.find(v=>v.choices[0]===1).result.pieces[0];assert.equal(d.atoms.find(a=>a.skillId===1).atomId,144);assert.equal(d.cost,6);assert.ok(d.finalDefense>100);for(const e of out)E.validateResult(f.data,f.request,e.result);
});
test('同一额外技能的炼化与珠子两种解释都保留',()=>{
 const f=fixture(3);f.data.weapons[0].slots=[1];f.data.decorations=[1,2].map(id=>({id:'d'+id,slot:1,skills:[{skill_id:id,level:1}]}));f.request.skills.push({id:1,level:1});const entry=f.entry(f.result([f.atom(1)],[{id:'d1',count:1}])),groups=X.resourceGroups(f.data,f.request,[entry]);assert.ok(groups.some(g=>g.tokens.includes('D')));const hole=groups.find(g=>g.tokens.includes('H'));assert.ok(hole);assert.ok(expanded(f.data,f.request,hole,[1,2]).some(e=>e.vector[2]===1));
});
test('真实四级孔支持多级珠与多技能珠，不拆成四个一孔',()=>{
 const f=fixture();f.data.weapons[0].slots=[4];f.data.decorations=[{id:'d1',slot:1,skills:[{skill_id:1,level:1}]},{id:'d4',slot:4,skills:[{skill_id:2,level:2}]},{id:'mixed',slot:3,skills:[{skill_id:3,level:1},{skill_id:4,level:1}]}];const g=X.resourceGroups(f.data,f.request,[f.entry(f.result([],[{id:'d1',count:1}]))])[0];assert.deepEqual(g.tokens,['J:4']);const out=expanded(f.data,f.request,g,[1,2,3,4]);assert.ok(out.some(e=>e.vector[2]===2));assert.ok(out.some(e=>e.vector[3]===1&&e.vector[4]===1));assert.ok(out.every(e=>e.result.decorations.reduce((n,d)=>n+d.count,0)===1));
});
test('逐件共享预算保留15+3、12+6、9+9，并拒绝15+15',()=>{
 assert.deepEqual(new Set(X.costProfiles([3,6,9,12,15],2,18).map(v=>v.join('+'))),new Set(['3+15','6+12','9+9']));const f=fixture(18),source=f.entry(f.result([f.atom(2),f.atom(4)])),found=[];X.promote(f.data,f.request,source,[1,2,3,4,5],r=>found.push(f.entry(r)),Date.now()+3000,r=>E.validateResult(f.data,f.request,r));assert.ok(found.some(e=>e.result.pieces[0].atoms.some(a=>a.skillId===5)));assert.ok(found.some(e=>e.vector[3]===2));assert.ok(found.every(e=>e.result.pieces[0].cost<=18));const groups=X.resourceGroups(f.data,f.request,found);assert.ok(groups.some(g=>g.tokens.includes('G:15')&&g.tokens.includes('D')));assert.ok(groups.some(g=>g.tokens.filter(t=>t==='G:9').length===2));
});
test('放弃未要求的原生技能可用于更高cost模板，不加入额外必选条件',()=>{
 const f=fixture(6);f.data.armors[0].skills=[{skill_id:1,level:1}];const found=[];X.promote(f.data,f.request,f.entry(f.result([f.atom(2)])),[1,2,3,4,5],r=>found.push(r),Date.now()+3000,r=>E.validateResult(f.data,f.request,r));assert.ok(found.some(r=>r.pieces[0].atoms.some(a=>a.skillId===5)&&r.pieces[0].atoms.some(a=>a.skillId===1&&a.value===-1)));assert.deepEqual(f.request.skills,[{id:0,level:1}]);
});
test('资源排除约束保留同一增量的不同实现方式',async()=>{
 const f=fixture(3);f.data.weapons[0].slots=[1];f.data.skills[1].max=1;f.data.decorations=[{id:'d1',slot:1,skills:[{skill_id:1,level:1}]}];const out=await X.analyzeFocused(f.data,f.request,highs,{skills:[1],seconds:3,limit:10});const groups=X.resourceGroups(f.data,f.request,out.entries);assert.ok(groups.some(g=>g.tokens.includes('D')));assert.ok(groups.some(g=>g.tokens.includes('H')));
});
test('骨架池保留20套且预算、孔位、自由记录等不同极值都保留',()=>{
 const bones=[];for(let i=0;i<80;i++){const profile={holes:[i===0?8:0,0,0,0],positive:i,freeRecords:i===1?20:0,budget:i===2?100:0,pieces:[{positiveRoom:i===3?20:0,skillRoom:i===4?5:0}]};X.retainSkeletons(bones,{result:{id:i,unusedSlots:i===0?Array(8).fill(1):[],defense:100},profile},'positive');}assert.equal(bones.length,20);for(const id of [0,1,2,3,4])assert.ok(bones.some(b=>b.result.id===id));
});
test('高级珠允许部分技能溢出，仍计入其他有效增量',()=>{
 const f=fixture();f.data.weapons[0].slots=[4];f.data.skills[1].max=2;f.data.decorations=[{id:'source',slot:1,skills:[{skill_id:1,level:1}]},{id:'mixed',slot:4,skills:[{skill_id:1,level:3},{skill_id:2,level:1}]}];const g=X.resourceGroups(f.data,f.request,[f.entry(f.result([],[{id:'source',count:1}]))])[0],out=expanded(f.data,f.request,g,[1,2]);assert.ok(out.some(e=>e.vector[1]===2&&e.vector[2]===1));
});
test('自由记录已满时可调整负耐性为合法负防御，在同样六条内支持更高cost',()=>{
 const f=fixture(1);f.request.options.defenseFallback=true;f.data.atoms.push({pool:1,id:89,category:14,cost:-2,values:[{value:-1,value_index:0,weight:100}]},{pool:1,id:67,category:13,cost:-5,values:[{value:-12,value_index:0,weight:100},{value:-6,value_index:1,weight:100}]});const raw={weaponId:'w',armors:f.data.armors.map(a=>({id:a.id,atoms:a.part==='head'?[f.atom(1),{atomId:89,value:-1,valueIndex:0,count:5}]:[]})),charm:{empty:true,skills:[],slots:[]},decorations:[]},source=X.completePlan(f.data,f.request,raw,{1:1}),found=[];X.promote(f.data,f.request,f.entry(source),[1,2,3,4,5],r=>found.push(r),Date.now()+3000,r=>E.validateResult(f.data,f.request,r));const high=found.find(r=>r.pieces[0].atoms.some(a=>a.skillId===5));assert.ok(high);assert.equal(high.pieces[0].fallback.freeRecords,6);assert.ok(high.pieces[0].atoms.some(a=>a.atomId===67));assert.ok(!high.pieces[0].atoms.some(a=>a.skillId!=null&&a.value<0));E.validateResult(f.data,f.request,high);
});
test('当前兼容方案先作为资源起点，过期武器方案被忽略且不增加必选技能',async()=>{
 const f=fixture(),seed=f.result([f.atom(1)]),bad={...seed,weaponId:'old-weapon'},events=[],before=JSON.stringify(f.request);const out=await X.analyze(f.data,f.request,highs,{skills:[1,2],seconds:2,limit:10},p=>events.push(p),{initialResults:[bad,seed]});assert.equal(events[0].phase,'extension');assert.ok(out.entries.length);assert.ok(out.stats.skeletons>=1);for(const e of out.entries)E.validateResult(f.data,f.request,e.result);assert.equal(JSON.stringify(f.request),before);
});
test('资源组按位置比较，孔位与cost不能相加或交叉抵扣',()=>{
 const g=tokens=>({tokens});
 for(const [a,b,expected] of [
  [['J:2','H'],['H','H'],true],[['J:2'],['H','H'],false],
  [['J:4','H'],['J:2','J:2'],false],[['J:3','J:2'],['J:2','H'],true],
  [['G:9','s:80:1'],['G:6','s:80:1'],true],[['G:6','s:80:1'],['G:9','s:80:1'],false],
  [['G:15'],['G:6','G:6'],false],[['G:15','D'],['G:9','G:6'],false],
  [['J:4'],['D'],false],[['G:15'],['H'],false],
  [['G:9','s:80:1'],['G:6','s:80:2'],false],
 ])assert.equal(X.groupCovers(g(a),g(b)),expected,JSON.stringify([a,b]));
});
test('不同防具的B与C同名组合合并标题，保留双方合法候选和来源',()=>{
 const f=fixture(9);f.data.skills.push({id:6,name:'破坏王',max:1,cost:15});f.data.armors[0].skills=[{skill_id:6,level:1}];const other={...f.data.armors[0],id:'other-head'};f.data.armors.push(other);
 const make=(id,skill)=>f.entry(E.validateResult(f.data,f.request,{weaponId:'w',armors:E.PARTS.map(part=>({id:part==='head'?id:part,atoms:part==='head'?[f.atom(skill)]:[]})),charm:{empty:true,skills:[],slots:[]},decorations:[]}));
 const low=make('head',2),high=make('other-head',3),groups=X.resourceGroups(f.data,f.request,[low,high]);assert.equal(groups.length,1);const g=groups[0];assert.deepEqual(g.tokens,['G:9','s:6:1']);assert.equal(g.members.length,2);assert.equal(g.recipes.length,2);
 const out=expanded(f.data,f.request,g,[1,2,3,4,5,6]);assert.ok(out.some(e=>e.vector[2]===1));assert.ok(out.some(e=>e.vector[3]===1));assert.ok(out.every(e=>e.vector[6]===1));assert.deepEqual(new Set(g.recipes.map(r=>r.result.armors[0].id)),new Set(['head','other-head']));
});
test('不同装备的2级孔与1级孔同名组合合并，强组补全保留低孔方案',()=>{
 const f=fixture();f.data.skills.push({id:6,name:'破坏王',max:1,cost:15});Object.assign(f.data.armors[0],{slots:[1],skills:[{skill_id:6,level:1}]});f.data.armors.push({...f.data.armors[0],id:'other-head',slots:[2]});f.data.decorations=[{id:'d1',slot:1,skills:[{skill_id:1,level:1}]},{id:'d2',slot:2,skills:[{skill_id:2,level:1}]}];
 const make=(id,deco)=>f.entry(E.validateResult(f.data,f.request,{weaponId:'w',armors:E.PARTS.map(part=>({id:part==='head'?id:part,atoms:[]})),charm:{empty:true,skills:[],slots:[]},decorations:[{id:deco,count:1}]}));
 const groups=X.resourceGroups(f.data,f.request,[make('head','d1'),make('other-head','d2')]);assert.equal(groups.length,1);const g=groups[0];assert.deepEqual(g.tokens,['J:2','s:6:1']);assert.equal(g.recipes.length,2);const out=expanded(f.data,f.request,g,[1,2,6]);assert.ok(out.some(e=>e.vector[1]===1));assert.ok(out.some(e=>e.vector[2]===1));
});
test('仅选择技能是完整候选之后的OR筛选，不限制其他联动技能',()=>{
 const f=fixture(9),ids=[1,2,3,4,5],g=X.resourceGroups(f.data,f.request,[f.entry(f.result([f.atom(3)]))])[0];
 const matches=[...X.substitutions(f.data,f.request,g,ids,undefined,{filterSkills:[1,2]})].filter(e=>!e.checkpoint);assert.deepEqual(new Set(matches.map(e=>e.choices[0])),new Set([1,2]));
 const none=[...X.substitutions(f.data,f.request,g,ids,undefined,{filterSkills:[4]})].filter(e=>!e.checkpoint);assert.equal(none.length,0);
 const pair=X.resourceGroups(f.data,f.request,[f.entry(f.result([f.atom(1),f.atom(2)]))])[0],joint=[...X.substitutions(f.data,f.request,pair,ids,undefined,{filterSkills:[2]})].filter(e=>!e.checkpoint);assert.ok(joint.some(e=>e.vector[2]>0&&e.vector[1]>0));assert.ok(joint.every(e=>e.vector[2]>0));
});
