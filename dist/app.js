'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,worker,busy=false,clock,started,activeRequest,found=[],state={weaponId:'LongSword:302',rampageDecorationId:0,skills:[{id:0,level:7},{id:5,level:7},{id:7,level:3},{id:6,level:3},{id:205,level:1}],options:{sex:'MaleOnly',rank:'all',augment:true,deleteSkills:true,seconds:45,limit:3,fixedCharms:true,noCharm:false}};
let modTemplate=null,pendingModExport=null,resultPage=0,lastResultsRender=0,armorEditor=null;
const PAGE_SIZE=8;
let pendingShareImage=null,shareGeneration=0,planReadGeneration=0;
const skill=id=>data.skills.find(s=>s.id===+id);
function slotsHTML(slots,empty=true){return '<span class="slots">'+(empty?[...slots,0,0,0].slice(0,3):slots).map(v=>'<span class="slot l'+v+(!v?' empty':'')+'" title="'+(v?v+'级孔':'无孔位')+'">'+(v||'–')+'</span>').join('')+'</span>';}
function save(){try{localStorage.setItem('sunbreak-forge-v1',JSON.stringify(state));}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2800);}
function changed(){save();if(found.length&&!busy){$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='搜索条件已更改。下方保留上次结果，点击“开始配装”更新。';}}
function syncOptions(){for(const id of ['sex','rank','seconds','limit','searchMode','resultSort'])$(id).value=String(state.options[id]);for(const id of ['augment','deleteSkills','noCharm','fixedCharms','defenseFallback'])$(id).checked=state.options[id];syncSearchMode();renderFixed();syncOwnedMode();}
function renderWeapons(keep=true){
 if(state.options.ownedOnly&&(!inventoryStock||state.ownedInventoryId!==inventoryStock.id)){renderOwnedWeapons();$('weaponSummary').textContent='请导入条件对应的库存快照，或重新选择使用当前装备箱';$('solve').disabled=true;return;}
 const type=$('weaponType').value;const query=$('weaponSearch').value.trim().toLowerCase();const rarity=$('rarity').value;
 const weapons=data.weapons.filter(w=>w.type===type&&(!state.options.ownedOnly||inventoryStock?.entries.some(e=>e.kind==='weapon'&&e.usable&&e.base.id===w.id))&&(rarity==='all'||w.rarity===+rarity)&&(!query||w.name.toLowerCase().includes(query)||w.nameEn.toLowerCase().includes(query)));
 $('weaponSelect').innerHTML=weapons.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.name)+'</option>').join('');
 if(keep&&weapons.some(w=>w.id===state.weaponId))$('weaponSelect').value=state.weaponId;
 if(!weapons.length){$('weaponSelect').innerHTML='<option>未找到符合条件的武器</option>';$('weaponSummary').innerHTML='<span class="muted">试试其他名称，或选择“全部阶段”。</span>';$('solve').disabled=true;$('rampageSelect').disabled=true;return;}
 $('solve').disabled=busy;renderWeapon();
}
function renderWeapon(){
 const w=data.weapons.find(w=>w.id===$('weaponSelect').value);if(!w)return;const switched=state.weaponId!==w.id;state.weaponId=w.id;
 if(switched){$('rampageSearch').value='';const d=data.rampageDecorations.find(d=>d.gameId===state.rampageDecorationId);if(d&&d.slot>ForgeMod.rampageSlot(data,w,modTemplate)){state.rampageDecorationId=0;toast('当前武器的百龙孔放不下原百龙珠，已改为空置');}}
 $('weaponSummary').innerHTML='<div class="weapon-name">'+esc(w.name)+'<span class="rarity">RARE '+w.rarity+'</span></div><div class="weapon-stats"><span>攻击 <b>'+w.attack+'</b></span><span>会心 <b>'+w.affinity+'<small>%</small></b></span>'+slotsHTML(w.slots)+'</div>';
 renderOwnedWeapons();renderRampage();
}
function renderRampage(keep=true){
 const w=data.weapons.find(w=>w.id===state.weaponId);if(!w)return;
 if(state.options.ownedOnly){const e=inventoryWeapon(),slot=ForgeMod.rampageSlot(data,w,e?{inventoryList:[e.item]}:null),id=inventoryRampage(),d=data.rampageDecorations.find(d=>d.gameId===id);$('rampageSelect').innerHTML='<option value="'+id+'">'+esc(d?.name||'空置百龙孔')+'</option>';$('rampageSelect').value=String(id);$('rampageSelect').disabled=true;$('rampageSearch').disabled=true;$('rampageHint').textContent='百龙孔 '+slot+'级 · 已有模式保留该武器当前百龙珠。';return;}
 $('rampageSearch').disabled=busy;
 const slot=ForgeMod.rampageSlot(data,w,modTemplate),query=$('rampageSearch').value.trim(),selected=state.rampageDecorationId;
 const choices=data.rampageDecorations.filter(d=>d.slot<=slot&&(!query||d.name.includes(query))).sort((a,b)=>a.slot-b.slot||a.gameId-b.gameId);
 let html=query?'':'<option value="-1">未指定（沿用 Mod 模板）</option><option value="0">空置百龙孔</option>';
 html+=choices.map(d=>'<option value="'+d.gameId+'">'+esc(d.name)+'</option>').join('');
 const current=data.rampageDecorations.find(d=>d.gameId===selected);
 if(keep&&current&&!choices.some(d=>d.gameId===selected))html+='<option value="'+selected+'" disabled>'+esc(current.name)+(current.slot>slot?'（孔位不足）':'（当前选择）')+'</option>';
 if(!html)html='<option value="-2">未找到可用的百龙珠</option>';
 $('rampageSelect').innerHTML=html;$('rampageSelect').value=String(keep?(selected??-1):(choices[0]?.gameId??(query?-2:0)));
 $('rampageSelect').disabled=busy||!!(query&&!choices.length&&!keep);
 $('rampageHint').textContent='百龙孔 '+slot+' 级'+(slot>(w.rampageSlot||0)?'（原生 '+(w.rampageSlot||0)+' 级＋模板扩孔）':'')+' · 百龙珠不参与目标技能求解。'+(current&&current.slot>slot?'当前选择放不下，请更换百龙珠或导入含扩孔的模板。':'');
}
function selectRampage(){
 const id=+$('rampageSelect').value;if(id===-2)return;
 if(id===-1)delete state.rampageDecorationId;else state.rampageDecorationId=ForgeConfig.validateRampageId(data,id);
 if(!activeRequest?.options?.ownedOnly&&activeRequest?.weaponId===state.weaponId){if(id===-1)delete activeRequest.rampageDecorationId;else activeRequest.rampageDecorationId=state.rampageDecorationId;if(found.length)renderResults();}
 save();renderRampage();
}
function renderTargets(){
 $('targetSkills').innerHTML=state.skills.length?state.skills.map(r=>{const s=skill(r.id);return '<div class="target-row"><span class="target-label" title="'+esc(s.description)+'">'+esc(s.name)+'<small>MAX '+s.max+'</small></span><div class="level-control"><button data-level="'+s.id+'" data-delta="-1" aria-label="降低'+esc(s.name)+'等级" '+(r.level===1?'disabled':'')+'>−</button><strong>'+r.level+'</strong><button data-level="'+s.id+'" data-delta="1" aria-label="提高'+esc(s.name)+'等级" '+(r.level===s.max?'disabled':'')+'>＋</button></div><button class="remove-skill" data-remove="'+s.id+'" aria-label="移除'+esc(s.name)+'">×</button></div>';}).join(''):'<p class="empty-targets">添加你想要的技能，或载入通用物理预设。</p>';
 $('targetCount').textContent=state.skills.reduce((a,s)=>a+s.level,0);$('sortSkills').disabled=busy||state.skills.length<2;if(busy)$('targetSkills').querySelectorAll('button').forEach(b=>b.disabled=true);
}
function renderPicker(){
 const q=$('skillSearch').value.trim().toLowerCase();const selected=new Set(state.skills.map(s=>s.id));
 const skills=data.skills.filter(s=>!q||s.name.includes(q)||s.nameEn.toLowerCase().includes(q));
 $('skillPicker').innerHTML=skills.map(s=>'<button class="picker-item'+(selected.has(s.id)?' selected':'')+'" data-skill="'+s.id+'" title="'+esc(s.description)+'"><span class="picker-name">'+esc(s.name)+'</span><span class="picker-meta">最高 '+s.max+' 级 · '+(s.cost!=null?'炼成cost '+s.cost:'无新增炼成词条')+'</span>'+(selected.has(s.id)?'<span class="picker-selected">✓</span>':'')+'</button>').join('');
 $('pickerCount').textContent='已选 '+state.skills.length+' 项技能 · 共 '+skills.length+' 项匹配';
}
function setBusy(value){
 busy=value;document.querySelectorAll('.controls input,.controls select,.controls button').forEach(x=>x.disabled=value);$('importPlan').disabled=value;$('importMod').disabled=value;$('clearMod').disabled=value;$('solve').disabled=value;$('cancel').disabled=false;$('cancel').classList.toggle('hidden',!value);$('solve').querySelector('span').textContent=value?'正在寻找配装…':'开始配装';if(!value){renderTargets();$('deleteSkills').disabled=!$('augment').checked;$('defenseFallback').disabled=!$('augment').checked;syncSearchMode();renderRampage();syncOwnedMode();}
}
function augmentedLabel(atom){
 const n=atom.value*atom.count;
 if(atom.skillId!=null)return esc(skill(atom.skillId).name)+' '+(n>0?'+':'−')+Math.abs(n)+(atom.count>1?' · '+atom.count+'条':'');
 const raw=data.atoms.find(x=>x.id===atom.atomId);
 if(raw?.category===19)return '孔位增长 +'+n;
 const names={defense:'防御',fire:'火耐性',water:'水耐性',thunder:'雷耐性',ice:'冰耐性',dragon:'龙耐性'};
 const attribute=atom.attribute||(raw?.category===13?'defense':['fire','water','thunder','ice','dragon'][Math.floor(((raw?.id||0)-89)/10)]);
 return (names[attribute]||'属性')+' '+(n>0?'+':'−')+Math.abs(n)+(atom.count>1?' · '+atom.count+'条':'');
}
function renderResult(r,index){
 const req=new Set(activeRequest.skills.map(s=>s.id));const weapon=data.weapons.find(w=>w.id===r.weaponId);const names=Object.fromEntries(r.pieces.map(p=>[p.id,p.name]));names[weapon.id]=weapon.name;names.charm=r.charm.name;
 let html='<article class="result-card"><div class="result-card-head"><span class="result-number">'+String(index+1).padStart(2,'0')+'</span><div><h3>可行配装方案</h3><span class="verified">'+(r.owned?'✓ 已有装备索引、实际炼化与珠子库存校验通过':r.presetEquipment?'✓ 预设装备、技能与逐孔插珠校验通过':'✓ 炼化预算、技能与插珠校验通过')+'</span></div><div class="result-export-actions"><button class="export-result" data-share-image="'+index+'">截图分享</button><button class="export-result" data-lock-result="'+index+'">固定这套装备</button><button class="export-result" data-export="'+index+'">导出 JSON ↓</button><button class="export-result export-mod" data-export-mod="'+index+'">Mod 导出 ↓</button></div></div>';
 html+='<div class="result-metrics"><span><b>'+r.defense+'</b>基础防御</span><span><b>'+r.records+'</b>炼化词条</span><span><b>'+(r.skillAdds||0)+'</b>新增技能等级</span><span title="只合计新增技能正cost，不含孔位和负面词条"><b>'+(r.skillAddCost||0)+'</b>新增技能cost</span><span><b>'+r.decoCount+'</b>珠子</span><span><b>'+r.unusedSlots.length+'</b>空余孔位</span></div><div class="result-main">';
 html+='<div class="equip-row"><div class="equip-line"><span class="equip-part">武器</span><div class="equip-content"><div class="equip-name">'+esc(weapon.name)+'</div><div class="equip-sub">'+esc(weapon.typeName)+' · 使用原生孔位</div><div class="equip-sub">百龙珠：'+esc(ForgeConfig.rampageLabel(data,activeRequest))+'</div></div>'+slotsHTML(weapon.slots)+'</div></div>';
 for(const p of r.pieces){
  const score=r.scores?.[p.id];const native=p.skills.map(s=>esc(skill(s.skill_id).name)+' '+s.level).join(' / ');
  html+='<div class="equip-row"><div class="equip-line"><span class="equip-part">'+ForgeEngine.PART_NAMES[p.part]+'</span><div class="equip-content"><div class="equip-name">'+esc(p.name)+(p.ownedRef?'<span class="fixed-badge">箱位 '+(p.ownedRef.index+1)+'</span>':'')+(activeRequest.options?.fixedArmors?.[p.part]?'<span class="fixed-badge">已固定</span>':'')+'</div><div class="equip-sub">'+native+'</div></div>'+slotsHTML(p.slots)+'</div>';
  if((p.owned||p.preset)&&p.records)html+='<div class="augment-list">'+p.atoms.slice().sort((a,b)=>a.atomId-b.atomId).map(a=>'<span class="augment'+(a.value<0?' negative':'')+'">'+augmentedLabel(a)+'</span>').join('')+'</div>';
  else if(p.records)html+='<details open><summary><span class="budget"><span>炼化 '+p.records+' / 7条</span><span>cost '+p.cost+' / '+p.budget+'</span><span>新增 '+p.additions+' / '+(activeRequest.options?.augmentLimits?.[p.part]??7)+'条</span>'+(score?'<span>原生等效 '+(score.native+score.slot).toFixed(1)+'</span>':'')+'</span></summary><div class="augment-list">'+[...p.atoms].sort((a,b)=>a.atomId-b.atomId).map(a=>'<span class="augment'+(a.value<0?' negative':'')+'">'+(a.fallback?'防御兜底 · ':'')+augmentedLabel(a)+'</span>').join('')+'</div></details>';
  else html+='<div class="aug-empty">无需炼化'+(score?' · 原生等效 '+(score.native+score.slot).toFixed(1):'')+'</div>';
  if(p.fallback)html+='<div class="aug-empty">自由 '+p.fallback.freeRecords+' / 6条 · 兜底前预算 '+p.fallback.before+' → '+p.fallback.after+' · '+(p.fallback.effect?'末条防御 +'+p.fallback.effect.value:'末条留空，防御不变')+'</div>';
  html+='</div>';
 }
 html+='<div class="equip-row"><div class="equip-line"><span class="equip-part">护石</span><div class="equip-content"><div class="equip-name">'+esc(r.charm.name)+'</div><div class="equip-sub">'+r.charm.skills.map(s=>esc(skill(s.skill_id).name)+' '+s.level).join(' / ')+'</div>'+(r.charm.fixed?'<div class="equip-sub">特典条件：'+esc(r.charm.acquisition?.name||'根据存档确认')+'</div>':'')+'</div>'+slotsHTML(r.charm.slots)+'</div></div>';
 const all=Object.entries(r.totals).filter(([id,v])=>v>0).map(([id,v])=>({id:+id,level:Math.min(v,skill(id).max)})).sort(ForgeConfig.compareSkills);
 html+='<div class="result-skills"><h4 class="mini-heading"><span>最终技能</span><span>目标 '+activeRequest.skills.length+' / '+activeRequest.skills.length+' 项达成</span></h4><div class="skill-badges">'+all.map(({id,level})=>{const s=skill(id);return '<span class="skill-badge'+(req.has(id)?'':' extra')+'" title="'+esc(s.description)+'">'+esc(s.name)+'<b>'+level+'</b></span>';}).join('')+'</div></div>';
 html+='<div class="deco-section"><h4 class="mini-heading"><span>装饰品</span><span>'+r.decoCount+' 颗</span></h4><div class="deco-list">'+(r.decorations.length?r.decorations.map(x=>{const d=data.decorations.find(d=>d.id===x.id);return '<span class="deco-chip">'+esc(d.name)+' × '+x.count+'</span>';}).join(''):'<span class="muted small">无需额外珠子</span>')+'</div><details class="placement"><summary>查看逐孔插法与空余孔位</summary>';
 const owners=[weapon.id,...r.pieces.map(p=>p.id),'charm'];
 for(const owner of owners){const ps=r.placement.filter(p=>p.owner===owner);if(!ps.length)continue;html+='<div class="placement-row"><strong>'+esc(names[owner])+'</strong><span>'+ps.map(p=>{const d=data.decorations.find(d=>d.id===p.decorationId);return p.level+'级孔 → '+(d?esc(d.name):'空');}).join('　/　')+'</span></div>';}
 html+='</details></div><p class="result-foot">基础防御含武器加成和炼化变化，不含铠玉强化。该方案保证可行，不代表全局最优。'+(r.stormsoulConservative?'风雷合一额外技能加成未计入。':'')+'</p></div></article>';
 $('results').insertAdjacentHTML('beforeend',html);$('resultCount').textContent=found.length;
}
function finish(){renderResults();clearInterval(clock);setBusy(false);$('progress').classList.add('hidden');if(worker){worker.terminate();worker=null;}}
function start(){
 try{state=ForgeConfig.normalize(data,state);if(state.options.ownedOnly)ForgeInventory.validateQuery(data,inventoryStock,state);else ForgeEngine.validateRequest(data,state);delete state.options.presetEquipment;const w=data.weapons.find(w=>w.id===state.weaponId),d=data.rampageDecorations.find(d=>d.gameId===state.rampageDecorationId);if(!state.options.ownedOnly&&d&&d.slot>ForgeMod.rampageSlot(data,w,modTemplate))throw new Error('当前百龙孔放不下'+d.name+'，请更换百龙珠或导入含扩孔的模板');}catch(e){toast((state.options.presetEquipment?'预设固定炼化不符合普通搜索条件，可解除固定后重试：':'')+e.message);return;}
 activeRequest=JSON.parse(JSON.stringify(state));found=[];resultPage=0;lastResultsRender=0;$('resultPagination').classList.add('hidden');$('results').replaceChildren();$('resultCount').textContent='0';$('empty').classList.add('hidden');$('statusMessage').classList.add('hidden');$('progress').classList.remove('hidden');$('progressTitle').textContent='准备求解…';$('progressDetail').textContent='整理目标技能与合法候选';started=Date.now();$('timer').textContent='0s';setBusy(true);clock=setInterval(()=>$('timer').textContent=Math.floor((Date.now()-started)/1000)+'s',250);
 const embeddedWorker=$('embeddedWorker'),embeddedWasm=$('embeddedWasm');
 let sourceURL;
 if(embeddedWorker){const bytes=Uint8Array.from(atob(embeddedWorker.textContent.trim()),c=>c.charCodeAt(0));sourceURL=URL.createObjectURL(new Blob([new TextDecoder().decode(bytes)],{type:'text/javascript'}));}
 const wasmBinary=embeddedWasm?Uint8Array.from(atob(embeddedWasm.textContent.trim()),c=>c.charCodeAt(0)):null;
 let job;
 job=ForgePool.create({data,request:activeRequest,inventory:inventoryStock?.raw,workerCount:2,createWorker:()=>{
  const current=new Worker(sourceURL||'./worker.js');
  if(!wasmBinary)return current;
  const send=current.postMessage.bind(current);current.postMessage=message=>send({...message,wasmBinary});return current;
 },onProgress:p=>{
  if(p.phase==='result'){const existing=found.findIndex(r=>ForgeEngine.resultIdentity(r)===ForgeEngine.resultIdentity(p.result));if(existing<0)found.push(p.result);else if(ForgeEngine.compareResults(p.result,found[existing],activeRequest.options.resultSort)<0)found[existing]=p.result;if(Date.now()-lastResultsRender>250)renderResults();}
  if(p.message)$('progressTitle').textContent='计算 '+(p.workerIndex+1)+' / 2 · '+p.message;
  if(p.phase==='model')$('progressDetail').textContent='双Worker · 第'+p.stage+'轮 · '+p.armors+'件防具 · '+p.charms+'枚护石候选';
  if(p.phase==='solve')$('progressDetail').textContent='双Worker整数求解 · 当前模型 '+p.variables.toLocaleString()+'个决策变量';
 }});
 worker={terminate:()=>job.cancel()};
 job.promise.then(r=>{
  if(sourceURL)URL.revokeObjectURL(sourceURL);
  if(worker?.jobId!==job)return;found=r.results;finish();$('statusMessage').classList.remove('hidden');
  $('statusMessage').textContent=(r.results.length?'已找到 '+r.results.length+' 套可行方案 · 用时 '+(r.elapsedMs/1000).toFixed(1)+' 秒 · '+r.workerCount+'个Worker · 每套均已重新校验。'+(r.domainExhausted?'当前可搜索的组合已枚举完毕。':''):'本次搜索尚未找到可行方案。可延长时限或检查技能目标；这不表示全局无解。')+(r.errors.length?' '+r.errors.join('；'):'');
  if(!found.length)$('empty').classList.remove('hidden');
 });
 worker.jobId=job;
}
function downloadJSON(filename,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function exportResult(index){downloadJSON('sunbreak-loadout-'+(index+1)+'.json',{...ForgeConfig.payload(data,activeRequest),dataVersion:data.meta.version,result:found[index]});}
function closeShareImage(){shareGeneration++;if(pendingShareImage?.url)URL.revokeObjectURL(pendingShareImage.url);pendingShareImage=null;$('shareImagePreview').src='';}
async function shareResult(index){
 const source=found[index];if(!source){toast('该方案已更新，请重新选择');return;}
 closeShareImage();const generation=shareGeneration,request=JSON.parse(JSON.stringify(activeRequest)),result=JSON.parse(JSON.stringify(source));
 $('shareImagePreview').classList.add('hidden');$('shareImageError').classList.add('hidden');$('sharePlanCode').value='';$('downloadShareImage').disabled=true;$('copyPlanCode').disabled=true;$('shareImageStatus').textContent='正在生成完整图片与方案二维码…';$('shareImageDialog').showModal();
 try{
  if(request.options?.ownedOnly)ForgeInventory.validateResult(data,inventoryStock,request,result);
  const shared=await ForgeShare.encode(data,request,result);if(document.fonts?.ready)await document.fonts.ready;
  if(generation!==shareGeneration)return;const image=ForgeShare.renderImage(data,shared),blob=await new Promise((resolve,reject)=>image.canvas.toBlob(b=>b?resolve(b):reject(new Error('浏览器无法生成图片')),'image/png'));
  if(generation!==shareGeneration)return;const url=URL.createObjectURL(blob);pendingShareImage={blob,url,shared};$('shareImagePreview').src=url;$('shareImagePreview').classList.remove('hidden');$('sharePlanCode').value=shared.token;$('downloadShareImage').disabled=false;$('copyPlanCode').disabled=false;
  $('shareImageStatus').textContent='完整分享图 '+image.width+' × '+image.height+' · 方案 '+shared.id.slice(0,16)+' · 右下角二维码可独立恢复方案'+(request.options?.ownedOnly?' · 已转为不依赖库存的预设装备方案':'');
 }catch(e){if(generation!==shareGeneration)return;$('shareImageError').textContent=e.message;$('shareImageError').classList.remove('hidden');$('shareImageStatus').textContent='生成失败，请重试或使用方案JSON分享。';}
}
function openPlanImport(){
 if(busy){toast('请先停止搜索再导入');return;}planReadGeneration++;$('planText').value='';$('planFile').value='';$('planFileStatus').textContent='';$('planError').classList.add('hidden');$('applyPlan').disabled=false;
 $('planSummary').textContent='恢复具体装备、炼化、护石与插珠，直接显示已校验方案；同时固定装备与炼化，便于继续修改。';$('planDialog').showModal();
}
async function readPlanFile(file){
 const generation=++planReadGeneration;$('applyPlan').disabled=true;$('planError').classList.add('hidden');$('planFileStatus').textContent='正在读取并校验方案…';
 try{
  const text=await ForgeShare.readFile(file),shared=await parsePlanText(text);if(generation!==planReadGeneration)return;
  $('planText').value=shared.token;$('planSummary').textContent=data.weapons.find(w=>w.id===shared.result.weaponId).name+'\n'+shared.result.pieces.map(p=>p.name).join(' / ')+'\n方案指纹：'+shared.id.slice(0,16);$('planFileStatus').textContent='已识别并校验，点击“导入并显示方案”完成导入。';
 }catch(e){if(generation!==planReadGeneration)return;$('planError').textContent=e.message;$('planError').classList.remove('hidden');$('planFileStatus').textContent='读取失败，可重新选择图片或粘贴方案码。';}
 finally{if(generation===planReadGeneration)$('applyPlan').disabled=false;}
}
async function applyPlan(){
 if(busy){toast('请先停止搜索再导入');return;}const generation=++planReadGeneration;$('applyPlan').disabled=true;$('planError').classList.add('hidden');
 try{
  const shared=await parsePlanText($('planText').value);if(generation!==planReadGeneration)return;
  state=shared.request;activeRequest=JSON.parse(JSON.stringify(state));found=[shared.result];resultPage=0;
  const w=data.weapons.find(w=>w.id===state.weaponId);$('weaponType').value=w.type;$('rarity').value=w.rarity===10?'10':'all';$('weaponSearch').value='';syncOptions();renderWeapons();renderTargets();renderResults();save();$('empty').classList.add('hidden');$('progress').classList.add('hidden');$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='已导入并校验方案 '+shared.id.slice(0,16)+'；装备、炼化和护石已固定，可直接查看或继续修改。';$('planDialog').close();toast('已恢复同一套方案，无需重新搜索');
 }catch(e){if(generation!==planReadGeneration)return;$('planError').textContent=e.message;$('planError').classList.remove('hidden');}
 finally{if(generation===planReadGeneration)$('applyPlan').disabled=false;}
}
function renderModTemplate(){
 renderFixed();renderRampage();
 $('clearMod').classList.toggle('hidden',!modTemplate);
 const w=modTemplate&&data.weapons.find(w=>ForgeMod.equipmentToGame(w.id)===modTemplate.inventoryList[0].IdVal);
 $('modTemplateStatus').textContent=modTemplate?'当前模板：'+modTemplate.mySetInfo.Name+' · '+w.typeName+'。可导出同类型武器的配装。':'导入同武器类型的模板后，可将计算结果导出到游戏。';
}
function openModImport(){if(busy){toast('请先停止搜索再导入');return;}importFiles.mod.reset();$('modText').value='';$('modError').classList.add('hidden');$('modDialog').showModal();$('modText').focus();}
function applyMod(mode){
 try{
  if(busy)throw new Error('请先停止搜索再导入');
  const imported=ForgeMod.importInto(data,state,$('modText').value,mode,ForgeEngine);
  // Parse everything before applying either state, so failures never replace a template.
  modTemplate=imported.template;
  state=imported.state;const w=data.weapons.find(w=>w.id===state.weaponId);$('weaponType').value=w.type;$('rarity').value=w.rarity===10?'10':'all';$('weaponSearch').value='';syncOptions();renderWeapons();renderTargets();changed();
  let stored=true;try{localStorage.setItem('sunbreak-forge-mod-template-v1',JSON.stringify(modTemplate));}catch{stored=false;}
  renderModTemplate();$('modDialog').close();toast((mode==='full'?'已同步武器与'+state.skills.length+'项技能，并保存模板':'已保存模板并同步武器，目标技能和搜索选项保持当前值')+(stored?'':'；本次会话有效，浏览器存储空间不足'));
  const notes=[...(imported.loadout?.warnings||[])];if(imported.loadout?.stormsoul)notes.push('已将风雷合一的防具原生技能加成同步为目标等级；当前求解仍按基础技能等级搜索，可能偏保守。');
  if(notes.length){$('statusMessage').classList.remove('hidden');$('statusMessage').textContent=notes.join('；');}
 }catch(e){$('modError').textContent=e.message;$('modError').classList.remove('hidden');}
}
function exportMod(index){
 try{
  if(!modTemplate)throw new Error('请先粘贴导入一份同武器类型的Mod模板');
  if(!found[index])throw new Error('该配装结果已更新，请重新选择');
  const weapon=data.weapons.find(w=>w.id===found[index].weaponId),source=data.weapons.find(w=>ForgeMod.equipmentToGame(w.id)===modTemplate.inventoryList[0].IdVal);
  if(weapon.type!==source.type)throw new Error('请先导入'+weapon.typeName+'模板后再导出');
  pendingModExport={template:modTemplate,result:found[index],request:activeRequest,index:index+1};
  $('ownedExportSlotWrap').classList.remove('hidden');$('ownedExportSlot').value=String(index+1);
  $('modExportName').value=((modTemplate.mySetInfo.Name.trim()||'工房配装')+' · '+(index+1)).slice(0,70);$('modExportError').classList.add('hidden');$('modExportDialog').showModal();$('modExportName').focus();
 }
 catch(e){toast(e.message);if(!modTemplate&&!busy)openModImport();}
}
function confirmModExport(){
 try{
  if(!pendingModExport)throw new Error('请重新选择要导出的配装');
  const p=pendingModExport,out=p.request.options.ownedOnly?ForgeInventory.exportPlan(data,inventoryStock,p.template,p.result,p.request,{index:+$('ownedExportSlot').value,name:$('modExportName').value}):ForgeMod.exportLoadout(data,p.template,p.result,p.request,ForgeEngine,{index:+$('ownedExportSlot').value,name:$('modExportName').value});
  downloadJSON(out.filename,out.payload);$('modExportDialog').close();pendingModExport=null;toast('已下载 '+out.filename+'，请放入 '+out.directory);
 }catch(e){$('modExportError').textContent=e.message;$('modExportError').classList.remove('hidden');}
}

function syncSearchMode(){
 $('limit').disabled=busy||state.options.searchMode==='time';
 $('searchModeHint').textContent=state.options.searchMode==='time'?'双路计算先寻找可行配装，再优先优化下方排序指标；忽略方案数量上限，超时不保证全局最优。':'达到指定数量或时限后结束。';
}
function renderResults(){
 lastResultsRender=Date.now();found.sort((a,b)=>ForgeEngine.compareResults(a,b,state.options.resultSort));
 const pages=Math.max(1,Math.ceil(found.length/PAGE_SIZE));resultPage=Math.max(0,Math.min(resultPage,pages-1));
 $('results').replaceChildren();found.slice(resultPage*PAGE_SIZE,(resultPage+1)*PAGE_SIZE).forEach((r,i)=>renderResult(r,resultPage*PAGE_SIZE+i));
 $('resultCount').textContent=found.length;$('resultPagination').classList.toggle('hidden',found.length<=PAGE_SIZE);
 $('resultPageInfo').textContent='第 '+(resultPage+1)+' / '+pages+' 页 · 共 '+found.length+' 套';$('previousResults').disabled=resultPage===0;$('nextResults').disabled=resultPage>=pages-1;
}
function renderFixed(){
 const fixed=state.options.fixedArmors||{},limits=state.options.augmentLimits||{};
 $('fixedEquipment').innerHTML=ForgeEngine.PARTS.map(part=>{
  const owned=state.options.ownedOnly&&inventoryStock?.byKey.get(state.ownedArmorKeys?.[part]),p=owned?{id:owned.base.id}:fixed[part],a=p&&data.armors.find(a=>a.id===p.id),count=Array.isArray(p?.atoms)?p.atoms.reduce((n,t)=>n+t.count,0):0;
  return '<div class="fixed-row"><div class="fixed-row-head"><strong>'+ForgeEngine.PART_NAMES[part]+'</strong><button class="text-button" data-edit-armor="'+part+'">'+(a?'编辑固定':'指定装备')+'</button>'+(a?(Array.isArray(p.atoms)?'<button class="text-button" data-unlock-augment="'+part+'">解除炼化固定</button>':'')+'<button class="text-button" data-unlock-armor="'+part+'">解除装备固定</button>':'')+'</div><div class="fixed-name">'+(owned?esc(owned.name)+' · 固定库存箱位 '+(owned.index+1):a?esc(a.name)+(Array.isArray(p.atoms)?(count?' · 固定'+count+'条炼化':' · 固定为无炼化'):' · 炼化自动搜索'):'自动选择装备与炼化')+'</div><label class="fixed-limit">最多新增正面词条<select data-augment-limit="'+part+'" aria-label="'+ForgeEngine.PART_NAMES[part]+'最多新增正面词条">'+Array.from({length:8},(_,n)=>'<option value="'+n+'" '+((limits[part]??7)===n?'selected':'')+'>'+n+'条</option>').join('')+'</select></label></div>';
 }).join('');
 const ownedCharm=state.options.ownedOnly&&inventoryStock?.byKey.get(state.ownedCharmKey),c=ownedCharm?.charm||state.options.fixedCharm;$('fixedCharmSummary').textContent=c?'已固定：'+c.skills.map(s=>skill(s.skill_id).name+' '+s.level).join(' / ')+' · 孔位 '+(c.slots.join('-')||'无'):'护石由工房搜索';
 $('clearCharm').classList.toggle('hidden',!c);$('lockModEquipment').disabled=busy||!modTemplate;
}
function armorChoices(){
 return data.armors.filter(a=>a.part===armorEditor.part&&!(state.options.sex==='MaleOnly'&&a.sex==='FemaleOnly')&&!(state.options.sex==='FemaleOnly'&&a.sex==='MaleOnly')&&!(state.options.rank==='Master'&&a.rank!=='Master'));
}
function renderArmorChoices(){
 const q=$('armorSearch').value.trim().toLowerCase(),available=armorChoices().filter(a=>!q||a.name.toLowerCase().includes(q));
 const next=available.some(a=>a.id===armorEditor.id)?armorEditor.id:(available[0]?.id||'');
 if(next!==armorEditor.id){armorEditor.id=next;armorEditor.atoms=[];}
 $('armorSelect').innerHTML=available.length?available.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+' · RARE '+a.rarity+'</option>').join(''):'<option value="">没有匹配防具</option>';
 $('armorSelect').value=armorEditor.id;$('armorSelect').disabled=!available.length;renderArmorEditor();
}
function atomChoices(a){
 const result=[];
 for(const raw of data.atoms.filter(x=>x.pool===a.pool)){
  if(!ForgeEngine.isOrdinaryAtom(raw)&&!(state.options.defenseFallback&&ForgeEngine.isDedicatedFallback(raw)))continue;
  if(raw.category===20){
   if(a.pool===13)continue;
   const skills=raw.cost<0?a.skills.map(s=>skill(s.skill_id)):data.skills.filter(s=>s.cost===raw.cost);
   for(const s of skills){const value=raw.cost<0?-1:1;result.push({atom:{atomId:raw.id,skillId:s.id,value,count:1},label:s.name+' '+(value>0?'+1':'−1')+' · cost '+raw.cost});}
  }else if([13,14,19].includes(raw.category))for(const v of raw.values){
   const atom={atomId:raw.id,value:v.value,valueIndex:v.value_index,count:1};
   if(raw.category===13)atom.attribute='defense';
   if(raw.category===14)atom.attribute=['fire','water','thunder','ice','dragon'][Math.floor((raw.id-89)/10)];
   const names={fire:'火耐性',water:'水耐性',thunder:'雷耐性',ice:'冰耐性',dragon:'龙耐性',defense:'防御'};
   result.push({atom,label:(ForgeEngine.isDedicatedFallback(raw)?'兜底专用 · ':'')+(raw.category===19?'孔位增长':names[atom.attribute])+' '+(v.value>0?'+':'')+v.value+' · cost '+raw.cost});
  }
 }
 return result;
}
function renderArmorEditor(){
 const a=data.armors.find(a=>a.id===armorEditor.id);$('saveArmor').disabled=!a;
 const fixedAugment=$('fixArmorAugment').checked;$('armorAugmentFields').classList.toggle('hidden',!fixedAugment);
 if(!a){armorEditor.choices=[];$('armorDetails').textContent='没有匹配防具，请修改搜索文字。';$('armorAtoms').innerHTML='';$('addArmorAtom').disabled=true;return;}
 armorEditor.choices=atomChoices(a);
 $('armorDetails').innerHTML='基础防御 '+a.defense+' · 原始孔位 '+(a.slots.join('-')||'无')+' · 炼化预算 '+a.budget+'<br>'+a.skills.map(s=>esc(skill(s.skill_id).name)+' '+s.level).join(' / ');
 $('armorAtoms').innerHTML=armorEditor.atoms.map((t,i)=>{
  const match=armorEditor.choices.findIndex(c=>c.atom.atomId===t.atomId&&c.atom.skillId===t.skillId&&c.atom.value===t.value&&(c.atom.valueIndex??0)===(t.valueIndex??0));
  return '<div class="atom-editor-row"><select data-atom="'+i+'" aria-label="第'+(i+1)+'条炼化">'+armorEditor.choices.map((c,j)=>'<option value="'+j+'" '+(j===match?'selected':'')+'>'+esc(c.label)+'</option>').join('')+'</select><input data-atom-count="'+i+'" type="number" min="1" max="7" value="'+t.count+'" aria-label="词条数量"><button data-remove-atom="'+i+'" aria-label="删除词条">×</button></div>';
 }).join('');$('addArmorAtom').disabled=!fixedAugment||!armorEditor.choices.length||armorEditor.atoms.reduce((n,t)=>n+t.count,0)>=7;
 updateArmorValidation();
}
function updateArmorValidation(){
 const el=$('armorValidation');if(!$('fixArmorAugment').checked){el.textContent='';return;}
 try{const v=ForgeEngine.evaluateArmor(data,state,{id:armorEditor.id,atoms:armorEditor.atoms});el.textContent='校验通过 · '+v.records+' / 7条 · cost '+v.cost+' / '+v.budget;el.classList.remove('error');}
 catch(e){el.textContent=e.message;el.classList.add('error');}
}
function openArmor(part){
 if(busy)return;const fixed=state.options.fixedArmors?.[part];armorEditor={part,id:fixed?.id,atoms:JSON.parse(JSON.stringify(fixed?.atoms||[]))};
 if(!armorEditor.id)armorEditor.id=armorChoices()[0]?.id;if(!armorEditor.id){toast('没有符合当前性别和位阶的防具');return;}
 $('fixArmorAugment').checked=Array.isArray(fixed?.atoms);
 $('equipmentTitle').textContent='指定'+ForgeEngine.PART_NAMES[part]+'与炼化';$('armorSearch').value='';$('equipmentError').classList.add('hidden');renderArmorChoices();$('equipmentDialog').showModal();
}
function acceptArmor(){
 try{
  let p={id:armorEditor.id};ForgeEngine.validateArmorSelection(data,state,p);
  if($('fixArmorAugment').checked){const v=ForgeEngine.evaluateArmor(data,state,{...p,atoms:armorEditor.atoms});p.atoms=v.atoms;}
  delete state.ownedArmorKeys?.[armorEditor.part];state.options.fixedArmors[armorEditor.part]=JSON.parse(JSON.stringify(p));renderFixed();changed();$('equipmentDialog').close();toast(Array.isArray(p.atoms)?'已固定防具与炼化':'已固定防具，炼化自动搜索');
 }catch(e){$('equipmentError').textContent=e.message;$('equipmentError').classList.remove('hidden');}
}
function legalUserCharm(skills,slots){
 if(!skills.length)throw new Error('请至少选择一个护石技能');
 const c={id:'user',name:'指定护石',skills,slots:[...slots].filter(Boolean).sort((a,b)=>b-a)};
 for(const [method,m] of Object.entries(data.melding.methods)){
  const candidate={...c,method,pattern:m.pattern};try{ForgeEngine.validateCharm(data,candidate);return candidate;}catch{}
 }
 // Fixed gifts can have a combination unsupported by random melding.
 for(const f of data.fixedCharms)if(JSON.stringify(f.skills)===JSON.stringify(c.skills)&&JSON.stringify(f.slots)===JSON.stringify(c.slots))return {id:f.id,name:f.name_zh,skills:f.skills,slots:f.slots,fixed:true};
 throw new Error('这组护石技能、等级和孔位不在合法数据支持中');
}
function renderCharmSkillOptions(index){
 const select=$('charmSkill'+index),selected=select.value;
 const query=$('charmSkillSearch'+index).value.trim().toLowerCase();
 const available=[...data.skills].sort((a,b)=>a.id-b.id).filter(s=>!query||s.name.toLowerCase().includes(query)||(s.nameEn||'').toLowerCase().includes(query));
 const next=available.some(s=>String(s.id)===selected)?selected:(query&&available.length?String(available[0].id):'');
 select.innerHTML=available.length?'<option value="">'+(index?'无第二技能':'请选择技能')+'</option>'+available.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join(''):'<option value="">没有匹配技能</option>';
 select.value=next;select.disabled=!available.length;
 $('saveCharm').disabled=[0,1].some(i=>$('charmSkill'+i).disabled);
}
function openCharm(){
 if(busy)return;const c=state.options.fixedCharm;
 $('charmFields').innerHTML=[0,1].map(i=>'<div class="charm-editor-row"><div><label for="charmSkill'+i+'">第'+(i+1)+'技能</label><label class="search-box charm-skill-search"><span>⌕</span><input id="charmSkillSearch'+i+'" data-charm-skill-search="'+i+'" type="search" placeholder="搜索技能中文或英文…" aria-label="搜索护石第'+(i+1)+'技能" autocomplete="off"></label><select id="charmSkill'+i+'"></select></div><label>等级<input id="charmLevel'+i+'" class="charm-level" type="number" min="1" max="7" value="'+(c?.skills[i]?.level||1)+'"></label></div>').join('')+'<div class="charm-slots">'+[0,1,2].map(i=>'<label>第'+(i+1)+'孔<select id="charmSlot'+i+'">'+[0,1,2,3,4].map(n=>'<option value="'+n+'" '+((c?.slots[i]||0)===n?'selected':'')+'>'+(n?n+'级':'无孔')+'</option>').join('')+'</select></label>').join('')+'</div>';
 for(let i=0;i<2;i++){$('charmSkillSearch'+i).value='';$('charmSkill'+i).innerHTML='<option value="">请选择技能</option>'+(c?.skills[i]?'<option value="'+c.skills[i].skill_id+'">'+esc(skill(c.skills[i].skill_id).name)+'</option>':'');$('charmSkill'+i).value=c?.skills[i]?String(c.skills[i].skill_id):'';renderCharmSkillOptions(i);}
 $('charmError').classList.add('hidden');$('charmDialog').showModal();
}
function acceptCharm(){
 try{
  if([0,1].some(i=>$('charmSkill'+i).disabled))throw new Error('没有匹配技能，请先修改搜索文字');
  const skills=[];for(let i=0;i<2;i++){const id=$('charmSkill'+i).value;if(id!=='')skills.push({skill_id:+id,level:+$('charmLevel'+i).value});}
  delete state.ownedCharmKey;state.options.fixedCharm=legalUserCharm(skills,[0,1,2].map(i=>+$('charmSlot'+i).value));state.options.noCharm=false;$('noCharm').checked=false;renderFixed();changed();$('charmDialog').close();
 }catch(e){$('charmError').textContent=e.message;$('charmError').classList.remove('hidden');}
}
function lockResult(index){
 if(busy){toast('请先停止搜索，再固定结果');return;}const r=found[index];if(!r)return;if(r.owned){state.ownedArmorKeys=Object.fromEntries(ForgeEngine.PARTS.map(p=>[p,ForgeInventory.entryKey(r.owned.armors[p].box,r.owned.armors[p].index)]));if(!r.owned.charm.empty)state.ownedCharmKey=ForgeInventory.entryKey(r.owned.charm.box,r.owned.charm.index);renderFixed();changed();toast('已固定这套具体库存实例；03解除对应部位可重新搜索');return;}
 const next=JSON.parse(JSON.stringify(state));next.options.fixedArmors=Object.fromEntries(r.pieces.map(p=>[p.part,{id:p.id,atoms:p.atoms}]));
 if(!r.charm.empty){next.options.fixedCharm=r.charm;next.options.noCharm=false;}else {delete next.options.fixedCharm;next.options.noCharm=true;}
 try{if(r.presetEquipment){next.options.presetEquipment=true;ForgeInventory.validatePreset(data,next,r);}else ForgeEngine.validateRestrictions(data,next);state=ForgeConfig.normalize(data,next);syncOptions();changed();toast('已固定这套防具、炼化和护石');}catch(e){toast(e.message);}
}
function openTemplateLocks(){
 if(!modTemplate){toast('请先导入 Mod 模板');return;}
 $('templateLockChoices').innerHTML=ForgeEngine.PARTS.map((part,i)=>{const a=data.armors.find(a=>a.id===ForgeMod.equipmentFromGame(modTemplate.inventoryList[i+1].IdVal));return '<label class="template-lock-choice"><input type="checkbox" data-template-part="'+part+'" checked>'+ForgeEngine.PART_NAMES[part]+' · '+esc(a.name)+'</label><label class="template-lock-choice"><input type="checkbox" data-template-augment="'+part+'" checked>同时固定该件炼化</label>';}).join('')+'<label class="template-lock-choice"><input type="checkbox" data-template-part="charm" checked>护石</label>';
 $('templateLocksError').classList.add('hidden');$('templateLocksDialog').showModal();
}
function acceptTemplateLocks(){
 try{
  const checked=[...$('templateLockChoices').querySelectorAll('input:checked')],selected=checked.map(x=>x.dataset.templatePart),augmented=new Set(checked.map(x=>x.dataset.templateAugment)),next=JSON.parse(JSON.stringify(state));
  for(let i=0;i<5;i++){
   const part=ForgeEngine.PARTS[i];if(!selected.includes(part))continue;const item=modTemplate.inventoryList[i+1],id=ForgeMod.equipmentFromGame(item.IdVal),a=data.armors.find(a=>a.id===id),atoms=[];
   if(augmented.has(part)&&item.CustomEnable)for(const t of item.CustomBuildup){if(!t.Id)continue;const raw=data.atoms.find(v=>v.pool===a.pool&&v.id===t.Id),v=raw?.values.find(v=>v.value_index===t.ValueIndex);if(!v)throw new Error('模板含未知炼化数值');const atom={atomId:t.Id,value:v.value,count:1};if(raw.category===20)atom.skillId=ForgeMod.skillFromGame(t.SkillId);else atom.valueIndex=t.ValueIndex;atoms.push(atom);}
   next.options.fixedArmors[part]=augmented.has(part)?{id,atoms}:{id};
  }
  if(selected.includes('charm')){
   const c=modTemplate.inventoryList[7];if(c.IdVal){const skills=c.TalismanSkillIdList.flatMap((id,i)=>id?[{skill_id:ForgeMod.skillFromGame(id),level:c.TalismanSkillLvList[i]}]:[]),slots=c.TalismanDecoSlotNumList.flatMap((n,i)=>i?Array(n).fill(i):[]);next.options.fixedCharm=legalUserCharm(skills,slots);next.options.noCharm=false;}
   else {delete next.options.fixedCharm;next.options.noCharm=true;}
  }
  ForgeEngine.validateRestrictions(data,next);state=ForgeConfig.normalize(data,next);syncOptions();changed();$('templateLocksDialog').close();toast('已固定所选模板装备');
 }catch(e){$('templateLocksError').textContent=e.message;$('templateLocksError').classList.remove('hidden');}
}
let inventoryStock=null,inventoryStore=null,inventoryPageIndex=0;
function inventoryWeapon(){return inventoryStock&&state.ownedInventoryId===inventoryStock.id?inventoryStock.byKey.get(state.ownedWeaponKey):undefined;}
function inventoryRampage(){const id=inventoryWeapon()?.item.HyakuryuDecoId||0;return id===1048576?0:id;}
function showInventoryPage(open){$('plannerPage').classList.toggle('hidden',open);$('inventoryPage').classList.toggle('hidden',!open);$('plannerTab').setAttribute?.('aria-pressed',String(!open));$('inventoryTab').setAttribute?.('aria-pressed',String(open));if(open)renderInventory();}
function syncOwnedMode(){
 $('ownedOnly').checked=!!state.options.ownedOnly;
 $('ownedWeaponWrap').classList.toggle('hidden',!state.options.ownedOnly);
 for(const id of ['augment','deleteSkills','defenseFallback','fixedCharms'])$(id).disabled=busy||!!state.options.ownedOnly||(['deleteSkills','defenseFallback'].includes(id)&&!state.options.augment);
 if(state.options.ownedOnly&&(!inventoryStock||state.ownedInventoryId!==inventoryStock.id))$('solve').disabled=true;
 $('ownedModeHint').textContent=state.options.ownedOnly?'只搜索库存中的具体装备，不增加或重算炼化。炼化开关、兜底和新增上限在此模式下不参与计算。百龙珠保留该武器当前插法。':'先到“我的装备箱”导入游戏快照。已有模式不生成任何炼化；03可继续按装备名称筛选。';
}
function renderOwnedWeapons(){
 if(!state.options.ownedOnly)return;
 if(!inventoryStock||state.ownedInventoryId!==inventoryStock.id){$('ownedWeaponSelect').innerHTML='<option value="">库存快照不匹配，请导入对应快照</option>';$('ownedWeaponSelect').disabled=true;$('solve').disabled=true;return;}
 $('ownedWeaponSelect').disabled=busy;
 const rows=inventoryStock?.entries.filter(e=>e.kind==='weapon'&&e.usable&&e.base.id===state.weaponId)||[];
 $('ownedWeaponSelect').innerHTML=rows.map(e=>'<option value="'+e.key+'">箱位 '+(e.index+1)+' · '+ForgeInventory.augmentSummary(e)+' · '+e.name+'</option>').join('');
 if(!rows.some(e=>e.key===state.ownedWeaponKey))state.ownedWeaponKey=rows[0]?.key||'';
 $('ownedWeaponSelect').value=state.ownedWeaponKey;
 state.rampageDecorationId=inventoryRampage();
}
function setOwnedMode(on){
 if(busy)return;state.options.ownedOnly=!!on;
 if(on&&!inventoryStock){state.options.ownedOnly=false;toast('请先导入装备箱快照');showInventoryPage(true);syncOwnedMode();return;}
 if(on){if(state.ownedInventoryId!==inventoryStock.id){delete state.ownedArmorKeys;delete state.ownedCharmKey;}const rows=inventoryStock.entries.filter(e=>e.kind==='weapon'&&e.usable);if(!rows.length){state.options.ownedOnly=false;syncOwnedMode();toast('库存没有可计算的武器');return;}const e=(state.ownedInventoryId===inventoryStock.id&&rows.find(e=>e.key===state.ownedWeaponKey&&e.base.id===state.weaponId))||rows.find(e=>e.base.id===state.weaponId)||rows[0];state.weaponId=e.base.id;state.ownedWeaponKey=e.key;state.ownedInventoryId=inventoryStock.id;$('weaponType').value=e.base.type;$('rarity').value='all';$('weaponSearch').value='';}
 syncOwnedMode();renderWeapons();changed();
}
function inventorySkillsHTML(entry){
 return '<div class="inventory-skill-list">'+(entry.skills||[]).slice().sort((a,b)=>ForgeConfig.compareSkills({id:a.skill_id,level:a.level},{id:b.skill_id,level:b.level})).map(s=>'<span class="inventory-skill">'+esc(skill(s.skill_id)?.name||'未知技能')+'<b>'+s.level+'</b></span>').join('')+'</div>';
}
function inventoryCard(entry){
 const e=entry,isDeco=e.kind==='decoration',part=e.kind==='armor'?ForgeEngine.PART_NAMES[e.base?.part]||'防具':({weapon:'武器',charm:'护石',petalace:'花链',insect:'猎虫',decoration:'装饰品'}[e.kind]||'其他'),mark=({weapon:'刃',armor:'甲',charm:'石',decoration:'珠',petalace:'链',insect:'虫'}[e.kind]||'·');
 let html='<article class="inventory-card"><div class="inventory-card-head"><span class="inventory-kind-mark '+e.kind+'" aria-hidden="true">'+mark+'</span><div class="inventory-card-title"><h3>'+esc(e.name)+'</h3><span class="inventory-position">'+(isDeco?'珠子库存':part+' · '+(e.box==='petalaces'?'花链箱位 ':'装备箱位 ')+(e.index+1))+'</span></div>';
 if(isDeco)html+='<span class="inventory-quantity">× '+e.count+'</span>';
 else html+='<span class="inventory-reference'+(e.referencedBy.length?'':' unused')+'">'+(e.referencedBy.length?'引用 '+e.referencedBy.length+' 套':'暂无组合引用')+'</span>';
 html+='</div>';
 if(e.armor)html+='<div class="inventory-card-stats"><span>基础防御 <b>'+e.armor.finalDefense+'</b></span><span>RARE '+e.base.rarity+'</span>'+slotsHTML(e.armor.slots)+'</div>';
 else if(e.kind==='weapon')html+='<div class="inventory-card-stats"><span>'+esc(e.base.typeName)+'</span><span>RARE '+e.base.rarity+'</span>'+slotsHTML(e.base.slots)+'</div>';
 else if(e.kind==='charm'&&e.charm)html+='<div class="inventory-card-stats"><span>实际孔位</span>'+slotsHTML(e.charm.slots)+'</div>';
 html+=inventorySkillsHTML(e);
 if(e.armor)html+='<details open><summary>既有炼化 · '+e.armor.records+' 条</summary><div class="augment-list">'+(e.armor.atoms.length?e.armor.atoms.slice().sort((a,b)=>a.atomId-b.atomId).map(a=>'<span class="augment'+(a.value<0?' negative':'')+'">'+augmentedLabel(a)+'</span>').join(''):'<span class="muted small">无炼化词条</span>')+'</div></details>';
 if(e.kind==='weapon')html+='<p class="inventory-card-foot">按原生普通孔位配装；实际强化、解锁状态和百龙珠原样保留。</p>';
 if(e.error)html+='<p class="error">暂不参与求解：'+esc(e.error)+'</p>';
 else if(!e.usable&&!isDeco)html+='<p class="inventory-card-foot">保留库存记录，在需要时作为已有附件引用。</p>';
 return html+'</article>';
}
function renderInventoryOverview(stock){
 const count=kind=>stock?.entries.filter(e=>e.kind===kind).length||0;
 const ordinary=stock?[...stock.counts].filter(([id])=>data.decorations.some(d=>ForgeMod.decoToGame(d.id)===id)):[];
 for(const [id,value] of [['inventoryWeaponCount',count('weapon')],['inventoryArmorCount',count('armor')],['inventoryCharmCount',count('charm')],['inventoryDecoCount',ordinary.reduce((n,[,v])=>n+v,0)]])$(id).textContent=stock?value.toLocaleString('zh-CN'):'—';
 $('inventoryDecoNote').textContent=stock?ordinary.filter(([,n])=>n>0).length+' 种普通珠 · 按实际数量分配':'按库存数量分配';
 $('inventoryConnection').textContent=stock?'已载入本机库存':'未导入库存';$('inventoryConnection').classList.toggle('connected',!!stock);
 $('inventoryUpdated').textContent=stock?'库存导出于 '+new Date(stock.exportedAt*1000).toLocaleString():'导入后显示库存时间';
 const kind=$('inventoryKind').value||'all',others=stock?.entries.filter(e=>!['weapon','armor','charm'].includes(e.kind)).length||0;
 const categories=[['all','全部装备',stock?.entries.length||0],['weapon','武器',count('weapon')],['armor','防具',count('armor')],['charm','护石',count('charm')],['decoration','珠子',stock?[...stock.counts.values()].filter(n=>n>0).length:0],['other','其他',others]];
 $('inventoryCategories').innerHTML=categories.map(([id,name,n])=>'<button class="inventory-category" data-inventory-kind="'+id+'" aria-pressed="'+(id===kind)+'">'+name+'<span>'+n+'</span></button>').join('');
}
function syncInventorySort(){
 const kind=$('inventoryKind').value||'all',options=ForgeInventory.sortOptions(kind),previous=$('inventorySort').value;
 $('inventorySort').innerHTML=options.map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('');
 $('inventorySort').value=options.some(([id])=>id===previous)?previous:options[0][0];
 if(!['asc','desc'].includes($('inventorySortDirection').value))$('inventorySortDirection').value='asc';
}
function renderInventory(){
 const stock=inventoryStock;$('useInventory').disabled=!stock||busy;$('clearInventory').disabled=!stock||busy;renderInventoryOverview(stock);syncInventorySort();
 if(!stock){$('inventorySummary').textContent='尚无库存记录';$('inventoryList').innerHTML='<div class="inventory-empty"><strong>先把你的装备带进来。</strong><p>下载 Lua，在游戏中导出库存，再把 JSON 拖入上方。</p></div>';$('inventoryPageInfo').textContent='0 / 0';$('inventoryPrev').disabled=$('inventoryNext').disabled=true;return;}
 const kind=$('inventoryKind').value||'all',q=$('inventorySearch').value.trim().toLowerCase(),sort=$('inventorySort').value;
 const skillText=e=>(e.skills||[]).map(s=>(skill(s.skill_id)?.name||s.skill_id)+' '+s.level).join(' / ');
 let rows=stock.entries.map(e=>({...e,search:e.name+' '+skillText(e)}));
 if(kind==='decoration')rows=[...stock.counts].filter(([,n])=>n>0).map(([id,count])=>{const d=data.decorations.find(d=>ForgeMod.decoToGame(d.id)===id)||data.rampageDecorations.find(d=>d.gameId===id);return {kind:'decoration',key:'deco:'+id,name:d?.name||'未知珠子 #'+id,count,slot:d?.slot,skills:d?.skills||[],referencedBy:[],search:(d?.name||id)+' '+(d?.skills||[]).map(s=>skill(s.skill_id)?.name||'').join(' ')};});
 else if(kind==='other')rows=rows.filter(e=>!['weapon','armor','charm'].includes(e.kind));else if(kind!=='all')rows=rows.filter(e=>e.kind===kind);
 rows=rows.filter(e=>!q||e.search.toLowerCase().includes(q));
 rows=ForgeInventory.sortEntries(rows,kind,sort,$('inventorySortDirection').value);
 const pages=Math.max(1,Math.ceil(rows.length/50));inventoryPageIndex=Math.min(pages-1,Math.max(0,inventoryPageIndex));
 const counts=k=>stock.entries.filter(e=>e.kind===k).length;
 $('inventorySummary').textContent='武器 '+counts('weapon')+' · 防具 '+counts('armor')+' · 护石 '+counts('charm')+' · 珠子 '+[...stock.counts.values()].reduce((n,v)=>n+v,0)+' 颗 · 当前筛选 '+rows.length+' 项'+(stock.errors.length?' · '+stock.errors.length+' 件暂不支持计算（仍保留记录）':'');
 $('inventoryList').innerHTML=rows.length?rows.slice(inventoryPageIndex*50,(inventoryPageIndex+1)*50).map(inventoryCard).join(''):'<div class="inventory-empty"><strong>没有找到符合条件的条目。</strong><p>试试其他名称或技能，或切换上方类别。</p></div>';
 $('inventoryPageInfo').textContent=(inventoryPageIndex+1)+' / '+pages;$('inventoryPrev').disabled=inventoryPageIndex===0;$('inventoryNext').disabled=inventoryPageIndex+1>=pages;
}
async function importInventoryFile(file){
 if(busy){toast('请先停止搜索再导入库存');return;}
 $('inventoryError').classList.add('hidden');
 try{if(!file||file.size>ForgeInventory.MAX_BYTES)throw new Error('请选择32MB以内的库存JSON');const next=ForgeInventory.parse(data,await file.text());inventoryStock=next;inventoryPageIndex=0;const persisted=await inventoryStore.save(next.raw);$('inventoryStatus').textContent='已导入 '+next.entries.length+' 件装备 · '+new Date(next.exportedAt*1000).toLocaleString()+' · '+next.id+(persisted?' · 已保存到本机':' · 浏览器无法持久保存，本次页面有效');if(state.options.ownedOnly)setOwnedMode(true);renderInventory();}
 catch(e){$('inventoryError').textContent=e.message;$('inventoryError').classList.remove('hidden');}
}
async function initializeInventory(){
 inventoryStore=ForgeInventory.createStore({indexedDB:globalThis.indexedDB,localStorage:globalThis.localStorage});
 try{const raw=await inventoryStore.load();if(raw){inventoryStock=ForgeInventory.parse(data,raw);$('inventoryStatus').textContent='已恢复本机库存 · '+inventoryStock.id;}}catch(e){$('inventoryStatus').textContent='保存的库存无法读取，请重新导入：'+e.message;}
 syncOwnedMode();renderInventory();
}
async function downloadInventoryLua(){try{const embedded=$('embeddedInventoryLua'),blob=embedded?new Blob([Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0))],{type:'text/plain'}):await fetch('./EquipmentLoadoutsManager.lua').then(r=>{if(!r.ok)throw new Error('Lua下载失败');return r.blob();});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='EquipmentLoadoutsManager.lua';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}catch(e){toast(e.message);}}
async function parsePlanText(text){
 let raw;try{raw=JSON.parse(text);}catch{}
 if(raw?.request?.options?.ownedOnly||raw?.result?.owned){if(!raw.request?.options?.ownedOnly)throw new Error('库存方案缺少已有模式条件');const request=ForgeConfig.normalize(data,raw),result=ForgeInventory.validateResult(data,inventoryStock,request,raw.result);request.ownedArmorKeys=Object.fromEntries(ForgeEngine.PARTS.map(p=>[p,ForgeInventory.entryKey(result.owned.armors[p].box,result.owned.armors[p].index)]));if(!result.owned.charm.empty)request.ownedCharmKey=ForgeInventory.entryKey(result.owned.charm.box,result.owned.charm.index);return {request,result,id:inventoryStock.id,token:JSON.stringify({...ForgeConfig.payload(data,request),result})};}
 return ForgeShare.parseText(data,text);
}

