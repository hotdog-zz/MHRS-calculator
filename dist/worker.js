importScripts('./vendor/highs.js','./engine.js');
let runtime;
self.onmessage=async event=>{
 try{
  const {data,request}=event.data;
  postMessage({phase:'loading',message:'加载本地求解引擎…'});
  if(!runtime){
   if(event.data.wasmBinary){
    const compiled=await WebAssembly.compile(event.data.wasmBinary);
    runtime=Module({instantiateWasm:(imports,receive)=>{const instance=new WebAssembly.Instance(compiled,imports);receive(instance);return instance.exports;}});
   }else runtime=Module({locateFile:file=>new URL('./vendor/'+file,self.location.href).href});
  }
  const highs=await runtime;
  const response=await ForgeEngine.search(data,request,highs,p=>postMessage(p));postMessage({phase:'done',response});
 }catch(error){postMessage({phase:'error',message:error.message||String(error)});}
};
