'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,worker,busy=false,clock,started,activeRequest,found=[],state={weaponId:'LongSword:302',skills:[{id:0,level:7},{id:5,level:7},{id:7,level:3},{id:6,level:3},{id:205,level:1}],options:{sex:'MaleOnly',rank:'all',augment:true,deleteSkills:true,seconds:45,limit:3,fixedCharms:true,noCharm:false}};
let modTemplate=null,pendingModExport=null,resultPage=0,lastResultsRender=0,armorEditor=null;
const PAGE_SIZE=8;
const skill=id=>data.skills.find(s=>s.id===+id);
function slotsHTML(slots,empty=true){return '<span class="slots">'+(empty?[...slots,0,0,0].slice(0,3):slots).map(v=>'<span class="slot l'+v+(!v?' empty':'')+'" title="'+(v?v+'级孔':'无孔位')+'">'+(v||'–')+'</span>').join('')+'</span>';}
function save(){try{localStorage.setItem('sunbreak-forge-v1',JSON.stringify(state));}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2800);}
function changed(){save();if(found.length&&!busy){$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='搜索条件已更改。下方保留上次结果，点击“开始配装”更新。';}}
function syncOptions(){for(const id of ['sex','rank','seconds','limit','searchMode','resultSort'])$(id).value=String(state.options[id]);for(const id of ['augment','deleteSkills','noCharm','fixedCharms','defenseFallback'])$(id).checked=state.options[id];syncSearchMode();renderFixed();}
function renderWeapons(keep=true){
 const type=$('weaponType').value;const query=$('weaponSearch').value.trim().toLowerCase();const rarity=$('rarity').value;
 const weapons=data.weapons.filter(w=>w.type===type&&(rarity==='all'||w.rarity===+rarity)&&(!query||w.name.toLowerCase().includes(query)||w.nameEn.toLowerCase().includes(query)));
 $('weaponSelect').innerHTML=weapons.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.name)+'</option>').join('');
 if(keep&&weapons.some(w=>w.id===state.weaponId))$('weaponSelect').value=state.weaponId;
 else if(weapons.length){state.weaponId=weapons[0].id;}
 if(!weapons.length){$('weaponSelect').innerHTML='<option>未找到符合条件的武器</option>';$('weaponSummary').innerHTML='<span class="muted">试试其他名称，或选择“全部阶段”。</span>';$('solve').disabled=true;return;}
 $('solve').disabled=busy;renderWeapon();
}
function renderWeapon(){
 const w=data.weapons.find(w=>w.id===$('weaponSelect').value);if(!w)return;state.weaponId=w.id;
 $('weaponSummary').innerHTML='<div class="weapon-name">'+esc(w.name)+'<span class="rarity">RARE '+w.rarity+'</span></div><div class="weapon-stats"><span>攻击 <b>'+w.attack+'</b></span><span>会心 <b>'+w.affinity+'<small>%</small></b></span>'+slotsHTML(w.slots)+'</div>';
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
 busy=value;document.querySelectorAll('.controls input,.controls select,.controls button').forEach(x=>x.disabled=value);$('importMod').disabled=value;$('clearMod').disabled=value;$('solve').disabled=value;$('cancel').disabled=false;$('cancel').classList.toggle('hidden',!value);$('solve').querySelector('span').textContent=value?'正在寻找配装…':'开始配装';if(!value){renderTargets();$('deleteSkills').disabled=!$('augment').checked;$('defenseFallback').disabled=!$('augment').checked;syncSearchMode();}
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
 let html='<article class="result-card"><div class="result-card-head"><span class="result-number">'+String(index+1).padStart(2,'0')+'</span><div><h3>可行配装方案</h3><span class="verified">✓ 炼化预算、技能与插珠校验通过</span></div><div class="result-export-actions"><button class="export-result" data-lock-result="'+index+'">固定这套装备</button><button class="export-result" data-export="'+index+'">导出 JSON ↓</button><button class="export-result export-mod" data-export-mod="'+index+'">Mod 导出 ↓</button></div></div>';
 html+='<div class="result-metrics"><span><b>'+r.defense+'</b>基础防御</span><span><b>'+r.records+'</b>炼化词条</span><span><b>'+(r.skillAdds||0)+'</b>新增技能等级</span><span title="只合计新增技能正cost，不含孔位和负面词条"><b>'+(r.skillAddCost||0)+'</b>新增技能cost</span><span><b>'+r.decoCount+'</b>珠子</span><span><b>'+r.unusedSlots.length+'</b>空余孔位</span></div><div class="result-main">';
 html+='<div class="equip-row"><div class="equip-line"><span class="equip-part">武器</span><div class="equip-content"><div class="equip-name">'+esc(weapon.name)+'</div><div class="equip-sub">'+esc(weapon.typeName)+' · 使用原生孔位</div></div>'+slotsHTML(weapon.slots)+'</div></div>';
 for(const p of r.pieces){
  const score=r.scores?.[p.id];const native=p.skills.map(s=>esc(skill(s.skill_id).name)+' '+s.level).join(' / ');
  html+='<div class="equip-row"><div class="equip-line"><span class="equip-part">'+ForgeEngine.PART_NAMES[p.part]+'</span><div class="equip-content"><div class="equip-name">'+esc(p.name)+(activeRequest.options?.fixedArmors?.[p.part]?'<span class="fixed-badge">已固定</span>':'')+'</div><div class="equip-sub">'+native+'</div></div>'+slotsHTML(p.slots)+'</div>';
  if(p.records)html+='<details open><summary><span class="budget"><span>炼化 '+p.records+' / 7条</span><span>cost '+p.cost+' / '+p.budget+'</span><span>新增 '+p.additions+' / '+(activeRequest.options?.augmentLimits?.[p.part]??7)+'条</span>'+(score?'<span>原生等效 '+(score.native+score.slot).toFixed(1)+'</span>':'')+'</span></summary><div class="augment-list">'+p.atoms.map(a=>'<span class="augment'+(a.value<0?' negative':'')+'">'+(a.fallback?'防御兜底 · ':'')+augmentedLabel(a)+'</span>').join('')+'</div></details>';
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
 try{ForgeEngine.validateRequest(data,state);}catch(e){toast(e.message);return;}
 activeRequest=JSON.parse(JSON.stringify(state));found=[];resultPage=0;lastResultsRender=0;$('resultPagination').classList.add('hidden');$('results').replaceChildren();$('resultCount').textContent='0';$('empty').classList.add('hidden');$('statusMessage').classList.add('hidden');$('progress').classList.remove('hidden');$('progressTitle').textContent='准备求解…';$('progressDetail').textContent='整理目标技能与合法候选';started=Date.now();$('timer').textContent='0s';setBusy(true);clock=setInterval(()=>$('timer').textContent=Math.floor((Date.now()-started)/1000)+'s',250);
 const embeddedWorker=$('embeddedWorker');let workerURL;
 if(embeddedWorker){const bytes=Uint8Array.from(atob(embeddedWorker.textContent.trim()),c=>c.charCodeAt(0));workerURL=URL.createObjectURL(new Blob([new TextDecoder().decode(bytes)],{type:'text/javascript'}));worker=new Worker(workerURL);worker.addEventListener('message',()=>URL.revokeObjectURL(workerURL),{once:true});}
 else worker=new Worker('./worker.js');
 worker.onmessage=event=>{
  const p=event.data;
  if(p.phase==='result'){const existing=found.findIndex(r=>ForgeEngine.resultIdentity(r)===ForgeEngine.resultIdentity(p.result));if(existing<0)found.push(p.result);else found[existing]=p.result;if(Date.now()-lastResultsRender>250)renderResults();}
  if(p.message)$('progressTitle').textContent=p.message;
  if(p.phase==='model')$('progressDetail').textContent='第'+p.stage+'轮 · '+p.armors+'件防具 · '+p.charms+'枚护石候选';
  if(p.phase==='solve')$('progressDetail').textContent='整数约束求解 · '+p.variables.toLocaleString()+'个决策变量';
  if(p.phase==='done'){
   const r=p.response;found=r.results;finish();$('statusMessage').classList.remove('hidden');
   $('statusMessage').textContent=r.results.length?'已找到 '+r.results.length+' 套可行方案 · 用时 '+(r.elapsedMs/1000).toFixed(1)+' 秒 · 每套均已重新校验。'+(r.domainExhausted?'当前可搜索的组合已枚举完毕。':''):'本次搜索尚未找到可行方案。可延长时限、检查技能目标或启用炼化；这不表示全局无解。';
   if(!found.length){$('empty').classList.remove('hidden');}
  }
  if(p.phase==='error'){finish();$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='搜索未完成：'+p.message;if(!found.length)$('empty').classList.remove('hidden');}
 };
 worker.onerror=event=>{finish();$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='求解引擎加载或运行失败：'+event.message;if(!found.length)$('empty').classList.remove('hidden');};
 const embeddedWasm=$('embeddedWasm');
 if(embeddedWasm){const wasmBinary=Uint8Array.from(atob(embeddedWasm.textContent.trim()),c=>c.charCodeAt(0));worker.postMessage({data,request:activeRequest,wasmBinary},[wasmBinary.buffer]);}
 else worker.postMessage({data,request:activeRequest});
}
function downloadJSON(filename,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function exportResult(index){downloadJSON('sunbreak-loadout-'+(index+1)+'.json',{...ForgeConfig.payload(data,activeRequest),dataVersion:data.meta.version,result:found[index]});}
function renderModTemplate(){
 renderFixed();
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
  $('modExportName').value=((modTemplate.mySetInfo.Name.trim()||'工房配装')+' · '+(index+1)).slice(0,70);$('modExportError').classList.add('hidden');$('modExportDialog').showModal();$('modExportName').focus();
 }
 catch(e){toast(e.message);if(!modTemplate&&!busy)openModImport();}
}
function confirmModExport(){
 try{
  if(!pendingModExport)throw new Error('请重新选择要导出的配装');
  const p=pendingModExport,out=ForgeMod.exportLoadout(data,p.template,p.result,p.request,ForgeEngine,{index:p.index,name:$('modExportName').value});
  downloadJSON(out.filename,out.payload);$('modExportDialog').close();pendingModExport=null;toast('已下载 '+out.filename+'，请放入 '+out.directory);
 }catch(e){$('modExportError').textContent=e.message;$('modExportError').classList.remove('hidden');}
}

function syncSearchMode(){
 $('limit').disabled=busy||state.options.searchMode==='time';
 $('searchModeHint').textContent=state.options.searchMode==='time'?'忽略方案数量，优先优化下方排序指标；先扩大防具范围，再搜索不同组合。超时不保证全局最优。':'达到指定数量或时限后结束。';
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
  const p=fixed[part],a=p&&data.armors.find(a=>a.id===p.id),count=p?p.atoms.reduce((n,t)=>n+t.count,0):0;
  return '<div class="fixed-row"><div class="fixed-row-head"><strong>'+ForgeEngine.PART_NAMES[part]+'</strong><button class="text-button" data-edit-armor="'+part+'">'+(a?'编辑固定':'指定装备')+'</button>'+(a?'<button class="text-button" data-unlock-armor="'+part+'">解除</button>':'')+'</div><div class="fixed-name">'+(a?esc(a.name)+' · 固定'+count+'条炼化':'自动选择装备与炼化')+'</div><label class="fixed-limit">最多新增正面词条<select data-augment-limit="'+part+'" aria-label="'+ForgeEngine.PART_NAMES[part]+'最多新增正面词条">'+Array.from({length:8},(_,n)=>'<option value="'+n+'" '+((limits[part]??7)===n?'selected':'')+'>'+n+'条</option>').join('')+'</select></label></div>';
 }).join('');
 const c=state.options.fixedCharm;$('fixedCharmSummary').textContent=c?'已固定：'+c.skills.map(s=>skill(s.skill_id).name+' '+s.level).join(' / ')+' · 孔位 '+(c.slots.join('-')||'无'):'护石由工房搜索';
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
  if(raw.category===20){
   if(a.pool===13)continue;
   const skills=raw.cost<0?a.skills.map(s=>skill(s.skill_id)):data.skills.filter(s=>s.cost===raw.cost);
   for(const s of skills){const value=raw.cost<0?-1:1;result.push({atom:{atomId:raw.id,skillId:s.id,value,count:1},label:s.name+' '+(value>0?'+1':'−1')+' · cost '+raw.cost});}
  }else if([13,14,19].includes(raw.category))for(const v of raw.values){
   const atom={atomId:raw.id,value:v.value,valueIndex:v.value_index,count:1};
   if(raw.category===13)atom.attribute='defense';
   if(raw.category===14)atom.attribute=['fire','water','thunder','ice','dragon'][Math.floor((raw.id-89)/10)];
   const names={fire:'火耐性',water:'水耐性',thunder:'雷耐性',ice:'冰耐性',dragon:'龙耐性',defense:'防御'};
   result.push({atom,label:(raw.category===19?'孔位增长':names[atom.attribute])+' '+(v.value>0?'+':'')+v.value+' · cost '+raw.cost});
  }
 }
 return result;
}
function renderArmorEditor(){
 const a=data.armors.find(a=>a.id===armorEditor.id);$('saveArmor').disabled=!a;
 if(!a){armorEditor.choices=[];$('armorDetails').textContent='没有匹配防具，请修改搜索文字。';$('armorAtoms').innerHTML='';$('addArmorAtom').disabled=true;return;}
 armorEditor.choices=atomChoices(a);
 $('armorDetails').innerHTML='基础防御 '+a.defense+' · 原始孔位 '+(a.slots.join('-')||'无')+' · 炼化预算 '+a.budget+'<br>'+a.skills.map(s=>esc(skill(s.skill_id).name)+' '+s.level).join(' / ');
 $('armorAtoms').innerHTML=armorEditor.atoms.map((t,i)=>{
  const match=armorEditor.choices.findIndex(c=>c.atom.atomId===t.atomId&&c.atom.skillId===t.skillId&&c.atom.value===t.value&&(c.atom.valueIndex??0)===(t.valueIndex??0));
  return '<div class="atom-editor-row"><select data-atom="'+i+'" aria-label="第'+(i+1)+'条炼化">'+armorEditor.choices.map((c,j)=>'<option value="'+j+'" '+(j===match?'selected':'')+'>'+esc(c.label)+'</option>').join('')+'</select><input data-atom-count="'+i+'" type="number" min="1" max="7" value="'+t.count+'" aria-label="词条数量"><button data-remove-atom="'+i+'" aria-label="删除词条">×</button></div>';
 }).join('');$('addArmorAtom').disabled=!armorEditor.choices.length||armorEditor.atoms.reduce((n,t)=>n+t.count,0)>=7;
}
function openArmor(part){
 if(busy)return;const fixed=state.options.fixedArmors?.[part];armorEditor={part,id:fixed?.id,atoms:JSON.parse(JSON.stringify(fixed?.atoms||[]))};
 if(!armorEditor.id)armorEditor.id=armorChoices()[0]?.id;if(!armorEditor.id){toast('没有符合当前性别和位阶的防具');return;}
 $('equipmentTitle').textContent='指定'+ForgeEngine.PART_NAMES[part]+'与炼化';$('armorSearch').value='';$('equipmentError').classList.add('hidden');renderArmorChoices();$('equipmentDialog').showModal();
}
function acceptArmor(){
 try{
  const p={id:armorEditor.id,atoms:armorEditor.atoms};ForgeEngine.evaluateArmor(data,state,p);
  state.options.fixedArmors[armorEditor.part]=JSON.parse(JSON.stringify(p));renderFixed();changed();$('equipmentDialog').close();toast('已固定防具与炼化');
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
  state.options.fixedCharm=legalUserCharm(skills,[0,1,2].map(i=>+$('charmSlot'+i).value));state.options.noCharm=false;$('noCharm').checked=false;renderFixed();changed();$('charmDialog').close();
 }catch(e){$('charmError').textContent=e.message;$('charmError').classList.remove('hidden');}
}
function lockResult(index){
 if(busy){toast('请先停止搜索，再固定结果');return;}const r=found[index];if(!r)return;
 const next=JSON.parse(JSON.stringify(state));next.options.fixedArmors=Object.fromEntries(r.pieces.map(p=>[p.part,{id:p.id,atoms:p.atoms}]));
 if(!r.charm.empty){next.options.fixedCharm=r.charm;next.options.noCharm=false;}else {delete next.options.fixedCharm;next.options.noCharm=true;}
 try{ForgeEngine.validateRestrictions(data,next);state=ForgeConfig.normalize(data,next);syncOptions();changed();toast('已固定这套防具、炼化和护石');}catch(e){toast(e.message);}
}
function openTemplateLocks(){
 if(!modTemplate){toast('请先导入 Mod 模板');return;}
 $('templateLockChoices').innerHTML=ForgeEngine.PARTS.map((part,i)=>{const a=data.armors.find(a=>a.id===ForgeMod.equipmentFromGame(modTemplate.inventoryList[i+1].IdVal));return '<label class="template-lock-choice"><input type="checkbox" data-template-part="'+part+'" checked>'+ForgeEngine.PART_NAMES[part]+' · '+esc(a.name)+'</label>';}).join('')+'<label class="template-lock-choice"><input type="checkbox" data-template-part="charm" checked>护石</label>';
 $('templateLocksError').classList.add('hidden');$('templateLocksDialog').showModal();
}
function acceptTemplateLocks(){
 try{
  const selected=[...$('templateLockChoices').querySelectorAll('input:checked')].map(x=>x.dataset.templatePart),next=JSON.parse(JSON.stringify(state));
  for(let i=0;i<5;i++){
   const part=ForgeEngine.PARTS[i];if(!selected.includes(part))continue;const item=modTemplate.inventoryList[i+1],id=ForgeMod.equipmentFromGame(item.IdVal),a=data.armors.find(a=>a.id===id),atoms=[];
   if(item.CustomEnable)for(const t of item.CustomBuildup){if(!t.Id)continue;const raw=data.atoms.find(v=>v.pool===a.pool&&v.id===t.Id),v=raw?.values.find(v=>v.value_index===t.ValueIndex);if(!v)throw new Error('模板含未知炼化数值');const atom={atomId:t.Id,value:v.value,count:1};if(raw.category===20)atom.skillId=ForgeMod.skillFromGame(t.SkillId);else atom.valueIndex=t.ValueIndex;atoms.push(atom);}
   next.options.fixedArmors[part]={id,atoms};
  }
  if(selected.includes('charm')){
   const c=modTemplate.inventoryList[7];if(c.IdVal){const skills=c.TalismanSkillIdList.flatMap((id,i)=>id?[{skill_id:ForgeMod.skillFromGame(id),level:c.TalismanSkillLvList[i]}]:[]),slots=c.TalismanDecoSlotNumList.flatMap((n,i)=>i?Array(n).fill(i):[]);next.options.fixedCharm=legalUserCharm(skills,slots);next.options.noCharm=false;}
   else {delete next.options.fixedCharm;next.options.noCharm=true;}
  }
  ForgeEngine.validateRestrictions(data,next);state=ForgeConfig.normalize(data,next);syncOptions();changed();$('templateLocksDialog').close();toast('已固定所选模板装备');
 }catch(e){$('templateLocksError').textContent=e.message;$('templateLocksError').classList.remove('hidden');}
}
async function init(){
 try{
  if($('embeddedData'))data=JSON.parse($('embeddedData').textContent);
  else {const response=await fetch('./data.json');if(!response.ok)throw new Error('数据文件HTTP '+response.status);data=await response.json();}
  let saved;try{const hash=new URLSearchParams(location.hash.slice(1)).get('q');saved=hash?JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(hash),c=>c.charCodeAt(0)))):JSON.parse(localStorage.getItem('sunbreak-forge-v1'));}catch{}
  try{state=ForgeConfig.normalize(data,saved||state);}catch{state=ForgeConfig.normalize(data,state);}
  const types=new Map(data.weapons.map(w=>[w.type,w.typeName]));$('weaponType').innerHTML=[...types].map(([id,name])=>'<option value="'+id+'">'+esc(name)+'</option>').join('');
  const initial=data.weapons.find(w=>w.id===state.weaponId);$('weaponType').value=initial.type;if(initial.rarity!==10)$('rarity').value='all';syncOptions();renderWeapons();setBusy(false);$('share').disabled=false;$('importConfig').disabled=false;
  try{const template=localStorage.getItem('sunbreak-forge-mod-template-v1');if(template)modTemplate=ForgeMod.parse(data,template);}catch{modTemplate=null;}renderModTemplate();
 }catch(e){$('loadError').classList.remove('hidden');$('loadError').textContent='无法载入装备数据：'+e.message+'。请刷新重试。';}
}
$('weaponType').onchange=()=>{renderWeapons(false);changed();};$('rarity').onchange=()=>{renderWeapons();changed();};$('weaponSearch').oninput=()=>{renderWeapons();changed();};$('weaponSelect').onchange=()=>{renderWeapon();changed();};
for(const id of ['sex','rank','seconds','limit','searchMode','resultSort'])$(id).onchange=()=>{state.options[id]=['seconds','limit'].includes(id)?+$(id).value:$(id).value;syncSearchMode();renderFixed();changed();};
for(const id of ['augment','deleteSkills','noCharm','fixedCharms','defenseFallback'])$(id).onchange=()=>{state.options[id]=$(id).checked;if(id==='augment'){$('deleteSkills').disabled=!$(id).checked;$('defenseFallback').disabled=!$(id).checked;}if(id==='noCharm'&&$(id).checked){delete state.options.fixedCharm;renderFixed();}changed();};
$('targetSkills').onclick=event=>{const remove=event.target.closest('[data-remove]');const level=event.target.closest('[data-level]');if(remove)state.skills=state.skills.filter(s=>s.id!==+remove.dataset.remove);else if(level){const r=state.skills.find(s=>s.id===+level.dataset.level);r.level=Math.max(1,Math.min(skill(r.id).max,r.level+ +level.dataset.delta));}else return;renderTargets();changed();};
$('sortSkills').onclick=()=>{state.skills.sort(ForgeConfig.compareSkills);renderTargets();save();toast('已按等级降序、同级ID升序排列');};
$('clearSkills').onclick=()=>{state.skills=[];renderTargets();changed();};$('preset').onclick=()=>{state.skills=[{id:0,level:7},{id:5,level:7},{id:7,level:3},{id:6,level:3},{id:205,level:1}];renderTargets();changed();toast('已载入通用物理目标');};
$('stressPreset').onclick=()=>{state.skills=[{id:0,level:7},{id:5,level:7},{id:6,level:3},{id:7,level:3},{id:205,level:1},{id:203,level:3},{id:228,level:3},{id:226,level:1},{id:227,level:1},{id:233,level:3},{id:225,level:2},{id:232,level:3},{id:229,level:3},{id:224,level:3}];renderTargets();changed();toast('已载入14项目标；这是求解示例，不是伤害配装推荐');};
$('addSkill').onclick=()=>{if(!data)return;$('skillSearch').value='';renderPicker();$('skillDialog').showModal();$('skillSearch').focus();};$('skillSearch').oninput=renderPicker;
$('skillPicker').onclick=event=>{const button=event.target.closest('[data-skill]');if(!button)return;const id=+button.dataset.skill;if(state.skills.some(s=>s.id===id))state.skills=state.skills.filter(s=>s.id!==id);else state.skills.push({id,level:1});renderTargets();renderPicker();changed();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
for(const id of ['skillDialog','rulesDialog','configDialog','modDialog','modExportDialog','equipmentDialog','charmDialog','templateLocksDialog'])$(id).onclick=event=>{if(event.target===$(id)){const rect=$(id).getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$(id).close();}};
$('rulesButton').onclick=$('aboutButton').onclick=()=>$('rulesDialog').showModal();$('solve').onclick=start;
$('cancel').onclick=()=>{finish();$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='搜索已停止'+(found.length?'，保留已校验通过的'+found.length+'套方案。':'。未找到结果不表示无解。');if(!found.length)$('empty').classList.remove('hidden');};
$('results').onclick=event=>{const lock=event.target.closest('[data-lock-result]');if(lock){lockResult(+lock.dataset.lockResult);return;}const modButton=event.target.closest('[data-export-mod]');if(modButton){exportMod(+modButton.dataset.exportMod);return;}const button=event.target.closest('[data-export]');if(button)exportResult(+button.dataset.export);};
$('importMod').onclick=openModImport;$('applyModTemplate').onclick=()=>applyMod('template');$('applyModFull').onclick=()=>applyMod('full');
$('confirmModExport').onclick=confirmModExport;$('modExportDialog').onclose=()=>{pendingModExport=null;};$('modExportName').onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();confirmModExport();}};
$('clearMod').onclick=()=>{modTemplate=null;try{localStorage.removeItem('sunbreak-forge-mod-template-v1');}catch{}renderModTemplate();toast('已清除Mod模板，配装条件保持当前选择');};
$('share').onclick=async()=>{const payload=ForgeConfig.payload(data,state);try{await navigator.clipboard.writeText(JSON.stringify(payload,null,2));toast('已复制纯配装条件，不含网址或账号信息');}catch{downloadJSON('sunbreak-search.json',payload);toast('浏览器限制复制，已下载配装条件JSON');}};
$('importConfig').onclick=()=>{if(busy){toast('请先停止搜索再导入');return;}importFiles.config.reset();$('configText').value='';$('configError').classList.add('hidden');$('configDialog').showModal();$('configText').focus();};
$('applyConfig').onclick=()=>{try{const next=ForgeConfig.normalize(data,JSON.parse($('configText').value));ForgeEngine.validateRestrictions(data,next);state=next;const w=data.weapons.find(w=>w.id===state.weaponId);$('weaponType').value=w.type;$('rarity').value=w.rarity===10?'10':'all';$('weaponSearch').value='';syncOptions();renderWeapons();renderTargets();$('deleteSkills').disabled=!state.options.augment;changed();$('configDialog').close();toast('已导入配装条件');}catch(e){$('configError').textContent=e.message;$('configError').classList.remove('hidden');}};
const importFiles={};
for(const [kind,dialogId,buttonIds] of [['config','configDialog',['applyConfig']],['mod','modDialog',['applyModTemplate','applyModFull']]]){
 importFiles[kind]=ForgeFiles.bind({dialog:$(dialogId),zone:$(kind+'DropZone'),input:$(kind+'File'),text:$(kind+'Text'),error:$(kind+'Error'),status:$(kind+'FileStatus'),buttons:buttonIds.map($)});
 $(dialogId).onclose=()=>importFiles[kind].reset();
}

