const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../dist/data.json'),E=require('../dist/engine.js'),M=require('../dist/mod.js'),I=require('../dist/inventory.js'),S=require('../dist/share.js'),{fixture}=require('./inventory-fixture.cjs');
const q=(on=true)=>({weaponId:'DualBlades:481',skills:[{id:16,level:1}],options:{sex:'MaleOnly',augment:true,deleteSkills:true,defenseFallback:on,noCharm:true}});
const atom=(id,extra={})=>{const r=D.atoms.find(a=>a.pool===6&&a.id===id),v=r.values[0];return {atomId:id,value:v.value,valueIndex:v.value_index,count:1,...extra};};
const evaluate=(atoms,on=true)=>E.evaluateArmor(D,q(on),{id:'Head:502',atoms});
const overflow=()=>[atom(149,{skillId:200,count:3}),atom(141,{count:2}),atom(73,{value:4,valueIndex:2}),atom(69,{fallback:true})];
test('防御收尾只发生在六条之后；预算耗尽和可连续失败的短结果分别结束',()=>{
 assert.throws(()=>evaluate([atom(145,{skillId:17}),atom(72,{fallback:true})]),/六条.*第七条/);
 assert.throws(()=>evaluate([atom(144,{skillId:12,count:2}),atom(149,{skillId:200}),atom(59,{count:3})]),/必须防御收尾/);
 const exhausted=evaluate([atom(76,{value:12,valueIndex:2})]);assert.equal(exhausted.records,1);assert.equal(exhausted.fallback.effect,null);assert.equal(exhausted.fallback.termination,'budget');
 const short=evaluate([atom(144,{skillId:12})]);assert.equal(short.fallback.termination,'failed');assert.equal(short.fallback.after,7);
 assert.equal(evaluate([]).fallback.termination,'unaugmented');
 const fixture={pool:13,budget:40,skills:[],slots:[],part:'head'};
 assert.equal(E.canFailOrdinaryDraw(D,fixture,[atom(69)],39),false);
});
test('同一收尾条目的非最大roll也合法：最大值抵消不排除其他取值',()=>{
 const free=[atom(60),atom(145,{skillId:17}),atom(146,{skillId:10}),atom(149,{skillId:200}),atom(144,{skillId:12}),atom(90)];
 assert.throws(()=>evaluate([...free,atom(76,{value:12,valueIndex:2,fallback:true})]),e=>e.code==='DEFENSE_CANCELLED');
 for(const [value,valueIndex]of [[8,0],[10,1]]){const p=evaluate([...free,atom(76,{value,valueIndex,fallback:true})]);assert.equal(p.records,7);assert.equal(p.cost,10);assert.equal(p.fallback.before,10);assert.equal(p.fallback.effect.value,value);assert.equal(p.finalDefense,125-12+value);}
});
test('保存按类别、带符号cost、实际值稳定排序，不以技能ID或属性排序',()=>{
 const armor=D.armors.find(a=>a.id==='Head:502');
 const input=[atom(144,{skillId:16}),atom(149,{skillId:200}),atom(89,{value:-1,valueIndex:0}),atom(89,{value:-2,valueIndex:1}),atom(104),atom(94)];
 const ordered=E.orderedAtoms(D,armor,input),encoded=M.encodeAtoms(D,armor,input).filter(a=>a.Id);
 assert.deepEqual(ordered.map(a=>[a.atomId,a.value]),[[89,-2],[89,-1],[104,1],[94,1],[149,-1],[144,1]]);
 assert.deepEqual(encoded.map(a=>a.Id),[89,89,104,94,149,144]);assert.equal(encoded[0].ValueIndex,1);
 const equal=[atom(144,{skillId:16}),atom(144,{skillId:12})];assert.deepEqual(M.encodeAtoms(D,armor,equal).slice(0,2).map(a=>a.SkillId),[17,13]);
});
test('两种原生技能加三个新技能各两级：先引入ABC，再保留同键先后，重复往返不漂移',()=>{
 const a=D.armors.find(a=>a.pool===1&&a.skills.length===2&&a.budget===20),native=new Set(a.skills.map(s=>s.skill_id)),skills=D.skills.filter(s=>s.cost===3&&s.max>=2&&!native.has(s.id)).slice(0,3);
 const atoms=[...skills.map(s=>({atomId:144,skillId:s.id,value:1,count:2})),{atomId:70,value:4,valueIndex:0,count:1,fallback:true}];
 const r={...q(),options:{...q().options,sex:a.sex==='FemaleOnly'?'FemaleOnly':'MaleOnly'}};
 const p=E.evaluateArmor(D,r,{id:a.id,atoms}),order=p.atoms.filter(t=>t.skillId!=null).map(t=>t.skillId);
 assert.deepEqual(order,[...skills,...skills].map(s=>s.id));assert.equal(p.records,7);
 assert.deepEqual(E.evaluateArmor(D,r,p).atoms,p.atoms);
 assert.deepEqual(M.encodeAtoms(D,p,p.atoms).filter(t=>t.SkillId).map(t=>t.SkillId),order.map(M.skillToGame));
});
test('手填原初头盔孔+3两次保留全部cost和七条，实际孔位饱和444',()=>{
 const p=evaluate(overflow());assert.deepEqual(p.slots,[4,4,4]);assert.equal(p.records,7);assert.equal(p.cost,10);assert.equal(p.slotAdds,2);assert.equal(p.fallback.freeRecords,6);assert.equal(p.fallback.before,1);
 const a={...D.armors.find(a=>a.id==='Head:502'),id:'synthetic',slots:[4,4,3]};const d={...D,armors:[a]};assert.throws(()=>E.evaluateArmor(d,q(false),{id:a.id,atoms:[atom(140)]}),/单条孔位增长/);
 const model=E.buildModel(D,q(),[D.armors.find(a=>a.id==='Head:502')],[{id:'none',empty:true,skills:[],slots:[]}]);assert.ok(model.pieces[0].choices.every(c=>c.points<=4));
});
test('普通耐性同属性抵消不能保留记录；不同属性同cost稳定保留',()=>{
 assert.throws(()=>evaluate([atom(89,{value:-1,valueIndex:0}),atom(94)],false),/同类别同属性.*合计为0/);
 assert.doesNotThrow(()=>evaluate([atom(89,{value:-1,valueIndex:0}),atom(104)],false));
});
function ownedCase(atoms){const f=fixture(),raw=structuredClone(f.raw),row=raw.items.find(r=>r.box==='equipment'&&r.item.IdType===2);row.item.IdVal=M.equipmentToGame('Head:502');row.item.CustomEnable=true;row.item.CustomBuildup=M.encodeAtoms(D,D.armors.find(a=>a.id==='Head:502'),atoms);row.fingerprint=I.fingerprint(row.item);const stock=I.parse(D,raw),head=stock.byKey.get(row.box+':'+row.index);return {f,stock,head};}
test('库存支持类别15且与普通耐性分别计算，真实特化零cost记录不被当作普通抽选剔除',()=>{
 const {head}=ownedCase([atom(149,{skillId:200}),{atomId:91,value:-7,valueIndex:0,count:1},atom(146,{skillId:10}),atom(76,{value:12,valueIndex:2}),atom(69)]);
 assert.equal(head.usable,true,head.error);assert.equal(head.armor.finalResistances.fire,head.base.resistances.fire-7);assert.equal(head.armor.records,5);
 const zero=ownedCase([{atomId:91,value:-7,valueIndex:0,count:1},atom(94,{value:2,valueIndex:1,count:3}),atom(94,{count:1})]).head;
 assert.equal(zero.usable,true,zero.error);assert.equal(zero.armor.finalResistances.fire,zero.base.resistances.fire);assert.equal(zero.armor.records,5);
});
test('溢出库存的已有方案导出、可移植截图方案与恢复均不丢记录',async()=>{
 const {f,stock,head}=ownedCase(overflow());assert.equal(head.usable,true,head.error);
 const query={...f.q,skills:[{id:16,level:1}]};
 const other=stock.entries.find(e=>e.kind==='armor'&&e.base.part!=='head'&&e.skills.length);query.skills=[{id:other.skills[0].skill_id,level:1}];
 const result=I.validateResult(D,stock,query,{weaponId:query.weaponId,owned:{version:1,inventoryId:stock.id,weapon:I.reference(stock.byKey.get('equipment:0')),armors:Object.fromEntries(stock.entries.filter(e=>e.kind==='armor').map(e=>[e.base.part,I.reference(e)])),charm:I.reference(stock.byKey.get('equipment:7'))},decorations:[]});
 const template=require('./mod-template.json'),out=I.exportPlan(D,stock,template,result,query);assert.equal(out.payload.references[1].idVal,head.item.IdVal);
 const encoded=await S.encode(D,query,result),decoded=await S.decode(D,encoded.token),p=decoded.result.pieces.find(p=>p.part==='head');assert.deepEqual(p.slots,[4,4,4]);assert.equal(p.records,7);assert.equal(p.cost,10);assert.equal(p.slotAdds,2);
 const exported=M.exportLoadout(D,template,decoded.result,decoded.request,E).payload;assert.equal(exported.inventoryList[1].CustomBuildup.filter(t=>t.Id).length,7);
});
test('收尾同cost严格沿用源表先后，不额外按专用ID优先排序',()=>{
 const rows=D.atoms.filter(a=>a.pool===6),regular=rows.find(a=>a.id===73),reordered={...D,atoms:[regular,...rows.filter(a=>a.id!==73)]};
 assert.equal(E.fallbackEffects(reordered,6,3)[0].atomId,73);assert.equal(E.fallbackEffects(D,6,3)[0].atomId,71);
});
test('真实MILP六条分支可以选择次大收尾roll并满足独立校验',async()=>{
 const path=require('node:path'),highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)}),head=D.armors.find(a=>a.id==='Head:502');
 const d={...D,armors:[head,...E.PARTS.slice(1).map(part=>({...D.armors.find(a=>a.part===part),skills:[],pool:0,budget:0,sex:'Both'}))]};
 const request={...q(),skills:[{id:17,level:1},{id:10,level:1},{id:12,level:1}],options:{...q().options,searchMode:'time',resultSort:'defense'}},m=E.buildModel(d,request,d.armors,[{id:'none',empty:true,skills:[],slots:[]}]),p=m.pieces[0];
 for(const e of p.edits)m.lp.constraint([[1,e.n]],'=',1);
 for(const e of p.numeric)if(!e.fallback)m.lp.constraint([[1,e.n]],'=',e.atom===60||e.atom===90?1:0);
 for(const c of p.choices)m.lp.constraint([[1,c.n]],'=',c.points===0?1:0);
 m.lp.constraint(p.numeric.filter(e=>e.attribute==='defense').map(e=>[e.value,e.n]),'<=',-1);
 const raw=highs.solve(m.lp.text(),{output_flag:false,time_limit:3});assert.equal(raw.Status,'Optimal');
 const r=E.validateResult(d,request,E.reconstruct(m,raw,d,request)),out=r.pieces[0];assert.equal(out.fallback.freeRecords,6);assert.equal(out.fallback.effect.value,10);assert.equal(out.records,7);assert.equal(out.cost,10);
});
test('已满原生技能被扣一级后，不能继续拿原先满级作为连续失败的见证',async()=>{
 const path=require('node:path'),highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});
 const d={...D,skills:[{id:0,name:'技能',cost:3,max:3}],weapons:[{id:'weapon',slots:[]}],armors:E.PARTS.map((part,i)=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,slots:[],resistances:{},skills:i?[]:[{skill_id:0,level:3}],pool:i?0:6,budget:i?0:20})),atoms:D.atoms.filter(a=>a.pool===6&&[59,60,69,70,71,72,73,74,75,76,139,140,141,144,149].includes(a.id))};
 const request={weaponId:'weapon',skills:[{id:0,level:1}],options:{augment:true,deleteSkills:true,defenseFallback:true,noCharm:true}},m=E.buildModel(d,request,d.armors,[{id:'none',empty:true,skills:[],slots:[]}]),p=m.pieces[0];
 for(const e of p.edits)m.lp.constraint([[1,e.n]],'=',e.sign<0?1:0);for(const e of p.numeric)if(!e.fallback)m.lp.constraint([[1,e.n]],'=',0);for(const c of p.choices)m.lp.constraint([[1,c.n]],'=',c.points===0?1:0);
 assert.equal(E.canFailOrdinaryDraw(d,d.armors[0],[{atomId:149,skillId:0,value:-1,count:1}],30),false);
 assert.equal(highs.solve(m.lp.text(),{output_flag:false,time_limit:2}).Status,'Infeasible');
});
