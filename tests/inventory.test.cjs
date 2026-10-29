const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{Worker}=require('node:worker_threads');
const I=require('../dist/inventory.js'),M=require('../dist/mod.js'),E=require('../dist/engine.js'),C=require('../dist/config.js'),S=require('../dist/share.js'),P=require('../dist/search-pool.js'),data=require('../dist/data.json'),template=require('./mod-template.json'),{fixture}=require('./inventory-fixture.cjs');
let highs;before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
test('库存指纹识别强化、炼化、解锁和箱位，允许普通珠子重新分配',()=>{
 const {raw,stock,q}=fixture();assert.equal(stock.entries.filter(e=>e.usable).length,7);assert.equal(stock.errors.length,0);assert.equal(I.validateQuery(data,stock,q).key,'equipment:0');
 const item=structuredClone(raw.items[0].item),fp=I.fingerprint(item);item.DecoIdList=[1,2,3];assert.equal(I.fingerprint(item),fp);item.BuildupPoint++;assert.notEqual(I.fingerprint(item),fp);
 const changed=structuredClone(raw);changed.items[0].item.CustomCount++;assert.throws(()=>I.parse(data,changed),/指纹/);
 const duplicate=structuredClone(raw);duplicate.items.push(duplicate.items[0]);assert.throws(()=>I.parse(data,duplicate),/重复/);
 const lua=structuredClone(raw);for(const row of lua.items)for(const key of ['CustomOpenIdArray','CustomBuildup'])if(!row.item[key].length)row.item[key]={};assert.equal(I.parse(data,lua).entries.length,8);
 const mismatch={...q,ownedInventoryId:'SBFI1-other-1'};assert.throws(()=>I.validateQuery(data,stock,mismatch),/另一份/);
});
test('已有模式实际炼化不受自由炼化、兜底与新增上限重写；结果按库存实例独立复核',async()=>{
 const {stock,q}=fixture(),out=await I.search(data,q,highs,()=>{},{},stock);assert.equal(out.results.length,1);const r=out.results[0];assert.equal(r.defense,564);assert.equal(r.owned.weapon.index,0);assert.deepEqual(r.pieces.map(p=>p.atoms),stock.entries.filter(e=>e.kind==='armor').map(e=>e.armor.atoms));assert.ok(r.records>0);
 assert.deepEqual(I.validateResult(data,stock,q,{...r,defense:999999,totals:{}}).totals,r.totals);
 const bad=structuredClone(r);bad.owned.armors.head.fingerprint+='x';assert.throws(()=>I.validateResult(data,stock,q,bad),/变化/);
 assert.throws(()=>I.validateResult(data,stock,{...q,options:{...q.options,noCharm:true}},r),/不使用护石/);
 assert.throws(()=>M.exportLoadout(data,template,r,q,E),/专用/);const shared=await S.encode(data,q,r);assert.equal(shared.request.options.ownedOnly,false);assert.equal(shared.result.owned,undefined);assert.equal(shared.request.ownedInventoryId,undefined);assert.deepEqual(shared.result.totals,r.totals);
 const exp=I.exportPlan(data,stock,template,r,q,{index:224,now:1700000000000,name:'库存配装'});assert.match(exp.filename,/^owned_224_/);assert.equal(exp.payload.references.length,8);assert.equal(exp.payload.references[6].box,'petalaces');assert.equal(exp.payload.inventoryList,undefined);assert.equal(exp.payload.backupList,undefined);assert.equal(exp.payload.uiInfo,undefined);assert.equal(exp.payload.mySetInfo.Name,'库存配装');assert.throws(()=>I.exportPlan(data,stock,template,r,q,{index:225}),/栏位/);
 const normalized=C.normalize(data,{...C.payload(data,q),result:r});assert.equal(normalized.ownedWeaponKey,'equipment:0');assert.equal(normalized.options.ownedOnly,true);
});
test('有限珠子库存进入整数模型，数量不足不能凭空补珠；超量结果拒绝',async()=>{
 const {raw,q}=fixture();const native=I.parse(data,raw).entries.flatMap(e=>e.skills||[]).map(s=>s.skill_id);const d=data.decorations.find(d=>d.slot===1&&d.skills.length===1&&d.skills[0].level===1&&!native.includes(d.skills[0].skill_id)&&data.skills.find(s=>s.id===d.skills[0].skill_id).max>=2);assert.ok(d);
 q.skills=[{id:d.skills[0].skill_id,level:2}];q.options.seconds=2;
 raw.decorations=[{id:M.decoToGame(d.id),count:1}];const scarce=I.parse(data,raw),no=await I.search(data,q,highs,()=>{},{},scarce);assert.equal(no.results.length,0);
 raw.decorations[0].count=2;const enough=I.parse(data,raw),yes=await I.search(data,q,highs,()=>{},{},enough);assert.equal(yes.results.length,1);assert.equal(yes.results[0].decorations[0].count,2);assert.throws(()=>I.validateResult(data,scarce,q,yes.results[0]),/超过库存/);
});
test('相同型号不同箱位保留独立实例，可指定其一；未知条目保留而不参与求解',async()=>{
 const {raw,q}=fixture(),row=structuredClone(raw.items[1]);row.index=30;row.item.InventoryIndex=30;row.fingerprint=I.fingerprint(row.item);raw.items.push(row);const unknown=M.cleanItem({IdVal:999999,IdType:2,InventoryIndex:31});raw.items.push({box:'equipment',index:31,item:unknown,fingerprint:I.fingerprint(unknown),referencedBy:[]});const stock=I.parse(data,raw);assert.equal(stock.errors.length,1);assert.equal(stock.entries.length,10);q.ownedArmorKeys={head:'equipment:30'};const out=await I.search(data,q,highs,()=>{},{},stock);assert.equal(out.results[0].owned.armors.head.index,30);
 const illegal=structuredClone(out.results[0]);illegal.owned.armors.head=I.reference(stock.byKey.get('equipment:1'));assert.throws(()=>I.validateResult(data,stock,q,illegal),/指定库存/);
});
test('库存快照的本机持久保存与清除支持无 IndexedDB 的环境',async()=>{
 const values=new Map(),store=I.createStore({localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}),{raw}=fixture();assert.equal(await store.save(raw),true);assert.deepEqual(await store.load(),raw);await store.clear();assert.equal(await store.load(),null);assert.equal(await I.createStore().save(raw),false);
});
test('离线双 Worker 只使用同一库存快照，结果可导出为已有装备专用 Mod JSON',async()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../../deliverables/SunbreakForge.html'),'utf8'),field=id=>html.match(new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'))[1].trim(),source=Buffer.from(field('embeddedWorker'),'base64').toString(),wasm=Uint8Array.from(Buffer.from(field('embeddedWasm'),'base64'));
 const {raw,q,stock}=fixture();const bootstrap=`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.WorkerGlobalScope=class {};globalThis.location={href:'blob:local'};globalThis.fetch=()=>{throw new Error('Network disabled')};globalThis.XMLHttpRequest=class{constructor(){throw new Error('Network disabled')}};globalThis.postMessage=m=>parentPort.postMessage(m);parentPort.on('message',data=>self.onmessage({data}));globalThis.process=undefined;\n`;
 let created=0,terminated=0;const out=await P.search({data,request:q,inventory:raw,createWorker:()=>{created++;const w=new Worker(bootstrap+source,{eval:true});w.on('message',data=>w.onmessage?.({data}));w.on('error',e=>w.onerror?.(e));const send=w.postMessage.bind(w),stop=w.terminate.bind(w);w.postMessage=m=>send({...m,wasmBinary:wasm});w.terminate=()=>{terminated++;return stop();};return w;}});assert.equal(created,2);assert.equal(terminated,2);assert.deepEqual(out.errors,[]);assert.equal(out.results.length,1);I.validateResult(data,stock,q,out.results[0]);assert.equal(I.exportPlan(data,stock,template,out.results[0],q).payload.references[0].index,0);assert.ok(html.includes('id="embeddedInventoryLua"'));
});
test('操虫棍必须引用该武器实际关联的已有猎虫；缺失和歧义时拒绝专用导出',()=>{
 const {raw,q}=fixture(),w=data.weapons.find(w=>w.type==='insect_glaive');q.weaponId=w.id;q.rampageDecorationId=0;
 const wi=raw.items[0].item;wi.IdVal=M.equipmentToGame(w.id);wi.HyakuryuDecoId=0;wi.PairInsectInventoryIndex=42;raw.items[0].fingerprint=I.fingerprint(wi);
 const insect=M.cleanItem({IdVal:149946368,IdType:1,InventoryIndex:42});raw.items.push({box:'equipment',index:42,item:insect,fingerprint:I.fingerprint(insect),referencedBy:[]});
 const stock=I.parse(data,raw),r=I.validateResult(data,stock,q,{weaponId:w.id,decorations:[],owned:{version:1,inventoryId:stock.id,weapon:I.reference(stock.byKey.get('equipment:0')),armors:Object.fromEntries(stock.entries.filter(e=>e.kind==='armor').map(e=>[e.base.part,I.reference(e)])),charm:I.reference(stock.byKey.get('equipment:7'))}}),mod=structuredClone(template);mod.inventoryList[0].IdVal=wi.IdVal;mod.backupList[0].IdVal=wi.IdVal;
 assert.equal(I.exportPlan(data,stock,mod,r,q).payload.insect.index,42);
 const absent=I.parse(data,{...raw,items:raw.items.slice(0,8)});assert.throws(()=>I.exportPlan(data,absent,mod,r,q),/猎虫/);
});
test('Lua 逐孔校验使用同一份最终版装备和珠子数据，避免前后端孔位漂移',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../dist/EquipmentLoadoutsManager.lua'),'utf8'),table=JSON.parse(source.match(/local OWNED_STATIC = json.load_string\(\[\[([\s\S]*?)\]\]\)/)[1]);
 for(const w of data.weapons)assert.deepEqual(table.slots[M.equipmentToGame(w.id)].slice(0,3),[...w.slots,0,0,0].slice(0,3));
 for(const a of data.armors)assert.deepEqual(table.slots[M.equipmentToGame(a.id)],[...a.slots,0,0,0].slice(0,3).concat(a.pool));
 for(const d of data.decorations)assert.equal(table.decoSlots[M.decoToGame(d.id)],d.slot);
});

test('库存条件导入先核对具体实例，允许稍后填写目标技能但不跨快照复用索引',()=>{
 const {stock,q}=fixture();assert.equal(I.validateSelection(data,stock,{...q,skills:[]}).key,q.ownedWeaponKey);
 assert.throws(()=>I.validateSelection(data,stock,{...q,ownedInventoryId:'SBFI1-Other-1'}),/另一份库存/);
 assert.throws(()=>I.validateSelection(data,stock,{...q,ownedArmorKeys:{head:'equipment:2'}}),/部位不符/);
 assert.throws(()=>I.validateSelection(data,stock,{...q,ownedCharmKey:'equipment:1'}),/护石不存在/);
});
