const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../dist/data.json'),E=require('../dist/engine.js');
const armor=D.armors.find(a=>a.id==='Head:502');
const q=(extra={})=>({weaponId:'DualBlades:481',skills:[{id:16,level:1}],options:{augment:true,deleteSkills:true,defenseFallback:true,noCharm:true,searchMode:'count',...extra}});
function atom(id,extra={}){const raw=D.atoms.find(a=>a.pool===6&&a.id===id),v=raw.values[0];return {atomId:id,value:v.value,valueIndex:v.value_index,count:1,...extra};}
function complete(atoms,request=q(),data=D){const input={armors:[{id:armor.id,atoms}]},before=JSON.stringify(input),result=E.completeCountDefense(data,request,input);assert.equal(JSON.stringify(input),before,'输入不可变');return E.evaluateArmor(data,request,result.armors[0]);}
test('数量模式消耗短结果的剩余5预算，技能和孔位不变',()=>{
 const atoms=[atom(74)],before=E.evaluateArmor(D,q(),{id:armor.id,atoms}),after=complete(atoms);
 assert.equal(before.fallback.termination,'failed');assert.equal(before.fallback.after,5);
 assert.equal(after.cost,10);assert.equal(after.fallback.termination,'budget');assert.ok(after.finalDefense>before.finalDefense);assert.deepEqual(after.levels,before.levels);assert.deepEqual(after.slots,before.slots);
});
test('单出9cost技能后补1防御，不删除原有技能或改变新增技能cost',()=>{
 const after=complete([atom(146,{skillId:233})]);assert.equal(after.levels[233],1);assert.equal(after.skillAddCost,9);assert.equal(after.finalDefense,armor.defense+1);assert.equal(after.cost,10);assert.equal(after.records,2);
});
test('六条之后使用正确的专用防御收尾，不允许提前加入',()=>{
 const data={...D,armors:[{...armor,budget:8}],atoms:D.atoms.filter(a=>a.pool!==6||a.category!==13||[59,60,69,70,71,72].includes(a.id))};
 const after=complete([atom(69,{count:5})],q(),data);assert.equal(after.records,7);assert.equal(after.cost,8);assert.equal(after.fallback.termination,'full');assert.equal(after.fallback.effect.atomId,70);assert.equal(after.fallback.before,2);assert.equal(after.atoms.filter(a=>a.fallback).length,1);
});
test('收尾无法耗尽预算时选择合法七条，不伪造预算耗尽',()=>{
 const data={...D,armors:[{...armor,budget:20}],atoms:D.atoms.filter(a=>a.pool!==6||a.category!==13||[59,60,69,70,71,72].includes(a.id))};
 const after=complete([atom(69,{count:5})],q(),data);assert.equal(after.records,7);assert.equal(after.cost,10);assert.equal(after.fallback.termination,'full');assert.equal(after.fallback.after,10);
});
test('无法避开防御抵消时保留合法短结果',()=>{
 const data={...D,armors:[{...armor,budget:10}],atoms:D.atoms.filter(a=>a.pool!==6||a.category!==13||[59,60,69,70,71,72].includes(a.id))};
 // Five retained records; only +1 DEF fits, which would cancel all defense.
 const raw={pool:6,id:74,category:13,cost:3,standardWeight:20,values:[{value:5,value_index:0,weight:100}]};
 data.atoms=[...data.atoms,raw];data.armors=[{...armor,budget:10}];
 const input=[atom(59),{atomId:74,value:5,valueIndex:0,count:1},atom(144,{skillId:12,count:3})];
 const after=complete(input,q(),data);assert.equal(after.fallback.termination,'failed');assert.equal(after.cost,9);assert.equal(after.records,5);assert.equal(after.finalDefense,armor.defense-1);
});
test('关闭防御兜底时只用普通词条；固定炼化、库存、时限及关闭炼化保持不变',()=>{
 const atoms=[atom(146,{skillId:233})],after=complete(atoms,q({defenseFallback:false}));assert.equal(after.cost,10);assert.ok(after.atoms.every(a=>!a.fallback));
 for(const options of [{searchMode:'time'},{ownedOnly:true},{augment:false},{fixedArmors:{head:{id:armor.id,atoms}}}]){
  const input={armors:[{id:armor.id,atoms}]};assert.deepEqual(E.completeCountDefense(D,q(options),input),input);
 }
 // Merely fixing the armor still permits automatically generated augments.
 assert.equal(complete(atoms,q({fixedArmors:{head:{id:armor.id}}})).cost,10);
});
test('真实求解结果在通知数量上限之前完成防御填充，Mod导出与结果一致',async()=>{
 const path=require('node:path'),M=require('../dist/mod.js'),highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});
 const data={...D,armors:[{...armor,budget:10},...E.PARTS.filter(p=>p!=='head').map((part,i)=>({...armor,id:'plain:'+part,part,pool:0,budget:0,skills:[],slots:[],defense:100}))],weapons:[{id:'weapon',slots:[],defense:0}],decorations:[]};
 const request={weaponId:'weapon',skills:[{id:233,level:1}],options:{searchMode:'count',augment:true,deleteSkills:false,noCharm:true,defenseFallback:true,limit:1,seconds:3}},notifications=[];
 const response=await E.search(data,request,highs,p=>{if(p.phase==='result')notifications.push(p.result);});assert.equal(response.status,'feasible',JSON.stringify(response.attempts));assert.equal(response.results.length,1);assert.ok(notifications.length);
 for(const result of [...notifications,...response.results]){const piece=result.pieces.find(p=>p.part==='head');assert.equal(piece.cost,10);assert.equal(piece.fallback.termination,'budget');assert.equal(piece.levels[233],1);assert.equal(piece.records,2);const encoded=M.encodeAtoms(data,piece,piece.atoms).filter(a=>a.Id);assert.equal(encoded.length,2);assert.ok(encoded.some(a=>a.Id===69));}
});