async function init(){
 try{
  if($('embeddedData'))data=JSON.parse($('embeddedData').textContent);
  else {const response=await fetch('./data.json');if(!response.ok)throw new Error('数据文件HTTP '+response.status);data=await response.json();}
  let saved;try{const hash=new URLSearchParams(location.hash.slice(1)).get('q');saved=hash?JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(hash),c=>c.charCodeAt(0)))):JSON.parse(localStorage.getItem('sunbreak-forge-v1'));}catch{}
  try{state=ForgeConfig.normalize(data,saved||state);}catch{state=ForgeConfig.normalize(data,state);}
  await initializeInventory();
  const types=new Map(data.weapons.map(w=>[w.type,w.typeName]));$('weaponType').innerHTML=[...types].map(([id,name])=>'<option value="'+id+'">'+esc(name)+'</option>').join('');
  const initial=data.weapons.find(w=>w.id===state.weaponId);$('weaponType').value=initial.type;if(initial.rarity!==10)$('rarity').value='all';syncOptions();renderWeapons();setBusy(false);$('share').disabled=false;$('importConfig').disabled=false;$('importPlan').disabled=false;
  try{const template=localStorage.getItem('sunbreak-forge-mod-template-v1');if(template)modTemplate=ForgeMod.parse(data,template);}catch{modTemplate=null;}renderModTemplate();
 }catch(e){$('loadError').classList.remove('hidden');$('loadError').textContent='无法载入装备数据：'+e.message+'。请刷新重试。';}
}
$('rampageSelect').onchange=selectRampage;
$('rampageSearch').oninput=()=>{if(!$('rampageSearch').value.trim()){renderRampage();return;}renderRampage(false);if(+$('rampageSelect').value>=0)selectRampage();};
$('weaponType').onchange=()=>{renderWeapons(false);changed();};$('rarity').onchange=()=>{renderWeapons();changed();};$('weaponSearch').oninput=()=>{renderWeapons();changed();};$('weaponSelect').onchange=()=>{renderWeapon();changed();};
for(const id of ['sex','rank','seconds','limit','searchMode','resultSort'])$(id).onchange=()=>{state.options[id]=['seconds','limit'].includes(id)?+$(id).value:$(id).value;syncSearchMode();renderFixed();changed();};
for(const id of ['augment','deleteSkills','noCharm','fixedCharms','defenseFallback'])$(id).onchange=()=>{state.options[id]=$(id).checked;if(id==='augment'){$('deleteSkills').disabled=!$(id).checked;$('defenseFallback').disabled=!$(id).checked;}if(id==='noCharm'&&$(id).checked){delete state.ownedCharmKey;delete state.options.fixedCharm;renderFixed();}changed();};
$('targetSkills').onclick=event=>{const remove=event.target.closest('[data-remove]');const level=event.target.closest('[data-level]');if(remove)state.skills=state.skills.filter(s=>s.id!==+remove.dataset.remove);else if(level){const r=state.skills.find(s=>s.id===+level.dataset.level);r.level=Math.max(1,Math.min(skill(r.id).max,r.level+ +level.dataset.delta));}else return;renderTargets();changed();};
$('sortSkills').onclick=()=>{state.skills.sort(ForgeConfig.compareSkills);renderTargets();save();toast('已按等级降序、同级ID升序排列');};
$('clearSkills').onclick=()=>{state.skills=[];renderTargets();changed();};$('preset').onclick=()=>{state.skills=[{id:0,level:7},{id:5,level:7},{id:7,level:3},{id:6,level:3},{id:205,level:1}];renderTargets();changed();toast('已载入通用物理目标');};
$('stressPreset').onclick=()=>{state.skills=[{id:0,level:7},{id:5,level:7},{id:6,level:3},{id:7,level:3},{id:205,level:1},{id:203,level:3},{id:228,level:3},{id:226,level:1},{id:227,level:1},{id:233,level:3},{id:225,level:2},{id:232,level:3},{id:229,level:3},{id:224,level:3}];renderTargets();changed();toast('已载入14项目标；这是求解示例，不是伤害配装推荐');};
$('addSkill').onclick=()=>{if(!data)return;$('skillSearch').value='';renderPicker();$('skillDialog').showModal();$('skillSearch').focus();};$('skillSearch').oninput=renderPicker;
$('skillPicker').onclick=event=>{const button=event.target.closest('[data-skill]');if(!button)return;const id=+button.dataset.skill;if(state.skills.some(s=>s.id===id))state.skills=state.skills.filter(s=>s.id!==id);else state.skills.push({id,level:1});renderTargets();renderPicker();changed();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
for(const id of ['skillDialog','rulesDialog','configDialog','modDialog','modExportDialog','equipmentDialog','charmDialog','templateLocksDialog','shareImageDialog','planDialog'])$(id).onclick=event=>{if(event.target===$(id)){const rect=$(id).getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$(id).close();}};
$('rulesButton').onclick=$('aboutButton').onclick=()=>$('rulesDialog').showModal();$('solve').onclick=start;
$('cancel').onclick=()=>{finish();$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='搜索已停止'+(found.length?'，保留已校验通过的'+found.length+'套方案。':'。未找到结果不表示无解。');if(!found.length)$('empty').classList.remove('hidden');};
$('results').onclick=event=>{const image=event.target.closest('[data-share-image]');if(image){shareResult(+image.dataset.shareImage);return;}const lock=event.target.closest('[data-lock-result]');if(lock){lockResult(+lock.dataset.lockResult);return;}const modButton=event.target.closest('[data-export-mod]');if(modButton){exportMod(+modButton.dataset.exportMod);return;}const button=event.target.closest('[data-export]');if(button)exportResult(+button.dataset.export);};
$('importMod').onclick=openModImport;$('applyModTemplate').onclick=()=>applyMod('template');$('applyModFull').onclick=()=>applyMod('full');
$('importPlan').onclick=openPlanImport;$('applyPlan').onclick=applyPlan;
$('planDropZone').onclick=()=>$('planFile').click();
$('planFile').onchange=()=>{const files=$('planFile').files;if(files?.length===1)readPlanFile(files[0]);$('planFile').value='';};
for(const event of ['ondragenter','ondragover'])$('planDialog')[event]=e=>{if(Array.from(e.dataTransfer?.types||[]).includes('Files')){e.preventDefault();e.stopPropagation();}};
$('planDialog').ondrop=e=>{if(!Array.from(e.dataTransfer?.types||[]).includes('Files'))return;e.preventDefault();e.stopPropagation();const files=e.dataTransfer.files;if(files.length!==1){$('planError').textContent='每次请选择一张分享图片或一份方案JSON';$('planError').classList.remove('hidden');return;}readPlanFile(files[0]);};
$('planDialog').onpaste=e=>{const images=Array.from(e.clipboardData?.items||[]).filter(x=>x.type.startsWith('image/'));if(images.length){e.preventDefault();const file=images[0].getAsFile();if(file)readPlanFile(file);}};
$('planText').oninput=()=>{planReadGeneration++;$('applyPlan').disabled=false;$('planFileStatus').textContent='';$('planError').classList.add('hidden');};
$('planDialog').onclose=()=>{planReadGeneration++;$('applyPlan').disabled=false;};
$('shareImageDialog').onclose=closeShareImage;
$('downloadShareImage').onclick=()=>{if(!pendingShareImage)return;const url=URL.createObjectURL(pendingShareImage.blob),a=document.createElement('a');a.href=url;a.download='sunbreak-plan-'+pendingShareImage.shared.id.slice(0,16)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
$('copyPlanCode').onclick=async()=>{if(!pendingShareImage)return;try{await navigator.clipboard.writeText(pendingShareImage.shared.token);toast('已复制方案码，可在其他设备粘贴导入');}catch{$('sharePlanCode').focus();$('sharePlanCode').select?.();toast('请手动复制下方方案码');}};
$('confirmModExport').onclick=confirmModExport;$('modExportDialog').onclose=()=>{pendingModExport=null;};$('modExportName').onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();confirmModExport();}};
$('clearMod').onclick=()=>{modTemplate=null;try{localStorage.removeItem('sunbreak-forge-mod-template-v1');}catch{}renderModTemplate();toast('已清除Mod模板，配装条件保持当前选择');};
$('share').onclick=async()=>{const payload=ForgeConfig.payload(data,state);try{await navigator.clipboard.writeText(JSON.stringify(payload,null,2));toast('已复制纯配装条件，不含网址或账号信息');}catch{downloadJSON('sunbreak-search.json',payload);toast('浏览器限制复制，已下载配装条件JSON');}};
$('importConfig').onclick=()=>{if(busy){toast('请先停止搜索再导入');return;}importFiles.config.reset();$('configText').value='';$('configError').classList.add('hidden');$('configDialog').showModal();$('configText').focus();};
$('applyConfig').onclick=()=>{try{const next=ForgeConfig.normalize(data,JSON.parse($('configText').value));if(next.options.ownedOnly)ForgeInventory.validateSelection(data,inventoryStock,next);else if(next.options.presetEquipment){ForgeInventory.validatePreset(data,{...next,skills:[]},{weaponId:next.weaponId,armors:ForgeEngine.PARTS.map(part=>next.options.fixedArmors[part]),charm:next.options.noCharm?{empty:true,skills:[],slots:[]}:next.options.fixedCharm,decorations:[]});}else ForgeEngine.validateRestrictions(data,next);state=next;const w=data.weapons.find(w=>w.id===state.weaponId);$('weaponType').value=w.type;$('rarity').value=w.rarity===10?'10':'all';$('weaponSearch').value='';syncOptions();renderWeapons();renderTargets();$('deleteSkills').disabled=!state.options.augment;changed();$('configDialog').close();toast('已导入配装条件');}catch(e){$('configError').textContent=e.message;$('configError').classList.remove('hidden');}};
const importFiles={};
for(const [kind,dialogId,buttonIds] of [['config','configDialog',['applyConfig']],['mod','modDialog',['applyModTemplate','applyModFull']]]){
 importFiles[kind]=ForgeFiles.bind({dialog:$(dialogId),zone:$(kind+'DropZone'),input:$(kind+'File'),text:$(kind+'Text'),error:$(kind+'Error'),status:$(kind+'FileStatus'),buttons:buttonIds.map($)});
 $(dialogId).onclose=()=>importFiles[kind].reset();
}

