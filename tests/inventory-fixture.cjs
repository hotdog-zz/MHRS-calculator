const I=require('../dist/inventory.js'),M=require('../dist/mod.js'),C=require('../dist/config.js'),data=require('../dist/data.json'),template=require('./mod-template.json');
function fixture(){
 const items=template.inventoryList.map((raw,i)=>{const item=M.cleanItem({...structuredClone(raw),InventoryIndex:i});return {box:i===6?'petalaces':'equipment',index:i,item,fingerprint:I.fingerprint(item),referencedBy:[]};});
 const raw={format:I.FORMAT,version:1,exportId:'SBFI1-Test123-1',exportedAt:1700000000,items,decorations:data.decorations.map(d=>({id:M.decoToGame(d.id),count:20})),sets:[]};
 const stock=I.parse(data,raw),q=C.normalize(data,{weaponId:'Bow:427',rampageDecorationId:template.inventoryList[0].HyakuryuDecoId,skills:[{id:5,level:2}],ownedInventoryId:stock.id,ownedWeaponKey:'equipment:0',options:{ownedOnly:true,sex:'FemaleOnly',seconds:15,limit:1,augment:true,deleteSkills:true,defenseFallback:true,augmentLimits:{head:0}}});
 return {raw,stock,q};
}
module.exports={fixture};
