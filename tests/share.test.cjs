const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const E=require('../dist/engine.js'),C=require('../dist/config.js'),S=require('../dist/share.js'),data=require('../dist/data.json');
let shared,source,request,canvasLib;try{canvasLib=require('@napi-rs/canvas');}catch{}
before(async()=>{
 const highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});
 request={weaponId:'LongSword:302',skills:[{id:0,level:7},{id:5,level:7},{id:6,level:3},{id:7,level:3},{id:203,level:3},{id:228,level:3}],options:{sex:'MaleOnly',seconds:10,limit:1,defenseFallback:true}};
 const response=await E.search(data,request,highs);assert.equal(response.status,'feasible',JSON.stringify(response.attempts));source=response.results[0];shared=await S.encode(data,request,source);
});
test('自包含方案码恢复武器、炼化、护石、目标技能和逐孔插珠，唯一指纹稳定且不修改输入',async()=>{
 const snapshot=JSON.stringify(source),decoded=await S.decode(data,shared.token);assert.equal(decoded.id,shared.id);assert.equal(decoded.result.weaponId,source.weaponId);
 assert.deepEqual(decoded.result.pieces.map(p=>E.atomSignature(p.atoms)),source.pieces.map(p=>E.atomSignature(p.atoms)));assert.equal(E.charmSignature(decoded.result.charm),E.charmSignature(source.charm));assert.deepEqual(decoded.result.placement,source.placement);assert.deepEqual(decoded.result.totals,source.totals);
 E.validateRequest(data,decoded.request);assert.equal(Object.keys(decoded.request.options.fixedArmors).length,5);assert.equal((await S.encode(data,decoded.request,decoded.result)).token,shared.token);assert.equal(JSON.stringify(source),snapshot);
 assert.equal((await S.encode(data,{...request,account:'PRIVATE',origin:'PRIVATE'}, {...source,account:'PRIVATE'})).token,shared.token);
 const current=data.weapons.find(w=>w.id===source.weaponId),other=data.weapons.find(w=>w.id!==current.id&&w.id.startsWith('LongSword:')&&E.caps(w.slots).every((v,i)=>v>=E.caps(current.slots)[i]));
 assert.ok(other);assert.notEqual((await S.encode(data,{...request,weaponId:other.id},{...source,weaponId:other.id})).id,shared.id);
 assert.ok(!shared.token.includes('http'));assert.match(shared.id,/^[a-f0-9]{64}$/);
});
test('篡改、不完整、错误版本、无效炼化和仅条件JSON均拒绝',async()=>{
 const altered=shared.token.slice(0,5)+(shared.token[5]==='a'?'b':'a')+shared.token.slice(6);await assert.rejects(()=>S.decode(data,altered),/校验失败/);await assert.rejects(()=>S.decode(data,shared.token.slice(0,-20)),/损坏|校验失败/);
 const payload=S.pack(data,request,source),version=structuredClone(payload);version[1]='other-version';assert.throws(()=>S.unpack(data,version),/版本/);
 const invalid=structuredClone(payload);invalid[5][0][1]=[[70,-1,0,5,0]];assert.throws(()=>S.unpack(data,invalid),/最多出现1次/);
 await assert.rejects(()=>S.parseText(data,JSON.stringify(C.payload(data,request))),/不包含具体方案/);
 await assert.rejects(()=>S.decode(data,'SBF1:'+'x'.repeat(2600)),/完整方案码/);
});
test('既有完整方案JSON与扫码文本可导入，不要求重新搜索',async()=>{
 const json={...C.payload(data,request),dataVersion:data.meta.version,result:source};const recovered=await S.parseText(data,JSON.stringify(json));assert.equal(recovered.id,shared.id);
 assert.equal((await S.parseText(data,JSON.stringify({token:shared.token}))).id,shared.id);
 assert.equal((await S.parseText(data,'https://example.invalid/#s='+encodeURIComponent(shared.token))).id,shared.id);
});
test('百龙珠随条件、JSON、二维码和分享图保存，空置和旧格式兼容，改变珠子改变指纹',async()=>{
 assert.equal(S.pack(data,request,source)[0],1);
 for(const id of [0,1048579,1048577]){
  const q={...request,rampageDecorationId:id},normalized=C.normalize(data,C.payload(data,q));assert.equal(normalized.rampageDecorationId,id);
  const encoded=await S.encode(data,q,source),decoded=await S.decode(data,encoded.token);assert.equal(decoded.request.rampageDecorationId,id);assert.equal(S.pack(data,q,source)[0],2);assert.notEqual(encoded.id,shared.id);
  assert.equal((await S.encode(data,decoded.request,decoded.result)).token,encoded.token);
  assert.equal((await S.parseText(data,JSON.stringify({...C.payload(data,q),result:source}))).token,encoded.token);
  if(canvasLib){const image=S.renderImage(data,encoded,canvasLib.createCanvas);assert.ok(image.weaponCard.skills.includes('百龙珠 · '+C.rampageLabel(data,q)));}
 }
 assert.equal(C.normalize(data,{...request,rampageDecorationId:0x00100000}).rampageDecorationId,0);
 assert.ok(!Object.hasOwn(C.normalize(data,request),'rampageDecorationId'));
 for(const id of [-1,'1048579',null,999])assert.throws(()=>C.normalize(data,{...request,rampageDecorationId:id}),/百龙珠ID无效/);
 const bad=S.pack(data,{...request,rampageDecorationId:0},source);bad[8]=999;assert.throws(()=>S.unpack(data,bad),/百龙珠ID无效/);
});
test('二维码编码后从真实RGBA像素解码，并恢复同一方案',async()=>{
 const qr=S.makeQr(shared.token),n=qr.getModuleCount(),scale=5,size=(n+8)*scale,rgba=new Uint8ClampedArray(size*size*4);rgba.fill(255);
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const at=(((r+4)*scale+dy)*size+(c+4)*scale+dx)*4;rgba[at]=rgba[at+1]=rgba[at+2]=0;}
 const token=S.decodePixels(rgba,size,size);assert.equal(token,shared.token);assert.equal((await S.decode(data,token)).id,shared.id);
});
test('PNG整图、JPEG压缩图及二维码裁图均能通过图片导入；包含完整列表且不裁切',{skip:!canvasLib},async()=>{
 const shared=await S.encode(data,{...request,rampageDecorationId:1048579},source);
 const {createCanvas,loadImage}=canvasLib,image=S.renderImage(data,shared,createCanvas),ctx=image.canvas.getContext('2d'),bounds=image.qrBounds;
 assert.equal(image.layout,'compact-columns');assert.equal(image.cards.length,6);
 for(const [i,card] of image.cards.entries()){
  assert.ok(card.x+card.width<image.skillBounds.x);assert.ok(card.y+card.height<=image.equipmentBounds.y+image.equipmentBounds.height);
  if(i<5)for(const a of shared.result.pieces[i].atoms)assert.ok(card.lines.some(l=>l.fullText===S.atomLabel(data,shared.result.pieces[i],a)));
  assert.ok(card.bodyY+card.bodyH+card.summaryRows.length*29<card.height);
 }
 assert.equal(image.finalSkills.length,Object.values(shared.result.totals).filter(n=>n>0).length);assert.ok(image.skillBounds.y+image.skillBounds.height<bounds.y-30);
 assert.equal(bounds.x+bounds.width,image.width-image.padding);assert.equal(bounds.y+bounds.height,image.height-image.padding);
 const old=global.createImageBitmap;global.createImageBitmap=async blob=>loadImage(Buffer.from(await blob.arrayBuffer()));
 try{
  const png=new Blob([image.canvas.toBuffer('image/png')],{type:'image/png'});Object.defineProperty(png,'name',{value:'share.png'});assert.equal(await S.readFile(png,createCanvas),shared.token);
  const jpg=new Blob([image.canvas.toBuffer('image/jpeg',85)],{type:'image/jpeg'});Object.defineProperty(jpg,'name',{value:'share.jpg'});assert.equal(await S.readFile(jpg,createCanvas),shared.token);
  const crop=createCanvas(bounds.width,bounds.height);crop.getContext('2d').drawImage(image.canvas,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);assert.equal(S.decodePixels(crop.getContext('2d').getImageData(0,0,crop.width,crop.height).data,crop.width,crop.height),shared.token);
  assert.ok(ctx.getImageData(0,0,image.width,image.height).data.length>0);
 }finally{if(old)global.createImageBitmap=old;else delete global.createImageBitmap;}
});
test('文件限制与离线页面的依赖打包检查',async()=>{
 await assert.rejects(()=>S.readFile({size:21*1024*1024,name:'big.png',type:'image/png'}),/20MB/);await assert.rejects(()=>S.readFile({size:1,name:'bad.txt',type:'text/plain'}),/请选择PNG/);
 const local=path.resolve(__dirname,'../SunbreakForge.html'),html=fs.readFileSync(fs.existsSync(local)?local:path.resolve(__dirname,'../../deliverables/SunbreakForge.html'),'utf8');assert.ok(html.includes('root.ForgeShare=api'));assert.ok(html.includes('id="importPlan"'));assert.ok(!/<script[^>]+src=/.test(html));
});
test('离线单文件中的二维码、压缩及方案脚本以浏览器全局方式加载，无需网络或require',async()=>{
 const vm=require('node:vm'),local=path.resolve(__dirname,'../SunbreakForge.html'),html=fs.readFileSync(fs.existsSync(local)?local:path.resolve(__dirname,'../../deliverables/SunbreakForge.html'),'utf8');
 const ctx={crypto:require('node:crypto').webcrypto,TextEncoder,TextDecoder,console};ctx.self=ctx;ctx.window=ctx;vm.createContext(ctx);
 let count=0;for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(match[1].trim()||match[2].includes('function renderResult('))continue;vm.runInContext(match[2],ctx);count++;}
 assert.equal(count,10);assert.equal(typeof ctx.qrcode,'function');assert.equal(typeof ctx.jsQR,'function');assert.equal(typeof ctx.LZString.compressToEncodedURIComponent,'function');
 const recovered=await ctx.ForgeShare.decode(data,shared.token);assert.equal(recovered.id,shared.id);assert.equal(ctx.ForgeShare.makeQr(shared.token).getModuleCount(),S.makeQr(shared.token).getModuleCount());
});
