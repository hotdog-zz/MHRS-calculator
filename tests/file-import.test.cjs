const {test}=require('node:test');const assert=require('node:assert/strict');
const F=require('../dist/file-import.js');
function fixture(){
 const el=()=>{const c=new Set();return {value:'',textContent:'',disabled:false,clicks:0,click(){this.clicks++;},classList:{add:x=>c.add(x),remove:x=>c.delete(x),contains:x=>c.has(x)}};};
 const elements={dialog:el(),zone:el(),input:el(),text:el(),error:el(),status:el(),buttons:[el(),el()]};
 return {...elements,control:F.bind(elements)};
}
const file=(name,content)=>({name,size:Buffer.byteLength(content),text:async()=>content});
const event=files=>({dataTransfer:{types:['Files'],files},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
test('拖拽读取UTF-8 BOM JSON，只填充文本，阻止浏览器打开文件',async()=>{
 const f=fixture(),e=event([file('技能.JSON','\uFEFF{"skills":[]}')]);
 f.dialog.ondragenter(e);assert.equal(f.zone.classList.contains('drag-over'),true);
 await f.dialog.ondrop(e);assert.equal(e.prevented,true);assert.equal(e.stopped,true);assert.equal(f.text.value,'{"skills":[]}');assert.match(f.status.textContent,/技能.JSON/);assert.equal(f.zone.classList.contains('drag-over'),false);assert.ok(f.buttons.every(b=>!b.disabled));
});
test('点击选择文件，同一文件可重复读取，取消选择保留文本',async()=>{
 const f=fixture();f.zone.onclick();assert.equal(f.input.clicks,1);
 f.input.files=[file('条件.json','{"a":1}')];await f.input.onchange();assert.equal(f.input.value,'');assert.equal(f.text.value,'{"a":1}');
 f.input.files=[];await f.input.onchange();assert.equal(f.text.value,'{"a":1}');
 f.input.files=[file('条件.json','{"a":2}')];await f.input.onchange();assert.equal(f.text.value,'{"a":2}');
});
test('多文件、非JSON、超限和格式错误不覆盖已有文本',async()=>{
 const f=fixture();f.text.value='原有文本';
 for(const files of [[file('a.json','{}'),file('b.json','{}')],[file('a.lua','{}')],[{...file('a.json','{}'),size:2000001}],[file('a.json','{invalid')],[{...file('a.json','{}'),text:async()=>{throw new Error('denied')}}]]){
  await f.dialog.ondrop(event(files));assert.equal(f.text.value,'原有文本');assert.equal(f.error.classList.contains('hidden'),false);assert.ok(f.error.textContent);assert.ok(f.buttons.every(b=>!b.disabled));
 }
});
test('连续拖入以最后一个为准，旧读取完成不会覆盖新内容',async()=>{
 const f=fixture();let resolve;
 const old=f.dialog.ondrop(event([{name:'旧.json',size:2,text:()=>new Promise(r=>resolve=r)}]));assert.ok(f.buttons.every(b=>b.disabled));
 await f.dialog.ondrop(event([file('新.json','{"new":true}')]));resolve('{"old":true}');await old;
 assert.equal(f.text.value,'{"new":true}');assert.match(f.status.textContent,/新.json/);
});
test('手动编辑或关闭弹窗取消读取，文本粘贴可继续使用',async()=>{
 for(const cancel of ['edit','close']){
  const f=fixture();let resolve;const pending=f.dialog.ondrop(event([{name:'慢.json',size:2,text:()=>new Promise(r=>resolve=r)}]));
  f.text.value='手动粘贴';if(cancel==='edit')f.text.oninput();else f.control.reset();resolve('{}');await pending;
  assert.equal(f.text.value,'手动粘贴');assert.ok(f.buttons.every(b=>!b.disabled));
 }
});
test('文本拖入不拦截，不改变文件输入状态',()=>{
 const f=fixture(),e=event([]);e.dataTransfer.types=['text/plain'];f.dialog.ondragover(e);f.dialog.ondrop(e);assert.equal(e.prevented,undefined);assert.equal(f.zone.classList.contains('drag-over'),false);
});
