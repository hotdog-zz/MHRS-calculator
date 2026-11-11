const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),E=require('../dist/engine.js'),X=require('../dist/extensions.js');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
function fixture(){
 const data={skills:[{id:0,name:'目标',max:1,cost:3},{id:1,name:'额外甲',max:1,cost:3}],weapons:[{id:'weapon',slots:[],defense:0}],armors:E.PARTS.map(part=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,slots:[],skills:part==='chest'?[{skill_id:0,level:1}]:[],pool:0,budget:0,resistances:{}})),atoms:[],decorations:[],fixedCharms:[]},request={weaponId:'weapon',skills:[{id:0,level:1}],options:{augment:true,noCharm:true,defenseFallback:true,sex:'FemaleOnly',fixedArmors:{},augmentLimits:{}}};return {data,request};
}
const none={empty:true,skills:[],slots:[]};
test('骨架第一阶段只建模原目标，正面词条目标包含扩孔记录而非孔等级',()=>{
 const {data,request}=fixture();Object.assign(data.armors[0],{pool:1,budget:18});data.armors.push({...data.armors[0],id:'natural',pool:0,budget:0,slots:[1]});data.atoms=[{pool:1,id:141,category:19,cost:18,values:[{value:3,value_index:0,weight:100}]}];
 for(const direction of ['slots','positive']){const q={...request,options:{...request.options,searchMode:'time',resultSort:'unusedSlotsDesc'}},m=E.buildModel(data,q,data.armors,[none]);X.resourceObjective(data,m,q,direction);assert.equal(m.skillTerms[1],undefined);const raw=highs.solve(m.lp.text(),{output_flag:false,time_limit:2});assert.equal(raw.Status,'Optimal');const r=E.validateResult(data,q,E.reconstruct(m,raw,data,q)),p=r.pieces.find(p=>p.part==='head');if(direction==='slots'){assert.deepEqual(p.slots,[1,1,1]);assert.equal(p.additions,1);}else{assert.equal(p.id,'natural');assert.equal(p.additions,0);}}
});
test('成品防御填满预算后仍能提取真实余量，固定炼化不会被移除',()=>{
 const {data,request}=fixture();Object.assign(data.armors[0],{pool:1,budget:6});data.atoms=[{pool:1,id:69,category:13,cost:2,values:[{value:1,value_index:0,weight:100}]}];
 const armors=data.armors.map(a=>({id:a.id,atoms:a.part==='head'?[{atomId:69,value:1,valueIndex:0,count:3,attribute:'defense'}]:[]})),r=E.validateResult(data,request,{weaponId:'weapon',armors,charm:none,decorations:[]}),profile=X.resources(data,request,r),head=profile.pieces.find(p=>p.part==='head');assert.equal(r.pieces[0].cost,6);assert.equal(head.budget,6);assert.equal(head.freeRecords,6);assert.equal(X.coreArmors(data,request,r)[0].atoms.length,0);
 const fixed={...request,options:{...request.options,fixedArmors:{head:armors[0]}}};assert.equal(E.atomSignature(X.coreArmors(data,fixed,r)[0].atoms),E.atomSignature(armors[0].atoms));assert.equal(X.resources(data,fixed,r).pieces[0].freeRecords,0);
});
test('03为零禁止D词条，为一可从防御填充中释放预算新增技能',async()=>{
 const {data,request}=fixture();Object.assign(data.armors[0],{pool:1,budget:6});data.atoms=[{pool:1,id:69,category:13,cost:2,values:[{value:1,value_index:0,weight:100}]},{pool:1,id:144,category:20,cost:3,values:[{value:1,value_index:0,weight:100}]}];request.options.augmentLimits.head=0;
 let out=await X.analyze(data,request,highs,{skills:[1],seconds:2,limit:10});assert.equal(out.entries.length,0);
 request.options.augmentLimits.head=1;out=await X.analyze(data,request,highs,{skills:[1],seconds:2,limit:10});assert.ok(out.entries.some(e=>e.vector[1]===1));for(const e of out.entries){E.validateResult(data,request,e.result);assert.ok(e.result.pieces[0].additions<=1);}
});
test('超过12项可在骨架内分析，互斥的一孔技能不被拼为联合组',async()=>{
 const {data,request}=fixture();data.weapons[0].slots=[1];data.skills.push(...Array.from({length:13},(_,i)=>({id:i+2,name:'额外'+i,max:1,cost:3})));const ids=data.skills.filter(s=>s.id).map(s=>s.id);data.decorations=ids.map(id=>({id:'deco'+id,slot:1,skills:[{skill_id:id,level:1}]}));
 assert.equal(X.configuration(data,request,{skills:ids}).skills.length,14);const out=await X.analyze(data,request,highs,{skills:ids,seconds:3,limit:30});assert.equal(out.scope,'resource-skeletons');assert.equal(out.complete,false);assert.ok(out.entries.length<14);assert.ok(out.stats.skeletons>0);for(const e of out.entries)assert.equal(Object.values(e.vector).reduce((a,b)=>a+b,0),1);
 const groups=X.resourceGroups(data,request,out.entries);assert.equal(groups.length,1);assert.deepEqual(groups[0].tokens,['H']);const expanded=[...X.substitutions(data,request,groups[0],ids)].filter(e=>!e.checkpoint);assert.equal(expanded.length,14);assert.ok(expanded.every(e=>Object.values(e.vector).reduce((a,b)=>a+b,0)===1));
});
test('孔位资源保存等级分布，不把四级孔当成四个一孔位置',()=>{
 const {data,request}=fixture();data.weapons[0].slots=[4];const r=E.validateResult(data,request,{weaponId:'weapon',armors:data.armors.map(a=>({id:a.id,atoms:[]})),charm:none,decorations:[]});assert.deepEqual(X.resources(data,request,r).holes,[0,0,0,1]);
});
test('局部空孔个数目标区分两个一孔与单个高等级孔，原等级和方向保持不变',()=>{
 const {data,request}=fixture();data.armors[0].slots=[4];data.armors.push({...data.armors[0],id:'two-sockets',slots:[1,1]});
 for(const direction of ['slots','socketCount']){const model=E.buildModel(data,request,data.armors,[none]);X.resourceObjective(data,model,request,direction);const raw=highs.solve(model.lp.text(),{output_flag:false,time_limit:2}),r=E.validateResult(data,request,E.reconstruct(model,raw,data,request));assert.deepEqual(r.unusedSlots,direction==='slots'?[4]:[1,1]);}
});
test('局部联动保留用户锁定的防具、炼化和护石',()=>{
 const q={options:{fixedArmors:{head:{id:'h',atoms:[]}},fixedCharm:{id:'locked',skills:[],slots:[]}}},r={pieces:[{id:'h',part:'head'},{id:'c',part:'chest'}],charm:{id:'other'}};
 const n=X.fixedNeighborhood(q,r,true);assert.deepEqual(n.options.fixedArmors.head,q.options.fixedArmors.head);assert.deepEqual(n.options.fixedCharm,q.options.fixedCharm);assert.deepEqual(n.options.fixedArmors.chest,{id:'c'});assert.equal(q.options.fixedArmors.chest,undefined);
});
test('库存骨架和一孔联动只使用现有实例及数量',async()=>{
 const D=require('../dist/data.json'),I=require('../dist/inventory.js'),{fixture}=require('./inventory-fixture.cjs'),{raw,stock,q}=fixture(),before=JSON.stringify(raw);const out=await X.analyze(D,q,highs,{skills:[5,0],seconds:3,limit:5},()=>{},{},raw);assert.ok(out.entries.length);assert.equal(JSON.stringify(raw),before);for(const e of out.entries){I.validateResult(D,stock,q,e.result);assert.equal(e.result.owned.inventoryId,stock.id);}assert.ok(out.skeletons.every(b=>b.profile.pieces.every(p=>p.freeRecords===0)));
});
test('重复D词条和重复一孔技能可以归并为多个通用技能位',()=>{
 const {data}=fixture();data.skills[1].max=2;data.skills.push({id:2,name:'乙',max:2,cost:3});data.atoms=[{pool:1,id:144,category:20,cost:3}];
 const result=atoms=>({pieces:[{pool:1,atoms}],decorations:[]}),a={id:'a',vector:{1:2},result:result([{atomId:144,skillId:1,value:1,count:2}])},b={id:'b',vector:{1:1,2:1},result:result([{atomId:144,skillId:1,value:1,count:1},{atomId:144,skillId:2,value:1,count:1}])};
 const g=X.group(data,[a,b]);assert.equal(g.length,1);assert.deepEqual(g[0].tokens,['D','D']);assert.equal(g[0].members.length,2);
});
test('两颗一孔珠先完成联合验证，不发布单颗前缀，并归并为两个一孔技能',()=>{
 const {data,request}=fixture();data.weapons[0].slots=[1,1];data.skills[1].max=2;data.skills.push({id:2,name:'乙',max:2,cost:3});data.decorations=[1,2].map(id=>({id:'d'+id,slot:1,skills:[{skill_id:id,level:1}]}));
 const base=E.validateResult(data,request,{weaponId:'weapon',armors:data.armors.map(a=>({id:a.id,atoms:[]})),charm:none,decorations:[]}),entries=[];
 X.socketExtensions(data,request,base,[1,2],r=>{const v=X.vector(data,request,r,[1,2]);entries.push({id:X.key(v),vector:v,result:r});},Date.now()+2000,60);
 assert.equal(entries.length,3);assert.ok(entries.every(e=>e.result.unusedSlots.length===0));assert.ok(entries.some(e=>e.vector[1]===1&&e.vector[2]===1));assert.deepEqual(X.group(data,entries).map(g=>g.tokens),[['H','H']]);
});
test('组数较小时先发现双一孔组合，库存不足也不会虚构第二颗珠子',async()=>{
 const {data,request}=fixture();data.weapons[0].slots=[1,1];data.skills.push(...Array.from({length:15},(_,i)=>({id:i+2,name:'额外'+i,max:1,cost:3})));data.decorations=data.skills.filter(s=>s.id).map(s=>({id:'d'+s.id,slot:1,skills:[{skill_id:s.id,level:1}]}));
 const out=await X.analyze(data,request,highs,{seconds:2,limit:2});assert.ok(out.entries.length);const visible=X.resourceGroups(data,request,out.entries);assert.ok(visible.some(g=>g.tokens.filter(t=>t==='H').length===2));const choices=visible.flatMap(g=>[...X.substitutions(data,request,g,data.skills.map(s=>s.id))].filter(e=>!e.checkpoint));assert.ok(choices.some(e=>Object.values(e.vector).reduce((a,b)=>a+b,0)===2));assert.ok(choices.every(e=>E.validateResult(data,request,e.result)));
 data.skills[1].max=2;const base=E.validateResult(data,request,{weaponId:'weapon',armors:data.armors.map(a=>({id:a.id,atoms:[]})),charm:none,decorations:[]}),entries=[];
 X.socketExtensions(data,request,base,[1],r=>entries.push(r),Date.now()+1000,60,r=>{if(r.decorations.some(d=>d.count>1))throw Error('库存不足');return E.validateResult(data,request,r);});assert.equal(entries.length,1);assert.equal(entries[0].unusedSlots.length,1);
});
test('实际Bow312双一孔方案可得防御加二以及跨技能组合，所有方案仍满足24项目标',()=>{
 const D=require('../dist/data.json'),saved=require('../benchmarks/socket-pairs-0.7.2/known-two-sockets.json'),r=E.validateResult(D,saved.request,saved.result),ids=[223,59,55,65,56,75],entries=[];
 assert.deepEqual(r.unusedSlots,[1,1]);X.socketExtensions(D,saved.request,r,ids,a=>{const v=X.vector(D,saved.request,a,ids);X.insert(entries,{id:X.key(v),vector:v,result:a});},Date.now()+3000,60);
 assert.ok(entries.some(e=>e.vector[55]===2));assert.ok(entries.some(e=>e.vector[55]===1&&e.vector[223]===1));assert.ok(entries.every(e=>E.validateResult(D,saved.request,e.result).unusedSlots.length===0));assert.deepEqual(X.group(D,entries).map(g=>g.tokens),[['H','H']]);
});
test('扩展分析支持360秒及270组，默认90秒与60组且界面选项准确',()=>{
 const {data,request}=fixture();assert.equal(X.configuration(data,request,{}).seconds,90);assert.equal(X.configuration(data,request,{}).limit,60);assert.equal(X.configuration(data,request,{seconds:360,limit:270}).limit,270);assert.throws(()=>X.configuration(data,request,{seconds:361}));assert.throws(()=>X.configuration(data,request,{limit:271}));
 const html=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../dist/index.html'),'utf8'),values=id=>[...html.match(new RegExp('<select id="'+id+'">([\\s\\S]*?)</select>'))[1].matchAll(/value="(\d+)"/g)].map(m=>+m[1]);assert.deepEqual(values('extensionSeconds'),[90,180,270,360]);assert.deepEqual(values('extensionLimit'),[60,90,180,270]);
});
