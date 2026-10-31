const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../dist/data.json'),E=require('../dist/engine.js'),M=require('../dist/mod.js'),S=require('../dist/share.js');
const elements=['fire','water','thunder','ice','dragon'];
const atom=(id,value,count=1)=>{const raw=D.atoms.find(a=>a.pool===6&&a.id===id),v=raw.values.find(v=>v.value===value);return {atomId:id,value,valueIndex:v.value_index,count};};
function fixture(base=[0,0,0,0,0],atoms=[atom(90,-3)]){
 const armors=E.PARTS.map((part,i)=>({...D.armors.find(a=>a.part===part),pool:6,budget:100,defense:100,sex:'Both',slots:[],skills:[],resistances:Object.fromEntries(elements.map((e,j)=>[e,i?0:base[j]]))}));
 const data={...D,armors},request={weaponId:'DualBlades:481',skills:[],options:{augment:true,deleteSkills:true,noCharm:true}},result={weaponId:request.weaponId,armors:armors.map((a,i)=>({id:a.id,atoms:i?[]:atoms})),charm:{id:'none',empty:true,skills:[],slots:[]},decorations:[]};
 return {data,request,result};
}
const totals=(d,r)=>{const out=[0,0,0,0,0];for(const p of r.armors){const a=d.armors.find(a=>a.id===p.id);elements.forEach((e,i)=>out[i]+=a.resistances[e]||0);for(const t of p.atoms){const raw=d.atoms.find(a=>a.pool===6&&a.id===t.atomId);if([14,15].includes(raw.category))out[Math.floor((raw.id-89)/10)]+=t.value*t.count;}}return out;};
const sorted=a=>[...a].sort((a,b)=>a-b),cmp=(a,b)=>{for(let i=0;i<5;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
function brute(base,deltas){let best=null;const values=[...base],net=[0,0,0,0,0],count=[0,0,0,0,0];function go(i){if(i===deltas.length){if(net.some((v,j)=>count[j]&&v===0))return;const s=sorted(values);if(!best||cmp(s,best)>0)best=s;return;}for(let j=0;j<5;j++){values[j]+=deltas[i];net[j]+=deltas[i];count[j]++;go(i+1);count[j]--;net[j]-=deltas[i];values[j]-=deltas[i];}}go(0);return best;}
test('按整套而非单件耐性分配，保留原件及每条cost、数值和数量',()=>{
 const f=fixture([10,0,0,0,0],[atom(90,-3,2)]);f.data.armors[0].resistances={fire:-5,water:5,thunder:5,ice:5,dragon:5};f.data.armors[1].resistances={fire:20,water:0,thunder:0,ice:0,dragon:0};
 const before=structuredClone(f.result),r=E.balanceResistances(f.data,f.request,f.result);
 assert.deepEqual(totals(f.data,r),[9,5,5,5,5]);assert.deepEqual(f.result,before);assert.equal(r.armors[0].atoms.length,2);
 const a=E.validateResult(f.data,f.request,r),b=E.validateResult(f.data,f.request,f.result);
 for(const key of ['defense','records','skillAdds','skillAddCost','slotAdds','additions'])assert.equal(a[key],b[key],key);
 assert.deepEqual(a.totals,b.totals);assert.deepEqual(a.placement,b.placement);assert.equal(a.pieces[0].cost,b.pieces[0].cost);
});
test('正耐性也按整套短板分配，并且不会产生同属性完全抵消',()=>{
 const f=fixture([-5,5,5,5,5],[atom(94,1,2)]),r=E.balanceResistances(f.data,f.request,f.result);assert.deepEqual(totals(f.data,r),[-3,5,5,5,5]);assert.equal(r.armors[0].atoms.every(a=>a.atomId===94),true);
 const mixed=fixture([0,0,0,0,0],[atom(89,-1),atom(94,1)]),out=E.balanceResistances(mixed.data,mixed.request,mixed.result);
 assert.notEqual(out.armors[0].atoms[0].atomId,out.armors[0].atoms[1].atomId-5);assert.doesNotThrow(()=>E.validateResult(mixed.data,mixed.request,out));assert.deepEqual(sorted(totals(mixed.data,out)),[-1,0,0,0,1]);
});
test('与独立穷举对比负耐性和正负混合分配的全局最优值',()=>{
 let seed=145;const rand=n=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)>>>8)%n;
 for(let i=0;i<100;i++){
  const base=elements.map(()=>rand(17)-8),deltas=Array.from({length:3+rand(3)},()=>[-3,-1,1,2][rand(4)]),f=fixture(base,deltas.map(v=>atom(v===-3?90:v===-1?89:94,v)));
  const r=E.balanceResistances(f.data,f.request,f.result);assert.deepEqual(sorted(totals(f.data,r)),brute(base,deltas),JSON.stringify({base,deltas}));assert.doesNotThrow(()=>E.validateResult(f.data,f.request,r));
 }
});
test('固定炼化不改，但参与整套总值；仅固定装备仍可分配',()=>{
 const f=fixture([0,0,0,0,0],[atom(94,2)]);f.result.armors[1].atoms=[atom(90,-3)];
 f.request.options.fixedArmors={head:structuredClone(f.result.armors[0]),chest:{id:f.result.armors[1].id}};
 const r=E.balanceResistances(f.data,f.request,f.result);assert.deepEqual(r.armors[0],f.result.armors[0]);assert.equal(r.armors[1].atoms[0].atomId,90);assert.deepEqual(totals(f.data,r),[-1,0,0,0,0]);assert.doesNotThrow(()=>E.validateResult(f.data,f.request,r));
 for(const flag of [{owned:{}},{presetEquipment:true}]){const raw={...f.result,...flag};assert.equal(E.balanceResistances(f.data,f.request,raw),raw);}
 assert.equal(E.balanceResistances(f.data,{...f.request,options:{ownedOnly:true}},f.result),f.result);
});
test('只选择对应炼化池支持的同cost、同数值条目',()=>{
 const f=fixture([0,20,0,0,0],[atom(90,-3)]);f.data={...f.data,atoms:D.atoms.filter(a=>a.category!==14||a.cost!==-3||a.id===90||a.id===110)};
 const r=E.balanceResistances(f.data,f.request,f.result);assert.deepEqual(sorted(totals(f.data,r)),[-3,0,0,0,20]);assert.ok([90,110].includes(r.armors[0].atoms[0].atomId));assert.doesNotThrow(()=>E.validateResult(f.data,f.request,r));
});
test('35条记录的均衡可快速结束且分配可重复',()=>{
 const f=fixture([2,-2,8,0,4],Array.from({length:7},()=>atom(90,-3)));f.result.armors.forEach(a=>a.atoms=Array.from({length:7},()=>atom(90,-3)));
 const start=performance.now(),a=E.balanceResistances(f.data,f.request,f.result),b=E.balanceResistances(f.data,f.request,f.result);assert.ok(performance.now()-start<2000);assert.deepEqual(a,b);assert.equal(a.armors.flatMap(a=>a.atoms).length,35);assert.equal(totals(f.data,a).reduce((a,b)=>a+b),12-105);
});
test('35条正负混合记录避免贪心抵消，并可迅速取得完全均衡的结果',()=>{
 const f=fixture();f.result.armors.forEach(a=>a.atoms=Array.from({length:7},(_,i)=>i%2?atom(89,-1):atom(94,1)));
 const start=performance.now(),out=E.balanceResistances(f.data,f.request,f.result);assert.ok(performance.now()-start<2000);assert.deepEqual(totals(f.data,out),[1,1,1,1,1]);assert.doesNotThrow(()=>E.validateResult(f.data,f.request,out));
});
test('真实求解结果均衡后仍可映射回合并耐性的热启动模型',async()=>{
 const path=require('node:path'),highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)}),f=fixture([-10,10,0,0,0]);
 f.request.skills=[{id:16,level:1}];f.data.armors[0].skills=[{skill_id:16,level:1}];
 const m=E.buildModel(f.data,f.request,f.data.armors,[f.result.charm]);
 for(const p of m.pieces){for(const e of p.edits)m.lp.constraint([[1,e.n]],'=',0);for(const e of p.numeric)m.lp.constraint([[1,e.n]],'=',p.a.part==='head'&&e.atom===90?2:0);for(const c of p.choices)m.lp.constraint([[1,c.n]],'=',c.points===0?1:0);}
 const raw=highs.solve(m.lp.text(),{output_flag:false,time_limit:3});assert.equal(raw.Status,'Optimal');const r=E.validateResult(f.data,f.request,E.reconstruct(m,raw,f.data,f.request));assert.deepEqual(totals(f.data,r),[-10,4,0,0,0]);assert.ok(E.modelSeed(f.data,m,r));
 const encoded=M.encodeAtoms(f.data,r.pieces[0],r.pieces[0].atoms);assert.equal(encoded.filter(a=>a.Id).every(a=>a.Id===100),true);
 const shared=await S.encode(f.data,f.request,r),restored=await S.decode(f.data,shared.token);assert.deepEqual(totals(f.data,restored.result),totals(f.data,r));
});
