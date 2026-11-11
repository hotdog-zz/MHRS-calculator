const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../dist/engine.js'),X=require('../dist/extensions.js');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
function fixture(){
 const data={skills:[{id:0,name:'基础',nameEn:'base',max:2,cost:3},{id:1,name:'甲',nameEn:'a',max:1,cost:3},{id:2,name:'乙',nameEn:'b',max:1,cost:3}],weapons:[{id:'weapon',slots:[1],defense:0}],armors:E.PARTS.map(part=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,slots:[],skills:part==='head'?[{skill_id:0,level:1}]:[],pool:0,budget:0,resistances:{}})),atoms:[],decorations:[0,1,2].map(id=>({id:'deco'+id,slot:1,skills:[{skill_id:id,level:1}]})),fixedCharms:[]};
 const request={weaponId:'weapon',skills:[{id:0,level:1}],options:{sex:'FemaleOnly',augment:false,noCharm:true,defenseFallback:false,fixedArmors:{},augmentLimits:{}}};return {data,request};
}
test('包含关系按每个技能逐项比较，等级溢出不计入增量',()=>{
 const {data,request}=fixture();assert.equal(X.dominates({1:1,2:1},{1:1}),true);assert.equal(X.dominates({1:2},{1:1,2:1}),false);
 assert.deepEqual(X.vector(data,request,{totals:{0:99,1:99}},[0,1]),{0:1,1:1});
 const f=[],r={defense:10,records:0,armors:[]};X.insert(f,{id:'a',vector:{1:1},result:r});X.insert(f,{id:'b',vector:{1:1,2:1},result:r});assert.equal(f.length,1);assert.equal(f[0].id,'b');
});
test('可各加一项不代表可同时加；枚举找齐互不包含的组并证明模型内完成',async()=>{
 const {data,request}=fixture(),out=await X.analyzeFocused(data,request,highs,{skills:[0,1,2],seconds:3,limit:20});
 assert.equal(out.complete,true);const expanded=X.resourceGroups(data,request,out.entries).flatMap(g=>[...X.substitutions(data,request,g,[0,1,2])].filter(e=>!e.checkpoint));assert.equal(expanded.length,3);
 assert.deepEqual(expanded.map(e=>Object.values(e.vector).reduce((a,b)=>a+b,0)),[1,1,1]);
 for(const e of expanded)E.validateResult(data,request,e.result);
 assert.deepEqual(new Set(expanded.map(e=>X.key(e.vector))),new Set(['[["0",1]]','[["1",1]]','[["2",1]]']));
});
test('完整求解后才区分无额外技能和原目标无解',async()=>{
 const {data,request}=fixture();data.weapons[0].slots=[];
 const none=await X.analyzeFocused(data,request,highs,{skills:[1],seconds:2,limit:10});assert.equal(none.complete,true);assert.equal(none.entries.length,0);assert.ok(none.baseline);
 request.skills[0].level=2;const bad=await X.analyzeFocused(data,request,highs,{skills:[1],seconds:2,limit:10});assert.equal(bad.complete,true);assert.equal(bad.baseline,null);
});
test('03新增上限和固定炼化保留，新增技能不会被护石/技能投影遗漏',async()=>{
 const {data,request}=fixture();data.weapons[0].slots=[];data.armors[1].skills=[{skill_id:0,level:1}];data.armors[0].skills=[];Object.assign(data.armors[0],{pool:1,budget:3});data.atoms=[{id:144,pool:1,category:20,cost:3,values:[{value:1,value_index:0,weight:100}]}];Object.assign(request.options,{augment:true,defenseFallback:true,augmentLimits:{head:0}});
 let out=await X.analyzeFocused(data,request,highs,{skills:[1],seconds:2,limit:10});assert.equal(out.entries.length,0);assert.equal(out.complete,true);
 request.options.augmentLimits.head=1;out=await X.analyzeFocused(data,request,highs,{skills:[1],seconds:2,limit:10});assert.equal(out.entries[0].vector[1],1);assert.equal(out.entries[0].result.pieces[0].additions,1);
 request.options.fixedArmors={head:{id:'head',atoms:[]}};out=await X.analyzeFocused(data,request,highs,{skills:[1],seconds:2,limit:10});assert.equal(out.entries.length,0);
});
test('通用组合仅合并已验证联合组合，不捏造候选技能的笛卡尔积',()=>{
 const {data}=fixture();data.atoms=[{pool:1,id:144,cost:3}];data.skills.push({id:3,name:'丙',max:1,cost:3},{id:4,name:'丁',max:1,cost:3});data.decorations.push({id:'deco3',slot:1,skills:[{skill_id:3,level:1}]});
 const a={id:'a',vector:{1:1,2:1},result:{pieces:[{pool:1,atoms:[{atomId:144,skillId:1,value:1}]}],decorations:[{id:'deco2',count:1}]}},b={id:'b',vector:{3:1,4:1},result:{pieces:[{pool:1,atoms:[{atomId:144,skillId:4,value:1}]}],decorations:[{id:'deco3',count:1}]}};
 const groups=X.group(data,[a,b]);assert.equal(groups.length,1);assert.deepEqual(groups[0].tokens,['D','H']);assert.deepEqual(groups[0].members,[a,b]);assert.equal(groups[0].members.length,2);
});
test('原生技能属于D档但没有对应炼化时，不宣称是可替换D词条',()=>{
 const {data}=fixture(),entries=[1,2].map(id=>({id:String(id),vector:{[id]:1},result:{pieces:[{atoms:[]}],decorations:[]}}));assert.ok(X.group(data,entries).every(g=>!g.generic));
});
test('已有模式保持库存实例、实际炼化和珠子数量',async()=>{
 const D=require('../dist/data.json'),I=require('../dist/inventory.js'),{fixture}=require('./inventory-fixture.cjs'),{raw,stock,q}=fixture();const before=JSON.stringify(raw);
 const out=await X.analyzeFocused(D,q,highs,{skills:[5,0],seconds:4,limit:5},()=>{},{},raw);assert.ok(out.entries.length);assert.equal(JSON.stringify(raw),before);
 for(const e of out.entries){I.validateResult(D,stock,q,e.result);assert.equal(e.result.owned.inventoryId,stock.id);assert.deepEqual(e.result.pieces.map(p=>p.atoms),stock.entries.filter(e=>e.kind==='armor').map(e=>e.armor.atoms));}
});
test('达到保留上限不能宣称前沿完整',async()=>{
 const {data,request}=fixture(),out=await X.analyzeFocused(data,request,highs,{skills:[1,2],seconds:3,limit:1});assert.equal(out.reason,'limit');assert.equal(out.complete,false);
});
test('取消会回收全部线程，迟到消息不改变结果',async()=>{
 const {data,request}=fixture(),workers=[];let updates=0;
 const job=X.create({data,request,config:{skills:[1],seconds:2,limit:3},createWorker:()=>{const w={postMessage(){},terminate(){w.terminated=true;}};workers.push(w);return w;},onProgress:()=>updates++});
 const out=await job.cancel();await job.promise;assert.ok(workers.every(w=>w.terminated));for(const w of workers)w.onmessage({data:{phase:'frontier',entries:[]}});assert.equal(updates,0);
});

