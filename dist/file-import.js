/* Shared local JSON file input for both import dialogs. */
(function(root){
'use strict';
function bind({dialog,zone,input,text,error,status,buttons}){
 let generation=0,depth=0;
 const hint='每次一个 JSON 文件，最大 2 MB；也可在下方粘贴文本。';
 function reset(){generation++;depth=0;zone.classList.remove('drag-over');input.value='';status.textContent=hint;buttons.forEach(b=>b.disabled=false);}
 function fileDrag(event){return Array.from(event.dataTransfer?.types||[]).includes('Files');}
 async function read(files){
  const token=++generation;depth=0;zone.classList.remove('drag-over');error.classList.add('hidden');status.textContent='正在读取文件…';buttons.forEach(b=>b.disabled=true);
  try{
   if(files.length!==1)throw new Error('请一次选择或拖入一个 JSON 文件');
   const file=files[0];if(!/\.json$/i.test(file.name||''))throw new Error('请选择 .json 文件');
   if(file.size>2000000)throw new Error('文件过大，请选择不超过 2 MB 的单套配装 JSON');
   let content;try{content=await file.text();}catch{throw new Error('无法读取文件，请重新选择');}
   if(token!==generation)return;
   content=content.replace(/^\uFEFF/,'');
   try{JSON.parse(content);}catch{throw new Error('文件不是有效的 JSON，请检查内容或在下方粘贴文本');}
   text.value=content;status.textContent='已读取：'+file.name+'。请点击下方导入按钮应用。';
  }catch(e){if(token===generation){error.textContent=e.message;error.classList.remove('hidden');status.textContent=hint;}}
  finally{if(token===generation)buttons.forEach(b=>b.disabled=false);}
 }
 zone.onclick=()=>input.click();
 input.onchange=()=>{const files=Array.from(input.files||[]);input.value='';if(files.length)return read(files);};
 dialog.ondragenter=event=>{if(!fileDrag(event))return;event.preventDefault();depth++;zone.classList.add('drag-over');};
 dialog.ondragover=event=>{if(!fileDrag(event))return;event.preventDefault();event.dataTransfer.dropEffect='copy';zone.classList.add('drag-over');};
 dialog.ondragleave=()=>{depth=Math.max(0,depth-1);if(!depth)zone.classList.remove('drag-over');};
 dialog.ondrop=event=>{if(!fileDrag(event)&&!event.dataTransfer?.files?.length)return;event.preventDefault();event.stopPropagation();return read(Array.from(event.dataTransfer?.files||[]));};
 text.oninput=()=>{reset();error.classList.add('hidden');};
 reset();return {reset};
}
const api={bind};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeFiles=api;
})(globalThis);
