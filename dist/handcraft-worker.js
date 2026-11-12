importScripts('./vendor/highs.js','./engine.js','./config.js','./mod.js','./inventory.js','./probability.js','./handcraft.js','./stargazing.js');
let running=false,nextId=0;const pending=new Map();
self.onmessage=async event=>{
 const m=event.data;
 if(m.task==='probability-response'){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.bytes);return;}
 if(running||m.task!=='start')return;running=true;
 try{
  const wasm=m.wasmBinary?await WebAssembly.compile(m.wasmBinary):null;
  const highs=await Module(wasm?{instantiateWasm:(imports,receive)=>{const instance=new WebAssembly.Instance(wasm,imports);receive(instance);return instance.exports;}}:{locateFile:file=>new URL('./vendor/'+file,self.location.href).href});
  async function asset(file,phase,group){if(m.embedded){const id=++nextId;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});postMessage({phase,id,group});});}const url=new URL(file,m.probabilityBase);url.searchParams.set('dataset',m.index.datasetId||m.index.codebook.id);const response=await fetch(url,{signal:globalThis.AbortSignal?.timeout?.(15000)});if(!response.ok)throw Error('概率数据读取失败：HTTP '+response.status);return response.arrayBuffer();}
  let bookPromise;function book(){if(!bookPromise)bookPromise=(async()=>{const raw=await ForgeProbability.decode(await asset(m.index.codebook.file,'probability-book-request'));if(raw.id!==m.index.codebook.id)throw Error('概率字典与索引不匹配，请刷新页面');return ForgeProbability.prepareCodebook(raw);})();return bookPromise;}
  const loader=async group=>{
   const [dictionary,bytes]=await Promise.all([book(),asset(group+m.index.extension,'probability-request',group)]);
   return ForgeProbability.decode(bytes,dictionary,group);
  },bank=ForgeProbability.createBank(m.data,m.index,loader);
  // Search uses only the unchanged actual-armor bank. Observation work starts
  // afterwards and cannot alter columns, weights, search time or incumbents.
  const response=await ForgeHandcraft.analyze(m.data,m.request,m.inventory,highs,bank,m.config,p=>postMessage(p.phase==='guide-route'?{...p,route:{...p.route,observationPending:true,stargazingRolls:null,stargazingGroups:[]}}:p));
  const observationStarted=Date.now();
  if(response.results.length&&m.index.observation){
   const donorBank=ForgeProbability.createBank(m.data,{...m.index.observation,rolls:m.index.observation.rolls},loader),stock=ForgeInventory.parse(m.data,m.inventory),evaluated=[];
   for(const [i,r]of response.results.entries()){postMessage({phase:'guide-status',message:'计算观星炼化组 '+(i+1)+' / '+response.results.length+'…'});const v=await ForgeStargazing.evaluate(m.data,r,m.request,donorBank,m.config,stock);evaluated.push(v);postMessage({phase:'guide-route',route:v});await new Promise(resolve=>setTimeout(resolve,0));}
   response.results=evaluated.sort(ForgeHandcraft.compare);response.observationStats=donorBank.stats();
  }
  response.observationElapsedMs=Date.now()-observationStarted;response.totalElapsedMs=response.elapsedMs+response.observationElapsedMs;
  postMessage({phase:'guide-done',response,probabilityStats:bank.stats()});
 }catch(e){postMessage({phase:'guide-error',message:e.message||String(e)});}finally{running=false;}
};
