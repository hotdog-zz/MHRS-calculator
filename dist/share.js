/* Self-contained loadout sharing. QR data contains no host, account or Mod template. */
(function(root){
'use strict';
const E=root.ForgeEngine||(typeof require==='function'?require('./engine.js'):null);
const I=root.ForgeInventory||(typeof require==='function'?require('./inventory.js'):null);
const C=root.ForgeConfig||(typeof require==='function'?require('./config.js'):null);
const LZ=root.LZString||(typeof require==='function'?require('./vendor/lz-string.js'):null);
const QR=root.qrcode||(typeof require==='function'?require('./vendor/qrcode.js'):null);
const jsQR=root.jsQR||(typeof require==='function'?require('./vendor/jsQR.js'):null);
const PREFIX='SBF1:',MAX_TOKEN=2300,MAX_FILE=20*1024*1024;
const clone=x=>JSON.parse(JSON.stringify(x));
const skill=(data,id)=>data.skills.find(s=>s.id===id);
function check(test,message='方案数据格式不正确'){if(!test)throw new Error(message);}
async function digest(text){
 const api=root.crypto?.subtle||(typeof require==='function'?require('node:crypto').webcrypto.subtle:null);
 check(api,'浏览器不支持方案校验，请使用较新的浏览器');
 return Array.from(new Uint8Array(await api.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
}
function cleanCharm(data,c){
 if(c.empty)return {id:'none',name:'不使用护石',empty:true,skills:[],slots:[]};
 if(c.fixed){const f=data.fixedCharms.find(f=>f.id===c.id);check(f,'未知特典护石');return {...clone(f),fixed:true,name:f.name_zh};}
 return {id:'shared',name:E.METHOD_NAMES[data.melding.methods[c.method]?.pattern]||'护石',method:c.method,skills:c.skills.map(s=>({skill_id:s.skill_id,level:s.level})),slots:[...c.slots]};
}
function lockedRequest(data,request,result){
 const q=C.normalize(data,request);
 q.options.fixedArmors=Object.fromEntries(result.pieces.map(p=>[p.part,{id:p.id,atoms:clone(p.atoms)}]));
 q.options.noCharm=!!result.charm.empty;if(result.charm.empty)delete q.options.fixedCharm;else q.options.fixedCharm=cleanCharm(data,result.charm);
 return q;
}
function pack(data,request,result){
 const preset=request.options?.ownedOnly||request.options?.presetEquipment||result.owned;const shared=preset?I.shareable(data,request,result):null,q=shared?.request||C.normalize(data,request);if(!preset)E.validateRequest(data,q);const r=shared?.result||E.validateResult(data,q,result),o=q.options;
 const armors=E.PARTS.map(part=>{const p=r.pieces.find(p=>p.part===part);return [p.id,E.orderedAtoms(data,p,p.atoms).map(a=>{
  const raw=data.atoms.find(v=>v.pool===p.pool&&v.id===a.atomId),v=raw.values.find(v=>v.value===a.value&&(a.valueIndex==null||v.value_index===a.valueIndex));
  return [a.atomId,a.skillId??-1,v.value_index,a.count,a.fallback?1:0];
 })];});
 const c=r.charm,charm=c.empty?[0]:c.fixed?[1,c.id]:[2,c.method,c.skills.map(s=>[s.skill_id,s.level]),c.slots];
 const payload=[1,data.meta.version,r.weaponId,(o.augment?1:0)|(o.deleteSkills?2:0)|(o.defenseFallback?4:0)|(o.sex==='FemaleOnly'?8:0)|(o.rank==='Master'?16:0),[...q.skills].sort((a,b)=>a.id-b.id).map(s=>[s.id,s.level]),armors,charm,r.decorations.map(d=>[d.id,d.count])];
 if(preset){payload[0]=3;payload.push(q.rampageDecorationId??-1);}else if(q.rampageDecorationId!==undefined){payload[0]=2;payload.push(q.rampageDecorationId);}return payload;
}
function unpack(data,p){
 check(Array.isArray(p)&&((p[0]===1&&p.length===8)||([2,3].includes(p[0])&&p.length===9)),'不支持的方案格式');check(p[1]===data.meta.version,'方案数据版本不一致，请更新配装工房后导入');
 const [, ,weaponId,flags,goals,armors,charm,decos]=p;
 check(Number.isInteger(flags)&&flags>=0&&flags<32&&Array.isArray(goals)&&goals.length<=256&&Array.isArray(armors)&&armors.length===5&&Array.isArray(charm)&&Array.isArray(decos)&&decos.length<=64);
 const pieces=armors.map((row,i)=>{
  check(Array.isArray(row)&&row.length===2&&Array.isArray(row[1])&&row[1].length<=7);
  const a=data.armors.find(a=>a.id===row[0]&&a.part===E.PARTS[i]);check(a,'方案包含未知防具或部位不正确');
  row[1].forEach(t=>check(Array.isArray(t)&&t.length===5&&t.every(Number.isSafeInteger)&&[0,1].includes(t[4])));
  // Resolve against the selected armor, never a same-ID effect in another Pool.
  return {id:a.id,atoms:row[1].map(t=>{
   const raw=data.atoms.find(v=>v.pool===a.pool&&v.id===t[0]),v=raw?.values.find(v=>v.value_index===t[2]);check(raw&&v,'方案炼化词条不在装备数据中');
   check(raw.category===20?t[1]>=0:t[1]===-1,'方案词条的技能字段不正确');
   return {atomId:t[0],value:v.value,valueIndex:t[2],count:t[3],...(raw.category===20?{skillId:t[1]}:{}),...(t[4]?{fallback:true}:{})};
  })};
 });
 let c;if(charm[0]===0){check(charm.length===1);c={id:'none',empty:true,name:'不使用护石',skills:[],slots:[]};}
 else if(charm[0]===1){check(charm.length===2);const f=data.fixedCharms.find(f=>f.id===charm[1]);check(f,'未知特典护石');c={...clone(f),fixed:true,name:f.name_zh};}
 else {check(charm[0]===2&&charm.length===4&&Array.isArray(charm[2])&&charm[2].length<=2&&Array.isArray(charm[3])&&charm[3].length<=3);c=cleanCharm(data,{method:charm[1],skills:charm[2].map(s=>{check(Array.isArray(s)&&s.length===2);return {skill_id:s[0],level:s[1]};}),slots:charm[3]});}
 const request=C.normalize(data,{weaponId,...([2,3].includes(p[0])&&p[8]!==-1?{rampageDecorationId:C.validateRampageId(data,p[8])}:{}),skills:goals.map(s=>{check(Array.isArray(s)&&s.length===2);return {id:s[0],level:s[1]};}),options:{...(p[0]===3?{presetEquipment:true}:{}),augment:!!(flags&1),deleteSkills:!!(flags&2),defenseFallback:!!(flags&4),sex:flags&8?'FemaleOnly':'MaleOnly',rank:flags&16?'Master':'all',noCharm:!!c.empty}});
 if(p[0]!==3)E.validateRequest(data,request);
 const result=(p[0]===3?I.validatePreset:E.validateResult)(data,request,{weaponId,armors:pieces,charm:c,decorations:decos.map(t=>{check(Array.isArray(t)&&t.length===2);return {id:t[0],count:t[1]};})});
 return {request:lockedRequest(data,request,result),result};
}
async function encode(data,request,result){
 const payload=pack(data,request,result),json=JSON.stringify(payload),id=await digest(json),token=PREFIX+id+':'+LZ.compressToEncodedURIComponent(json);
 check(token.length<=MAX_TOKEN,'这套方案超过单个二维码容量，请使用方案JSON分享');
 return {id,token,...unpack(data,payload)};
}
async function decode(data,text){
 let token=String(text).trim();if(!token.startsWith(PREFIX)){
  try{const u=new URL(token);token=new URLSearchParams(u.hash.slice(1)).get('s')||token;}catch{}
 }
 const match=/^SBF1:([0-9a-f]{64}):([A-Za-z0-9+\-$]+)$/.exec(token);check(match&&token.length<=MAX_TOKEN,'请粘贴完整方案码，或选择带二维码的分享图片');
 const json=LZ.decompressFromEncodedURIComponent(match[2]);check(json&&json.length<=100000,'方案数据损坏');check(await digest(json)===match[1],'方案校验失败：数据损坏或不完整');
 let payload;try{payload=JSON.parse(json);}catch{throw new Error('方案内容无法解析');}
 return {id:match[1],token,...unpack(data,payload)};
}
async function parseText(data,text){
 const s=String(text).trim();if(!s.startsWith('{'))return decode(data,s);
 let p;try{p=JSON.parse(s);}catch{throw new Error('方案JSON格式错误');}
 if(p.token)return decode(data,p.token);
 check(p.application==='Sunbreak Forge'&&p.request&&p.result,'请选择本工具导出的完整方案JSON，条件JSON不包含具体方案');
 if(p.dataVersion!=null)check(p.dataVersion===data.meta.version,'方案数据版本不一致，请更新配装工房后导入');
 const q=C.normalize(data,p.request),r=p.result;check(Array.isArray(r.armors)&&Array.isArray(r.decorations)&&r.charm);
 const result={weaponId:r.weaponId,armors:r.armors.map(p=>({id:p.id,atoms:p.atoms})),charm:cleanCharm(data,r.charm),decorations:r.decorations.map(d=>({id:d.id,count:d.count}))};
 return encode(data,q,result);
}
function makeQr(token){try{const qr=QR(0,'M');qr.addData(token,'Byte');qr.make();return qr;}catch{throw new Error('方案数据超过二维码容量，请使用方案JSON分享');}}
function drawQr(ctx,qr,x,y,scale){
 const n=qr.getModuleCount(),side=(n+8)*scale;ctx.fillStyle='#fff';ctx.fillRect(x,y,side,side);ctx.fillStyle='#000';
 for(let row=0;row<n;row++)for(let col=0;col<n;col++)if(qr.isDark(row,col))ctx.fillRect(x+(col+4)*scale,y+(row+4)*scale,scale,scale);
 return {x,y,width:side,height:side};
}
function decodePixels(pixels,width,height){return jsQR(pixels,width,height,{inversionAttempts:'attemptBoth'})?.data||null;}
function newCanvas(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
async function readFile(file,createCanvas=newCanvas){
 check(file&&file.size>0&&file.size<=MAX_FILE,'请选择不超过20MB的图片或方案JSON');
 if(/\.json$/i.test(file.name||'')||file.type==='application/json')return file.text();
 check(/^image\//.test(file.type)||/\.(png|jpe?g|webp|bmp)$/i.test(file.name||''),'请选择PNG、JPG、WebP图片或完整方案JSON');
 let img,url;try{
  if(typeof createImageBitmap==='function')img=await createImageBitmap(file);
  else {url=URL.createObjectURL(file);img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('无法读取图片'));i.src=url;});}
  const w=img.width,h=img.height;check(w>0&&h>0&&w*h<=64000000,'图片尺寸过大，请裁出右下角二维码后重试');
  const crop=Math.min(1200,w,h),regions=[[w-crop,h-crop,crop,crop],[0,0,w,h]];
  for(const [sx,sy,sw,sh] of regions){const ratio=Math.min(1,2200/Math.max(sw,sh)),cw=Math.round(sw*ratio),ch=Math.round(sh*ratio),canvas=createCanvas(cw,ch),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,sx,sy,sw,sh,0,0,cw,ch);const token=decodePixels(ctx.getImageData(0,0,cw,ch).data,cw,ch);if(token?.startsWith(PREFIX))return token;}
  throw new Error('未识别到方案二维码，请选择原图，或裁出二维码后重试');
 }finally{if(url)URL.revokeObjectURL(url);img?.close?.();}
}
function atomLabel(data,p,a){
 const raw=data.atoms.find(v=>v.pool===p.pool&&v.id===a.atomId),n=a.value*a.count;
 const name=a.skillId!=null?skill(data,a.skillId).name:raw.category===19?'孔位增长':({defense:'防御',fire:'火耐性',water:'水耐性',thunder:'雷耐性',ice:'冰耐性',dragon:'龙耐性'}[a.attribute]||'属性');
 return '#'+a.atomId+'  '+(a.fallback?'防御兜底 · ':'')+name+' '+(n>0?'+':'−')+Math.abs(n)+(a.count>1?'（'+a.count+'条）':'');
}
function wrap(ctx,text,width){
 const lines=[];for(const paragraph of String(text).split('\n')){let line='';for(const ch of paragraph){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=ch;}else line+=ch;}lines.push(line);}return lines;
}
function renderImage(data,shared,createCanvas=newCanvas){
 const r=shared.result,W=1920,P=40,G=18,font='"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif';
 const palette={bg:'#202235',panel:'#2b2d47',cell:'#333650',line:'#454862',ink:'#f2f3fa',muted:'#b8bdd0',green:'#9cdbb6',red:'#f0a1aa',gold:'#edca7b'};
 const qr=makeQr(shared.token),scale=4,side=(qr.getModuleCount()+8)*scale,RW=Math.max(460,side+36),LW=W-P*2-G-RW,RX=P+LW+G;
 const measure=createCanvas(1,1).getContext('2d'),setMeasure=size=>{measure.font=size+'px '+font;};
 const weapon=data.weapons.find(w=>w.id===r.weaponId),charm=cleanCharm(data,r.charm);
 const placements=owner=>{const items=r.placement.filter(p=>p.owner===owner).sort((a,b)=>a.index-b.index);
  if(items.length&&items.every(p=>!p.decorationId))return ['空孔 '+items.map(p=>'【'+p.level+'】').join(' / ')];
  return items.map(p=>{
  const d=data.decorations.find(d=>d.id===p.decorationId);return d?d.name+'（'+d.skills.map(s=>skill(data,s.skill_id).name+' Lv'+s.level).join(' / ')+'）':'【'+p.level+'】空孔';
 });};
 function flow(chunks,width){
  setMeasure(23);let x=0,y=0;const runs=[];
  for(const chunk of chunks){let text='';for(const char of chunk.text){
   if(text&&x+measure.measureText(text+char).width>width){runs.push({...chunk,text,x,y});text='';x=0;y+=33;}
   if(!text&&x+measure.measureText(char).width>width){x=0;y+=33;}text+=char;
  }if(text){runs.push({...chunk,text,x,y});x+=measure.measureText(text).width+16;}}
  return {runs,height:runs.length?y+33:0};
 }
 function layoutCard(card){
  setMeasure(30);card.titleRows=wrap(measure,card.title,LW-48);const titleWidth=measure.measureText(card.title).width;
  card.titleH=card.titleRows.length*39+15;
  setMeasure(21);card.statRows=wrap(measure,card.stats,LW-48);card.statWidth=measure.measureText(card.stats).width;
  card.inlineStats=card.titleRows.length===1&&titleWidth+card.statWidth+30<=LW-48;card.statH=card.inlineStats?0:card.statRows.length*29;
  card.aug=flow(card.lines,LW-48);
  const contentW=LW-48,skillW=Math.floor(contentW*0.53),decoX=skillW+20,decoW=contentW-decoX,cellW=(skillW-10)/2;
  card.skillW=skillW;card.decoX=decoX;card.decoW=decoW;card.cells=[];setMeasure(24);let gridY=0;
  for(let i=0;i<card.skills.length;i+=2){const row=card.skills.slice(i,i+2).map(t=>wrap(measure,t,cellW-18)),height=Math.max(...row.map(lines=>lines.length))*32+9;
   row.forEach((lines,col)=>card.cells.push({x:col*(cellW+10),y:gridY,width:cellW,height:height-4,lines}));gridY+=height;
  }
  setMeasure(24);card.decoRows=card.decos.flatMap(text=>wrap(measure,text,decoW));
  card.bodyH=Math.max(gridY,card.decoRows.length*35,38);card.bodyY=card.titleH+card.statH+card.aug.height+33;
  setMeasure(21);card.summaryRows=card.summary?wrap(measure,card.summary,LW-48):[];
  card.height=card.bodyY+card.bodyH+card.summaryRows.length*29+21;return card;
 }
 const cards=r.pieces.map(p=>layoutCard({owner:p.id,title:E.PART_NAMES[p.part]+' · '+p.name,stats:'孔位 '+(p.slots.join('-')||'无')+'    防御 '+p.finalDefense+'    炼化 '+p.records+'/7条'+(p.preset?'    预设装备':'    cost '+p.cost+'/'+p.budget),
  lines:E.orderedAtoms(data,p,p.atoms).map(a=>({text:atomLabel(data,p,a).replace(/^#\d+\s+/,''),fullText:atomLabel(data,p,a),color:a.fallback?palette.gold:a.value<0?palette.red:palette.green})),
  skills:Object.entries(p.levels).filter(([,n])=>n>0).map(([id,n])=>({id:+id,level:n})).sort(C.compareSkills).map(s=>skill(data,s.id).name+' Lv'+s.level),decos:placements(p.id),
  summary:E.fallbackSummary(p.fallback)
 }));
 cards.push(layoutCard({owner:'charm',title:'护石 · '+charm.name,stats:'孔位 '+(charm.slots.join('-')||'无')+'    '+(charm.empty?'未使用护石':'技能与孔位已校验'),lines:[],skills:charm.skills.map(s=>skill(data,s.skill_id).name+' Lv'+s.level),decos:placements('charm'),summary:''}));
 const weaponCard=layoutCard({owner:weapon.id,title:'武器 · '+weapon.name,stats:weapon.typeName+'    原生孔位 '+(weapon.slots.join('-')||'无'),lines:[],skills:['使用原生武器孔位','百龙珠 · '+C.rampageLabel(data,shared.request)],decos:placements(weapon.id),summary:''});
 let y=112;for(const card of [weaponCard,...cards]){card.x=P;card.y=y;card.width=LW;y+=card.height+12;}
 const totals=Object.entries(r.totals).filter(([,n])=>n>0).map(([id,n])=>({id:+id,level:Math.min(n,skill(data,+id).max)})).sort(C.compareSkills);
 setMeasure(26);let skillY=182;const finalSkills=totals.map(s=>{const lines=wrap(measure,skill(data,s.id).name,RW-135),height=Math.max(43,lines.length*34+8),item={...s,lines,y:skillY,height};skillY+=height;return item;});
 const H=Math.max(y+154,skillY+side+80)+P;check(H<=16000,'分享图片过长，请减少方案内容后重试');
 const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');ctx.fillStyle=palette.bg;ctx.fillRect(0,0,W,H);
 const text=(s,x,y,color=palette.ink,size=24,bold=false)=>{ctx.fillStyle=color;ctx.font=(bold?'600 ':'')+size+'px '+font;ctx.fillText(s,x,y);};
 ctx.fillStyle='#191b2c';ctx.fillRect(0,0,W,92);text('曙光配装工房 · 配装分享',P,57,palette.ink,34,true);
 const metrics='基础防御 '+r.defense+'   炼化 '+r.records+'条   装饰品 '+r.decoCount+'颗';ctx.font='25px '+font;text(metrics,W-P-ctx.measureText(metrics).width,56,palette.gold,25,true);
 for(const card of [weaponCard,...cards]){
  ctx.fillStyle=palette.panel;ctx.fillRect(card.x,card.y,card.width,card.height);ctx.fillStyle='#44435c';ctx.fillRect(card.x,card.y,5,card.height);
  card.titleRows.forEach((line,i)=>text(line,card.x+24,card.y+39+i*39,palette.ink,30,true));
  if(card.inlineStats)text(card.stats,card.x+card.width-24-card.statWidth,card.y+36,palette.muted,21);
  else card.statRows.forEach((line,i)=>text(line,card.x+24,card.y+card.titleH+21+i*29,palette.muted,21));
  card.aug.runs.forEach(run=>text(run.text,card.x+24+run.x,card.y+card.titleH+card.statH+25+run.y,run.color,23));
  const bodyY=card.y+card.bodyY;text(card.owner===weapon.id?'武器信息':'装备技能（含炼化）',card.x+24,bodyY-9,palette.muted,19);text('装饰品 · 按孔位顺序',card.x+24+card.decoX,bodyY-9,palette.muted,19);
  for(const cell of card.cells){ctx.fillStyle=palette.cell;ctx.fillRect(card.x+24+cell.x,bodyY+cell.y,cell.width,cell.height);cell.lines.forEach((line,i)=>text(line,card.x+32+cell.x,bodyY+cell.y+26+i*32,palette.ink,24));}
  card.decoRows.forEach((line,i)=>text(line,card.x+24+card.decoX,bodyY+27+i*35,palette.ink,24));
  card.summaryRows.forEach((line,i)=>text(line,card.x+24,bodyY+card.bodyH+22+i*29,palette.muted,21));
 }
 ctx.fillStyle=palette.panel;ctx.fillRect(RX,112,RW,H-P-112);text('最终技能',RX+18,152,palette.ink,29,true);
 finalSkills.forEach((s,i)=>{if(i%2===0){ctx.fillStyle=palette.cell;ctx.fillRect(RX+8,s.y-25,RW-16,s.height);}s.lines.forEach((line,j)=>text(line,RX+18,s.y+3+j*34,palette.ink,26));const level=s.level+' / '+skill(data,s.id).max;ctx.font='600 29px '+font;text(level,W-P-18-ctx.measureText(level).width,s.y+5,s.level===skill(data,s.id).max?palette.gold:palette.ink,29,true);});
 const qrX=W-P-side,qrY=H-P-side;drawQr(ctx,qr,qrX,qrY,scale);text('识别二维码 · 导入同一方案',RX+18,qrY-18,palette.muted,23);
 const footerY=H-P-124;text('曙光配装工房',P,footerY,palette.ink,29,true);text('导入方案 → 选择分享图片，或粘贴扫码内容',P,footerY+37,palette.muted,22);
 const note='基础防御不含铠玉强化；武器炼化、百龙珠与花链不参与计算。'+(r.stormsoulConservative?'风雷合一额外技能未计入。':'');setMeasure(20);wrap(measure,note,LW-24).forEach((line,i)=>text(line,P,footerY+69+i*27,palette.muted,20));
 text('SHA-256 '+shared.id,P,H-P,palette.muted,17);
 return {canvas,width:W,height:H,qrBounds:{x:qrX,y:qrY,width:side,height:side},cards,weaponCard,finalSkills,layout:'compact-columns',equipmentBounds:{x:P,y:112,width:LW,height:y-112},skillBounds:{x:RX,y:112,width:RW,height:skillY-112},padding:P};
}
const api={pack,unpack,encode,decode,parseText,lockedRequest,makeQr,drawQr,decodePixels,readFile,renderImage,atomLabel,wrap};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeShare=api;
})(globalThis);
