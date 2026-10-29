-- Executed after the owned-mode harness; setup writes below belong only to mocks.
local function td(name, fields, methods)
    return {get_full_name=function()return name end,get_fields=function()return fields or {}end,get_methods=function()return methods or {}end}
end
local inventoryType=td("snow.data.EquipmentInventoryData")
local arrayType=td("snow.data.EquipmentInventoryData[]")
local function field(name,kind)
    return {get_name=function()return name end,get_type=function()return kind end,is_static=function()return false end}
end
local nativeSells=0
local sellMode="normal"
local sale={get_name=function()return "sellEquipment"end,get_num_params=function()return 1 end,get_param_types=function()return {inventoryType}end,get_return_type=function()return td("System.Void")end,is_static=function()return false end}
function sale:call(receiver,entry)
    assert(receiver==box,"wrong equipment box")
    nativeSells=nativeSells+1
    if sellMode=="exception" then error("INJECTED NATIVE SALE FAILURE") end
    if sellMode=="no_effect" then return end
    if sellMode=="refund" then
        local id,n=counts[1].fields._Id,0
        for _,v in ipairs(entry.fields._DecoIdList.values) do if v==id then n=n+1 end end
        if entry.fields._HyakuryuDecoId==id then n=n+1 end
        counts[1].fields._Num=counts[1].fields._Num+n
    end
    entry.fields._IdVal=0
    if sellMode=="mutate_other" then equipment[2].fields._BuildupPoint=equipment[2].fields._BuildupPoint+1 end
    if sellMode=="deco_change" then counts[1].fields._Num=counts[1].fields._Num+1 end
end
local boxType=td("snow.data.PlEquipBox",{}, {sale})
box.get_type_definition=function()return boxType end
local current=arr({},8,"gear");current.get_type_definition=function()return arrayType end
for i,ref in ipairs(ORIGINAL.references) do current.values[i]=ref.box=="petalaces" and petalaces[ref.index+1] or equipment[ref.index+1] end
manager.fields._CurrentEquipmentInventoryList=current
manager.get_type_definition=function()return td("snow.data.EquipDataManager",{field("_CurrentEquipmentInventoryList",arrayType),field("_EquipState",td("System.Int32"))},{})end
manager.fields._EquipState=1
dm.get_type_definition=function()return td("snow.data.DataManager",{field("_PlEquipBox",boxType)},{})end
local equipmentArray=box.fields._WeaponArmorInventoryList.fields.mItems
equipmentArray.length=20
local baseWeapon=clone(RAW.items[1].item)
local function extra(index,idType)
    local item=clone(idType==2 and RAW.items[2].item or idType==3 and RAW.items[8].item or baseWeapon)
    item.InventoryIndex=index;item.Type=131072;item.IsLock=false;item.DecoIdList={0,0,0};item.HyakuryuDecoId=0;item.PairInsectInventoryIndex=-1
    equipment[index+1]=gear(item)
    return equipment[index+1]
end
extra(8,1)
local referenced=extra(9,1);target.fields["<InventoryDataList>k__BackingField"].values[1]=referenced
extra(10,1).fields._IsLock=true
extra(11,1).fields._DecoIdList.values[1]=1
extra(12,1).fields._HyakuryuDecoId=1048578
local worn=extra(13,1);current.values[1]=worn
extra(14,1).fields["<Type>k__BackingField"]=0
local paired=extra(15,1);paired.fields._PairInsectInventoryIndex=16
local insect=extra(16,1);insect.fields._IdVal=149946368
local unknown=extra(17,1);unknown.fields._IdType=99
extra(18,2);extra(19,3)
local realDump=json.dump_file
local failBackup,failResult=false,false
json.dump_file=function(p,t,...)
    if failBackup and t.application=="Sunbreak Forge Cleanup Backup" then return false end
    if failResult and t.application=="Sunbreak Forge Cleanup Result" then return false end
    return realDump(p,t,...)
end
local function latestScan()
    local newest
    for _,v in pairs(files) do if v.application=="Sunbreak Forge Cleanup Scan" then newest=v end end
    return newest
end
local function drain() for _=1,100 do callback() end end
local function scan(level)
    files={};assert(ELM_ScanUnusedEquipment(level));drain();return latestScan()