test('护石候选保留原目标之外的关注技能及其真实等级',async()=>{
 const D=require('../dist/data.json'),d={...D,weapons:[{id:'weapon',slots:[],defense:0}],decorations:[],armors:E.PARTS.map(part=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,slots:[],skills:part==='head'?[{skill_id:0,level:7}]:[],pool:0,budget:0,resistances:{}}))},q={weaponId:'weapon',skills:[{id:0,level:7}],options:{augment:false,sex:'FemaleOnly',fixedCharms:false}};
 const out=await X.analyzeFocused(d,q,highs,{skills:[202],seconds:3,limit:10});assert.ok(out.entries.some(e=>e.vector[202]===3));for(const e of out.entries)E.validateResult(d,q,e.result);
});
test('线程返回伪造的技能增量时拒绝结果，不把失败当作没有扩展',async()=>{
 const {data,request}=fixture(),r=E.validateResult(data,request,{weaponId:'weapon',armors:data.armors.map(a=>({id:a.id,atoms:[]})),charm:{empty:true,skills:[],slots:[]},decorations:[{id:'deco1',count:1}]}),job=X.create({data,request,workerCount:1,config:{skills:[1],seconds:1,limit:3},createWorker:()=>{const w={terminate(){},postMessage(){setTimeout(()=>w.onmessage({data:{phase:'extension',entry:{vector:{1:99},result:r}}}),0);}};return w;}}),out=await job.promise;
 assert.equal(out.entries.length,0);assert.equal(out.complete,false);assert.match(out.errors[0],/不匹配/);
});
test('部分线程启动失败仍返回有效结果，但不宣称完成证明',async()=>{
 const {data,request}=fixture(),job=X.create({data,request,config:{skills:[1],seconds:1,limit:3},createWorker:i=>{if(!i)throw Error('startup failure');const w={terminate(){},postMessage(){setTimeout(()=>w.onmessage({data:{phase:'done',response:{entries:[],baseline:null,complete:true}}}),0);}};return w;}}),out=await job.promise;assert.equal(out.complete,false);assert.equal(out.errors.length,1);
});