$('fixedEquipment').onclick=event=>{const edit=event.target.closest('[data-edit-armor]'),unlock=event.target.closest('[data-unlock-armor]'),augment=event.target.closest('[data-unlock-augment]');if(edit)openArmor(edit.dataset.editArmor);if(augment&&!busy){const p=state.options.fixedArmors[augment.dataset.unlockAugment];if(p)delete p.atoms;renderFixed();changed();}if(unlock&&!busy){delete state.ownedArmorKeys?.[unlock.dataset.unlockArmor];delete state.options.fixedArmors[unlock.dataset.unlockArmor];renderFixed();changed();}};
$('fixedEquipment').onchange=event=>{const part=event.target.dataset.augmentLimit;if(part&&!busy){state.options.augmentLimits[part]=+event.target.value;changed();}};
$('armorSearch').oninput=renderArmorChoices;$('armorSelect').onchange=()=>{armorEditor.id=$('armorSelect').value;armorEditor.atoms=[];renderArmorEditor();};
$('armorAtoms').onchange=event=>{const d=event.target.dataset;if(d.atom!=null){const i=+d.atom,count=armorEditor.atoms[i].count;armorEditor.atoms[i]={...armorEditor.choices[+event.target.value].atom,count};}if(d.atomCount!=null)armorEditor.atoms[+d.atomCount].count=+event.target.value;renderArmorEditor();};
$('armorAtoms').onclick=event=>{const b=event.target.closest('[data-remove-atom]');if(b){armorEditor.atoms.splice(+b.dataset.removeAtom,1);renderArmorEditor();}};
$('addArmorAtom').onclick=()=>{if(armorEditor.choices.length){armorEditor.atoms.push({...armorEditor.choices[0].atom});renderArmorEditor();}};
$('fixArmorAugment').onchange=()=>renderArmorEditor();
$('saveArmor').onclick=acceptArmor;$('unlockArmor').onclick=()=>{delete state.ownedArmorKeys?.[armorEditor.part];delete state.options.fixedArmors[armorEditor.part];renderFixed();changed();$('equipmentDialog').close();};
$('charmFields').oninput=event=>{const index=event.target.dataset.charmSkillSearch;if(index!=null)renderCharmSkillOptions(+index);};
$('editCharm').onclick=openCharm;$('saveCharm').onclick=acceptCharm;$('clearCharm').onclick=()=>{delete state.ownedCharmKey;delete state.options.fixedCharm;renderFixed();changed();};
$('lockModEquipment').onclick=openTemplateLocks;$('applyTemplateLocks').onclick=acceptTemplateLocks;
$('previousResults').onclick=()=>{resultPage--;renderResults();};$('nextResults').onclick=()=>{resultPage++;renderResults();};
$('resultSort').onchange=()=>{state.options.resultSort=$('resultSort').value;resultPage=0;renderResults();save();};
document.querySelectorAll('.controls input,.controls select,.controls button').forEach(x=>x.disabled=true);
init();

