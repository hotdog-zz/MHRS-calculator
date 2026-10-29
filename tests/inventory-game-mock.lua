local realio = io
local gearWrites, setWrites, clears, creates = 0,0,0,0
local failOnce = false
local function clone(t)
    if type(t) ~= "table" then return t end
    local out = {}; for k,v in pairs(t) do out[k] = clone(v) end; return out
end
local function obj(fields,owner)
    local o={fields=fields or {},owner=owner}
    function o:get_field(k) return self.fields[k] end
    function o:set_field(k,v)
        if self.owner == "gear" then gearWrites=gearWrites+1;error("FORBIDDEN GEAR WRITE") end
        setWrites=setWrites+1
        if failOnce then failOnce=false;error("INJECTED SET WRITE FAILURE") end
        self.fields[k]=v
    end
    function o:call(method,...)
        if method == "clear" then clears=clears+1;error("FORBIDDEN CLEAR") end
        error("Unexpected object method "..method)
    end
    return o
end
local function arr(values,length,owner)
    local a=obj({},owner);a.values=values or {};a.length=length or #a.values
    function a:call(method,i,value)
        if method == "get_Length" then return self.length end
        if method == "Get" then return self.values[i+1] end
        if method == "Set" then
            assert(i>=0 and i<self.length,"array bounds")
            if self.owner == "gear" then gearWrites=gearWrites+1;error("FORBIDDEN ARRAY WRITE") end
            setWrites=setWrites+1
            if failOnce then failOnce=false;error("INJECTED ARRAY WRITE FAILURE") end
            self.values[i+1]=value;return
        end
        error("Unexpected array method "..method)
    end
    return a
