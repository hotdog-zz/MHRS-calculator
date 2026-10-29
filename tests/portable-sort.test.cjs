const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../dist/data.json'),I=require('../dist/inventory.js'),E=require('../dist/engine.js'),S=require('../dist/share.js'),M=require('../dist/mod.js'),C=require('../dist/config.js'),template=require('./mod-template.json'),{fixture}=require('./inventory-fixture.cjs');
function owned(){const {q,stock}=fixture();const result=I.validateResult(D,stock,q,{weaponId:q.weaponId,decorations:[],owned:{version:1,inventoryId:stock.id,weapon:I.reference(stock.byKey.get(q.ownedWeaponKey)),armors:Object.fromEntries(stock.entries.filter(e=>e.kind==='armor').map(e=>[e.base.part,I.reference(e)])),charm:I.reference(stock.byKey.get('equipment:7'))}});return {q,stock,result};}
test('库存截图的数据完全脱离库存，接收者可恢复同一装备与插法并普通Mod导出',async()=>{
 const {q,stock,result}=owned(),before=JSON.stringify({q,result}),shared=await S.encode(D,q,result),decoded=await S.decode(D,shared.token);
 assert.equal(JSON.stringify({q,result}),before);assert.equal(decoded.request.options.ownedOnly,false);assert.equal(decoded.request.options.presetEquipment,true);assert.equal(decoded.result.owned,undefined);assert.equal(decoded.request.ownedWeaponKey,undefined);assert.equal(decoded.request.ownedArmorKeys,undefined);assert.deepEqual(decoded.result.totals,result.totals);assert.deepEqual(decoded.result.placement,result.placement);
 const packed=JSON.stringify(S.pack(D,q,result));for(const secret of [stock.id,'equipment:','petalaces:','fingerprint','inventoryIndex'])assert.ok(!packed.includes(secret),secret);
 const json={...C.payload(D,decoded.request),result:decoded.result};assert.equal((await S.parseText(D,JSON.stringify(json))).id,shared.id);
 const exported=M.exportLoadout(D,template,decoded.result,decoded.request,E,{index:224,name:'普通分享导入'});assert.match(exported.filename,/^224_/);assert.equal(exported.payload.inventoryList.length,8);const read=M.readLoadout(D,exported.payload,E);for(const t of decoded.request.skills)assert.ok(read.skills.some(s=>s.id===t.id&&s.level>=t.level));
});
test('预设分享保留超出普通搜索约束的既有炼化，同时不放宽普通搜索校验',async()=>{
 const {q,result}=owned(),r=structuredClone(result),a=D.armors.find(a=>a.part==='head'&&a.pool>0&&a.skills.length===3),skills=D.skills.filter(s=>s.cost===9&&!a.skills.some(v=>v.skill_id===s.id)).slice(0,3);assert.equal(skills.length,3);
 const raw=D.atoms.find(x=>x.pool===a.pool&&x.category===20&&x.cost===9&&x.values.some(v=>v.value===1));assert.ok(raw);r.armors[0]={id:a.id,atoms:skills.map(s=>({atomId:raw.id,skillId:s.id,value:1,count:1}))};
 const request={...q,skills:[],options:{...q.options,ownedOnly:false,presetEquipment:true,fixedArmors:{},augmentLimits:{}}};assert.throws(()=>E.evaluateArmor(D,request,r.armors[0]));
 const share=await S.encode(D,request,r),decoded=await S.decode(D,share.token);assert.equal(decoded.result.pieces[0].id,a.id);assert.equal(decoded.result.pieces[0].atoms.length,3);for(const s of skills)assert.equal(decoded.result.totals[s.id],(result.totals[s.id]||0)+1-(result.pieces[0].levels[s.id]||0));
 assert.throws(()=>E.validateRequest(D,decoded.request));const mod=M.exportLoadout(D,template,decoded.result,decoded.request,E,{index:216});assert.match(mod.filename,/^216_/);
});
test('预设校验拒绝未知词条、越界技能与插不下的珠子，不信任结果缓存',()=>{
 const {q,result}=owned(),p=I.shareable(D,q,result);const bad=structuredClone(p.result);bad.armors[0].atoms=[{atomId:999999,value:1,count:1}];assert.throws(()=>I.validatePreset(D,p.request,bad),/未知/);
 const unchanged=I.validatePreset(D,p.request,{...p.result,defense:999999,totals:{}});assert.equal(unchanged.defense,p.result.defense);assert.deepEqual(unchanged.totals,p.result.totals);
 const many=structuredClone(p.result);many.decorations=D.decorations.slice(0,21).map(d=>({id:d.id,count:21}));assert.throws(()=>I.validatePreset(D,p.request,many),/孔位/);
});
test('Mod两种导出共同限制栏位1至224，普通方案可指定末栏',()=>{
 const {q,result,stock}=owned(),p=I.shareable(D,q,result);for(const index of [0,225,1.5,NaN]){assert.throws(()=>M.exportLoadout(D,template,p.result,p.request,E,{index}),/栏位/);assert.throws(()=>I.exportPlan(D,stock,template,result,q,{index}),/栏位/);}assert.match(M.exportLoadout(D,template,p.result,p.request,E,{index:224}).filename,/^224_/);
});
test('不同库存类别提供适用排序，稀有度和数量可双向排序，未知值排末',()=>{
 assert.ok(!I.sortOptions('weapon').some(([id])=>id==='defense'));assert.ok(I.sortOptions('weapon').some(([id])=>id==='rarity'));assert.ok(I.sortOptions('armor').some(([id])=>id==='rarity'));assert.ok(!I.sortOptions('charm').some(([id])=>id==='defense'));assert.ok(!I.sortOptions('decoration').some(([id])=>id==='box'));
 const rows=[{key:'x:2',index:2,base:{rarity:8}},{key:'x:1',index:1,base:{rarity:10}},{key:'x:3',index:3}];assert.deepEqual(I.sortEntries(rows,'weapon','rarity','asc').map(e=>e.index),[2,1,3]);assert.deepEqual(I.sortEntries(rows,'weapon','rarity','desc').map(e=>e.index),[1,2,3]);assert.deepEqual(rows.map(e=>e.index),[2,1,3]);assert.throws(()=>I.sortEntries(rows,'weapon','defense'),/不支持/);
 const decos=[{key:'a',count:2},{key:'b',count:10}];assert.equal(I.sortEntries(decos,'decoration','quantity','desc')[0].key,'b');assert.equal(I.sortEntries(decos,'decoration','quantity','asc')[0].key,'a');
});
test('库存实例显示实际启用的炼化条数，BuildupPoint与CustomCount不作为武器等级',()=>{
 const item={BuildupPoint:0,CustomCount:10,CustomEnable:true,CustomBuildup:[{Id:1},{Id:28},{Id:0}]};assert.equal(I.augmentSummary({item}),'已炼化 2 条');assert.equal(I.augmentSummary({item:{...item,CustomEnable:false}}),'无有效炼化');assert.equal(item.CustomCount,10);assert.equal(item.BuildupPoint,0);
});

let canvas;try{canvas=require('@napi-rs/canvas');}catch{}
test('库存截图实际绘图及二维码像素解码可还原无库存依赖的同一方案',{skip:!canvas},async()=>{
 const {q,result}=owned(),shared=await S.encode(D,q,result),image=S.renderImage(D,shared,canvas.createCanvas),qr=S.makeQr(shared.token),scale=4,side=(qr.getModuleCount()+8)*scale,c=canvas.createCanvas(side,side),ctx=c.getContext('2d');S.drawQr(ctx,qr,0,0,scale);
 const token=S.decodePixels(ctx.getImageData(0,0,side,side).data,side,side),decoded=await S.decode(D,token);assert.equal(decoded.id,shared.id);assert.deepEqual(decoded.result.totals,result.totals);assert.ok(image.width>0&&image.height>0);assert.ok(image.canvas.toBuffer('image/png').length>1000);
});
