importScripts('./vendor/highs.js','./engine.js','./config.js','./mod.js','./inventory.js','./resource-templates.js','./extensions.js');
let running=false;
let pageContext=null;const pages=new Map();
self.onmessage=async event=>{
 const message=event.data;
 if(message.task==='page'){
  try{
   if(message.init){const m=message.init,stock=m.request.options?.ownedOnly?ForgeInventory.parse(m.data,m.inventory):null;pageContext={...m,decorationCounts:stock?Object.fromEntries(m.data.decorations.map(d=>[d.id,stock.counts.get(ForgeMod.decoToGame(d.id))||0])):undefined,verify:r=>stock?ForgeInventory.validateResult(m.data,stock,m.request,r):ForgeEngine.validateResult(m.data,m.request,r)};pages.clear();}
   if(!pageContext)throw Error('候选验证上下文已失效');const ctx=pageContext;let state=pages.get(message.groupId);
   if(!state){state={iterator:ForgeExtensions.substitutions(ctx.data,ctx.request,message.group,ctx.skills,ctx.verify,{filterSkills:ctx.filterSkills,decorationCounts:ctx.decorationCounts}),checked:0,skip:message.skip||0};pages.set(message.groupId,state);}
   const items=[],until=Date.now()+2000;let finished=false;
   while(items.length<100&&Date.now()<until){const next=state.iterator.next();if(next.done){finished=true;break;}if(next.value.checkpoint){await new Promise(r=>setTimeout(r,0));continue;}if(state.skip){state.skip--;state.checked++;continue;}const {template,choices,vector}=next.value;items.push({template,choices,vector});state.checked++;if(items.length%8===0)await new Promise(r=>setTimeout(r,0));}
   postMessage({phase:'page',id:message.id,items,finished,checked:state.checked});
  }catch(error){postMessage({phase:'pageError',id:message.id,message:error.message||String(error)});}return;
 }
 if(running)return;running=true;
 try{const m=event.data;let factory;
  if(m.wasmBinary){const compiled=await WebAssembly.compile(m.wasmBinary);factory=Module({instantiateWasm:(imports,receive)=>{const instance=new WebAssembly.Instance(compiled,imports);receive(instance);return instance.exports;}});}
  else factory=Module({locateFile:file=>new URL('./vendor/'+file,self.location.href).href});
  const highs=await factory,response=await ForgeExtensions.analyze(m.data,m.request,highs,m.config,p=>postMessage(p),m.execution,m.inventory);postMessage({phase:'done',response});
 }catch(error){postMessage({phase:'error',message:error.message||String(error)});}finally{running=false;}
};
