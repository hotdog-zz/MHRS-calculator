const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {Worker}=require('node:worker_threads');
const C=require('../dist/config.js');
const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../dist/data.json')));
test('配置复制仅包含白名单字段，不携带来源网址、账户或未知选项',()=>{
 const p=C.payload(data,{weaponId:'LongSword:302',skills:[{id:0,level:7}],account:'PRIVATE-ACCOUNT',origin:'PRIVATE-ORIGIN',options:{sex:'MaleOnly',account:'PRIVATE-ACCOUNT',token:'PRIVATE-TOKEN'}});
 const text=JSON.stringify(p);assert.ok(!text.includes('PRIVATE-'));assert.equal(C.normalize(data,p).skills[0].level,7);assert.throws(()=>C.normalize(data,{weaponId:'invalid',skills:[]}),/有效/);
});
test('离线单文件启动两个独立Worker并合并真实求解结果，停止时回收两个Worker',async()=>{
 const P=require('../dist/search-pool.js'),E=require('../dist/engine.js');
 const local=path.resolve(__dirname,'../SunbreakForge.html'),html=fs.readFileSync(fs.existsSync(local)?local:path.resolve(__dirname,'../../deliverables/SunbreakForge.html'),'utf8');
 const field=id=>html.match(new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'))[1].trim();
 const source=Buffer.from(field('embeddedWorker'),'base64').toString(),wasm=Uint8Array.from(Buffer.from(field('embeddedWasm'),'base64')),packedData=JSON.parse(field('embeddedData'));
 const bootstrap=`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.WorkerGlobalScope=class {};globalThis.location={href:'blob:local'};globalThis.fetch=()=>{throw new Error('Network disabled')};globalThis.XMLHttpRequest=class{constructor(){throw new Error('Network disabled')}};globalThis.postMessage=m=>parentPort.postMessage(m);parentPort.on('message',data=>self.onmessage({data}));globalThis.process=undefined;\n`;
 const created=[];let terminated=0;
 const request={weaponId:'LongSword:302',skills:[{id:0,level:7},{id:5,level:7},{id:7,level:3}],options:{seconds:15,limit:1,sex:'MaleOnly'}};
 const out=await P.search({data:packedData,request,createWorker:()=>{
  const w=new Worker(bootstrap+source,{eval:true});created.push(w);
  w.on('message',data=>w.onmessage?.({data}));w.on('error',error=>w.onerror?.(error));
  const send=w.postMessage.bind(w),stop=w.terminate.bind(w);w.postMessage=message=>send({...message,wasmBinary:wasm});w.terminate=()=>{terminated++;return stop();};return w;
 }});
 assert.equal(created.length,2);assert.equal(terminated,2);assert.equal(out.errors.length,0);assert.equal(out.results.length,1);assert.equal(out.results[0].verified,true);E.validateResult(packedData,request,out.results[0]);assert.ok(html.includes('root.ForgePool=api'));
});
test('单文件内嵌Worker在禁止网络时完成真实数据求解',async()=>{
 const local=path.resolve(__dirname,'../SunbreakForge.html');const built=path.resolve(__dirname,'../../deliverables/SunbreakForge.html');const html=fs.readFileSync(fs.existsSync(local)?local:built,'utf8');
 const field=id=>{const found=html.match(new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'));assert.ok(found,id);return found[1].trim();};
 const packedData=JSON.parse(field('embeddedData'));const wasm=Uint8Array.from(Buffer.from(field('embeddedWasm'),'base64'));const source=Buffer.from(field('embeddedWorker'),'base64').toString();
 assert.ok(!/<(?:script|link)[^>]+(?:src|href)="\.\//.test(html));assert.ok(!source.includes('importScripts('));
 const bootstrap=`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.WorkerGlobalScope=class {};globalThis.location={href:'blob:local'};globalThis.fetch=()=>{throw new Error('Network disabled')};globalThis.XMLHttpRequest=class{constructor(){throw new Error('Network disabled')}};globalThis.postMessage=m=>parentPort.postMessage(m);parentPort.on('message',data=>self.onmessage({data}));globalThis.process=undefined;\n`;
 const worker=new Worker(bootstrap+source,{eval:true});
 try{
  const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Offline worker timeout')),20000);worker.on('error',e=>{clearTimeout(timer);reject(e)});worker.on('message',m=>{if(m.phase==='error'){clearTimeout(timer);reject(new Error(m.message))}if(m.phase==='done'){clearTimeout(timer);resolve(m.response)}});worker.postMessage({data:packedData,wasmBinary:wasm,request:{weaponId:'LongSword:302',skills:[{id:0,level:7},{id:5,level:7},{id:7,level:3}],options:{seconds:15,limit:1,sex:'MaleOnly'}}},[wasm.buffer]);});
  assert.equal(result.status,'feasible',JSON.stringify(result.attempts));assert.equal(result.results[0].verified,true);
 }finally{await worker.terminate();}
});