$('inventoryCategories').onclick=e=>{const button=e.target.closest('[data-inventory-kind]');if(!button)return;$('inventoryKind').value=button.dataset.inventoryKind;inventoryPageIndex=0;renderInventory();};
$('plannerTab').onclick=()=>showInventoryPage(false);$('inventoryTab').onclick=()=>showInventoryPage(true);$('downloadInventoryLua').onclick=downloadInventoryLua;
$('ownedOnly').onchange=()=>setOwnedMode($('ownedOnly').checked);$('ownedWeaponSelect').onchange=()=>{state.ownedWeaponKey=$('ownedWeaponSelect').value;state.rampageDecorationId=inventoryRampage();renderRampage();changed();};
$('inventoryDrop').onclick=()=>$('inventoryFile').click();$('inventoryFile').onchange=()=>{if($('inventoryFile').files?.length===1)importInventoryFile($('inventoryFile').files[0]);$('inventoryFile').value='';};
for(const name of ['ondragover','ondragenter'])$('inventoryDrop')[name]=e=>{e.preventDefault();$('inventoryDrop').classList.add('drag-over');};$('inventoryDrop').ondragleave=()=>$('inventoryDrop').classList.remove('drag-over');$('inventoryDrop').ondrop=e=>{e.preventDefault();$('inventoryDrop').classList.remove('drag-over');if(e.dataTransfer?.files?.length===1)importInventoryFile(e.dataTransfer.files[0]);else toast('每次请选择一份库存JSON');};
for(const id of ['inventoryKind','inventorySort','inventorySortDirection'])$(id).onchange=()=>{inventoryPageIndex=0;renderInventory();};$('inventorySearch').oninput=()=>{inventoryPageIndex=0;renderInventory();};$('inventoryPrev').onclick=()=>{inventoryPageIndex--;renderInventory();};$('inventoryNext').onclick=()=>{inventoryPageIndex++;renderInventory();};
$('useInventory').onclick=()=>{setOwnedMode(true);if(state.options.ownedOnly)showInventoryPage(false);};$('clearInventory').onclick=async()=>{if(busy)return;await inventoryStore.clear();inventoryStock=null;state.options.ownedOnly=false;syncOwnedMode();renderWeapons();renderInventory();$('inventoryStatus').textContent='已清除本机库存记录，游戏中的数据不受影响';changed();};
