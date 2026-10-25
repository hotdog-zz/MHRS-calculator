'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,worker,busy=false,clock,started,activeRequest,found=[],state={weaponId:'LongSword:302',skills:[{id:0,level:7},{id:5,level:7},{id:7,level:3},{id:6,level:3},{id:205,level:1}],options:{sex:'MaleOnly',rank:'all',augment:true,deleteSkills:true,seconds:45,limit:3,fixedCharms:true,noCharm:false}};
let modTemplate=null,pendingModExport=null;
const skill=id=>data.skills.find(s=>s.id===+id);
function slotsHTML(slots,empty=true){return '<span class="slots">'+(empty?[...slots,0,0,0].slice(0,3):slots).map(v=>'<span class="slot l'+v+(!v?' empty':'')+'" title="'+(v?v+'级孔':'无孔位')+'">'+(v||'–')+'</span>').join('')+'</span>';}
function save(){try{localStorage.setItem('sunbreak-forge-v1',JSON.stringify(state));}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2800);}
function changed(){save();if(found.length&&!busy){$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='搜索条件已更改。下方保留上次结果，点击“开始配装”更新。';}}
function syncOptions(){for(const id of ['sex','rank','seconds','limit'])$(id).value=String(state.options[id]);for(const id of ['augment','deleteSkills','noCharm','fixedCharms'])$(id).checked=state.options[id];}
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
 busy=value;document.querySelectorAll('.controls input,.controls select,.controls button').forEach(x=>x.disabled=value);$('importMod').disabled=value;$('clearMod').disabled=value;$('solve').disabled=value;$('cancel').disabled=false;$('cancel').classList.toggle('hidden',!value);$('solve').querySelector('span').textContent=value?'正在寻找配装…':'开始配装';if(!value){renderTargets();$('deleteSkills').disabled=!$('augment').checked;}
}
function augmentedLabel(atom){
 const n=atom.value*atom.count;
 if(atom.skillId!=null)return esc(skill(atom.skillId).name)+' '+(n>0?'+':'−')+Math.abs(n)+(atom.count>1?' · '+atom.count+'条':'');
 const raw=data.atoms.find(x=>x.id===atom.atomId);
 if(raw?.category===19)return '孔位增长 +'+n;
 const names={defense:'防御',fire:'火耐性',water:'水耐性',thunder:'雷耐性',ice:'冰耐性',dragon:'龙耐性'};
 return (names[atom.attribute]||'属性')+' '+(n>0?'+':'−')+Math.abs(n)+(atom.count>1?' · '+atom.count+'条':'');
}
function renderResult(r,index){
 const req=new Set(activeRequest.skills.map(s=>s.id));const weapon=data.weapons.find(w=>w.id===r.weaponId);const names=Object.fromEntries(r.pieces.map(p=>[p.id,p.name]));names[weapon.id]=weapon.name;names.charm=r.charm.name;
 let html='<article class="result-card"><div class="result-card-head"><span class="result-number">'+String(index+1).padStart(2,'0')+'</span><div><h3>可行配装方案</h3><span class="verified">✓ 炼化预算、技能与插珠校验通过</span></div><div class="result-export-actions"><button class="export-result" data-export="'+index+'">导出 JSON ↓</button><button class="export-result export-mod" data-export-mod="'+index+'">Mod 导出 ↓</button></div></div>';
 html+='<div class="result-metrics"><span><b>'+r.defense+'</b>基础防御</span><span><b>'+r.records+'</b>炼化词条</span><span><b>'+r.decoCount+'</b>珠子</span><span><b>'+r.unusedSlots.length+'</b>空余孔位</span></div><div class="result-main">';
 html+='<div class="equip-row"><div class="equip-line"><span class="equip-part">武器</span><div class="equip-content"><div class="equip-name">'+esc(weapon.name)+'</div><div class="equip-sub">'+esc(weapon.typeName)+' · 使用原生孔位</div></div>'+slotsHTML(weapon.slots)+'</div></div>';
 for(const p of r.pieces){
  const score=r.scores?.[p.id];const native=p.skills.map(s=>esc(skill(s.skill_id).name)+' '+s.level).join(' / ');
  html+='<div class="equip-row"><div class="equip-line"><span class="equip-part">'+ForgeEngine.PART_NAMES[p.part]+'</span><div class="equip-content"><div class="equip-name">'+esc(p.name)+'</div><div class="equip-sub">'+native+'</div></div>'+slotsHTML(p.slots)+'</div>';
  if(p.records)html+='<details open><summary><span class="budget"><span>炼化 '+p.records+' / 7条</span><span>cost '+p.cost+' / '+p.budget+'</span>'+(score?'<span>原生等效 '+(score.native+score.slot).toFixed(1)+'</span>':'')+'</span></summary><div class="augment-list">'+p.atoms.map(a=>'<span class="augment'+(a.value<0?' negative':'')+'">'+augmentedLabel(a)+'</span>').join('')+'</div></details>';
  else html+='<div class="aug-empty">无需炼化'+(score?' · 原生等效 '+(score.native+score.slot).toFixed(1):'')+'</div>';
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
function finish(){clearInterval(clock);setBusy(false);$('progress').classList.add('hidden');if(worker){worker.terminate();worker=null;}}
function start(){
 try{ForgeEngine.validateRequest(data,state);}catch(e){toast(e.message);return;}
 activeRequest=JSON.parse(JSON.stringify(state));found=[];$('results').replaceChildren();$('resultCount').textContent='0';$('empty').classList.add('hidden');$('statusMessage').classList.add('hidden');$('progress').classList.remove('hidden');$('progressTitle').textContent='准备求解…';$('progressDetail').textContent='整理目标技能与合法候选';started=Date.now();$('timer').textContent='0s';setBusy(true);clock=setInterval(()=>$('timer').textContent=Math.floor((Date.now()-started)/1000)+'s',250);
 const embeddedWorker=$('embeddedWorker');let workerURL;
 if(embeddedWorker){const bytes=Uint8Array.from(atob(embeddedWorker.textContent.trim()),c=>c.charCodeAt(0));workerURL=URL.createObjectURL(new Blob([new TextDecoder().decode(bytes)],{type:'text/javascript'}));worker=new Worker(workerURL);worker.addEventListener('message',()=>URL.revokeObjectURL(workerURL),{once:true});}
 else worker=new Worker('./worker.js');
 worker.onmessage=event=>{
  const p=event.data;
  if(p.phase==='result'){found.push(p.result);renderResult(p.result,found.length-1);}
  if(p.message)$('progressTitle').textContent=p.message;
  if(p.phase==='model')$('progressDetail').textContent='第'+p.stage+'轮 · '+p.armors+'件防具 · '+p.charms+'枚护石候选';
  if(p.phase==='solve')$('progressDetail').textContent='整数约束求解 · '+p.variables.toLocaleString()+'个决策变量';
  if(p.phase==='done'){
   finish();const r=p.response;$('statusMessage').classList.remove('hidden');
   $('statusMessage').textContent=r.results.length?'已找到 '+r.results.length+' 套可行方案 · 用时 '+(r.elapsedMs/1000).toFixed(1)+' 秒 · 每套均已重新校验。':'本次搜索尚未找到可行方案。可延长时限、检查技能目标或启用炼化；这不表示全局无解。';
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
async function init(){
 try{
  if($('embeddedData'))data=JSON.parse($('embeddedData').textContent);
  else {const response=await fetch('./data.json');if(!response.ok)throw new Error('数据文件HTTP '+response.status);data=await response.json();}
  let saved;try{const hash=new URLSearchParams(location.hash.slice(1)).get('q');saved=hash?JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(hash),c=>c.charCodeAt(0)))):JSON.parse(localStorage.getItem('sunbreak-forge-v1'));}catch{}
  if(saved&&data.weapons.some(w=>w.id===saved.weaponId)&&Array.isArray(saved.skills)){
   state.weaponId=saved.weaponId;state.skills=saved.skills.filter(r=>skill(r.id)&&Number.isInteger(r.level)&&r.level>=1&&r.level<=skill(r.id).max);state.skills=state.skills.filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i);state.options={...state.options,...saved.options};
   state.options.sex=['MaleOnly','FemaleOnly'].includes(state.options.sex)?state.options.sex:'MaleOnly';state.options.rank=state.options.rank==='Master'?'Master':'all';state.options.seconds=[15,45,90].includes(+state.options.seconds)?+state.options.seconds:45;state.options.limit=[1,3,5].includes(+state.options.limit)?+state.options.limit:3;
  }
  const types=new Map(data.weapons.map(w=>[w.type,w.typeName]));$('weaponType').innerHTML=[...types].map(([id,name])=>'<option value="'+id+'">'+esc(name)+'</option>').join('');
  const initial=data.weapons.find(w=>w.id===state.weaponId);$('weaponType').value=initial.type;if(initial.rarity!==10)$('rarity').value='all';syncOptions();renderWeapons();setBusy(false);$('share').disabled=false;$('importConfig').disabled=false;
  try{const template=localStorage.getItem('sunbreak-forge-mod-template-v1');if(template)modTemplate=ForgeMod.parse(data,template);}catch{modTemplate=null;}renderModTemplate();
 }catch(e){$('loadError').classList.remove('hidden');$('loadError').textContent='无法载入装备数据：'+e.message+'。请刷新重试。';}
}
$('weaponType').onchange=()=>{renderWeapons(false);changed();};$('rarity').onchange=()=>{renderWeapons();changed();};$('weaponSearch').oninput=()=>{renderWeapons();changed();};$('weaponSelect').onchange=()=>{renderWeapon();changed();};
for(const id of ['sex','rank','seconds','limit'])$(id).onchange=()=>{state.options[id]=['seconds','limit'].includes(id)?+$(id).value:$(id).value;changed();};
for(const id of ['augment','deleteSkills','noCharm','fixedCharms'])$(id).onchange=()=>{state.options[id]=$(id).checked;if(id==='augment')$('deleteSkills').disabled=!$(id).checked;changed();};
$('targetSkills').onclick=event=>{const remove=event.target.closest('[data-remove]');const level=event.target.closest('[data-level]');if(remove)state.skills=state.skills.filter(s=>s.id!==+remove.dataset.remove);else if(level){const r=state.skills.find(s=>s.id===+level.dataset.level);r.level=Math.max(1,Math.min(skill(r.id).max,r.level+ +level.dataset.delta));}else return;renderTargets();changed();};
$('sortSkills').onclick=()=>{state.skills.sort(ForgeConfig.compareSkills);renderTargets();save();toast('已按等级降序、同级ID升序排列');};
$('clearSkills').onclick=()=>{state.skills=[];renderTargets();changed();};$('preset').onclick=()=>{state.skills=[{id:0,level:7},{id:5,level:7},{id:7,level:3},{id:6,level:3},{id:205,level:1}];renderTargets();changed();toast('已载入通用物理目标');};
$('stressPreset').onclick=()=>{state.skills=[{id:0,level:7},{id:5,level:7},{id:6,level:3},{id:7,level:3},{id:205,level:1},{id:203,level:3},{id:228,level:3},{id:226,level:1},{id:227,level:1},{id:233,level:3},{id:225,level:2},{id:232,level:3},{id:229,level:3},{id:224,level:3}];renderTargets();changed();toast('已载入14项目标；这是求解示例，不是伤害配装推荐');};
$('addSkill').onclick=()=>{if(!data)return;$('skillSearch').value='';renderPicker();$('skillDialog').showModal();$('skillSearch').focus();};$('skillSearch').oninput=renderPicker;
$('skillPicker').onclick=event=>{const button=event.target.closest('[data-skill]');if(!button)return;const id=+button.dataset.skill;if(state.skills.some(s=>s.id===id))state.skills=state.skills.filter(s=>s.id!==id);else state.skills.push({id,level:1});renderTargets();renderPicker();changed();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
for(const id of ['skillDialog','rulesDialog','configDialog','modDialog','modExportDialog'])$(id).onclick=event=>{if(event.target===$(id)){const rect=$(id).getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$(id).close();}};
$('rulesButton').onclick=$('aboutButton').onclick=()=>$('rulesDialog').showModal();$('solve').onclick=start;
$('cancel').onclick=()=>{finish();$('statusMessage').classList.remove('hidden');$('statusMessage').textContent='搜索已停止'+(found.length?'，保留已校验通过的'+found.length+'套方案。':'。未找到结果不表示无解。');if(!found.length)$('empty').classList.remove('hidden');};
$('results').onclick=event=>{const modButton=event.target.closest('[data-export-mod]');if(modButton){exportMod(+modButton.dataset.exportMod);return;}const button=event.target.closest('[data-export]');if(button)exportResult(+button.dataset.export);};
$('importMod').onclick=openModImport;$('applyModTemplate').onclick=()=>applyMod('template');$('applyModFull').onclick=()=>applyMod('full');
$('confirmModExport').onclick=confirmModExport;$('modExportDialog').onclose=()=>{pendingModExport=null;};$('modExportName').onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();confirmModExport();}};
$('clearMod').onclick=()=>{modTemplate=null;try{localStorage.removeItem('sunbreak-forge-mod-template-v1');}catch{}renderModTemplate();toast('已清除Mod模板，配装条件保持当前选择');};
$('share').onclick=async()=>{const payload=ForgeConfig.payload(data,state);try{await navigator.clipboard.writeText(JSON.stringify(payload,null,2));toast('已复制纯配装条件，不含网址或账号信息');}catch{downloadJSON('sunbreak-search.json',payload);toast('浏览器限制复制，已下载配装条件JSON');}};
$('importConfig').onclick=()=>{if(busy){toast('请先停止搜索再导入');return;}importFiles.config.reset();$('configText').value='';$('configError').classList.add('hidden');$('configDialog').showModal();$('configText').focus();};
$('applyConfig').onclick=()=>{try{const next=ForgeConfig.normalize(data,JSON.parse($('configText').value));state=next;const w=data.weapons.find(w=>w.id===state.weaponId);$('weaponType').value=w.type;$('rarity').value=w.rarity===10?'10':'all';$('weaponSearch').value='';syncOptions();renderWeapons();renderTargets();$('deleteSkills').disabled=!state.options.augment;changed();$('configDialog').close();toast('已导入配装条件');}catch(e){$('configError').textContent=e.message;$('configError').classList.remove('hidden');}};
const importFiles={};
for(const [kind,dialogId,buttonIds] of [['config','configDialog',['applyConfig']],['mod','modDialog',['applyModTemplate','applyModFull']]]){
 importFiles[kind]=ForgeFiles.bind({dialog:$(dialogId),zone:$(kind+'DropZone'),input:$(kind+'File'),text:$(kind+'Text'),error:$(kind+'Error'),status:$(kind+'FileStatus'),buttons:buttonIds.map($)});
 $(dialogId).onclose=()=>importFiles[kind].reset();
}
document.querySelectorAll('.controls input,.controls select,.controls button').forEach(x=>x.disabled=true);
init();