$('fixedEquipment').onclick=event=>{const edit=event.target.closest('[data-edit-armor]'),unlock=event.target.closest('[data-unlock-armor]');if(edit)openArmor(edit.dataset.editArmor);if(unlock&&!busy){delete state.options.fixedArmors[unlock.dataset.unlockArmor];renderFixed();changed();}};
$('fixedEquipment').onchange=event=>{const part=event.target.dataset.augmentLimit;if(part&&!busy){state.options.augmentLimits[part]=+event.target.value;changed();}};
$('armorSearch').oninput=renderArmorChoices;$('armorSelect').onchange=()=>{armorEditor.id=$('armorSelect').value;armorEditor.atoms=[];renderArmorEditor();};
$('armorAtoms').onchange=event=>{const d=event.target.dataset;if(d.atom!=null){const i=+d.atom,count=armorEditor.atoms[i].count;armorEditor.atoms[i]={...armorEditor.choices[+event.target.value].atom,count};}if(d.atomCount!=null)armorEditor.atoms[+d.atomCount].count=+event.target.value;};
$('armorAtoms').onclick=event=>{const b=event.target.closest('[data-remove-atom]');if(b){armorEditor.atoms.splice(+b.dataset.removeAtom,1);renderArmorEditor();}};
$('addArmorAtom').onclick=()=>{if(armorEditor.choices.length){armorEditor.atoms.push({...armorEditor.choices[0].atom});renderArmorEditor();}};
$('saveArmor').onclick=acceptArmor;$('unlockArmor').onclick=()=>{delete state.options.fixedArmors[armorEditor.part];renderFixed();changed();$('equipmentDialog').close();};
$('charmFields').oninput=event=>{const index=event.target.dataset.charmSkillSearch;if(index!=null)renderCharmSkillOptions(+index);};
$('editCharm').onclick=openCharm;$('saveCharm').onclick=acceptCharm;$('clearCharm').onclick=()=>{delete state.options.fixedCharm;renderFixed();changed();};
$('lockModEquipment').onclick=openTemplateLocks;$('applyTemplateLocks').onclick=acceptTemplateLocks;
$('previousResults').onclick=()=>{resultPage--;renderResults();};$('nextResults').onclick=()=>{resultPage++;renderResults();};
$('resultSort').onchange=()=>{state.options.resultSort=$('resultSort').value;resultPage=0;renderResults();save();};
document.querySelectorAll('.controls input,.controls select,.controls button').forEach(x=>x.disabled=true);
init();