end
local map={Type="<Type>k__BackingField",InventoryIndex="<InventoryIndex>k__BackingField"}
local function gear(item)
    local fields={}
    for k,v in pairs(item) do
        if type(v)=="table" then
            local values={}
            if k=="CustomBuildup" then
                for i,atom in ipairs(v) do values[i]=obj({_Id=atom.Id,_SkillId=atom.SkillId,_ValueIndex=atom.ValueIndex},"gear") end
            else values=clone(v) end
            fields["_"..k]=arr(values,#v,"gear")
        else fields[map[k] or "_"..k]=v end
    end
    return obj(fields,"gear")
end
local equipment,petalaces={},{}
for _,row in ipairs(RAW.items) do
    local group=row.box=="equipment" and equipment or petalaces
    group[row.index+1]=gear(row.item)
end
local box=obj({_WeaponArmorInventoryList=obj({mItems=arr(equipment,8,"gear")}),_LvBuffCageInventoryList=obj({mItems=arr(petalaces,8,"gear")})})
local counts={};for _,row in ipairs(RAW.decorations) do counts[#counts+1]=obj({_Id=row.id,_Num=row.count},"gear") end
local decoarr=arr(counts,#counts,"gear")
local dm=obj({_PlEquipBox=box,_PlDecorationsBox=obj({_InventoryDataList=obj({mItems=decoarr})})})
local backups,refs={},{}
for i=1,8 do
    refs[i]=i==7 and petalaces[7] or equipment[i]
    backups[i]=obj({IdVal=100+i,InsectIdVal=-1,InsectInventoryIndex=-1,BowgunCustomizeType=0,HyakuryuDecoId=0,DecoIdList=arr({0,0,0},3,"set")},"set")
end
local target=obj({_Name="Old",_IsUsing=true,_ActionIdList=arr({0,0,0},3,"set"),_ActionIdListMR_Red=arr({0,0,0,0,0},5,"set"),_ActionIdListMR_Blue=arr({0,0,0,0,0},5,"set"),_BackupDataList=arr(backups,8,"set"),["<InventoryDataList>k__BackingField"]=arr(refs,8,"set")},"set")
local manager=obj({_PlEquipMySetList=arr({target},1,"set")})
local singletonReads = 0
sdk={get_managed_singleton=function(name) singletonReads=singletonReads+1;return name=="snow.data.DataManager" and dm or name=="snow.data.EquipDataManager" and manager end,create_managed_string=function(s)return s end,create_instance=function()creates=creates+1;error("FORBIDDEN CREATE")end}
local callback, drawUI
re={on_application_entry=function(name,fn)assert(name=="UpdateBehavior");callback=fn end,on_draw_ui=function(fn)drawUI=fn end}
fs={glob=function()return {}end};log={info=function()end,error=function()end}
local files={},currentPlan
json={load_string=function(text)
    if text:sub(1,8)=='{"slots"' then return STATIC end
    if text=="PLAN" then return currentPlan end
    if text=="CONFIG" then return {keepEquipment=false,unlockWeaponBuildup=true,armorBuildupMode=2} end
    if text=="INDEX" then return {} end
    error("Unexpected JSON mock token")
end,dump_string=function()return "INDEX" end,dump_file=function(p,t)files[p]=clone(t);return true end,load_file=function(p)return clone(files[p])end}
io={open=function(p,mode)
    if p=="EquipmentLoadouts/config.json" then return {read=function()return "CONFIG"end,close=function()end} end
    if files[p] or p:match("owned_") or p=="EquipmentLoadouts/Bow/1_x.json" then
        return {read=function()return "PLAN"end,close=function()end}
    end
    return nil
end}
dofile(SOURCE)
-- Exercise every menu page with the documented ImGui signatures. Merely drawing
-- the interface must not read live game objects or invoke a modifying action.
local clickedPage, treeDepth, disabledDepth = 1, 0, 0
local labels = {}
imgui = {
    tree_node_str_id=function(id,label) treeDepth=treeDepth+1;labels[label]=true;return true end,
    tree_node=function(label) treeDepth=treeDepth+1;return true end,
    tree_pop=function() treeDepth=treeDepth-1;assert(treeDepth>=0) end,
    text=function(t) labels[t]=true end,text_colored=function(t,color)assert(type(color)=="number");labels[t]=true end,
    spacing=function()end,same_line=function()end,
    button=function(label,size) labels[label]=true;return label:find("##ELM_page_"..clickedPage,1,true)~=nil end,
    small_button=function()return false end,
    input_text=function(label,value)return false,value end,
    combo=function(label,value,options)return false,value end,
    slider_int=function(label,value)return false,value end,
    checkbox=function(label,value)return false,value end,
    begin_disabled=function(value)disabledDepth=disabledDepth+1 end,
    end_disabled=function()disabledDepth=disabledDepth-1;assert(disabledDepth>=0)end
}
local beforeReads=singletonReads
for page=1,5 do clickedPage=page;drawUI();assert(treeDepth==0 and disabledDepth==0,"unbalanced ImGui scope") end
assert(singletonReads==beforeReads,"drawing a page queried live game objects")
assert(gearWrites==0 and setWrites==0 and clears==0 and creates==0,"drawing a page modified game data")
assert(labels["导出完整装备箱（只读）"] and labels["刷新列表"] and labels["导出这套游戏组合"] and labels["全装饰品+10"],"missing menu page")
assert(ELM_ExportInventorySnapshot());callback()
assert(gearWrites==0 and setWrites==0 and clears==0 and creates==0,"snapshot must be read-only")
local snapshot
for _,value in pairs(files) do if value.format=="Sunbreak Forge Inventory" then snapshot=value end end
assert(snapshot and #snapshot.items==8 and #snapshot.decorations==#RAW.decorations,ELM_GetInventoryStatus())
for _,row in ipairs(snapshot.items) do
    local original
    for _,r in ipairs(RAW.items) do if r.box==row.box and r.index==row.index then original=r end end
    assert(original and original.fingerprint==row.fingerprint,"Lua/JS fingerprint mismatch")
    assert(ELM_InventoryFingerprint(row.item)==original.fingerprint)
    assert(#row.referencedBy==1)
end
local path="EquipmentLoadouts/OwnedPlans/Bow/owned_1_test.json"
local function run(plan,filename)
    currentPlan=clone(plan);target.fields._IsUsing=false
    ELM_LoadSetFromFile(filename or path)
    callback()
end
run(ORIGINAL)
assert(target.fields._Name==ORIGINAL.mySetInfo.Name,ELM_GetInventoryStatus())
assert(ELM_GetInventoryStatus():find("已绑定已有装备"))
for i,ref in ipairs(ORIGINAL.references) do
    local expected=ref.box=="petalaces" and petalaces[ref.index+1] or equipment[ref.index+1]
    assert(target.fields["<InventoryDataList>k__BackingField"].values[i]==expected)
end
assert(gearWrites==0 and clears==0 and creates==0,"owned plan wrote equipment")
local function rejected(plan,filename)
    local before=setWrites;run(plan,filename);assert(setWrites==before,"invalid plan wrote a MySet")
    assert(gearWrites==0 and clears==0 and creates==0,"invalid plan entered destructive fallback")
end
local changed=clone(ORIGINAL);changed.references[2].fingerprint=changed.references[2].fingerprint.."x";rejected(changed)
changed=clone(ORIGINAL);changed.references[2].index=19999;rejected(changed)
changed=clone(ORIGINAL);changed.references[2]=changed.references[3];rejected(changed)
changed=clone(ORIGINAL);changed.version=99;rejected(changed)
changed=clone(ORIGINAL);changed.inventoryList={};rejected(changed)
changed=clone(ORIGINAL);changed.slotDecorations[1][1]=999999;rejected(changed)
changed=clone(ORIGINAL);changed.mySetInfo.ActionIdList={1};rejected(changed)
-- Correctly formed owned data without the filename prefix never enters legacy import.
rejected(ORIGINAL,"EquipmentLoadouts/Bow/1_x.json")
-- Missing or modified live equipment is rejected before writing a MySet.
local old=equipment[2].fields._BuildupPoint;equipment[2].fields._BuildupPoint=old+1;rejected(ORIGINAL);equipment[2].fields._BuildupPoint=old
-- A real, fitting decoration must still be in the live box.
local usedId
for id,level in pairs(STATIC.decoSlots) do if level==1 then usedId=tonumber(id);break end end
changed=clone(ORIGINAL);changed.slotDecorations[1][1]=usedId
local save={};for i,o in ipairs(counts) do save[i]=o.fields._Num;o.fields._Num=0 end
rejected(changed)
for i,o in ipairs(counts) do o.fields._Num=save[i] end
-- A fitting, owned decoration changes the MySet backup only.
run(changed)
assert(ELM_GetInventoryStatus():find("已绑定已有装备"),ELM_GetInventoryStatus())
assert(backups[1].fields.DecoIdList.values[1]==usedId)
for i,o in ipairs(counts) do assert(o.fields._Num==save[i]) end
assert(equipment[1].fields._DecoIdList.values[1]==RAW.items[1].item.DecoIdList[1])
local previousName=target.fields._Name
failOnce=true;run(ORIGINAL)
assert(target.fields._Name==previousName and ELM_GetInventoryStatus():find("回滚成功"),ELM_GetInventoryStatus())
assert(gearWrites==0 and clears==0 and creates==0)
realio.write("OWNED_LUA_OK: snapshot, fingerprints, existing references, stale data, quantities, fail-closed routing and rollback\n")
