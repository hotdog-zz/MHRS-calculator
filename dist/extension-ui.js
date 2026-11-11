(function(root){
'use strict';
let data,host,job=null,generation=0,clock,started=0,snapshot=null,analysisConfig,inventorySnapshot,entries=[],groups=[],selected=new Set();
let pageWorker=null,pageUrl=null,pageId=0;const pageRequests=new Map(),pageGroups=new Set();
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const skill=id=>data.skills.find(s=>s.id===+id),tuple=v=>'（'+Object.entries(v).filter(([,n])=>n>0).map(([id,n])=>skill(id).name+' +'+n).join('，')+'）';
function token(t){if(t==='D')return 'D级及以下技能 +1';if(t==='H')return '1级孔位';if(t.startsWith('G:'))return ({6:'C',9:'B',12:'A',15:'S'}[+t.split(':')[1]]||t.split(':')[1]+' cost')+'级及以下技能 +1';if(t.startsWith('J:'))return t.split(':')[1]+'级孔位';const [,id,n]=t.split(':');return skill(id).name+' +'+n;}
function picker(){
 const q=$('extensionSkillSearch').value.trim().toLowerCase(),base=new Map(host.context().request.skills.map(s=>[s.id,s.level]));
 const choices=data.skills.filter(s=>(base.get(s.id)||0)<s.max&&(!q||s.name.includes(q)||s.nameEn?.toLowerCase().includes(q)));
 $('extensionSkill').innerHTML=choices.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'（可再加 '+(s.max-(base.get(s.id)||0))+' 级）</option>').join('')||'<option value="">没有匹配的可提升技能</option>';
 $('extensionSelected').innerHTML=[...selected].map(id=>'<button class="extension-chip" data-ext-remove="'+id+'">'+esc(skill(id).name)+' ×</button>').join('')||'<span class="muted small">选择你关心的额外技能，也可选择目标中尚未满级的技能。</span>';
 $('extensionSelectedCount').textContent=$('extensionScope').value==='all'?'全部可提升技能':selected.size+' 项';
}
function groupLabel(tokens){const counts=new Map();for(const t of tokens)counts.set(t,(counts.get(t)||0)+1);return '（'+[...counts].map(([t,n])=>token(t)+(n>1?' ×'+n:'')).join('，')+'）';}
function closePages(){for(const c of pageRequests.values())c.reject(Error('候选验证已停止'));pageRequests.clear();pageGroups.clear();pageWorker?.terminate();pageWorker=null;if(pageUrl)URL.revokeObjectURL(pageUrl);pageUrl=null;}
function remotePage(index,g){
 if(typeof Worker==='undefined'||typeof Worker.prototype.postMessage!=='function')return null;
 let init;if(!pageWorker){const embedded=$('embeddedExtensionWorker');pageUrl=embedded?URL.createObjectURL(new Blob([new TextDecoder().decode(Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0)))],{type:'text/javascript'})):null;pageWorker=new Worker(pageUrl||'./extension-worker.js');init={data,request:snapshot,skills:analysisConfig.skills,filterSkills:analysisConfig.filterSkills,inventory:inventorySnapshot?.raw};pageWorker.onmessage=e=>{const p=e.data,c=pageRequests.get(p.id);if(!c)return;pageRequests.delete(p.id);if(p.phase==='pageError')c.reject(Error(p.message));else c.resolve(p);};const owner=pageWorker;pageWorker.onerror=e=>{if(pageWorker!==owner)return;for(const c of pageRequests.values())c.reject(Error(e.message||'候选验证线程异常'));pageRequests.clear();pageGroups.clear();pageWorker?.terminate();pageWorker=null;};}
 const id=++pageId;return new Promise((resolve,reject)=>{pageRequests.set(id,{resolve,reject});try{pageWorker.postMessage({task:'page',id,groupId:index,...(pageGroups.has(index)?{}:{group:g}),skip:g.checked||0,...(init?{init}:{})});pageGroups.add(index);}catch(e){pageRequests.delete(id);closePages();reject(e);}});
}
function singlePosition(g){return g.recipes.every(r=>r.operations.length<=1);}
function rowsFor(g){return (g.variants?.length?g.variants:g.members).filter(m=>ForgeExtensions.matchesGroup(m.vector,g,analysisConfig?.filterSkills));}
function pendingGroups(){return groups.map((g,i)=>({g,i})).filter(({g})=>g.generic&&!g.finished&&!rowsFor(g).length);}
function render(reset=true){
 if(reset)groups=ForgeExtensions.resourceGroups(data,snapshot,entries);
 const visible=groups.filter(g=>rowsFor(g).length),pending=pendingGroups();
 $('extensionCount').textContent=visible.length+' 个资源扩展组 · 保留 '+entries.length+' 个搜索样本（替换选项不占组数）'+(pending.length?' · '+pending.length+' 个模板待验证，不代表不可行':'');
 $('extensionResults').innerHTML=groups.map((g,index)=>{const rows=g.rows=rowsFor(g);if(!rows.length)return '';return '<article class="extension-result"><div class="extension-result-title"><strong>'+esc(groupLabel(g.tokens))+'</strong><span class="verified">'+(g.generic?(g.finished?'该模板候选已验证完毕':g.expanding?'正在补全候选…':'候选尚未补全'):'对应方案已校验')+'</span></div>'+(g.generic?'<p class="muted small">保留本组其他技能，资源位置可以留空，费用与孔等级表示上限。每个列出的组合均联合校验；候选数量受等级、五技能容量、固定炼化和库存限制。'+(analysisConfig.filterSkills?.length?' 仅显示包含任一所选技能增量的组合。':'')+(g.checked?' 已补全 '+g.checked+' 种，当前显示 '+rows.length+' 种。':'')+'</p><label>具体技能组合<select data-ext-choice="'+index+'">'+rows.map((m,j)=>'<option value="'+j+'">'+esc(tuple(m.vector))+(m.result?' · 防御 '+m.result.defense:'')+'</option>').join('')+'</select></label><button class="text-button" data-ext-expand="'+index+'" aria-busy="'+Boolean(job||g.expanding)+'" '+(job||g.expanding||g.finished?'disabled':'')+'>'+(g.finished?'全部候选已验证':g.expanding?'正在验证…':job?'搜索完成后可验证':g.iterator||g.remote?'验证下一批（替换当前列表）':'补全并验证替换选项')+'</button>':'<p class="muted small">基础防御 '+rows[0].result.defense+' · 空余孔位等级和 '+ForgeEngine.unusedSlotScore(rows[0].result)+'</p>')+'<button class="outline-button" data-ext-view="'+index+'" aria-busy="'+Boolean(job||g.expanding)+'" '+(job||g.expanding?'disabled':'')+'>查看对应方案</button></article>';}).join('')+(pending.length?'<button class="outline-button" data-ext-pending="true" '+(job||groups.some(g=>g.expanding)?'disabled':'')+'>继续检查待验证模板（'+pending.length+'）</button>':'');
}
function verifyGroup(g,input){const result=verify(input);if(!ForgeExtensions.matchesGroup(ForgeExtensions.vector(data,snapshot,result,analysisConfig.skills),g,analysisConfig.filterSkills))throw Error('该方案不满足当前组或技能筛选');return result;}
function substitutionOptions(){return {filterSkills:analysisConfig.filterSkills,decorationCounts:inventorySnapshot?Object.fromEntries(data.decorations.map(d=>[d.id,inventorySnapshot.counts.get(ForgeMod.decoToGame(d.id))||0])):undefined};}
async function checkPending(){const serial=generation;for(const {i} of pendingGroups()){if(serial!==generation||job)return;await expand(i);}}
function verify(input){return snapshot.options?.ownedOnly?ForgeInventory.validateResult(data,inventorySnapshot,snapshot,input):ForgeEngine.validateResult(data,snapshot,input);}
async function expand(index){
 const g=groups[index],serial=generation;if(!g||!g.generic||g.expanding||g.finished||job)return;
 g.expanding=true;g.failed=false;render(false);$('extensionStop').disabled=false;
 const batch=[],until=Date.now()+2000;
 try{const remote=remotePage(index,g);if(remote){g.remote=true;const response=await remote;if(serial!==generation)return;batch.push(...response.items);g.finished=response.finished;}else{g.iterator??=ForgeExtensions.substitutions(data,snapshot,g,analysisConfig.skills,verify,substitutionOptions());while(batch.length<100&&Date.now()<until){if(serial!==generation)return;const step=g.iterator.next();if(step.done){g.finished=true;break;}if(step.value.checkpoint){await new Promise(r=>setTimeout(r,0));continue;}const {template,choices,vector}=step.value;batch.push({template,choices,vector});if(batch.length%8===0)await new Promise(r=>setTimeout(r,0));}}
  if(serial!==generation)return;if(batch.length)g.variants=singlePosition(g)?[...(g.variants||[]),...batch]:batch;g.checked=(g.checked||0)+batch.length;
 }catch(e){g.failed=true;if(serial===generation)host.toast('候选补全失败：'+e.message);}finally{g.expanding=false;if(serial===generation){render(false);$('extensionStop').disabled=!job&&!groups.some(g=>g.expanding);}}
}
function initialize(d,callbacks){
 data=d;host=callbacks;
 const base=new Map(host.context().request.skills.map(s=>[s.id,s.level]));selected=new Set([223,59,55,65,56,75].filter(id=>(base.get(id)||0)<skill(id).max));
 $('extensionAdd').onclick=()=>{const value=$('extensionSkill').value;if(value==='')return;selected.add(+value);picker();};
 $('extensionSkillSearch').oninput=picker;$('extensionPanel').addEventListener('toggle',()=>{if($('extensionPanel').open&&!job)picker();});
 $('extensionSelected').onclick=e=>{const b=e.target.closest('[data-ext-remove]');if(!b||job)return;selected.delete(+b.dataset.extRemove);picker();};
 $('extensionScope').value='all';$('extensionFocus').classList.add('hidden');$('extensionScope').onchange=()=>{$('extensionFocus').classList.toggle('hidden',$('extensionScope').value==='all');picker();};
 $('extensionClear').onclick=()=>{selected.clear();picker();};$('extensionStart').onclick=start;$('extensionStop').onclick=stop;
 $('extensionResults').onclick=e=>{if(e.target.closest('[data-ext-pending]')){checkPending();return;}const more=e.target.closest('[data-ext-expand]');if(more?.dataset.extExpand!==undefined){expand(+more.dataset.extExpand);return;}const b=e.target.closest('[data-ext-view]');if(!b||job)return;const g=groups[+b.dataset.extView];if(g.expanding)return;const select=$('extensionResults').querySelector('[data-ext-choice="'+b.dataset.extView+'"]'),index=+(select?.value||0);try{const choice=g.rows[index];if(!choice)return;const member=choice.choices?ForgeExtensions.materialize(data,snapshot,g.recipes[choice.template],choice.choices,analysisConfig.skills,r=>verifyGroup(g,r)):choice;host.present(member.result,snapshot,tuple(member.vector));}catch(error){host.toast(error.message);}};
 picker();
}
function controls(running){for(const e of $('extensionSettings').querySelectorAll('input,select,button'))e.disabled=running;$('extensionStop').disabled=!running;$('extensionStart').disabled=running;$('extensionStart').setAttribute('aria-busy',String(running));host.busy(running);}
function stop(){if(job)job.cancel();else{generation++;closePages();groups.forEach(g=>g.expanding=false);render(false);$('extensionStop').disabled=true;$('extensionStatus').textContent='已停止候选补全，已验证的组合已保留。';}}
function start(){
 if(job)return;if(!host.canStart()){host.toast('请先停止配装搜索或炼化模拟');return;}
 let ctx,config,nextSnapshot,nextInventory;try{ctx=host.context();nextSnapshot=JSON.parse(JSON.stringify(ctx.request));if($('extensionScope').value==='selected'&&!selected.size)throw Error('请选择至少一个用于筛选的技能');config=ForgeExtensions.configuration(data,nextSnapshot,{skills:data.skills.map(s=>s.id),seconds:+$('extensionSeconds').value,limit:+$('extensionLimit').value});config.filterSkills=$('extensionScope').value==='selected'?[...selected]:[];nextInventory=nextSnapshot.options?.ownedOnly?ForgeInventory.parse(data,JSON.parse(JSON.stringify(ctx.inventory.raw||ctx.inventory))):null;}catch(e){$('extensionStatus').textContent=e.message;return;}
 snapshot=nextSnapshot;analysisConfig=config;inventorySnapshot=nextInventory;
 const serial=++generation;closePages();entries=[];groups=[];$('extensionSkeletons').textContent='尚未找到资源骨架';started=Date.now();$('extensionResults').replaceChildren();$('extensionStatus').textContent='准备搜索资源骨架；先满足原目标，再验证额外技能。';$('extensionCount').textContent='0 个扩展组';$('extensionTimer').textContent='0s';controls(true);
 clock=setInterval(()=>$('extensionTimer').textContent=Math.floor((Date.now()-started)/1000)+'s',250);
 const embedded=$('embeddedExtensionWorker'),wasm=$('embeddedWasm'),source=embedded?URL.createObjectURL(new Blob([new TextDecoder().decode(Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0)))],{type:'text/javascript'})):null,wasmBinary=wasm?Uint8Array.from(atob(wasm.textContent.trim()),c=>c.charCodeAt(0)):null;
 try{job=ForgeExtensions.create({data,request:snapshot,inventory:ctx.inventory,initialResults:ctx.initialResults,config,createWorker:()=>{const w=new Worker(source||'./extension-worker.js');if(wasmBinary){const send=w.postMessage.bind(w);w.postMessage=m=>send({...m,wasmBinary});}return w;},onProgress:p=>{if(serial!==generation)return;if(p.phase==='frontier'){entries=p.entries;render();}if(p.phase==='skeleton')$('extensionSkeletons').textContent='已保留 '+p.skeletonCount+' 个骨架候选';if(p.message)$('extensionStatus').textContent=p.message;}});
  job.promise.then(async out=>{if(serial!==generation)return;job=null;entries=out.entries;clearInterval(clock);controls(false);render();$('extensionTimer').textContent=(out.elapsedMs/1000).toFixed(1)+'s';
   const prefix=out.reason==='cancel'?'已停止。':out.complete?'当前候选模型内分析完成。':'本轮骨架分析结束，尚未证明全局扩展列表完整。';
   $('extensionStatus').textContent=prefix+(entries.length?'已发现 '+groups.length+' 个资源模板；显示通过技能筛选的组合，待验证模板不代表不可行。':out.complete&&out.baseline?'原目标可满足，但没有可增加的等级。':out.complete?'当前模型下原目标不可行。':'本轮尚未找到可校验的额外技能组合，可增加分析时限。')+(out.errors.length?' 部分线程异常：'+out.errors.join('；'):'')+' 分析使用开始时的01～04条件快照。';
   if(source)URL.revokeObjectURL(source);
   for(let i=0;i<groups.length&&serial===generation;i++)if(groups[i].generic){if(analysisConfig.filterSkills.length&&!singlePosition(groups[i]))await expand(i);else if(singlePosition(groups[i]))while(serial===generation&&!job&&!groups[i].finished&&!groups[i].failed)await expand(i);}
  });
 }catch(e){job=null;clearInterval(clock);controls(false);$('extensionStatus').textContent=e.message;if(source)URL.revokeObjectURL(source);}
}
root.ForgeExtensionUI={initialize,isRunning:()=>!!job||pageRequests.size>0,stop};
})(globalThis);