end
local report=scan();assert(report and report.ready,ELM_GetInventoryStatus())
assert(#report.candidates==3,"wrong eligible count: "..#report.candidates)
local refs={};for _,row in ipairs(report.candidates) do refs[row.ref.index]=row.ref end
assert(refs[8] and refs[18] and refs[19],"eligible entries must be exact unused instances")
assert(not refs[9] and not refs[10] and not refs[11] and not refs[12] and not refs[13] and not refs[14] and not refs[15] and not refs[16])
assert(nativeSells==0,"scan mutated equipment")
assert(not ELM_DeleteUnusedEquipment({refs[8]},false));assert(nativeSells==0)
assert(not ELM_DeleteUnusedEquipment({},true));assert(nativeSells==0)
assert(not ELM_DeleteUnusedEquipment({refs[8]},"true"));assert(nativeSells==0)
-- Current worn equipment / new loadout references / locks and decos added after
-- the preview all invalidate a prior selection before the native call.
local function stoppedWith(change,restore)
    report=scan();change();local before=nativeSells;assert(ELM_DeleteUnusedEquipment({refs[8]},true));drain();assert(nativeSells==before,"protected item reached sale");restore()
end
stoppedWith(function()equipment[9].fields._IsLock=true end,function()equipment[9].fields._IsLock=false end)
stoppedWith(function()equipment[9].fields._DecoIdList.values[1]=1 end,function()equipment[9].fields._DecoIdList.values[1]=0 end)
stoppedWith(function()current.values[1]=equipment[9]end,function()current.values[1]=worn end)
stoppedWith(function()target.fields["<InventoryDataList>k__BackingField"].values[1]=equipment[9]end,function()target.fields["<InventoryDataList>k__BackingField"].values[1]=referenced end)
-- Compatibility checks fail closed, and still leave a useful read-only report.
local priorArrayType=current.get_type_definition
current.get_type_definition=function()return td("System.Int32[]")end
report=scan();assert(report and not report.ready and nativeSells==0,ELM_GetInventoryStatus())
current.get_type_definition=priorArrayType
local priorParams=sale.get_param_types;sale.get_param_types=function()return {td("System.Int32")}end
report=scan();assert(report and not report.ready and nativeSells==0)
sale.get_param_types=priorParams
-- A failed full backup is never followed by sale.
report=scan();failBackup=true;assert(ELM_DeleteUnusedEquipment({refs[8]},true));drain();assert(nativeSells==0);failBackup=false
-- Native failure or lack of postcondition stops the remaining batch.
report=scan();sellMode="no_effect";assert(ELM_DeleteUnusedEquipment({refs[8],refs[18]},true));drain();assert(nativeSells==1);assert(equipment[19].fields._IdVal>0)
report=scan();sellMode="exception";assert(ELM_DeleteUnusedEquipment({refs[8],refs[18]},true));drain();assert(nativeSells==2);assert(equipment[19].fields._IdVal>0)
-- If the native method unexpectedly modifies another item, no second item is sold.
report=scan();sellMode="mutate_other";local oldBuildup=equipment[2].fields._BuildupPoint;local beforeSales=nativeSells
assert(ELM_DeleteUnusedEquipment({refs[8],refs[18]},true));drain();assert(nativeSells==beforeSales+1 and equipment[19].fields._IdVal>0);equipment[2].fields._BuildupPoint=oldBuildup;extra(8,1)
report=scan();sellMode="deco_change";local oldNum=counts[1].fields._Num;beforeSales=nativeSells
assert(ELM_DeleteUnusedEquipment({refs[8],refs[18]},true));drain();assert(nativeSells==beforeSales+1 and equipment[19].fields._IdVal>0);counts[1].fields._Num=oldNum;extra(8,1)
-- Progress logging must be writable before the first irreversible native call.
report=scan();failResult=true;local logBefore=nativeSells
assert(ELM_DeleteUnusedEquipment({refs[8]},true));drain();assert(nativeSells==logBefore);failResult=false
-- The four scopes change only lock/jewel filters. Worn/referenced/special
-- entries never become eligible, including at the broadest scope.
for level,expected in ipairs({3,6,4,7}) do
    report=scan(level);assert(report.ready and report.level==level and #report.candidates==expected, "scope "..level)
    local found={};for _,row in ipairs(report.candidates)do found[row.ref.index]=row.ref end
    assert(not found[9] and not found[13] and not found[14] and not found[15] and not found[16] and not found[17])
    assert((found[10]~=nil)==(level==3 or level==4))
    assert((found[11]~=nil)==(level==2 or level==4))
    assert((found[12]~=nil)==(level==2 or level==4))
end
-- Explicit no-sale IDs override every scope, including "all", mutable locks,
-- jewels, bulk selection and forged API requests. Normal gear remains eligible.
equipmentArray.length=20+#PROTECTED_FIXTURES
for i,fixture in ipairs(PROTECTED_FIXTURES)do
    local entry=extra(19+i,fixture.kind)
    entry.fields._IdVal=fixture.id
    entry.fields._IsLock=i%2==0
    if i%3==0 then entry.fields._DecoIdList.values[1]=1 end
end
local protectedBefore=nativeSells
for level,expected in ipairs({3,6,4,7})do
    report=scan(level);assert(report.ready and #report.candidates==expected,"protected equipment leaked into scope "..level)
    local excluded=0;for reason,n in pairs(report.excluded)do if reason:find("禁止清理：",1,true)then excluded=excluded+n end end
    assert(excluded==24,"missing protected ID in scope "..level)
    local bulk=ELM_SelectUnusedEquipment(1,"")
    assert(#bulk==expected)
    for _,ref in ipairs(bulk)do assert(ref.index<20,"bulk selected a protected instance")end
    for i,fixture in ipairs(PROTECTED_FIXTURES)do
        assert(not ELM_DeleteUnusedEquipment({{box="equipment",index=19+i,inventoryIndex=19+i,idVal=fixture.id,idType=fixture.kind,fingerprint="forged"}},true))
    end
    assert(nativeSells==protectedBefore,"protected item reached native sale")
end
for i=1,#PROTECTED_FIXTURES do equipment[20+i]=nil end
equipmentArray.length=20
-- The UI shows the recommendation without requiring an extra confirmation.
clickedPage=5;drawUI()
assert(labels["危险功能：建议非必要不使用此功能。"],"missing cleanup recommendation")
-- Broad scan followed by a narrow scan cannot reuse a previously eligible lock.
report=scan(4);local lockedRef
for _,row in ipairs(report.candidates)do if row.ref.index==10 then lockedRef=row.ref end end
report=scan(1);assert(not ELM_DeleteUnusedEquipment({lockedRef},true))
-- Bulk selection spans all pages, respects category and literal search, and
-- supports >20 items without making any game calls until one confirmation.
equipmentArray.length=46
for index=20,45 do extra(index,index==45 and 3 or 1) end
report=scan(1);local all=ELM_SelectUnusedEquipment(1,"");assert(#all==29)
local weapons=ELM_SelectUnusedEquipment(2,"");assert(#weapons==26)
assert(#ELM_SelectUnusedEquipment(3,"")==1 and #ELM_SelectUnusedEquipment(4,"")==2)
assert(#ELM_SelectUnusedEquipment(1,"999999")==0)
local bulkBefore=nativeSells;assert(not ELM_DeleteUnusedEquipment(all,false));assert(nativeSells==bulkBefore)
sellMode="normal";assert(ELM_DeleteUnusedEquipment(all,true));callback()
assert(nativeSells==bulkBefore+1,"must sell at most one item per update")
assert(not ELM_ScanUnusedEquipment() and not ELM_ExportInventorySnapshot(),"parallel inventory jobs must stay blocked")
drain();assert(nativeSells==bulkBefore+#all,ELM_GetInventoryStatus())
for index=20,45 do equipment[index+1]=nil end
equipmentArray.length=20;extra(8,1);extra(18,2);extra(19,3)
-- Between frames, adding references or changing other gear stops BEFORE the next sale.
report=scan();bulkBefore=nativeSells;assert(ELM_DeleteUnusedEquipment({refs[8],refs[18]},true));callback()
local priorLock=equipment[11].fields._IsLock;equipment[11].fields._IsLock=false
callback();assert(nativeSells==bulkBefore+1 and equipment[19].fields._IdVal>0)
equipment[11].fields._IsLock=priorLock;extra(8,1)
report=scan();bulkBefore=nativeSells;assert(ELM_DeleteUnusedEquipment({refs[8],refs[18]},true));callback()
target.fields["<InventoryDataList>k__BackingField"].values[1]=equipment[19]
callback();assert(nativeSells==bulkBefore+1 and equipment[19].fields._IdVal>0)
target.fields["<InventoryDataList>k__BackingField"].values[1]=referenced;extra(8,1)
-- Jewel counts can either remain total-owned counts or refund exactly the
-- removed item's jewels. No invented refunds or unrelated count changes.
local gemId=counts[1].fields._Id;local gemCount=counts[1].fields._Num
for _,mode in ipairs({"normal","refund"})do
    local jeweled=extra(8,1);jeweled.fields._DecoIdList.values={gemId,gemId,0}
    report=scan(2);local ref
    for _,row in ipairs(report.candidates)do if row.ref.index==8 then ref=row.ref end end
    sellMode=mode;assert(ELM_DeleteUnusedEquipment({ref,refs[18]},true));drain()
    assert(equipment[9].fields._IdVal==0 and equipment[19].fields._IdVal==0,ELM_GetInventoryStatus())
    assert(counts[1].fields._Num==gemCount+(mode=="refund" and 2 or 0))
    counts[1].fields._Num=gemCount;extra(8,1);extra(18,2)
end
-- Including locked items never uses an unlock setter; native refusal stops,
-- native acceptance can remove exactly the selected locked item.
report=scan(3);local lockRef
for _,row in ipairs(report.candidates)do if row.ref.index==10 then lockRef=row.ref end end
sellMode="no_effect";local lockBefore=nativeSells
assert(ELM_DeleteUnusedEquipment({lockRef,refs[18]},true));drain()
assert(nativeSells==lockBefore+1 and equipment[11].fields._IsLock and equipment[19].fields._IdVal>0)
report=scan(3);sellMode="normal";local writesBefore=gearWrites
assert(ELM_DeleteUnusedEquipment({lockRef},true));drain()
assert(equipment[11].fields._IdVal==0 and gearWrites==writesBefore)
extra(10,1).fields._IsLock=true
-- Even in the broad scope, ordinary jewel changes since scanning invalidate
-- the selected instance (ordinary jewel IDs are outside the standard fingerprint).
report=scan(4);bulkBefore=nativeSells;equipment[9].fields._DecoIdList.values[1]=gemId
assert(ELM_DeleteUnusedEquipment({refs[8]},true));drain();assert(nativeSells==bulkBefore)
extra(8,1)
-- Normal case: game entry point only; existing objects, references and jewel counts
-- stay unchanged. The pre-sale backup has exact data for the removed instance.
report=scan();sellMode="normal";local beforeGear=gearWrites;local beforeSets=setWrites;local beforeClears=clears;local beforeCreates=creates
-- UI has one final confirmation; no enable/backup/worn checkboxes or token input.
local originalButton,originalCheckbox,originalInput=imgui.button,imgui.checkbox,imgui.input_text
local uiClick,chooseUI="",true
clickedPage=5
imgui.button=function(label,size)if label==uiClick then return true end;return originalButton(label,size)end
imgui.checkbox=function(label,value)
    assert(not label:find("已核对") and not label:find("完整存档") and not label:find("启用可选删除"),"extra confirmation checkbox")
    if chooseUI and (label:find("##ELM_cleanup_8",1,true) or label:find("##ELM_cleanup_18",1,true)) then return true,true end
    return false,value
end
imgui.input_text=function(label,value)assert(not label:find("DELETE"),"extra typed confirmation");return originalInput(label,value)end
local uiBefore=nativeSells;drawUI();chooseUI=false
uiClick="删除已选装备…";drawUI();assert(nativeSells==uiBefore)
uiClick="确认删除 2 件##cleanup_confirm";drawUI();assert(nativeSells==uiBefore,"draw callback must only queue deletion")
assert(labels["建议非必要不使用此功能。确认即执行游戏出售接口。"],"missing final warning")
imgui.button,imgui.checkbox,imgui.input_text=originalButton,originalCheckbox,originalInput
drain()
assert(equipment[9].fields._IdVal==0 and equipment[19].fields._IdVal==0,ELM_GetInventoryStatus())
assert(equipment[20].fields._IdVal>0 and current.values[1]==worn)
assert(gearWrites==beforeGear and setWrites==beforeSets and clears==beforeClears and creates==beforeCreates,"cleanup used a raw mutation path")
local backup,result
for _,value in pairs(files) do if value.application=="Sunbreak Forge Cleanup Backup"then backup=value elseif value.application=="Sunbreak Forge Cleanup Result"then result=value end end
assert(backup and backup.status=="prepared" and result and result.status=="completed" and #result.results==2,ELM_GetInventoryStatus())
assert(#backup.before.items==#RAW.items+12,"missing full inventory backup")
assert(backup.selection[1].ref.index==8 and backup.selection[2].ref.index==18)
assert(ELM_GetInventoryStatus():find("清理完成"))
realio.write("CLEANUP_LUA_OK: live references, current equipment, locks, decorations, exact SDK signature, full backup, stale selections and native-only removal\n")
