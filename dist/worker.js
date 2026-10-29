importScripts('./vendor/highs.js','./engine.js','./config.js','./mod.js','./inventory.js');
let runtime;
self.onmessage=async event=>{
 try{
  const {data,request,execution,inventory}=event.data;
  postMessage({phase:'loading',message:'加载本地求解引擎…'});
  if(!runtime){
   if(event.data.wasmBinary){
    const compiled=await WebAssembly.compile(event.data.wasmBinary);
    runtime=Module({instantiateWasm:(imports,receive)=>{const instance=new WebAssembly.Instance(compiled,imports);receive(instance);return instance.exports;}});
   }else runtime=Module({locateFile:file=>new URL('./vendor/'+file,self.location.href).href});
  }
  const highs=await runtime;
  let lastMemory=0;
  const progress=p=>{postMessage(p);if(p.phase==='result'||Date.now()-lastMemory>500){postMessage({phase:'memory',bytes:highs.memoryBytes});lastMemory=Date.now();}};
  const response=request.options?.ownedOnly?await ForgeInventory.search(data,request,highs,progress,execution,inventory):await ForgeEngine.search(data,request,highs,progress,execution);postMessage({phase:'memory',bytes:highs.memoryBytes});postMessage({phase:'done',response});
 }catch(error){postMessage({phase:'error',message:error.message||String(error)});}
};
