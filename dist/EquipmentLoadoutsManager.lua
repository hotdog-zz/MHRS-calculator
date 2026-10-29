local SAVE_FOLDER = "EquipmentLoadouts"
local INDEX_FILE = SAVE_FOLDER .. "/index.json"          -- 配装索引文件
local CONFIG_FILE = SAVE_FOLDER .. "/config.json"        -- 配置保存文件（保留装备、武器解锁等设置）

-- 用户设置变量，会保存到配置文件
local keepEquipment = false                               -- 是否保留装备（不销毁配装中的装备）
local unlockWeaponBuildup = false                         -- 是否启用武器炼化词条解锁（加载时自动开启）
local armorBuildupMode = 0                                -- 防具强化等级模式：0=不修改，1=1级(0)，2=满级(99999)
local unlockMessage = ""                                  -- 解锁按钮的状态消息

-- 预设的武器炼化词条ID（解锁时全部开启）
local PRESET_BUILDUP_IDS = {
    49, 50, 51, 52, 53, 54, 55,
    1, 2, 3, 4,
    11, 12, 13,
    21, 22, 23, 24, 25, 26, 27, 28,
    31, 32, 33, 34,
    41, 42, 43, 44,
    150, 151, 152, 153, 154, 155, 156, 157,
    46, 47,
    160, 161
}

-- 各武器类型的ID范围（英文名称）
local WEAPON_TYPE_RANGES = {
    GreatSword = { min = 135266304, max = 135266803 },
    SwordShield = { min = 136314880, max = 136315379 },
    Hammer = { min = 137363456, max = 137363955 },
    Lance = { min = 138412032, max = 138412531 },
    HeavyBowgun = { min = 147849216, max = 147849715 },
    LightBowgun = { min = 146800640, max = 146801139 },
    LongSword = { min = 139460608, max = 139461107 },
    SwitchAxe = { min = 140509184, max = 140509683 },
    GunLance = { min = 141557760, max = 141558259 },
    Bow = { min = 148897792, max = 148898293 },
    DualBlades = { min = 142606336, max = 142606835 },
    HuntingHorn = { min = 143654912, max = 143655411 },
    InsectGlaive = { min = 144703488, max = 144703987 },
    ChargeBlade = { min = 145752064, max = 145752563 },
}

-- 武器类型中文名（用于UI分组）
local WEAPON_TYPE_CHINESE = {
    GreatSword = "大剑",
    SwordShield = "片手剑",
    Hammer = "大锤",
    Lance = "长枪",
    HeavyBowgun = "重弩",
    LightBowgun = "轻弩",
    LongSword = "太刀",
    SwitchAxe = "斩斧",
    GunLance = "铳枪",
    Bow = "弓",
    DualBlades = "双刀",
    HuntingHorn = "狩猎笛",
    InsectGlaive = "操虫棍",
    ChargeBlade = "盾斧",
}

-- 所有猎虫的ID列表
local INSECT_IDS = {
    149946368, 149946369, 149946370, 149946371, 149946372, 149946373,
    149946374, 149946375, 149946376, 149946377, 149946378, 149946379,
    149946380, 149946381, 149946382, 149946383, 149946384, 149946385,
    149946386, 149946387, 149946468, 149946469, 149946470, 149946471,
    149946472, 149946473,
}

-- 所有花链的ID列表
local CORAL_IDS = {
    403701760, 403701761, 403701762, 403701763, 403701764, 403701765,
    403701766, 403701767, 403701768, 403701769, 403701770, 403701771,
    403701772, 403701773,
}

-- 所有装饰品的ID列表（用于全珠子+10功能）
local ALL_DECO_IDS = {
    12, 22, 84, 108, 94, 55, 24, 23, 50, 49, 48, 25, 21, 20, 19, 9, 5, 4, 3, 2, 8, 7, 51, 37, 87, 38, 27, 11, 45, 32, 30, 26, 91,
    47, 46, 36, 35, 34, 31, 10, 1, 6, 107, 53, 28, 52, 76, 63, 61, 106, 64, 54, 39, 66, 65, 93, 40, 62, 41, 89, 81, 72, 60, 57, 105,
    104, 85, 88, 59, 58, 44, 42, 33, 18, 43, 86, 13, 14, 16, 15, 17, 56, 95, 99, 96, 90, 77, 98, 97, 92, 80, 79, 78, 75, 74, 73, 67,
    68, 70, 69, 71, 110, 111, 112, 113, 114, 119, 120, 121, 122, 123, 124, 125, 126, 128, 129, 131, 132, 134, 135, 137, 138, 140, 141,
    142, 143, 144, 145, 146, 147, 148, 150, 151, 152, 153, 155, 156, 157, 160, 161, 162, 163, 164, 165, 169, 170, 171, 172, 174, 175,
    176, 179, 180, 181, 185, 188, 189, 192, 205, 207, 221, 215, 218, 216, 223, 224, 159, 186, 191, 190, 187, 213, 158, 197, 225, 154,
    166, 201, 149, 183, 210, 115, 116, 117, 118, 208, 212, 211, 214, 199, 200, 193, 219, 173, 217, 238, 239, 202, 203, 194, 206, 139,
    136, 133, 130, 127, 246, 245, 198, 244, 209, 243, 240, 226, 228, 227, 177, 241, 242, 231, 196, 247, 248, 232, 249, 251, 252, 250,
    230, 182, 253, 259, 261, 195, 178, 254, 255, 256, 257, 168, 167, 260, 258, 184,
    1048577, 1048578, 1048579, 1048580, 1048581, 1048582, 1048583, 1048584, 1048603, 1048586, 1048587, 1048588, 1048589, 1048590,
    1048591, 1048592, 1048593, 1048594, 1048595, 1048596, 1048597, 1048598, 1048599, 1048600, 1048601, 1048602, 1048604, 1048605,
    1048606, 1048607, 1048608, 1048609, 1048610, 1048611,
}

-- 将数字转换为62进制字符串（用于生成短文件名）
local function encodeBase62(num)
    if num == 0 then return "0" end
    local chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    local result = ""
    while num > 0 do
        local remainder = num % 62
        result = chars:sub(remainder+1, remainder+1) .. result
        num = math.floor(num / 62)
    end
    return result
end

-- 生成基于时间戳的短文件名（62进制）
local function getShortTimestamp()
    local t = os.time()
    return encodeBase62(t)
end

-- 根据武器ID获取武器类型英文名
local function getWeaponTypeFromIdVal(idVal)
    for typeName, range in pairs(WEAPON_TYPE_RANGES) do
        if math.floor(idVal / 65536) == math.floor(range.min / 65536) then
            return typeName
        end
    end
    return "Unknown"
end

-- 配装列表（从索引文件加载）
local configList = {}
local newConfigName = ""          -- 新建配装时的文件名输入框
local saveSlotIndex = 0           -- 当前选择的保存槽位（0基）

-- Filename slot is 1-based, game list index is 0-based.
local function slotFromPath(path)
    if type(path) ~= "string" then return nil end
    local base = path:match("([^/\\]+)$") or path
    local number = base:match("^owned_(%d+)_") or base:match("^(%d+)_")
    local slot = number and tonumber(number)
    if slot and slot >= 1 and slot <= 224 then return slot end
    return nil
end

local function basename(path)
    return path:match("([^/\\]+)$") or path
end

-- Manual input only controls the destination slot; disk name always uses ASCII timestamp.
local function manualSlot(text, selectedSlot)
    text = tostring(text or "")
    local prefix = text:match("^(%d+)_")
    if not prefix then return selectedSlot end
    local slot = tonumber(prefix)
    if not slot or slot < 1 or slot > 224 then
        return nil, "文件名中的栏位必须在 1-224 之间"
    end
    return slot
end

local function exists(path)
    local ok, file = pcall(io.open, path, "r")
    if not ok then return nil, "无法检查文件：" .. tostring(file) end
    if file then file:close(); return true end
    return false
end

local pendingImport = nil
local pendingSave = nil
local pendingRename = nil
local notice = ""
local renameSlot = {}
local editingPath = nil
local rowNotices = {}

local function getEquipDataManager()
    return sdk.get_managed_singleton("snow.data.EquipDataManager")
end

local function getDataManager()
    return sdk.get_managed_singleton("snow.data.DataManager")
end

local json_encode = json.dump_string
local json_decode = json.load_string

-- 确保主保存文件夹存在
local function ensureFolderExists()
    -- json.dump_file creates safe parent directories under reframework/data.
    return true
end

local function ensureWeaponFolder(weaponType)
    return true
end

local function arrayToTable(arr)
    local t = {}
    if arr then
        for i = 0, arr:call("get_Length") - 1 do
            t[i+1] = arr:call("Get", i)
        end
    end
    return t
end

local function tableToArray(t, arr)
    if arr and t then
        for i, val in ipairs(t) do
            if i-1 < arr:call("get_Length") then
                arr:call("Set", i-1, val)
            end
        end
    end
end

-- 保存怪异强化数组（CustomBuildup）到表
local function saveCustomBuildup(arr)
    local result = {}
    if arr then
        for i = 0, arr:call("get_Length") - 1 do
            local elem = arr:call("Get", i)
            if elem then
                result[i+1] = {
                    Id = elem:get_field("_Id"),
                    ValueIndex = elem:get_field("_ValueIndex"),
                    SkillId = elem:get_field("_SkillId")
                }
            end
        end
    end
    return result
end

-- 从表加载怪异强化数组
local function loadCustomBuildup(data, arr)
    if not arr or not data then return end
    for i, entry in ipairs(data) do
        if i-1 < arr:call("get_Length") then
            local elem = arr:call("Get", i-1)
            if elem then
                elem:set_field("_Id", entry.Id or 0)
                elem:set_field("_ValueIndex", entry.ValueIndex or 0)
                elem:set_field("_SkillId", entry.SkillId or 0)
            end
        end
    end
end

-- 深度复制表（用于模板复制）
local function cloneTable(original)
    local copy = {}
    for k, v in pairs(original) do
        if type(v) == "table" then
            if k == "CustomBuildup" then
                copy[k] = {}
                for _, item in ipairs(v) do
                    table.insert(copy[k], {Id=item.Id, SkillId=item.SkillId, ValueIndex=item.ValueIndex})
                end
            else
                copy[k] = {table.unpack(v)}
            end
        else
            copy[k] = v
        end
    end
    return copy
end

-- 保存单个EquipmentInventoryData对象的所有字段
local function saveEquipmentInventoryData(inv)
    if not inv then return nil end
    return {
        Type = inv:get_field("<Type>k__BackingField"),
        InventoryIndex = inv:get_field("<InventoryIndex>k__BackingField"),
        IdType = inv:get_field("_IdType"),
        IdVal = inv:get_field("_IdVal"),
        BowgunCustomizeType = inv:get_field("_BowgunCustomizeType"),
        PairInsectInventoryIndex = inv:get_field("_PairInsectInventoryIndex"),
        BuildupPoint = inv:get_field("_BuildupPoint"),
        IsLock = inv:get_field("_IsLock"),
        HyakuryuDecoId = inv:get_field("_HyakuryuDecoId"),
        HyakuryuModelId = inv:get_field("_HyakuryuModelId"),
        HyakuryuSkillIdList = arrayToTable(inv:get_field("_HyakuryuSkillIdList")),
        PrevHyakuryuSkillId = arrayToTable(inv:get_field("_PrevHyakuryuSkillId")),
        TalismanDecoSlotNumList = arrayToTable(inv:get_field("_TalismanDecoSlotNumList")),
        TalismanSkillIdList = arrayToTable(inv:get_field("_TalismanSkillIdList")),
        TalismanSkillLvList = arrayToTable(inv:get_field("_TalismanSkillLvList")),
        CustomOpenIdArray = arrayToTable(inv:get_field("_CustomOpenIdArray")),
        DecoIdList = arrayToTable(inv:get_field("_DecoIdList")),
        CustomBuildupType = inv:get_field("_CustomBuildupType"),
        CustomEnable = inv:get_field("_CustomEnable"),
        CustomCount = inv:get_field("_CustomCount"),
        CustomBuildup = saveCustomBuildup(inv:get_field("_CustomBuildup")),
    }
end

-- 将保存的数据加载回EquipmentInventoryData对象
local function loadEquipmentInventoryData(inv, data, skipCustomBuildup)
    if not inv or not data then return end
    inv:set_field("<Type>k__BackingField", data.Type or 0)
    inv:set_field("<InventoryIndex>k__BackingField", data.InventoryIndex or 0)
    inv:set_field("_IdType", data.IdType or 0)
    inv:set_field("_IdVal", data.IdVal or 0)
    inv:set_field("_BowgunCustomizeType", data.BowgunCustomizeType or 0)
    inv:set_field("_PairInsectInventoryIndex", data.PairInsectInventoryIndex or -1)
    inv:set_field("_BuildupPoint", data.BuildupPoint or 0)
    inv:set_field("_IsLock", data.IsLock or false)
    inv:set_field("_HyakuryuDecoId", data.HyakuryuDecoId or 0)
    inv:set_field("_HyakuryuModelId", data.HyakuryuModelId or 0)
    tableToArray(data.HyakuryuSkillIdList, inv:get_field("_HyakuryuSkillIdList"))
    tableToArray(data.PrevHyakuryuSkillId, inv:get_field("_PrevHyakuryuSkillId"))
    tableToArray(data.TalismanDecoSlotNumList, inv:get_field("_TalismanDecoSlotNumList"))
    tableToArray(data.TalismanSkillIdList, inv:get_field("_TalismanSkillIdList"))
    tableToArray(data.TalismanSkillLvList, inv:get_field("_TalismanSkillLvList"))
    tableToArray(data.DecoIdList, inv:get_field("_DecoIdList"))
    if not skipCustomBuildup then
        tableToArray(data.CustomOpenIdArray, inv:get_field("_CustomOpenIdArray"))
        inv:set_field("_CustomBuildupType", data.CustomBuildupType or 0)
        inv:set_field("_CustomEnable", data.CustomEnable or false)
        inv:set_field("_CustomCount", data.CustomCount or 0)
        if data.CustomBuildup then
            loadCustomBuildup(data.CustomBuildup, inv:get_field("_CustomBuildup"))
        end
    end
end

-- 在装备箱中创建或复用空位（武器/防具/猎虫）
local function ensureEquipmentExists(equipBox, invData, slotIndex, skipCustomBuildup)
    if not equipBox or not invData then return nil end
    if invData.IdVal == 0 then return nil end

    local weaponArmorList = equipBox:get_field("_WeaponArmorInventoryList")
    if not weaponArmorList then return nil end
    local mItems = weaponArmorList:get_field("mItems")
    if not mItems then return nil end

    local arrayLen = mItems:call("get_Length")
    local mSize = weaponArmorList:get_field("mSize")

    local targetIndex = nil
    local existingObj = nil
    for i = 0, arrayLen - 1 do
        local elem = mItems:call("Get", i)
        if elem == nil then
            targetIndex = i
            existingObj = nil
            break
        elseif elem:get_field("_IdVal") == 0 then
            targetIndex = i
            existingObj = elem
            break
        end
    end

    if targetIndex == nil then return nil end

    local newInv
    if existingObj then
        newInv = existingObj
    else
        local success, inv = pcall(sdk.create_instance, "snow.data.EquipmentInventoryData")
        if not success or not inv then return nil end
        newInv = inv
    end

    loadEquipmentInventoryData(newInv, invData, skipCustomBuildup)
    newInv:set_field("<InventoryIndex>k__BackingField", targetIndex)

    if not existingObj and targetIndex >= mSize then
        weaponArmorList:set_field("mSize", targetIndex + 1)
    end
    if not existingObj then
        mItems:call("Set", targetIndex, newInv)
    end
    return newInv
end

-- 在花链箱中创建或复用空位
local function ensureCoralExists(equipBox, coralData, skipCustomBuildup)
    if not equipBox or not coralData then return nil end
    if coralData.IdVal == 0 then return nil end

    local coralList = equipBox:get_field("_LvBuffCageInventoryList")
    if not coralList then return nil end
    local mItems = coralList:get_field("mItems")
    if not mItems then return nil end

    local arrayLen = mItems:call("get_Length")
    local mSize = coralList:get_field("mSize")

    local targetIndex = nil
    local existingObj = nil
    for i = 0, arrayLen - 1 do
        local elem = mItems:call("Get", i)
        if elem == nil then
            targetIndex = i
            existingObj = nil
            break
        elseif elem:get_field("_IdVal") == 0 then
            targetIndex = i
            existingObj = elem
            break
        end
    end

    if targetIndex == nil then return nil end

    local newCoral
    if existingObj then
        newCoral = existingObj
    else
        local success, obj = pcall(sdk.create_instance, "snow.data.EquipmentInventoryData")
        if not success or not obj then return nil end
        newCoral = obj
    end

    loadEquipmentInventoryData(newCoral, coralData, skipCustomBuildup)
    newCoral:set_field("<InventoryIndex>k__BackingField", targetIndex)

    if not existingObj and targetIndex >= mSize then
        coralList:set_field("mSize", targetIndex + 1)
    end
    if not existingObj then
        mItems:call("Set", targetIndex, newCoral)
    end
    return newCoral
end

-- 保存指定索引的个人组合到文件
local function saveSetToFile(slotIndex, filename, overwrite)
    local manager = getEquipDataManager()
    if not manager then return false end
    local mySetList = manager:get_field("_PlEquipMySetList")
    if not mySetList then return false end
    local targetSet = mySetList:call("Get", slotIndex)
    if not targetSet then return false end

    local dataToSave = {}
    dataToSave.mySetInfo = {
        Name = targetSet:get_field("_Name"),
        IsUsing = targetSet:get_field("_IsUsing"),
        ActionIdList = arrayToTable(targetSet:get_field("_ActionIdList")),
        ActionIdListMR_Red = arrayToTable(targetSet:get_field("_ActionIdListMR_Red")),
        ActionIdListMR_Blue = arrayToTable(targetSet:get_field("_ActionIdListMR_Blue"))
    }

    local backupDataList = targetSet:get_field("_BackupDataList")
    dataToSave.backupList = {}
    if backupDataList then
        for i = 0, backupDataList:call("get_Length") - 1 do
            local backup = backupDataList:call("Get", i)
            if backup then
                dataToSave.backupList[i+1] = {
                    IdVal = backup:get_field("IdVal"),
                    InsectIdVal = backup:get_field("InsectIdVal"),
                    InsectInventoryIndex = backup:get_field("InsectInventoryIndex"),
                    BowgunCustomizeType = backup:get_field("BowgunCustomizeType"),
                    HyakuryuDecoId = backup:get_field("HyakuryuDecoId"),
                    DecoIdList = arrayToTable(backup:get_field("DecoIdList"))
                }
            end
        end
    end

    local invList = targetSet:get_field("<InventoryDataList>k__BackingField")
    if not invList then return false end

    dataToSave.inventoryList = {}
    for i = 0, invList:call("get_Length") - 1 do
        local inv = invList:call("Get", i)
        if inv then
            local invData = saveEquipmentInventoryData(inv)
            if i == 0 then
                local insectInv = inv:get_field("<PairInsectInventory>k__BackingField")
                if insectInv then
                    invData.PairedInsectData = saveEquipmentInventoryData(insectInv)
                end
            end
            local backupEntry = dataToSave.backupList[i+1]
            if backupEntry then
                invData.DecoIdList = backupEntry.DecoIdList
                invData.HyakuryuDecoId = backupEntry.HyakuryuDecoId
            end
            dataToSave.inventoryList[i+1] = invData
        end
    end

    -- 获取武器信息以确定保存路径
    local weaponInv = invList:call("Get", 0)
    local weaponIdVal = weaponInv and weaponInv:get_field("_IdVal") or 0
    local weaponType = getWeaponTypeFromIdVal(weaponIdVal)
    if weaponType == "Unknown" then return false end
    local weaponTypeChinese = WEAPON_TYPE_CHINESE[weaponType] or weaponType

    local weaponName = weaponTypeChinese
    if weaponInv then
        local success, name = pcall(function()
            local name = weaponInv:call("getName")
            if name and name ~= "" then return name end
            local weaponData = weaponInv:call("getWeaponData")
            if weaponData then
                local name2 = weaponData:call("getName")
                if name2 and name2 ~= "" then return name2 end
            end
            return nil
        end)
        if success and name then weaponName = name end
    end

    ensureWeaponFolder(weaponType)
    ensureFolderExists()
    local relativePath = weaponType .. "/" .. filename .. ".json"
    local fullPath = SAVE_FOLDER .. "/" .. relativePath

    -- 添加UI信息（用于索引显示）
    dataToSave.uiInfo = {
        weaponName = weaponName,
        weaponType = weaponType,
        displayName = dataToSave.mySetInfo.Name or filename
    }

    if not overwrite then
        local present, err = exists(fullPath)
        if present == nil then notice = err; return false end
        if present then notice = "文件已存在：" .. filename; return false end
    end
    local ok = json.dump_file(fullPath, dataToSave, 2)
    if not ok then notice = "保存失败：" .. fullPath end
    return ok

end

-- 获得所有猎虫（缺少的添加到装备箱）
local function obtainAllInsects()
    local dataManager = getDataManager()
    if not dataManager then return end
    local equipBox = dataManager:get_field("_PlEquipBox")
    if not equipBox then return end
    local weaponArmorList = equipBox:get_field("_WeaponArmorInventoryList")
    if not weaponArmorList then return end

    local existingIds = {}
    local count = weaponArmorList:call("get_Count")
    for i = 0, count - 1 do
        local inv = weaponArmorList:call("get_Item", i)
        if inv then existingIds[inv:get_field("_IdVal")] = true end
    end

    -- 猎虫模板（基础数据）
    local insectTemplate = {
        Type = 131072, InventoryIndex = -1, IdType = 1, IdVal = 0,
        BowgunCustomizeType = 0, PairInsectInventoryIndex = -1, BuildupPoint = 0, IsLock = false,
        HyakuryuDecoId = 0, HyakuryuModelId = 1048576,
        HyakuryuSkillIdList = {0,0,0,0,0,0},
        PrevHyakuryuSkillId = {0,0,0,0,0,0},
        TalismanDecoSlotNumList = {0,0,0,0,0},
        TalismanSkillIdList = {0,0},
        TalismanSkillLvList = {0,0},
        CustomOpenIdArray = {},
        DecoIdList = {0,0,0},
        CustomBuildupType = 0,
        CustomEnable = false,
        CustomCount = 0,
        CustomBuildup = {{Id=0, SkillId=0, ValueIndex=0},{Id=0, SkillId=0, ValueIndex=0},{Id=0, SkillId=0, ValueIndex=0},
                         {Id=0, SkillId=0, ValueIndex=0},{Id=0, SkillId=0, ValueIndex=0},{Id=0, SkillId=0, ValueIndex=0},
                         {Id=0, SkillId=0, ValueIndex=0}},
    }

    for _, idVal in ipairs(INSECT_IDS) do
        if not existingIds[idVal] then
            local invData = cloneTable(insectTemplate)
            invData.IdVal = idVal
            ensureEquipmentExists(equipBox, invData, -1, true)
        end
    end
end

-- 获得所有花链（缺少的添加到花链箱）
local function obtainAllCorals()
    local dataManager = getDataManager()
    if not dataManager then return end
    local equipBox = dataManager:get_field("_PlEquipBox")
    if not equipBox then return end
    local coralList = equipBox:get_field("_LvBuffCageInventoryList")
    if not coralList then return end

    local existingIds = {}
    local count = coralList:call("get_Count")
    for i = 0, count - 1 do
        local inv = coralList:call("get_Item", i)
        if inv then existingIds[inv:get_field("_IdVal")] = true end
    end

    -- 花链模板
    local coralTemplate = {
        Type = 131073, InventoryIndex = -1, IdType = 4, IdVal = 0,
        BowgunCustomizeType = 0, PairInsectInventoryIndex = -1, BuildupPoint = 0, IsLock = false,
        HyakuryuDecoId = 0, HyakuryuModelId = 1048576,
        HyakuryuSkillIdList = {0,0,0,0,0,0},
        PrevHyakuryuSkillId = {0,0,0,0,0,0},
        TalismanDecoSlotNumList = {0,0,0,0,0},
        TalismanSkillIdList = {0,0},
        TalismanSkillLvList = {0,0},
        CustomOpenIdArray = {},
        DecoIdList = {0,0,0},
        CustomBuildupType = 0,
        CustomEnable = false,
        CustomCount = 0,
        CustomBuildup = {{Id=0, SkillId=0, ValueIndex=0},{Id=0, SkillId=0, ValueIndex=0},{Id=0, SkillId=0, ValueIndex=0},
                         {Id=0, SkillId=0, ValueIndex=0},{Id=0, SkillId=0, ValueIndex=0},{Id=0, SkillId=0, ValueIndex=0},
                         {Id=0, SkillId=0, ValueIndex=0}},
    }

    for _, idVal in ipairs(CORAL_IDS) do
        if not existingIds[idVal] then
            local coralData = cloneTable(coralTemplate)
            coralData.IdVal = idVal
            ensureCoralExists(equipBox, coralData, true)
        end
    end
end

-- 全装饰品+10：给每个装饰品增加10个数量
local function addAllDecorationsPlus10()
    local dataManager = getDataManager()
    if not dataManager then return end
    local decoBox = dataManager:get_field("_PlDecorationsBox")
    if not decoBox then return end
    local decoList = decoBox:get_field("_InventoryDataList")
    if not decoList then return end
    local mItems = decoList:get_field("mItems")
    if not mItems then return end
    local length = mItems:call("get_Length")

    local maxCount = 99
    for _, targetId in ipairs(ALL_DECO_IDS) do
        local found = false
        for i = 0, length - 1 do
            local inv = mItems:call("Get", i)
            if inv and inv:get_field("_Id") == targetId then
                local num = inv:get_field("_Num")
                if num < maxCount then
                    inv:set_field("_Num", math.min(num + 10, maxCount))
                end
                found = true
                break
            end
        end
        if not found then
            for i = 0, length - 1 do
                local inv = mItems:call("Get", i)
                if inv and inv:get_field("_Id") == 0 then
                    inv:set_field("_Id", targetId)
                    inv:set_field("_Num", 10)
                    break
                end
            end
        end
    end
end

-- 根据设置修改防具的强化等级
local function setArmorBuildupIfNeeded(inv, slotIdx)
    if slotIdx >= 1 and slotIdx <= 5 and inv then
        if armorBuildupMode == 1 then
            inv:set_field("_BuildupPoint", 0)
        elseif armorBuildupMode == 2 then
            inv:set_field("_BuildupPoint", 99999)
        end
    end
end

-- Generated ordinary slot data; no arbitrary game method names are guessed.
local OWNED_STATIC = json.load_string([[{"slots":{"135266436":[0,0,0,0],"135266437":[0,0,0,0],"135266759":[0,0,0,0],"135266760":[0,0,0,0],"135266761":[0,0,0,0],"135266324":[0,0,0,0],"135266325":[0,0,0,0],"135266326":[0,0,0,0],"135266327":[0,0,0,0],"135266328":[2,0,0,0],"135266329":[2,1,0,0],"135266604":[4,1,0,0],"135266605":[4,1,0,0],"135266606":[4,2,0,0],"135266744":[4,0,0,0],"135266745":[4,0,0,0],"135266770":[4,4,4,0],"135266364":[0,0,0,0],"135266365":[2,0,0,0],"135266366":[2,0,0,0],"135266607":[2,0,0,0],"135266608":[2,0,0,0],"135266609":[2,0,0,0],"135266407":[0,0,0,0],"135266408":[1,0,0,0],"135266409":[1,0,0,0],"135266610":[1,0,0,0],"135266611":[1,0,0,0],"135266612":[1,0,0,0],"135266613":[2,2,2,0],"135266308":[0,0,0,0],"135266309":[0,0,0,0],"135266310":[1,1,1,0],"135266380":[0,0,0,0],"135266381":[0,0,0,0],"135266382":[0,0,0,0],"135266617":[0,0,0,0],"135266618":[0,0,0,0],"135266619":[0,0,0,0],"135266416":[0,0,0,0],"135266417":[1,0,0,0],"135266418":[1,0,0,0],"135266620":[1,0,0,0],"135266621":[1,0,0,0],"135266622":[1,0,0,0],"135266383":[0,0,0,0],"135266384":[0,0,0,0],"135266385":[2,0,0,0],"135266623":[2,0,0,0],"135266624":[2,0,0,0],"135266625":[4,0,0,0],"135266349":[0,0,0,0],"135266350":[0,0,0,0],"135266351":[2,1,0,0],"135266626":[2,1,0,0],"135266627":[3,2,0,0],"135266386":[0,0,0,0],"135266387":[0,0,0,0],"135266388":[2,1,1,0],"135266628":[2,1,1,0],"135266629":[2,2,1,0],"135266404":[0,0,0,0],"135266405":[2,0,0,0],"135266406":[2,0,0,0],"135266630":[2,0,0,0],"135266631":[2,0,0,0],"135266632":[2,0,0,0],"135266749":[4,2,0,0],"135266358":[0,0,0,0],"135266359":[1,1,0,0],"135266360":[2,1,0,0],"135266633":[2,1,0,0],"135266634":[2,1,0,0],"135266635":[2,2,0,0],"135266636":[2,1,0,0],"135266637":[2,1,0,0],"135266638":[2,2,0,0],"135266306":[0,0,0,0],"135266307":[0,0,0,0],"135266304":[0,0,0,0],"135266305":[0,0,0,0],"135266311":[1,1,0,0],"135266312":[1,1,0,0],"135266639":[1,1,0,0],"135266640":[1,1,0,0],"135266641":[1,1,1,0],"135266642":[1,0,0,0],"135266643":[1,0,0,0],"135266644":[1,0,0,0],"135266321":[0,0,0,0],"135266322":[0,0,0,0],"135266323":[2,1,0,0],"135266645":[2,1,0,0],"135266646":[2,1,0,0],"135266647":[3,1,0,0],"135266389":[0,0,0,0],"135266390":[0,0,0,0],"135266391":[2,1,0,0],"135266648":[2,1,0,0],"135266649":[2,1,0,0],"135266650":[3,1,0,0],"135266398":[0,0,0,0],"135266399":[0,0,0,0],"135266400":[2,0,0,0],"135266651":[2,0,0,0],"135266652":[2,0,0,0],"135266653":[2,0,0,0],"135266654":[3,0,0,0],"135266655":[3,0,0,0],"135266656":[3,0,0,0],"135266352":[0,0,0,0],"135266353":[0,0,0,0],"135266354":[2,0,0,0],"135266657":[2,0,0,0],"135266658":[3,0,0,0],"135266659":[4,0,0,0],"135266355":[0,0,0,0],"135266356":[0,0,0,0],"135266357":[2,0,0,0],"135266660":[2,0,0,0],"135266661":[3,0,0,0],"135266662":[4,0,0,0],"135266313":[0,0,0,0],"135266314":[0,0,0,0],"135266315":[0,0,0,0],"135266316":[0,0,0,0],"135266317":[0,0,0,0],"135266318":[1,1,0,0],"135266663":[1,1,1,0],"135266664":[2,1,1,0],"135266665":[2,2,1,0],"135266666":[2,0,0,0],"135266667":[2,1,0,0],"135266668":[2,2,0,0],"135266669":[1,1,0,0],"135266670":[1,1,0,0],"135266671":[1,1,0,0],"135266319":[0,0,0,0],"135266320":[0,0,0,0],"135266672":[0,0,0,0],"135266673":[0,0,0,0],"135266674":[0,0,0,0],"135266675":[1,0,0,0],"135266676":[1,0,0,0],"135266677":[1,0,0,0],"135266395":[0,0,0,0],"135266396":[0,0,0,0],"135266397":[0,0,0,0],"135266678":[0,0,0,0],"135266679":[0,0,0,0],"135266680":[0,0,0,0],"135266681":[1,0,0,0],"135266682":[1,0,0,0],"135266683":[1,0,0,0],"135266746":[4,1,1,0],"135266392":[0,0,0,0],"135266393":[0,0,0,0],"135266394":[0,0,0,0],"135266684":[3,0,0,0],"135266685":[3,1,0,0],"135266686":[3,1,0,0],"135266410":[1,0,0,0],"135266411":[1,0,0,0],"135266412":[1,0,0,0],"135266687":[1,0,0,0],"135266688":[1,0,0,0],"135266747":[3,0,0,0],"135266419":[0,0,0,0],"135266420":[0,0,0,0],"135266421":[0,0,0,0],"135266689":[0,0,0,0],"135266690":[0,0,0,0],"135266691":[0,0,0,0],"135266431":[0,0,0,0],"135266432":[0,0,0,0],"135266433":[0,0,0,0],"135266692":[0,0,0,0],"135266693":[0,0,0,0],"135266401":[0,0,0,0],"135266402":[3,0,0,0],"135266403":[3,0,0,0],"135266694":[3,0,0,0],"135266695":[3,0,0,0],"135266696":[3,1,0,0],"135266413":[0,0,0,0],"135266414":[1,0,0,0],"135266415":[1,1,0,0],"135266697":[1,1,0,0],"135266698":[2,1,0,0],"135266377":[0,0,0,0],"135266378":[0,0,0,0],"135266379":[2,1,1,0],"135266699":[2,1,1,0],"135266700":[2,1,1,0],"135266701":[3,1,1,0],"135266702":[3,1,1,0],"135266703":[3,2,1,0],"135266704":[4,2,1,0],"135266374":[0,0,0,0],"135266375":[0,0,0,0],"135266376":[1,1,0,0],"135266705":[1,1,0,0],"135266706":[2,1,0,0],"135266361":[0,0,0,0],"135266362":[0,0,0,0],"135266363":[2,1,0,0],"135266707":[2,1,0,0],"135266708":[2,1,0,0],"135266709":[3,2,0,0],"135266723":[2,0,0,0],"135266724":[2,0,0,0],"135266725":[2,0,0,0],"135266726":[0,0,0,0],"135266727":[0,0,0,0],"135266766":[3,1,0,0],"135266428":[0,0,0,0],"135266429":[3,0,0,0],"135266430":[3,0,0,0],"135266710":[3,0,0,0],"135266711":[3,0,0,0],"135266729":[2,2,0,0],"135266367":[0,0,0,0],"135266368":[0,0,0,0],"135266369":[0,0,0,0],"135266712":[0,0,0,0],"135266370":[0,0,0,0],"135266371":[0,0,0,0],"135266714":[0,0,0,0],"135266422":[1,0,0,0],"135266423":[1,0,0,0],"135266716":[1,0,0,0],"135266717":[2,0,0,0],"135266424":[0,0,0,0],"135266425":[0,0,0,0],"135266718":[0,0,0,0],"135266719":[0,0,0,0],"135266426":[2,1,1,0],"135266427":[2,1,1,0],"135266720":[4,1,1,0],"135266721":[4,1,1,0],"135266372":[2,0,0,0],"135266373":[2,0,0,0],"135266722":[3,0,0,0],"135266728":[0,0,0,0],"135266768":[4,0,0,0],"135266769":[0,0,0,0],"135266343":[0,0,0,0],"135266344":[0,0,0,0],"135266345":[0,0,0,0],"135266730":[1,0,0,0],"135266731":[3,0,0,0],"135266346":[0,0,0,0],"135266347":[0,0,0,0],"135266348":[3,1,0,0],"135266732":[3,1,1,0],"135266733":[3,2,1,0],"135266334":[0,0,0,0],"135266335":[0,0,0,0],"135266336":[0,0,0,0],"135266734":[0,0,0,0],"135266735":[0,0,0,0],"135266337":[0,0,0,0],"135266338":[1,1,1,0],"135266339":[2,1,1,0],"135266736":[2,1,1,0],"135266737":[4,1,1,0],"135266340":[2,0,0,0],"135266341":[2,0,0,0],"135266342":[3,0,0,0],"135266738":[3,0,0,0],"135266739":[3,0,0,0],"135266740":[2,0,0,0],"135266742":[2,1,0,0],"135266743":[0,0,0,0],"135266330":[0,0,0,0],"135266331":[0,0,0,0],"135266332":[0,0,0,0],"135266434":[0,0,0,0],"135266435":[0,0,0,0],"135266333":[0,0,0,0],"139460747":[0,0,0,0],"139460748":[0,0,0,0],"139461071":[0,0,0,0],"139461072":[0,0,0,0],"139461073":[0,0,0,0],"139460634":[0,0,0,0],"139460635":[0,0,0,0],"139460636":[0,0,0,0],"139460637":[0,0,0,0],"139460638":[2,0,0,0],"139460639":[2,1,0,0],"139460908":[4,1,0,0],"139460909":[4,1,0,0],"139460910":[4,2,0,0],"139460921":[4,0,0,0],"139460922":[4,0,0,0],"139461083":[4,4,4,0],"139460727":[0,0,0,0],"139460728":[0,0,0,0],"139460729":[1,1,0,0],"139460911":[1,1,0,0],"139460912":[1,1,0,0],"139460654":[0,0,0,0],"139460655":[2,0,0,0],"139460656":[2,0,0,0],"139460913":[2,0,0,0],"139460914":[2,0,0,0],"139460915":[4,2,0,0],"139460682":[0,0,0,0],"139460683":[0,0,0,0],"139460684":[2,1,0,0],"139460916":[2,1,0,0],"139460917":[2,1,0,0],"139460614":[0,0,0,0],"139460615":[0,0,0,0],"139460616":[2,1,1,0],"139460918":[2,2,1,0],"139460919":[2,2,1,0],"139460920":[4,2,1,0],"139460697":[0,0,0,0],"139460698":[0,0,0,0],"139460699":[0,0,0,0],"139460923":[0,0,0,0],"139460924":[0,0,0,0],"139460925":[0,0,0,0],"139460703":[0,0,0,0],"139460704":[0,0,0,0],"139460705":[1,0,0,0],"139460926":[1,0,0,0],"139460927":[1,0,0,0],"139460663":[0,0,0,0],"139460664":[2,1,0,0],"139460665":[2,1,0,0],"139460928":[2,1,0,0],"139460929":[2,1,0,0],"139460930":[2,1,0,0],"139460931":[3,0,0,0],"139461074":[3,0,0,0],"139460932":[3,0,0,0],"139460608":[0,0,0,0],"139460609":[0,0,0,0],"139460610":[0,0,0,0],"139460620":[0,0,0,0],"139460621":[1,0,0,0],"139460622":[1,0,0,0],"139460936":[1,0,0,0],"139460937":[1,0,0,0],"139460938":[1,0,0,0],"139460730":[0,0,0,0],"139460731":[0,0,0,0],"139460732":[0,0,0,0],"139460939":[0,0,0,0],"139460940":[0,0,0,0],"139460941":[0,0,0,0],"139460721":[0,0,0,0],"139460722":[0,0,0,0],"139460723":[0,0,0,0],"139460942":[2,0,0,0],"139460943":[2,0,0,0],"139460944":[2,0,0,0],"139460945":[2,2,2,0],"139460718":[0,0,0,0],"139460719":[2,0,0,0],"139460720":[2,0,0,0],"139460946":[2,0,0,0],"139460947":[2,0,0,0],"139460948":[2,0,0,0],"139461064":[4,2,0,0],"139460611":[0,0,0,0],"139460612":[1,1,0,0],"139460613":[1,1,0,0],"139460949":[1,1,0,0],"139460950":[1,1,0,0],"139460951":[2,1,0,0],"139460691":[0,0,0,0],"139460692":[0,0,0,0],"139460693":[1,1,1,0],"139460952":[1,1,1,0],"139460953":[2,1,1,0],"139460617":[0,0,0,0],"139460618":[0,0,0,0],"139460619":[0,0,0,0],"139460954":[3,0,0,0],"139460955":[3,0,0,0],"139460956":[3,0,0,0],"139460957":[2,0,0,0],"139460958":[2,0,0,0],"139460959":[2,0,0,0],"139460706":[0,0,0,0],"139460707":[0,0,0,0],"139460708":[1,0,0,0],"139460960":[2,1,0,0],"139460961":[2,1,0,0],"139460962":[2,1,0,0],"139461062":[3,0,0,0],"139460963":[1,0,0,0],"139460964":[1,0,0,0],"139460965":[1,0,0,0],"139461060":[4,1,1,0],"139460724":[0,0,0,0],"139460725":[0,0,0,0],"139460726":[0,0,0,0],"139460966":[2,0,0,0],"139460967":[2,0,0,0],"139461061":[2,0,0,0],"139460628":[0,0,0,0],"139460629":[0,0,0,0],"139460630":[0,0,0,0],"139460685":[0,0,0,0],"139460686":[0,0,0,0],"139460687":[2,0,0,0],"139460968":[2,0,0,0],"139460969":[2,0,0,0],"139460970":[2,1,0,0],"139460971":[1,0,0,0],"139460972":[1,0,0,0],"139460973":[1,0,0,0],"139460974":[0,0,0,0],"139460975":[0,0,0,0],"139460976":[0,0,0,0],"139460715":[0,0,0,0],"139460716":[2,1,0,0],"139460717":[2,1,0,0],"139460977":[2,1,0,0],"139460978":[2,1,0,0],"139460979":[2,1,0,0],"139460709":[0,0,0,0],"139460710":[0,0,0,0],"139460711":[1,1,0,0],"139460980":[1,1,0,0],"139460981":[1,1,0,0],"139460982":[1,1,0,0],"139460688":[0,0,0,0],"139460689":[0,0,0,0],"139460690":[1,1,0,0],"139460983":[1,1,0,0],"139460984":[1,1,0,0],"139460679":[0,0,0,0],"139460680":[0,0,0,0],"139460681":[2,0,0,0],"139460985":[2,0,0,0],"139460986":[2,0,0,0],"139460623":[0,0,0,0],"139460624":[0,0,0,0],"139460625":[0,0,0,0],"139460712":[0,0,0,0],"139460713":[0,0,0,0],"139460714":[1,0,0,0],"139460987":[1,0,0,0],"139460988":[1,0,0,0],"139460989":[2,2,0,0],"139460700":[0,0,0,0],"139460701":[0,0,0,0],"139460702":[0,0,0,0],"139460990":[3,0,0,0],"139460991":[3,1,0,0],"139460992":[3,1,0,0],"139460673":[1,0,0,0],"139460674":[2,0,0,0],"139460675":[3,0,0,0],"139460993":[3,0,0,0],"139460994":[3,0,0,0],"139460995":[3,1,1,0],"139460657":[0,0,0,0],"139460658":[0,0,0,0],"139460659":[1,0,0,0],"139460996":[1,1,0,0],"139460997":[1,1,0,0],"139460998":[2,2,0,0],"139460999":[1,1,0,0],"139461000":[1,1,0,0],"139461001":[1,1,0,0],"139460694":[0,0,0,0],"139460695":[0,0,0,0],"139460696":[2,1,1,0],"139461002":[2,1,1,0],"139461003":[2,1,1,0],"139461004":[2,1,1,0],"139461005":[3,1,1,0],"139461006":[3,2,1,0],"139461007":[4,2,1,0],"139460676":[0,0,0,0],"139460677":[0,0,0,0],"139460678":[2,0,0,0],"139461008":[2,0,0,0],"139461009":[2,2,0,0],"139460651":[0,0,0,0],"139460652":[0,0,0,0],"139460653":[2,1,0,0],"139461010":[2,1,0,0],"139461011":[3,2,0,0],"139460626":[1,1,0,0],"139460627":[1,1,1,0],"139461012":[1,1,1,0],"139461013":[1,1,1,0],"139461014":[1,1,1,0],"139461015":[4,0,0,0],"139461016":[4,0,0,0],"139461017":[4,0,0,0],"139461018":[2,0,0,0],"139461019":[2,0,0,0],"139461020":[2,0,0,0],"139460631":[0,0,0,0],"139460632":[0,0,0,0],"139460633":[0,0,0,0],"139461021":[0,0,0,0],"139461022":[0,0,0,0],"139461024":[0,0,0,0],"139460660":[0,0,0,0],"139460661":[0,0,0,0],"139460662":[2,1,0,0],"139461025":[2,1,0,0],"139461026":[2,1,0,0],"139461027":[3,2,0,0],"139461043":[2,0,0,0],"139461044":[2,0,0,0],"139461045":[2,0,0,0],"139461046":[0,0,0,0],"139461047":[0,0,0,0],"139461079":[3,1,0,0],"139460739":[0,0,0,0],"139460740":[3,0,0,0],"139460741":[3,0,0,0],"139461028":[3,0,0,0],"139461029":[3,0,0,0],"139461049":[2,2,0,0],"139460666":[0,0,0,0],"139460667":[0,0,0,0],"139460668":[0,0,0,0],"139461030":[0,0,0,0],"139460669":[0,0,0,0],"139460670":[0,0,0,0],"139461034":[0,0,0,0],"139460742":[1,0,0,0],"139460743":[1,0,0,0],"139460744":[1,0,0,0],"139461032":[1,0,0,0],"139461033":[1,1,0,0],"139460733":[1,0,0,0],"139460734":[1,0,0,0],"139461036":[1,0,0,0],"139461037":[1,0,0,0],"139460735":[0,0,0,0],"139460736":[0,0,0,0],"139461038":[2,0,0,0],"139461039":[2,0,0,0],"139460737":[2,1,1,0],"139460738":[2,1,1,0],"139461040":[2,2,1,0],"139461041":[3,2,2,0],"139460671":[2,0,0,0],"139460672":[2,0,0,0],"139461042":[2,0,0,0],"139461048":[0,0,0,0],"139461081":[4,0,0,0],"139461082":[0,0,0,0],"139460647":[0,0,0,0],"139460648":[0,0,0,0],"139460649":[2,2,0,0],"139460650":[2,2,0,0],"139461050":[2,2,0,0],"139461052":[2,2,0,0],"139460644":[0,0,0,0],"139460645":[3,0,0,0],"139460646":[3,0,0,0],"139461053":[3,0,0,0],"139461055":[3,0,0,0],"139461056":[2,0,0,0],"139461058":[2,1,0,0],"139461059":[0,0,0,0],"139460640":[0,0,0,0],"139460641":[0,0,0,0],"139460642":[0,0,0,0],"139460745":[0,0,0,0],"139460746":[0,0,0,0],"139460643":[0,0,0,0],"139460749":[3,0,0,0],"139460750":[3,0,0,0],"136315018":[0,0,0,0],"136315019":[0,0,0,0],"136315330":[0,0,0,0],"136315331":[0,0,0,0],"136315332":[0,0,0,0],"136314903":[0,0,0,0],"136314904":[0,0,0,0],"136314905":[0,0,0,0],"136314906":[0,0,0,0],"136314907":[2,0,0,0],"136314908":[2,1,0,0],"136315180":[4,1,0,0],"136315181":[4,1,0,0],"136315182":[4,2,0,0],"136315221":[4,0,0,0],"136315222":[4,0,0,0],"136315341":[4,4,4,0],"136314991":[0,0,0,0],"136314992":[2,0,0,0],"136314993":[2,0,0,0],"136315183":[2,0,0,0],"136315184":[2,0,0,0],"136315185":[2,0,0,0],"136315323":[4,2,0,0],"136314994":[0,0,0,0],"136314995":[1,0,0,0],"136314996":[1,0,0,0],"136315186":[1,0,0,0],"136315187":[1,0,0,0],"136315188":[1,0,0,0],"136315189":[2,2,2,0],"136314925":[0,0,0,0],"136314926":[3,0,0,0],"136314927":[3,0,0,0],"136315190":[3,0,0,0],"136315191":[3,0,0,0],"136315192":[3,1,0,0],"136315193":[2,0,0,0],"136315194":[3,0,0,0],"136315195":[4,0,0,0],"136315000":[0,0,0,0],"136315001":[1,1,0,0],"136315002":[1,1,0,0],"136315196":[1,1,0,0],"136315197":[1,1,0,0],"136314964":[0,0,0,0],"136314965":[0,0,0,0],"136314966":[1,1,0,0],"136315198":[1,1,0,0],"136315199":[2,1,0,0],"136314967":[0,0,0,0],"136314968":[0,0,0,0],"136314969":[2,1,1,0],"136315200":[2,1,1,0],"136315201":[2,1,1,0],"136315202":[3,1,1,0],"136315203":[3,1,1,0],"136315204":[3,2,1,0],"136315205":[4,2,1,0],"136315003":[0,0,0,0],"136315004":[0,0,0,0],"136315005":[0,0,0,0],"136315206":[0,0,0,0],"136315207":[0,0,0,0],"136315208":[0,0,0,0],"136314883":[0,0,0,0],"136314884":[0,0,0,0],"136314885":[1,1,1,0],"136315209":[1,1,1,0],"136315210":[1,1,1,0],"136315211":[1,1,1,0],"136315212":[1,1,0,0],"136315213":[1,1,0,0],"136315214":[1,1,0,0],"136314880":[0,0,0,0],"136314881":[0,0,0,0],"136314882":[0,0,0,0],"136314886":[0,0,0,0],"136314887":[1,0,0,0],"136314888":[1,0,0,0],"136315218":[1,0,0,0],"136315219":[1,0,0,0],"136315220":[1,0,0,0],"136314961":[1,0,0,0],"136314962":[1,1,0,0],"136314963":[1,1,0,0],"136315223":[1,1,0,0],"136315224":[1,1,0,0],"136314891":[2,0,0,0],"136314892":[3,0,0,0],"136314893":[3,0,0,0],"136315225":[3,0,0,0],"136315226":[3,0,0,0],"136315227":[3,0,0,0],"136314979":[0,0,0,0],"136314980":[2,1,0,0],"136314981":[2,1,0,0],"136315228":[3,1,0,0],"136315229":[3,1,0,0],"136315230":[3,2,0,0],"136314997":[0,0,0,0],"136314998":[0,0,0,0],"136314999":[0,0,0,0],"136315231":[0,0,0,0],"136315232":[0,0,0,0],"136315320":[3,0,0,0],"136314985":[0,0,0,0],"136314986":[0,0,0,0],"136314987":[2,1,0,0],"136315233":[2,1,0,0],"136315234":[2,1,0,0],"136315235":[2,1,0,0],"136314922":[0,0,0,0],"136314923":[0,0,0,0],"136314924":[2,0,0,0],"136315236":[2,0,0,0],"136315237":[2,0,0,0],"136315238":[4,0,0,0],"136314973":[0,0,0,0],"136314974":[0,0,0,0],"136314975":[2,1,0,0],"136315239":[2,1,0,0],"136315240":[2,1,0,0],"136315241":[2,1,0,0],"136314958":[0,0,0,0],"136314959":[0,0,0,0],"136314960":[1,1,0,0],"136315242":[1,1,0,0],"136315243":[2,1,0,0],"136314894":[0,0,0,0],"136314895":[0,0,0,0],"136314896":[0,0,0,0],"136314897":[0,0,0,0],"136314898":[0,0,0,0],"136314899":[0,0,0,0],"136315244":[0,0,0,0],"136315245":[0,0,0,0],"136315246":[0,0,0,0],"136315247":[4,0,0,0],"136315248":[4,0,0,0],"136315249":[4,2,0,0],"136314982":[0,0,0,0],"136314983":[0,0,0,0],"136314984":[0,0,0,0],"136315250":[0,0,0,0],"136315251":[0,0,0,0],"136315252":[0,0,0,0],"136315321":[3,0,0,0],"136315253":[0,0,0,0],"136315254":[0,0,0,0],"136315255":[0,0,0,0],"136315319":[4,1,1,0],"136314900":[0,0,0,0],"136314901":[2,0,0,0],"136314902":[3,0,0,0],"136315256":[3,0,0,0],"136315257":[3,0,0,0],"136315258":[3,0,0,0],"136315259":[1,0,0,0],"136315260":[1,0,0,0],"136315261":[1,0,0,0],"136314970":[0,0,0,0],"136314971":[0,0,0,0],"136314972":[1,1,0,0],"136315262":[1,1,0,0],"136315263":[1,1,0,0],"136315264":[1,1,0,0],"136315006":[0,0,0,0],"136315007":[0,0,0,0],"136315008":[0,0,0,0],"136315265":[0,0,0,0],"136315266":[0,0,0,0],"136315267":[0,0,0,0],"136314941":[0,0,0,0],"136314942":[0,0,0,0],"136314943":[1,1,1,0],"136314988":[2,1,0,0],"136314989":[2,1,0,0],"136314990":[2,1,0,0],"136315268":[2,1,0,0],"136315269":[2,1,0,0],"136315270":[2,1,0,0],"136314931":[0,0,0,0],"136314932":[2,0,0,0],"136314933":[2,0,0,0],"136315271":[2,0,0,0],"136315272":[2,0,0,0],"136315273":[2,0,0,0],"136314919":[0,0,0,0],"136314920":[0,0,0,0],"136314921":[2,1,0,0],"136315274":[2,1,0,0],"136315275":[3,2,0,0],"136314976":[0,0,0,0],"136314977":[0,0,0,0],"136314978":[1,1,1,0],"136315276":[2,1,1,0],"136315277":[2,1,1,0],"136314944":[0,0,0,0],"136314945":[0,0,0,0],"136314951":[0,0,0,0],"136314952":[3,1,0,0],"136315278":[4,1,0,0],"136315279":[4,2,1,0],"136314955":[3,1,0,0],"136314956":[3,1,0,0],"136314957":[3,1,0,0],"136315280":[4,1,0,0],"136315281":[4,2,1,0],"136314953":[0,0,0,0],"136314954":[1,1,1,0],"136315282":[1,1,1,0],"136315283":[1,1,1,0],"136314949":[0,0,0,0],"136314950":[2,2,0,0],"136315284":[3,2,0,0],"136315285":[4,2,1,0],"136314946":[0,0,0,0],"136314947":[0,0,0,0],"136314948":[3,1,0,0],"136315286":[4,1,0,0],"136315287":[4,2,1,0],"136314928":[0,0,0,0],"136314929":[0,0,0,0],"136314930":[2,1,0,0],"136315288":[2,1,0,0],"136315289":[2,1,0,0],"136315290":[3,2,0,0],"136315302":[2,0,0,0],"136315303":[2,0,0,0],"136315304":[2,0,0,0],"136315305":[0,0,0,0],"136315306":[0,0,0,0],"136315337":[3,1,0,0],"136315013":[0,0,0,0],"136315014":[3,0,0,0],"136315015":[3,0,0,0],"136315291":[3,0,0,0],"136315292":[3,0,0,0],"136315308":[2,2,0,0],"136314934":[0,0,0,0],"136314935":[0,0,0,0],"136314936":[0,0,0,0],"136315293":[0,0,0,0],"136314937":[0,0,0,0],"136314938":[0,0,0,0],"136315295":[0,0,0,0],"136315009":[1,0,0,0],"136315010":[1,0,0,0],"136315297":[1,0,0,0],"136315298":[1,0,0,0],"136315011":[0,0,0,0],"136315012":[0,0,0,0],"136315299":[0,0,0,0],"136315300":[0,0,0,0],"136314939":[2,0,0,0],"136314940":[2,0,0,0],"136315301":[3,0,0,0],"136315307":[0,0,0,0],"136315339":[4,1,0,0],"136315340":[0,0,0,0],"136314916":[0,0,0,0],"136314917":[0,0,0,0],"136314918":[3,0,0,0],"136315309":[3,0,0,0],"136315310":[3,0,0,0],"136314913":[0,0,0,0],"136314914":[0,0,0,0],"136314915":[3,0,0,0],"136315311":[3,0,0,0],"136315312":[3,0,0,0],"136314889":[1,1,1,0],"136314890":[1,1,1,0],"136315313":[1,1,1,0],"136315314":[1,1,1,0],"136315315":[2,0,0,0],"136315317":[2,1,0,0],"136315318":[0,0,0,0],"136314909":[0,0,0,0],"136314910":[0,0,0,0],"136314911":[0,0,0,0],"136315016":[0,0,0,0],"136315017":[0,0,0,0],"136314912":[0,0,0,0],"142606469":[0,0,0,0],"142606470":[0,0,0,0],"142606805":[0,0,0,0],"142606806":[0,0,0,0],"142606807":[0,0,0,0],"142606366":[0,0,0,0],"142606367":[0,0,0,0],"142606368":[0,0,0,0],"142606369":[0,0,0,0],"142606370":[2,0,0,0],"142606371":[2,1,0,0],"142606636":[4,1,0,0],"142606637":[4,1,0,0],"142606638":[4,2,0,0],"142606639":[4,0,0,0],"142606640":[4,0,0,0],"142606817":[4,4,4,0],"142606397":[0,0,0,0],"142606398":[2,1,0,0],"142606399":[2,1,0,0],"142606641":[2,1,0,0],"142606642":[2,1,0,0],"142606643":[2,1,0,0],"142606644":[3,0,0,0],"142606808":[3,0,0,0],"142606645":[3,0,0,0],"142606446":[0,0,0,0],"142606447":[0,0,0,0],"142606448":[2,0,0,0],"142606646":[2,0,0,0],"142606647":[2,0,0,0],"142606428":[0,0,0,0],"142606429":[1,1,0,0],"142606430":[1,1,0,0],"142606648":[1,1,0,0],"142606649":[1,1,0,0],"142606650":[1,1,0,0],"142606413":[0,0,0,0],"142606414":[0,0,0,0],"142606415":[2,1,0,0],"142606651":[2,1,0,0],"142606652":[2,1,0,0],"142606422":[0,0,0,0],"142606423":[0,0,0,0],"142606424":[2,1,1,0],"142606653":[2,1,1,0],"142606654":[2,1,1,0],"142606655":[2,1,1,0],"142606336":[0,0,0,0],"142606337":[0,0,0,0],"142606338":[0,0,0,0],"142606339":[0,0,0,0],"142606340":[1,0,0,0],"142606341":[1,0,0,0],"142606656":[2,0,0,0],"142606657":[2,0,0,0],"142606658":[2,0,0,0],"142606449":[0,0,0,0],"142606450":[1,0,0,0],"142606451":[1,0,0,0],"142606659":[1,0,0,0],"142606660":[1,0,0,0],"142606661":[1,0,0,0],"142606440":[0,0,0,0],"142606441":[1,0,0,0],"142606442":[1,0,0,0],"142606662":[1,0,0,0],"142606663":[1,0,0,0],"142606664":[1,0,0,0],"142606665":[2,2,2,0],"142606388":[0,0,0,0],"142606389":[2,0,0,0],"142606390":[2,0,0,0],"142606666":[2,1,0,0],"142606667":[2,1,0,0],"142606668":[3,1,0,0],"142606416":[0,0,0,0],"142606417":[0,0,0,0],"142606418":[1,1,1,0],"142606669":[1,1,1,0],"142606670":[4,1,1,0],"142606354":[0,0,0,0],"142606355":[2,0,0,0],"142606356":[3,0,0,0],"142606671":[3,0,0,0],"142606672":[3,0,0,0],"142606673":[3,1,0,0],"142606674":[2,0,0,0],"142606675":[2,0,0,0],"142606676":[2,0,0,0],"142606437":[0,0,0,0],"142606438":[2,0,0,0],"142606439":[2,0,0,0],"142606677":[2,0,0,0],"142606678":[2,0,0,0],"142606679":[2,0,0,0],"142606784":[4,2,0,0],"142606351":[0,0,0,0],"142606352":[1,1,0,0],"142606353":[1,1,0,0],"142606680":[4,1,0,0],"142606681":[4,1,0,0],"142606682":[4,2,1,0],"142606342":[0,0,0,0],"142606343":[0,0,0,0],"142606344":[2,0,0,0],"142606686":[1,0,0,0],"142606687":[1,0,0,0],"142606688":[1,0,0,0],"142606407":[2,0,0,0],"142606408":[2,0,0,0],"142606409":[2,2,0,0],"142606689":[2,2,1,0],"142606690":[2,2,2,0],"142606434":[0,0,0,0],"142606435":[2,1,0,0],"142606436":[2,1,0,0],"142606691":[2,1,0,0],"142606692":[2,1,0,0],"142606693":[2,1,0,0],"142606357":[0,0,0,0],"142606358":[0,0,0,0],"142606359":[0,0,0,0],"142606360":[0,0,0,0],"142606361":[0,0,0,0],"142606362":[0,0,0,0],"142606694":[0,0,0,0],"142606695":[0,0,0,0],"142606696":[0,0,0,0],"142606697":[1,0,0,0],"142606698":[1,0,0,0],"142606699":[1,0,0,0],"142606700":[4,0,0,0],"142606701":[4,0,0,0],"142606702":[4,1,0,0],"142606703":[2,0,0,0],"142606704":[2,0,0,0],"142606705":[2,0,0,0],"142606443":[0,0,0,0],"142606444":[0,0,0,0],"142606445":[0,0,0,0],"142606706":[1,0,0,0],"142606707":[2,0,0,0],"142606782":[4,1,0,0],"142606708":[0,0,0,0],"142606709":[0,0,0,0],"142606710":[0,0,0,0],"142606781":[4,1,1,0],"142606452":[0,0,0,0],"142606453":[0,0,0,0],"142606454":[0,0,0,0],"142606711":[0,0,0,0],"142606712":[0,0,0,0],"142606713":[0,0,0,0],"142606425":[0,0,0,0],"142606426":[0,0,0,0],"142606427":[0,0,0,0],"142606714":[0,0,0,0],"142606715":[0,0,0,0],"142606716":[0,0,0,0],"142606431":[0,0,0,0],"142606432":[1,1,0,0],"142606433":[1,1,0,0],"142606717":[2,1,0,0],"142606718":[2,1,0,0],"142606719":[2,1,0,0],"142606363":[0,0,0,0],"142606364":[0,0,0,0],"142606365":[1,1,0,0],"142606732":[2,1,0,0],"142606733":[2,1,0,0],"142606734":[3,1,0,0],"142606419":[0,0,0,0],"142606420":[2,1,1,0],"142606421":[2,1,1,0],"142606720":[2,1,1,0],"142606721":[2,1,1,0],"142606722":[3,1,1,0],"142606723":[3,1,1,0],"142606724":[3,2,1,0],"142606725":[4,2,1,0],"142606391":[0,0,0,0],"142606392":[1,1,0,0],"142606393":[2,1,0,0],"142606726":[2,1,0,0],"142606727":[2,1,0,0],"142606728":[2,1,0,0],"142606729":[1,1,0,0],"142606730":[1,1,0,0],"142606731":[1,1,0,0],"142606410":[0,0,0,0],"142606411":[0,0,0,0],"142606412":[1,1,0,0],"142606735":[2,1,0,0],"142606736":[2,2,0,0],"142606394":[0,0,0,0],"142606395":[0,0,0,0],"142606396":[2,1,0,0],"142606737":[2,1,0,0],"142606738":[2,1,0,0],"142606739":[3,2,0,0],"142606755":[1,0,0,0],"142606756":[1,0,0,0],"142606757":[1,0,0,0],"142606758":[0,0,0,0],"142606759":[0,0,0,0],"142606813":[3,1,0,0],"142606461":[0,0,0,0],"142606462":[3,0,0,0],"142606463":[3,0,0,0],"142606740":[3,0,0,0],"142606741":[3,0,0,0],"142606761":[2,2,0,0],"142606400":[0,0,0,0],"142606401":[0,0,0,0],"142606402":[0,0,0,0],"142606742":[0,0,0,0],"142606464":[1,0,0,0],"142606465":[1,0,0,0],"142606466":[1,0,0,0],"142606744":[1,0,0,0],"142606745":[1,0,0,0],"142606403":[0,0,0,0],"142606404":[0,0,0,0],"142606746":[0,0,0,0],"142606455":[2,0,0,0],"142606456":[2,0,0,0],"142606748":[2,0,0,0],"142606749":[2,0,0,0],"142606457":[2,0,0,0],"142606458":[2,0,0,0],"142606750":[2,0,0,0],"142606751":[2,0,0,0],"142606459":[2,1,1,0],"142606460":[2,1,1,0],"142606752":[2,1,1,0],"142606753":[3,2,1,0],"142606405":[2,0,0,0],"142606406":[2,0,0,0],"142606754":[2,0,0,0],"142606760":[0,0,0,0],"142606815":[4,1,0,0],"142606816":[0,0,0,0],"142606379":[2,0,0,0],"142606380":[2,0,0,0],"142606381":[3,0,0,0],"142606762":[4,0,0,0],"142606763":[4,0,0,0],"142606382":[0,0,0,0],"142606383":[2,1,0,0],"142606384":[2,1,0,0],"142606764":[2,1,0,0],"142606765":[2,1,0,0],"142606385":[0,0,0,0],"142606386":[1,0,0,0],"142606387":[1,0,0,0],"142606766":[1,0,0,0],"142606768":[2,2,1,0],"142606345":[0,0,0,0],"142606346":[2,0,0,0],"142606347":[2,0,0,0],"142606769":[2,0,0,0],"142606772":[2,0,0,0],"142606348":[0,0,0,0],"142606349":[0,0,0,0],"142606350":[0,0,0,0],"142606773":[2,0,0,0],"142606774":[4,0,0,0],"142606376":[0,0,0,0],"142606377":[2,1,1,0],"142606378":[2,1,1,0],"142606775":[2,1,1,0],"142606776":[2,1,1,0],"142606803":[3,0,0,0],"142606804":[3,0,0,0],"142606777":[2,0,0,0],"142606779":[2,1,0,0],"142606780":[0,0,0,0],"142606372":[0,0,0,0],"142606373":[0,0,0,0],"142606374":[0,0,0,0],"142606467":[0,0,0,0],"142606468":[0,0,0,0],"142606375":[0,0,0,0],"137363597":[0,0,0,0],"137363598":[0,0,0,0],"137363904":[0,0,0,0],"137363905":[0,0,0,0],"137363906":[0,0,0,0],"137363483":[0,0,0,0],"137363484":[0,0,0,0],"137363485":[0,0,0,0],"137363486":[0,0,0,0],"137363487":[2,0,0,0],"137363488":[2,1,0,0],"137363756":[4,1,0,0],"137363757":[4,1,0,0],"137363758":[4,2,0,0],"137363759":[4,0,0,0],"137363760":[4,0,0,0],"137363916":[4,4,4,0],"137363571":[0,0,0,0],"137363572":[1,0,0,0],"137363573":[1,0,0,0],"137363761":[1,0,0,0],"137363762":[1,0,0,0],"137363763":[1,0,0,0],"137363764":[2,2,2,0],"137363553":[0,0,0,0],"137363554":[1,0,0,0],"137363555":[1,0,0,0],"137363765":[1,0,0,0],"137363766":[1,0,0,0],"137363767":[2,0,0,0],"137363519":[0,0,0,0],"137363520":[2,1,0,0],"137363521":[2,1,0,0],"137363768":[2,1,0,0],"137363769":[2,1,0,0],"137363770":[2,1,0,0],"137363771":[3,0,0,0],"137363907":[3,0,0,0],"137363772":[3,0,0,0],"137363506":[0,0,0,0],"137363507":[3,0,0,0],"137363508":[3,0,0,0],"137363773":[3,0,0,0],"137363774":[3,0,0,0],"137363775":[3,0,0,0],"137363776":[1,0,0,0],"137363777":[1,0,0,0],"137363778":[2,0,0,0],"137363535":[0,0,0,0],"137363536":[0,0,0,0],"137363537":[1,1,1,0],"137363779":[2,2,1,0],"137363780":[2,2,2,0],"137363460":[0,0,0,0],"137363461":[1,1,1,0],"137363462":[1,1,1,0],"137363781":[1,1,1,0],"137363782":[2,1,1,0],"137363783":[2,2,1,0],"137363456":[0,0,0,0],"137363457":[0,0,0,0],"137363458":[0,0,0,0],"137363459":[0,0,0,0],"137363472":[1,0,0,0],"137363473":[1,0,0,0],"137363787":[1,0,0,0],"137363788":[1,0,0,0],"137363789":[1,0,0,0],"137363463":[1,1,1,0],"137363464":[1,1,1,0],"137363465":[1,1,1,0],"137363784":[1,1,1,0],"137363785":[1,1,1,0],"137363786":[2,1,1,0],"137363580":[0,0,0,0],"137363581":[0,0,0,0],"137363582":[0,0,0,0],"137363790":[0,0,0,0],"137363791":[0,0,0,0],"137363792":[0,0,0,0],"137363565":[0,0,0,0],"137363566":[2,1,0,0],"137363567":[2,1,0,0],"137363793":[2,1,0,0],"137363794":[2,1,0,0],"137363795":[2,1,0,0],"137363562":[0,0,0,0],"137363563":[0,0,0,0],"137363564":[1,1,0,0],"137363796":[1,1,0,0],"137363797":[1,1,0,0],"137363798":[1,1,0,0],"137363538":[0,0,0,0],"137363539":[0,0,0,0],"137363540":[1,1,1,0],"137363799":[2,1,1,0],"137363800":[3,1,1,0],"137363469":[1,1,0,0],"137363470":[1,1,0,0],"137363471":[1,1,0,0],"137363801":[1,1,0,0],"137363802":[1,1,0,0],"137363803":[1,1,0,0],"137363532":[0,0,0,0],"137363533":[0,0,0,0],"137363534":[2,0,0,0],"137363804":[2,0,0,0],"137363805":[2,1,0,0],"137363509":[0,0,0,0],"137363510":[0,0,0,0],"137363511":[1,1,0,0],"137363806":[1,1,0,0],"137363807":[1,1,0,0],"137363808":[2,2,0,0],"137363809":[1,0,0,0],"137363810":[2,0,0,0],"137363811":[3,0,0,0],"137363547":[0,0,0,0],"137363548":[0,0,0,0],"137363549":[2,0,0,0],"137363812":[4,0,0,0],"137363813":[4,0,0,0],"137363814":[4,0,0,0],"137363466":[0,0,0,0],"137363467":[0,0,0,0],"137363468":[2,1,1,0],"137363815":[2,1,1,0],"137363816":[2,1,1,0],"137363817":[2,1,1,0],"137363818":[1,1,0,0],"137363819":[1,1,0,0],"137363820":[1,1,0,0],"137363474":[0,0,0,0],"137363475":[0,0,0,0],"137363476":[0,0,0,0],"137363480":[0,0,0,0],"137363481":[0,0,0,0],"137363482":[0,0,0,0],"137363583":[0,0,0,0],"137363584":[0,0,0,0],"137363585":[0,0,0,0],"137363824":[0,0,0,0],"137363825":[0,0,0,0],"137363826":[0,0,0,0],"137363477":[0,0,0,0],"137363478":[2,0,0,0],"137363479":[3,0,0,0],"137363827":[3,0,0,0],"137363828":[3,0,0,0],"137363829":[3,0,0,0],"137363821":[0,0,0,0],"137363822":[0,0,0,0],"137363823":[0,0,0,0],"137363830":[1,0,0,0],"137363831":[1,0,0,0],"137363832":[1,0,0,0],"137363556":[1,1,0,0],"137363557":[2,1,0,0],"137363558":[2,1,0,0],"137363833":[3,1,0,0],"137363834":[3,1,0,0],"137363835":[3,1,0,0],"137363559":[0,0,0,0],"137363560":[0,0,0,0],"137363561":[1,0,0,0],"137363574":[0,0,0,0],"137363575":[0,0,0,0],"137363576":[0,0,0,0],"137363836":[0,0,0,0],"137363837":[0,0,0,0],"137363895":[2,0,0,0],"137363838":[1,0,0,0],"137363839":[1,0,0,0],"137363840":[1,0,0,0],"137363894":[4,1,1,0],"137363515":[0,0,0,0],"137363516":[2,0,0,0],"137363517":[2,0,0,0],"137363518":[2,0,0,0],"137363841":[2,0,0,0],"137363842":[2,0,0,0],"137363843":[3,0,0,0],"137363577":[0,0,0,0],"137363578":[1,1,0,0],"137363579":[1,1,0,0],"137363844":[1,1,0,0],"137363845":[1,1,0,0],"137363550":[0,0,0,0],"137363551":[0,0,0,0],"137363552":[0,0,0,0],"137363846":[0,0,0,0],"137363847":[0,0,0,0],"137363541":[0,0,0,0],"137363542":[0,0,0,0],"137363543":[2,1,1,0],"137363848":[3,1,1,0],"137363849":[3,1,1,0],"137363850":[3,1,1,0],"137363851":[3,1,1,0],"137363852":[3,2,1,0],"137363853":[4,2,1,0],"137363503":[0,0,0,0],"137363504":[0,0,0,0],"137363505":[2,1,0,0],"137363854":[2,1,0,0],"137363855":[3,2,0,0],"137363568":[0,0,0,0],"137363569":[2,0,0,0],"137363570":[2,0,0,0],"137363856":[2,1,0,0],"137363857":[2,1,0,0],"137363858":[2,1,0,0],"137363897":[4,2,0,0],"137363544":[0,0,0,0],"137363545":[0,0,0,0],"137363546":[1,0,0,0],"137363859":[2,0,0,0],"137363860":[2,0,0,0],"137363861":[2,0,0,0],"137363512":[0,0,0,0],"137363513":[0,0,0,0],"137363514":[2,1,0,0],"137363862":[2,1,0,0],"137363863":[2,1,0,0],"137363864":[3,2,0,0],"137363878":[0,0,0,0],"137363879":[2,0,0,0],"137363880":[2,0,0,0],"137363881":[0,0,0,0],"137363882":[0,0,0,0],"137363912":[3,1,0,0],"137363529":[1,1,1,0],"137363530":[1,1,1,0],"137363531":[1,1,1,0],"137363865":[1,1,1,0],"137363866":[1,1,1,0],"137363592":[0,0,0,0],"137363593":[3,0,0,0],"137363594":[3,0,0,0],"137363867":[3,0,0,0],"137363868":[3,0,0,0],"137363884":[2,2,0,0],"137363522":[0,0,0,0],"137363523":[0,0,0,0],"137363524":[0,0,0,0],"137363869":[0,0,0,0],"137363525":[0,0,0,0],"137363526":[0,0,0,0],"137363870":[0,0,0,0],"137363586":[1,0,0,0],"137363587":[1,0,0,0],"137363871":[1,0,0,0],"137363872":[2,0,0,0],"137363588":[1,1,0,0],"137363589":[1,1,0,0],"137363873":[1,1,0,0],"137363874":[1,1,0,0],"137363590":[1,0,0,0],"137363591":[1,0,0,0],"137363875":[1,0,0,0],"137363876":[1,0,0,0],"137363527":[2,0,0,0],"137363528":[2,0,0,0],"137363877":[3,0,0,0],"137363883":[0,0,0,0],"137363914":[4,0,0,0],"137363915":[0,0,0,0],"137363493":[0,0,0,0],"137363494":[2,0,0,0],"137363495":[2,0,0,0],"137363885":[2,0,0,0],"137363886":[4,0,0,0],"137363496":[0,0,0,0],"137363497":[0,0,0,0],"137363498":[2,2,0,0],"137363499":[2,2,0,0],"137363887":[2,2,0,0],"137363888":[2,2,0,0],"137363500":[0,0,0,0],"137363501":[0,0,0,0],"137363502":[3,1,0,0],"137363889":[3,1,0,0],"137363890":[3,1,1,0],"137363891":[2,0,0,0],"137363892":[2,1,0,0],"137363893":[0,0,0,0],"137363489":[0,0,0,0],"137363490":[0,0,0,0],"137363491":[0,0,0,0],"137363595":[0,0,0,0],"137363596":[0,0,0,0],"137363492":[0,0,0,0],"143655045":[0,0,0,0],"143655046":[0,0,0,0],"143655365":[0,0,0,0],"143655366":[0,0,0,0],"143655367":[0,0,0,0],"143654923":[0,0,0,0],"143654924":[0,0,0,0],"143654925":[0,0,0,0],"143654926":[0,0,0,0],"143654927":[2,0,0,0],"143654928":[2,1,0,0],"143655212":[4,1,0,0],"143655213":[4,1,0,0],"143655214":[4,2,0,0],"143655215":[4,0,0,0],"143655216":[4,0,0,0],"143655376":[4,4,4,0],"143655016":[0,0,0,0],"143655017":[1,0,0,0],"143655018":[1,0,0,0],"143655217":[1,0,0,0],"143655218":[1,0,0,0],"143655219":[2,0,0,0],"143655220":[2,2,2,0],"143654958":[2,1,1,0],"143654959":[2,1,1,0],"143654960":[2,1,1,0],"143655221":[2,1,1,0],"143655222":[2,1,1,0],"143655223":[2,1,1,0],"143655224":[2,1,1,0],"143655225":[2,1,1,0],"143655226":[2,1,1,0],"143655001":[0,0,0,0],"143655002":[0,0,0,0],"143655003":[2,0,0,0],"143655227":[3,0,0,0],"143655228":[3,0,0,0],"143655022":[0,0,0,0],"143655023":[0,0,0,0],"143655024":[1,1,0,0],"143655229":[1,1,0,0],"143655230":[1,1,0,0],"143654983":[0,0,0,0],"143654984":[0,0,0,0],"143654985":[2,0,0,0],"143655231":[2,0,0,0],"143655232":[2,0,0,0],"143655025":[0,0,0,0],"143655026":[0,0,0,0],"143655027":[0,0,0,0],"143655233":[0,0,0,0],"143655234":[0,0,0,0],"143655235":[0,0,0,0],"143655007":[0,0,0,0],"143655008":[2,0,0,0],"143655009":[2,1,0,0],"143655236":[2,1,0,0],"143655237":[2,1,0,0],"143655238":[2,1,0,0],"143654952":[0,0,0,0],"143654953":[0,0,0,0],"143654954":[2,1,0,0],"143655239":[2,1,0,0],"143655240":[2,1,0,0],"143655241":[2,2,0,0],"143655242":[2,2,0,0],"143655243":[2,2,0,0],"143655244":[2,2,0,0],"143654914":[0,0,0,0],"143654915":[0,0,0,0],"143654912":[0,0,0,0],"143654913":[0,0,0,0],"143654916":[1,0,0,0],"143654917":[1,0,0,0],"143655245":[1,0,0,0],"143655246":[1,0,0,0],"143655247":[1,0,0,0],"143655248":[1,0,0,0],"143655249":[1,0,0,0],"143655250":[1,0,0,0],"143655251":[1,1,0,0],"143655252":[1,1,0,0],"143655253":[1,1,0,0],"143655013":[2,0,0,0],"143655014":[2,0,0,0],"143655015":[2,0,0,0],"143655254":[2,0,0,0],"143655255":[2,0,0,0],"143655256":[2,0,0,0],"143655358":[4,2,0,0],"143654998":[0,0,0,0],"143654999":[2,1,0,0],"143655000":[2,1,0,0],"143655257":[2,1,0,0],"143655258":[2,1,0,0],"143655259":[3,1,0,0],"143655010":[2,1,0,0],"143655011":[2,1,0,0],"143655012":[2,1,0,0],"143655260":[2,1,0,0],"143655261":[2,1,0,0],"143655262":[2,1,0,0],"143655004":[0,0,0,0],"143655005":[0,0,0,0],"143655006":[1,0,0,0],"143655263":[1,0,0,0],"143655264":[1,0,0,0],"143655265":[1,0,0,0],"143655356":[3,0,0,0],"143655266":[0,0,0,0],"143655267":[0,0,0,0],"143655268":[0,0,0,0],"143655355":[4,1,1,0],"143654992":[0,0,0,0],"143654993":[0,0,0,0],"143654994":[0,0,0,0],"143655269":[0,0,0,0],"143655270":[0,0,0,0],"143655271":[0,0,0,0],"143654949":[0,0,0,0],"143654950":[2,0,0,0],"143654951":[2,0,0,0],"143655272":[2,0,0,0],"143655273":[2,0,0,0],"143655274":[2,0,0,0],"143654946":[0,0,0,0],"143654947":[0,0,0,0],"143654948":[2,1,0,0],"143655275":[3,1,0,0],"143655276":[3,2,0,0],"143654989":[0,0,0,0],"143654990":[0,0,0,0],"143654991":[2,1,1,0],"143655277":[2,1,1,0],"143655278":[2,1,1,0],"143655279":[3,1,1,0],"143655280":[3,1,1,0],"143655281":[3,2,1,0],"143655282":[4,2,1,0],"143654918":[0,0,0,0],"143654919":[0,0,0,0],"143654920":[0,0,0,0],"143654921":[0,0,0,0],"143654922":[0,0,0,0],"143655298":[3,0,0,0],"143655299":[3,0,0,0],"143655300":[3,0,0,0],"143655286":[0,0,0,0],"143655287":[0,0,0,0],"143655288":[0,0,0,0],"143655289":[2,0,0,0],"143655290":[2,0,0,0],"143655291":[2,0,0,0],"143655028":[0,0,0,0],"143655029":[0,0,0,0],"143655030":[0,0,0,0],"143655292":[0,0,0,0],"143655293":[0,0,0,0],"143655294":[0,0,0,0],"143654968":[0,0,0,0],"143654969":[0,0,0,0],"143654970":[0,0,0,0],"143655295":[2,0,0,0],"143655296":[3,0,0,0],"143655297":[4,0,0,0],"143655019":[0,0,0,0],"143655020":[1,0,0,0],"143655021":[1,0,0,0],"143655301":[1,0,0,0],"143655302":[1,0,0,0],"143654986":[0,0,0,0],"143654987":[0,0,0,0],"143654988":[1,1,1,0],"143655303":[1,1,1,0],"143655304":[2,2,1,0],"143654995":[0,0,0,0],"143654996":[0,0,0,0],"143654997":[2,0,0,0],"143655305":[2,0,0,0],"143655306":[3,0,0,0],"143655307":[4,0,0,0],"143654971":[0,0,0,0],"143654972":[0,0,0,0],"143654973":[0,0,0,0],"143654980":[3,1,0,0],"143654981":[3,1,0,0],"143654982":[3,1,0,0],"143655308":[3,1,0,0],"143655309":[3,1,0,0],"143655310":[3,1,1,0],"143654977":[0,0,0,0],"143654978":[1,1,1,0],"143654979":[1,1,1,0],"143655311":[1,1,1,0],"143655312":[1,1,1,0],"143654974":[0,0,0,0],"143654975":[0,0,0,0],"143654976":[2,1,1,0],"143655313":[2,1,1,0],"143655314":[4,3,1,0],"143654955":[0,0,0,0],"143654956":[0,0,0,0],"143654957":[2,1,0,0],"143655315":[2,1,0,0],"143655316":[2,1,0,0],"143655317":[3,2,0,0],"143655333":[2,0,0,0],"143655334":[2,0,0,0],"143655335":[2,0,0,0],"143655336":[0,0,0,0],"143655337":[0,0,0,0],"143655372":[3,1,0,0],"143655037":[0,0,0,0],"143655038":[3,0,0,0],"143655039":[3,0,0,0],"143655318":[3,0,0,0],"143655319":[3,0,0,0],"143655339":[2,2,0,0],"143654961":[0,0,0,0],"143654962":[0,0,0,0],"143654963":[0,0,0,0],"143655320":[0,0,0,0],"143654964":[0,0,0,0],"143654965":[0,0,0,0],"143655324":[0,0,0,0],"143655040":[0,0,0,0],"143655041":[0,0,0,0],"143655042":[0,0,0,0],"143655322":[0,0,0,0],"143655323":[0,0,0,0],"143655031":[1,0,0,0],"143655032":[1,0,0,0],"143655326":[1,0,0,0],"143655327":[1,0,0,0],"143655033":[0,0,0,0],"143655034":[0,0,0,0],"143655328":[0,0,0,0],"143655329":[0,0,0,0],"143655035":[2,1,1,0],"143655036":[2,1,1,0],"143655330":[2,1,1,0],"143655331":[2,1,1,0],"143654966":[2,0,0,0],"143654967":[2,0,0,0],"143655332":[2,0,0,0],"143655338":[0,0,0,0],"143655374":[4,0,0,0],"143655375":[0,0,0,0],"143654940":[0,0,0,0],"143654941":[0,0,0,0],"143654942":[0,0,0,0],"143655340":[0,0,0,0],"143655342":[0,0,0,0],"143654936":[0,0,0,0],"143654937":[0,0,0,0],"143654938":[3,0,0,0],"143654939":[3,0,0,0],"143655343":[4,0,0,0],"143655345":[4,0,0,0],"143654943":[0,0,0,0],"143654944":[0,0,0,0],"143654945":[2,0,0,0],"143655346":[2,0,0,0],"143655348":[2,0,0,0],"143654933":[0,0,0,0],"143654934":[2,0,0,0],"143654935":[3,0,0,0],"143655349":[4,1,1,0],"143655350":[4,2,1,0],"143655351":[2,0,0,0],"143655353":[2,1,0,0],"143655354":[0,0,0,0],"143654929":[0,0,0,0],"143654930":[0,0,0,0],"143654931":[0,0,0,0],"143655043":[0,0,0,0],"143655044":[0,0,0,0],"143654932":[0,0,0,0],"138412166":[0,0,0,0],"138412167":[0,0,0,0],"138412486":[0,0,0,0],"138412487":[0,0,0,0],"138412488":[0,0,0,0],"138412056":[0,0,0,0],"138412057":[0,0,0,0],"138412058":[0,0,0,0],"138412059":[0,0,0,0],"138412060":[2,0,0,0],"138412061":[2,1,0,0],"138412332":[4,1,0,0],"138412333":[4,1,0,0],"138412334":[4,2,0,0],"138412335":[4,0,0,0],"138412336":[4,0,0,0],"138412497":[4,4,4,0],"138412092":[0,0,0,0],"138412093":[2,0,0,0],"138412094":[2,0,0,0],"138412337":[2,0,0,0],"138412338":[2,0,0,0],"138412339":[3,0,0,0],"138412139":[0,0,0,0],"138412140":[1,0,0,0],"138412141":[1,0,0,0],"138412340":[1,0,0,0],"138412341":[1,0,0,0],"138412342":[1,0,0,0],"138412343":[2,2,2,0],"138412118":[0,0,0,0],"138412119":[0,0,0,0],"138412120":[2,1,1,0],"138412344":[2,1,1,0],"138412345":[2,1,1,0],"138412086":[0,0,0,0],"138412087":[2,0,0,0],"138412088":[2,0,0,0],"138412346":[2,0,0,0],"138412347":[2,0,0,0],"138412348":[2,0,0,0],"138412079":[0,0,0,0],"138412080":[0,0,0,0],"138412081":[2,1,0,0],"138412349":[2,1,0,0],"138412350":[3,2,0,0],"138412066":[0,0,0,0],"138412067":[0,0,0,0],"138412068":[0,0,0,0],"138412351":[1,0,0,0],"138412352":[1,1,0,0],"138412032":[0,0,0,0],"138412033":[0,0,0,0],"138412034":[0,0,0,0],"138412035":[0,0,0,0],"138412036":[1,0,0,0],"138412037":[1,0,0,0],"138412353":[1,1,0,0],"138412354":[1,1,0,0],"138412355":[1,1,1,0],"138412044":[3,0,0,0],"138412045":[3,0,0,0],"138412046":[3,0,0,0],"138412356":[3,0,0,0],"138412357":[3,0,0,0],"138412359":[3,0,0,0],"138412360":[1,1,0,0],"138412361":[1,1,0,0],"138412362":[1,1,0,0],"138412127":[1,0,0,0],"138412128":[1,0,0,0],"138412129":[1,0,0,0],"138412363":[2,0,0,0],"138412366":[2,0,0,0],"138412136":[0,0,0,0],"138412137":[2,0,0,0],"138412138":[2,0,0,0],"138412367":[2,0,0,0],"138412368":[2,0,0,0],"138412369":[2,0,0,0],"138412479":[4,2,0,0],"138412047":[0,0,0,0],"138412048":[1,1,0,0],"138412049":[1,1,0,0],"138412370":[1,1,0,0],"138412371":[2,1,0,0],"138412372":[2,1,0,0],"138412133":[0,0,0,0],"138412134":[1,0,0,0],"138412135":[1,0,0,0],"138412373":[1,0,0,0],"138412374":[1,0,0,0],"138412375":[2,0,0,0],"138412082":[0,0,0,0],"138412083":[0,0,0,0],"138412084":[2,0,0,0],"138412085":[2,0,0,0],"138412376":[2,0,0,0],"138412377":[2,0,0,0],"138412378":[3,0,0,0],"138412115":[0,0,0,0],"138412116":[0,0,0,0],"138412117":[1,1,0,0],"138412379":[1,1,0,0],"138412380":[1,1,0,0],"138412381":[1,1,0,0],"138412038":[1,1,1,0],"138412039":[2,1,1,0],"138412040":[2,1,1,0],"138412382":[2,1,1,0],"138412383":[2,1,1,0],"138412384":[2,1,1,0],"138412385":[1,0,0,0],"138412386":[1,0,0,0],"138412387":[1,0,0,0],"138412121":[0,0,0,0],"138412122":[2,1,0,0],"138412123":[2,1,0,0],"138412388":[2,1,0,0],"138412389":[2,1,0,0],"138412390":[2,1,0,0],"138412041":[0,0,0,0],"138412042":[0,0,0,0],"138412043":[1,1,1,0],"138412391":[1,1,1,0],"138412393":[2,1,1,0],"138412050":[0,0,0,0],"138412051":[0,0,0,0],"138412052":[0,0,0,0],"138412053":[0,0,0,0],"138412054":[0,0,0,0],"138412055":[0,0,0,0],"138412397":[1,0,0,0],"138412398":[1,0,0,0],"138412399":[1,0,0,0],"138412400":[4,0,0,0],"138412401":[4,0,0,0],"138412402":[4,0,0,0],"138412403":[1,0,0,0],"138412404":[1,0,0,0],"138412405":[2,0,0,0],"138412148":[0,0,0,0],"138412149":[1,0,0,0],"138412150":[1,0,0,0],"138412406":[1,0,0,0],"138412407":[1,0,0,0],"138412408":[1,0,0,0],"138412130":[0,0,0,0],"138412131":[2,1,0,0],"138412132":[2,1,0,0],"138412409":[2,1,0,0],"138412410":[2,1,0,0],"138412411":[2,1,0,0],"138412124":[0,0,0,0],"138412125":[2,1,0,0],"138412126":[2,1,0,0],"138412412":[2,1,0,0],"138412413":[2,1,0,0],"138412414":[2,1,0,0],"138412142":[0,0,0,0],"138412143":[1,0,0,0],"138412144":[1,0,0,0],"138412415":[1,0,0,0],"138412416":[1,0,0,0],"138412477":[3,0,0,0],"138412417":[0,0,0,0],"138412418":[0,0,0,0],"138412419":[1,0,0,0],"138412476":[4,1,1,0],"138412112":[0,0,0,0],"138412113":[0,0,0,0],"138412114":[2,1,1,0],"138412420":[2,1,1,0],"138412421":[2,1,1,0],"138412422":[2,1,1,0],"138412423":[3,1,1,0],"138412424":[3,2,1,0],"138412425":[4,2,1,0],"138412106":[0,0,0,0],"138412107":[3,0,0,0],"138412108":[3,0,0,0],"138412426":[3,0,0,0],"138412427":[4,0,0,0],"138412151":[0,0,0,0],"138412152":[0,0,0,0],"138412153":[0,0,0,0],"138412428":[0,0,0,0],"138412429":[0,0,0,0],"138412430":[0,0,0,0],"138412109":[0,0,0,0],"138412110":[0,0,0,0],"138412111":[1,1,1,0],"138412431":[1,1,1,0],"138412432":[2,2,1,0],"138412145":[0,0,0,0],"138412146":[1,1,0,0],"138412147":[1,1,0,0],"138412433":[1,1,0,0],"138412434":[1,1,0,0],"138412102":[0,0,0,0],"138412103":[0,0,0,0],"138412104":[2,0,0,0],"138412105":[2,0,0,0],"138412435":[2,0,0,0],"138412437":[2,0,0,0],"138412089":[0,0,0,0],"138412090":[0,0,0,0],"138412091":[2,1,0,0],"138412438":[2,1,0,0],"138412439":[2,1,0,0],"138412440":[3,2,0,0],"138412454":[0,0,0,0],"138412455":[0,0,0,0],"138412456":[2,0,0,0],"138412457":[0,0,0,0],"138412458":[0,0,0,0],"138412493":[3,1,0,0],"138412158":[0,0,0,0],"138412159":[3,0,0,0],"138412160":[3,0,0,0],"138412441":[3,0,0,0],"138412442":[3,0,0,0],"138412460":[2,2,0,0],"138412095":[0,0,0,0],"138412096":[0,0,0,0],"138412097":[0,0,0,0],"138412443":[0,0,0,0],"138412098":[0,0,0,0],"138412099":[0,0,0,0],"138412447":[0,0,0,0],"138412161":[1,0,0,0],"138412162":[1,0,0,0],"138412163":[1,0,0,0],"138412445":[1,0,0,0],"138412446":[1,0,0,0],"138412154":[1,0,0,0],"138412155":[1,0,0,0],"138412449":[1,0,0,0],"138412450":[1,0,0,0],"138412156":[0,0,0,0],"138412157":[0,0,0,0],"138412451":[0,0,0,0],"138412452":[0,0,0,0],"138412100":[2,0,0,0],"138412101":[2,0,0,0],"138412453":[2,0,0,0],"138412459":[0,0,0,0],"138412495":[4,1,0,0],"138412496":[0,0,0,0],"138412473":[0,0,0,0],"138412474":[0,0,0,0],"138412475":[0,0,0,0],"138412069":[0,0,0,0],"138412070":[0,0,0,0],"138412071":[0,0,0,0],"138412461":[0,0,0,0],"138412463":[0,0,0,0],"138412072":[0,0,0,0],"138412073":[0,0,0,0],"138412074":[3,0,0,0],"138412075":[3,0,0,0],"138412464":[3,0,0,0],"138412465":[3,0,0,0],"138412076":[0,0,0,0],"138412077":[0,0,0,0],"138412078":[1,1,1,0],"138412466":[2,2,1,0],"138412468":[3,2,1,0],"138412469":[2,0,0,0],"138412471":[2,1,0,0],"138412472":[0,0,0,0],"138412062":[0,0,0,0],"138412063":[0,0,0,0],"138412064":[0,0,0,0],"138412164":[0,0,0,0],"138412165":[0,0,0,0],"138412065":[0,0,0,0],"141557896":[0,0,0,0],"141557897":[0,0,0,0],"141558212":[0,0,0,0],"141558213":[0,0,0,0],"141558214":[0,0,0,0],"141557775":[0,0,0,0],"141557776":[0,0,0,0],"141557777":[0,0,0,0],"141557778":[0,0,0,0],"141557779":[2,0,0,0],"141557780":[2,1,0,0],"141558060":[4,1,0,0],"141558061":[4,1,0,0],"141558062":[4,2,0,0],"141558063":[4,0,0,0],"141558064":[4,0,0,0],"141558242":[4,4,4,0],"141557869":[0,0,0,0],"141557870":[1,0,0,0],"141557871":[1,0,0,0],"141558065":[2,0,0,0],"141558066":[2,0,0,0],"141558067":[2,0,0,0],"141558068":[2,2,2,0],"141557853":[0,0,0,0],"141557854":[0,0,0,0],"141557855":[0,0,0,0],"141558069":[0,0,0,0],"141558070":[0,0,0,0],"141558071":[0,0,0,0],"141558199":[2,0,0,0],"141558072":[1,0,0,0],"141558073":[1,0,0,0],"141558074":[1,0,0,0],"141558197":[4,1,1,0],"141557872":[0,0,0,0],"141557873":[0,0,0,0],"141557874":[0,0,0,0],"141558075":[0,0,0,0],"141558076":[0,0,0,0],"141558198":[3,0,0,0],"141557834":[0,0,0,0],"141557835":[0,0,0,0],"141557836":[3,0,0,0],"141558077":[3,0,0,0],"141558078":[3,0,0,0],"141557875":[0,0,0,0],"141557876":[1,1,0,0],"141557877":[1,1,0,0],"141558079":[1,1,0,0],"141558080":[1,1,0,0],"141557856":[0,0,0,0],"141557857":[1,1,0,0],"141557858":[1,1,0,0],"141558081":[1,1,0,0],"141558082":[1,1,0,0],"141558083":[1,1,0,0],"141557763":[0,0,0,0],"141557764":[0,0,0,0],"141557765":[0,0,0,0],"141557760":[0,0,0,0],"141557761":[1,0,0,0],"141557762":[1,0,0,0],"141558084":[2,0,0,0],"141558085":[2,0,0,0],"141558086":[2,0,0,0],"141558087":[1,1,0,0],"141558088":[1,1,0,0],"141558089":[1,1,0,0],"141557766":[2,1,1,0],"141557767":[2,1,1,0],"141557768":[2,1,1,0],"141558090":[2,1,1,0],"141558091":[2,1,1,0],"141558092":[3,1,1,0],"141558093":[1,0,0,0],"141558094":[1,0,0,0],"141558095":[1,0,0,0],"141557850":[1,1,0,0],"141557851":[2,1,0,0],"141557852":[2,1,0,0],"141558096":[2,1,0,0],"141558097":[2,1,0,0],"141558098":[3,1,0,0],"141557881":[0,0,0,0],"141557882":[0,0,0,0],"141557883":[0,0,0,0],"141558099":[0,0,0,0],"141558100":[0,0,0,0],"141558209":[0,0,0,0],"141557794":[0,0,0,0],"141557795":[0,0,0,0],"141557796":[2,0,0,0],"141557797":[2,0,0,0],"141558101":[2,0,0,0],"141558102":[2,0,0,0],"141558103":[2,0,0,0],"141557801":[0,0,0,0],"141557802":[2,1,0,0],"141557803":[2,1,0,0],"141558104":[2,1,0,0],"141558105":[2,1,0,0],"141558106":[2,1,0,0],"141558107":[3,0,0,0],"141558227":[3,0,0,0],"141558108":[3,0,0,0],"141557844":[0,0,0,0],"141557845":[0,0,0,0],"141557846":[2,0,0,0],"141558109":[2,1,0,0],"141558110":[2,1,0,0],"141558111":[3,1,0,0],"141557847":[0,0,0,0],"141557848":[2,0,0,0],"141557849":[2,0,0,0],"141558112":[2,0,0,0],"141558113":[2,0,0,0],"141558114":[2,0,0,0],"141557826":[0,0,0,0],"141557827":[0,0,0,0],"141557828":[1,1,0,0],"141557829":[1,1,0,0],"141558115":[1,1,0,0],"141558117":[1,1,0,0],"141557859":[0,0,0,0],"141557860":[2,0,0,0],"141557861":[2,0,0,0],"141558118":[2,0,0,0],"141558208":[2,0,0,0],"141558119":[2,0,0,0],"141557769":[0,0,0,0],"141557770":[0,0,0,0],"141557771":[0,0,0,0],"141557772":[0,0,0,0],"141557773":[0,0,0,0],"141557774":[0,0,0,0],"141558120":[0,0,0,0],"141558121":[0,0,0,0],"141558122":[0,0,0,0],"141558123":[1,0,0,0],"141558124":[1,0,0,0],"141558125":[1,0,0,0],"141558126":[1,0,0,0],"141558127":[1,0,0,0],"141558128":[2,0,0,0],"141557866":[2,0,0,0],"141557867":[2,0,0,0],"141557868":[2,0,0,0],"141558129":[2,0,0,0],"141558130":[2,0,0,0],"141558131":[2,0,0,0],"141558201":[4,2,0,0],"141557862":[0,0,0,0],"141557863":[0,0,0,0],"141557864":[2,1,0,0],"141557865":[2,1,0,0],"141558132":[2,1,0,0],"141558133":[2,1,0,0],"141558134":[2,1,0,0],"141557841":[0,0,0,0],"141557842":[0,0,0,0],"141557843":[0,0,0,0],"141558135":[0,0,0,0],"141558136":[0,0,0,0],"141558137":[0,0,0,0],"141557878":[0,0,0,0],"141557879":[1,0,0,0],"141557880":[1,0,0,0],"141558138":[1,0,0,0],"141558139":[1,0,0,0],"141558140":[1,0,0,0],"141557830":[0,0,0,0],"141557831":[0,0,0,0],"141557832":[2,0,0,0],"141557833":[2,0,0,0],"141558141":[2,0,0,0],"141558143":[2,0,0,0],"141557837":[0,0,0,0],"141557838":[1,1,1,0],"141557839":[2,1,1,0],"141557840":[2,1,1,0],"141558144":[2,1,1,0],"141558145":[2,1,1,0],"141558146":[2,1,1,0],"141558147":[3,1,1,0],"141558148":[3,2,1,0],"141558149":[4,2,1,0],"141557814":[0,0,0,0],"141557815":[0,0,0,0],"141557816":[2,1,1,0],"141557804":[2,1,1,0],"141557805":[2,1,1,0],"141557806":[2,1,1,0],"141558150":[2,1,1,0],"141558151":[2,1,1,0],"141558152":[2,1,1,0],"141558153":[2,1,1,0],"141558154":[2,1,1,0],"141558155":[3,1,1,0],"141557823":[3,1,0,0],"141557824":[3,1,0,0],"141557825":[3,1,0,0],"141558156":[3,1,0,0],"141558157":[3,1,0,0],"141557817":[0,0,0,0],"141557818":[0,0,0,0],"141557819":[3,0,0,0],"141558158":[3,0,0,0],"141558159":[3,0,0,0],"141557820":[0,0,0,0],"141557821":[0,0,0,0],"141557822":[1,1,1,0],"141558160":[1,1,1,0],"141558161":[1,1,1,0],"141557798":[0,0,0,0],"141557799":[0,0,0,0],"141557800":[2,1,0,0],"141558162":[2,1,0,0],"141558163":[2,1,0,0],"141558164":[3,2,0,0],"141558178":[1,0,0,0],"141558179":[2,0,0,0],"141558180":[2,0,0,0],"141558181":[0,0,0,0],"141558182":[0,0,0,0],"141558238":[3,1,0,0],"141557888":[0,0,0,0],"141557889":[3,0,0,0],"141557890":[3,0,0,0],"141558165":[3,0,0,0],"141558166":[3,0,0,0],"141558184":[2,2,0,0],"141557807":[0,0,0,0],"141557808":[0,0,0,0],"141557809":[0,0,0,0],"141558167":[0,0,0,0],"141557810":[0,0,0,0],"141557811":[0,0,0,0],"141558171":[0,0,0,0],"141557891":[0,0,0,0],"141557892":[0,0,0,0],"141557893":[0,0,0,0],"141558169":[2,1,0,0],"141558170":[2,1,0,0],"141557884":[1,0,0,0],"141557885":[1,0,0,0],"141558173":[1,0,0,0],"141558174":[1,0,0,0],"141557886":[3,0,0,0],"141557887":[3,0,0,0],"141558175":[3,0,0,0],"141558176":[4,0,0,0],"141557812":[2,0,0,0],"141557813":[2,0,0,0],"141558177":[2,0,0,0],"141558183":[0,0,0,0],"141558240":[4,0,0,0],"141558241":[0,0,0,0],"141557785":[0,0,0,0],"141557786":[0,0,0,0],"141557787":[1,0,0,0],"141558185":[1,0,0,0],"141558187":[2,0,0,0],"141557788":[1,0,0,0],"141557789":[1,0,0,0],"141557790":[1,0,0,0],"141558188":[2,0,0,0],"141558190":[3,2,1,0],"141557791":[0,0,0,0],"141557792":[0,0,0,0],"141557793":[3,0,0,0],"141558191":[3,0,0,0],"141558192":[3,0,0,0],"141558193":[2,0,0,0],"141558195":[2,1,0,0],"141558196":[0,0,0,0],"141557781":[0,0,0,0],"141557782":[0,0,0,0],"141557783":[0,0,0,0],"141557894":[0,0,0,0],"141557895":[0,0,0,0],"141557784":[0,0,0,0],"140509323":[0,0,0,0],"140509324":[0,0,0,0],"140509638":[0,0,0,0],"140509639":[0,0,0,0],"140509640":[0,0,0,0],"140509205":[0,0,0,0],"140509206":[0,0,0,0],"140509207":[0,0,0,0],"140509208":[0,0,0,0],"140509209":[2,0,0,0],"140509210":[2,1,0,0],"140509484":[4,1,0,0],"140509485":[4,1,0,0],"140509486":[4,2,0,0],"140509487":[4,0,0,0],"140509488":[4,0,0,0],"140509650":[4,4,4,0],"140509293":[0,0,0,0],"140509294":[1,0,0,0],"140509295":[1,0,0,0],"140509489":[1,0,0,0],"140509490":[1,0,0,0],"140509491":[1,0,0,0],"140509492":[2,2,2,0],"140509296":[0,0,0,0],"140509297":[0,0,0,0],"140509298":[1,1,0,0],"140509299":[1,1,0,0],"140509493":[1,1,0,0],"140509494":[1,1,0,0],"140509627":[2,0,0,0],"140509231":[0,0,0,0],"140509232":[3,0,0,0],"140509233":[3,0,0,0],"140509495":[3,0,0,0],"140509496":[3,0,0,0],"140509497":[3,0,0,0],"140509498":[0,0,0,0],"140509499":[0,0,0,0],"140509500":[0,0,0,0],"140509258":[0,0,0,0],"140509259":[0,0,0,0],"140509260":[1,1,0,0],"140509501":[1,1,0,0],"140509502":[1,1,0,0],"140509267":[0,0,0,0],"140509268":[0,0,0,0],"140509269":[1,1,0,0],"140509503":[2,1,0,0],"140509504":[2,1,0,0],"140509505":[3,1,0,0],"140509247":[0,0,0,0],"140509248":[0,0,0,0],"140509249":[2,0,0,0],"140509506":[2,0,0,0],"140509507":[2,0,0,0],"140509283":[0,0,0,0],"140509284":[0,0,0,0],"140509285":[2,0,0,0],"140509286":[2,0,0,0],"140509508":[2,0,0,0],"140509509":[2,0,0,0],"140509510":[2,0,0,0],"140509193":[0,0,0,0],"140509194":[0,0,0,0],"140509195":[0,0,0,0],"140509184":[0,0,0,0],"140509185":[1,0,0,0],"140509186":[1,0,0,0],"140509511":[1,0,0,0],"140509512":[1,0,0,0],"140509513":[1,0,0,0],"140509514":[1,1,0,0],"140509515":[1,1,0,0],"140509516":[1,1,0,0],"140509277":[0,0,0,0],"140509278":[0,0,0,0],"140509279":[0,0,0,0],"140509517":[0,0,0,0],"140509518":[0,0,0,0],"140509519":[0,0,0,0],"140509280":[0,0,0,0],"140509281":[0,0,0,0],"140509282":[0,0,0,0],"140509520":[0,0,0,0],"140509521":[0,0,0,0],"140509522":[0,0,0,0],"140509628":[4,0,0,0],"140509523":[1,0,0,0],"140509524":[1,0,0,0],"140509525":[1,0,0,0],"140509626":[4,1,1,0],"140509196":[1,1,1,0],"140509197":[1,1,1,0],"140509198":[1,1,1,0],"140509526":[1,1,1,0],"140509527":[1,1,1,0],"140509528":[1,1,1,0],"140509187":[0,0,0,0],"140509188":[0,0,0,0],"140509189":[1,0,0,0],"140509529":[1,0,0,0],"140509530":[2,0,0,0],"140509531":[3,0,0,0],"140509532":[1,0,0,0],"140509533":[1,0,0,0],"140509534":[1,0,0,0],"140509190":[3,0,0,0],"140509191":[3,0,0,0],"140509192":[3,0,0,0],"140509535":[3,0,0,0],"140509536":[3,0,0,0],"140509537":[3,1,0,0],"140509237":[0,0,0,0],"140509238":[2,1,0,0],"140509239":[2,1,0,0],"140509538":[2,1,0,0],"140509539":[2,1,0,0],"140509540":[2,1,0,0],"140509541":[3,0,0,0],"140509641":[3,0,0,0],"140509542":[3,0,0,0],"140509227":[0,0,0,0],"140509228":[0,0,0,0],"140509229":[2,0,0,0],"140509230":[2,0,0,0],"140509543":[2,1,0,0],"140509544":[2,1,0,0],"140509545":[2,2,0,0],"140509264":[0,0,0,0],"140509265":[0,0,0,0],"140509266":[0,0,0,0],"140509546":[0,0,0,0],"140509547":[0,0,0,0],"140509548":[0,0,0,0],"140509250":[0,0,0,0],"140509251":[0,0,0,0],"140509252":[1,1,0,0],"140509253":[1,1,0,0],"140509549":[1,1,0,0],"140509551":[1,1,0,0],"140509199":[0,0,0,0],"140509200":[0,0,0,0],"140509201":[0,0,0,0],"140509202":[0,0,0,0],"140509203":[0,0,0,0],"140509204":[0,0,0,0],"140509552":[2,0,0,0],"140509553":[2,0,0,0],"140509554":[2,2,0,0],"140509555":[1,0,0,0],"140509556":[1,0,0,0],"140509557":[1,0,0,0],"140509558":[2,0,0,0],"140509559":[2,1,0,0],"140509560":[2,2,0,0],"140509287":[2,1,0,0],"140509288":[2,1,0,0],"140509289":[2,1,0,0],"140509561":[2,1,0,0],"140509562":[2,1,0,0],"140509563":[2,1,0,0],"140509303":[0,0,0,0],"140509304":[0,0,0,0],"140509305":[0,0,0,0],"140509564":[0,0,0,0],"140509565":[0,0,0,0],"140509566":[0,0,0,0],"140509306":[1,0,0,0],"140509307":[1,0,0,0],"140509308":[1,0,0,0],"140509567":[1,0,0,0],"140509568":[1,0,0,0],"140509637":[1,0,0,0],"140509270":[0,0,0,0],"140509271":[0,0,0,0],"140509272":[2,0,0,0],"140509569":[2,1,0,0],"140509570":[2,1,1,0],"140509290":[0,0,0,0],"140509291":[2,0,0,0],"140509292":[2,0,0,0],"140509571":[2,0,0,0],"140509572":[2,0,0,0],"140509573":[2,0,0,0],"140509630":[4,2,0,0],"140509273":[0,0,0,0],"140509274":[0,0,0,0],"140509275":[0,0,0,0],"140509276":[0,0,0,0],"140509574":[0,0,0,0],"140509575":[0,0,0,0],"140509576":[0,0,0,0],"140509261":[0,0,0,0],"140509262":[0,0,0,0],"140509263":[2,1,1,0],"140509577":[2,1,1,0],"140509578":[2,1,1,0],"140509579":[3,1,1,0],"140509580":[3,1,1,0],"140509581":[3,2,1,0],"140509582":[4,2,1,0],"140509300":[0,0,0,0],"140509301":[0,0,0,0],"140509302":[1,1,0,0],"140509583":[1,1,0,0],"140509584":[1,1,0,0],"140509254":[0,0,0,0],"140509255":[0,0,0,0],"140509256":[2,1,0,0],"140509257":[2,1,0,0],"140509585":[2,1,0,0],"140509586":[3,1,0,0],"140509234":[0,0,0,0],"140509235":[0,0,0,0],"140509236":[2,1,0,0],"140509587":[2,1,0,0],"140509588":[2,1,0,0],"140509589":[3,2,0,0],"140509605":[2,0,0,0],"140509606":[2,0,0,0],"140509607":[2,0,0,0],"140509608":[0,0,0,0],"140509609":[0,0,0,0],"140509646":[3,1,0,0],"140509315":[0,0,0,0],"140509316":[3,0,0,0],"140509317":[3,0,0,0],"140509590":[3,0,0,0],"140509591":[3,0,0,0],"140509611":[2,2,0,0],"140509240":[0,0,0,0],"140509241":[0,0,0,0],"140509242":[0,0,0,0],"140509592":[0,0,0,0],"140509243":[0,0,0,0],"140509244":[0,0,0,0],"140509596":[0,0,0,0],"140509318":[1,0,0,0],"140509319":[1,0,0,0],"140509320":[1,0,0,0],"140509594":[1,0,0,0],"140509595":[1,0,0,0],"140509309":[1,0,0,0],"140509310":[1,0,0,0],"140509598":[1,0,0,0],"140509599":[1,0,0,0],"140509311":[2,0,0,0],"140509312":[2,0,0,0],"140509600":[2,0,0,0],"140509601":[2,0,0,0],"140509313":[3,1,0,0],"140509314":[3,1,0,0],"140509602":[3,1,0,0],"140509603":[3,1,0,0],"140509245":[2,0,0,0],"140509246":[2,0,0,0],"140509604":[3,0,0,0],"140509610":[0,0,0,0],"140509648":[4,0,0,0],"140509649":[0,0,0,0],"140509215":[0,0,0,0],"140509216":[2,1,0,0],"140509217":[2,1,0,0],"140509612":[2,1,0,0],"140509614":[2,1,0,0],"140509218":[1,1,0,0],"140509219":[1,1,0,0],"140509220":[1,1,0,0],"140509615":[1,1,0,0],"140509617":[1,1,0,0],"140509221":[0,0,0,0],"140509222":[0,0,0,0],"140509223":[2,2,0,0],"140509618":[2,2,0,0],"140509619":[2,2,0,0],"140509224":[0,0,0,0],"140509225":[0,0,0,0],"140509226":[2,1,1,0],"140509620":[2,1,1,0],"140509621":[2,1,1,0],"140509622":[2,0,0,0],"140509624":[2,1,0,0],"140509625":[0,0,0,0],"140509211":[0,0,0,0],"140509212":[0,0,0,0],"140509213":[0,0,0,0],"140509321":[0,0,0,0],"140509322":[0,0,0,0],"140509214":[0,0,0,0],"145752184":[0,0,0,0],"145752185":[0,0,0,0],"145752506":[0,0,0,0],"145752507":[0,0,0,0],"145752508":[0,0,0,0],"145752085":[0,0,0,0],"145752086":[0,0,0,0],"145752087":[0,0,0,0],"145752088":[0,0,0,0],"145752089":[2,0,0,0],"145752090":[2,1,0,0],"145752364":[4,1,0,0],"145752365":[4,1,0,0],"145752366":[4,2,0,0],"145752367":[4,0,0,0],"145752368":[4,0,0,0],"145752517":[4,4,4,0],"145752145":[0,0,0,0],"145752146":[1,0,0,0],"145752147":[1,1,0,0],"145752369":[2,1,0,0],"145752370":[2,1,0,0],"145752371":[3,1,0,0],"145752494":[4,0,0,0],"145752372":[1,0,0,0],"145752373":[1,0,0,0],"145752374":[1,0,0,0],"145752493":[4,1,1,0],"145752148":[0,0,0,0],"145752149":[0,0,0,0],"145752150":[1,1,0,0],"145752151":[1,1,1,0],"145752375":[1,1,1,0],"145752376":[1,1,1,0],"145752377":[1,1,1,0],"145752164":[0,0,0,0],"145752165":[0,0,0,0],"145752166":[2,0,0,0],"145752378":[2,1,0,0],"145752379":[2,1,0,0],"145752110":[0,0,0,0],"145752111":[1,1,0,0],"145752112":[1,1,0,0],"145752380":[1,1,0,0],"145752381":[1,1,0,0],"145752382":[2,1,0,0],"145752141":[0,0,0,0],"145752142":[0,0,0,0],"145752143":[1,0,0,0],"145752144":[1,0,0,0],"145752383":[2,0,0,0],"145752385":[3,0,0,0],"145752119":[0,0,0,0],"145752120":[2,0,0,0],"145752121":[2,0,0,0],"145752386":[3,0,0,0],"145752387":[3,0,0,0],"145752388":[3,0,0,0],"145752064":[0,0,0,0],"145752065":[0,0,0,0],"145752066":[0,0,0,0],"145752067":[0,0,0,0],"145752068":[1,0,0,0],"145752069":[1,0,0,0],"145752389":[1,0,0,0],"145752390":[2,0,0,0],"145752391":[2,2,0,0],"145752392":[1,1,0,0],"145752393":[1,1,0,0],"145752394":[1,1,0,0],"145752070":[3,0,0,0],"145752071":[3,0,0,0],"145752072":[3,0,0,0],"145752395":[3,0,0,0],"145752396":[3,0,0,0],"145752397":[3,0,0,0],"145752398":[1,0,0,0],"145752399":[1,0,0,0],"145752400":[1,0,0,0],"145752122":[2,1,1,0],"145752123":[2,1,1,0],"145752124":[2,1,1,0],"145752401":[2,1,1,0],"145752402":[2,1,1,0],"145752403":[2,1,1,0],"145752404":[2,0,0,0],"145752405":[2,0,0,0],"145752406":[2,0,0,0],"145752167":[0,0,0,0],"145752168":[1,0,0,0],"145752169":[1,0,0,0],"145752407":[1,0,0,0],"145752408":[1,0,0,0],"145752409":[1,0,0,0],"145752158":[0,0,0,0],"145752159":[1,0,0,0],"145752160":[1,0,0,0],"145752410":[1,0,0,0],"145752411":[1,0,0,0],"145752412":[1,0,0,0],"145752413":[2,2,2,0],"145752152":[0,0,0,0],"145752153":[0,0,0,0],"145752154":[1,1,0,0],"145752414":[1,1,0,0],"145752415":[1,1,0,0],"145752416":[2,1,1,0],"145752107":[0,0,0,0],"145752108":[0,0,0,0],"145752109":[2,1,0,0],"145752417":[2,1,0,0],"145752418":[2,1,0,0],"145752155":[0,0,0,0],"145752156":[2,0,0,0],"145752157":[2,0,0,0],"145752419":[2,0,0,0],"145752420":[2,0,0,0],"145752421":[2,0,0,0],"145752497":[4,2,0,0],"145752076":[0,0,0,0],"145752077":[0,0,0,0],"145752078":[0,0,0,0],"145752073":[0,0,0,0],"145752074":[0,0,0,0],"145752075":[0,0,0,0],"145752422":[0,0,0,0],"145752423":[0,0,0,0],"145752424":[0,0,0,0],"145752425":[1,0,0,0],"145752426":[1,0,0,0],"145752427":[1,0,0,0],"145752428":[3,0,0,0],"145752429":[3,0,0,0],"145752430":[4,0,0,0],"145752138":[1,1,1,0],"145752139":[1,1,1,0],"145752140":[1,1,1,0],"145752431":[1,1,1,0],"145752432":[1,1,1,0],"145752433":[1,1,1,0],"145752161":[0,0,0,0],"145752162":[1,0,0,0],"145752163":[2,0,0,0],"145752434":[2,0,0,0],"145752435":[2,0,0,0],"145752495":[4,0,0,0],"145752113":[0,0,0,0],"145752114":[0,0,0,0],"145752115":[2,1,0,0],"145752436":[2,1,0,0],"145752437":[2,1,0,0],"145752438":[3,1,0,0],"145752439":[1,1,0,0],"145752440":[1,1,0,0],"145752441":[1,1,0,0],"145752079":[0,0,0,0],"145752080":[0,0,0,0],"145752081":[1,1,0,0],"145752442":[1,1,0,0],"145752443":[1,1,0,0],"145752444":[1,1,0,0],"145752082":[2,0,0,0],"145752083":[2,1,0,0],"145752084":[2,1,1,0],"145752445":[2,1,1,0],"145752446":[2,1,1,0],"145752447":[2,1,1,0],"145752132":[0,0,0,0],"145752133":[0,0,0,0],"145752134":[0,0,0,0],"145752448":[1,0,0,0],"145752504":[1,0,0,0],"145752449":[1,0,0,0],"145752450":[3,1,1,0],"145752451":[3,2,1,0],"145752452":[4,2,1,0],"145752170":[0,0,0,0],"145752171":[0,0,0,0],"145752172":[3,0,0,0],"145752453":[3,0,0,0],"145752454":[3,0,0,0],"145752505":[3,0,0,0],"145752135":[0,0,0,0],"145752136":[1,0,0,0],"145752137":[1,0,0,0],"145752455":[1,0,0,0],"145752456":[1,0,0,0],"145752457":[1,0,0,0],"145752116":[0,0,0,0],"145752117":[0,0,0,0],"145752118":[2,1,0,0],"145752458":[2,1,0,0],"145752459":[2,1,0,0],"145752460":[3,2,0,0],"145752474":[0,0,0,0],"145752475":[2,0,0,0],"145752476":[2,0,0,0],"145752477":[0,0,0,0],"145752478":[0,0,0,0],"145752513":[3,1,0,0],"145752179":[0,0,0,0],"145752180":[0,0,0,0],"145752181":[0,0,0,0],"145752461":[0,0,0,0],"145752462":[0,0,0,0],"145752480":[2,2,0,0],"145752125":[0,0,0,0],"145752126":[0,0,0,0],"145752127":[0,0,0,0],"145752463":[0,0,0,0],"145752128":[0,0,0,0],"145752129":[0,0,0,0],"145752465":[0,0,0,0],"145752173":[1,0,0,0],"145752174":[1,0,0,0],"145752467":[1,0,0,0],"145752468":[1,0,0,0],"145752175":[0,0,0,0],"145752176":[0,0,0,0],"145752469":[0,0,0,0],"145752470":[0,0,0,0],"145752177":[3,0,0,0],"145752178":[3,0,0,0],"145752471":[3,0,0,0],"145752472":[3,0,0,0],"145752130":[2,0,0,0],"145752131":[2,0,0,0],"145752473":[3,0,0,0],"145752479":[0,0,0,0],"145752515":[4,0,0,0],"145752516":[0,0,0,0],"145752095":[0,0,0,0],"145752096":[3,0,0,0],"145752097":[3,0,0,0],"145752481":[3,0,0,0],"145752482":[3,0,0,0],"145752098":[0,0,0,0],"145752099":[0,0,0,0],"145752100":[1,1,1,0],"145752483":[1,1,1,0],"145752484":[1,1,1,0],"145752101":[0,0,0,0],"145752102":[0,0,0,0],"145752103":[1,0,0,0],"145752485":[2,0,0,0],"145752486":[2,0,0,0],"145752104":[0,0,0,0],"145752105":[0,0,0,0],"145752106":[3,1,0,0],"145752487":[3,1,0,0],"145752488":[3,1,0,0],"145752489":[2,0,0,0],"145752491":[2,1,0,0],"145752492":[0,0,0,0],"145752091":[0,0,0,0],"145752092":[0,0,0,0],"145752093":[0,0,0,0],"145752182":[0,0,0,0],"145752183":[0,0,0,0],"145752094":[0,0,0,0],"144703617":[0,0,0,0],"144703618":[0,0,0,0],"144703935":[0,0,0,0],"144703936":[0,0,0,0],"144703937":[0,0,0,0],"144703503":[0,0,0,0],"144703504":[0,0,0,0],"144703505":[0,0,0,0],"144703506":[0,0,0,0],"144703507":[2,0,0,0],"144703508":[2,1,0,0],"144703788":[4,1,0,0],"144703789":[4,1,0,0],"144703790":[4,2,0,0],"144703791":[4,0,0,0],"144703792":[4,0,0,0],"144703947":[4,4,4,0],"144703590":[0,0,0,0],"144703591":[2,0,0,0],"144703592":[2,0,0,0],"144703793":[2,0,0,0],"144703794":[2,0,0,0],"144703795":[2,0,0,0],"144703924":[4,2,0,0],"144703593":[0,0,0,0],"144703594":[1,0,0,0],"144703595":[2,1,0,0],"144703796":[2,1,0,0],"144703797":[2,1,0,0],"144703798":[2,1,0,0],"144703799":[2,2,2,0],"144703529":[0,0,0,0],"144703530":[0,0,0,0],"144703531":[1,1,0,0],"144703800":[1,1,0,0],"144703801":[1,1,0,0],"144703802":[2,1,0,0],"144703803":[1,1,0,0],"144703804":[1,1,0,0],"144703805":[1,1,0,0],"144703602":[0,0,0,0],"144703603":[0,0,0,0],"144703604":[1,0,0,0],"144703806":[1,0,0,0],"144703807":[1,0,0,0],"144703808":[1,0,0,0],"144703526":[0,0,0,0],"144703527":[2,0,0,0],"144703528":[2,0,0,0],"144703809":[2,0,0,0],"144703810":[2,0,0,0],"144703811":[2,0,0,0],"144703491":[0,0,0,0],"144703492":[0,0,0,0],"144703493":[0,0,0,0],"144703488":[0,0,0,0],"144703489":[1,0,0,0],"144703490":[1,0,0,0],"144703812":[1,0,0,0],"144703813":[2,0,0,0],"144703814":[2,0,0,0],"144703815":[1,1,0,0],"144703816":[1,1,0,0],"144703817":[1,1,0,0],"144703818":[1,0,0,0],"144703819":[1,0,0,0],"144703820":[1,0,0,0],"144703596":[1,0,0,0],"144703597":[1,0,0,0],"144703598":[1,0,0,0],"144703821":[1,0,0,0],"144703822":[2,0,0,0],"144703922":[2,0,0,0],"144703572":[2,0,0,0],"144703573":[2,0,0,0],"144703574":[2,1,0,0],"144703823":[2,1,0,0],"144703824":[2,1,0,0],"144703825":[3,1,0,0],"144703578":[0,0,0,0],"144703579":[0,0,0,0],"144703580":[0,0,0,0],"144703826":[1,0,0,0],"144703827":[1,0,0,0],"144703828":[2,0,0,0],"144703829":[1,0,0,0],"144703830":[1,0,0,0],"144703831":[1,0,0,0],"144703921":[4,1,1,0],"144703523":[0,0,0,0],"144703524":[0,0,0,0],"144703525":[2,0,0,0],"144703832":[2,0,0,0],"144703933":[2,0,0,0],"144703833":[3,0,0,0],"144703566":[0,0,0,0],"144703567":[0,0,0,0],"144703568":[1,1,1,0],"144703834":[1,1,1,0],"144703835":[1,1,1,0],"144703584":[0,0,0,0],"144703585":[0,0,0,0],"144703586":[1,0,0,0],"144703836":[1,0,0,0],"144703837":[2,0,0,0],"144703838":[2,2,0,0],"144703563":[0,0,0,0],"144703564":[1,1,0,0],"144703565":[1,1,0,0],"144703839":[1,1,0,0],"144703840":[2,1,0,0],"144703494":[0,0,0,0],"144703495":[0,0,0,0],"144703496":[0,0,0,0],"144703497":[0,0,0,0],"144703498":[0,0,0,0],"144703499":[0,0,0,0],"144703841":[0,0,0,0],"144703842":[0,0,0,0],"144703843":[0,0,0,0],"144703844":[1,0,0,0],"144703845":[1,0,0,0],"144703846":[1,0,0,0],"144703847":[3,0,0,0],"144703848":[3,0,0,0],"144703849":[4,0,0,0],"144703500":[2,0,0,0],"144703501":[3,0,0,0],"144703502":[3,0,0,0],"144703850":[3,0,0,0],"144703851":[3,0,0,0],"144703852":[3,0,0,0],"144703605":[0,0,0,0],"144703606":[0,0,0,0],"144703607":[0,0,0,0],"144703853":[0,0,0,0],"144703854":[0,0,0,0],"144703934":[0,0,0,0],"144703587":[0,0,0,0],"144703588":[2,1,0,0],"144703589":[2,1,0,0],"144703855":[2,1,0,0],"144703856":[2,1,0,0],"144703857":[2,1,0,0],"144703535":[0,0,0,0],"144703536":[2,0,0,0],"144703537":[2,0,0,0],"144703858":[3,0,0,0],"144703859":[3,0,0,0],"144703860":[3,0,0,0],"144703575":[0,0,0,0],"144703576":[2,1,0,0],"144703577":[2,1,0,0],"144703861":[2,1,0,0],"144703862":[2,1,0,0],"144703863":[2,1,0,0],"144703581":[0,0,0,0],"144703582":[1,1,1,0],"144703583":[1,1,1,0],"144703864":[1,1,1,0],"144703865":[1,1,1,0],"144703866":[1,1,1,0],"144703569":[0,0,0,0],"144703570":[0,0,0,0],"144703571":[2,1,1,0],"144703867":[2,1,1,0],"144703868":[2,1,1,0],"144703869":[2,1,1,0],"144703870":[3,1,1,0],"144703871":[3,2,1,0],"144703872":[4,2,1,0],"144703599":[0,0,0,0],"144703600":[0,0,0,0],"144703601":[1,1,0,0],"144703873":[1,1,0,0],"144703874":[1,1,0,0],"144703560":[0,0,0,0],"144703561":[0,0,0,0],"144703562":[2,1,1,0],"144703875":[2,1,1,0],"144703876":[2,1,1,0],"144703877":[3,2,1,0],"144703545":[0,0,0,0],"144703546":[0,0,0,0],"144703547":[0,0,0,0],"144703548":[3,1,0,0],"144703549":[3,1,0,0],"144703550":[3,1,0,0],"144703878":[3,1,0,0],"144703879":[3,1,0,0],"144703880":[4,1,1,0],"144703557":[3,1,0,0],"144703558":[3,1,0,0],"144703559":[3,1,0,0],"144703881":[3,1,0,0],"144703882":[4,1,1,0],"144703551":[0,0,0,0],"144703552":[3,1,0,0],"144703553":[3,1,0,0],"144703883":[3,1,0,0],"144703884":[4,1,1,0],"144703554":[0,0,0,0],"144703555":[1,1,1,0],"144703556":[1,1,1,0],"144703885":[1,1,1,0],"144703886":[1,1,1,0],"144703532":[0,0,0,0],"144703533":[0,0,0,0],"144703534":[2,1,0,0],"144703887":[2,1,0,0],"144703888":[2,1,0,0],"144703889":[3,2,0,0],"144703901":[1,0,0,0],"144703902":[2,0,0,0],"144703903":[2,0,0,0],"144703904":[0,0,0,0],"144703905":[0,0,0,0],"144703943":[3,1,0,0],"144703612":[0,0,0,0],"144703613":[3,0,0,0],"144703614":[3,0,0,0],"144703890":[3,0,0,0],"144703891":[3,0,0,0],"144703907":[2,2,0,0],"144703538":[0,0,0,0],"144703539":[0,0,0,0],"144703540":[0,0,0,0],"144703892":[0,0,0,0],"144703541":[0,0,0,0],"144703542":[0,0,0,0],"144703894":[0,0,0,0],"144703608":[1,0,0,0],"144703609":[1,0,0,0],"144703896":[1,0,0,0],"144703897":[1,0,0,0],"144703610":[2,1,1,0],"144703611":[2,1,1,0],"144703898":[2,1,1,0],"144703899":[2,2,1,0],"144703543":[2,0,0,0],"144703544":[2,0,0,0],"144703900":[2,0,0,0],"144703906":[0,0,0,0],"144703945":[4,0,0,0],"144703946":[0,0,0,0],"144703520":[0,0,0,0],"144703521":[2,2,0,0],"144703522":[2,2,0,0],"144703908":[2,2,0,0],"144703910":[2,2,0,0],"144703516":[0,0,0,0],"144703517":[0,0,0,0],"144703518":[1,1,1,0],"144703519":[1,1,1,0],"144703911":[1,1,1,0],"144703913":[2,1,1,0],"144703513":[3,0,0,0],"144703514":[3,0,0,0],"144703515":[3,0,0,0],"144703914":[3,0,0,0],"144703916":[3,0,0,0],"144703917":[2,0,0,0],"144703919":[2,1,0,0],"144703920":[0,0,0,0],"144703509":[0,0,0,0],"144703510":[0,0,0,0],"144703511":[0,0,0,0],"144703615":[0,0,0,0],"144703616":[0,0,0,0],"144703512":[0,0,0,0],"146800757":[0,0,0,0],"146800758":[0,0,0,0],"146801083":[0,0,0,0],"146801084":[0,0,0,0],"146801085":[0,0,0,0],"146800652":[0,0,0,0],"146800653":[0,0,0,0],"146800654":[0,0,0,0],"146800655":[0,0,0,0],"146800656":[2,0,0,0],"146800657":[2,1,0,0],"146800940":[4,1,0,0],"146800941":[4,1,0,0],"146800942":[4,2,0,0],"146800943":[4,0,0,0],"146800944":[4,0,0,0],"146801105":[4,4,4,0],"146800728":[0,0,0,0],"146800729":[2,0,0,0],"146800730":[2,0,0,0],"146800945":[2,0,0,0],"146800946":[2,0,0,0],"146800947":[2,0,0,0],"146801073":[3,0,0,0],"146800685":[2,1,1,0],"146800686":[2,1,1,0],"146800687":[2,1,1,0],"146800948":[2,1,1,0],"146800949":[2,1,1,0],"146800950":[2,1,1,0],"146800951":[2,1,0,0],"146801092":[2,1,0,0],"146800952":[2,1,0,0],"146800672":[0,0,0,0],"146800673":[3,0,0,0],"146800674":[3,0,0,0],"146800953":[3,0,0,0],"146800954":[3,0,0,0],"146800955":[3,0,0,0],"146800956":[1,1,0,0],"146800957":[1,1,1,0],"146800958":[1,1,1,0],"146800701":[0,0,0,0],"146800702":[0,0,0,0],"146800703":[1,1,0,0],"146800704":[1,1,0,0],"146800959":[1,1,0,0],"146800960":[1,1,0,0],"146800961":[1,1,1,0],"146800705":[0,0,0,0],"146800706":[0,0,0,0],"146800707":[0,0,0,0],"146800708":[2,1,1,0],"146800962":[2,1,1,0],"146800963":[2,1,1,0],"146800698":[0,0,0,0],"146800699":[0,0,0,0],"146800700":[1,1,0,0],"146800964":[1,1,0,0],"146801082":[1,1,0,0],"146800965":[1,1,0,0],"146800678":[0,0,0,0],"146800679":[2,0,0,0],"146800680":[2,0,0,0],"146800681":[2,0,0,0],"146800966":[2,0,0,0],"146800967":[2,0,0,0],"146800968":[2,0,0,0],"146800640":[0,0,0,0],"146800641":[0,0,0,0],"146800642":[0,0,0,0],"146800643":[0,0,0,0],"146800644":[1,0,0,0],"146800645":[1,0,0,0],"146800969":[1,0,0,0],"146800970":[1,0,0,0],"146800971":[1,1,0,0],"146800972":[2,0,0,0],"146800973":[2,0,0,0],"146800974":[2,0,0,0],"146800975":[1,0,0,0],"146800976":[1,0,0,0],"146800977":[1,0,0,0],"146800737":[0,0,0,0],"146800738":[0,0,0,0],"146800739":[2,0,0,0],"146800978":[2,0,0,0],"146800979":[2,0,0,0],"146800682":[0,0,0,0],"146800683":[2,1,0,0],"146800684":[2,1,0,0],"146800980":[2,1,0,0],"146800981":[2,1,0,0],"146800982":[2,1,1,0],"146800983":[2,0,0,0],"146801093":[2,0,0,0],"146800984":[2,0,0,0],"146800709":[0,0,0,0],"146800710":[0,0,0,0],"146800711":[2,0,0,0],"146800985":[2,0,0,0],"146800986":[2,0,0,0],"146800731":[0,0,0,0],"146800732":[1,0,0,0],"146800733":[1,0,0,0],"146800987":[1,0,0,0],"146800988":[1,0,0,0],"146800989":[1,0,0,0],"146800990":[2,2,2,0],"146800668":[0,0,0,0],"146800669":[0,0,0,0],"146800670":[2,1,0,0],"146800671":[2,1,0,0],"146800991":[2,1,0,0],"146800992":[2,1,0,0],"146800725":[2,1,0,0],"146800726":[2,1,0,0],"146800727":[2,1,0,0],"146800993":[2,1,0,0],"146800994":[2,1,0,0],"146800996":[2,1,0,0],"146800719":[0,0,0,0],"146800720":[0,0,0,0],"146800721":[0,0,0,0],"146800997":[0,0,0,0],"146800998":[0,0,0,0],"146800999":[0,0,0,0],"146801071":[3,1,1,0],"146801000":[0,0,0,0],"146801001":[0,0,0,0],"146801002":[0,0,0,0],"146801069":[4,0,0,0],"146800646":[0,0,0,0],"146800647":[0,0,0,0],"146800648":[0,0,0,0],"146800649":[0,0,0,0],"146800650":[0,0,0,0],"146800651":[0,0,0,0],"146801003":[0,0,0,0],"146801004":[0,0,0,0],"146801005":[0,0,0,0],"146801006":[2,0,0,0],"146801007":[2,0,0,0],"146801008":[2,0,0,0],"146801009":[3,0,0,0],"146801010":[3,0,0,0],"146801011":[3,0,0,0],"146801066":[0,0,0,0],"146801067":[0,0,0,0],"146801068":[0,0,0,0],"146800712":[0,0,0,0],"146800713":[0,0,0,0],"146800714":[0,0,0,0],"146801012":[0,0,0,0],"146801013":[1,0,0,0],"146801014":[1,1,0,0],"146800734":[0,0,0,0],"146800735":[1,0,0,0],"146800736":[1,0,0,0],"146801015":[2,0,0,0],"146801016":[2,0,0,0],"146801070":[1,0,0,0],"146800722":[0,0,0,0],"146800723":[1,1,1,0],"146800724":[1,1,1,0],"146801017":[1,1,1,0],"146801018":[1,1,1,0],"146801019":[1,1,1,0],"146800715":[0,0,0,0],"146800716":[0,0,0,0],"146800717":[1,0,0,0],"146800718":[1,0,0,0],"146801020":[1,0,0,0],"146801022":[1,0,0,0],"146800740":[0,0,0,0],"146800741":[0,0,0,0],"146800742":[0,0,0,0],"146801023":[0,0,0,0],"146801024":[0,0,0,0],"146801025":[0,0,0,0],"146800695":[0,0,0,0],"146800696":[0,0,0,0],"146800697":[3,0,0,0],"146801026":[3,0,0,0],"146801027":[3,0,0,0],"146801028":[3,0,0,0],"146801029":[3,1,1,0],"146801030":[3,2,1,0],"146801031":[4,2,1,0],"146800675":[0,0,0,0],"146800676":[0,0,0,0],"146800677":[2,1,0,0],"146801032":[2,1,0,0],"146801033":[2,1,0,0],"146801034":[3,1,0,0],"146801050":[0,0,0,0],"146801051":[0,0,0,0],"146801052":[0,0,0,0],"146801053":[0,0,0,0],"146801054":[0,0,0,0],"146801101":[3,1,1,0],"146800749":[3,0,0,0],"146800750":[3,0,0,0],"146800751":[3,0,0,0],"146801035":[3,0,0,0],"146801036":[3,0,0,0],"146801056":[1,0,0,0],"146800688":[0,0,0,0],"146800689":[0,0,0,0],"146800690":[0,0,0,0],"146801037":[0,0,0,0],"146800752":[1,1,0,0],"146800753":[1,1,0,0],"146800754":[1,1,0,0],"146801039":[1,1,0,0],"146801040":[1,1,0,0],"146800691":[0,0,0,0],"146800692":[0,0,0,0],"146801041":[4,0,0,0],"146800745":[0,0,0,0],"146800746":[0,0,0,0],"146801045":[0,0,0,0],"146801046":[0,0,0,0],"146800743":[0,0,0,0],"146800744":[0,0,0,0],"146801043":[0,0,0,0],"146801044":[0,0,0,0],"146800747":[3,1,0,0],"146800748":[3,1,0,0],"146801047":[3,1,0,0],"146801048":[3,1,0,0],"146800693":[2,0,0,0],"146800694":[2,0,0,0],"146801049":[2,0,0,0],"146801055":[0,0,0,0],"146801103":[4,0,0,0],"146801104":[0,0,0,0],"146800662":[0,0,0,0],"146800663":[2,2,0,0],"146800664":[2,2,0,0],"146801057":[2,2,0,0],"146801059":[2,2,0,0],"146800665":[0,0,0,0],"146800666":[0,0,0,0],"146800667":[1,1,1,0],"146801060":[1,1,1,0],"146801061":[1,1,1,0],"146801062":[2,0,0,0],"146801064":[2,0,0,0],"146801065":[1,0,0,0],"146800658":[0,0,0,0],"146800659":[0,0,0,0],"146800660":[0,0,0,0],"146800755":[0,0,0,0],"146800756":[0,0,0,0],"146800661":[0,0,0,0],"147849336":[0,0,0,0],"147849337":[0,0,0,0],"147849665":[0,0,0,0],"147849666":[0,0,0,0],"147849667":[0,0,0,0],"147849228":[0,0,0,0],"147849229":[0,0,0,0],"147849230":[0,0,0,0],"147849231":[0,0,0,0],"147849232":[2,0,0,0],"147849233":[2,1,0,0],"147849516":[4,1,0,0],"147849517":[4,1,0,0],"147849518":[4,1,0,0],"147849519":[4,0,0,0],"147849520":[4,0,0,0],"147849678":[4,4,4,0],"147849319":[0,0,0,0],"147849320":[0,0,0,0],"147849321":[1,0,0,0],"147849521":[1,0,0,0],"147849522":[1,0,0,0],"147849523":[1,0,0,0],"147849313":[0,0,0,0],"147849314":[1,0,0,0],"147849315":[1,0,0,0],"147849524":[1,0,0,0],"147849525":[1,0,0,0],"147849526":[1,0,0,0],"147849527":[2,2,2,0],"147849254":[0,0,0,0],"147849255":[2,0,0,0],"147849256":[2,0,0,0],"147849257":[2,0,0,0],"147849528":[2,0,0,0],"147849529":[2,0,0,0],"147849530":[2,0,0,0],"147849298":[0,0,0,0],"147849299":[0,0,0,0],"147849300":[0,0,0,0],"147849531":[0,0,0,0],"147849532":[0,0,0,0],"147849533":[0,0,0,0],"147849672":[3,1,1,0],"147849534":[0,0,0,0],"147849535":[0,0,0,0],"147849536":[0,0,0,0],"147849653":[4,0,0,0],"147849301":[2,0,0,0],"147849302":[2,0,0,0],"147849303":[2,0,0,0],"147849537":[2,0,0,0],"147849538":[2,0,0,0],"147849539":[2,0,0,0],"147849280":[0,0,0,0],"147849281":[0,0,0,0],"147849282":[2,0,0,0],"147849540":[2,0,0,0],"147849541":[3,0,0,0],"147849316":[0,0,0,0],"147849317":[2,0,0,0],"147849318":[2,0,0,0],"147849542":[2,0,0,0],"147849543":[2,0,0,0],"147849216":[0,0,0,0],"147849217":[0,0,0,0],"147849218":[0,0,0,0],"147849222":[1,0,0,0],"147849223":[1,0,0,0],"147849224":[1,0,0,0],"147849544":[2,0,0,0],"147849545":[2,0,0,0],"147849547":[2,2,0,0],"147849548":[2,0,0,0],"147849549":[2,0,0,0],"147849550":[2,0,0,0],"147849307":[2,1,0,0],"147849308":[2,1,0,0],"147849309":[2,1,0,0],"147849551":[2,1,0,0],"147849552":[2,2,0,0],"147849554":[2,2,0,0],"147849219":[0,0,0,0],"147849220":[2,1,1,0],"147849221":[2,1,1,0],"147849555":[2,1,1,0],"147849556":[2,2,1,0],"147849557":[3,2,1,0],"147849558":[2,0,0,0],"147849559":[2,0,0,0],"147849560":[2,0,0,0],"147849295":[0,0,0,0],"147849296":[0,0,0,0],"147849297":[2,0,0,0],"147849561":[2,0,0,0],"147849563":[2,0,0,0],"147849286":[0,0,0,0],"147849287":[0,0,0,0],"147849288":[2,2,0,0],"147849564":[2,2,0,0],"147849565":[2,2,0,0],"147849566":[2,2,0,0],"147849567":[3,1,1,0],"147849568":[3,2,1,0],"147849569":[4,2,1,0],"147849289":[0,0,0,0],"147849290":[0,0,0,0],"147849291":[1,1,0,0],"147849570":[1,1,0,0],"147849571":[1,1,0,0],"147849572":[1,1,0,0],"147849250":[0,0,0,0],"147849251":[0,0,0,0],"147849252":[2,1,0,0],"147849253":[2,1,0,0],"147849573":[2,1,0,0],"147849574":[2,1,0,0],"147849264":[2,1,1,0],"147849265":[2,1,1,0],"147849266":[2,1,1,0],"147849575":[2,1,1,0],"147849576":[2,1,1,0],"147849577":[2,1,1,0],"147849578":[2,0,0,0],"147849668":[2,0,0,0],"147849579":[2,0,0,0],"147849225":[0,0,0,0],"147849226":[0,0,0,0],"147849227":[0,0,0,0],"147849292":[1,1,0,0],"147849293":[1,1,0,0],"147849294":[1,1,0,0],"147849580":[1,1,0,0],"147849581":[1,1,0,0],"147849582":[1,1,0,0],"147849583":[2,0,0,0],"147849584":[2,0,0,0],"147849585":[2,0,0,0],"147849277":[0,0,0,0],"147849278":[1,1,1,0],"147849279":[1,1,1,0],"147849586":[2,1,1,0],"147849587":[2,2,1,0],"147849322":[0,0,0,0],"147849323":[0,0,0,0],"147849324":[0,0,0,0],"147849588":[0,0,0,0],"147849589":[0,0,0,0],"147849664":[0,0,0,0],"147849304":[0,0,0,0],"147849305":[1,0,0,0],"147849306":[1,0,0,0],"147849590":[1,0,0,0],"147849591":[1,0,0,0],"147849592":[1,0,0,0],"147849274":[0,0,0,0],"147849275":[0,0,0,0],"147849276":[2,1,0,0],"147849593":[2,1,0,0],"147849595":[3,2,0,0],"147849596":[3,0,0,0],"147849597":[3,0,0,0],"147849598":[3,0,0,0],"147849599":[0,0,0,0],"147849600":[0,0,0,0],"147849601":[0,0,0,0],"147849310":[0,0,0,0],"147849311":[2,0,0,0],"147849312":[2,0,0,0],"147849602":[2,0,0,0],"147849603":[2,0,0,0],"147849604":[2,0,0,0],"147849655":[3,0,0,0],"147849258":[0,0,0,0],"147849259":[0,0,0,0],"147849260":[3,0,0,0],"147849605":[3,0,0,0],"147849606":[3,0,0,0],"147849607":[3,0,0,0],"147849608":[1,1,1,0],"147849609":[1,1,1,0],"147849610":[1,1,1,0],"147849283":[0,0,0,0],"147849284":[0,0,0,0],"147849285":[1,1,0,0],"147849611":[1,1,0,0],"147849612":[2,1,0,0],"147849261":[0,0,0,0],"147849262":[0,0,0,0],"147849263":[2,1,0,0],"147849613":[2,1,0,0],"147849614":[2,1,0,0],"147849615":[3,1,0,0],"147849629":[0,0,0,0],"147849630":[0,0,0,0],"147849631":[0,0,0,0],"147849632":[1,0,0,0],"147849633":[1,0,0,0],"147849674":[3,1,1,0],"147849331":[0,0,0,0],"147849332":[3,0,0,0],"147849333":[3,0,0,0],"147849616":[3,0,0,0],"147849617":[3,0,0,0],"147849635":[0,0,0,0],"147849267":[0,0,0,0],"147849268":[0,0,0,0],"147849269":[0,0,0,0],"147849618":[0,0,0,0],"147849270":[0,0,0,0],"147849271":[0,0,0,0],"147849620":[4,0,0,0],"147849325":[1,0,0,0],"147849326":[1,0,0,0],"147849622":[1,0,0,0],"147849623":[1,0,0,0],"147849327":[0,0,0,0],"147849328":[0,0,0,0],"147849624":[0,0,0,0],"147849625":[0,0,0,0],"147849329":[2,1,1,0],"147849330":[2,1,1,0],"147849626":[2,1,1,0],"147849627":[2,1,1,0],"147849272":[2,0,0,0],"147849273":[2,0,0,0],"147849628":[2,0,0,0],"147849634":[0,0,0,0],"147849676":[4,0,0,0],"147849677":[0,0,0,0],"147849247":[0,0,0,0],"147849248":[0,0,0,0],"147849249":[2,2,0,0],"147849636":[2,2,0,0],"147849637":[2,2,0,0],"147849244":[0,0,0,0],"147849245":[3,1,0,0],"147849246":[3,1,0,0],"147849638":[3,1,0,0],"147849639":[3,1,0,0],"147849238":[3,0,0,0],"147849239":[3,0,0,0],"147849240":[3,0,0,0],"147849641":[3,0,0,0],"147849642":[3,0,0,0],"147849241":[1,1,1,0],"147849242":[1,1,1,0],"147849243":[1,1,1,0],"147849644":[1,1,1,0],"147849645":[1,1,1,0],"147849650":[2,1,0,0],"147849651":[2,1,0,0],"147849652":[2,1,0,0],"147849646":[2,0,0,0],"147849648":[2,0,0,0],"147849649":[0,0,0,0],"147849234":[0,0,0,0],"147849235":[0,0,0,0],"147849236":[0,0,0,0],"147849334":[0,0,0,0],"147849335":[0,0,0,0],"147849237":[0,0,0,0],"148897937":[0,0,0,0],"148897938":[0,0,0,0],"148898261":[0,0,0,0],"148898262":[0,0,0,0],"148898263":[0,0,0,0],"148897810":[0,0,0,0],"148897811":[0,0,0,0],"148897812":[0,0,0,0],"148897813":[0,0,0,0],"148897814":[2,0,0,0],"148897815":[2,1,0,0],"148898092":[4,1,0,0],"148898093":[4,1,0,0],"148898094":[4,2,0,0],"148898095":[4,0,0,0],"148898096":[4,0,0,0],"148898292":[4,4,4,0],"148897844":[2,1,1,0],"148897845":[2,1,1,0],"148897846":[2,1,1,0],"148898097":[2,1,1,0],"148898098":[2,1,1,0],"148898099":[2,1,1,0],"148898100":[2,2,0,0],"148898276":[2,2,0,0],"148898101":[2,2,0,0],"148897911":[0,0,0,0],"148897912":[1,0,0,0],"148897913":[1,0,0,0],"148898102":[1,0,0,0],"148898103":[1,0,0,0],"148898104":[1,0,0,0],"148898105":[2,2,2,0],"148897835":[0,0,0,0],"148897836":[3,0,0,0],"148897837":[3,0,0,0],"148898106":[3,0,0,0],"148898107":[3,0,0,0],"148898108":[3,0,0,0],"148898109":[2,0,0,0],"148898110":[2,0,0,0],"148898111":[2,0,0,0],"148897908":[0,0,0,0],"148897909":[2,0,0,0],"148897910":[2,0,0,0],"148898112":[2,0,0,0],"148898113":[2,0,0,0],"148898114":[2,0,0,0],"148898250":[2,0,0,0],"148897901":[0,0,0,0],"148897902":[0,0,0,0],"148897903":[0,0,0,0],"148897904":[0,0,0,0],"148898115":[0,0,0,0],"148898116":[0,0,0,0],"148898117":[0,0,0,0],"148897897":[0,0,0,0],"148897898":[0,0,0,0],"148897899":[1,1,0,0],"148897900":[1,1,0,0],"148898118":[1,1,0,0],"148898119":[1,1,0,0],"148898120":[1,1,0,0],"148897878":[0,0,0,0],"148897879":[0,0,0,0],"148897880":[1,1,0,0],"148898121":[1,1,0,0],"148898122":[1,1,0,0],"148897872":[0,0,0,0],"148897873":[0,0,0,0],"148897874":[1,0,0,0],"148898123":[1,0,0,0],"148898124":[1,0,0,0],"148897798":[0,0,0,0],"148897799":[0,0,0,0],"148897800":[0,0,0,0],"148897792":[0,0,0,0],"148897793":[1,0,0,0],"148897794":[1,0,0,0],"148898125":[1,0,0,0],"148898126":[1,0,0,0],"148898127":[1,0,0,0],"148898128":[1,0,0,0],"148898129":[1,0,0,0],"148898130":[1,0,0,0],"148897801":[1,0,0,0],"148897802":[1,0,0,0],"148897803":[1,0,0,0],"148898131":[1,0,0,0],"148898132":[1,0,0,0],"148898134":[1,1,0,0],"148898239":[1,1,0,0],"148898240":[1,1,0,0],"148898241":[1,1,0,0],"148897795":[3,0,0,0],"148897796":[3,0,0,0],"148897797":[3,0,0,0],"148898135":[3,0,0,0],"148898136":[3,0,0,0],"148898137":[3,0,0,0],"148898138":[1,1,0,0],"148898139":[1,1,0,0],"148898140":[1,1,0,0],"148897841":[0,0,0,0],"148897842":[2,1,0,0],"148897843":[2,1,0,0],"148898141":[2,1,0,0],"148898142":[2,1,0,0],"148898143":[2,1,0,0],"148898144":[3,0,0,0],"148898277":[3,0,0,0],"148898145":[3,0,0,0],"148897894":[0,0,0,0],"148897895":[0,0,0,0],"148897896":[1,0,0,0],"148898146":[2,0,0,0],"148898147":[3,0,0,0],"148898148":[4,1,0,0],"148898248":[4,0,0,0],"148898149":[1,0,0,0],"148898150":[1,0,0,0],"148898151":[1,0,0,0],"148898246":[4,0,0,0],"148897914":[1,0,0,0],"148897915":[1,0,0,0],"148897916":[1,0,0,0],"148898152":[1,0,0,0],"148898153":[1,0,0,0],"148898247":[0,0,0,0],"148897881":[0,0,0,0],"148897882":[0,0,0,0],"148897883":[1,1,1,0],"148898154":[1,1,1,0],"148898155":[1,1,1,0],"148897888":[0,0,0,0],"148897889":[0,0,0,0],"148897890":[2,0,0,0],"148898156":[2,0,0,0],"148898157":[2,0,0,0],"148898158":[3,0,0,0],"148897807":[0,0,0,0],"148897808":[0,0,0,0],"148897809":[0,0,0,0],"148897804":[0,0,0,0],"148897805":[0,0,0,0],"148897806":[0,0,0,0],"148898159":[0,0,0,0],"148898160":[0,0,0,0],"148898161":[0,0,0,0],"148898162":[1,1,0,0],"148898163":[1,1,0,0],"148898164":[1,1,0,0],"148898165":[4,0,0,0],"148898166":[4,1,0,0],"148898167":[4,2,1,0],"148898168":[1,0,0,0],"148898169":[1,0,0,0],"148898170":[1,0,0,0],"148897920":[0,0,0,0],"148897921":[0,0,0,0],"148897922":[0,0,0,0],"148898171":[0,0,0,0],"148898172":[0,0,0,0],"148898173":[0,0,0,0],"148897923":[1,0,0,0],"148897924":[1,0,0,0],"148897925":[1,0,0,0],"148898174":[1,0,0,0],"148898175":[1,0,0,0],"148898260":[1,0,0,0],"148897917":[0,0,0,0],"148897918":[1,0,0,0],"148897919":[1,1,0,0],"148898176":[2,1,0,0],"148898177":[2,1,0,0],"148897891":[0,0,0,0],"148897892":[1,1,0,0],"148897893":[1,1,0,0],"148898178":[1,1,0,0],"148898257":[1,1,0,0],"148898179":[1,1,0,0],"148897905":[0,0,0,0],"148897906":[2,1,0,0],"148897907":[2,1,0,0],"148898180":[2,1,0,0],"148898181":[2,1,0,0],"148898182":[2,1,0,0],"148897884":[0,0,0,0],"148897885":[0,0,0,0],"148897886":[3,0,0,0],"148897887":[3,0,0,0],"148898183":[3,1,0,0],"148898184":[3,1,0,0],"148898185":[3,1,0,0],"148898186":[3,1,1,0],"148898187":[3,2,1,0],"148898188":[4,2,1,0],"148897875":[0,0,0,0],"148897876":[0,0,0,0],"148897877":[2,0,0,0],"148898189":[2,0,0,0],"148898190":[2,0,0,0],"148897854":[0,0,0,0],"148897855":[0,0,0,0],"148897856":[0,0,0,0],"148897866":[1,1,1,0],"148897867":[1,1,1,0],"148897868":[1,1,1,0],"148898191":[1,1,1,0],"148898192":[1,1,1,0],"148897860":[0,0,0,0],"148897861":[2,0,0,0],"148897862":[2,0,0,0],"148898193":[2,0,0,0],"148898194":[2,0,0,0],"148897857":[0,0,0,0],"148897858":[0,0,0,0],"148897859":[2,1,0,0],"148898195":[2,1,0,0],"148898196":[2,1,0,0],"148898197":[2,1,0,0],"148897863":[0,0,0,0],"148897864":[0,0,0,0],"148897865":[1,1,0,0],"148898198":[2,1,0,0],"148898199":[2,1,0,0],"148898200":[2,1,0,0],"148897838":[0,0,0,0],"148897839":[0,0,0,0],"148897840":[2,1,0,0],"148898201":[2,1,0,0],"148898202":[2,1,0,0],"148898203":[3,1,0,0],"148898220":[1,0,0,0],"148898221":[1,0,0,0],"148898222":[1,0,0,0],"148898223":[0,0,0,0],"148898224":[0,0,0,0],"148898288":[3,1,0,0],"148897869":[0,0,0,0],"148897870":[2,2,0,0],"148897871":[2,2,0,0],"148898204":[2,2,0,0],"148898206":[2,2,0,0],"148897932":[3,0,0,0],"148897933":[3,0,0,0],"148897934":[3,0,0,0],"148898207":[3,0,0,0],"148898208":[3,0,0,0],"148898226":[0,0,0,0],"148897847":[0,0,0,0],"148897848":[0,0,0,0],"148897849":[0,0,0,0],"148898209":[0,0,0,0],"148897850":[0,0,0,0],"148897851":[0,0,0,0],"148898211":[2,1,0,0],"148897926":[1,0,0,0],"148897927":[1,0,0,0],"148898213":[1,0,0,0],"148898214":[1,0,0,0],"148897928":[0,0,0,0],"148897929":[0,0,0,0],"148898215":[2,0,0,0],"148898216":[2,0,0,0],"148897930":[3,0,0,0],"148897931":[3,0,0,0],"148898217":[3,1,0,0],"148898218":[3,1,0,0],"148897852":[2,0,0,0],"148897853":[2,0,0,0],"148898219":[2,0,0,0],"148898225":[0,0,0,0],"148898290":[4,0,0,0],"148898291":[0,0,0,0],"148897820":[0,0,0,0],"148897821":[0,0,0,0],"148897822":[0,0,0,0],"148898227":[0,0,0,0],"148898229":[1,0,0,0],"148897823":[0,0,0,0],"148897824":[0,0,0,0],"148897825":[3,1,0,0],"148898230":[3,1,0,0],"148898231":[3,1,0,0],"148897826":[0,0,0,0],"148897827":[0,0,0,0],"148897828":[1,1,0,0],"148898232":[1,1,0,0],"148898233":[2,1,0,0],"148897829":[0,0,0,0],"148897830":[0,0,0,0],"148897831":[2,0,0,0],"148898234":[2,0,0,0],"148898235":[2,0,0,0],"148897832":[0,0,0,0],"148897833":[0,0,0,0],"148897834":[0,0,0,0],"148898236":[0,0,0,0],"148898238":[0,0,0,0],"148898242":[2,0,0,0],"148898244":[2,0,0,0],"148898245":[0,0,0,0],"148897816":[0,0,0,0],"148897817":[0,0,0,0],"148897818":[0,0,0,0],"148897935":[0,0,0,0],"148897936":[0,0,0,0],"148897819":[0,0,0,0],"148897939":[3,0,0,0],"148897940":[3,0,0,0],"202375168":[0,0,0,0],"203423744":[0,0,0,0],"204472320":[0,0,0,0],"205520896":[0,0,0,0],"206569472":[0,0,0,0],"202375169":[1,0,0,0],"203423745":[1,0,0,0],"204472321":[2,0,0,0],"205520897":[1,1,0,0],"206569473":[1,0,0,0],"202375170":[0,0,0,0],"203423746":[0,0,0,0],"204472322":[0,0,0,0],"205520898":[0,0,0,0],"206569474":[0,0,0,0],"202375171":[1,1,0,0],"203423747":[2,0,0,0],"204472323":[1,1,0,0],"205520899":[1,0,0,0],"206569475":[2,0,0,0],"202375172":[0,0,0,0],"203423748":[0,0,0,0],"204472324":[0,0,0,0],"205520900":[0,0,0,0],"206569476":[0,0,0,0],"202375173":[2,0,0,0],"203423749":[1,0,0,0],"204472325":[1,1,0,0],"205520901":[1,1,0,0],"206569477":[1,1,0,0],"202375174":[0,0,0,0],"203423750":[0,0,0,0],"204472326":[0,0,0,0],"205520902":[0,0,0,0],"206569478":[0,0,0,0],"202375175":[2,0,0,0],"203423751":[1,0,0,0],"204472327":[2,0,0,0],"205520903":[1,1,0,0],"206569479":[2,0,0,0],"202375176":[1,1,0,0],"203423752":[1,0,0,0],"204472328":[2,1,1,0],"205520904":[2,0,0,0],"206569480":[2,0,0,0],"202375177":[0,0,0,0],"203423753":[0,0,0,0],"204472329":[0,0,0,0],"205520905":[0,0,0,0],"206569481":[0,0,0,0],"202375178":[1,0,0,0],"203423754":[2,0,0,0],"204472330":[1,0,0,0],"205520906":[1,1,0,0],"206569482":[2,0,0,0],"202375179":[0,0,0,0],"203423755":[0,0,0,0],"204472331":[0,0,0,0],"205520907":[0,0,0,0],"206569483":[0,0,0,0],"202375180":[3,1,0,0],"203423756":[2,1,0,0],"204472332":[1,0,0,0],"205520908":[2,0,0,0],"206569484":[1,0,0,0],"202375181":[0,0,0,0],"203423757":[1,1,0,0],"204472333":[2,1,0,0],"205520909":[1,0,0,0],"206569485":[1,0,0,0],"202375182":[0,0,0,0],"203423758":[0,0,0,0],"204472334":[0,0,0,0],"205520910":[0,0,0,0],"206569486":[0,0,0,0],"202375183":[2,2,0,0],"203423759":[1,1,0,0],"204472335":[1,1,0,0],"205520911":[2,0,0,0],"206569487":[1,1,0,0],"202375184":[0,0,0,0],"203423760":[0,0,0,0],"204472336":[0,0,0,0],"205520912":[0,0,0,0],"206569488":[0,0,0,0],"202375185":[2,2,0,0],"203423761":[1,0,0,0],"204472337":[2,0,0,0],"205520913":[3,0,0,0],"206569489":[1,1,0,0],"202375186":[0,0,0,0],"203423762":[0,0,0,0],"204472338":[0,0,0,0],"205520914":[0,0,0,0],"206569490":[0,0,0,0],"202375187":[2,0,0,0],"203423763":[2,0,0,0],"204472339":[1,0,0,0],"205520915":[1,1,0,0],"206569491":[1,1,0,0],"202375188":[0,0,0,0],"203423764":[0,0,0,0],"204472340":[0,0,0,0],"205520916":[0,0,0,0],"206569492":[0,0,0,0],"202375189":[2,2,0,0],"203423765":[2,0,0,0],"204472341":[2,1,1,0],"205520917":[1,0,0,0],"206569493":[2,1,0,0],"202375190":[0,0,0,0],"203423766":[0,0,0,0],"204472342":[0,0,0,0],"205520918":[0,0,0,0],"206569494":[0,0,0,0],"202375191":[2,2,0,0],"203423767":[2,0,0,0],"204472343":[2,1,1,0],"205520919":[1,0,0,0],"206569495":[2,1,0,0],"202375192":[0,0,0,0],"203423768":[0,0,0,0],"204472344":[0,0,0,0],"205520920":[0,0,0,0],"206569496":[0,0,0,0],"202375193":[1,0,0,0],"203423769":[1,0,0,0],"204472345":[3,0,0,0],"205520921":[1,0,0,0],"206569497":[1,1,0,0],"202375194":[0,0,0,0],"203423770":[0,0,0,0],"204472346":[0,0,0,0],"205520922":[0,0,0,0],"206569498":[0,0,0,0],"202375195":[1,0,0,0],"203423771":[1,0,0,0],"204472347":[3,0,0,0],"205520923":[1,0,0,0],"206569499":[1,1,0,0],"202375196":[0,0,0,0],"203423772":[0,0,0,0],"204472348":[0,0,0,0],"205520924":[0,0,0,0],"206569500":[0,0,0,0],"202375197":[2,1,0,0],"203423773":[3,2,1,0],"204472349":[1,1,0,0],"205520925":[2,0,0,0],"206569501":[3,1,0,0],"202375198":[0,0,0,0],"203423774":[0,0,0,0],"202375199":[1,1,0,0],"203423775":[0,0,0,0],"202375200":[0,0,0,0],"203423776":[0,0,0,0],"204472352":[0,0,0,0],"205520928":[0,0,0,0],"206569504":[0,0,0,0],"202375201":[2,2,0,0],"203423777":[1,1,0,0],"204472353":[0,0,0,0],"205520929":[2,0,0,0],"206569505":[3,1,0,0],"202375202":[0,0,0,0],"203423778":[0,0,0,0],"204472354":[0,0,0,0],"205520930":[0,0,0,0],"206569506":[0,0,0,0],"202375203":[2,0,0,0],"203423779":[2,0,0,0],"204472355":[1,1,0,0],"205520931":[0,0,0,0],"206569507":[1,0,0,0],"202375204":[0,0,0,0],"203423780":[0,0,0,0],"204472356":[0,0,0,0],"205520932":[0,0,0,0],"206569508":[0,0,0,0],"202375205":[2,0,0,0],"203423781":[2,0,0,0],"204472357":[1,1,0,0],"205520933":[0,0,0,0],"206569509":[1,0,0,0],"202375206":[0,0,0,0],"203423782":[0,0,0,0],"204472358":[0,0,0,0],"205520934":[0,0,0,0],"206569510":[0,0,0,0],"202375207":[1,0,0,0],"203423783":[1,1,0,0],"204472359":[3,0,0,0],"205520935":[2,0,0,0],"206569511":[1,0,0,0],"202375208":[0,0,0,0],"203423784":[0,0,0,0],"204472360":[0,0,0,0],"205520936":[0,0,0,0],"206569512":[0,0,0,0],"202375209":[1,0,0,0],"203423785":[1,0,0,0],"204472361":[2,0,0,0],"205520937":[1,0,0,0],"206569513":[1,1,0,0],"202375210":[0,0,0,0],"203423786":[0,0,0,0],"204472362":[0,0,0,0],"205520938":[0,0,0,0],"206569514":[0,0,0,0],"202375211":[1,0,0,0],"203423787":[1,0,0,0],"204472363":[2,0,0,0],"205520939":[1,0,0,0],"206569515":[1,1,0,0],"202375212":[0,0,0,0],"203423788":[0,0,0,0],"204472364":[0,0,0,0],"205520940":[0,0,0,0],"206569516":[0,0,0,0],"202375213":[1,0,0,0],"203423789":[1,1,0,0],"204472365":[3,0,0,0],"205520941":[2,0,0,0],"206569517":[1,0,0,0],"202375214":[0,0,0,0],"203423790":[0,0,0,0],"204472366":[0,0,0,0],"205520942":[0,0,0,0],"206569518":[0,0,0,0],"202375215":[2,1,0,0],"203423791":[1,1,0,0],"204472367":[1,1,0,0],"205520943":[3,1,0,0],"206569519":[1,1,0,0],"202375216":[0,0,0,0],"203423792":[0,0,0,0],"204472368":[0,0,0,0],"205520944":[0,0,0,0],"206569520":[0,0,0,0],"202375217":[3,0,0,0],"203423793":[2,1,0,0],"204472369":[1,1,0,0],"205520945":[2,1,0,0],"206569521":[3,1,0,0],"202375218":[0,0,0,0],"203423794":[0,0,0,0],"204472370":[0,0,0,0],"205520946":[0,0,0,0],"206569522":[0,0,0,0],"202375219":[1,0,0,0],"203423795":[3,0,0,0],"204472371":[3,0,0,0],"205520947":[1,1,0,0],"206569523":[2,1,1,0],"202375220":[0,0,0,0],"203423796":[0,0,0,0],"204472372":[0,0,0,0],"205520948":[0,0,0,0],"206569524":[0,0,0,0],"202375221":[2,0,0,0],"203423797":[1,0,0,0],"204472373":[1,1,0,0],"205520949":[3,1,0,0],"206569525":[1,0,0,0],"202375222":[0,0,0,0],"203423798":[0,0,0,0],"204472374":[0,0,0,0],"205520950":[0,0,0,0],"206569526":[0,0,0,0],"202375223":[1,0,0,0],"203423799":[1,0,0,0],"204472375":[1,1,0,0],"205520951":[2,0,0,0],"206569527":[1,0,0,0],"202375224":[0,0,0,0],"203423800":[0,0,0,0],"204472376":[0,0,0,0],"205520952":[0,0,0,0],"206569528":[0,0,0,0],"202375225":[2,1,0,0],"203423801":[1,1,0,0],"204472377":[2,0,0,0],"205520953":[3,0,0,0],"206569529":[1,1,0,0],"202375226":[1,1,0,0],"203423802":[2,1,0,0],"204472378":[2,0,0,0],"205520954":[2,2,0,0],"206569530":[1,0,0,0],"202375227":[1,1,0,0],"203423803":[2,1,0,0],"204472379":[2,0,0,0],"205520955":[2,2,0,0],"206569531":[1,0,0,0],"202375228":[0,0,0,0],"203423804":[0,0,0,0],"204472380":[0,0,0,0],"205520956":[0,0,0,0],"206569532":[0,0,0,0],"202375229":[1,1,0,0],"203423805":[2,1,0,0],"204472381":[2,0,0,0],"205520957":[2,1,0,0],"206569533":[1,0,0,0],"202375230":[0,0,0,0],"203423806":[0,0,0,0],"204472382":[0,0,0,0],"205520958":[0,0,0,0],"206569534":[0,0,0,0],"202375231":[2,2,0,0],"203423807":[1,0,0,0],"204472383":[1,1,0,0],"205520959":[2,1,0,0],"206569535":[3,1,0,0],"202375232":[0,0,0,0],"203423808":[0,0,0,0],"204472384":[0,0,0,0],"205520960":[0,0,0,0],"206569536":[0,0,0,0],"202375233":[0,0,0,0],"203423809":[0,0,0,0],"204472385":[0,0,0,0],"205520961":[0,0,0,0],"206569537":[0,0,0,0],"202375234":[0,0,0,0],"203423810":[0,0,0,0],"204472386":[0,0,0,0],"205520962":[0,0,0,0],"206569538":[0,0,0,0],"202375235":[0,0,0,0],"203423811":[0,0,0,0],"204472387":[0,0,0,0],"205520963":[0,0,0,0],"206569539":[0,0,0,0],"202375236":[0,0,0,0],"203423812":[0,0,0,0],"204472388":[0,0,0,0],"205520964":[0,0,0,0],"206569540":[0,0,0,0],"202375237":[1,1,0,0],"203423813":[1,0,0,0],"204472389":[1,1,0,0],"205520965":[1,1,0,0],"206569541":[1,1,0,0],"202375238":[1,0,0,0],"203423814":[2,0,0,0],"204472390":[1,0,0,0],"205520966":[1,0,0,0],"206569542":[1,0,0,0],"202375239":[1,0,0,0],"203423815":[1,0,0,0],"204472391":[1,0,0,0],"205520967":[1,0,0,0],"206569543":[2,0,0,0],"202375240":[1,0,0,0],"203423816":[1,0,0,0],"204472392":[2,0,0,0],"205520968":[3,0,0,0],"206569544":[1,0,0,0],"202375241":[0,0,0,0],"202375242":[0,0,0,0],"202375243":[0,0,0,0],"203423819":[0,0,0,0],"202375244":[3,0,0,0],"203423820":[2,1,0,0],"202375245":[0,0,0,0],"203423821":[0,0,0,0],"204472397":[0,0,0,0],"205520973":[0,0,0,0],"206569549":[0,0,0,0],"202375246":[1,0,0,0],"203423822":[2,1,0,0],"204472398":[2,1,0,0],"205520974":[3,1,0,0],"206569550":[1,1,0,0],"204472399":[0,0,0,0],"206569551":[0,0,0,0],"204472400":[1,1,0,0],"206569552":[2,1,0,0],"202375249":[0,0,0,0],"203423825":[0,0,0,0],"204472401":[0,0,0,0],"205520977":[0,0,0,0],"206569553":[0,0,0,0],"202375250":[2,0,0,0],"203423826":[1,1,0,0],"204472402":[1,0,0,0],"205520978":[1,1,0,0],"206569554":[2,1,0,0],"202375251":[0,0,0,0],"202375252":[1,0,0,0],"202375253":[0,0,0,0],"203423829":[0,0,0,0],"204472405":[0,0,0,0],"205520981":[0,0,0,0],"206569557":[0,0,0,0],"202375254":[2,0,0,0],"203423830":[1,1,0,0],"204472406":[2,0,0,0],"205520982":[1,1,0,0],"206569558":[1,1,0,0],"203423831":[0,0,0,0],"205520983":[0,0,0,0],"206569559":[0,0,0,0],"203423832":[2,1,0,0],"205520984":[3,1,0,0],"206569560":[2,0,0,0],"203423833":[0,0,0,0],"205520985":[0,0,0,0],"203423834":[2,0,0,0],"205520986":[2,1,0,0],"202375259":[0,0,0,0],"203423835":[0,0,0,0],"204472411":[0,0,0,0],"205520987":[0,0,0,0],"206569563":[0,0,0,0],"202375260":[1,0,0,0],"203423836":[1,0,0,0],"204472412":[3,0,0,0],"205520988":[1,0,0,0],"206569564":[1,1,0,0],"202375261":[0,0,0,0],"203423837":[0,0,0,0],"204472413":[0,0,0,0],"205520989":[0,0,0,0],"206569565":[0,0,0,0],"202375262":[2,1,0,0],"203423838":[1,0,0,0],"204472414":[1,1,0,0],"205520990":[1,0,0,0],"206569566":[2,1,0,0],"202375263":[0,0,0,0],"203423839":[0,0,0,0],"204472415":[0,0,0,0],"205520991":[0,0,0,0],"206569567":[0,0,0,0],"202375264":[1,1,0,0],"203423840":[2,0,0,0],"204472416":[1,0,0,0],"205520992":[1,1,0,0],"206569568":[3,2,1,0],"202375265":[0,0,0,0],"203423841":[0,0,0,0],"204472417":[0,0,0,0],"205520993":[0,0,0,0],"206569569":[0,0,0,0],"202375266":[1,1,0,0],"203423842":[2,0,0,0],"204472418":[1,1,1,0],"205520994":[1,1,0,0],"206569570":[1,1,0,0],"202375267":[0,0,0,0],"203423843":[0,0,0,0],"204472419":[0,0,0,0],"205520995":[0,0,0,0],"206569571":[0,0,0,0],"202375268":[1,1,0,0],"203423844":[2,0,0,0],"204472420":[2,1,1,0],"205520996":[1,0,0,0],"206569572":[3,0,0,0],"202375269":[0,0,0,0],"203423845":[0,0,0,0],"204472421":[0,0,0,0],"205520997":[0,0,0,0],"206569573":[0,0,0,0],"202375270":[2,1,0,0],"203423846":[2,0,0,0],"204472422":[1,1,0,0],"205520998":[1,0,0,0],"206569574":[2,1,0,0],"202375271":[0,0,0,0],"203423847":[0,0,0,0],"204472423":[0,0,0,0],"205520999":[0,0,0,0],"206569575":[0,0,0,0],"202375272":[1,0,0,0],"203423848":[1,1,0,0],"204472424":[1,1,0,0],"205521000":[1,1,0,0],"206569576":[1,1,0,0],"202375273":[0,0,0,0],"203423849":[0,0,0,0],"204472425":[0,0,0,0],"205521001":[0,0,0,0],"206569577":[0,0,0,0],"202375274":[3,0,0,0],"203423850":[1,1,0,0],"204472426":[1,1,0,0],"205521002":[2,0,0,0],"206569578":[1,0,0,0],"202375275":[0,0,0,0],"203423851":[0,0,0,0],"204472427":[0,0,0,0],"205521003":[0,0,0,0],"206569579":[0,0,0,0],"202375276":[1,0,0,0],"203423852":[2,1,1,0],"204472428":[2,0,0,0],"205521004":[1,0,0,0],"206569580":[3,1,0,0],"202375277":[0,0,0,0],"203423853":[0,0,0,0],"204472429":[0,0,0,0],"205521005":[0,0,0,0],"206569581":[0,0,0,0],"202375278":[2,1,0,0],"203423854":[3,1,1,0],"204472430":[1,1,0,0],"205521006":[2,0,0,0],"206569582":[2,0,0,0],"202375279":[0,0,0,0],"203423855":[0,0,0,0],"204472431":[0,0,0,0],"205521007":[0,0,0,0],"206569583":[0,0,0,0],"202375280":[1,1,0,0],"203423856":[1,0,0,0],"204472432":[2,0,0,0],"205521008":[2,0,0,0],"206569584":[1,1,0,0],"202375281":[0,0,0,0],"203423857":[0,0,0,0],"204472433":[0,0,0,0],"205521009":[0,0,0,0],"206569585":[0,0,0,0],"202375282":[2,1,0,0],"203423858":[1,1,0,0],"204472434":[3,0,0,0],"205521010":[2,1,0,0],"206569586":[1,0,0,0],"202375283":[0,0,0,0],"203423859":[0,0,0,0],"204472435":[0,0,0,0],"205521011":[0,0,0,0],"206569587":[0,0,0,0],"202375284":[2,0,0,0],"203423860":[1,0,0,0],"204472436":[2,1,0,0],"205521012":[1,1,0,0],"206569588":[2,0,0,0],"202375285":[0,0,0,0],"203423861":[0,0,0,0],"204472437":[0,0,0,0],"205521013":[0,0,0,0],"206569589":[0,0,0,0],"202375286":[2,1,0,0],"203423862":[1,1,0,0],"204472438":[1,1,0,0],"205521014":[2,0,0,0],"206569590":[3,0,0,0],"202375287":[0,0,0,0],"203423863":[0,0,0,0],"204472439":[0,0,0,0],"205521015":[0,0,0,0],"206569591":[0,0,0,0],"202375288":[1,0,0,0],"203423864":[1,0,0,0],"204472440":[2,0,0,0],"205521016":[3,1,0,0],"206569592":[1,0,0,0],"202375289":[2,1,0,0],"203423865":[2,0,0,0],"204472441":[3,1,0,0],"205521017":[1,0,0,0],"206569593":[1,1,0,0],"202375290":[2,1,0,0],"203423866":[3,1,0,0],"204472442":[2,0,0,0],"205521018":[2,0,0,0],"206569594":[3,1,0,0],"202375291":[0,0,0,0],"203423867":[0,0,0,0],"204472443":[0,0,0,0],"205521019":[0,0,0,0],"206569595":[0,0,0,0],"202375292":[1,1,0,0],"203423868":[2,0,0,0],"204472444":[2,0,0,0],"205521020":[1,1,0,0],"206569596":[1,0,0,0],"202375293":[0,0,0,0],"203423869":[0,0,0,0],"204472445":[0,0,0,0],"205521021":[0,0,0,0],"206569597":[0,0,0,0],"202375294":[2,0,0,0],"203423870":[1,0,0,0],"204472446":[2,0,0,0],"205521022":[2,1,0,0],"206569598":[1,1,1,0],"202375295":[2,1,0,0],"203423871":[1,1,1,0],"204472447":[3,2,1,0],"205521023":[1,1,0,0],"206569599":[2,1,1,0],"202375296":[0,0,0,0],"203423872":[0,0,0,0],"204472448":[0,0,0,0],"205521024":[0,0,0,0],"206569600":[0,0,0,0],"202375297":[1,1,0,0],"203423873":[3,0,0,0],"204472449":[2,0,0,0],"205521025":[1,1,0,0],"206569601":[2,1,0,0],"202375298":[0,0,0,0],"203423874":[0,0,0,0],"204472450":[0,0,0,0],"205521026":[0,0,0,0],"206569602":[0,0,0,0],"202375299":[2,0,0,0],"203423875":[1,1,0,0],"204472451":[1,0,0,0],"205521027":[2,1,1,0],"206569603":[2,0,0,0],"202375300":[2,0,0,0],"203423876":[1,1,0,0],"204472452":[2,2,0,0],"205521028":[2,2,0,0],"206569604":[3,0,0,0],"205521029":[3,2,1,0],"206569605":[3,0,0,0],"202375302":[0,0,0,0],"202375303":[0,0,0,0],"206569608":[3,0,0,0],"202375305":[0,0,0,0],"202375306":[0,0,0,0],"202375307":[2,0,0,0],"202375308":[2,2,0,0],"202375309":[0,0,0,0],"202375310":[0,0,0,0],"203423886":[0,0,0,0],"204472462":[0,0,0,0],"205521038":[0,0,0,0],"206569614":[0,0,0,0],"202375311":[2,0,0,0],"203423887":[2,0,0,0],"204472463":[2,0,0,0],"205521039":[3,0,0,0],"206569615":[1,1,0,0],"202375312":[0,0,0,0],"203423888":[0,0,0,0],"204472464":[0,0,0,0],"205521040":[0,0,0,0],"206569616":[0,0,0,0],"202375313":[3,0,0,0],"203423889":[1,1,0,0],"204472465":[2,1,0,0],"205521041":[2,0,0,0],"206569617":[1,1,0,0],"202375314":[0,0,0,0],"203423890":[0,0,0,0],"204472466":[0,0,0,0],"205521042":[0,0,0,0],"206569618":[0,0,0,0],"202375315":[1,0,0,0],"203423891":[1,0,0,0],"204472467":[1,1,0,0],"205521043":[2,1,0,0],"206569619":[2,0,0,0],"202375316":[0,0,0,0],"203423892":[0,0,0,0],"204472468":[0,0,0,0],"205521044":[0,0,0,0],"206569620":[0,0,0,0],"202375317":[2,1,0,0],"203423893":[1,0,0,0],"204472469":[2,0,0,0],"205521045":[2,1,0,0],"206569621":[3,1,1,0],"202375318":[0,0,0,0],"203423894":[0,0,0,0],"204472470":[0,0,0,0],"205521046":[0,0,0,0],"206569622":[0,0,0,0],"202375319":[0,0,0,0],"202375320":[3,2,0,0],"202375321":[3,1,0,0],"203423897":[1,0,0,0],"204472473":[3,1,0,0],"205521049":[3,1,0,0],"206569625":[1,1,1,0],"202375340":[0,0,0,0],"203423916":[0,0,0,0],"204472492":[0,0,0,0],"205521068":[0,0,0,0],"206569644":[0,0,0,0],"202375358":[0,0,0,0],"203423934":[0,0,0,0],"204472510":[0,0,0,0],"205521086":[0,0,0,0],"206569662":[0,0,0,0],"202375336":[2,1,0,0],"203423912":[2,0,0,0],"204472488":[1,0,0,0],"205521064":[3,1,0,0],"206569640":[2,1,0,0],"202375468":[2,0,0,1],"203424044":[1,1,0,1],"204472620":[1,0,0,1],"205521196":[4,1,0,1],"206569772":[2,0,0,1],"202375469":[4,1,0,1],"203424045":[4,0,0,1],"204472621":[4,1,0,1],"205521197":[2,1,0,1],"206569773":[4,1,0,1],"202375470":[4,0,0,1],"203424046":[4,0,0,1],"204472622":[4,1,0,1],"205521198":[1,1,1,1],"206569774":[1,1,1,1],"202375471":[2,0,0,1],"203424047":[1,0,0,1],"204472623":[2,0,0,1],"205521199":[1,1,0,1],"206569775":[2,0,0,1],"202375473":[4,0,0,1],"203424049":[3,0,0,1],"204472625":[2,1,0,1],"205521201":[3,1,0,1],"206569777":[4,0,0,1],"202375550":[4,0,0,1],"203424126":[3,0,0,1],"204472702":[1,1,0,1],"205521278":[2,1,0,1],"206569854":[2,0,0,1],"202375510":[4,0,0,1],"202375512":[2,0,0,1],"203424088":[4,1,0,1],"204472664":[2,2,0,1],"205521240":[4,0,0,1],"206569816":[4,0,0,1],"202375515":[3,0,0,1],"203424093":[4,2,0,1],"205521245":[4,1,0,1],"206569821":[4,1,0,1],"202375514":[4,1,0,1],"203424090":[3,1,0,1],"204472666":[4,0,0,1],"205521242":[3,1,0,1],"206569818":[4,1,0,1],"202375577":[3,0,0,1],"203424153":[4,0,0,1],"204472729":[4,2,0,1],"205521305":[4,0,0,1],"206569881":[2,2,0,1],"202375576":[4,0,0,1],"203424152":[4,1,0,1],"204472728":[3,0,0,1],"205521304":[4,1,0,1],"206569880":[4,0,0,1],"204472665":[1,1,0,1],"206569817":[2,1,0,1],"202375545":[3,1,0,1],"202375575":[4,1,0,1],"203424151":[4,1,0,1],"204472727":[3,1,0,1],"205521303":[4,0,0,1],"206569879":[3,2,0,1],"202375506":[1,1,0,1],"203424082":[1,0,0,1],"204472658":[1,1,0,1],"205521234":[1,1,0,1],"206569810":[1,1,0,1],"202375520":[4,1,0,1],"203424096":[4,0,0,1],"204472672":[4,1,0,1],"205521248":[3,0,0,1],"206569824":[2,1,0,1],"202375536":[1,1,0,1],"203424112":[2,1,0,1],"204472688":[2,1,0,1],"205521264":[4,1,0,1],"206569840":[3,0,0,1],"202375519":[1,0,0,1],"203424095":[4,0,0,1],"204472671":[4,0,0,1],"205521247":[1,0,0,1],"206569823":[4,0,0,1],"202375521":[1,1,1,1],"203424097":[4,0,0,1],"204472673":[1,1,0,1],"205521249":[2,1,0,1],"206569825":[3,2,1,1],"202375549":[3,0,0,1],"203424125":[1,1,0,1],"204472701":[2,1,0,1],"205521277":[2,0,0,1],"206569853":[3,0,0,1],"202375522":[1,1,1,1],"203424098":[2,0,0,1],"204472674":[1,1,1,1],"205521250":[2,0,0,1],"206569826":[1,0,0,1],"202375495":[2,0,0,1],"203424071":[1,1,0,1],"204472647":[2,1,1,1],"205521223":[4,1,0,1],"206569799":[1,1,0,1],"202375523":[2,1,0,1],"203424099":[4,0,0,1],"204472675":[2,2,1,1],"205521251":[2,0,0,1],"206569827":[3,0,0,1],"202375524":[4,1,0,1],"203424100":[4,0,0,1],"204472676":[2,1,0,1],"205521252":[3,0,0,1],"206569828":[2,1,0,1],"202375554":[1,0,0,1],"203424130":[1,0,0,1],"204472706":[2,0,0,1],"205521282":[2,2,0,1],"206569858":[4,0,0,1],"202375496":[1,0,0,1],"203424072":[2,0,0,1],"204472648":[1,1,0,1],"205521224":[2,0,0,1],"206569800":[4,0,0,1],"202375474":[4,1,0,2],"203424050":[3,1,0,2],"204472626":[4,2,0,2],"205521202":[3,0,0,2],"206569778":[1,1,0,2],"202375486":[4,0,0,2],"203424062":[3,0,0,2],"204472638":[4,1,1,2],"205521214":[1,0,0,2],"206569790":[2,0,0,2],"202375487":[4,0,0,2],"203424063":[3,0,0,2],"204472639":[4,1,1,2],"205521215":[1,0,0,2],"206569791":[2,0,0,2],"202375484":[3,1,1,2],"203424060":[2,1,0,2],"202375485":[4,2,0,2],"203424061":[3,1,0,2],"204472637":[2,1,0,2],"205521213":[4,2,0,2],"206569789":[4,1,0,2],"202375492":[2,1,0,2],"203424068":[1,1,0,2],"204472644":[1,1,0,2],"205521220":[4,1,0,2],"206569796":[1,1,0,2],"202375476":[4,2,0,2],"203424052":[4,1,0,2],"204472628":[4,2,0,2],"205521204":[4,2,0,2],"206569780":[4,1,0,2],"202375592":[2,0,0,2],"203424168":[4,0,0,2],"204472744":[4,0,0,2],"205521320":[4,0,0,2],"206569896":[3,0,0,2],"202375610":[1,0,0,3],"203424186":[1,1,0,3],"204472762":[2,1,0,3],"205521338":[3,0,0,3],"206569914":[3,1,0,3],"202375595":[2,0,0,2],"203424171":[1,0,0,2],"204472747":[1,1,1,2],"205521323":[2,1,0,2],"206569899":[2,0,0,2],"202375511":[3,2,0,2],"203424087":[4,1,0,2],"202375525":[4,0,0,2],"203424101":[1,1,1,2],"204472677":[4,1,0,2],"205521253":[4,1,1,2],"206569829":[2,1,0,2],"202375494":[2,1,0,2],"203424070":[4,0,0,2],"204472646":[4,0,0,2],"205521222":[1,1,0,2],"206569798":[2,1,1,2],"202375564":[3,2,0,2],"203424140":[4,1,1,2],"204472716":[2,1,0,2],"205521292":[1,0,0,2],"206569868":[4,1,0,2],"202375537":[4,0,0,2],"203424113":[2,0,0,2],"204472689":[3,0,0,2],"205521265":[4,2,0,2],"206569841":[2,1,1,2],"202375538":[2,1,0,2],"203424114":[1,1,1,2],"204472690":[3,2,1,2],"205521266":[1,1,0,2],"206569842":[4,1,1,2],"202375532":[2,1,0,2],"203424108":[1,1,0,2],"204472684":[2,1,0,2],"205521260":[4,0,0,2],"206569836":[3,0,0,2],"202375497":[2,2,0,2],"203424073":[3,1,1,2],"204472649":[2,0,0,2],"205521225":[4,0,0,2],"206569801":[4,1,0,2],"202375565":[2,2,0,3],"203424141":[4,0,0,3],"204472717":[4,1,0,3],"205521293":[4,2,0,3],"206569869":[4,1,0,3],"202375528":[4,1,0,2],"203424104":[4,1,1,2],"204472680":[2,1,0,2],"205521256":[2,0,0,2],"206569832":[4,0,0,2],"202375539":[1,1,0,2],"203424115":[4,0,0,2],"204472691":[3,0,0,2],"205521267":[4,1,0,2],"206569843":[2,1,0,2],"202375540":[3,0,0,2],"203424116":[1,1,0,2],"204472692":[1,0,0,2],"205521268":[4,1,1,2],"206569844":[3,0,0,2],"202375543":[4,0,0,3],"202375472":[2,1,0,3],"203424048":[1,0,0,3],"204472624":[3,1,1,3],"205521200":[2,0,0,3],"206569776":[2,0,0,3],"202375483":[3,1,0,3],"203424059":[3,2,1,3],"204472635":[2,1,0,3],"205521211":[4,0,0,3],"206569787":[4,1,0,3],"202375479":[3,2,0,3],"203424055":[4,1,0,3],"204472631":[4,1,1,3],"205521207":[4,0,0,3],"206569783":[2,2,0,3],"202375480":[3,2,0,3],"203424056":[4,1,0,3],"204472632":[4,1,1,3],"205521208":[4,0,0,3],"206569784":[2,2,0,3],"202375478":[3,0,0,3],"203424054":[2,0,0,3],"204472630":[2,0,0,3],"205521206":[2,1,0,3],"206569782":[2,1,0,3],"202375477":[2,2,0,3],"203424053":[2,1,0,3],"204472629":[2,2,0,3],"205521205":[3,2,0,3],"206569781":[1,1,0,3],"202375481":[2,0,0,3],"203424057":[1,1,0,3],"204472633":[3,0,0,3],"205521209":[4,0,0,3],"206569785":[2,1,0,3],"202375482":[2,0,0,3],"203424058":[1,1,0,3],"204472634":[3,0,0,3],"205521210":[4,0,0,3],"206569786":[2,1,0,3],"202375611":[3,0,0,3],"203424187":[0,0,0,3],"204472763":[1,0,0,3],"205521339":[2,0,0,3],"206569915":[0,0,0,3],"202375580":[3,0,0,3],"203424156":[4,0,0,3],"204472732":[2,1,0,3],"205521308":[4,1,0,3],"206569884":[4,0,0,3],"202375581":[3,0,0,3],"203424157":[4,0,0,3],"204472733":[2,1,0,3],"205521309":[4,1,0,3],"206569885":[4,0,0,3],"202375593":[3,0,0,3],"203424169":[4,1,0,3],"204472745":[2,2,1,3],"205521321":[4,1,1,3],"206569897":[2,1,0,3],"202375552":[3,2,0,3],"203424128":[3,2,0,3],"204472704":[3,3,0,3],"205521280":[3,1,0,3],"206569856":[2,2,1,3],"202375527":[1,1,0,3],"203424103":[2,2,1,3],"204472679":[2,1,0,3],"205521255":[1,0,0,3],"206569831":[4,1,0,3],"202375548":[2,0,0,3],"203424124":[2,0,0,3],"204472700":[2,0,0,3],"205521276":[4,0,0,3],"206569852":[2,1,0,3],"202375526":[3,0,0,3],"203424102":[3,1,0,3],"204472678":[2,1,0,3],"205521254":[2,0,0,3],"206569830":[1,0,0,3],"202375500":[2,1,0,3],"203424076":[2,1,0,3],"204472652":[4,0,0,3],"205521228":[2,1,1,3],"206569804":[3,0,0,3],"202375572":[4,1,0,3],"203424148":[4,1,1,3],"204472724":[2,2,1,3],"205521300":[3,2,0,3],"206569876":[2,2,1,3],"202375555":[2,2,0,3],"203424131":[2,0,0,3],"204472707":[2,0,0,3],"205521283":[1,0,0,3],"206569859":[1,0,0,3],"202375501":[2,2,0,3],"203424077":[4,0,0,3],"204472653":[4,1,0,3],"205521229":[4,1,0,3],"206569805":[4,2,0,3],"202375568":[3,0,0,4],"203424144":[4,1,0,4],"204472720":[3,0,0,4],"205521296":[3,3,0,4],"206569872":[3,3,0,4],"202375498":[3,1,0,3],"203424074":[3,1,0,3],"204472650":[4,0,0,3],"205521226":[2,2,0,3],"206569802":[1,1,0,3],"202375499":[3,1,0,3],"203424075":[3,1,0,3],"204472651":[4,0,0,3],"205521227":[2,2,0,3],"206569803":[1,1,0,3],"202375566":[4,1,0,4],"203424142":[2,2,1,4],"204472718":[4,0,0,4],"205521294":[3,0,0,4],"206569870":[4,2,1,4],"202375567":[4,1,0,4],"203424143":[2,2,1,4],"204472719":[4,0,0,4],"205521295":[3,0,0,4],"206569871":[4,2,1,4],"202375488":[2,0,0,4],"203424064":[2,1,0,4],"204472640":[4,0,0,4],"205521216":[4,0,0,4],"206569792":[2,0,0,4],"202375489":[1,0,0,4],"203424065":[1,0,0,4],"204472641":[2,0,0,4],"205521217":[2,0,0,4],"206569793":[1,1,1,4],"202375490":[1,0,0,4],"203424066":[1,0,0,4],"204472642":[2,0,0,4],"205521218":[2,0,0,4],"206569794":[1,1,1,4],"202375491":[2,0,0,4],"203424067":[2,1,0,4],"204472643":[4,0,0,4],"205521219":[4,0,0,4],"206569795":[2,0,0,4],"205521270":[3,2,1,4],"206569846":[4,0,0,4],"203424094":[2,1,1,4],"205521246":[3,0,0,4],"202375516":[4,2,1,4],"203424092":[3,1,1,4],"204472668":[4,1,1,4],"205521244":[2,2,0,4],"206569820":[4,1,0,4],"202375551":[2,1,0,4],"203424127":[2,0,0,4],"204472703":[4,1,1,4],"205521279":[4,1,0,4],"206569855":[3,1,1,4],"202375529":[4,0,0,4],"203424105":[3,0,0,4],"204472681":[2,0,0,4],"205521257":[2,0,0,4],"206569833":[1,1,0,4],"202375533":[3,0,0,4],"203424109":[1,1,1,4],"204472685":[2,0,0,4],"205521261":[3,1,0,4],"206569837":[1,0,0,4],"202375530":[4,1,0,4],"203424106":[2,1,0,4],"204472682":[4,0,0,4],"205521258":[2,1,0,4],"206569834":[3,0,0,4],"202375531":[3,0,0,4],"203424107":[3,0,0,4],"204472683":[2,1,0,4],"205521259":[4,1,0,4],"206569835":[3,0,0,4],"202375557":[2,2,0,4],"203424133":[2,1,0,4],"204472709":[4,0,0,4],"205521285":[4,2,0,4],"206569861":[1,1,1,4],"202375560":[3,0,0,4],"203424136":[3,0,0,4],"204472712":[0,0,0,4],"205521288":[4,1,1,4],"206569864":[4,0,0,4],"202375561":[4,2,1,4],"203424137":[3,1,0,4],"204472713":[4,1,0,4],"205521289":[2,1,0,4],"206569865":[1,1,0,4],"202375571":[2,2,0,4],"203424147":[4,0,0,4],"204472723":[2,1,0,4],"205521299":[4,0,0,4],"206569875":[2,1,1,4],"202375574":[2,2,0,4],"203424150":[4,0,0,4],"204472726":[4,0,0,4],"205521302":[3,1,0,4],"206569878":[4,1,0,4],"202375609":[2,0,0,4],"203424185":[1,1,0,4],"204472761":[2,0,0,4],"205521337":[0,0,0,4],"206569913":[1,0,0,4],"202375583":[1,0,0,4],"203424159":[2,1,0,4],"204472735":[2,0,0,4],"205521311":[1,1,1,4],"206569887":[2,1,0,4],"202375584":[1,0,0,4],"203424160":[2,1,0,4],"204472736":[2,0,0,4],"205521312":[1,1,1,4],"206569888":[2,1,0,4],"202375624":[1,0,0,4],"203424200":[2,1,0,4],"204472776":[3,0,0,4],"205521352":[3,0,0,4],"206569928":[4,0,0,4],"202375590":[3,0,0,4],"203424166":[2,2,1,4],"204472742":[2,1,1,4],"205521318":[2,1,1,4],"206569894":[3,0,0,4],"202375591":[2,0,0,4],"203424167":[4,1,0,4],"204472743":[1,1,1,4],"205521319":[3,0,0,4],"206569895":[2,0,0,4],"202375534":[4,1,0,5],"203424110":[3,0,0,5],"204472686":[4,1,0,5],"205521262":[4,0,0,5],"206569838":[1,1,1,5],"202375541":[3,0,0,5],"203424117":[1,1,0,5],"204472693":[2,2,0,5],"205521269":[2,2,0,5],"206569845":[3,0,0,5],"202375475":[1,0,0,5],"203424051":[2,1,0,5],"204472627":[2,1,0,5],"205521203":[2,0,0,5],"206569779":[3,0,0,5],"202375507":[4,0,0,5],"203424083":[2,2,0,5],"204472659":[1,0,0,5],"205521235":[2,0,0,5],"206569811":[4,1,0,5],"202375508":[4,0,0,5],"203424084":[2,1,1,5],"204472660":[2,2,0,5],"205521236":[1,1,1,5],"206569812":[2,0,0,5],"202375509":[1,1,1,5],"203424085":[1,1,0,5],"204472661":[3,0,0,5],"205521237":[3,0,0,5],"206569813":[2,1,0,5],"202375558":[3,0,0,5],"203424134":[2,0,0,5],"204472710":[4,0,0,5],"205521286":[4,0,0,5],"206569862":[3,2,0,5],"202375559":[3,0,0,5],"203424135":[2,0,0,5],"204472711":[4,0,0,5],"205521287":[4,0,0,5],"206569863":[3,2,0,5],"202375570":[2,2,0,5],"203424146":[2,1,0,5],"204472722":[4,0,0,5],"205521298":[1,1,0,5],"206569874":[4,1,1,5],"202375578":[1,1,1,5],"203424154":[1,1,0,5],"204472730":[2,2,1,5],"205521306":[2,2,1,5],"206569882":[4,1,0,5],"202375579":[1,1,1,5],"203424155":[1,1,0,5],"204472731":[2,2,1,5],"205521307":[2,2,1,5],"206569883":[4,1,0,5],"202375585":[4,0,0,5],"203424161":[2,2,1,5],"204472737":[2,2,1,5],"205521313":[3,1,1,5],"206569889":[2,0,0,5],"202375586":[4,0,0,5],"203424162":[2,2,0,5],"204472738":[1,1,1,5],"205521314":[3,1,0,5],"206569890":[4,0,0,5],"202375493":[4,1,0,5],"203424069":[2,2,0,5],"204472645":[3,1,0,5],"205521221":[3,1,0,5],"206569797":[4,1,0,5],"202375582":[4,2,1,5],"203424158":[1,1,0,5],"204472734":[3,0,0,5],"205521310":[3,0,0,5],"206569886":[3,0,0,5],"202375573":[4,2,0,6],"203424149":[3,2,0,6],"204472725":[4,0,0,6],"205521301":[4,0,0,6],"206569877":[3,2,2,6],"202375502":[2,0,0,13],"203424078":[2,0,0,13],"204472654":[2,0,0,13],"205521230":[2,0,0,13],"206569806":[2,0,0,13],"202375504":[2,0,0,13],"203424080":[2,0,0,13],"204472656":[2,0,0,13],"205521232":[2,0,0,13],"206569808":[2,0,0,13],"202375535":[4,1,1,6],"203424111":[4,1,0,6],"204472687":[4,0,0,6],"205521263":[2,1,0,6],"206569839":[3,1,0,6],"202375556":[1,1,1,6],"203424132":[3,0,0,6],"204472708":[4,0,0,6],"205521284":[3,0,0,6],"206569860":[4,0,0,6],"202375563":[3,0,0,6],"203424139":[4,1,0,6],"204472715":[3,2,0,6],"205521291":[4,2,1,6],"206569867":[4,0,0,6],"202375587":[2,0,0,6],"203424163":[3,3,0,6],"204472739":[4,1,0,6],"205521315":[4,0,0,6],"206569891":[2,2,0,6],"202375588":[2,0,0,6],"203424164":[3,3,0,6],"204472740":[4,1,0,6],"205521316":[4,0,0,6],"206569892":[2,2,0,6],"202375627":[4,0,0,6],"202375628":[2,0,0,6],"202375594":[3,0,0,6],"203424170":[4,0,0,6],"204472746":[4,0,0,6],"205521322":[3,1,0,6],"206569898":[3,0,0,6],"202375625":[0,0,0,0],"203424201":[1,0,0,0],"204472777":[0,0,0,0],"205521353":[2,0,0,0],"206569929":[0,0,0,0],"202375569":[3,2,0,6],"203424145":[3,0,0,6],"204472721":[3,1,0,6],"205521297":[2,1,1,6],"206569873":[2,2,0,6],"202375597":[2,2,0,6],"203424173":[3,2,0,6],"204472749":[4,2,1,6],"205521325":[3,2,0,6],"206569901":[4,2,0,6],"202375596":[4,1,1,6],"203424172":[4,3,1,6],"204472748":[4,1,1,6],"205521324":[2,1,1,6],"206569900":[2,2,1,6],"202375599":[3,1,1,6],"203424175":[3,1,0,6],"204472751":[2,2,0,6],"205521327":[3,1,1,6],"206569903":[3,0,0,6],"202375562":[4,1,1,6],"203424138":[3,2,1,6],"204472714":[2,2,2,6],"205521290":[2,2,1,6],"206569866":[4,0,0,6],"202375598":[3,2,0,6],"203424174":[2,2,0,6],"204472750":[4,2,0,6],"205521326":[4,1,1,6],"206569902":[4,1,0,6],"202375659":[4,2,0,6],"203424235":[4,0,0,6],"204472811":[4,2,1,6],"205521387":[4,4,0,6],"206569963":[4,1,1,6],"202375662":[4,2,0,6],"203424238":[3,1,0,6],"204472814":[3,0,0,6],"205521390":[3,1,1,6],"206569966":[3,0,0,6],"202375663":[4,2,0,6],"203424239":[3,1,0,6],"204472815":[3,0,0,6],"205521391":[3,1,1,6],"206569967":[3,0,0,6],"202375660":[3,2,1,6],"203424236":[3,2,1,6],"204472812":[4,2,0,6],"205521388":[3,1,0,6],"206569964":[4,4,0,6],"202375661":[3,2,0,6],"203424237":[2,2,0,6],"204472813":[4,4,0,6],"205521389":[4,3,0,6],"206569965":[4,1,1,6],"202375666":[3,1,0,6],"203424242":[4,2,1,6],"204472818":[3,2,1,6],"205521394":[3,3,2,6],"206569970":[4,1,0,6],"202375667":[4,2,0,6],"203424243":[4,4,0,6],"204472819":[4,1,1,6],"205521395":[4,1,1,6],"206569971":[4,3,0,6],"202375668":[4,3,0,6],"203424244":[4,4,1,6],"204472820":[4,4,1,6],"205521396":[4,3,0,6],"206569972":[4,4,0,6],"202375669":[4,4,0,6],"203424245":[3,1,1,6],"204472821":[3,1,0,6],"205521397":[4,2,0,6],"206569973":[4,3,1,6],"202375674":[4,4,0,6],"203424250":[3,1,1,6],"204472826":[3,1,0,6],"205521402":[4,2,0,6],"206569978":[4,3,1,6],"203424248":[4,1,0,5],"204472824":[3,2,1,5],"205521400":[3,2,0,5],"206569976":[4,1,0,5],"202375670":[4,4,0,6],"203424246":[4,4,2,6],"204472822":[4,4,2,6],"205521398":[4,4,2,6],"206569974":[4,4,0,6]},"slotAtoms":{"1":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"2":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"3":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"4":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"5":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"6":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"7":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"8":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"9":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"10":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"11":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"12":{"139":{"0":1},"140":{"0":2},"141":{"0":3}},"13":{"139":{"0":1},"140":{"0":2},"141":{"0":3}}},"decoSlots":{"12":2,"22":3,"84":3,"108":3,"94":3,"55":3,"24":2,"23":2,"50":3,"49":3,"48":3,"25":2,"21":2,"20":2,"19":2,"9":2,"5":2,"4":2,"3":2,"2":2,"8":2,"7":2,"51":3,"37":3,"87":3,"38":3,"27":2,"11":2,"45":2,"32":2,"30":2,"26":2,"91":2,"47":2,"46":2,"36":2,"35":2,"34":2,"31":2,"10":2,"1":2,"6":2,"107":2,"53":1,"28":2,"52":1,"76":1,"63":2,"61":3,"106":2,"64":2,"54":1,"39":2,"66":2,"65":2,"93":1,"40":2,"62":1,"41":2,"89":2,"81":2,"72":2,"60":2,"57":2,"105":2,"104":2,"85":1,"88":2,"59":1,"58":2,"44":1,"42":1,"33":2,"18":1,"43":1,"86":1,"13":1,"14":1,"16":1,"15":1,"17":1,"56":1,"95":1,"99":2,"96":1,"90":1,"77":1,"98":1,"97":1,"92":2,"80":1,"79":1,"78":1,"75":1,"74":1,"73":1,"67":1,"68":1,"70":1,"69":1,"71":1,"110":4,"111":4,"112":4,"113":4,"114":4,"119":4,"120":4,"121":4,"122":4,"123":4,"124":4,"125":2,"126":3,"128":2,"129":3,"131":2,"132":3,"134":2,"135":3,"137":2,"138":3,"140":2,"141":3,"142":4,"143":4,"144":4,"145":4,"146":4,"147":4,"148":4,"150":4,"151":4,"152":4,"153":4,"155":3,"156":4,"157":4,"160":4,"161":4,"162":4,"163":4,"164":4,"165":4,"169":4,"170":3,"171":4,"172":4,"174":4,"175":4,"176":4,"179":4,"180":4,"181":4,"185":4,"188":4,"189":4,"192":4,"205":4,"207":4,"221":3,"215":2,"218":3,"216":1,"223":4,"224":4,"159":4,"186":4,"191":4,"190":4,"187":4,"213":2,"158":4,"197":4,"225":1,"154":4,"166":4,"201":4,"149":4,"183":4,"210":3,"115":4,"116":4,"117":4,"118":4,"208":4,"212":1,"211":3,"214":2,"199":4,"200":4,"193":4,"219":2,"173":4,"217":2,"238":4,"239":1,"202":4,"203":4,"194":4,"206":4,"139":4,"136":4,"133":4,"130":4,"127":4,"246":4,"245":1,"198":4,"244":1,"209":4,"243":4,"240":4,"226":2,"228":2,"227":2,"177":4,"241":4,"242":3,"231":2,"196":4,"247":4,"248":4,"232":1,"249":4,"251":4,"252":4,"250":4,"230":3,"182":4,"253":4,"259":1,"261":4,"195":4,"178":4,"254":4,"255":4,"256":3,"257":4,"168":4,"167":4,"260":1,"258":4,"184":4},"names":{"135266304":"破坏者大剑Ⅰ","135266305":"破坏者大刀","135266306":"铁剑Ⅰ","135266307":"钢剑","135266308":"怪力坏剑Ⅰ","135266309":"怪力坏剑Ⅱ","135266310":"巨力坏剑","135266311":"铬金咬剃刀Ⅰ","135266312":"铬金死亡剃刀","135266313":"骨刃Ⅰ","135266314":"斩骨大剑","135266315":"龙颚Ⅰ","135266316":"巨颚","135266317":"龙牙剑Ⅰ","135266318":"亢龙牙剑","135266319":"巨骨剑Ⅰ","135266320":"刚剑塔罗斯","135266321":"灼炎大刀Ⅰ","135266322":"灼炎大刀Ⅱ","135266323":"深红角龙大刀","135266324":"炎火铁大剑Ⅰ","135266325":"炎火铁大剑Ⅱ","135266326":"炎火铁大剑Ⅲ","135266327":"炎火铁大剑Ⅳ","135266328":"炎火铁大剑Ⅴ","135266329":"炎火忍大剑","135266330":"百龙大剑Ⅰ","135266331":"百龙大剑Ⅱ","135266332":"百龙大剑Ⅲ","135266333":"百龙大剑【大贤虎变】","135266334":"冷冻旗鱼Ⅰ","135266335":"冷冻旗鱼Ⅱ","135266336":"冷冻黑旗鱼大剑","135266337":"忍伞【吞龙】Ⅰ","135266338":"忍伞【吞龙】Ⅱ","135266339":"忍伞【屠龙】","135266340":"猫魂Ⅰ","135266341":"猫魂Ⅱ","135266342":"猫之咒怨","135266343":"龙之栖所Ⅰ","135266344":"龙之栖所Ⅱ","135266345":"毒断群居菌菇","135266346":"让人沉眠的贝大剑Ⅰ","135266347":"让人沉眠的贝大剑Ⅱ","135266348":"睡贝大剑珠母贝","135266349":"镰鼬风剑Ⅰ","135266350":"镰鼬风剑Ⅱ","135266351":"镰鼬暴风剑","135266352":"伞巨刃Ⅰ","135266353":"伞巨刃Ⅱ","135266354":"晓之大剑刃骑","135266355":"伏身撞Ⅰ","135266356":"伏身撞Ⅱ","135266357":"蛙式・伏身撞","135266358":"人鱼出鞘Ⅰ","135266359":"人鱼出鞘Ⅱ","135266360":"梦幻人鱼出鞘","135266361":"祸大剑【封】Ⅰ","135266362":"祸大剑【封】Ⅱ","135266363":"祸大剑【幽鬼无道】","135266364":"雪鬼兽嗖Ⅰ","135266365":"雪鬼兽嗖Ⅱ","135266366":"雪鬼兽嗖！","135266367":"苍风神大剑Ⅰ","135266368":"苍风神大剑Ⅱ","135266369":"神渊之风【断】","135266370":"鸣雷神大剑Ⅰ","135266371":"神源之雷【断】","135266372":"赫翼大剑Ⅰ","135266373":"龙天赤大剑【哈雷】","135266374":"白兔裹雪剑Ⅰ","135266375":"白兔裹雪剑Ⅱ","135266376":"白兔大剑夏洛特","135266377":"暴雨大剑Ⅰ","135266378":"暴雨大剑Ⅱ","135266379":"暴雨巨刃","135266380":"土砂大剑Ⅰ","135266381":"土砂大剑Ⅱ","135266382":"土砂巨剑","135266383":"奇怪龙大剑Ⅰ","135266384":"奇怪龙大剑Ⅱ","135266385":"奇怪龙长剑","135266386":"蛇剑【毒蛾】Ⅰ","135266387":"蛇剑【毒蛾】Ⅱ","135266388":"蛇剑【毒蛇】","135266389":"避役大剑Ⅰ","135266390":"避役大剑Ⅱ","135266391":"毒妖喉剑","135266392":"泥磨巨刃Ⅰ","135266393":"泥磨巨刃Ⅱ","135266394":"沼泽巨刃","135266395":"女武神骨剑Ⅰ","135266396":"女武神骨剑Ⅱ","135266397":"齐格琳德王后","135266398":"冰凌白牙Ⅰ","135266399":"冰凌白牙Ⅱ","135266400":"断海冰牙","135266401":"炎羽大剑Ⅰ","135266402":"炎羽大剑Ⅱ","135266403":"蛮颚炎羽大剑","135266404":"隐秘斩切刀Ⅰ","135266405":"隐秘斩切刀Ⅱ","135266406":"暗夜剑【宵暗】","135266407":"狐大剑【夜宿樱花树】Ⅰ","135266408":"狐大剑【夜宿樱花树】Ⅱ","135266409":"茜霞紫剑之朝斩","135266410":"赤翼Ⅰ","135266411":"赤翼Ⅱ","135266412":"火龙大剑","135266413":"王大剑风雷Ⅰ","135266414":"王大剑风雷Ⅱ","135266415":"王牙大剑【黑雷】","135266416":"轰龙颚Ⅰ","135266417":"轰龙颚Ⅱ","135266418":"轰大剑【王虎】","135266419":"争执角Ⅰ","135266420":"争执角Ⅱ","135266421":"争斗角","135266422":"钢冰大剑Ⅰ","135266423":"钢龙冻大剑","135266424":"炎王之刃Ⅰ","135266425":"炎皇之刃","135266426":"狮尾毒弯刀Ⅰ","135266427":"友邻狮尾刀","135266428":"鬼金棒Ⅰ","135266429":"鬼金棒Ⅱ","135266430":"大鬼金棒","135266431":"狗龙大剑Ⅰ","135266432":"狗龙大剑Ⅱ","135266433":"野蛮大剑","135266434":"百龙大剑Ⅳ","135266435":"百龙大剑Ⅴ","135266436":"村卫用防卫大剑Ⅰ","135266437":"村卫用坚守大剑","135266604":"炎火武大剑","135266605":"炎火武大剑・改","135266606":"炎火杰大剑","135266607":"雪鬼兽嗖嗖嗖","135266608":"雪鬼兽嗖嗖嗖・改","135266609":"雪鬼兽！嗖嗖嗖嗖！","135266610":"茜霞紫剑之朝斩・改","135266611":"茜霞紫微两断剑","135266612":"茜霞紫微两断剑・改","135266613":"辟邪之剑【大紫蛱蝶】","135266617":"土砂破坏者","135266618":"土砂破坏者・改","135266619":"土砂巨力","135266620":"轰大剑【王虎】改","135266621":"轰大剑【大王虎】","135266622":"轰大剑【大王虎】改","135266623":"奇怪龙长剑・改","135266624":"奇怪龙雷电巨剑","135266625":"奇怪龙雷电巨剑・改","135266626":"镰鼬暴风剑・改","135266627":"飓风大剑","135266628":"蛇剑【毒蛇】改","135266629":"咬剑【大蛇头】","135266630":"暗夜剑【晦暝】","135266631":"暗夜剑【晦暝】改","135266632":"无明大剑【苦谛】","135266633":"梦幻人鱼出鞘・改","135266634":"梦魇大剑人鱼出鞘","135266635":"梦魇大剑人鱼出鞘・改","135266636":"冰花雪人鱼剑","135266637":"冰花雪人鱼剑・改","135266638":"极光雪剑雪人鱼","135266639":"铬金地狱薙刀","135266640":"铬金地狱薙刀・改","135266641":"铬金天堂薙刀","135266642":"啼剑电龙","135266643":"啼剑电龙・改","135266644":"霆剑电龙","135266645":"炼狱角龙大刀","135266646":"炼狱角龙大刀・改","135266647":"深红角龙之血","135266648":"毒妖喉剑・改","135266649":"毒妖大剑地狱变色龙","135266650":"毒妖大剑地狱变色龙・改","135266651":"冻结冰牙","135266652":"冻结冰牙・改","135266653":"暴雪巨牙","135266654":"冷月断剑","135266655":"冷月断剑・改","135266656":"冰镜圆月断","135266657":"晓月大剑骁勇","135266658":"晓月大剑骁勇・改","135266659":"晓光大剑荣光","135266660":"蛙式・伏身撞改","135266661":"真蛙式・伏身撞","135266662":"真蛙式・伏身撞改","135266663":"亢龙牙剑・改","135266664":"光龙颚剑","135266665":"光龙颚剑・改","135266666":"赤钳剑","135266667":"赤钳剑・改","135266668":"大钳剑","135266669":"将军镰蟹之刃","135266670":"将军镰蟹之刃・改","135266671":"切割之刃","135266672":"刚剑塔罗斯・改","135266673":"刚断剑深渊","135266674":"刚断剑深渊・改","135266675":"大剑参宿七","135266676":"大剑参宿七・改","135266677":"叛断刀参宿七","135266678":"齐格琳德王后・改","135266679":"高贵齐格琳德王后","135266680":"高贵齐格琳德王后・改","135266681":"蔷薇刺板","135266682":"蔷薇刺板・改","135266683":"蔷薇威力","135266684":"沼泽巨刃・改","135266685":"泥沼之鳞","135266686":"泥沼之鳞・改","135266687":"火龙大剑・改","135266688":"吼剑火龙","135266689":"争斗角・改","135266690":"刚角剑角龙","135266691":"刚角剑角龙・改","135266692":"野蛮大剑・改","135266693":"阿瓦隆大剑","135266694":"蛮颚炎羽大剑・改","135266695":"兵器蛮炎大剑","135266696":"兵器蛮炎大剑・改","135266697":"王牙大剑【黑雷】改","135266698":"真・王牙大剑【一天】","135266699":"暴雨巨刃・改","135266700":"暴雨水兽斩刃","135266701":"暴雨水兽斩刃・改","135266702":"刚缠大剑","135266703":"刚缠大剑・改","135266704":"巨块大剑癸干忒斯","135266705":"白兔大剑夏洛特・改","135266706":"白兔断雪夏洛特","135266707":"祸大剑【幽鬼无道】改","135266708":"祸名品【大幽鬼无道】","135266709":"铠怨鬼大剑【怨无道】","135266710":"大鬼金棒・改","135266711":"大鬼金棒【温罗】","135266712":"神断・风云外天","135266714":"神断・雷祸外天","135266716":"钢龙冻大剑・改","135266717":"钢龙寒冰大剑","135266718":"炎皇之刃・改","135266719":"炎王灵刃","135266720":"友邻狮尾刀・改","135266721":"恐惧狮尾刀","135266722":"赤绝巨翼参宿星","135266723":"自尊of黑影","135266724":"自尊of黑影・改","135266725":"自尊of灭亡","135266726":"THE启示","135266727":"THE起源","135266728":"冥渊大剑【劫火】","135266729":"鬼神金棒【猿魔王】","135266730":"毒断群居菌菇・改","135266731":"大毒断菌菇领主","135266732":"睡贝大剑珠母贝・改","135266733":"梦蜃大剑蝾螺贝","135266734":"冷冻黑旗鱼大剑・改","135266735":"瞬间冷冻黑旗鱼大剑","135266736":"忍伞【散龙】","135266737":"忍伞【散龙】改","135266738":"猫之咒怨・改","135266739":"众猫之王","135266740":"王国骑士大剑信念","135266742":"王国骑士大剑信念・改","135266743":"远古机械・大剑","135266744":"公爵巨剑","135266745":"断头斩剑","135266746":"仙人掌技艺","135266747":"辉剑火龙","135266749":"七星大剑【天璇】","135266759":"村卫用坚守大剑Ⅱ","135266760":"村卫用坚守大剑Ⅲ","135266761":"护村大剑・勇","135266766":"起源or结局","135266768":"冰翼灵羽","135266769":"凶剑【丛云】","135266770":"刻银断剑","136314880":"猎人匕首Ⅰ","136314881":"猎人匕首Ⅱ","136314882":"斗士之剑","136314883":"千年冰晶刃Ⅰ","136314884":"千年冰晶刃Ⅱ","136314885":"千年冰辉刃","136314886":"青年铁剑Ⅰ","136314887":"青年铁剑Ⅱ","136314888":"成才重铁剑","136314889":"忍者刀Ⅰ","136314890":"上位忍者刀","136314891":"奥德赛之刃Ⅰ","136314892":"奥德赛之刃Ⅱ","136314893":"大师奥德赛","136314894":"骨制反曲刀Ⅰ","136314895":"骨制反曲刀Ⅱ","136314896":"领袖反曲刀","136314897":"骨制巴龙刀Ⅰ","136314898":"骨制巴龙刀Ⅱ","136314899":"大地巴龙刀","136314900":"骨之战斧Ⅰ","136314901":"骨之战斧Ⅱ","136314902":"拉古德斯战斧","136314903":"炎火铁单刃Ⅰ","136314904":"炎火铁单刃Ⅱ","136314905":"炎火铁单刃Ⅲ","136314906":"炎火铁单刃Ⅳ","136314907":"炎火铁单刃Ⅴ","136314908":"炎火忍单刃","136314909":"百龙剑Ⅰ","136314910":"百龙剑Ⅱ","136314911":"百龙剑Ⅲ","136314912":"百龙剑【沧海桑田】","136314913":"猫？拳Ⅰ","136314914":"猫？拳Ⅱ","136314915":"喵喵棒","136314916":"让人沉眠的贝短剑Ⅰ","136314917":"让人沉眠的贝短剑Ⅱ","136314918":"睡贝剑蛤仔","136314919":"镰鼬风镰Ⅰ","136314920":"镰鼬风镰Ⅱ","136314921":"镰鼬暴风镰","136314922":"扫堂斩Ⅰ","136314923":"扫堂斩Ⅱ","136314924":"蛙式・扫堂斩","136314925":"天具・伏魔剑Ⅰ","136314926":"天具・伏魔剑Ⅱ","136314927":"大天具・伏剑不动","136314928":"祸剑【封】Ⅰ","136314929":"祸剑【封】Ⅱ","136314930":"祸剑【幽鬼无尽】","136314931":"雪鬼兽咻咻Ⅰ","136314932":"雪鬼兽咻咻Ⅱ","136314933":"雪鬼兽咻咻！","136314934":"苍风神剑Ⅰ","136314935":"苍风神剑Ⅱ","136314936":"神渊之风【裂】","136314937":"鸣雷神剑Ⅰ","136314938":"神源之雷【裂】","136314939":"赫翼快剑Ⅰ","136314940":"龙天赤剑【奥伯斯】","136314941":"突进盾剑Ⅰ","136314942":"突进盾剑Ⅱ","136314943":"猛突剑【野猪突进】","136314944":"斩杀零式Ⅰ","136314945":"斩杀壹式","136314946":"深红斩杀零式Ⅰ","136314947":"深红斩杀零式Ⅱ","136314948":"深红斩杀壹式","136314949":"铬黄斩杀零式Ⅰ","136314950":"铬黄斩杀壹式","136314951":"雪白斩杀零式Ⅰ","136314952":"雪白斩杀壹式","136314953":"碧绿斩杀零式Ⅰ","136314954":"碧绿斩杀壹式","136314955":"漆黑斩杀零式Ⅰ","136314956":"漆黑斩杀零式Ⅱ","136314957":"漆黑斩杀壹式","136314958":"眠龙匕首Ⅰ","136314959":"眠龙匕首Ⅱ","136314960":"眠龙鸟嘴刀","136314961":"士兵短剑Ⅰ","136314962":"士兵短剑Ⅱ","136314963":"指挥官短剑","136314964":"邪道爵剑Ⅰ","136314965":"邪道爵剑Ⅱ","136314966":"邪道速击","136314967":"水兽之爪Ⅰ","136314968":"水兽之爪Ⅱ","136314969":"水兽巨爪","136314970":"土砂短锤Ⅰ","136314971":"土砂短锤Ⅱ","136314972":"土砂冲击","136314973":"奇怪龙薙刀Ⅰ","136314974":"奇怪龙薙刀Ⅱ","136314975":"痛苦奇怪龙薙刀","136314976":"熔岩啄木鸟Ⅰ","136314977":"熔岩啄木鸟Ⅱ","136314978":"嘴剑巨喙","136314979":"避役单刀Ⅰ","136314980":"避役单刀Ⅱ","136314981":"毒妖喉单刀","136314982":"公主细剑Ⅰ","136314983":"公主细剑Ⅱ","136314984":"王后细剑","136314985":"冰凌利刃Ⅰ","136314986":"冰凌利刃Ⅱ","136314987":"冰牙锐爪","136314988":"炎羽短剑Ⅰ","136314989":"炎羽短剑Ⅱ","136314990":"蛮颚炎羽短剑","136314991":"隐秘刀刃Ⅰ","136314992":"隐秘刀刃Ⅱ","136314993":"暗夜剑【昏冥】","136314994":"狐扇【飞花实可叹】Ⅰ","136314995":"狐扇【飞花实可叹】Ⅱ","136314996":"鲜红彩扇之薄重","136314997":"灼焰锐剑Ⅰ","136314998":"灼焰锐剑Ⅱ","136314999":"炎灵之葵","136315000":"王剑疾雷Ⅰ","136315001":"王剑疾雷Ⅱ","136315002":"王牙剑【折雷】","136315003":"轰龙爪Ⅰ","136315004":"轰龙爪Ⅱ","136315005":"轰剑【虎眼】","136315006":"角龙棒Ⅰ","136315007":"角龙棒Ⅱ","136315008":"狼牙棒","136315009":"钢冰剑Ⅰ","136315010":"钢龙皇剑","136315011":"炎王斯帕达Ⅰ","136315012":"炎王纹章","136315013":"金兽棍Ⅰ","136315014":"金兽棍Ⅱ","136315015":"金兽棍【禁忌】","136315016":"百龙剑Ⅳ","136315017":"百龙剑Ⅴ","136315018":"村卫用防卫铁剑Ⅰ","136315019":"村卫用坚守铁剑","136315180":"炎火武单刃","136315181":"炎火武单刃・改","136315182":"炎火杰单刃","136315183":"暗夜剑【鸦羽】","136315184":"暗夜剑【鸦羽】改","136315185":"无明刃【道谛】","136315186":"鲜红彩扇之薄重・改","136315187":"鲜红色天熏风扇","136315188":"鲜红色天熏风扇・改","136315189":"辟邪之银扇【莎草眼蝶】","136315190":"护法具・伏剑不动","136315191":"护法具・伏剑不动改","136315192":"护法王・不动之天剑","136315193":"绯天具・伏剑不动","136315194":"绯天具・伏剑不动改","136315195":"绯天之剑・六仙不动","136315196":"王牙剑【折雷】改","136315197":"真・王牙剑【天赋】","136315198":"邪道速击・改","136315199":"卑鄙国君","136315200":"水兽巨爪・改","136315201":"水刻水兽之爪","136315202":"水刻水兽之爪・改","136315203":"刚缠之剑","136315204":"刚缠之剑・改","136315205":"巨块剑图尼伊特","136315206":"轰剑【虎眼】改","136315207":"轰剑【大虎眼】","136315208":"轰剑【大虎眼】改","136315209":"千年雪晶刃","136315210":"千年雪晶刃・改","136315211":"千年冰封辉刃","136315212":"冷月手斧","136315213":"冷月手斧・改","136315214":"冰镜圆月手斧","136315218":"萨格纳塔斯细剑","136315219":"萨格纳塔斯细剑・改","136315220":"电龙刺剑","136315221":"公爵短剑","136315222":"血宴烛","136315223":"指挥官短剑・改","136315224":"精英短剑","136315225":"俄瑞斯忒亚","136315226":"俄瑞斯忒亚・改","136315227":"阿伽门农","136315228":"毒妖喉单刀・改","136315229":"毒妖剑暑热变色龙","136315230":"毒妖剑暑热变色龙・改","136315231":"炎灵之葵・改","136315232":"进化炎灵","136315233":"冰牙冰锥","136315234":"冰牙冰锥・改","136315235":"极寒冰牙爪","136315236":"蛙式・扫堂斩改","136315237":"真蛙式・扫堂斩","136315238":"真蛙式・扫堂斩改","136315239":"痛苦奇怪龙薙刀・改","136315240":"受折磨奇怪龙薙刀","136315241":"受折磨奇怪龙薙刀・改","136315242":"眠龙鸟嘴刀・改","136315243":"沉眠幻梦境刀","136315244":"大地巴龙刀・改","136315245":"神兽巴隆刀","136315246":"神兽巴隆刀・改","136315247":"二重甲壳","136315248":"二重甲壳・改","136315249":"二重蟹钳","136315250":"王后细剑・改","136315251":"女王细剑","136315252":"女王细剑・改","136315253":"蔷薇短刀","136315254":"蔷薇短刀・改","136315255":"蔷薇旺盛","136315256":"拉古德斯战斧・改","136315257":"断骨战斧","136315258":"断骨战斧・改","136315259":"单手剑星宿一","136315260":"单手剑星宿一・改","136315261":"叛牙星宿一","136315262":"土砂全垒打","136315263":"土砂全垒打・改","136315264":"土砂削岩剑","136315265":"狼牙棒・改","136315266":"蛮人狰狞棒","136315267":"蛮人狰狞棒・改","136315268":"蛮颚炎羽短剑・改","136315269":"追寻者蛮炎剑","136315270":"追寻者蛮炎剑・改","136315271":"雪鬼兽咻咻咻","136315272":"雪鬼兽咻咻咻・改","136315273":"雪鬼兽！咻咻咻咻！","136315274":"镰鼬暴风镰・改","136315275":"飓风大镰","136315276":"嘴剑巨喙・改","136315277":"重嘴剑巨喙","136315278":"雪白斩杀贰式","136315279":"雪白斩杀叁式","136315280":"漆黑斩杀贰式","136315281":"漆黑斩杀叁式","136315282":"碧绿斩杀贰式","136315283":"碧绿斩杀叁式","136315284":"铬黄斩杀贰式","136315285":"铬黄斩杀叁式","136315286":"深红斩杀贰式","136315287":"深红斩杀叁式","136315288":"祸剑【幽鬼无尽】改","136315289":"祸名品【大幽鬼无尽】","136315290":"铠怨鬼剑【怨无尽】","136315291":"金兽棍【禁忌】改","136315292":"金兽棍【禁咒】","136315293":"神裂・风云无尽","136315295":"神裂・雷祸无尽","136315297":"钢龙皇剑・改","136315298":"钢龙精绝剑","136315299":"炎王纹章・改","136315300":"炎王德尔梅达利","136315301":"赤绝连翼十字二","136315302":"生命of检验者","136315303":"生命of检验者・改","136315304":"生命of搜寻者","136315305":"THE发现者","136315306":"THE夏洛克","136315307":"冥渊摇剑【热浪】","136315308":"鬼神激棍古兰伽","136315309":"睡贝剑蛤仔・改","136315310":"梦蜃剑帘蛤贝","136315311":"喵喵棒・改","136315312":"超级喵喵棒","136315313":"上位忍者刀・改","136315314":"大师忍者刀","136315315":"王国骑士剑高洁","136315317":"王国骑士剑高洁・改","136315318":"远古机械・单手剑","136315319":"仙人掌繁荣","136315320":"白金黎明","136315321":"疯狂玫瑰","136315323":"七星剑【天玑】","136315330":"村卫用坚守铁剑Ⅱ","136315331":"村卫用坚守铁剑Ⅲ","136315332":"护村铁剑・勇","136315337":"谎言or真实","136315339":"冰帝穹宫","136315340":"凶宝【翠岚】","136315341":"刻银碎剑","137363456":"铁锤Ⅰ","137363457":"鬼铁","137363458":"战锤Ⅰ","137363459":"战争权杖","137363460":"枪锤Ⅰ","137363461":"枪锤Ⅱ","137363462":"死亡左轮","137363463":"超级新星Ⅰ","137363464":"超级新星Ⅱ","137363465":"超新星","137363466":"冻结核心Ⅰ","137363467":"冻结核心Ⅱ","137363468":"恸泣冰河","137363469":"鬼铁丸Ⅰ","137363470":"鬼铁丸Ⅱ","137363471":"鬼铁之命","137363472":"战争印记Ⅰ","137363473":"战争狂击","137363474":"骨锤Ⅰ","137363475":"骨锤Ⅱ","137363476":"坚骨锤","137363477":"独眼巨人锤Ⅰ","137363478":"独眼巨人锤Ⅱ","137363479":"擎天神锤","137363480":"大骨锤Ⅰ","137363481":"大骨锤Ⅱ","137363482":"沉重岩骨锤","137363483":"炎火铁钩锤Ⅰ","137363484":"炎火铁钩锤Ⅱ","137363485":"炎火铁钩锤Ⅲ","137363486":"炎火铁钩锤Ⅳ","137363487":"炎火铁钩锤Ⅴ","137363488":"炎火忍钩锤","137363489":"百龙锤Ⅰ","137363490":"百龙锤Ⅱ","137363491":"百龙锤Ⅲ","137363492":"百龙锤【逝者如斯】","137363493":"晚安熊Ⅰ","137363494":"晚安熊Ⅱ","137363495":"熟睡熊","137363496":"不幸Ⅰ","137363497":"不幸Ⅱ","137363498":"不幸Ⅲ","137363499":"祸锤寄宿死亡","137363500":"南瓜王Ⅰ","137363501":"南瓜王Ⅱ","137363502":"灵锤南瓜王","137363503":"镰鼬风锤Ⅰ","137363504":"镰鼬风锤Ⅱ","137363505":"镰鼬暴风锤","137363506":"天具・五钴宝锤Ⅰ","137363507":"天具・五钴宝锤Ⅱ","137363508":"大天具・钴锤金刚","137363509":"人鱼怒击Ⅰ","137363510":"人鱼怒击Ⅱ","137363511":"梦幻人鱼怒击","137363512":"祸锤【封】Ⅰ","137363513":"祸锤【封】Ⅱ","137363514":"祸锤【幽鬼无恩】","137363515":"雪鬼兽啪叽Ⅰ","137363516":"雪鬼兽啪叽Ⅱ","137363517":"雪鬼兽啪叽Ⅲ","137363518":"雪鬼兽啪叽！","137363519":"泥＝醉Ⅰ","137363520":"泥＝醉Ⅱ","137363521":"黎＝明","137363522":"苍风神锤Ⅰ","137363523":"苍风神锤Ⅱ","137363524":"神渊之风【溃】","137363525":"鸣雷神锤Ⅰ","137363526":"神源之雷【溃】","137363527":"赫翼穿锤Ⅰ","137363528":"龙天赤锤【巴纳德】","137363529":"卵锤Ⅰ","137363530":"卵锤Ⅱ","137363531":"丸鸟卵锤","137363532":"青熊锤【壹型】Ⅰ","137363533":"青熊锤【壹型】Ⅱ","137363534":"青熊锤【贰型】","137363535":"毒狗龙蚀锤Ⅰ","137363536":"毒狗龙蚀锤Ⅱ","137363537":"邪道蚀锤","137363538":"喙锤Ⅰ","137363539":"喙锤Ⅱ","137363540":"鸟喙狂击","137363541":"水生兽皮大锤Ⅰ","137363542":"水生兽皮大锤Ⅱ","137363543":"水锤水精灵","137363544":"土砂大锤Ⅰ","137363545":"土砂大锤Ⅱ","137363546":"土砂会心","137363547":"奇怪龙袋锤Ⅰ","137363548":"奇怪龙袋锤Ⅱ","137363549":"奇怪龙雷锤","137363550":"灾厄之兆Ⅰ","137363551":"灾厄之兆Ⅱ","137363552":"六翼蛇锤厄客德娜","137363553":"束缚之力Ⅰ","137363554":"束缚之力Ⅱ","137363555":"迷惑甲锤","137363556":"避役大锤Ⅰ","137363557":"避役大锤Ⅱ","137363558":"毒妖喉锤","137363559":"岩龙打击锤Ⅰ","137363560":"岩龙打击锤Ⅱ","137363561":"岩龙猛击","137363562":"冰凌重击Ⅰ","137363563":"冰凌重击Ⅱ","137363564":"冰凌碎击","137363565":"炎羽锤Ⅰ","137363566":"炎羽锤Ⅱ","137363567":"蛮颚炎羽锤","137363568":"隐秘破击者Ⅰ","137363569":"隐秘破击者Ⅱ","137363570":"夜行锤【常暗】","137363571":"狐锤【玉落弃尘世】Ⅰ","137363572":"狐锤【玉落弃尘世】Ⅱ","137363573":"海波挠锤之华石","137363574":"赤色冲击Ⅰ","137363575":"赤色冲击Ⅱ","137363576":"火龙碎锤","137363577":"王锤神雷Ⅰ","137363578":"王锤神雷Ⅱ","137363579":"王牙锤【大雷】","137363580":"轰龙纹锤Ⅰ","137363581":"轰龙纹锤Ⅱ","137363582":"轰锤【虎丸】","137363583":"角龙锤Ⅰ","137363584":"角龙锤Ⅱ","137363585":"角龙尾锤","137363586":"钢冰棍Ⅰ","137363587":"巨大钢龙锤","137363588":"炎王火山口Ⅰ","137363589":"炎王光明","137363590":"扩张之魔神锤Ⅰ","137363591":"幻惑之迪亚玛尔特","137363592":"怒发锤Ⅰ","137363593":"怒发锤Ⅱ","137363594":"怒发豪大金狮","137363595":"百龙锤Ⅳ","137363596":"百龙锤Ⅴ","137363597":"村卫用防卫战锤Ⅰ","137363598":"村卫用坚守战锤","137363756":"炎火武钩锤","137363757":"炎火武钩锤・改","137363758":"炎火杰钩锤","137363759":"公爵猛击","137363760":"嚼碎粉末","137363761":"海波挠锤之华石・改","137363762":"海波挠山光明锤","137363763":"海波挠山光明锤・改","137363764":"辟邪之锤【宇迦之御魂】","137363765":"迷惑甲锤・改","137363766":"迷惑张皇甲坚锤","137363767":"迷惑张皇甲坚锤・改","137363768":"泥＝爆裂","137363769":"泥＝爆裂・改","137363770":"泥＝粉碎","137363771":"熔炼锤","137363772":"溶翁大锤净化","137363773":"刚力具・钴锤金刚","137363774":"刚力具・钴锤金刚改","137363775":"刚力王・金刚天锤","137363776":"绯天具・钴锤金刚","137363777":"绯天具・钴锤金刚改","137363778":"绯天之锤・六仙金刚","137363779":"邪道蚀锤・改","137363780":"沉重蚀锤","137363781":"破坏左轮","137363782":"破坏左轮・改","137363783":"爆裂左轮","137363784":"超新星・改","137363785":"究极超新星","137363786":"究极超新星・改","137363787":"电龙碎雷神锤","137363788":"电龙碎雷神锤・改","137363789":"电龙碎无情雷王","137363790":"轰锤【虎丸】改","137363791":"轰锤【大虎丸】","137363792":"轰锤【大虎丸】改","137363793":"蛮颚炎羽锤・改","137363794":"强袭蛮炎锤","137363795":"强袭蛮炎锤・改","137363796":"冰凌雪白","137363797":"冰凌雪白・改","137363798":"雪崩骑士","137363799":"鸟喙狂击・改","137363800":"鸟喙信天鸡蛇锤","137363801":"鬼铁之尊","137363802":"鬼铁之尊・改","137363803":"大鬼铁之尊","137363804":"青熊锤【贰型】改","137363805":"青熊锤【叁型】","137363806":"梦幻人鱼怒击・改","137363807":"梦魇锤人鱼怒击","137363808":"梦魇锤人鱼怒击・改","137363809":"冰花雪人鱼锤","137363810":"冰花雪人鱼锤・改","137363811":"极光雪锤雪人鱼","137363812":"奇怪龙雷锤・改","137363813":"奇怪龙落雷锤","137363814":"奇怪龙落雷锤・改","137363815":"冰雾之国","137363816":"冰雾之国・改","137363817":"冰铁毁坏","137363818":"冷月碎锤","137363819":"冷月碎锤・改","137363820":"冰镜圆月碎","137363821":"将军镰蟹头甲斧锤","137363822":"将军镰蟹头甲斧锤・改","137363823":"断骨斧锤","137363824":"角龙尾锤・改","137363825":"破锤粉碎者","137363826":"破锤粉碎者・改","137363827":"擎天神锤・改","137363828":"擎天斧","137363829":"擎天斧・改","137363830":"大锤大陵五","137363831":"大锤大陵五・改","137363832":"叛锤大陵五","137363833":"毒妖喉锤・改","137363834":"毒妖锤顶点变色龙","137363835":"毒妖锤顶点变色龙・改","137363836":"火龙碎锤・改","137363837":"火龙碎火神锤","137363838":"蔷薇大锤","137363839":"蔷薇大锤・改","137363840":"蔷薇雷雨","137363841":"雪鬼兽啪叽叽","137363842":"雪鬼兽啪叽叽・改","137363843":"雪鬼兽！啪叽啪叽！","137363844":"王牙锤【大雷】改","137363845":"真・王牙锤【破天】","137363846":"六翼蛇锤厄客德娜・改","137363847":"六翼蛇王锤艾因加纳","137363848":"水锤水精灵・改","137363849":"罗蕾莱","137363850":"罗蕾莱・改","137363851":"刚缠之锤","137363852":"刚缠之锤・改","137363853":"巨块锤赫朗格尼尔","137363854":"镰鼬暴风锤・改","137363855":"飓风大锤","137363856":"夜行锤【黑染】","137363857":"夜行锤【黑染】改","137363858":"无明锤【中谛】","137363859":"土砂突击","137363860":"土砂突击・改","137363861":"土砂势力","137363862":"祸锤【幽鬼无恩】改","137363863":"祸名品【大幽鬼无恩】","137363864":"铠怨鬼锤【怨无恩】","137363865":"丸鸟卵锤・改","137363866":"全心全蛋丸鸟卵锤","137363867":"怒发豪大金狮・改","137363868":"怒发天大金狮","137363869":"神溃・风云烈震","137363870":"神溃・雷祸烈震","137363871":"巨大钢龙锤・改","137363872":"超越钢龙锤","137363873":"炎王光明・改","137363874":"炎王巨城","137363875":"幻惑之迪亚玛尔特・改","137363876":"幻神之迪莫戈尔戈","137363877":"赤绝刚翼大火星","137363878":"权力of眩惑","137363879":"权力of眩惑・改","137363880":"权力of仇恨","137363881":"THE末日","137363882":"THE大地","137363883":"冥渊巨锤【狂风】","137363884":"鬼神锤【金鬼】","137363885":"熟睡熊・改","137363886":"ZZZ…睡熊","137363887":"祸锤寄宿死亡・改","137363888":"灾祸锤厄运之始","137363889":"灵锤南瓜王・改","137363890":"灵锤之南瓜魔王","137363891":"王国骑士大锤力量","137363892":"王国骑士大锤力量・改","137363893":"远古机械・大锤","137363894":"仙人掌风暴","137363895":"星碎殒落","137363897":"斗宿锤【天府】","137363904":"村卫用坚守战锤Ⅱ","137363905":"村卫用坚守战锤Ⅲ","137363906":"护村战锤・勇","137363907":"熔炼锤・改","137363912":"诞生or死亡","137363914":"冰军极地","137363915":"凶镜【妖云】","137363916":"刻银破锤","138412032":"铁长枪Ⅰ","138412033":"铁长枪Ⅱ","138412034":"千禧年","138412035":"圣骑士长枪Ⅰ","138412036":"圣骑士长枪Ⅱ","138412037":"铁壁长枪","138412038":"钻头长枪Ⅰ","138412039":"钻头长枪Ⅱ","138412040":"巨大钻头长枪","138412041":"炽热长枪Ⅰ","138412042":"炽热长枪Ⅱ","138412043":"炽热尖刺","138412044":"巴别塔Ⅰ","138412045":"巴别塔Ⅱ","138412046":"远古巴别塔","138412047":"击龙枪【哼】Ⅰ","138412048":"击龙枪【哼】Ⅱ","138412049":"击龙枪【哈】","138412050":"骨长枪Ⅰ","138412051":"硬骨枪","138412052":"长角长枪Ⅰ","138412053":"獠牙长枪","138412054":"蛮族獠牙Ⅰ","138412055":"野蛮人之牙","138412056":"炎火铁枪Ⅰ","138412057":"炎火铁枪Ⅱ","138412058":"炎火铁枪Ⅲ","138412059":"炎火铁枪Ⅳ","138412060":"炎火铁枪Ⅴ","138412061":"炎火忍枪","138412062":"百龙枪Ⅰ","138412063":"百龙枪Ⅱ","138412064":"百龙枪Ⅲ","138412065":"百龙枪【得心应手】","138412066":"冰鲛叉Ⅰ","138412067":"冰鲛叉Ⅱ","138412068":"冰鲛利叉","138412069":"麻蕈刺枪Ⅰ","138412070":"麻蕈刺枪Ⅱ","138412071":"强力麻蕈枪","138412072":"阿剌克涅之枪Ⅰ","138412073":"阿剌克涅之枪Ⅱ","138412074":"阿剌克涅之枪Ⅲ","138412075":"蝎枪阿剌克涅","138412076":"芬芳长枪Ⅰ","138412077":"芬芳长枪Ⅱ","138412078":"雅致芬芳长枪","138412079":"风之贼枪Ⅰ","138412080":"风之贼枪Ⅱ","138412081":"风镰枪朱利亚诺","138412082":"伞锐枪Ⅰ","138412083":"伞锐枪Ⅱ","138412084":"伞锐枪Ⅲ","138412085":"晓之突枪突骑","138412086":"突掌Ⅰ","138412087":"突掌Ⅱ","138412088":"蛙式・突掌","138412089":"祸枪【封】Ⅰ","138412090":"祸枪【封】Ⅱ","138412091":"祸枪【幽鬼无月】","138412092":"雪鬼兽噗嗤Ⅰ","138412093":"雪鬼兽噗嗤Ⅱ","138412094":"雪鬼兽噗嗤！","138412095":"苍风神枪Ⅰ","138412096":"苍风神枪Ⅱ","138412097":"神渊之风【刺】","138412098":"鸣雷神枪Ⅰ","138412099":"神源之雷【刺】","138412100":"赫翼尖枪Ⅰ","138412101":"龙天赤枪【恩克】","138412102":"苍蓝头冠Ⅰ","138412103":"苍蓝头冠Ⅱ","138412104":"苍蓝头冠Ⅲ","138412105":"无边苍青","138412106":"尖锐长枪Ⅰ","138412107":"尖锐长枪Ⅱ","138412108":"锐角长枪","138412109":"喙枪Ⅰ","138412110":"喙枪Ⅱ","138412111":"鸟喙利枪","138412112":"螺旋长枪Ⅰ","138412113":"螺旋长枪Ⅱ","138412114":"螺旋巨蛇枪","138412115":"土砂长枪Ⅰ","138412116":"土砂长枪Ⅱ","138412117":"土砂削枪","138412118":"蛇枪【蛇神】Ⅰ","138412119":"蛇枪【蛇神】Ⅱ","138412120":"蛇枪【巨蛇】","138412121":"赤甲兽之枪Ⅰ","138412122":"赤甲兽之枪Ⅱ","138412123":"赤甲兽之扫","138412124":"避役长枪Ⅰ","138412125":"避役长枪Ⅱ","138412126":"毒妖喉枪","138412127":"剧毒长枪Ⅰ","138412128":"剧毒长枪Ⅱ","138412129":"剧毒乌贼长枪","138412130":"冰牙锐枪Ⅰ","138412131":"冰牙锐枪Ⅱ","138412132":"冻土冰牙枪","138412133":"飞雷枪突蛇Ⅰ","138412134":"飞雷枪突蛇Ⅱ","138412135":"飞雷枪【御手杵】","138412136":"隐秘穿刺Ⅰ","138412137":"隐秘穿刺Ⅱ","138412138":"暗夜枪【黑雨】","138412139":"狐枪【知谢芬芳益】Ⅰ","138412140":"狐枪【知谢芬芳益】Ⅱ","138412141":"君着笠枪之突刺","138412142":"赤尾长枪Ⅰ","138412143":"赤尾长枪Ⅱ","138412144":"日珥刺矛","138412145":"王枪天雷Ⅰ","138412146":"王枪天雷Ⅱ","138412147":"王牙枪【若雷】","138412148":"轰龙之刺Ⅰ","138412149":"轰龙之刺Ⅱ","138412150":"轰枪【独虎】","138412151":"角龙角Ⅰ","138412152":"角龙角Ⅱ","138412153":"角枪角龙","138412154":"钢冰枪Ⅰ","138412155":"祈愿钢龙枪","138412156":"炎王怒吼Ⅰ","138412157":"炎王咆哮","138412158":"鬼枪金狮子Ⅰ","138412159":"鬼枪金狮子Ⅱ","138412160":"大鬼枪金狮子","138412161":"爆鳞突击枪Ⅰ","138412162":"爆鳞突击枪Ⅱ","138412163":"爆鳞先锋枪","138412164":"百龙枪Ⅳ","138412165":"百龙枪Ⅴ","138412166":"村卫用防卫长枪Ⅰ","138412167":"村卫用坚守长枪","138412332":"炎火武枪","138412333":"炎火武枪・改","138412334":"炎火杰枪","138412335":"公爵钉刺","138412336":"穿刺木桩","138412337":"雪鬼兽噗嗤嗤","138412338":"雪鬼兽噗嗤嗤・改","138412339":"雪鬼兽！噗嗤噗嗤！","138412340":"君着笠枪之突刺・改","138412341":"君着笠云天通枪","138412342":"君着笠云天通枪・改","138412343":"辟邪之枪【御先稻荷】","138412344":"蛇枪【巨蛇】改","138412345":"蛇枪【衔尾蛇】","138412346":"蛙式・突掌改","138412347":"真蛙式・突掌","138412348":"真蛙式・突掌改","138412349":"风镰枪朱利亚诺・改","138412350":"大风镰枪西南风","138412351":"冰鲛利叉・改","138412352":"冰鲛刺叉","138412353":"铁壁长枪・改","138412354":"铁塔","138412355":"铁塔・改","138412356":"远古巴别塔・改","138412357":"失落巴别塔","138412359":"失落巴别塔・改","138412360":"冷月旋枪","138412361":"冷月旋枪・改","138412362":"冰镜圆月旋","138412363":"剧毒乌贼长枪・改","138412366":"玄武剧毒岩","138412367":"暗夜枪【紫黑】","138412368":"暗夜枪【紫黑】改","138412369":"无明枪【集谛】","138412370":"击龙枪【哈】改","138412371":"刚击龙枪【哼哈二将】","138412372":"刚击龙枪【哼哈二将】改","138412373":"飞雷枪【御手杵】改","138412374":"万雷枪【御手杵】","138412375":"万雷枪【御手杵】改","138412376":"晓月刺枪骁勇","138412377":"晓月刺枪骁勇・改","138412378":"晓光刺枪荣光","138412379":"削石枪冈格尼尔","138412380":"削石枪冈格尼尔・改","138412381":"土砂削岩枪","138412382":"巨大钻头长枪・改","138412383":"究极钻头长枪","138412384":"究极钻头长枪・改","138412385":"青绿霹雳","138412386":"青绿霹雳・改","138412387":"碧绿霹雳","138412388":"赤甲兽之扫・改","138412389":"欺诈延枪","138412390":"欺诈延枪・改","138412391":"炽热尖刺・改","138412393":"炽热刺枪","138412397":"长枪天囷一","138412398":"长枪天囷一・改","138412399":"叛枪天囷一","138412400":"骨爪长枪","138412401":"骨爪长枪・改","138412402":"赤领主之枪","138412403":"将军镰蟹刺击者","138412404":"将军镰蟹刺击者・改","138412405":"突刺长枪","138412406":"轰枪【独虎】改","138412407":"轰枪【大独虎】","138412408":"轰枪【大独虎】改","138412409":"刃齿冰牙枪","138412410":"刃齿冰牙枪・改","138412411":"极寒冰牙枪","138412412":"毒妖喉枪・改","138412413":"毒妖枪迷彩变色龙","138412414":"毒妖枪迷彩变色龙・改","138412415":"日珥刺矛・改","138412416":"鲜红日珥","138412417":"蔷薇刺枪","138412418":"蔷薇刺枪・改","138412419":"蔷薇欲念","138412420":"螺旋巨蛇枪・改","138412421":"水冲水兽长枪","138412422":"水冲水兽长枪・改","138412423":"刚缠之塔","138412424":"刚缠之塔・改","138412425":"巨块枪科托斯","138412426":"锐角长枪・改","138412427":"锐角突刺枪","138412428":"角枪角龙・改","138412429":"角王枪冲突","138412430":"角王枪冲突・改","138412431":"鸟喙利枪・改","138412432":"鸟喙信天鸡蛇枪","138412433":"王牙枪【若雷】改","138412434":"真・王牙枪【天冲】","138412435":"无边苍青・改","138412437":"战旗苍青","138412438":"祸枪【幽鬼无月】改","138412439":"祸名品【大幽鬼无月】","138412440":"铠怨鬼枪【怨无月】","138412441":"大鬼枪金狮子・改","138412442":"猛鬼刚枪金狮子","138412443":"神刺・风云三绝","138412445":"爆鳞枪风暴胡拉坎","138412446":"炸裂火箭爆炎枪","138412447":"神刺・雷祸三绝","138412449":"祈愿钢龙枪・改","138412450":"王者钢龙枪","138412451":"炎王咆哮・改","138412452":"炎王魂","138412453":"赤绝尖翼室女角","138412454":"护盾of诚信","138412455":"护盾of诚信・改","138412456":"护盾of震怒","138412457":"THE守护者","138412458":"THE圣骑士","138412459":"冥渊突枪【冰狱】","138412460":"鬼神天枪金狮子","138412461":"强力麻蕈枪・改","138412463":"究极麻蕈枪","138412464":"蝎枪阿剌克涅・改","138412465":"大蝎枪奈兰淬","138412466":"雅致芬芳长枪・改","138412468":"优雅芬芳长枪","138412469":"王国骑士枪守护","138412471":"王国骑士枪守护・改","138412472":"远古机械・长枪","138412473":"黑暗长枪","138412474":"黑暗长枪・改","138412475":"黑暗乌贼长枪","138412476":"仙人掌欲念","138412477":"白银日珥","138412479":"七星枪【天枢】","138412486":"村卫用坚守长枪Ⅱ","138412487":"村卫用坚守长枪Ⅲ","138412488":"护村长枪・勇","138412493":"贤者or恶魔","138412495":"冰骑抗兵","138412496":"凶矛【凌云】","138412497":"刻银袭枪","139460608":"铁刀Ⅰ","139460609":"铁刀Ⅱ","139460610":"铁刀【神乐】","139460611":"斩破刀Ⅰ","139460612":"斩破刀Ⅱ","139460613":"鬼斩破","139460614":"守护者之剑Ⅰ","139460615":"守护者之剑Ⅱ","139460616":"帝国配剑","139460617":"冻刃Ⅰ","139460618":"冻刃Ⅱ","139460619":"冻刃【冰华】","139460620":"铁锯刀Ⅰ","139460621":"铁锯刀Ⅱ","139460622":"铁锯刀【千切】","139460623":"糙骨镰Ⅰ","139460624":"糙骨镰Ⅱ","139460625":"骨镰","139460626":"黑暗镰刀Ⅰ","139460627":"黑暗痛苦镰刀","139460628":"颚刃Ⅰ","139460629":"颚刃Ⅱ","139460630":"颚刃布拉克斯","139460631":"镰威太刀Ⅰ","139460632":"镰威太刀Ⅱ","139460633":"大镰威太刀","139460634":"炎火铁刀Ⅰ","139460635":"炎火铁刀Ⅱ","139460636":"炎火铁刀Ⅲ","139460637":"炎火铁刀Ⅳ","139460638":"炎火铁刀Ⅴ","139460639":"炎火忍刀","139460640":"百龙刀Ⅰ","139460641":"百龙刀Ⅱ","139460642":"百龙刀Ⅲ","139460643":"百龙刀【千变万化】","139460644":"传承太刀【无铭】Ⅰ","139460645":"传承太刀【无铭】Ⅱ","139460646":"继承宝刀【炎火】","139460647":"绝望Ⅰ","139460648":"绝望Ⅱ","139460649":"绝望Ⅲ","139460650":"祸镰瓦尔纳乌斯","139460651":"风之贼刀Ⅰ","139460652":"风之贼刀Ⅱ","139460653":"风镰刀义留","139460654":"伞刺剑Ⅰ","139460655":"伞刺剑Ⅱ","139460656":"晓之刺刀斩骑","139460657":"人鱼狂舞Ⅰ","139460658":"人鱼狂舞Ⅱ","139460659":"梦幻人鱼狂舞","139460660":"祸太刀【封】Ⅰ","139460661":"祸太刀【封】Ⅱ","139460662":"祸太刀【幽鬼无天】","139460663":"泥＝土Ⅰ","139460664":"泥＝土Ⅱ","139460665":"分＝规","139460666":"苍风神刀Ⅰ","139460667":"苍风神刀Ⅱ","139460668":"神渊之风【斩】","139460669":"鸣雷神刀Ⅰ","139460670":"神源之雷【斩】","139460671":"赫翼刀Ⅰ","139460672":"龙天赤刀【百武】","139460673":"雪鹿刀Ⅰ","139460674":"雪鹿刀Ⅱ","139460675":"雪鹿刀【鹿角】","139460676":"青熊薙Ⅰ","139460677":"青熊薙Ⅱ","139460678":"青熊长笔【留跳】","139460679":"骨刀无限Ⅰ","139460680":"骨刀无限Ⅱ","139460681":"缚骨刀【缝影】","139460682":"白兔刃Ⅰ","139460683":"白兔刃Ⅱ","139460684":"白兔刃【冰棘】","139460685":"骨刀【犬牙】Ⅰ","139460686":"骨刀【犬牙】Ⅱ","139460687":"骨刃骨阿鲁伽","139460688":"毒狗龙太刀Ⅰ","139460689":"毒狗龙太刀Ⅱ","139460690":"毒刀海奎特","139460691":"喙刀Ⅰ","139460692":"喙刀Ⅱ","139460693":"鸟喙长刀","139460694":"水溺刀Ⅰ","139460695":"水溺刀Ⅱ","139460696":"水蛇长战斧","139460697":"土砂壁刃Ⅰ","139460698":"土砂壁刃Ⅱ","139460699":"土砂城刀","139460700":"泥磨长刀Ⅰ","139460701":"泥磨长刀Ⅱ","139460702":"沼泽长刀","139460703":"巨岩重刀Ⅰ","139460704":"巨岩重刀Ⅱ","139460705":"泰坦重刀","139460706":"飞龙刀【翠】Ⅰ","139460707":"飞龙刀【翠】Ⅱ","139460708":"飞龙刀【葵】","139460709":"冰牙朱红刃Ⅰ","139460710":"冰牙朱红刃Ⅱ","139460711":"冰牙极寒朱红刃","139460712":"飞雷刀斩蛇Ⅰ","139460713":"飞雷刀斩蛇Ⅱ","139460714":"飞雷刀【骚速】","139460715":"炎羽尖刀Ⅰ","139460716":"炎羽尖刀Ⅱ","139460717":"蛮颚炎羽刀","139460718":"隐秘马刀Ⅰ","139460719":"隐秘马刀Ⅱ","139460720":"夜刀【月影】","139460721":"狐刀【月照心自明】Ⅰ","139460722":"狐刀【月照心自明】Ⅱ","139460723":"玉绳绝刀之斩振","139460724":"飞龙刀【朱】Ⅰ","139460725":"飞龙刀【朱】Ⅱ","139460726":"飞龙刀【枫】","139460727":"王刀雷切Ⅰ","139460728":"王刀雷切Ⅱ","139460729":"王牙刀【伏雷】","139460730":"一虎刀Ⅰ","139460731":"一虎刀Ⅱ","139460732":"一虎刀【饿刃】","139460733":"钢冰大刃Ⅰ","139460734":"钢龙之刃","139460735":"帝王刀Ⅰ","139460736":"帝王刀【阳炎】","139460737":"霞龙弯刀Ⅰ","139460738":"霞龙幽魂刀","139460739":"鬼薙刀Ⅰ","139460740":"鬼薙刀Ⅱ","139460741":"大鬼薙刀","139460742":"爆鳞大刀Ⅰ","139460743":"爆鳞大刀Ⅱ","139460744":"爆鳞宽刃刀","139460745":"百龙刀Ⅳ","139460746":"百龙刀Ⅴ","139460747":"村卫用防卫太刀Ⅰ","139460748":"村卫用坚守太刀","139460749":"苍星太刀Ⅰ","139460750":"苍星太刀【舞龙】","139460908":"炎火武刀","139460909":"炎火武刀・改","139460910":"炎火杰刀","139460911":"王牙刀【伏雷】改","139460912":"真･王牙刀【天威】","139460913":"晓月刺刀骁勇","139460914":"晓月刺刀骁勇・改","139460915":"晓光刺刀荣光","139460916":"白兔刃【冰棘】改","139460917":"白兔棘刃【因幡】","139460918":"帝国配剑Ⅱ","139460919":"帝国配剑Ⅲ","139460920":"护皇刀","139460921":"公爵骑兵刀","139460922":"裂空之翼","139460923":"土砂城堡","139460924":"土砂城堡・改","139460925":"土砂岩堡","139460926":"泰坦重刀・改","139460927":"岩龙重刀","139460928":"泥＝违抗","139460929":"泥＝违抗・改","139460930":"泥＝顽固","139460931":"熔铸刀","139460932":"溶翁太刀铁骑","139460936":"飞龙刀【橄榄石】","139460937":"飞龙刀【橄榄石】改","139460938":"真飞龙刀【亚历山】","139460939":"一虎刀【饿刃】改","139460940":"轰刀【饿虎】","139460941":"轰刀【饿虎】改","139460942":"玉绳绝刀之斩振・改","139460943":"玉绳绝佳丽斩刀","139460944":"玉绳绝佳丽斩刀・改","139460945":"辟邪之太刀【线蛱蝶】","139460946":"夜刀【尖影】","139460947":"夜刀【尖影】改","139460948":"无名刀【空谛】","139460949":"鬼斩破・改","139460950":"鬼神斩破刀","139460951":"鬼神斩破刀・改","139460952":"鸟喙长刀・改","139460953":"鸟喙信天鸡蛇刀","139460954":"冻刃【雾花】","139460955":"冻刃【雾花】改","139460956":"六花垂冰丸【瑞雪】","139460957":"冷月白刃","139460958":"冷月白刃・改","139460959":"冰镜圆月刀","139460960":"飞龙刀【葵】改","139460961":"真飞龙刀【翠绿】","139460962":"真飞龙刀【翠绿】改","139460963":"蔷薇羽刃","139460964":"蔷薇羽刃・改","139460965":"蔷薇天堂","139460966":"飞龙刀【枫】改","139460967":"真飞龙刀【绯红】","139460968":"骨刃骨阿鲁伽・改","139460969":"骨断刀【断影】","139460970":"骨断刀【断影】改","139460971":"太刀参宿五","139460972":"太刀参宿五・改","139460973":"叛刃参宿五","139460974":"黑刀【零式】","139460975":"黑刀【零式】改","139460976":"黑刀【终式】","139460977":"蛮颚炎羽刀・改","139460978":"利刃蛮炎刀","139460979":"利刃蛮炎刀・改","139460980":"冰牙拂晓佩刀","139460981":"冰牙拂晓佩刀・改","139460982":"冰牙极寒琥珀刃","139460983":"毒刀海奎特・改","139460984":"剧毒之吻","139460985":"缚骨刀【缝影】改","139460986":"魂缚刀【不知火】","139460987":"飞雷刀【骚速】改","139460988":"飞雷闪刀【伐鬼】","139460989":"飞雷闪刀【伐鬼】改","139460990":"沼泽长刀・改","139460991":"泥沼之爪","139460992":"泥沼之爪・改","139460993":"雪鹿刀【鹿大角】","139460994":"雪鹿刀【鹿大角】改","139460995":"雪鹿刀【鹿王角】","139460996":"梦幻人鱼狂舞・改","139460997":"梦魇刀人鱼狂舞","139460998":"梦魇刀人鱼狂舞・改","139460999":"冰花雪人鱼刀","139461000":"冰花雪人鱼刀・改","139461001":"极光雪刀雪人鱼","139461002":"水蛇长战斧・改","139461003":"水瓶战斧","139461004":"水瓶战斧・改","139461005":"刚缠切刀","139461006":"刚缠切刀・改","139461007":"巨块刀泰坦","139461008":"青熊长笔【留跳】改","139461009":"青熊长笔【鲑兽戏画】","139461010":"风镰刀义留・改","139461011":"大风镰刀朔风","139461012":"黑暗痛苦镰刀・改","139461013":"暗无天日黑镰","139461014":"暗无天日黑镰・改","139461015":"蟹钳大镰","139461016":"蟹钳大镰・改","139461017":"大名盾爪镰","139461018":"将军镰爪镰","139461019":"将军镰爪镰・改","139461020":"撕裂","139461021":"咒毒之大镰威太刀","139461022":"咒毒之大镰威太刀・改","139461024":"怨毒之大镰威太刀","139461025":"祸太刀【幽鬼无天】改","139461026":"祸名品【大幽鬼无天】","139461027":"铠怨鬼刀【怨无天】","139461028":"大鬼薙刀・改","139461029":"大鬼薙刀【罗刹】","139461030":"神斩・风云灭裂","139461032":"爆鳞刀赤红爆炸","139461033":"炸裂迸发爆炎刀","139461034":"神斩・雷祸灭裂","139461036":"钢冰之刃・改","139461037":"钢龙暴风","139461038":"帝王刀【阳炎】改","139461039":"炎帝王刀【海市蜃楼】","139461040":"霞龙幽魂刀・改","139461041":"海市蜃楼弯刀","139461042":"赤绝闪翼十字三","139461043":"钢铁of真实","139461044":"钢铁of真实・改","139461045":"钢铁of审判","139461046":"THE正义","139461047":"THE十诫","139461048":"冥渊斩刀【天雷】","139461049":"鬼神薙刀【阿修罗】","139461050":"祸镰瓦尔纳乌斯・改","139461052":"灾祸镰达尔克那乌斯","139461053":"继承宝刀【炎火】改","139461055":"继承宝刀【真炎火】","139461056":"王国骑士太刀英勇","139461058":"王国骑士太刀英勇・改","139461059":"远古机械・太刀","139461060":"仙人掌天堂","139461061":"飞龙刀【银】","139461062":"飞龙刀【月】","139461064":"七星刀【天权】","139461071":"村卫用坚守太刀Ⅱ","139461072":"村卫用坚守太刀Ⅲ","139461073":"护村太刀・勇","139461074":"熔铸刀・改","139461079":"混沌or法律","139461081":"冰灵芒刃","139461082":"凶刀【催花雨】","139461083":"刻银斩刀","140509184":"精锐讨伐队斩击斧Ⅰ","140509185":"精锐讨伐队斩击斧Ⅱ","140509186":"精锐进攻队斩击斧","140509187":"罗宋红斧Ⅰ","140509188":"罗宋红斧Ⅱ","140509189":"强力罗宋红斧","140509190":"击龙斧Ⅰ","140509191":"击龙斧Ⅱ","140509192":"驱龙斧","140509193":"铁制试作剑斧Ⅰ","140509194":"铁制试作剑斧Ⅱ","140509195":"钢铁制改良剑斧","140509196":"扫荡Ⅰ","140509197":"扫荡Ⅱ","140509198":"征服","140509199":"骨制剑斧Ⅰ","140509200":"骨制剑斧Ⅱ","140509201":"代达罗斯","140509202":"壮实身躯Ⅰ","140509203":"壮实身躯Ⅱ","140509204":"棕精灵长斧","140509205":"炎火铁剑斧Ⅰ","140509206":"炎火铁剑斧Ⅱ","140509207":"炎火铁剑斧Ⅲ","140509208":"炎火铁剑斧Ⅳ","140509209":"炎火铁剑斧Ⅴ","140509210":"炎火忍剑斧","140509211":"百龙剑斧Ⅰ","140509212":"百龙剑斧Ⅱ","140509213":"百龙剑斧Ⅲ","140509214":"百龙剑斧【量体裁衣】","140509215":"剑斧折纸【樱云】Ⅰ","140509216":"剑斧折纸【樱云】Ⅱ","140509217":"剑斧折纸【樱吹雪】","140509218":"阴森猫Ⅰ","140509219":"阴森猫Ⅱ","140509220":"恶作剧猫斧","140509221":"冷酷镰刀Ⅰ","140509222":"冷酷镰刀Ⅱ","140509223":"无情夺命镰","140509224":"让人沉眠的贝剑斧Ⅰ","140509225":"让人沉眠的贝剑斧Ⅱ","140509226":"睡贝剑斧海螺","140509227":"伞旌旗Ⅰ","140509228":"伞旌旗Ⅱ","140509229":"伞旌旗Ⅲ","140509230":"晓之剑斧征骑","140509231":"天具・法轮真斧Ⅰ","140509232":"天具・法轮真斧Ⅱ","140509233":"大天具・轮斧军荼利","140509234":"祸斧【封】Ⅰ","140509235":"祸斧【封】Ⅱ","140509236":"祸斧【幽鬼无情】","140509237":"封＝泥Ⅰ","140509238":"封＝泥Ⅱ","140509239":"分＝裂","140509240":"苍风神剑斧Ⅰ","140509241":"苍风神剑斧Ⅱ","140509242":"神渊之风【变】","140509243":"鸣雷神剑斧Ⅰ","140509244":"神源之雷【变】","140509245":"赫翼剑斧Ⅰ","140509246":"龙天赤剑斧【多纳蒂】","140509247":"青熊斧Ⅰ","140509248":"青熊斧Ⅱ","140509249":"青熊豪斧【山祭】","140509250":"雪族剑斧Ⅰ","140509251":"雪族剑斧Ⅱ","140509252":"雪族剑斧Ⅲ","140509253":"雪族剑斧【露宿】","140509254":"白兔剑斧Ⅰ","140509255":"白兔剑斧Ⅱ","140509256":"白兔剑斧Ⅲ","140509257":"白兔剑斧【利雪】","140509258":"砂鱼帆鳍Ⅰ","140509259":"砂鱼帆鳍Ⅱ","140509260":"砂鱼沙海帆鳍","140509261":"水兽战斧Ⅰ","140509262":"水兽战斧Ⅱ","140509263":"水兽冲击战斧","140509264":"突击斧Ⅰ","140509265":"突击斧Ⅱ","140509266":"暗堡破坏者","140509267":"奇怪龙万用刀Ⅰ","140509268":"奇怪龙万用刀Ⅱ","140509269":"奇怪龙激吻","140509270":"溢毒利斧Ⅰ","140509271":"溢毒利斧Ⅱ","140509272":"赐死神蛇","140509273":"甲旋Ⅰ","140509274":"甲旋Ⅱ","140509275":"甲旋Ⅲ","140509276":"赤红","140509277":"泥磨利斧Ⅰ","140509278":"泥磨利斧Ⅱ","140509279":"沼泽利斧","140509280":"龙姬斩击斧Ⅰ","140509281":"龙姬斩击斧Ⅱ","140509282":"破盾者","140509283":"琥珀斜斩Ⅰ","140509284":"琥珀斜斩Ⅱ","140509285":"琥珀斜斩Ⅲ","140509286":"寒霜琥珀","140509287":"炎羽长斧Ⅰ","140509288":"炎羽长斧Ⅱ","140509289":"蛮颚炎羽长斧","140509290":"隐秘战斧Ⅰ","140509291":"隐秘战斧Ⅱ","140509292":"暗夜斩击斧【弦月】","140509293":"狐斩击斧【子规啼离恨】Ⅰ","140509294":"狐斩击斧【子规啼离恨】Ⅱ","140509295":"淌雨流斧之雕字","140509296":"喷射烈炎斩击斧Ⅰ","140509297":"喷射烈炎斩击斧Ⅱ","140509298":"喷射烈炎斩击斧Ⅲ","140509299":"吞噬烈炎斩击斧","140509300":"王斩击斧雷电Ⅰ","140509301":"王斩击斧雷电Ⅱ","140509302":"王牙斩击斧【裂雷】","140509303":"轰龙斜斩Ⅰ","140509304":"轰龙斜斩Ⅱ","140509305":"轰龙裂击","140509306":"暴君斧Ⅰ","140509307":"暴君斧Ⅱ","140509308":"大地混沌","140509309":"钢龙斩击斧Ⅰ","140509310":"钢龙之翼","140509311":"炎王圆弧Ⅰ","140509312":"炎王之城","140509313":"凝视法杖Ⅰ","140509314":"幻视之巴罗尔","140509315":"金刚角斧Ⅰ","140509316":"金刚角斧Ⅱ","140509317":"金刚角斧雷鸣","140509318":"爆鳞重剑斧Ⅰ","140509319":"爆鳞重剑斧Ⅱ","140509320":"爆鳞双刃斧","140509321":"百龙剑斧Ⅳ","140509322":"百龙剑斧Ⅴ","140509323":"村卫用防卫剑斧Ⅰ","140509324":"村卫用坚守剑斧","140509484":"炎火武剑斧","140509485":"炎火武剑斧・改","140509486":"炎火杰剑斧","140509487":"公爵之斧","140509488":"车裂拷问","140509489":"淌雨流斧之雕字・改","140509490":"淌雨流丽玉笔斧","140509491":"淌雨流丽玉笔斧・改","140509492":"辟邪之剑斧【木兰凤蝶】","140509493":"吞噬烈炎斩击斧・改","140509494":"高级红玉斧","140509495":"清净具・轮斧军荼利","140509496":"清净具・轮斧军荼利改","140509497":"清净王・军荼利之天斧","140509498":"绯天具・轮斧军荼利","140509499":"绯天具・轮斧军荼利改","140509500":"绯天之斧・六仙军荼利","140509501":"砂鱼沙海帆鳍・改","140509502":"沙海剑斧砂鱼大帆船","140509503":"奇怪龙激吻・改","140509504":"奇怪龙锁定","140509505":"奇怪龙锁定・改","140509506":"青熊豪斧【山祭】改","140509507":"青熊豪斧【神轿】","140509508":"百兆寒霜琥珀","140509509":"百兆寒霜琥珀・改","140509510":"究极寒霜琥珀","140509511":"精锐进攻队斩击斧Ⅱ","140509512":"精锐进攻队斩击斧Ⅲ","140509513":"精锐勇士队剑斧","140509514":"冷月剑斧","140509515":"冷月剑斧・改","140509516":"冰镜圆月剑斧","140509517":"沼泽利斧・改","140509518":"泥沼之牙","140509519":"泥沼之牙・改","140509520":"破盾者・改","140509521":"高阶破盾者","140509522":"高阶破盾者・改","140509523":"蔷薇尖刺","140509524":"蔷薇尖刺・改","140509525":"蔷薇刺锯","140509526":"征服Ⅱ","140509527":"征服Ⅲ","140509528":"再度征服","140509529":"强力罗宋红斧・改","140509530":"电刃罗宋红斧","140509531":"电刃罗宋红斧・改","140509532":"高级电翡翠斧","140509533":"高级电翡翠斧・改","140509534":"电龙究极剑斧","140509535":"驱龙斧・改","140509536":"重生龙斧","140509537":"重生龙斧・改","140509538":"勇敢＝泥","140509539":"勇敢＝泥・改","140509540":"泥＝直接","140509541":"熔融斧","140509542":"溶翁剑斧毁灭","140509543":"晓月剑斧骁勇","140509544":"晓月剑斧骁勇・改","140509545":"晓光剑斧荣光","140509546":"岩堡破坏者","140509547":"岩堡破坏者・改","140509548":"城寨破坏者","140509549":"雪族剑斧【露宿】改","140509551":"雪族剑斧【迷魂】","140509552":"棕精灵长斧・改","140509553":"最壮硕身躯","140509554":"最壮硕身躯・改","140509555":"剑斧毕宿五","140509556":"剑斧毕宿五・改","140509557":"叛伐斧毕宿五","140509558":"蟹钳斧","140509559":"蟹钳斧・改","140509560":"巨爪大解体","140509561":"蛮颚炎羽长斧・改","140509562":"破军蛮炎剑斧","140509563":"破军蛮炎剑斧・改","140509564":"轰龙裂击・改","140509565":"轰剑斧【斩虎】","140509566":"轰剑斧【斩虎】改","140509567":"大地混沌・改","140509568":"盖亚","140509569":"赐死神蛇・改","140509570":"塔纳托斯毒蛇","140509571":"暗夜剑斧【碎月】","140509572":"暗夜剑斧【碎月】改","140509573":"无明剑斧【灭谛】","140509574":"赤红・改","140509575":"红剑斧朱红","140509576":"红剑斧朱红・改","140509577":"水兽冲击战斧・改","140509578":"水断冲击战斧","140509579":"水断冲击战斧・改","140509580":"刚缠之斧","140509581":"刚缠之斧・改","140509582":"巨块剑斧俄里翁","140509583":"王牙斩击斧【裂雷】改","140509584":"真・王牙剑斧【断天】","140509585":"白兔剑斧【利雪】改","140509586":"白兔雪矜【利雪】","140509587":"祸斧【幽鬼无情】改","140509588":"祸名品【大幽鬼无情】","140509589":"铠怨鬼斧【怨无情】","140509590":"金刚角斧雷鸣・改","140509591":"金刚大角斧神雷","140509592":"神化・风云黑业","140509594":"爆鳞剑斧赤红熔岩","140509595":"爆鳞龙心","140509596":"神化・雷祸白业","140509598":"钢龙之翼・改","140509599":"钢龙钢翼斧","140509600":"炎王之城・改","140509601":"炎王朱炎宝座","140509602":"幻视之巴罗尔・改","140509603":"幻界之扎历艾拉","140509604":"赤绝整翼天琴织","140509605":"意志of轮廓","140509606":"意志of轮廓・改","140509607":"意志of灵魂","140509608":"THE执行者","140509609":"THE关闭者","140509610":"冥渊剑斧【海啸】","140509611":"鬼神角斧【雷火丰】","140509612":"剑斧折纸【落樱】","140509614":"剑斧折纸【樱花烂漫】","140509615":"恶作剧猫斧・改","140509617":"肉球恶魔","140509618":"无情夺命镰・改","140509619":"灾祸夺命镰","140509620":"睡贝剑斧海螺・改","140509621":"梦蜃剑斧莺蛤贝","140509622":"王国骑士剑斧忠诚","140509624":"王国骑士剑斧忠诚・改","140509625":"远古机械・剑斧","140509626":"仙人掌刺锯","140509627":"焰斧银火强焰","140509628":"煌战之金剑斧","140509630":"七星剑斧【开阳】","140509637":"盖亚・改","140509638":"村卫用坚守剑斧Ⅱ","140509639":"村卫用坚守剑斧Ⅲ","140509640":"护村剑斧・勇","140509641":"熔融斧・改","140509646":"罪恶or肯定","140509648":"冰魔扬军","140509649":"凶剑斧【白雨】","140509650":"刻银裂斧","141557760":"讨伐队正式铳枪Ⅰ","141557761":"讨伐队正式铳枪Ⅱ","141557762":"帝国守卫","141557763":"铁铳枪Ⅰ","141557764":"铁铳枪Ⅱ","141557765":"铁骑士","141557766":"王家护卫Ⅰ","141557767":"王家护卫Ⅱ","141557768":"王家守备","141557769":"骨铳枪Ⅰ","141557770":"骨铳枪Ⅱ","141557771":"龙骨铳枪","141557772":"巨骨铳枪Ⅰ","141557773":"巨骨铳枪Ⅱ","141557774":"刚铳枪","141557775":"炎火铁铳枪Ⅰ","141557776":"炎火铁铳枪Ⅱ","141557777":"炎火铁铳枪Ⅲ","141557778":"炎火铁铳枪Ⅳ","141557779":"炎火铁铳枪Ⅴ","141557780":"炎火忍铳枪","141557781":"百龙铳枪Ⅰ","141557782":"百龙铳枪Ⅱ","141557783":"百龙铳枪Ⅲ","141557784":"百龙铳枪【一念通天】","141557785":"牙猎铳炮Ⅰ","141557786":"牙猎铳炮Ⅱ","141557787":"牙猎长嚎","141557788":"玉米炮Ⅰ","141557789":"玉米炮Ⅱ","141557790":"玉米大炮","141557791":"让人沉眠的贝铳枪Ⅰ","141557792":"让人沉眠的贝铳枪Ⅱ","141557793":"睡贝铳枪贻贝","141557794":"伞机炮Ⅰ","141557795":"伞机炮Ⅱ","141557796":"伞机炮Ⅲ","141557797":"晓之铳枪轰骑","141557798":"祸炮枪【封】Ⅰ","141557799":"祸炮枪【封】Ⅱ","141557800":"祸炮枪【幽鬼无骸】","141557801":"泥＝泞Ⅰ","141557802":"泥＝泞Ⅱ","141557803":"审判＝日","141557804":"华丽烛炮Ⅰ","141557805":"华丽烛炮Ⅱ","141557806":"贵妇明烛","141557807":"苍风神铳枪Ⅰ","141557808":"苍风神铳枪Ⅱ","141557809":"神渊之风【爆】","141557810":"鸣雷神铳枪Ⅰ","141557811":"神源之雷【爆】","141557812":"赫翼铳枪Ⅰ","141557813":"龙天赤铳枪【班尼特】","141557814":"花铳枪零式Ⅰ","141557815":"花铳枪零式Ⅱ","141557816":"花铳枪壹式","141557817":"白花铳枪零式Ⅰ","141557818":"白花铳枪零式Ⅱ","141557819":"白花铳枪壹式","141557820":"绿花铳枪零式Ⅰ","141557821":"绿花铳枪零式Ⅱ","141557822":"绿花铳枪壹式","141557823":"黑花铳枪零式Ⅰ","141557824":"黑花铳枪零式Ⅱ","141557825":"黑花铳枪壹式","141557826":"眠狗铳枪Ⅰ","141557827":"眠狗铳枪Ⅱ","141557828":"眠狗铳枪Ⅲ","141557829":"眠狗铳枪安眠牙","141557830":"白兔铳枪Ⅰ","141557831":"白兔铳枪Ⅱ","141557832":"白兔铳枪Ⅲ","141557833":"白兔射线","141557834":"砂鱼击叉Ⅰ","141557835":"砂鱼击叉Ⅱ","141557836":"砂铳枪砂鱼穿","141557837":"水兽尖叉Ⅰ","141557838":"水兽尖叉Ⅱ","141557839":"水兽尖叉Ⅲ","141557840":"流贯分海铳枪","141557841":"土砂旋击Ⅰ","141557842":"土砂旋击Ⅱ","141557843":"土砂强力旋击","141557844":"电伏特MAXⅠ","141557845":"电伏特MAXⅡ","141557846":"电伏特枪MAX","141557847":"破坏射击Ⅰ","141557848":"破坏射击Ⅱ","141557849":"破坏奔流","141557850":"避役铳枪Ⅰ","141557851":"避役铳枪Ⅱ","141557852":"毒妖喉铳枪","141557853":"公主爆裂铳枪Ⅰ","141557854":"公主爆裂铳枪Ⅱ","141557855":"奥特琳德","141557856":"极寒双牙Ⅰ","141557857":"极寒双牙Ⅱ","141557858":"琥珀进击","141557859":"飞雷铳枪铁蛇Ⅰ","141557860":"飞雷铳枪铁蛇Ⅱ","141557861":"飞雷铳枪【蜻蜓切】","141557862":"炎羽铳枪Ⅰ","141557863":"炎羽铳枪Ⅱ","141557864":"炎羽铳枪Ⅲ","141557865":"蛮颚炎羽铳枪","141557866":"隐秘铳枪Ⅰ","141557867":"隐秘铳枪Ⅱ","141557868":"夜铳枪【残月】","141557869":"狐灯枪【沐辉决绝行】Ⅰ","141557870":"狐灯枪【沐辉决绝行】Ⅱ","141557871":"夏蝇荒枪之水守","141557872":"赤色战车Ⅰ","141557873":"赤色战车Ⅱ","141557874":"深红战车","141557875":"王铳枪豪雷Ⅰ","141557876":"王铳枪豪雷Ⅱ","141557877":"王牙铳枪【火雷】","141557878":"轰龙爆裂铳枪Ⅰ","141557879":"轰龙爆裂铳枪Ⅱ","141557880":"轰铳枪【虎炮】","141557881":"恶魔铳枪Ⅰ","141557882":"恶魔铳枪Ⅱ","141557883":"恶魔暴君铳枪","141557884":"钢冰铳枪Ⅰ","141557885":"钢龙爪铳枪","141557886":"毒物香气Ⅰ","141557887":"剧毒香气","141557888":"鬼铳枪Ⅰ","141557889":"鬼铳枪Ⅱ","141557890":"雷鬼铳枪","141557891":"爆鳞热炮枪Ⅰ","141557892":"爆鳞热炮枪Ⅱ","141557893":"爆鳞传世枪","141557894":"百龙铳枪Ⅳ","141557895":"百龙铳枪Ⅴ","141557896":"村卫用防卫铳枪Ⅰ","141557897":"村卫用坚守铳枪","141558060":"炎火武铳枪","141558061":"炎火武铳枪・改","141558062":"炎火杰铳枪","141558063":"公爵刺刀","141558064":"焦灼哀嚎","141558065":"夏蝇荒枪之水守・改","141558066":"夏蝇荒神祓灯枪","141558067":"夏蝇荒神祓灯枪・改","141558068":"辟邪之灯枪【饭绳灯花】","141558069":"奥特琳德・改","141558070":"究极奥特琳德","141558071":"究极奥特琳德・改","141558072":"蔷薇火炮","141558073":"蔷薇火炮・改","141558074":"蔷薇华丽","141558075":"深红战车・改","141558076":"火花战车","141558077":"砂铳枪砂鱼穿・改","141558078":"沙海铳枪砂鱼叉","141558079":"王牙铳枪【火雷】改","141558080":"真・王牙铳枪【震天】","141558081":"琥珀节奏","141558082":"琥珀节奏・改","141558083":"琥牙铳枪雪境","141558084":"帝国守卫・改","141558085":"护皇枪","141558086":"护皇枪・改","141558087":"冷月铳枪","141558088":"冷月铳枪・改","141558089":"冰镜圆月铳枪","141558090":"王家守备・改","141558091":"帝国近卫队","141558092":"帝国近卫队・改","141558093":"暗黑战车","141558094":"暗黑战车・改","141558095":"天雷战车","141558096":"毒妖喉铳枪・改","141558097":"毒妖铳枪齿轮变色龙","141558098":"毒妖铳枪齿轮变色龙・改","141558099":"恶魔暴君铳枪・改","141558100":"角王暴君铳枪","141558101":"晓月铳枪骁勇","141558102":"晓月铳枪骁勇・改","141558103":"晓光铳枪荣光","141558104":"泥＝胆量","141558105":"泥＝胆量・改","141558106":"泥＝惶恐","141558107":"熔炉枪","141558108":"溶翁铳枪凯旋","141558109":"电伏特枪MAX・改","141558110":"电伏特奇怪枪MAX","141558111":"电伏特奇怪枪MAX・改","141558112":"破坏奔流・改","141558113":"赤甲加农射击","141558114":"赤甲加农射击・改","141558115":"眠狗铳枪安眠牙・改","141558117":"眠狗铳枪摇篮","141558118":"飞雷铳枪【蜻蜓切】改","141558119":"万雷铳枪【蜻蜓切】改","141558120":"刚铳枪・改","141558121":"巨刚铳枪","141558122":"巨刚铳枪・改","141558123":"铳枪败臼一","141558124":"铳枪败臼一・改","141558125":"叛铳枪败臼一","141558126":"蟹钳铳枪","141558127":"蟹钳铳枪・改","141558128":"蟹钳加农炮","141558129":"夜铳枪【新月】","141558130":"夜铳枪【新月】改","141558131":"无明铳枪【妙谛】","141558132":"蛮颚炎羽铳枪・改","141558133":"重枪蛮炎铳枪","141558134":"重枪蛮炎铳枪・改","141558135":"土砂炼韧","141558136":"土砂炼韧・改","141558137":"土砂螺旋刺杀","141558138":"轰铳枪【虎炮】改","141558139":"轰铳枪【大虎炮】","141558140":"轰铳枪【大虎炮】改","141558141":"白兔射线・改","141558143":"白兔雪崩","141558144":"流贯分海铳枪・改","141558145":"水炮魅力巡礼","141558146":"水炮魅力巡礼・改","141558147":"刚缠刺刀","141558148":"刚缠刺刀・改","141558149":"巨块铳枪阿特拉斯","141558150":"络新妇私语","141558151":"络新妇私语・改","141558152":"永恒狂乱","141558153":"鲜红之灯铳枪","141558154":"鲜红之灯铳枪・改","141558155":"熔新妇之松明枪","141558156":"黑花铳枪贰式","141558157":"黑花铳枪叁式","141558158":"白花铳枪贰式","141558159":"白花铳枪叁式","141558160":"绿花铳枪贰式","141558161":"绿花铳枪叁式","141558162":"祸炮枪【幽鬼无骸】改","141558163":"祸名品【大幽鬼无骸】","141558164":"铠怨鬼炮枪【怨无骸】","141558165":"雷鬼铳枪・改","141558166":"震雷鬼铳枪","141558167":"神震・风云天惊","141558169":"爆鳞炮枪爆燃","141558170":"爆鳞龙自尊","141558171":"神震・雷祸天惊","141558173":"钢龙爪铳枪・改","141558174":"钢龙暴风雨","141558175":"剧毒香气・改","141558176":"猛毒香气","141558177":"赤绝烈翼五车星","141558178":"手腕of暴君","141558179":"手腕of暴君・改","141558180":"手腕of强欲","141558181":"THE冲击","141558182":"THE要塞","141558183":"冥渊铳枪【火山】","141558184":"鬼神铳枪猛狮","141558185":"牙猎长嚎・改","141558187":"咆犬铳枪牙猎啸","141558188":"玉米大炮・改","141558190":"波动玉米炮","141558191":"睡贝铳枪贻贝・改","141558192":"梦蜃铳枪海虹贝","141558193":"王国骑士铳枪誓言","141558195":"王国骑士铳枪誓言・改","141558196":"远古机械・铳枪","141558197":"仙人掌华丽","141558198":"银鳞战车","141558199":"女王爆裂铳枪","141558201":"七星铳枪【玉衡】","141558208":"万雷铳枪【蜻蜓切】","141558209":"角王暴君铳枪・改","141558212":"村卫用坚守铳枪Ⅱ","141558213":"村卫用坚守铳枪Ⅲ","141558214":"护村铳枪・勇","141558227":"熔炉枪・改","141558238":"壁垒or战火","141558240":"冰砦血仇","141558241":"凶铳枪【瑞雨】","141558242":"刻银击枪","142606336":"双短剑Ⅰ","142606337":"双短剑Ⅱ","142606338":"决斗双短剑","142606339":"飓风Ⅰ","142606340":"飓风Ⅱ","142606341":"气旋","142606342":"双战斧Ⅰ","142606343":"双战斧Ⅱ","142606344":"双战爪","142606345":"秩序细剑Ⅰ","142606346":"秩序细剑Ⅱ","142606347":"神圣军刀","142606348":"上古秘剑Ⅰ","142606349":"上古秘剑Ⅱ","142606350":"宝剑格拉姆","142606351":"电锯双剑Ⅰ","142606352":"电锯双剑Ⅱ","142606353":"死刑执行锯","142606354":"冰层心剑Ⅰ","142606355":"冰层心剑Ⅱ","142606356":"冰层灵魂剑","142606357":"骨斧Ⅰ","142606358":"骨斧Ⅱ","142606359":"狂野战斧","142606360":"兄弟钩爪Ⅰ","142606361":"兄弟钩爪Ⅱ","142606362":"伙伴钩爪","142606363":"火刃火焰红莲Ⅰ","142606364":"火刃火焰红莲Ⅱ","142606365":"炎刃火焰牢笼","142606366":"炎火铁双刃Ⅰ","142606367":"炎火铁双刃Ⅱ","142606368":"炎火铁双刃Ⅲ","142606369":"炎火铁双刃Ⅳ","142606370":"炎火铁双刃Ⅴ","142606371":"炎火忍双刃","142606372":"百龙双刃Ⅰ","142606373":"百龙双刃Ⅱ","142606374":"百龙双刃Ⅲ","142606375":"百龙双刃【瞬息万变】","142606376":"忍团子【睡蜜玉】Ⅰ","142606377":"忍团子【睡蜜玉】Ⅱ","142606378":"风雅忍团子【睡蜜玉】","142606379":"猫爪Ⅰ","142606380":"猫爪Ⅱ","142606381":"愤怒之爪","142606382":"水母雨伞Ⅰ","142606383":"水母雨伞Ⅱ","142606384":"水母血雨伞","142606385":"蝶剑Ⅰ","142606386":"蝶剑Ⅱ","142606387":"双曲蝶剑","142606388":"伞双锋Ⅰ","142606389":"伞双锋Ⅱ","142606390":"晓之双剑疾骑","142606391":"人鱼利爪Ⅰ","142606392":"人鱼利爪Ⅱ","142606393":"梦幻人鱼利爪","142606394":"祸刃【封】Ⅰ","142606395":"祸刃【封】Ⅱ","142606396":"祸刃【幽鬼无愧】","142606397":"雪＝泥Ⅰ","142606398":"雪＝泥Ⅱ","142606399":"雏菊＝切刀","142606400":"苍风神刃Ⅰ","142606401":"苍风神刃Ⅱ","142606402":"神渊之风【疾】","142606403":"鸣雷神刃Ⅰ","142606404":"神源之雷【疾】","142606405":"赫翼双刃Ⅰ","142606406":"龙天赤刃【威斯特】","142606407":"青熊双钺Ⅰ","142606408":"青熊双钺Ⅱ","142606409":"青熊双钺【足柄】","142606410":"冰雪双刃Ⅰ","142606411":"冰雪双刃Ⅱ","142606412":"冰雪双冻刃","142606413":"流氓双枪Ⅰ","142606414":"流氓双枪Ⅱ","142606415":"毒狗龙小子","142606416":"喙双刀Ⅰ","142606417":"喙双刀Ⅱ","142606418":"鸟喙对刃","142606419":"水兽双剑Ⅰ","142606420":"水兽双剑Ⅱ","142606421":"水兽水兽","142606422":"奇怪龙短剑Ⅰ","142606423":"奇怪龙短剑Ⅱ","142606424":"伤刃奇怪龙碎片","142606425":"泥磨双刀Ⅰ","142606426":"泥磨双刀Ⅱ","142606427":"沼泽双刀","142606428":"冰牙双剑Ⅰ","142606429":"冰牙双剑Ⅱ","142606430":"冰牙暴雪双剑","142606431":"飞雷双剑裂蛇Ⅰ","142606432":"飞雷双剑裂蛇Ⅱ","142606433":"飞雷双剑【小夜】","142606434":"炎羽双匕Ⅰ","142606435":"炎羽双匕Ⅱ","142606436":"蛮颚炎羽双匕","142606437":"禁忌匕首Ⅰ","142606438":"禁忌匕首Ⅱ","142606439":"夜天连刃【黑翼】","142606440":"狐双刃【浮世梦如空】Ⅰ","142606441":"狐双刃【浮世梦如空】Ⅱ","142606442":"磨刀研刃之切耶","142606443":"雌雄双焰刀Ⅰ","142606444":"雌雄双焰刀Ⅱ","142606445":"雌雄双龙剑","142606446":"王双刃雷神Ⅰ","142606447":"王双刃雷神Ⅱ","142606448":"王牙双刃【土雷】","142606449":"轰龙双切Ⅰ","142606450":"轰龙双切Ⅱ","142606451":"轰爪【虎血】","142606452":"兄弟剑Ⅰ","142606453":"兄弟剑Ⅱ","142606454":"兄弟剑信仰","142606455":"钢冰狼牙Ⅰ","142606456":"钢龙狼袭刃","142606457":"锐爪双剑Ⅰ","142606458":"冰炎剑维尔玛闪焰","142606459":"焰形双剑Ⅰ","142606460":"双剑霞龙","142606461":"斗鬼【高丸】Ⅰ","142606462":"斗鬼【高丸】Ⅱ","142606463":"斗神鬼【大岳丸】","142606464":"爆鳞手斧Ⅰ","142606465":"爆鳞手斧Ⅱ","142606466":"爆鳞回旋斧","142606467":"百龙双刃Ⅳ","142606468":"百龙双刃Ⅴ","142606469":"村卫用防卫双刃Ⅰ","142606470":"村卫用坚守双刃","142606636":"炎火武双剑","142606637":"炎火武双剑・改","142606638":"炎火杰双剑","142606639":"公爵双钩","142606640":"血爪伤痕","142606641":"泥＝双断","142606642":"泥＝双断・改","142606643":"泥＝细切","142606644":"熔离剑","142606645":"溶翁双剑几何","142606646":"王牙双刃【土雷】改","142606647":"真・王牙双刃【天业】","142606648":"霜巨人暴雪双剑","142606649":"霜巨人暴雪双剑・改","142606650":"冻刻暴风雪","142606651":"毒狗龙小子・改","142606652":"猛毒往事","142606653":"伤刃奇怪龙碎片・改","142606654":"血风伤刃奇怪龙碎片","142606655":"血风伤刃奇怪龙碎片・改","142606656":"气旋・改","142606657":"超级单体","142606658":"超级单体・改","142606659":"轰爪【虎血】改","142606660":"轰爪【大虎血】","142606661":"轰爪【大虎血】改","142606662":"磨刀研刃之切耶・改","142606663":"磨刀斋女舞奉双","142606664":"磨刀斋女舞奉双・改","142606665":"辟邪之双刀【剑尾蛱蝶】","142606666":"晓月双剑骁勇","142606667":"晓月双剑骁勇・改","142606668":"晓光双剑荣光","142606669":"鸟喙对刃・改","142606670":"鸟喙信天鸡蛇双剑","142606671":"冰层魄剑","142606672":"冰层魄剑・改","142606673":"冰层灵魂寒剑","142606674":"冷月朱爪","142606675":"冷月朱爪・改","142606676":"冰镜圆月爪","142606677":"夜天连刃【黑蝶】","142606678":"夜天连刃【黑蝶】改","142606679":"无明连刃【真谛】","142606680":"死刑执行锯・改","142606681":"终告的双锯","142606682":"终告的双锯・改","142606686":"双光剑光龙","142606687":"双光剑光龙・改","142606688":"究极雷光双剑","142606689":"青熊双钺【足柄】改","142606690":"青熊双钺【大江山】","142606691":"蛮颚炎羽双匕・改","142606692":"对匕蛮炎双剑","142606693":"对匕蛮炎双剑・改","142606694":"伙伴钩爪・改","142606695":"骨之双钩爪","142606696":"骨之双钩爪・改","142606697":"双剑轩辕十二","142606698":"双剑轩辕十二・改","142606699":"叛爪轩辕十二","142606700":"蟹角","142606701":"蟹角・改","142606702":"甲壳剑大名盾蟹","142606703":"六刃双剑","142606704":"六刃双剑・改","142606705":"大卸八块","142606706":"雌雄双龙剑・改","142606707":"双炎剑对龙","142606708":"蔷薇利齿","142606709":"蔷薇利齿・改","142606710":"蔷薇野心","142606711":"兄弟剑信仰・改","142606712":"兄弟剑暴君","142606713":"兄弟剑暴君・改","142606714":"沼泽双刀・改","142606715":"泥沼之骨","142606716":"泥沼之骨・改","142606717":"飞雷双剑【小夜】改","142606718":"万雷双剑【小夜】","142606719":"万雷双剑【小夜】改","142606720":"水兽水兽・改","142606721":"水裂水兽水兽","142606722":"水裂水兽水兽・改","142606723":"刚缠钢颤","142606724":"刚缠钢颤・改","142606725":"巨块双剑阿耳戈斯","142606726":"梦幻人鱼利爪・改","142606727":"梦魇双爪人鱼利爪","142606728":"梦魇双爪人鱼利爪・改","142606729":"冰花雪人鱼刃","142606730":"冰花雪人鱼刃・改","142606731":"极光雪爪雪人鱼","142606732":"灼刃火焰诞星","142606733":"灼刃火焰诞星・改","142606734":"焰刃无尽火","142606735":"冰雪双冻刃・改","142606736":"冰雪极寒双刃","142606737":"祸刃【幽鬼无愧】改","142606738":"祸名品【大幽鬼无愧】","142606739":"铠怨鬼刃【怨无悔】","142606740":"斗神鬼【大岳丸】改","142606741":"斗神刚鬼【惊险道】","142606742":"神照・风云一双","142606744":"爆鳞双斧火神伏尔甘","142606745":"爆炎双斧燋烁","142606746":"神照・雷祸一双","142606748":"钢龙狼袭刃・改","142606749":"钢龙烈风刃","142606750":"冰炎剑维尔玛闪焰・改","142606751":"冰炎魔剑","142606752":"双剑霞龙・改","142606753":"霞双剑霞龙","142606754":"赤绝双翼北河弟","142606755":"乌鸦of撕裂者","142606756":"乌鸦of撕裂者・改","142606757":"乌鸦of乘载者","142606758":"THE使徒","142606759":"THE理想乡","142606760":"冥渊双刃【蚀天】","142606761":"鬼神斗拳【狱杀】","142606762":"愤怒之爪・改","142606763":"肉球乱舞爪","142606764":"水母血雨伞・改","142606765":"水母挽歌","142606766":"双曲蝶剑・改","142606768":"双颚蝶剑","142606769":"神圣军刀・改","142606772":"圣徒之刃","142606773":"宝剑格拉姆・改","142606774":"传奇之圣剑","142606775":"忍团子【睡蜜玉】绝","142606776":"忍团子【睡蜜玉】极","142606777":"王国骑士双剑意志","142606779":"王国骑士双剑意志・改","142606780":"远古机械・双剑","142606781":"仙人掌雄心","142606782":"金银龙对剑","142606784":"七星连刃【摇光】","142606803":"村长双刀【不限】","142606804":"村长双刀【不限】改","142606805":"村卫用坚守双刃Ⅱ","142606806":"村卫用坚守双刃Ⅲ","142606807":"护村双刃・勇","142606808":"熔离剑・改","142606813":"香格里拉or哈迪斯","142606815":"冰圣幽冥","142606816":"凶扇【黑风白雨】","142606817":"刻银灭刃","143654912":"金属风笛Ⅰ","143654913":"巨大风笛","143654914":"铁号角Ⅰ","143654915":"风号角","143654916":"重风笛Ⅰ","143654917":"最重音奏笛","143654918":"骨号角Ⅰ","143654919":"骨号角Ⅱ","143654920":"硬骨号角","143654921":"猎人号角Ⅰ","143654922":"土著号角","143654923":"炎火铁笛Ⅰ","143654924":"炎火铁笛Ⅱ","143654925":"炎火铁笛Ⅲ","143654926":"炎火铁笛Ⅳ","143654927":"炎火铁笛Ⅴ","143654928":"炎火忍笛","143654929":"百龙笛Ⅰ","143654930":"百龙笛Ⅱ","143654931":"百龙笛Ⅲ","143654932":"百龙笛【随心所欲】","143654933":"狸兽草笛Ⅰ","143654934":"狸兽草笛Ⅱ","143654935":"狸兽笛中笛","143654936":"魔幻笛Ⅰ","143654937":"魔幻笛Ⅱ","143654938":"魔幻笛Ⅲ","143654939":"魔法魅幻笛","143654940":"龙之轰吼Ⅰ","143654941":"龙之轰吼Ⅱ","143654942":"毒奏范葛萨克斯","143654943":"蜘蛛琴Ⅰ","143654944":"蜘蛛琴Ⅱ","143654945":"蜘蛛弦琴","143654946":"风之贼笛Ⅰ","143654947":"风之贼笛Ⅱ","143654948":"风镰笛鼠小僧","143654949":"借力Ⅰ","143654950":"借力Ⅱ","143654951":"蛙式・借力","143654952":"人鱼常伴Ⅰ","143654953":"人鱼常伴Ⅱ","143654954":"梦幻人鱼常伴","143654955":"祸琵琶【封】Ⅰ","143654956":"祸琵琶【封】Ⅱ","143654957":"祸琵琶【幽鬼无明】","143654958":"庄严钟笛Ⅰ","143654959":"庄严钟笛Ⅱ","143654960":"贵妇洪钟","143654961":"苍风神笛Ⅰ","143654962":"苍风神笛Ⅱ","143654963":"神渊之风【鸣】","143654964":"鸣雷神笛Ⅰ","143654965":"神源之雷【鸣】","143654966":"赫翼拍笛Ⅰ","143654967":"龙天赤笛【霍姆斯】","143654968":"野猪低吼Ⅰ","143654969":"野猪低吼Ⅱ","143654970":"狂野低吼","143654971":"虫甲笛零式Ⅰ","143654972":"虫甲笛零式Ⅱ","143654973":"虫甲笛壹式","143654974":"白虫甲笛零式Ⅰ","143654975":"白虫甲笛零式Ⅱ","143654976":"白虫甲笛壹式","143654977":"绿虫甲笛零式Ⅰ","143654978":"绿虫甲笛零式Ⅱ","143654979":"绿虫甲笛壹式","143654980":"黑虫甲笛零式Ⅰ","143654981":"黑虫甲笛零式Ⅱ","143654982":"黑虫甲笛壹式","143654983":"青熊笛【壹式】Ⅰ","143654984":"青熊笛【壹式】Ⅱ","143654985":"青熊笛【贰式】","143654986":"喙笛Ⅰ","143654987":"喙笛Ⅱ","143654988":"鸟喙速唱","143654989":"水兽笛Ⅰ","143654990":"水兽笛Ⅱ","143654991":"水兽潮笛","143654992":"土砂笙【战之音】Ⅰ","143654993":"土砂笙【战之音】Ⅱ","143654994":"土砂笙【兽之音】","143654995":"奇怪龙号角Ⅰ","143654996":"奇怪龙号角Ⅱ","143654997":"奇奇怪怪长号角","143654998":"避役大笛Ⅰ","143654999":"避役大笛Ⅱ","143655000":"毒妖喉笛","143655001":"岩龙贝斯Ⅰ","143655002":"岩龙贝斯Ⅱ","143655003":"巨人岩龙贝斯","143655004":"女武神战铃Ⅰ","143655005":"女武神战铃Ⅱ","143655006":"女王之笛","143655007":"刮壶打击笛Ⅰ","143655008":"刮壶打击笛Ⅱ","143655009":"冰牙霜冻笛","143655010":"炎羽号角Ⅰ","143655011":"炎羽号角Ⅱ","143655012":"蛮颚炎羽号角","143655013":"隐秘音调Ⅰ","143655014":"隐秘音调Ⅱ","143655015":"夜笛【逢魔】","143655016":"狐铃【无言亦无声】Ⅰ","143655017":"狐铃【无言亦无声】Ⅱ","143655018":"雷鸣音铃之乙鸣","143655019":"烈焰展翼Ⅰ","143655020":"烈焰展翼Ⅱ","143655021":"火龙笛壮志","143655022":"王琴轰雷Ⅰ","143655023":"王琴轰雷Ⅱ","143655024":"王牙琴【鸣雷】","143655025":"轰龙纹笛Ⅰ","143655026":"轰龙纹笛Ⅱ","143655027":"轰鼓【虎钟】","143655028":"双角笛Ⅰ","143655029":"双角笛Ⅱ","143655030":"破笛战栗","143655031":"钢龙狩猎笛Ⅰ","143655032":"钢龙巴风特笛","143655033":"炎王之弦Ⅰ","143655034":"炎王琴笛奥菲斯","143655035":"占卜陶笛Ⅰ","143655036":"咒语陶笛","143655037":"电电太鼓Ⅰ","143655038":"电电太鼓Ⅱ","143655039":"电电太鼓【雷轰】","143655040":"爆鳞太鼓Ⅰ","143655041":"爆鳞太鼓Ⅱ","143655042":"爆鳞鼓赤红星光","143655043":"百龙笛Ⅳ","143655044":"百龙笛Ⅴ","143655045":"村卫用防卫铁笛Ⅰ","143655046":"村卫用坚守铁笛","143655212":"炎火武笛","143655213":"炎火武笛・改","143655214":"炎火杰笛","143655215":"公爵圣杯","143655216":"魔奏悲鸣","143655217":"雷鸣音铃之乙鸣・改","143655218":"雷鸣音通神韵铃","143655219":"雷鸣音通神韵铃・改","143655220":"辟邪之铃【稻荷神】","143655221":"络新妇悲鸣","143655222":"络新妇悲鸣・改","143655223":"永恒怨恨","143655224":"茜红之狩猎钟","143655225":"茜红之狩猎钟・改","143655226":"熔新妇之响钟","143655227":"巨人岩龙贝斯・改","143655228":"泰坦岩龙贝斯","143655229":"王牙琴【鸣雷】改","143655230":"真・王牙琴【天禄】","143655231":"青熊笛【贰式】改","143655232":"青熊笛【叁式】","143655233":"轰鼓【虎钟】改","143655234":"轰鼓【大虎钟】","143655235":"轰鼓【大虎钟】改","143655236":"冰牙鲁利姆","143655237":"冰牙鲁利姆・改","143655238":"冰牙冷河笛","143655239":"梦幻人鱼常伴・改","143655240":"梦魇笛人鱼常伴","143655241":"梦魇笛人鱼常伴・改","143655242":"冰花雪人鱼笛","143655243":"冰花雪人鱼笛・改","143655244":"极光雪笛雪人鱼","143655245":"最重音奏笛・改","143655246":"激昂音奏笛","143655247":"激昂音奏笛・改","143655248":"碧雷狩猎笛","143655249":"碧雷狩猎笛・改","143655250":"雷霆狩猎笛","143655251":"冷月弦乐器","143655252":"冷月弦乐器・改","143655253":"冰镜圆月弦","143655254":"夜笛【夜幕】","143655255":"夜笛【夜幕】改","143655256":"无明笛【假谛】","143655257":"毒妖喉笛・改","143655258":"毒妖笛音变色龙","143655259":"毒妖笛音变色龙・改","143655260":"蛮颚炎羽号角・改","143655261":"号角蛮炎笛","143655262":"号角蛮炎笛・改","143655263":"女王之笛・改","143655264":"女帝之笛","143655265":"女帝之笛・改","143655266":"蔷薇吉他","143655267":"蔷薇吉他・改","143655268":"蔷薇灵魂","143655269":"土砂笙【兽之音】改","143655270":"土砂笙【严之音】","143655271":"土砂笙【严之音】\t改","143655272":"蛙式・借力改","143655273":"真蛙式・借力","143655274":"真蛙式・借力改","143655275":"风镰笛鼠小僧・改","143655276":"大风镰笛金风","143655277":"水兽潮笛・改","143655278":"水兽水响笛","143655279":"水兽水响笛・改","143655280":"刚缠之鼓","143655281":"刚缠之鼓・改","143655282":"巨块鼓布戎忒斯","143655286":"甲壳响板","143655287":"甲壳响板・改","143655288":"大名盾蟹响板","143655289":"狩猎笛参宿七","143655290":"狩猎笛参宿七・改","143655291":"叛笛参宿七","143655292":"破笛战栗・改","143655293":"角王笛低音大号","143655294":"角王笛低音大号・改","143655295":"豪爽低吼","143655296":"豪爽低吼・改","143655297":"蛮族低吼","143655298":"音速笛","143655299":"音速笛・改","143655300":"\t女王笛","143655301":"火龙笛壮志・改","143655302":"红焰狩猎笛","143655303":"鸟喙速唱・改","143655304":"鸟喙信天鸡蛇笛","143655305":"奇奇怪怪长号角・改","143655306":"奇怪叫吼长号角","143655307":"奇怪叫吼长号角・改","143655308":"黑虫甲笛贰式","143655309":"黑虫甲笛叁式","143655310":"黑虫甲笛肆式","143655311":"绿虫甲笛贰式","143655312":"绿虫甲笛叁式","143655313":"白虫甲笛贰式","143655314":"白虫甲笛叁式","143655315":"祸琵琶【幽鬼无明】改","143655316":"祸名品【大幽鬼无明】","143655317":"铠怨鬼琵琶【怨无明】","143655318":"电电太鼓【雷轰】改","143655319":"电电大太鼓【雷神】","143655320":"神响・风云啼哭","143655322":"爆鳞鼓赤红喷焰","143655323":"炸裂星火爆炎鼓","143655324":"神响・雷祸啼哭","143655326":"钢龙巴风特笛・改","143655327":"钢龙冷酷魂笛","143655328":"炎王琴笛奥菲斯・改","143655329":"炎王红莲琴笛","143655330":"咒语陶笛・改","143655331":"魔神陶笛","143655332":"赤绝澄翼帝王星","143655333":"音色of哭号","143655334":"音色of哭号・改","143655335":"音色of灭亡","143655336":"THE安魂曲","143655337":"THE额我略圣咏","143655338":"冥渊大笛【地陷】","143655339":"鬼神电鼓【绯之魂】","143655340":"毒奏范葛萨克斯・改","143655342":"大毒奏葛萨克斯","143655343":"魔法魅幻笛・改","143655345":"终极恋钟魔法之钟","143655346":"蛛琴笛丝","143655348":"大蜘蛛弦琴","143655349":"狸兽笛中笛・改","143655350":"狸古笛余韵绕梁","143655351":"王国骑士狩猎笛灵魂","143655353":"王国骑士狩猎笛灵魂・改","143655354":"远古机械・狩猎笛","143655355":"仙人掌灵魂","143655356":"金猎笛","143655358":"斗宿笛【天梁】","143655365":"村卫用坚守铁笛Ⅱ","143655366":"村卫用坚守铁笛Ⅲ","143655367":"护村铁笛・勇","143655372":"欣喜or恐惧","143655374":"冰琴冻土","143655375":"凶琴【秋岚】","143655376":"刻银打笛","144703488":"铁刺刀Ⅰ","144703489":"铁刺刀Ⅱ","144703490":"刺刀【飞天】","144703491":"铁制长刀Ⅰ","144703492":"铁制长刀Ⅱ","144703493":"钢铁长刀","144703494":"骨制虫棍Ⅰ","144703495":"骨制虫棍Ⅱ","144703496":"舞空长刃","144703497":"坚实长棍Ⅰ","144703498":"坚实长棍Ⅱ","144703499":"坚实极长棍","144703500":"高空长刃Ⅰ","144703501":"高空长刃Ⅱ","144703502":"至高长刃","144703503":"炎火铁刃棍Ⅰ","144703504":"炎火铁刃棍Ⅱ","144703505":"炎火铁刃棍Ⅲ","144703506":"炎火铁刃棍Ⅳ","144703507":"炎火铁刃棍Ⅴ","144703508":"炎火忍刃棍","144703509":"百龙刃棍Ⅰ","144703510":"百龙刃棍Ⅱ","144703511":"百龙刃棍Ⅲ","144703512":"百龙刃棍【千姿百态】","144703513":"狩猎笔【跳跃】Ⅰ","144703514":"狩猎笔【跳跃】Ⅱ","144703515":"狩猎笔【花虫画】","144703516":"魔法少女虫杖Ⅰ","144703517":"魔法少女虫杖Ⅱ","144703518":"魔法少女虫杖Ⅲ","144703519":"魔法少女月杖","144703520":"暴君Ⅰ","144703521":"暴君Ⅱ","144703522":"祸棍伽拉摩尔斯","144703523":"伞长棍Ⅰ","144703524":"伞长棍Ⅱ","144703525":"晓之溃棍戒骑","144703526":"八艘跳Ⅰ","144703527":"八艘跳Ⅱ","144703528":"蛙式・八艘跳","144703529":"人鱼轻抚Ⅰ","144703530":"人鱼轻抚Ⅱ","144703531":"梦幻人鱼轻抚","144703532":"祸矛【封】Ⅰ","144703533":"祸矛【封】Ⅱ","144703534":"祸矛【幽鬼无煌】","144703535":"雪鬼兽咯嘣Ⅰ","144703536":"雪鬼兽咯嘣Ⅱ","144703537":"雪鬼兽咯嘣！","144703538":"苍风神棍Ⅰ","144703539":"苍风神棍Ⅱ","144703540":"神渊之风【翔】","144703541":"鸣雷神棍Ⅰ","144703542":"神源之雷【翔】","144703543":"赫翼锐棍Ⅰ","144703544":"龙天赤棍【休梅克】","144703545":"常春藤零式Ⅰ","144703546":"常春藤零式Ⅱ","144703547":"常春藤壹式","144703548":"深红常春藤零式Ⅰ","144703549":"深红常春藤零式Ⅱ","144703550":"深红常春藤壹式","144703551":"雪白常春藤零式Ⅰ","144703552":"雪白常春藤零式Ⅱ","144703553":"雪白常春藤壹式","144703554":"碧绿常春藤零式Ⅰ","144703555":"碧绿常春藤零式Ⅱ","144703556":"碧绿常春藤壹式","144703557":"漆黑常春藤零式Ⅰ","144703558":"漆黑常春藤零式Ⅱ","144703559":"漆黑常春藤壹式","144703560":"甲虫三叉戟Ⅰ","144703561":"甲虫三叉戟Ⅱ","144703562":"甲虫三叉锐戟","144703563":"白兔耳刃Ⅰ","144703564":"白兔耳刃Ⅱ","144703565":"冰霜耳刃","144703566":"喙棍Ⅰ","144703567":"喙棍Ⅱ","144703568":"鸟喙飞跃","144703569":"皇家扫帚Ⅰ","144703570":"皇家扫帚Ⅱ","144703571":"皇家御用扫帚","144703572":"雷光膛棍Ⅰ","144703573":"雷光膛棍Ⅱ","144703574":"雷光膛棍MAX","144703575":"避役长棍Ⅰ","144703576":"避役长棍Ⅱ","144703577":"毒妖喉棍","144703578":"公主宝器Ⅰ","144703579":"公主宝器Ⅱ","144703580":"女王宝器","144703581":"琥珀曲棍Ⅰ","144703582":"琥珀曲棍Ⅱ","144703583":"巨狼暴风雨","144703584":"飞雷棍虫蛇Ⅰ","144703585":"飞雷棍虫蛇Ⅱ","144703586":"飞雷棍【日本号】","144703587":"炎羽棍杖Ⅰ","144703588":"炎羽棍杖Ⅱ","144703589":"蛮颚炎羽棍杖","144703590":"隐秘之镰Ⅰ","144703591":"隐秘之镰Ⅱ","144703592":"暗镰棍【夜风宁】","144703593":"狐薙刀【秋风引枝露】Ⅰ","144703594":"狐薙刀【秋风引枝露】Ⅱ","144703595":"薹草长薙之漩涡","144703596":"火龙棍Ⅰ","144703597":"火龙棍Ⅱ","144703598":"火龙棍【炎舞】","144703599":"王棍雷电Ⅰ","144703600":"王棍雷电Ⅱ","144703601":"王牙棍【别雷】","144703602":"轰龙腕Ⅰ","144703603":"轰龙腕Ⅱ","144703604":"轰腕【虎爪】","144703605":"角龙角虫棍Ⅰ","144703606":"角龙角虫棍Ⅱ","144703607":"暴君虫棍","144703608":"灵魂钢龙棍Ⅰ","144703609":"冰体钢龙棍","144703610":"轮棍Ⅰ","144703611":"烟雾轮棍","144703612":"金碎棍棒Ⅰ","144703613":"金碎棍棒Ⅱ","144703614":"金碎棍豪电雷","144703615":"百龙刃棍Ⅳ","144703616":"百龙刃棍Ⅴ","144703617":"村卫用防卫刃棍Ⅰ","144703618":"村卫用坚守刃棍","144703788":"炎火武刃棍","144703789":"炎火武刃棍・改","144703790":"炎火杰刃棍","144703791":"公爵权杖","144703792":"鞭笞之杖","144703793":"暗镰棍【万籁俱寂】","144703794":"暗镰棍【万籁俱寂】改","144703795":"无明镰棍【正语】","144703796":"薹草长薙之漩涡・改","144703797":"薹草长夜华山薙","144703798":"薹草长夜华山薙・改","144703799":"辟邪之薙刀【流星蛱蝶】","144703800":"梦幻人鱼轻抚・改","144703801":"梦魇棍人鱼轻抚","144703802":"梦魇棍人鱼轻抚・改","144703803":"冰花雪人鱼棍","144703804":"冰花雪人鱼棍・改","144703805":"极光雪棍雪人鱼","144703806":"轰腕【虎爪】改","144703807":"轰腕【大虎爪】","144703808":"轰腕【大虎爪】改","144703809":"蛙式・八艘跳改","144703810":"真蛙式・八艘跳","144703811":"真蛙式・八艘跳改","144703812":"刺刀【斩钉击铁】","144703813":"刺刀【斩钉击铁】改","144703814":"钢刺刀【斩钉击铁】","144703815":"冷月双刃棍","144703816":"冷月双刃棍・改","144703817":"冰镜圆月棍","144703818":"雷牙之霆龙棍","144703819":"雷牙之霆龙棍・改","144703820":"万雷之霆龙棍","144703821":"火龙棍【炎舞】改","144703822":"炎爪之焰龙棍","144703823":"雷光膛棍MAX・改","144703824":"究极雷光膛棍","144703825":"究极雷光膛棍・改","144703826":"女王宝器・改","144703827":"女帝宝棍","144703828":"女帝宝棍・改","144703829":"蔷薇刺棍","144703830":"蔷薇刺棍・改","144703831":"蔷薇跳跃","144703832":"晓月打棍骁勇","144703833":"晓光打棍荣光","144703834":"鸟喙飞跃・改","144703835":"鸟喙信天鸡蛇棍","144703836":"飞雷棍【日本号】改","144703837":"万雷棍【日本号】","144703838":"万雷棍【日本号】改","144703839":"冰霜耳刃・改","144703840":"冰霜竖耳刃","144703841":"坚实极长棍・改","144703842":"高密度硬棍","144703843":"高密度硬棍・改","144703844":"虫棍河鼓二","144703845":"虫棍河鼓二・改","144703846":"叛棍河鼓二","144703847":"甲壳轮棍","144703848":"甲壳轮棍・改","144703849":"蟹轮棍","144703850":"至高长刃・改","144703851":"穹顶长刃","144703852":"穹顶长刃・改","144703853":"暴君虫棍・改","144703854":"角王废戟","144703855":"蛮颚炎羽棍杖・改","144703856":"直杆蛮炎棍","144703857":"直杆蛮炎棍・改","144703858":"雪鬼兽咯嘣嘣","144703859":"雪鬼兽咯嘣嘣・改","144703860":"雪鬼兽！咯嘣咯嘣！","144703861":"毒妖喉棍・改","144703862":"毒妖棍散毒变色龙","144703863":"毒妖棍散毒变色龙・改","144703864":"尘世巨蟒风暴","144703865":"尘世巨蟒风暴・改","144703866":"绝对冥界女王","144703867":"皇家御用扫帚・改","144703868":"皇家水跃扫帚","144703869":"皇家水跃扫帚・改","144703870":"刚缠长柄刀","144703871":"刚缠长柄刀・改","144703872":"巨块棍歌利亚","144703873":"王牙棍【别雷】改","144703874":"真・王牙棍【天来】","144703875":"甲虫三叉锐戟・改","144703876":"操虫三叉戟","144703877":"操虫三叉戟・改","144703878":"深红常春藤贰式","144703879":"深红常春藤叁式","144703880":"深红常春藤肆式","144703881":"漆黑常春藤贰式","144703882":"漆黑常春藤叁式","144703883":"雪白常春藤贰式","144703884":"雪白常春藤叁式","144703885":"碧绿常春藤贰式","144703886":"碧绿常春藤叁式","144703887":"祸矛【幽鬼无煌】改","144703888":"祸名品【大幽鬼无煌】","144703889":"铠怨鬼矛【怨无煌】","144703890":"金碎棍豪电雷・改","144703891":"金刚碎棍豪电神","144703892":"神翔・风云杀界","144703894":"神翔・雷祸杀界","144703896":"冰体钢龙棍・改","144703897":"锈冰钢龙棍","144703898":"烟雾轮棍・改","144703899":"薄雾轮棍","144703900":"赤绝跃翼天鹰郎","144703901":"狙击of戏法","144703902":"狙击of戏法・改","144703903":"狙击of魔幻","144703904":"THE追踪者","144703905":"THE奇迹","144703906":"冥渊战棍【蝗噬】","144703907":"鬼神棍【猿王】","144703908":"祸棍伽拉摩尔斯・改","144703910":"灾祸棍达尔克摩尔斯","144703911":"魔法少女月杖・改","144703913":"终极爱棍魔法之月","144703914":"狩猎笔【新世界】","144703916":"狩猎笔【猎人赞歌】","144703917":"王国骑士操虫棍希望","144703919":"王国骑士操虫棍希望・改","144703920":"远古机械・操虫棍","144703921":"仙人掌跳跃","144703922":"乾坤火龙棍","144703924":"斗宿棍【天同】","144703933":"晓月打棍骁勇・改","144703934":"角王废戟・改","144703935":"村卫用坚守刃棍Ⅱ","144703936":"村卫用坚守刃棍Ⅲ","144703937":"护村刃棍・勇","144703943":"叹息or惊异","144703945":"冰贤友爱","144703946":"凶轮【云霓】","144703947":"刻银刺棍","145752064":"混铅盾斧Ⅰ","145752065":"混铅盾斧Ⅱ","145752066":"合金盾斧","145752067":"精锐讨伐队盾斧Ⅰ","145752068":"精锐讨伐队盾斧Ⅱ","145752069":"帝王护卫","145752070":"骑士团队证盾斧Ⅰ","145752071":"骑士团队证盾斧Ⅱ","145752072":"女武神斧","145752073":"骨盾斧Ⅰ","145752074":"骨盾斧Ⅱ","145752075":"骨粒之盾","145752076":"骨制兵装Ⅰ","145752077":"骨制兵装Ⅱ","145752078":"硬骨兵装","145752079":"淬毒之盾Ⅰ","145752080":"淬毒之盾Ⅱ","145752081":"污染之盾","145752082":"龙语盾斧Ⅰ","145752083":"龙语盾斧Ⅱ","145752084":"龙吼盾斧","145752085":"炎火铁盾斧Ⅰ","145752086":"炎火铁盾斧Ⅱ","145752087":"炎火铁盾斧Ⅲ","145752088":"炎火铁盾斧Ⅳ","145752089":"炎火铁盾斧Ⅴ","145752090":"炎火忍盾斧","145752091":"百龙盾斧Ⅰ","145752092":"百龙盾斧Ⅱ","145752093":"百龙盾斧Ⅲ","145752094":"百龙盾斧【随机应变】","145752095":"糯米团盾斧猫杵Ⅰ","145752096":"糯米团盾斧猫杵Ⅱ","145752097":"捣糯米团盾斧猫臼","145752098":"可爱猫盾斧Ⅰ","145752099":"可爱猫盾斧Ⅱ","145752100":"好眠猫盾斧","145752101":"巨剪虫斧Ⅰ","145752102":"巨剪虫斧Ⅱ","145752103":"钳刃斧","145752104":"维京之盾Ⅰ","145752105":"维京之盾Ⅱ","145752106":"鲜斧黄金鲤之盾","145752107":"风之贼盾斧Ⅰ","145752108":"风之贼盾斧Ⅱ","145752109":"风镰盾斧亚努西克","145752110":"环首掼Ⅰ","145752111":"环首掼Ⅱ","145752112":"蛙式・环首掼","145752113":"人鱼低吟Ⅰ","145752114":"人鱼低吟Ⅱ","145752115":"梦幻人鱼低吟","145752116":"祸钺【封】Ⅰ","145752117":"祸钺【封】Ⅱ","145752118":"祸钺【幽鬼无极】","145752119":"雪鬼兽咔嚓Ⅰ","145752120":"雪鬼兽咔嚓Ⅱ","145752121":"雪鬼兽咔嚓！","145752122":"严峻门斧Ⅰ","145752123":"严峻门斧Ⅱ","145752124":"贵妇闺门","145752125":"苍风神盾斧Ⅰ","145752126":"苍风神盾斧Ⅱ","145752127":"神渊之风【御】","145752128":"鸣雷神盾斧Ⅰ","145752129":"神源之雷【御】","145752130":"赫翼盾斧Ⅰ","145752131":"龙天赤盾斧【一八六一】","145752132":"土砂盾斧Ⅰ","145752133":"土砂盾斧Ⅱ","145752134":"土砂硬甲盾斧","145752135":"回转圆盘Ⅰ","145752136":"回转圆盘Ⅱ","145752137":"甲盾斧回转","145752138":"泥磨坚盾Ⅰ","145752139":"泥磨坚盾Ⅱ","145752140":"沼泽坚盾","145752141":"巨人神兵Ⅰ","145752142":"巨人神兵Ⅱ","145752143":"巨人神兵Ⅲ","145752144":"泰坦神兵","145752145":"焰火盾斧Ⅰ","145752146":"焰火盾斧Ⅱ","145752147":"雌火盾斧","145752148":"纯白骑士Ⅰ","145752149":"纯白骑士Ⅱ","145752150":"纯白骑士Ⅲ","145752151":"琉璃骑士","145752152":"飞雷盾斧断蛇Ⅰ","145752153":"飞雷盾斧断蛇Ⅱ","145752154":"飞雷盾斧【大典太】","145752155":"隐秘长兵Ⅰ","145752156":"隐秘长兵Ⅱ","145752157":"夜行盾斧【冥冥中】","145752158":"狐衣斧【镜花水月深】Ⅰ","145752159":"狐衣斧【镜花水月深】Ⅱ","145752160":"白布衣斧之帝王","145752161":"炎斧蛇王Ⅰ","145752162":"炎斧蛇王Ⅱ","145752163":"红莲斧鱼王","145752164":"王盾斧雷纹Ⅰ","145752165":"王盾斧雷纹Ⅱ","145752166":"王牙盾斧【风雷】","145752167":"轰龙切割者Ⅰ","145752168":"轰龙切割者Ⅱ","145752169":"轰盾斧【骑虎】","145752170":"角龙武装Ⅰ","145752171":"角龙武装Ⅱ","145752172":"角龙暴怒武装","145752173":"钢龙冰盾Ⅰ","145752174":"钢龙幻梦","145752175":"炎王强袭者Ⅰ","145752176":"炎王新星","145752177":"塔罗神抽Ⅰ","145752178":"心象天启","145752179":"金刚盾斧Ⅰ","145752180":"金刚盾斧Ⅱ","145752181":"金刚盾斧雷霆","145752182":"百龙盾斧Ⅳ","145752183":"百龙盾斧Ⅴ","145752184":"村卫用防卫盾斧Ⅰ","145752185":"村卫用坚守盾斧","145752364":"炎火武盾斧","145752365":"炎火武盾斧・改","145752366":"炎火杰盾斧","145752367":"公爵之盾","145752368":"血鹰雄雕","145752369":"雌火盾斧・改","145752370":"女王盾斧","145752371":"女王盾斧・改","145752372":"蔷薇刺痛","145752373":"蔷薇刺痛・改","145752374":"蔷薇流血","145752375":"冰霜骑士","145752376":"冰霜骑士・改","145752377":"流冰骑士团","145752378":"王牙盾斧【风雷】改","145752379":"真・王牙盾斧【轰天】","145752380":"蛙式・环首掼改","145752381":"真蛙式・环首掼","145752382":"真蛙式・环首掼改","145752383":"泰坦神兵・改","145752385":"歌利亚神臂","145752386":"雪鬼兽咔嚓嚓","145752387":"雪鬼兽咔嚓嚓・改","145752388":"雪鬼兽！咔嚓咔嚓！","145752389":"帝王护卫・改","145752390":"帝王指挥官","145752391":"帝王指挥官・改","145752392":"冷月盾斧","145752393":"冷月盾斧・改","145752394":"冰镜圆月盾斧","145752395":"女武神斧・改","145752396":"特里斯坦伊索尔德","145752397":"特里斯坦伊索尔德・改","145752398":"电闪斧翠绿","145752399":"雳雷斧阿姆伽拉克力士","145752400":"雳雷斧阿姆伽拉克力士・改","145752401":"络新妇幻梦","145752402":"络新妇幻梦・改","145752403":"永恒苦闷","145752404":"浅红之门盾斧","145752405":"浅红之门盾斧・改","145752406":"熔新妇之入口斧","145752407":"轰盾斧【骑虎】改","145752408":"轰盾斧【骑猛虎】","145752409":"轰盾斧【骑猛虎】改","145752410":"白布衣斧之帝王・改","145752411":"白布衣纹冥护斧","145752412":"白布衣纹冥护斧・改","145752413":"辟邪之衣斧【大纹白蝶】","145752414":"飞雷盾斧【大典太】改","145752415":"万雷盾斧【大典太】","145752416":"万雷盾斧【大典太】改","145752417":"风镰盾斧亚努西克・改","145752418":"大风镰盾斧东南风","145752419":"夜行盾斧【五月暗】","145752420":"夜行盾斧【五月暗】改","145752421":"无明盾斧【正见】","145752422":"骨粒之盾・改","145752423":"断骨盾斧","145752424":"断骨盾斧・改","145752425":"盾斧觜宿一","145752426":"盾斧觜宿一・改","145752427":"叛盾斧觜宿一","145752428":"大刀侍卫","145752429":"大刀侍卫・改","145752430":"杀人如麻","145752431":"沼泽坚盾・改","145752432":"泥沼之角","145752433":"泥沼之角・改","145752434":"红莲斧鱼王・改","145752435":"朱炎斧烈焰","145752436":"梦幻人鱼低吟・改","145752437":"梦魇盾斧人鱼低吟","145752438":"梦魇盾斧人鱼低吟・改","145752439":"冰花雪人鱼斧","145752440":"冰花雪人鱼斧・改","145752441":"极光雪斧雪人鱼","145752442":"污染之盾・改","145752443":"毒盾斧猛毒","145752444":"毒盾斧猛毒・改","145752445":"龙吼盾斧・改","145752446":"龙盾斧龙怒","145752447":"龙盾斧龙怒・改","145752448":"土砂守卫者","145752449":"土砂坚甲盾斧","145752450":"刚缠之心","145752451":"刚缠之心・改","145752452":"巨块盾斧霜巨人洛奇","145752453":"角龙暴怒武装・改","145752454":"角王盾斧吉欧布罗斯","145752455":"甲盾斧回转・改","145752456":"激甲盾斧力矩回转","145752457":"激甲盾斧力矩回转・改","145752458":"祸钺【幽鬼无极】改","145752459":"祸名品【大幽鬼无极】","145752460":"铠怨鬼钺【怨无极】","145752461":"金刚盾斧雷霆・改","145752462":"金刚大盾斧雷时","145752463":"神佑・风云宿命","145752465":"神佑・雷祸宿命","145752467":"钢龙幻梦・改","145752468":"钢龙白日梦","145752469":"炎王新星・改","145752470":"炎王炙鬼之炎","145752471":"心象天启・改","145752472":"幻狂天意","145752473":"赤绝巧翼天津宿","145752474":"力量of堕落","145752475":"力量of堕落・改","145752476":"力量of灾厄","145752477":"THE抑制","145752478":"THE救赎者","145752479":"冥渊盾斧【裂地】","145752480":"鬼神盾斧【夜叉】","145752481":"捣糯米团盾斧猫臼・改","145752482":"大捣糯米团盾斧杵臼王","145752483":"好眠猫盾斧・改","145752484":"不祥恶魔","145752485":"钳刃斧・改","145752486":"钳刃裂斧","145752487":"鲜斧黄金鲤之盾・改","145752488":"新鲜斧黄金鲤之魂","145752489":"王国骑士盾斧精神","145752491":"王国骑士盾斧精神・改","145752492":"远古机械・盾斧","145752493":"仙人掌流血","145752494":"月神金盾","145752495":"业火斧狱雷","145752497":"斗宿盾斧【天机】","145752504":"土砂守卫者・改","145752505":"角王盾斧吉欧布罗斯・改","145752506":"村卫用坚守盾斧Ⅱ","145752507":"村卫用坚守盾斧Ⅲ","145752508":"护村盾斧・勇","145752513":"和平or灾厄","145752515":"冰臣壁垒","145752516":"凶华【胧云】","145752517":"刻银削斧","146800640":"猎枪Ⅰ","146800641":"猎枪Ⅱ","146800642":"狙杀弩枪","146800643":"猎师铳Ⅰ","146800644":"猎师铳Ⅱ","146800645":"熟钢猎师铳","146800646":"十字弩Ⅰ","146800647":"十字弩Ⅱ","146800648":"交错火光","146800649":"帆船轻弩Ⅰ","146800650":"帆船轻弩Ⅱ","146800651":"咬弹追捕者","146800652":"炎火铁轻弩Ⅰ","146800653":"炎火铁轻弩Ⅱ","146800654":"炎火铁轻弩Ⅲ","146800655":"炎火铁轻弩Ⅳ","146800656":"炎火铁轻弩Ⅴ","146800657":"炎火忍轻弩","146800658":"百龙轻弩Ⅰ","146800659":"百龙轻弩Ⅱ","146800660":"百龙轻弩Ⅲ","146800661":"百龙轻弩【沧桑变幻】","146800662":"木雕犬铳Ⅰ","146800663":"木雕犬铳Ⅱ","146800664":"木雕犬铳【嗷呜】","146800665":"春夜鲤炮Ⅰ","146800666":"春夜鲤炮Ⅱ","146800667":"春夜鲤炮【跃龙门】","146800668":"风之贼铳Ⅰ","146800669":"风之贼铳Ⅱ","146800670":"风之贼铳Ⅲ","146800671":"风镰铳罗萨","146800672":"天具・莲花铳Ⅰ","146800673":"天具・莲花铳Ⅱ","146800674":"大天具・花铳观音","146800675":"祸弩【封】Ⅰ","146800676":"祸弩【封】Ⅱ","146800677":"祸弩【幽鬼无妄】","146800678":"雪鬼兽砰Ⅰ","146800679":"雪鬼兽砰Ⅱ","146800680":"雪鬼兽砰Ⅲ","146800681":"雪鬼兽砰！","146800682":"泥＝岩Ⅰ","146800683":"泥＝岩Ⅱ","146800684":"崩＝溃","146800685":"光耀灯笼Ⅰ","146800686":"光耀灯笼Ⅱ","146800687":"贵妇提灯","146800688":"苍风神弩Ⅰ","146800689":"苍风神弩Ⅱ","146800690":"神渊之风【击】","146800691":"鸣雷神弩Ⅰ","146800692":"神源之雷【击】","146800693":"赫翼连弩Ⅰ","146800694":"龙天赤弩【柯侯德】","146800695":"水兽发射器Ⅰ","146800696":"水兽发射器Ⅱ","146800697":"水兽风暴","146800698":"土砂轻弩Ⅰ","146800699":"土砂轻弩Ⅱ","146800700":"土砂贯钢穿铁弩","146800701":"紧绷绷注射筒Ⅰ","146800702":"紧绷绷注射筒Ⅱ","146800703":"紧绷绷注射筒Ⅲ","146800704":"弹力十足注射筒","146800705":"霰弹弩・蛇Ⅰ","146800706":"霰弹弩・蛇Ⅱ","146800707":"霰弹弩・蛇Ⅲ","146800708":"弹浴・蛇","146800709":"熔岩兽飓风Ⅰ","146800710":"熔岩兽飓风Ⅱ","146800711":"熔岩弩乌鲁柯特","146800712":"出泥弹雨Ⅰ","146800713":"出泥弹雨Ⅱ","146800714":"沼泽弹雨","146800715":"榴弹弩Ⅰ","146800716":"榴弹弩Ⅱ","146800717":"榴弹弩Ⅲ","146800718":"榴弹左轮","146800719":"女武神之火Ⅰ","146800720":"女武神之火Ⅱ","146800721":"女武神烈焰","146800722":"暴风雪加农炮Ⅰ","146800723":"暴风雪加农炮Ⅱ","146800724":"暴风雪冰雹弩","146800725":"炎羽火筒Ⅰ","146800726":"炎羽火筒Ⅱ","146800727":"蛮颚炎羽火筒","146800728":"隐秘连击弩Ⅰ","146800729":"隐秘连击弩Ⅱ","146800730":"夜行弩【枭之眼】","146800731":"狐水铳【滴滴映此生】Ⅰ","146800732":"狐水铳【滴滴映此生】Ⅱ","146800733":"飞燕轻弩之水珠","146800734":"火龙炮Ⅰ","146800735":"火龙炮Ⅱ","146800736":"凤仙火龙炮","146800737":"王弩雷管Ⅰ","146800738":"王弩雷管Ⅱ","146800739":"王牙弩【野雷】","146800740":"轰龙战车Ⅰ","146800741":"轰龙战车Ⅱ","146800742":"轰弩【战虎】","146800743":"钢冰蜂弩Ⅰ","146800744":"钢龙冰蜂弩","146800745":"炎王焰弩Ⅰ","146800746":"炎王焰弩【烈火】","146800747":"占卜灯Ⅰ","146800748":"魔咒灯","146800749":"金狮子弩Ⅰ","146800750":"金狮子弩Ⅱ","146800751":"金狮子筒【万雷】","146800752":"爆鳞铳弩Ⅰ","146800753":"爆鳞铳弩Ⅱ","146800754":"爆鳞腹弩","146800755":"百龙轻弩Ⅳ","146800756":"百龙轻弩Ⅴ","146800757":"村卫用防卫轻弩Ⅰ","146800758":"村卫用坚守轻弩","146800940":"炎火武轻弩","146800941":"炎火武轻弩・改","146800942":"炎火杰轻弩","146800943":"公爵火绳钩枪","146800944":"葬银弹丸","146800945":"夜行弩【鸺之眼】","146800946":"夜行弩【鸺之眼】改","146800947":"无明弩【正业】","146800948":"络新妇贪食","146800949":"络新妇贪食・改","146800950":"永恒黑暗","146800951":"赤红之灯连弩","146800952":"熔新妇之明灯弩","146800953":"救赎具・花铳观音","146800954":"救赎具・花铳观音改","146800955":"救赎王・观音之天铳","146800956":"绯天具・花铳观音","146800957":"绯天具・花铳观音改","146800958":"绯天之铳・六仙观音","146800959":"弹力十足注射筒・改","146800960":"邪念注射筒","146800961":"邪念注射筒・改","146800962":"弹浴・蛇改","146800963":"弹雨・蛇","146800964":"土砂贯钢穿铁弩・改","146800965":"土砂迷雾・改","146800966":"雪鬼兽砰砰砰","146800967":"雪鬼兽砰砰砰・改","146800968":"雪鬼兽！砰砰砰砰！","146800969":"熟钢猎师铳Ⅱ","146800970":"熟钢猎师铳Ⅲ","146800971":"钢铁猎师铳","146800972":"冷月狼弩","146800973":"冷月狼弩・改","146800974":"冰镜圆月驽","146800975":"浪涌电龙炮【翠电】","146800976":"浪涌电龙炮【翠电】改","146800977":"浪涌电龙炮【瞬电】","146800978":"王牙弩【野雷】改","146800979":"真・王牙弩【天鼓】","146800980":"泥＝四散","146800981":"泥＝四散・改","146800982":"泥＝诱惑","146800983":"熔岩炮","146800984":"溶翁轻弩炼金","146800985":"熔岩弩乌鲁柯特・改","146800986":"熔山弩乌鲁柯特地狱","146800987":"飞燕轻弩之水珠・改","146800988":"飞燕轻妙灵水弩","146800989":"飞燕轻妙灵水弩・改","146800990":"辟邪之焰铳【八尾狐】","146800991":"风镰铳罗萨・改","146800992":"大风镰铳东风","146800993":"蛮颚炎羽火筒・改","146800994":"火筒蛮炎弩","146800996":"火筒蛮炎弩・改","146800997":"女武神烈焰・改","146800998":"深碧烈弩","146800999":"深碧烈弩・改","146801000":"蔷薇步枪","146801001":"蔷薇步枪・改","146801002":"蔷薇胜利","146801003":"咬弹追捕者・改","146801004":"追袭之黑铳","146801005":"追袭之黑铳・改","146801006":"轻弩尾宿八","146801007":"轻弩尾宿八・改","146801008":"叛弩尾宿八","146801009":"条纹碎甲弩","146801010":"条纹碎甲弩・改","146801011":"大名盾蟹甲弩","146801012":"沼泽弹雨・改","146801013":"泥沼之鳃","146801014":"泥沼之鳃・改","146801015":"凤仙火龙炮・改","146801016":"凤仙火龙炮【朱炎】","146801017":"暴风雪旋涡弩","146801018":"暴风雪旋涡弩・改","146801019":"暴风雪冻结弩","146801020":"榴弹左轮・改","146801022":"致命左轮","146801023":"轰弩【战虎】改","146801024":"轰弩【大战虎】","146801025":"轰弩【大战虎】改","146801026":"水兽风暴・改","146801027":"水兽陨落","146801028":"水兽陨落・改","146801029":"刚缠突击者","146801030":"刚缠突击者・改","146801031":"巨块弩百臂巨人","146801032":"祸弩【幽鬼无妄】改","146801033":"祸名品【大幽鬼无妄】","146801034":"铠怨鬼弩【怨无妄】","146801035":"金狮子筒【万雷】改","146801036":"金狮子筒【兆雷】","146801037":"神击・风云十全","146801039":"爆鳞弩爆竹","146801040":"爆鳞龙核心","146801041":"神击・雷祸十全","146801043":"钢龙冰蜂弩・改","146801044":"钢龙冰蜂寒弩","146801045":"炎王焰弩【烈火】改","146801046":"炎帝王焰弩【红天】","146801047":"魔咒灯・改","146801048":"魔法神灯","146801049":"赤绝耀翼南门星","146801050":"光阴of洁白","146801051":"光阴of洁白・改","146801052":"光阴of理想乡","146801053":"THE神谕者","146801054":"THE美德","146801055":"冥渊轻弩【雹霰】","146801056":"鬼神筒【雷天】","146801057":"木雕犬铳【嗷呜】改","146801059":"木雕犬铳・极式【咆哮】","146801060":"春夜鲤炮【跃龙门】改","146801061":"早来恋･春夜鲤炮","146801062":"王国骑士轻弩慈悲","146801064":"王国骑士轻弩慈悲・改","146801065":"远古机械・轻弩","146801066":"巨甲虫炮","146801067":"巨甲虫炮・改","146801068":"甲铳巨甲虫炮","146801069":"仙人掌胜利","146801070":"凤仙火龙炮【银炎】","146801071":"黄金女武神","146801073":"斗宿铳【天相】","146801082":"土砂迷雾","146801083":"村卫用坚守轻弩Ⅱ","146801084":"村卫用坚守轻弩Ⅲ","146801085":"护村轻弩・勇","146801092":"赤红之灯连弩・改","146801093":"熔岩炮・改","146801101":"罪恶or美德","146801103":"冰姬隼击","146801104":"凶针【水祸】","146801105":"刻银讨铳","147849216":"铁制突击弩Ⅰ","147849217":"铁制突击弩Ⅱ","147849218":"钢铁突击弩","147849219":"陨石火箭炮Ⅰ","147849220":"陨石火箭炮Ⅱ","147849221":"陨石加农炮","147849222":"讨伐队正式重炮Ⅰ","147849223":"讨伐队正式重炮Ⅱ","147849224":"近卫队正式重炮","147849225":"骨制发射器Ⅰ","147849226":"骨制发射器Ⅱ","147849227":"骨制破坏者","147849228":"炎火铁重弩Ⅰ","147849229":"炎火铁重弩Ⅱ","147849230":"炎火铁重弩Ⅲ","147849231":"炎火铁重弩Ⅳ","147849232":"炎火铁重弩Ⅴ","147849233":"炎火忍重弩","147849234":"百龙重弩Ⅰ","147849235":"百龙重弩Ⅱ","147849236":"百龙重弩Ⅲ","147849237":"百龙重弩【足智多谋】","147849238":"七星大炮Ⅰ","147849239":"七星大炮Ⅱ","147849240":"七星天炮","147849241":"艾露猫大炮Ⅰ","147849242":"艾露猫大炮Ⅱ","147849243":"猫兽喵农炮","147849244":"水母旅行包Ⅰ","147849245":"水母旅行包Ⅱ","147849246":"致命旅行包","147849247":"南瓜击弩Ⅰ","147849248":"南瓜击弩Ⅱ","147849249":"仙杜瑞拉","147849250":"风之贼重弩Ⅰ","147849251":"风之贼重弩Ⅱ","147849252":"风之贼重弩Ⅲ","147849253":"风镰重弩奈德凯利","147849254":"反击Ⅰ","147849255":"反击Ⅱ","147849256":"反击Ⅲ","147849257":"蛙式・反击","147849258":"天具・锡杖弩Ⅰ","147849259":"天具・锡杖弩Ⅱ","147849260":"大天具・杖弩地藏","147849261":"祸大筒【封】Ⅰ","147849262":"祸大筒【封】Ⅱ","147849263":"祸大筒【幽鬼无法】","147849264":"绚烂挂灯Ⅰ","147849265":"绚烂挂灯Ⅱ","147849266":"贵妇宝枪","147849267":"苍风神炮Ⅰ","147849268":"苍风神炮Ⅱ","147849269":"神渊之风【散】","147849270":"鸣雷神炮Ⅰ","147849271":"神源之雷【散】","147849272":"赫翼重炮Ⅰ","147849273":"龙天赤炮【戴维克】","147849274":"速射狙击弩Ⅰ","147849275":"速射狙击弩Ⅱ","147849276":"高频率狙击弓","147849277":"雪鹿弩Ⅰ","147849278":"雪鹿弩Ⅱ","147849279":"沉重雪鹿弩","147849280":"青熊筒Ⅰ","147849281":"青熊筒Ⅱ","147849282":"青熊轰筒【川渔】","147849283":"白兔射手Ⅰ","147849284":"白兔射手Ⅱ","147849285":"白兔王者","147849286":"硬甲龙炮Ⅰ","147849287":"硬甲龙炮Ⅱ","147849288":"深渊硬甲龙炮","147849289":"开伦弩Ⅰ","147849290":"开伦弩Ⅱ","147849291":"转弩八号球","147849292":"避役速炮Ⅰ","147849293":"避役速炮Ⅱ","147849294":"毒妖喉炮","147849295":"岩石吞噬者Ⅰ","147849296":"岩石吞噬者Ⅱ","147849297":"大地吞噬者","147849298":"妃龙炮【远击】Ⅰ","147849299":"妃龙炮【远击】Ⅱ","147849300":"妃龙炮【飞击】","147849301":"冰牙加农炮Ⅰ","147849302":"冰牙加农炮Ⅱ","147849303":"冰牙匿雪加农炮","147849304":"飞雷重弩爆蛇Ⅰ","147849305":"飞雷重弩爆蛇Ⅱ","147849306":"飞雷重弩【雷上动】","147849307":"炎羽重炮Ⅰ","147849308":"炎羽重炮Ⅱ","147849309":"蛮颚炎羽重炮","147849310":"隐秘狙击手Ⅰ","147849311":"隐秘狙击手Ⅱ","147849312":"夜炮【黑风】","147849313":"狐重炮【风过云雾散】Ⅰ","147849314":"狐重炮【风过云雾散】Ⅱ","147849315":"撤步山炮之御车","147849316":"王炮雷弩Ⅰ","147849317":"王炮雷弩Ⅱ","147849318":"王牙炮【山雷】","147849319":"轰龙咆哮Ⅰ","147849320":"轰龙咆哮Ⅱ","147849321":"轰炮【虎头】","147849322":"决斗双角弩Ⅰ","147849323":"决斗双角弩Ⅱ","147849324":"无情重虎弩","147849325":"钢龙坚弩Ⅰ","147849326":"钢龙重弩","147849327":"炎王大炮Ⅰ","147849328":"炎王灼红巨炮","147849329":"霞龙浓雾重弩Ⅰ","147849330":"霞龙幻影重弩","147849331":"金狮子炮Ⅰ","147849332":"金狮子炮Ⅱ","147849333":"金狮子炮【重雷】","147849334":"百龙重弩Ⅳ","147849335":"百龙重弩Ⅴ","147849336":"村卫用防卫重弩Ⅰ","147849337":"村卫用坚守重弩","147849516":"炎火武重弩","147849517":"炎火武重弩・改","147849518":"炎火杰重弩","147849519":"公爵加农炮","147849520":"死亡冲动","147849521":"轰炮【虎头】改","147849522":"轰炮【大虎头】","147849523":"轰炮【大虎头】改","147849524":"撤步山炮之御车・改","147849525":"撤步山水撞车炮","147849526":"撤步山水撞车炮・改","147849527":"辟邪之炮【玉藻御前】","147849528":"蛙式・反击改","147849529":"真蛙式・反击","147849530":"真蛙式・反击改","147849531":"妃龙炮【飞击】改","147849532":"妃龙炮【姬击】","147849533":"妃龙炮【姬击】改","147849534":"蔷薇刺球","147849535":"蔷薇刺球・改","147849536":"蔷薇优等","147849537":"冰牙飞雹加农炮","147849538":"冰牙飞雹加农炮・改","147849539":"冰牙极寒加农炮","147849540":"青熊轰筒【川渔】改","147849541":"百贯筒【大熊】","147849542":"王牙炮【山雷】改","147849543":"真・王牙炮【天机】","147849544":"近卫队正式重炮・改","147849545":"帝国加农炮","147849547":"帝国加农炮・改","147849548":"电龙大炮【袭击】","147849549":"电龙大炮【袭击】改","147849550":"电龙大炮【闪击】","147849551":"蛮颚炎羽重炮・改","147849552":"重炮蛮炎重弩","147849554":"重炮蛮炎重弩・改","147849555":"陨石加农炮Ⅱ","147849556":"陨石加农炮Ⅲ","147849557":"银河加农炮","147849558":"冷月驱动炮","147849559":"冷月驱动炮・改","147849560":"冰镜圆月炮","147849561":"大地吞噬者・改","147849563":"盖亚吞噬者","147849564":"深渊硬甲龙炮・改","147849565":"十月之紫炮","147849566":"十月之紫炮・改","147849567":"刚缠加农炮","147849568":"刚缠加农炮・改","147849569":"巨块炮库克罗普斯","147849570":"转弩八号球・改","147849571":"赤转甲弩九号球","147849572":"赤转甲弩九号球・改","147849573":"风镰重弩奈德凯利・改","147849574":"大风镰重熏风","147849575":"络新妇爱恋","147849576":"络新妇爱恋・改","147849577":"永恒陶醉","147849578":"紫红之烛重炮","147849579":"熔新妇之吊灯炮","147849580":"毒妖喉炮・改","147849581":"毒妖炮悦绿变色龙","147849582":"毒妖炮悦绿变色龙・改","147849583":"重弩天仓一","147849584":"重弩天仓一・改","147849585":"叛炮天仓一","147849586":"沉重雪鹿弩・改","147849587":"雪鹿王弩","147849588":"无情重虎弩・改","147849589":"重角炮邪魔","147849590":"飞雷重弩【雷上动】改","147849591":"万雷重弩【雷上动】","147849592":"万雷重弩【雷上动】改","147849593":"高速射狙击弩","147849595":"飞毛腿重弩精灵鹿","147849596":"破坏者蟹弩","147849597":"破坏者蟹弩・改","147849598":"沉重破坏者蟹弩","147849599":"穿刺棒","147849600":"穿刺棒・改","147849601":"击穿","147849602":"夜炮【涅飞】","147849603":"夜炮【涅飞】改","147849604":"无明炮【正命】","147849605":"六道具・杖弩地藏","147849606":"六道具・杖弩地藏改","147849607":"六道王・地藏之天弩","147849608":"绯天具・杖弩地藏","147849609":"绯天具・杖弩地藏改","147849610":"绯天之弩・六仙地藏","147849611":"白兔王者・改","147849612":"白兔神弩","147849613":"祸大筒【幽鬼无法】改","147849614":"祸名品【大幽鬼无法】","147849615":"铠怨鬼筒【怨无法】","147849616":"金狮子炮【重雷】改","147849617":"金狮子炮【涡雷】","147849618":"神放・风云破劫","147849620":"神放・雷祸破劫","147849622":"钢龙重弩・改","147849623":"钢龙咆哮","147849624":"炎王灼红巨炮・改","147849625":"炎王炽红风暴","147849626":"霞龙幻影重弩・改","147849627":"海市蜃楼重弩","147849628":"赤绝喷翼水委星","147849629":"导火索of危机","147849630":"导火索of危机・改","147849631":"导火索of全部","147849632":"THE灾难","147849633":"THE大洪水","147849634":"冥渊重弩【陨星】","147849635":"鬼神雷炮【兽神】","147849636":"仙杜瑞拉・改","147849637":"比比迪巴比迪布炮","147849638":"漆黑伤痕","147849639":"水母冥旅","147849641":"天升重弩七星","147849642":"天道重弩大七星","147849644":"猫兽喵农炮・改","147849645":"兽王喵农炮","147849646":"王国骑士重弩高尚","147849648":"王国骑士重弩高尚・改","147849649":"远古机械・重弩","147849650":"注射重弩","147849651":"注射重弩・改","147849652":"起泡酒注射器","147849653":"仙人掌优秀","147849655":"斗宿重弩【七杀】","147849664":"重角炮邪魔・改","147849665":"村卫用坚守重弩Ⅱ","147849666":"村卫用坚守重弩Ⅲ","147849667":"护村重弩・勇","147849668":"紫红之烛重炮・改","147849672":"月华妃龙炮【煌击】","147849674":"创世or终焉","147849676":"冰督光彩","147849677":"凶刻【时雨】","147849678":"刻银歼炮","148897792":"强力猎弓Ⅰ","148897793":"强力猎弓Ⅱ","148897794":"勇气猎弓","148897795":"六花晶弓Ⅰ","148897796":"六花晶弓Ⅱ","148897797":"天华晶弓","148897798":"铁弓Ⅰ","148897799":"铁弓Ⅱ","148897800":"钢铁弓","148897801":"耀金弓Ⅰ","148897802":"耀金弓Ⅱ","148897803":"斗弓果敢","148897804":"猎弓Ⅰ","148897805":"猎弓Ⅱ","148897806":"大师猎弓","148897807":"糙骨弓Ⅰ","148897808":"糙骨弓Ⅱ","148897809":"骨架弓","148897810":"炎火铁弓Ⅰ","148897811":"炎火铁弓Ⅱ","148897812":"炎火铁弓Ⅲ","148897813":"炎火铁弓Ⅳ","148897814":"炎火铁弓Ⅴ","148897815":"炎火忍弓","148897816":"百龙弓Ⅰ","148897817":"百龙弓Ⅱ","148897818":"百龙弓Ⅲ","148897819":"百龙弓【风云变幻】","148897820":"旗鱼骨弓【鱼骨】Ⅰ","148897821":"旗鱼骨弓【鱼骨】Ⅱ","148897822":"旗鱼骨弓【三分鱼身】","148897823":"猫贰玖弓Ⅰ","148897824":"猫贰玖弓Ⅱ","148897825":"机关猫贰玖弓","148897826":"混沌之弓Ⅰ","148897827":"混沌之弓Ⅱ","148897828":"忘我混沌之弓","148897829":"花之塔Ⅰ","148897830":"花之塔Ⅱ","148897831":"丽花枝弓","148897832":"蜘蛛弓Ⅰ","148897833":"蜘蛛弓Ⅱ","148897834":"蜘蛛弦弓","148897835":"天具・光背弓Ⅰ","148897836":"天具・光背弓Ⅱ","148897837":"大天具・光弓爱染","148897838":"祸弓【封】Ⅰ","148897839":"祸弓【封】Ⅱ","148897840":"祸弓【幽鬼无心】","148897841":"泥＝沙Ⅰ","148897842":"泥＝沙Ⅱ","148897843":"指＝引","148897844":"至诚心弓Ⅰ","148897845":"至诚心弓Ⅱ","148897846":"贵妇恋心","148897847":"苍风神弓Ⅰ","148897848":"苍风神弓Ⅱ","148897849":"神渊之风【射】","148897850":"鸣雷神弓Ⅰ","148897851":"神源之雷【射】","148897852":"赫翼大弓Ⅰ","148897853":"龙天赤弓【海尔・博普】","148897854":"飞虫坚弓零式Ⅰ","148897855":"飞虫坚弓零式Ⅱ","148897856":"飞虫坚弓壹式","148897857":"深红飞虫坚弓零式Ⅰ","148897858":"深红飞虫坚弓零式Ⅱ","148897859":"深红飞虫坚弓壹式","148897860":"铬黄飞虫坚弓零式Ⅰ","148897861":"铬黄飞虫坚弓零式Ⅱ","148897862":"铬黄飞虫坚弓壹式","148897863":"雪白飞虫坚弓零式Ⅰ","148897864":"雪白飞虫坚弓零式Ⅱ","148897865":"雪白飞虫坚弓壹式","148897866":"漆黑飞虫坚弓零式Ⅰ","148897867":"漆黑飞虫坚弓零式Ⅱ","148897868":"漆黑飞虫坚弓壹式","148897869":"鹿角的弹弓Ⅰ","148897870":"鹿角的弹弓Ⅱ","148897871":"鹿角的刚弹弓","148897872":"青熊弓Ⅰ","148897873":"青熊弓Ⅱ","148897874":"青熊刚弓【蜜罐】","148897875":"眠狗龙弓Ⅰ","148897876":"眠狗龙弓Ⅱ","148897877":"昏沉眠狗龙弓","148897878":"毒狗龙左轮弓Ⅰ","148897879":"毒狗龙左轮弓Ⅱ","148897880":"邪道左轮弓","148897881":"喙弓Ⅰ","148897882":"喙弓Ⅱ","148897883":"鸟喙利矢","148897884":"海绵齿轮Ⅰ","148897885":"海绵齿轮Ⅱ","148897886":"海绵齿轮Ⅲ","148897887":"海绵大齿轮","148897888":"奇怪龙弓Ⅰ","148897889":"奇怪龙弓Ⅱ","148897890":"奇怪龙爪弓","148897891":"避役弓Ⅰ","148897892":"避役弓Ⅱ","148897893":"毒妖喉弓","148897894":"女王猎弓Ⅰ","148897895":"女王猎弓Ⅱ","148897896":"女王旋律","148897897":"冰柱发射者Ⅰ","148897898":"冰柱发射者Ⅱ","148897899":"冰柱发射者Ⅲ","148897900":"冰牙凛弓","148897901":"飞雷弓射蛇Ⅰ","148897902":"飞雷弓射蛇Ⅱ","148897903":"飞雷弓射蛇Ⅲ","148897904":"飞雷弓【羽羽矢】","148897905":"炎羽强弓Ⅰ","148897906":"炎羽强弓Ⅱ","148897907":"蛮颚炎羽强弓","148897908":"隐秘长弓Ⅰ","148897909":"隐秘长弓Ⅱ","148897910":"暗夜弓【影缝】","148897911":"狐弓【露湿乱世情】Ⅰ","148897912":"狐弓【露湿乱世情】Ⅱ","148897913":"投箭远弓之真弦","148897914":"烈阳弓Ⅰ","148897915":"烈阳弓Ⅱ","148897916":"黑暗丝","148897917":"王弓远雷Ⅰ","148897918":"王弓远雷Ⅱ","148897919":"王牙弓【稚雷】","148897920":"轰龙弓Ⅰ","148897921":"轰龙弓Ⅱ","148897922":"轰弓【虎髯】","148897923":"角龙角弓Ⅰ","148897924":"角龙角弓Ⅱ","148897925":"角龙暴君弓","148897926":"钢冰马弓Ⅰ","148897927":"钢龙强弓","148897928":"勇气与希望之凄弓Ⅰ","148897929":"勇猛与光明之凄烈弓","148897930":"魔弓大魔导书Ⅰ","148897931":"魔导弓魂之谷","148897932":"雷弓【兽王】Ⅰ","148897933":"雷弓【兽王】Ⅱ","148897934":"雷弓【百兽王】","148897935":"百龙弓Ⅳ","148897936":"百龙弓Ⅴ","148897937":"村卫用防卫弓Ⅰ","148897938":"村卫用坚守弓","148897939":"苍世龙弓Ⅰ","148897940":"苍世龙弓【天翔】","148898092":"炎火武弓","148898093":"炎火武弓・改","148898094":"炎火杰弓","148898095":"公爵蝙蝠","148898096":"渴望之吸血鬼","148898097":"络新妇诅咒","148898098":"络新妇诅咒・改","148898099":"永恒绝望","148898100":"珊瑚红饰弓","148898101":"熔新妇之心弓","148898102":"投箭远弓之真弦・改","148898103":"投箭远境真射弓","148898104":"投箭远境真射弓・改","148898105":"辟邪之灵弓【葛叶】","148898106":"誓愿具・光弓爱染","148898107":"誓愿具・光弓爱染改","148898108":"誓愿王・爱染之天弓","148898109":"绯天具・光弓爱染","148898110":"绯天具・光弓爱染改","148898111":"绯天之弓・六仙爱染","148898112":"暗夜弓【刹那】","148898113":"暗夜弓【刹那】改","148898114":"无明弓【正定】","148898115":"飞雷弓【羽羽矢】改","148898116":"万雷弓【羽羽矢】","148898117":"万雷弓【羽羽矢】改","148898118":"凛冽雪绒弓","148898119":"凛冽雪绒弓・改","148898120":"琥牙冰河弧弓","148898121":"邪道左轮弓・改","148898122":"剧毒忏悔弓","148898123":"青熊刚弓【蜜罐】改","148898124":"青熊刚弓【甜罐】","148898125":"勇气猎弓・改","148898126":"智慧猎弓","148898127":"智慧猎弓・改","148898128":"雷击弓霹雳","148898129":"雷击弓霹雳・改","148898130":"黑电霹雳弓","148898131":"斗弓果敢・改","148898132":"斗王弓果敢","148898134":"斗王弓果敢・改","148898135":"冰镜明弓","148898136":"冰镜明弓・改","148898137":"暴风雪瑞华晶弓","148898138":"冷月弓","148898139":"冷月弓・改","148898140":"冰镜圆月弓","148898141":"泥＝吞噬","148898142":"泥＝吞噬・改","148898143":"泥＝奉献","148898144":"熔射弓","148898145":"三位一体熔弓","148898146":"女王旋律・改","148898147":"女王狂想曲","148898148":"女王狂想曲・改","148898149":"蔷薇刺弓","148898150":"蔷薇刺弓・改","148898151":"蔷薇刺镰","148898152":"黑暗丝・改","148898153":"炎击弓烈焰","148898154":"鸟喙利矢・改","148898155":"鸟喙信天鸡蛇弓","148898156":"奇怪龙爪弓・改","148898157":"奇怪龙凶爪弓","148898158":"奇怪龙凶爪弓・改","148898159":"大师猎弓・改","148898160":"娴熟猎弓","148898161":"娴熟猎弓・改","148898162":"弓箭箕宿一","148898163":"弓箭箕宿一・改","148898164":"叛弓箕宿一","148898165":"大钳水弓","148898166":"大钳水弓・改","148898167":"巨钳水弓","148898168":"蓝锋弓","148898169":"蓝锋弓・改","148898170":"射穿","148898171":"轰弓【虎髯】改","148898172":"轰弓【大虎髯】","148898173":"轰弓【大虎髯】改","148898174":"角龙暴君弓・改","148898175":"暴君恐惧","148898176":"王牙弓【稚雷】改","148898177":"真・王牙弓【天命】","148898178":"毒妖喉弓・改","148898179":"毒妖弓毒蜂变色龙・改","148898180":"蛮颚炎羽强弓・改","148898181":"穿杨蛮炎弓","148898182":"穿杨蛮炎弓・改","148898183":"海绵大齿轮・改","148898184":"水击水兽大齿轮","148898185":"水击水兽大齿轮・改","148898186":"刚缠之弓","148898187":"刚缠之弓・改","148898188":"巨块弓安格尔伯达","148898189":"昏沉眠狗龙弓・改","148898190":"晓梦王弓","148898191":"漆黑飞虫坚弓贰式","148898192":"漆黑飞虫坚弓叁式","148898193":"铬黄飞虫坚弓贰式","148898194":"铬黄飞虫坚弓叁式","148898195":"深红飞虫坚弓贰式","148898196":"深红飞虫坚弓叁式","148898197":"深红飞虫坚弓肆式","148898198":"雪白飞虫坚弓贰式","148898199":"雪白飞虫坚弓叁式","148898200":"雪白飞虫坚弓肆式","148898201":"祸弓【幽鬼无心】改","148898202":"祸名品【大幽鬼无心】","148898203":"铠幽鬼弓【怨无心】","148898204":"鹿角的破弹弓","148898206":"大鹿角的破弹弓","148898207":"雷弓【百兽王】改","148898208":"震雷弓【万兽王】","148898209":"神穿・风云冥冥","148898211":"神穿・雷祸明明","148898213":"钢龙强弓・改","148898214":"钢龙射手弓","148898215":"勇猛与光明之凄烈弓・改","148898216":"刚勇与宿愿之凄绝弓","148898217":"魔导弓魂之谷・改","148898218":"大魔导弓所罗之匙","148898219":"赤绝飞翼老人星","148898220":"视野of失落","148898221":"视野of失落・改","148898222":"视野of隐匿","148898223":"THE俘虏者","148898224":"THE圣洁","148898225":"冥渊刚弓【暴雨】","148898226":"雷公怒弓【征天大圣】","148898227":"旗鱼骨弓【三分鱼身】改","148898229":"旗鱼骨弓【全鱼生鱼片】","148898230":"机关猫贰玖弓・改","148898231":"巧妙机关猫贰玖弓","148898232":"忘我混沌之弓・改","148898233":"恍然忘我混沌之弓","148898234":"丽花枝弓・改","148898235":"雪白丽枝弓","148898236":"蛛蝎弦弓","148898238":"大蜘蛛弦弓","148898239":"音速弓","148898240":"音速弓・改","148898241":"音速共鸣器","148898242":"王国骑士弓诚实","148898244":"王国骑士弓诚实・改","148898245":"远古机械・弓","148898246":"仙人掌镰刀","148898247":"开天的亥伯龙神","148898248":"穿月之塞勒涅","148898250":"极星弓【太乙】","148898257":"毒妖弓毒蜂变色龙","148898260":"暴君恐惧・改","148898261":"村卫用坚守弓Ⅱ","148898262":"村卫用坚守弓Ⅲ","148898263":"护村之弓・勇","148898276":"珊瑚红饰弓・改","148898277":"熔射弓・改","148898288":"出现or湮没","148898290":"冰妖艳射","148898291":"凶弓【小夜岚】","148898292":"刻银穿弓","202375168":"炎火装束【头巾】","202375169":"炎火装束【头巾】霸","202375170":"皮制头饰","202375171":"皮制S头饰","202375172":"锁甲头饰","202375173":"锁甲S头饰","202375174":"猎人头盔","202375175":"猎人S头盔","202375176":"杜宾头盔","202375177":"合金头盔","202375178":"合金S头盔","202375179":"铸铁头盔","202375180":"铸铁S头盔","202375181":"花纹钢头盔","202375182":"花瓣绽放","202375183":"花瓣S绽放","202375184":"鱼鳞兜帽","202375185":"鱼鳞S兜帽","202375186":"死神首脑","202375187":"死神S首脑","202375188":"南瓜绽放","202375189":"南瓜S绽放","202375190":"南瓜绽放","202375191":"南瓜S绽放","202375192":"锹形护头","202375193":"锹形S护头","202375194":"凤蝶护头","202375195":"凤蝶S护头","202375196":"海境头盔","202375197":"海境S头盔","202375198":"混沌的包发","202375199":"混沌的包发・霸","202375200":"雪绒花绽放","202375201":"雪绒花S绽放","202375202":"毒蝎护头","202375203":"毒蝎S护头","202375204":"毒蛛护头","202375205":"毒蛛S护头","202375206":"倪泰表【蒙面】","202375207":"倪泰表【蒙面】霸","202375208":"神凪【元结】","202375209":"神凪・愿【元结】","202375210":"倪泰里【刚面】","202375211":"倪泰里【刚面】霸","202375212":"依巫【元结】","202375213":"依巫・祈【元结】","202375214":"贝壳头饰","202375215":"贝壳S头饰","202375216":"哥特帽子","202375217":"哥特S帽子","202375218":"天狗兽头盔","202375219":"天狗兽S头盔","202375220":"伞鸟头盔","202375221":"伞鸟S头盔","202375222":"河童蛙头盔","202375223":"河童蛙S头盔","202375224":"人鱼龙头盔","202375225":"人鱼龙S头盔","202375226":"妃蜘蛛头盔","202375227":"妃蜘蛛头盔","202375228":"雪鬼兽头盔","202375229":"雪鬼兽S头盔","202375230":"泥翁龙头盔","202375231":"泥翁龙S头盔","202375232":"风卷之首","202375233":"风卷之首","202375234":"鸣神之首","202375235":"鸣神之首","202375236":"镰鼬龙头盔","202375237":"镰鼬龙S头盔","202375238":"钢龙强力","202375239":"水行【乌帽子】","202375240":"帝王冠","202375241":"丸鸟伪装","202375242":"丸鸟S伪装","202375243":"垂皮龙兜帽","202375244":"垂皮龙S兜帽","202375245":"硬甲龙头盔","202375246":"硬甲龙S头盔","202375249":"飞甲虫礼帽","202375250":"飞甲虫S礼帽","202375251":"野猪伪装","202375252":"野猪S伪装","202375253":"翼蛇龙头饰","202375254":"翼蛇龙S头饰","202375259":"毒狗龙头盔","202375260":"毒狗龙S头盔","202375261":"眠狗龙头盔","202375262":"眠狗龙S头盔","202375263":"青熊兽头盔","202375264":"青熊兽S头盔","202375265":"赤甲兽头盔","202375266":"赤甲兽S头盔","202375267":"水兽头盔","202375268":"水兽S头盔","202375269":"土砂龙头盔","202375270":"土砂龙S头盔","202375271":"奇怪龙头盔","202375272":"奇怪龙S头盔","202375273":"迅龙头盔","202375274":"迅龙S头盔","202375275":"冰牙龙头盔","202375276":"冰牙龙S头盔","202375277":"雌火龙头盔","202375278":"雌火龙S头盔","202375279":"火龙头盔","202375280":"火龙S头盔","202375281":"轰龙头盔","202375282":"轰龙S头盔","202375283":"角龙头盔","202375284":"角龙S头盔","202375285":"岩龙头盔","202375286":"岩龙S头盔","202375287":"雷狼龙头盔","202375288":"雷狼龙S头盔","202375289":"金色毛发","202375290":"赫耀头盔","202375291":"搔鸟头盔","202375292":"搔鸟S头盔","202375293":"毒妖鸟头盔","202375294":"毒妖鸟S头盔","202375295":"泥鱼龙头盔","202375296":"飞雷龙头盔","202375297":"飞雷龙S头盔","202375298":"蛮颚龙头盔","202375299":"蛮颚龙S头盔","202375300":"爆鳞龙头盔","202375302":"骷髅头饰","202375303":"炎之封眼","202375305":"墨镜","202375306":"狗龙伪装","202375307":"狗龙S伪装","202375308":"知略眼镜","202375309":"强弓羽饰","202375310":"祸铠【武士盔】","202375311":"祸铠・霸【武士盔】","202375312":"白兔兽头盔","202375313":"白兔兽S头盔","202375314":"骨制头盔","202375315":"骨制S头盔","202375316":"泡狐龙头盔","202375317":"泡狐龙S头盔","202375318":"旅团帽","202375319":"名手羽饰","202375320":"骷髅S头饰","202375321":"旅团S帽","202375336":"苍世武士【艳发】","202375340":"公会十字头饰","202375358":"黑带头盔","202375468":"炎火装束【头巾】继","202375469":"皮制X头饰","202375470":"锁甲X头饰","202375471":"猎人X头盔","202375472":"杜宾X头盔","202375473":"合金X头盔","202375474":"铸铁X头盔","202375475":"花纹钢X头盔","202375476":"花瓣X绽放","202375477":"鱼鳞X兜帽","202375478":"死神X首脑","202375479":"南瓜X绽放","202375480":"南瓜X绽放","202375481":"锹形X护头","202375482":"凤蝶X护头","202375483":"海境X头盔","202375484":"混沌的包发・真","202375485":"雪绒花X绽放","202375486":"毒蝎X护头","202375487":"毒蛛X护头","202375488":"倪泰表【蒙面】真","202375489":"神凪･洸【元結】","202375490":"倪泰里【刚面】真","202375491":"依巫･燿【元結】","202375492":"贝壳X头饰","202375493":"哥特X帽子","202375494":"天狗兽X头盔","202375495":"伞鸟X头盔","202375496":"河童蛙X头盔","202375497":"人鱼龙X头盔","202375498":"妃蜘蛛X头盔","202375499":"妃蜘蛛X头盔","202375500":"雪鬼兽X头盔","202375501":"泥翁龙X头盔","202375502":"风卷之首・真","202375504":"鸣神之首・真","202375506":"镰鼬龙X头盔","202375507":"钢龙X强力","202375508":"水行・真【面部】","202375509":"帝王X冠","202375510":"丸鸟X伪装","202375511":"垂皮龙X兜帽","202375512":"硬甲龙X头盔","202375514":"飞甲虫X礼帽","202375515":"野猪X伪装","202375516":"翼蛇龙X头饰","202375519":"毒狗龙X头盔","202375520":"眠狗龙X头盔","202375521":"青熊兽X头盔","202375522":"赤甲兽X头盔","202375523":"水兽X头盔","202375524":"土砂龙X头盔","202375525":"奇怪龙X头盔","202375526":"迅龙X头盔","202375527":"冰牙龙X头盔","202375528":"雌火龙X头盔","202375529":"火龙X头盔","202375530":"轰龙X头盔","202375531":"角龙X头盔","202375532":"岩龙X头盔","202375533":"雷狼龙X头盔","202375534":"齐天毛发・真","202375535":"赫耀头盔・真","202375536":"搔鸟X头盔","202375537":"毒妖鸟X头盔","202375538":"泥鱼龙X头盔","202375539":"飞雷龙X头盔","202375540":"蛮颚龙X头盔","202375541":"爆鳞龙X头盔","202375543":"骷髅X头饰","202375545":"狗龙X伪装","202375548":"祸铠・真【武士盔】","202375549":"白兔兽X头盔","202375550":"骨制X头盔","202375551":"泡狐龙X头盔","202375552":"旅团X帽","202375554":"大名盾蟹头盔","202375555":"将军镰蟹头盔","202375556":"怒天毛发","202375557":"黑蚀龙头盔","202375558":"方舟头盔","202375559":"友爱头盔","202375560":"千刃龙头盔","202375561":"电龙头盔","202375562":"阴阳师【头冠】","202375563":"祸铠・怨【武士盔】","202375564":"天狗兽Z头盔","202375565":"人鱼龙Z头盔","202375566":"妃蜘蛛Z头盔","202375567":"妃蜘蛛Z头盔","202375568":"泥翁龙Ｚ头盔","202375569":"矜持头盔","202375570":"爵银龙头盔","202375571":"冰狼龙头盔","202375572":"刚缠兽头盔","202375573":"冥渊缠铠【怒头】","202375574":"棘龙首脑","202375575":"蓝速龙头盔","202375576":"巨蜂头盔","202375577":"巨甲虫头盔","202375578":"教授护目镜","202375579":"博爱发夹","202375580":"公会诗人帽","202375581":"学士兜帽","202375582":"水手兜帽","202375583":"猎鹰皮帽","202375584":"求知兜帽","202375585":"贤者方帽","202375586":"追踪者头饰","202375587":"据点司令【耳饰】","202375588":"据点司令【耳饰】","202375590":"巴尔巴尼亚眼罩","202375591":"恩宠头饰","202375592":"五行之面具","202375593":"守护者头盔","202375594":"公会宫殿头盔","202375595":"结云笠","202375596":"银白耀日头盔","202375597":"金黄澄月头盔","202375598":"棘龙Z首脑","202375599":"月光【护额】","202375609":"重装骑士【武士盔】","202375610":"轻装骑士【耳饰】","202375611":"炮术队【武士盔】","202375624":"尊严耳饰","202375625":"黑带S头盔","202375627":"翔驱羽饰","202375628":"祝福羽饰","202375659":"水行・醒【额饰】","202375660":"脉动钢龙强力","202375661":"脉动帝王双角","202375662":"混茫头盔","202375663":"堕天头盔","202375666":"雪崩头盔","202375667":"赫耀头盔・历","202375668":"风雨 【冠】","202375669":"美德头盔","202375670":"原初头盔","202375674":"久爱头盔","203423744":"炎火装束【上衣】","203423745":"炎火装束【上衣】霸","203423746":"皮制服饰","203423747":"皮制S服饰","203423748":"锁甲服饰","203423749":"锁甲S服饰","203423750":"猎人铠甲","203423751":"猎人S铠甲","203423752":"杜宾铠甲","203423753":"合金铠甲","203423754":"合金S铠甲","203423755":"铸铁铠甲","203423756":"铸铁S铠甲","203423757":"花纹钢铠甲","203423758":"花瓣枝干","203423759":"花瓣S枝干","203423760":"鱼鳞洋装","203423761":"鱼鳞S洋装","203423762":"死神肌肉","203423763":"死神S肌肉","203423764":"南瓜枝干","203423765":"南瓜S枝干","203423766":"南瓜枝干","203423767":"南瓜S枝干","203423768":"锹形上身","203423769":"锹形S上身","203423770":"凤蝶上身","203423771":"凤蝶S上身","203423772":"海境铠甲","203423773":"海境S铠甲","203423774":"混沌的铠","203423775":"混沌的铠・霸","203423776":"雪绒花枝干","203423777":"雪绒花S枝干","203423778":"毒蝎上身","203423779":"毒蝎S上身","203423780":"毒蛛上身","203423781":"毒蛛S上身","203423782":"倪泰表【上衣】","203423783":"倪泰表【上衣】霸","203423784":"神凪【白衣】","203423785":"神凪・愿【白衣】","203423786":"倪泰里【上衣】","203423787":"倪泰里【上衣】霸","203423788":"依巫【白衣】","203423789":"依巫・祈【白衣】","203423790":"贝壳服饰","203423791":"贝壳S服饰","203423792":"哥特服饰","203423793":"哥特S服饰","203423794":"天狗兽铠甲","203423795":"天狗兽S铠甲","203423796":"伞鸟铠甲","203423797":"伞鸟S铠甲","203423798":"河童蛙铠甲","203423799":"河童蛙S铠甲","203423800":"人鱼龙铠甲","203423801":"人鱼龙S铠甲","203423802":"妃蜘蛛铠甲","203423803":"妃蜘蛛铠甲","203423804":"雪鬼兽铠甲","203423805":"雪鬼兽S铠甲","203423806":"泥翁龙铠甲","203423807":"泥翁龙S铠甲","203423808":"风卷之胸","203423809":"风卷之胸","203423810":"鸣神之胸","203423811":"鸣神之胸","203423812":"镰鼬龙铠甲","203423813":"镰鼬龙S铠甲","203423814":"钢龙恐惧","203423815":"水行【胸甲】","203423816":"帝王铠甲","203423819":"垂皮龙披风","203423820":"垂皮龙S披风","203423821":"硬甲龙铠甲","203423822":"硬甲龙S铠甲","203423825":"飞甲虫服装","203423826":"飞甲虫S服装","203423829":"翼蛇龙套装衣装","203423830":"翼蛇龙套装S衣装","203423831":"水生兽铠甲","203423832":"水生兽S铠甲","203423833":"熔岩兽铠甲","203423834":"熔岩兽S铠甲","203423835":"毒狗龙铠甲","203423836":"毒狗龙S铠甲","203423837":"眠狗龙铠甲","203423838":"眠狗龙S铠甲","203423839":"青熊兽铠甲","203423840":"青熊兽S铠甲","203423841":"赤甲兽铠甲","203423842":"赤甲兽S铠甲","203423843":"水兽铠甲","203423844":"水兽S铠甲","203423845":"土砂龙铠甲","203423846":"土砂龙S铠甲","203423847":"奇怪龙铠甲","203423848":"奇怪龙S铠甲","203423849":"迅龙铠甲","203423850":"迅龙S铠甲","203423851":"冰牙龙铠甲","203423852":"冰牙龙S铠甲","203423853":"雌火龙铠甲","203423854":"雌火龙S铠甲","203423855":"火龙铠甲","203423856":"火龙S铠甲","203423857":"轰龙铠甲","203423858":"轰龙S铠甲","203423859":"角龙铠甲","203423860":"角龙S铠甲","203423861":"岩龙铠甲","203423862":"岩龙S铠甲","203423863":"雷狼龙铠甲","203423864":"雷狼龙S铠甲","203423865":"金色羽织","203423866":"赫耀铠甲","203423867":"搔鸟铠甲","203423868":"搔鸟S铠甲","203423869":"毒妖鸟铠甲","203423870":"毒妖鸟S铠甲","203423871":"泥鱼龙铠甲","203423872":"飞雷龙铠甲","203423873":"飞雷龙S铠甲","203423874":"蛮颚龙铠甲","203423875":"蛮颚龙S铠甲","203423876":"爆鳞龙铠甲","203423886":"祸铠【胸甲】","203423887":"祸铠・霸【胸甲】","203423888":"白兔兽铠甲","203423889":"白兔兽S铠甲","203423890":"骨制铠甲","203423891":"骨制S铠甲","203423892":"泡狐龙铠甲","203423893":"泡狐龙S铠甲","203423894":"旅团战衣","203423897":"旅团S战衣","203423912":"苍世武士【羽织】","203423916":"公会十字战衣","203423934":"黑带铠甲","203424044":"炎火装束【上衣】继","203424045":"皮制X服饰","203424046":"锁甲X服饰","203424047":"猎人X铠甲","203424048":"杜宾X铠甲","203424049":"合金X铠甲","203424050":"铸铁X铠甲","203424051":"花纹钢X铠甲","203424052":"花瓣X枝干","203424053":"鱼鳞X洋装","203424054":"死神X肌肉","203424055":"南瓜X枝干","203424056":"南瓜X枝干","203424057":"锹形X上身","203424058":"凤蝶X上身","203424059":"海境X铠甲","203424060":"混沌的铠･真","203424061":"雪绒花X枝干","203424062":"毒蝎X上身","203424063":"毒蛛X上身","203424064":"倪泰表【上衣】真","203424065":"神凪・洸【白衣】","203424066":"倪泰里【上衣】真","203424067":"依巫・燿【白衣】","203424068":"贝壳X服饰","203424069":"哥特X服饰","203424070":"天狗兽X铠甲","203424071":"伞鸟X铠甲","203424072":"河童蛙X铠甲","203424073":"人鱼龙X铠甲","203424074":"妃蜘蛛X铠甲","203424075":"妃蜘蛛X铠甲","203424076":"雪鬼兽X铠甲","203424077":"泥翁龙X铠甲","203424078":"风卷之胸・真","203424080":"鸣神之胸・真","203424082":"镰鼬龙X铠甲","203424083":"钢龙X恐惧","203424084":"水行・真【胸甲】","203424085":"帝王X铠甲","203424087":"垂皮龙X披风","203424088":"硬甲龙X铠甲","203424090":"飞甲虫X服装","203424092":"翼蛇龙套装X衣装","203424093":"水生兽X铠甲","203424094":"熔岩兽X铠甲","203424095":"毒狗龙X铠甲","203424096":"眠狗龙X铠甲","203424097":"青熊兽X铠甲","203424098":"赤甲兽X铠甲","203424099":"水兽X铠甲","203424100":"土砂龙X铠甲","203424101":"奇怪龙X铠甲","203424102":"迅龙X铠甲","203424103":"冰牙龙X铠甲","203424104":"雌火龙X铠甲","203424105":"火龙X铠甲","203424106":"轰龙X铠甲","203424107":"角龙X铠甲","203424108":"岩龙X铠甲","203424109":"雷狼龙X铠甲","203424110":"齐天衣・真","203424111":"赫耀铠甲・真","203424112":"搔鸟X铠甲","203424113":"毒妖鸟X铠甲","203424114":"泥鱼龙X铠甲","203424115":"飞雷龙X铠甲","203424116":"蛮颚龙X铠甲","203424117":"爆鳞龙X铠甲","203424124":"祸铠・真【胸甲】","203424125":"白兔兽X铠甲","203424126":"骨制X铠甲","203424127":"泡狐龙X铠甲","203424128":"旅团X战衣","203424130":"大名盾蟹铠甲","203424131":"将军镰蟹铠甲","203424132":"怒天羽织","203424133":"黑蚀龙铠甲","203424134":"方舟铠甲","203424135":"友爱铠甲","203424136":"千刃龙铠甲","203424137":"电龙铠甲","203424138":"阴阳师【狩衣】","203424139":"祸铠・怨【胸甲】","203424140":"天狗兽Z铠甲","203424141":"人鱼龙Z铠甲","203424142":"妃蜘蛛Z铠甲","203424143":"妃蜘蛛Z铠甲","203424144":"泥翁龙Ｚ铠甲","203424145":"矜持铠甲","203424146":"爵银龙铠甲","203424147":"冰狼龙铠甲","203424148":"刚缠兽铠甲","203424149":"冥渊缠铠【怒躯】","203424150":"棘龙肌肉","203424151":"蓝速龙铠甲","203424152":"巨蜂铠甲","203424153":"巨甲虫铠甲","203424154":"教授外套","203424155":"博爱外套","203424156":"公会诗人服装","203424157":"学士服装","203424158":"水手服装","203424159":"猎鹰服装","203424160":"求知服装","203424161":"贤者服装","203424162":"追踪者服饰","203424163":"据点司令【铠甲】","203424164":"据点司令【铠甲】","203424166":"巴尔巴尼亚服饰","203424167":"恩宠铠甲","203424168":"五行之狩衣","203424169":"守护者服装","203424170":"公会宫殿铠甲","203424171":"结云武服","203424172":"银白耀日铠甲","203424173":"金黄澄月铠甲","203424174":"棘龙Z肌肉","203424175":"月光【铠衣】","203424185":"重装骑士【铠甲】","203424186":"轻装骑士【胸甲】","203424187":"炮术队【身体】","203424200":"尊严外套","203424201":"黑带S铠甲","203424235":"水行・醒【宿衣】","203424236":"脉动钢龙逆鳞","203424237":"脉动帝王铠甲","203424238":"混茫铠甲","203424239":"堕天铠甲","203424242":"雪崩铠甲","203424243":"赫耀铠甲・历","203424244":"风雨 【衣】","203424245":"美德铠甲","203424246":"原初铠甲","203424248":"健美身体","203424250":"久爱铠甲","204472320":"炎火装束【手甲】","204472321":"炎火装束【手甲】霸","204472322":"皮制手套","204472323":"皮制S手套","204472324":"锁甲手套","204472325":"锁甲S手套","204472326":"猎人腕甲","204472327":"猎人S腕甲","204472328":"杜宾腕甲","204472329":"合金腕甲","204472330":"合金S腕甲","204472331":"铸铁腕甲","204472332":"铸铁S腕甲","204472333":"花纹钢腕甲","204472334":"花瓣枝叶","204472335":"花瓣S枝叶","204472336":"鱼鳞袖","204472337":"鱼鳞S袖","204472338":"死神双手","204472339":"死神S双手","204472340":"南瓜枝叶","204472341":"南瓜S枝叶","204472342":"南瓜枝叶","204472343":"南瓜S枝叶","204472344":"锹形护袖","204472345":"锹形S护袖","204472346":"凤蝶护袖","204472347":"凤蝶S护袖","204472348":"海境腕甲","204472349":"海境S腕甲","204472352":"雪绒花枝叶","204472353":"雪绒花S枝叶","204472354":"毒蝎护袖","204472355":"毒蝎S护袖","204472356":"毒蛛护袖","204472357":"毒蛛S护袖","204472358":"倪泰表【手甲】","204472359":"倪泰表【手甲】霸","204472360":"神凪【花袖】","204472361":"神凪・愿【花袖】","204472362":"倪泰里【手甲】","204472363":"倪泰里【手甲】霸","204472364":"依巫【花袖】","204472365":"依巫・祈【花袖】","204472366":"贝壳护手","204472367":"贝壳S护手","204472368":"哥特手套","204472369":"哥特S手套","204472370":"天狗兽腕甲","204472371":"天狗兽S腕甲","204472372":"伞鸟腕甲","204472373":"伞鸟S腕甲","204472374":"河童蛙腕甲","204472375":"河童蛙S腕甲","204472376":"人鱼龙腕甲","204472377":"人鱼龙S腕甲","204472378":"妃蜘蛛腕甲","204472379":"妃蜘蛛腕甲","204472380":"雪鬼兽腕甲","204472381":"雪鬼兽S腕甲","204472382":"泥翁龙腕甲","204472383":"泥翁龙S腕甲","204472384":"风卷之臂","204472385":"风卷之臂","204472386":"鸣神之臂","204472387":"鸣神之臂","204472388":"镰鼬龙腕甲","204472389":"镰鼬龙S腕甲","204472390":"钢龙刚强","204472391":"水行【大袖】","204472392":"帝王腕甲","204472397":"硬甲龙腕甲","204472398":"硬甲龙S腕甲","204472399":"狗龙皮臂甲","204472400":"狗龙皮臂甲S","204472401":"飞甲虫护手","204472402":"飞甲虫S护手","204472405":"翼蛇龙套装手套","204472406":"翼蛇龙套装S手套","204472411":"毒狗龙腕甲","204472412":"毒狗龙S腕甲","204472413":"眠狗龙腕甲","204472414":"眠狗龙S腕甲","204472415":"青熊兽腕甲","204472416":"青熊兽S腕甲","204472417":"赤甲兽腕甲","204472418":"赤甲兽S腕甲","204472419":"水兽腕甲","204472420":"水兽S腕甲","204472421":"土砂龙腕甲","204472422":"土砂龙S腕甲","204472423":"奇怪龙腕甲","204472424":"奇怪龙S腕甲","204472425":"迅龙腕甲","204472426":"迅龙S腕甲","204472427":"冰牙龙腕甲","204472428":"冰牙龙S腕甲","204472429":"雌火龙腕甲","204472430":"雌火龙S腕甲","204472431":"火龙腕甲","204472432":"火龙S腕甲","204472433":"轰龙腕甲","204472434":"轰龙S腕甲","204472435":"角龙腕甲","204472436":"角龙S腕甲","204472437":"岩龙腕甲","204472438":"岩龙S腕甲","204472439":"雷狼龙腕甲","204472440":"雷狼龙S腕甲","204472441":"金色臂甲","204472442":"赫耀腕甲","204472443":"搔鸟腕甲","204472444":"搔鸟S腕甲","204472445":"毒妖鸟腕甲","204472446":"毒妖鸟S腕甲","204472447":"泥鱼龙腕甲","204472448":"飞雷龙腕甲","204472449":"飞雷龙S腕甲","204472450":"蛮颚龙腕甲","204472451":"蛮颚龙S腕甲","204472452":"爆鳞龙腕甲","204472462":"祸铠【臂甲】","204472463":"祸铠・霸【臂甲】","204472464":"白兔兽腕甲","204472465":"白兔兽S腕甲","204472466":"骨制腕甲","204472467":"骨制S腕甲","204472468":"泡狐龙腕甲","204472469":"泡狐龙S腕甲","204472470":"旅团腕甲","204472473":"旅团S腕甲","204472488":"苍世武士【袖】","204472492":"公会十字腕甲","204472510":"黑带腕甲","204472620":"炎火装束【手甲】继","204472621":"皮制X手套","204472622":"锁甲X手套","204472623":"猎人X腕甲","204472624":"杜宾X腕甲","204472625":"合金X腕甲","204472626":"铸铁X腕甲","204472627":"花纹钢X腕甲","204472628":"花瓣X枝叶","204472629":"鱼鳞X袖","204472630":"死神X双手","204472631":"南瓜X枝叶","204472632":"南瓜X枝叶","204472633":"锹形X护袖","204472634":"凤蝶X护袖","204472635":"海境X腕甲","204472637":"雪绒花X枝叶","204472638":"毒蝎X护袖","204472639":"毒蛛X护袖","204472640":"倪泰表【手甲】真","204472641":"神凪・洸【花袖】","204472642":"倪泰里【手甲】真","204472643":"依巫・燿【花袖】","204472644":"贝壳X护手","204472645":"哥特X手套","204472646":"天狗兽X腕甲","204472647":"伞鸟X腕甲","204472648":"河童蛙X腕甲","204472649":"人鱼龙X腕甲","204472650":"妃蜘蛛X腕甲","204472651":"妃蜘蛛X腕甲","204472652":"雪鬼兽X腕甲","204472653":"泥翁龙X腕甲","204472654":"风卷之臂・真","204472656":"鸣神之臂・真","204472658":"镰鼬龙X腕甲","204472659":"钢龙X刚强","204472660":"水行・真【大袖】","204472661":"帝王X腕甲","204472664":"硬甲龙X腕甲","204472665":"狗龙皮臂甲X","204472666":"飞甲虫X护手","204472668":"翼蛇龙套装X手套","204472671":"毒狗龙X腕甲","204472672":"眠狗龙X腕甲","204472673":"青熊兽X腕甲","204472674":"赤甲兽X腕甲","204472675":"水兽X腕甲","204472676":"土砂龙X腕甲","204472677":"奇怪龙X腕甲","204472678":"迅龙X腕甲","204472679":"冰牙龙X腕甲","204472680":"雌火龙X腕甲","204472681":"火龙X腕甲","204472682":"轰龙X腕甲","204472683":"角龙X腕甲","204472684":"岩龙X腕甲","204472685":"雷狼龙X腕甲","204472686":"齐天臂甲・真","204472687":"赫耀腕甲・真","204472688":"搔鸟X腕甲","204472689":"毒妖鸟X腕甲","204472690":"泥鱼龙X腕甲","204472691":"飞雷龙X腕甲","204472692":"蛮颚龙X腕甲","204472693":"爆鳞龙X腕甲","204472700":"祸铠・真【臂甲】","204472701":"白兔兽X腕甲","204472702":"骨制X腕甲","204472703":"泡狐龙X腕甲","204472704":"旅团X腕甲","204472706":"大名盾蟹腕甲","204472707":"将军镰蟹腕甲","204472708":"怒天臂甲","204472709":"黑蚀龙腕甲","204472710":"方舟腕甲","204472711":"友爱腕甲","204472712":"千刃龙腕甲","204472713":"电龙腕甲","204472714":"阴阳师【手甲】","204472715":"祸铠・怨【臂甲】","204472716":"天狗兽Z腕甲","204472717":"人鱼龙Z腕甲","204472718":"妃蜘蛛Z腕甲","204472719":"妃蜘蛛Z腕甲","204472720":"泥翁龙Ｚ腕甲","204472721":"矜持腕甲","204472722":"爵银龙腕甲","204472723":"冰狼龙腕甲","204472724":"刚缠兽腕甲","204472725":"冥渊缠铠【怒臂】","204472726":"棘龙双手","204472727":"蓝速龙腕甲","204472728":"巨蜂腕甲","204472729":"巨甲虫腕甲","204472730":"教授手套","204472731":"博爱护手","204472732":"公会诗人腕甲","204472733":"学士手套","204472734":"水手手套","204472735":"猎鹰手套","204472736":"求知手套","204472737":"贤者腕甲","204472738":"追踪者手套","204472739":"据点司令【手甲】","204472740":"据点司令【手甲】","204472742":"巴尔巴尼亚手套","204472743":"恩宠腕甲","204472744":"五行之护臂","204472745":"守护者腕甲","204472746":"公会宫殿腕甲","204472747":"结云护臂","204472748":"银白耀日腕甲","204472749":"金黄澄月腕甲","204472750":"棘龙Z双手","204472751":"月光【手甲】","204472761":"重装骑士【手甲】","204472762":"轻装骑士【手甲】","204472763":"炮术队【臂甲】","204472776":"尊严护手","204472777":"黑带S腕甲","204472811":"水行・醒【大袖】","204472812":"脉动钢龙钩爪","204472813":"脉动帝王腕甲","204472814":"混茫腕甲","204472815":"堕天腕甲","204472818":"雪崩腕甲","204472819":"赫耀腕甲・历","204472820":"风雨 【袖】","204472821":"美德腕甲","204472822":"原初腕甲","204472824":"健美腕部","204472826":"久爱腕甲","205520896":"炎火装束【腰卷】","205520897":"炎火装束【腰卷】霸","205520898":"皮制腰带","205520899":"皮制S腰带","205520900":"锁甲腰带","205520901":"锁甲S腰带","205520902":"猎人腰甲","205520903":"猎人S腰甲","205520904":"杜宾腰甲","205520905":"合金腰甲","205520906":"合金S腰甲","205520907":"铸铁腰甲","205520908":"铸铁S腰甲","205520909":"花纹钢腰甲","205520910":"花瓣叶片","205520911":"花瓣S叶片","205520912":"鱼鳞腰甲","205520913":"鱼鳞S腰甲","205520914":"死神脐带","205520915":"死神S脐带","205520916":"南瓜叶片","205520917":"南瓜S叶片","205520918":"南瓜叶片","205520919":"南瓜S叶片","205520920":"锹形护腰具","205520921":"锹形S护腰具","205520922":"凤蝶护腰具","205520923":"凤蝶S护腰具","205520924":"海境腰甲","205520925":"海境S腰甲","205520928":"雪绒花叶片","205520929":"雪绒花S叶片","205520930":"毒蝎护腰具","205520931":"毒蝎S护腰具","205520932":"毒蛛护腰具","205520933":"毒蛛S护腰具","205520934":"倪泰表【腰卷】","205520935":"倪泰表【腰卷】霸","205520936":"神凪【腰卷】","205520937":"神凪・愿【腰卷】","205520938":"倪泰里【腰卷】","205520939":"倪泰里【腰卷】霸","205520940":"依巫【腰卷】","205520941":"依巫・祈【腰卷】","205520942":"贝壳裙","205520943":"贝壳S裙","205520944":"哥特腰甲","205520945":"哥特S腰甲","205520946":"天狗兽腰甲","205520947":"天狗兽S腰甲","205520948":"伞鸟腰甲","205520949":"伞鸟S腰甲","205520950":"河童蛙腰甲","205520951":"河童蛙S腰甲","205520952":"人鱼龙腰甲","205520953":"人鱼龙S腰甲","205520954":"妃蜘蛛腰甲","205520955":"妃蜘蛛腰甲","205520956":"雪鬼兽腰甲","205520957":"雪鬼兽S腰甲","205520958":"泥翁龙腰甲","205520959":"泥翁龙S腰甲","205520960":"风卷之腰","205520961":"风卷之腰","205520962":"鸣神之腰","205520963":"鸣神之腰","205520964":"镰鼬龙腰甲","205520965":"镰鼬龙S腰甲","205520966":"钢龙安稳","205520967":"水行【圆带】","205520968":"帝王腰甲","205520973":"硬甲龙腰甲","205520974":"硬甲龙S腰甲","205520977":"飞甲虫腰甲","205520978":"飞甲虫S腰甲","205520981":"翼蛇龙套装腰带","205520982":"翼蛇龙套装S腰带","205520983":"水生兽腰甲","205520984":"水生兽S腰甲","205520985":"熔岩兽腰甲","205520986":"熔岩兽S腰甲","205520987":"毒狗龙腰甲","205520988":"毒狗龙S腰甲","205520989":"眠狗龙腰甲","205520990":"眠狗龙S腰甲","205520991":"青熊兽腰甲","205520992":"青熊兽S腰甲","205520993":"赤甲兽腰甲","205520994":"赤甲兽S腰甲","205520995":"水兽腰甲","205520996":"水兽S腰甲","205520997":"土砂龙腰甲","205520998":"土砂龙S腰甲","205520999":"奇怪龙腰甲","205521000":"奇怪龙S腰甲","205521001":"迅龙腰甲","205521002":"迅龙S腰甲","205521003":"冰牙龙腰甲","205521004":"冰牙龙S腰甲","205521005":"雌火龙腰甲","205521006":"雌火龙S腰甲","205521007":"火龙腰甲","205521008":"火龙S腰甲","205521009":"轰龙腰甲","205521010":"轰龙S腰甲","205521011":"角龙腰甲","205521012":"角龙S腰甲","205521013":"岩龙腰甲","205521014":"岩龙S腰甲","205521015":"雷狼龙腰甲","205521016":"雷狼龙S腰甲","205521017":"金色带","205521018":"赫耀腰甲","205521019":"搔鸟腰甲","205521020":"搔鸟S腰甲","205521021":"毒妖鸟腰甲","205521022":"毒妖鸟S腰甲","205521023":"泥鱼龙腰甲","205521024":"飞雷龙腰甲","205521025":"飞雷龙S腰甲","205521026":"蛮颚龙腰甲","205521027":"蛮颚龙S腰甲","205521028":"爆鳞龙腰甲","205521029":"铬合金腰甲","205521038":"祸铠【腰具】","205521039":"祸铠・霸【腰具】","205521040":"白兔兽腰甲","205521041":"白兔兽S腰甲","205521042":"骨制腰甲","205521043":"骨制S腰甲","205521044":"泡狐龙腰甲","205521045":"泡狐龙S腰甲","205521046":"旅团腰甲","205521049":"旅团S腰甲","205521064":"苍世武士【带】","205521068":"公会十字腰甲","205521086":"黑带腰甲","205521196":"炎火装束【腰卷】继","205521197":"皮制X腰带","205521198":"锁甲X腰带","205521199":"猎人X腰甲","205521200":"杜宾X腰甲","205521201":"合金X腰甲","205521202":"铸铁X腰甲","205521203":"花纹钢X腰甲","205521204":"花瓣X叶片","205521205":"鱼鳞X腰甲","205521206":"死神X脐带","205521207":"南瓜X叶片","205521208":"南瓜X叶片","205521209":"锹形X护腰具","205521210":"凤蝶X护腰具","205521211":"海境X腰甲","205521213":"雪绒花X叶片","205521214":"毒蝎X护腰具","205521215":"毒蛛X护腰具","205521216":"倪泰表【腰卷】真","205521217":"神凪・洸【腰卷】","205521218":"倪泰里【腰卷】真","205521219":"依巫・燿【腰卷】","205521220":"贝壳X裙","205521221":"哥特X腰甲","205521222":"天狗兽X腰甲","205521223":"伞鸟X腰甲","205521224":"河童蛙X腰甲","205521225":"人鱼龙X腰甲","205521226":"妃蜘蛛X腰甲","205521227":"妃蜘蛛X腰甲","205521228":"雪鬼兽X腰甲","205521229":"泥翁龙X腰甲","205521230":"风卷之腰・真","205521232":"鸣神之腰・真","205521234":"镰鼬龙X腰甲","205521235":"钢龙X安稳","205521236":"水行・真【圆带】","205521237":"帝王X腰甲","205521240":"硬甲龙X腰甲","205521242":"飞甲虫X腰甲","205521244":"翼蛇龙套装X腰带","205521245":"水生兽X腰甲","205521246":"熔岩兽X腰甲","205521247":"毒狗龙X腰甲","205521248":"眠狗龙X腰甲","205521249":"青熊兽X腰甲","205521250":"赤甲兽X腰甲","205521251":"水兽X腰甲","205521252":"土砂龙X腰甲","205521253":"奇怪龙X腰甲","205521254":"迅龙X腰甲","205521255":"冰牙龙X腰甲","205521256":"雌火龙X腰甲","205521257":"火龙X腰甲","205521258":"轰龙X腰甲","205521259":"角龙X腰甲","205521260":"岩龙X腰甲","205521261":"雷狼龙X腰甲","205521262":"齐天带・真","205521263":"赫耀腰甲・真","205521264":"搔鸟X腰甲","205521265":"毒妖鸟X腰甲","205521266":"泥鱼龙X腰甲","205521267":"飞雷龙X腰甲","205521268":"蛮颚龙X腰甲","205521269":"爆鳞龙X腰甲","205521270":"铬合金X腰甲","205521276":"祸铠・真【腰具】","205521277":"白兔兽X腰甲","205521278":"骨制X腰甲","205521279":"泡狐龙X腰甲","205521280":"旅团X腰甲","205521282":"大名盾蟹腰甲","205521283":"将军镰蟹腰甲","205521284":"怒天带","205521285":"黑蚀龙腰甲","205521286":"方舟腰甲","205521287":"友爱腰甲","205521288":"千刃龙腰甲","205521289":"电龙腰甲","205521290":"阴阳师【腰带】","205521291":"祸铠・怨【腰具】","205521292":"天狗兽Z腰甲","205521293":"人鱼龙Z腰甲","205521294":"妃蜘蛛Z腰甲","205521295":"妃蜘蛛Z腰甲","205521296":"泥翁龙Ｚ腰甲","205521297":"矜持腰甲","205521298":"爵银龙腰甲","205521299":"冰狼龙腰甲","205521300":"刚缠兽护裙","205521301":"冥渊缠铠【怒尾】","205521302":"棘龙脐带","205521303":"蓝速龙护裙","205521304":"巨蜂护裙","205521305":"巨甲虫护裙","205521306":"教授腰带","205521307":"博爱裙","205521308":"公会诗人腰甲","205521309":"学士裙","205521310":"水手腰甲","205521311":"猎鹰腰甲","205521312":"求知裙","205521313":"贤者腰甲","205521314":"追踪者腰带","205521315":"据点司令【腰甲】","205521316":"据点司令【腰甲】","205521318":"巴尔巴尼亚腰带","205521319":"恩宠腰甲","205521320":"五行之衣带","205521321":"守护者腰甲","205521322":"公会宫殿腰甲","205521323":"结云带","205521324":"银白耀日腰甲","205521325":"金黄澄月腰甲","205521326":"棘龙Z脐带","205521327":"月光【腰带】","205521337":"重装骑士【腰甲】","205521338":"轻装骑士【腰甲】","205521339":"炮术队【腰】","205521352":"尊严腰带","205521353":"黑带S腰甲","205521387":"水行・醒【圆带】","205521388":"脉动钢龙安稳","205521389":"脉动帝王腰甲","205521390":"混茫护裙","205521391":"堕天护裙","205521394":"雪崩腰甲","205521395":"赫耀腰甲・历","205521396":"风雨 【带】","205521397":"美德腰甲","205521398":"原初腰甲","205521400":"健美腰部","205521402":"久爱腰甲","206569472":"炎火装束【绑腿】","206569473":"炎火装束【绑腿】霸","206569474":"皮制长裤","206569475":"皮制S长裤","206569476":"锁甲长裤","206569477":"锁甲S长裤","206569478":"猎人护腿","206569479":"猎人S护腿","206569480":"杜宾护腿","206569481":"合金护腿","206569482":"合金S护腿","206569483":"铸铁护腿","206569484":"铸铁S护腿","206569485":"花纹钢护腿","206569486":"花瓣扎根","206569487":"花瓣S扎根","206569488":"鱼鳞长裤","206569489":"鱼鳞S长裤","206569490":"死神脚跟","206569491":"死神S脚跟","206569492":"南瓜扎根","206569493":"南瓜S扎根","206569494":"南瓜扎根","206569495":"南瓜S扎根","206569496":"锹形脚","206569497":"锹形S脚","206569498":"凤蝶脚","206569499":"凤蝶S脚","206569500":"海境护腿","206569501":"海境S护腿","206569504":"雪绒花扎根","206569505":"雪绒花S扎根","206569506":"毒蝎脚","206569507":"毒蝎S脚","206569508":"毒蛛脚","206569509":"毒蛛S脚","206569510":"倪泰表【绑腿】","206569511":"倪泰表【绑腿】霸","206569512":"神凪【绯袴】","206569513":"神凪・愿【绯袴】","206569514":"倪泰里【绑腿】","206569515":"倪泰里【绑腿】霸","206569516":"依巫【绯袴】","206569517":"依巫・祈【绯袴】","206569518":"贝壳凉鞋","206569519":"贝壳S凉鞋","206569520":"哥特靴","206569521":"哥特S靴","206569522":"天狗兽护腿","206569523":"天狗兽S护腿","206569524":"伞鸟护腿","206569525":"伞鸟S护腿","206569526":"河童蛙护腿","206569527":"河童蛙S护腿","206569528":"人鱼龙护腿","206569529":"人鱼龙S护腿","206569530":"妃蜘蛛护腿","206569531":"妃蜘蛛护腿","206569532":"雪鬼兽护腿","206569533":"雪鬼兽S护腿","206569534":"泥翁龙护腿","206569535":"泥翁龙S护腿","206569536":"风卷之足","206569537":"风卷之足","206569538":"鸣神之足","206569539":"鸣神之足","206569540":"镰鼬龙护腿","206569541":"镰鼬龙S护腿","206569542":"钢龙踏实","206569543":"水行【腿甲】","206569544":"帝王护腿","206569549":"硬甲龙护腿","206569550":"硬甲龙S护腿","206569551":"狗龙皮护腿","206569552":"狗龙皮护腿S","206569553":"飞甲虫靴","206569554":"飞甲虫S靴","206569557":"翼蛇龙套装鞋子","206569558":"翼蛇龙套装S鞋子","206569559":"水生兽护腿","206569560":"水生兽S护腿","206569563":"毒狗龙护腿","206569564":"毒狗龙S护腿","206569565":"眠狗龙护腿","206569566":"眠狗龙S护腿","206569567":"青熊兽护腿","206569568":"青熊兽S护腿","206569569":"赤甲兽护腿","206569570":"赤甲兽S护腿","206569571":"水兽护腿","206569572":"水兽S护腿","206569573":"土砂龙护腿","206569574":"土砂龙S护腿","206569575":"奇怪龙护腿","206569576":"奇怪龙S护腿","206569577":"迅龙护腿","206569578":"迅龙S护腿","206569579":"冰牙龙护腿","206569580":"冰牙龙S护腿","206569581":"雌火龙护腿","206569582":"雌火龙S护腿","206569583":"火龙护腿","206569584":"火龙S护腿","206569585":"轰龙护腿","206569586":"轰龙S护腿","206569587":"角龙护腿","206569588":"角龙S护腿","206569589":"岩龙护腿","206569590":"岩龙S护腿","206569591":"雷狼龙护腿","206569592":"雷狼龙S护腿","206569593":"金色下裳","206569594":"赫耀护腿","206569595":"搔鸟护腿","206569596":"搔鸟S护腿","206569597":"毒妖鸟护腿","206569598":"毒妖鸟S护腿","206569599":"泥鱼龙护腿","206569600":"飞雷龙护腿","206569601":"飞雷龙S护腿","206569602":"蛮颚龙护腿","206569603":"蛮颚龙S护腿","206569604":"爆鳞龙护腿","206569605":"铬合金靴","206569608":"黑色皮裤","206569614":"祸铠【腿甲】","206569615":"祸铠・霸【腿甲】","206569616":"白兔兽护腿","206569617":"白兔兽S护腿","206569618":"骨制护腿","206569619":"骨制S护腿","206569620":"泡狐龙护腿","206569621":"泡狐龙S护腿","206569622":"旅团靴","206569625":"旅团S靴","206569640":"苍世武士【足履】","206569644":"公会十字靴","206569662":"黑带护腿","206569772":"炎火装束【绑腿】继","206569773":"皮制X长裤","206569774":"锁甲X长裤","206569775":"猎人X护腿","206569776":"杜宾X护腿","206569777":"合金X护腿","206569778":"铸铁X护腿","206569779":"花纹钢X护腿","206569780":"花瓣X扎根","206569781":"鱼鳞X长裤","206569782":"死神X脚跟","206569783":"南瓜X扎根","206569784":"南瓜X扎根","206569785":"锹形X脚","206569786":"凤蝶X脚","206569787":"海境X护腿","206569789":"雪绒花X扎根","206569790":"毒蝎X脚","206569791":"毒蛛X脚","206569792":"倪泰表【绑腿】真","206569793":"神凪・洸【绯袴】","206569794":"倪泰里【绑腿】真","206569795":"依巫・燿【绯袴】","206569796":"贝壳X凉鞋","206569797":"哥特X靴","206569798":"天狗兽X护腿","206569799":"伞鸟X护腿","206569800":"河童蛙X护腿","206569801":"人鱼龙X护腿","206569802":"妃蜘蛛X护腿","206569803":"妃蜘蛛X护腿","206569804":"雪鬼兽X护腿","206569805":"泥翁龙X护腿","206569806":"风卷之足","206569808":"鸣神之足","206569810":"镰鼬龙X护腿","206569811":"钢龙X踏实","206569812":"水行・真【腿甲】","206569813":"帝王X护腿","206569816":"硬甲龙X护腿","206569817":"狗龙皮护腿X","206569818":"飞甲虫X靴","206569820":"翼蛇龙套装X鞋子","206569821":"水生兽X护腿","206569823":"毒狗龙X护腿","206569824":"眠狗龙X护腿","206569825":"青熊兽X护腿","206569826":"赤甲兽X护腿","206569827":"水兽X护腿","206569828":"土砂龙X护腿","206569829":"奇怪龙X护腿","206569830":"迅龙X护腿","206569831":"冰牙龙X护腿","206569832":"雌火龙X护腿","206569833":"火龙X护腿","206569834":"轰龙X护腿","206569835":"角龙X护腿","206569836":"岩龙X护腿","206569837":"雷狼龙X护腿","206569838":"齐天腿甲・真","206569839":"赫耀护腿・真","206569840":"搔鸟X护腿","206569841":"毒妖鸟X护腿","206569842":"泥鱼龙X护腿","206569843":"飞雷龙X护腿","206569844":"蛮颚龙X护腿","206569845":"爆鳞龙X护腿","206569846":"铬合金X靴","206569852":"祸铠・真【腿甲】","206569853":"白兔兽X护腿","206569854":"骨制X护腿","206569855":"泡狐龙X护腿","206569856":"旅团X靴","206569858":"大名盾蟹护腿","206569859":"将军镰蟹护腿","206569860":"怒天下裳","206569861":"黑蚀龙护腿","206569862":"方舟护腿","206569863":"友爱护腿","206569864":"千刃龙护腿","206569865":"电龙护腿","206569866":"阴阳师【裙裤】","206569867":"祸铠・怨【腿甲】","206569868":"天狗兽Z护腿","206569869":"人鱼龙Z护腿","206569870":"妃蜘蛛Z护腿","206569871":"妃蜘蛛Z护腿","206569872":"泥翁龙Ｚ护腿","206569873":"矜持护腿","206569874":"爵银龙护腿","206569875":"冰狼龙护腿","206569876":"刚缠兽护腿","206569877":"冥渊缠铠【怒足】","206569878":"棘龙脚跟","206569879":"蓝速龙护腿","206569880":"巨蜂护腿","206569881":"巨甲虫护腿","206569882":"教授靴","206569883":"博爱靴","206569884":"公会诗人靴","206569885":"学士短袜","206569886":"水手鞋子","206569887":"猎鹰靴","206569888":"求知靴","206569889":"贤者靴","206569890":"追踪者长裤","206569891":"据点司令【腿甲】","206569892":"据点司令【腿甲】","206569894":"巴尔巴尼亚靴","206569895":"恩宠护腿","206569896":"五行之腿甲","206569897":"守护者靴","206569898":"公会宫殿护腿","206569899":"结云下裳","206569900":"银白耀日护腿","206569901":"金黄澄月护腿","206569902":"棘龙Z脚跟","206569903":"月光【腿甲】","206569913":"重装骑士【腿甲】","206569914":"轻装骑士【腿甲】","206569915":"炮术队【护腿】","206569928":"尊严护腿","206569929":"黑带S护腿","206569963":"水行・醒【腿甲】","206569964":"脉动钢龙踏实","206569965":"脉动帝王腿甲","206569966":"混茫护腿","206569967":"堕天护腿","206569970":"雪崩护腿","206569971":"赫耀护腿・历","206569972":"风雨 【裳】","206569973":"美德护腿","206569974":"原初护腿","206569976":"健美脚部","206569978":"久爱护腿"},"skillNames":{"1":"攻击","2":"挑战者","3":"无伤","4":"怨恨","5":"死里逃生","6":"看破","7":"超会心","8":"弱点特效","9":"力量解放","10":"精神抖擞","11":"会心击【属性】","12":"达人艺","13":"火属性攻击强化","14":"水属性攻击强化","15":"冰属性攻击强化","16":"雷属性攻击强化","17":"龙属性攻击强化","18":"毒属性强化","19":"麻痹属性强化","20":"睡眠属性强化","21":"爆破属性强化","22":"匠","23":"利刃","24":"弹丸节约","25":"刚刃打磨","26":"心眼","27":"弹道强化","28":"钝器能手","29":"解放弓的蓄力阶段","30":"集中","31":"强化持续","32":"跑者","33":"体术","34":"耐力急速回复","35":"防御性能","36":"防御强化","37":"攻击守势","38":"拔刀术【技】","39":"拔刀术【力】","40":"纳刀术","41":"击晕术","42":"夺取耐力","43":"滑走强化","44":"吹笛名人","45":"炮术","46":"炮弹装填","47":"特殊射击强化","48":"通常弹・连射箭强化","49":"贯穿弹・贯穿箭强化","50":"散弹・扩散箭强化","51":"装填扩充","52":"装填速度","53":"减轻后坐力","54":"抑制偏移","55":"速射强化","56":"防御","57":"精灵加护","58":"体力回复量提升","59":"回复速度","60":"快吃","61":"耳塞","62":"风压耐性","63":"耐震","64":"泡沫之舞","65":"回避性能","66":"回避距离提升","67":"火耐性","68":"水耐性","69":"冰耐性","70":"雷耐性","71":"龙耐性","72":"属性异常状态的耐性","73":"毒耐性","74":"麻痹耐性","75":"睡眠耐性","76":"昏厥耐性","77":"泥雪耐性","78":"爆破异常状态的耐性","79":"植生学","80":"地质学","81":"破坏王","82":"捕获名人","83":"剥取名人","84":"幸运","85":"砥石使用高速化","86":"炸弹客","87":"最爱蘑菇","88":"道具使用强化","89":"广域化","90":"满足感","91":"火场怪力","92":"不屈","93":"减轻胆怯","94":"跳跃铁人","95":"剥取铁人","96":"饥饿耐性","97":"飞身跃入","98":"佯动","99":"骑乘名人","100":"霞皮的恩惠","101":"钢壳的恩惠","102":"炎鳞的恩惠","103":"龙气活性","104":"翔虫使","105":"墙面移动","106":"逆袭","107":"高速变形","108":"鬼火缠","109":"风纹一致","110":"雷纹一致","111":"风雷合一","112":"气血","113":"伏魔耗命","114":"激昂","115":"业铠【修罗】","116":"因祸得福","117":"狂龙症【蚀】","118":"坚如磐石","119":"偷袭","120":"巧击","121":"嘲讽防御","122":"合气","123":"提供","124":"蓄力大师","125":"攻势","126":"零件改造","127":"打磨术【锐】","128":"刃鳞打磨","129":"走壁移动【翔】","130":"弱点特效【属性】","131":"连击","132":"毅力","133":"迅之气息","134":"状态异常必定累积","135":"刚心","136":"累积时攻击强化","137":"狂化","138":"风绕","139":"粉尘绕","140":"寒气炼成","141":"龙气转换","142":"天衣无缝","143":"狂龙症【翔】","144":"气血觉醒","145":"奋斗","146":"缓冲","147":"激励"}}]])

-- Sunbreak Forge 0.5.0: inventory export and reference-only loadouts.
-- File paths are relative to reframework/data. Never run shell commands here.
local OWNED_FORMAT = "Sunbreak Forge Owned Plan"
local SNAPSHOT_FORMAT = "Sunbreak Forge Inventory"
local inventorySequence = 0
local pendingInventoryAction = nil
local inventoryLastExport = nil
local INVENTORY_SCALARS = {
    {"Type", 131072}, {"InventoryIndex", -1}, {"IdType", 0}, {"IdVal", 0},
    {"BowgunCustomizeType", 0}, {"PairInsectInventoryIndex", -1}, {"BuildupPoint", 0},
    {"HyakuryuDecoId", 0}, {"HyakuryuModelId", 1048576}, {"CustomBuildupType", 0}, {"CustomCount", 0}
}
local INVENTORY_ARRAYS = {
    {"HyakuryuSkillIdList", 6}, {"PrevHyakuryuSkillId", 6}, {"TalismanDecoSlotNumList", 5},
    {"TalismanSkillIdList", 2}, {"TalismanSkillLvList", 2}
}

local function requireInteger(value, label, minimum, maximum)
    if type(value) ~= "number" or value ~= math.floor(value) or value < (minimum or 0) or value > (maximum or 2147483647) then
        error((label or "整数") .. "无效")
    end
    return value
end

local function intText(value, default)
    if value == nil then value = default or 0 end
    requireInteger(value, "装备字段", -2147483648, 2147483647)
    return string.format("%.0f", value)
end

local function inventoryFingerprint(item)
    local out = {"SBFI1"}
    for _, pair in ipairs(INVENTORY_SCALARS) do
        out[#out+1] = pair[1] .. "=" .. intText(item[pair[1]], pair[2])
    end
    for _, key in ipairs({"IsLock", "CustomEnable"}) do
        out[#out+1] = key .. "=" .. (item[key] == true and "1" or "0")
    end
    for _, pair in ipairs(INVENTORY_ARRAYS) do
        local values, source = {}, item[pair[1]] or {}
        for i = 1, pair[2] do values[i] = intText(source[i], 0) end
        out[#out+1] = pair[1] .. "=" .. table.concat(values, ",")
    end
    local opened, values = item.CustomOpenIdArray or {}, {}
    for i, value in ipairs(opened) do values[i] = intText(value, 0) end
    out[#out+1] = "CustomOpenIdArray=" .. tostring(#opened) .. ":" .. table.concat(values, ",")
    values = {}
    for i = 1, 7 do
        local atom = (item.CustomBuildup or {})[i] or {}
        values[i] = intText(atom.Id, 0) .. "," .. intText(atom.SkillId, 0) .. "," .. intText(atom.ValueIndex, 0)
    end
    out[#out+1] = "CustomBuildup=" .. table.concat(values, ";")
    return table.concat(out, "|")
end

local function inventoryArray(equipBox, box)
    local field = box == "equipment" and "_WeaponArmorInventoryList" or box == "petalaces" and "_LvBuffCageInventoryList" or nil
    if not field then error("未知装备箱类别") end
    local list = equipBox:get_field(field)
    local array = list and list:get_field("mItems")
    if not array then error("无法读取装备箱 " .. box) end
    local length = requireInteger(array:call("get_Length"), "装备箱长度", 0, 20000)
    return array, length
end

local function decorationCounts(dataManager)
    local box = dataManager:get_field("_PlDecorationsBox")
    local list = box and box:get_field("_InventoryDataList")
    local array = list and list:get_field("mItems")
    if not array then error("无法读取装饰品箱") end
    local counts, length = {}, requireInteger(array:call("get_Length"), "装饰品箱长度", 0, 20000)
    for i = 0, length - 1 do
        local obj = array:call("Get", i)
        if obj then
            local id, count = obj:get_field("_Id"), obj:get_field("_Num")
            if id and id > 0 then
                requireInteger(id, "珠子ID", 1)
                requireInteger(count, "珠子数量", 0, 1000000)
                counts[id] = (counts[id] or 0) + count
            end
        end
    end
    return counts
end

local function makeInventorySnapshot()
    local dm, manager = getDataManager(), getEquipDataManager()
    local box = dm and dm:get_field("_PlEquipBox")
    if not dm or not manager or not box then error("请先进入角色存档，在据点中导出库存") end
    local snapshot = {format = SNAPSHOT_FORMAT, version = 1, exportedAt = os.time(), decorationQuantityPolicy = "reported-conservative", items = {}, decorations = {}, sets = {}}
    local byInventory = {equipment = {}, petalaces = {}}
    for _, group in ipairs({"equipment", "petalaces"}) do
        local array, length = inventoryArray(box, group)
        for i = 0, length - 1 do
            local obj = array:call("Get", i)
            if obj and (obj:get_field("_IdVal") or 0) > 0 then
                local item = saveEquipmentInventoryData(obj)
                requireInteger(item.InventoryIndex, "装备箱内部索引", 0, 19999)
                local row = {box = group, index = i, item = item, fingerprint = inventoryFingerprint(item), referencedBy = {}}
                snapshot.items[#snapshot.items+1] = row
                local key = tostring(item.InventoryIndex)
                byInventory[group][key] = byInventory[group][key] or {}
                table.insert(byInventory[group][key], row)
            end
        end
    end
    local sets = manager:get_field("_PlEquipMySetList")
    if not sets then error("无法完整扫描游戏装备组合，已取消导出") end
    local count = requireInteger(sets:call("get_Length"), "组合数量", 0, 1000)
    for i = 0, count - 1 do
        local set = sets:call("Get", i)
        if set and set:get_field("_IsUsing") == true then
            local list = set:get_field("<InventoryDataList>k__BackingField")
            if not list then error("组合引用读取失败，已取消导出") end
            snapshot.sets[#snapshot.sets+1] = {slot = i+1, used = true}
            for j = 0, list:call("get_Length") - 1 do
                local obj = list:call("Get", j)
                if obj then
                    local group = j == 6 and "petalaces" or "equipment"
                    local rows = byInventory[group][tostring(obj:get_field("<InventoryIndex>k__BackingField"))] or {}
                    for _, row in ipairs(rows) do
                        if row.item.IdVal == obj:get_field("_IdVal") then row.referencedBy[#row.referencedBy+1] = i+1 end
                    end
                end
            end
        end
    end
    for id, quantity in pairs(decorationCounts(dm)) do snapshot.decorations[#snapshot.decorations+1] = {id = id, count = quantity} end
    table.sort(snapshot.decorations, function(a, b) return a.id < b.id end)
    return snapshot
end

local function exportInventorySnapshot()
    local snapshot = makeInventorySnapshot()
    local path
    repeat
        inventorySequence = inventorySequence + 1
        snapshot.exportId = "SBFI1-" .. getShortTimestamp() .. "-" .. tostring(inventorySequence)
        path = SAVE_FOLDER .. "/Inventory/inventory_" .. snapshot.exportId .. ".json"
    until exists(path) == false
    if not json.dump_file(path, snapshot, 2) then error("库存保存失败：" .. path) end
    local saved = json.load_file(path)
    if not saved or saved.format ~= SNAPSHOT_FORMAT or saved.exportId ~= snapshot.exportId or #(saved.items or {}) ~= #snapshot.items then error("库存文件回读校验失败，请保留现场并重试") end
    for i, row in ipairs(snapshot.items) do
        if saved.items[i].fingerprint ~= row.fingerprint or inventoryFingerprint(saved.items[i].item) ~= row.fingerprint then error("库存文件回读指纹不一致") end
    end
    if #(saved.decorations or {}) ~= #snapshot.decorations then error("珠子库存文件回读数量不一致") end
    for i, row in ipairs(snapshot.decorations) do
        if saved.decorations[i].id ~= row.id or saved.decorations[i].count ~= row.count then error("珠子库存文件回读校验失败") end
    end
    inventoryLastExport = {path = path, weapons = 0, armors = 0, charms = 0, other = 0, decoKinds = #snapshot.decorations, decoCount = 0, sets = #snapshot.sets}
    for _, row in ipairs(snapshot.items) do
        local item = row.item
        local kind = item.IdType == 1 and getWeaponTypeFromIdVal(item.IdVal) ~= "Unknown" and "weapons" or item.IdType == 2 and "armors" or item.IdType == 3 and "charms" or "other"
        inventoryLastExport[kind] = inventoryLastExport[kind] + 1
    end
    for _, row in ipairs(snapshot.decorations) do inventoryLastExport.decoCount = inventoryLastExport.decoCount + row.count end
    notice = "库存导出完成（只读）：“reframework/data/" .. path .. "”；装备 " .. #snapshot.items .. " 件，珠子 " .. #snapshot.decorations .. " 种。"
    return snapshot, path
end

local function resolveOwnedReference(box, ref)
    if type(ref) ~= "table" or ref.empty then error("缺少已有装备引用") end
    requireInteger(ref.index, "箱位索引", 0, 19999)
    local array, length = inventoryArray(box, ref.box)
    if ref.index >= length then error("箱位超出范围，请重新导出库存") end
    local obj = array:call("Get", ref.index)
    if not obj then error("已有装备已不存在，请重新导出库存") end
    local item = saveEquipmentInventoryData(obj)
    if item.InventoryIndex ~= ref.inventoryIndex or item.IdVal ~= ref.idVal or item.IdType ~= ref.idType or inventoryFingerprint(item) ~= ref.fingerprint then
        error("已有装备、炼化或强化状态已变化，请重新导出库存。未写入装备箱。")
    end
    return obj, item
end

local function ownedSlots(item)
    local row = item.IdType == 3 and {0,0,0,0} or OWNED_STATIC.slots[tostring(item.IdVal)]
    if not row then error("该装备的孔位尚无已验证数据，已拒绝导入") end
    local slots, points = {row[1], row[2], row[3]}, 0
    if item.IdType == 2 and item.CustomEnable then
        local effects = OWNED_STATIC.slotAtoms[tostring(row[4])] or {}
        for _, atom in ipairs(item.CustomBuildup or {}) do
            local values = effects[tostring(atom.Id)]
            if values then
                local value = values[tostring(atom.ValueIndex)]
                if value == nil then error("无法确认已有孔位炼化值") end
                points = points + value
            end
        end
    elseif item.IdType == 3 then
        slots = {}
        for level = 4, 1, -1 do
            local count = (item.TalismanDecoSlotNumList or {})[level+1] or 0
            requireInteger(count, "护石孔位数量", 0, 3)
            for _ = 1, count do slots[#slots+1] = level end
        end
        if #slots > 3 then error("护石孔位无效") end
        while #slots < 3 do slots[#slots+1] = 0 end
    end
    table.sort(slots, function(a, b) return a > b end)
    requireInteger(points, "已有孔位强化", 0, 12 - slots[1] - slots[2] - slots[3])
    for _ = 1, points do
        local found = nil
        for i = 1, 3 do if slots[i] == 0 then found = i; break end end
        if not found then for i = 1, 3 do if slots[i] < 4 then found = i; break end end end
        if not found then error("已有孔位超出容量") end
        slots[found] = slots[found] + 1
    end
    return slots
end

local function copyNumbers(values, length, label)
    if type(values) ~= "table" or #values ~= length then error(label .. "长度无效") end
    local out = {}
    for i = 1, length do out[i] = requireInteger(values[i], label, 0, 2147483647) end
    return out
end

local function applyOwnedPlan(loaded, slot)
    if loaded.application ~= OWNED_FORMAT or loaded.version ~= 1 or loaded.inventoryList ~= nil or loaded.backupList ~= nil then error("已有装备方案格式不受支持，已拒绝普通导入路径") end
    if type(loaded.inventoryId) ~= "string" or not loaded.inventoryId:match("^SBFI1%-%w+%-%d+$") then error("库存编号无效") end
    if type(loaded.references) ~= "table" or #loaded.references ~= 8 or type(loaded.slotDecorations) ~= "table" or #loaded.slotDecorations ~= 8 then error("已有装备引用需要八个槽位") end
    requireInteger(slot, "组合栏位", 1, 224)
    local dm, manager = getDataManager(), getEquipDataManager()
    local box = dm and dm:get_field("_PlEquipBox")
    local sets = manager and manager:get_field("_PlEquipMySetList")
    if not box or not sets or slot > sets:call("get_Length") then error("请在角色据点中导入，目标组合栏位不存在") end
    local target = sets:call("Get", slot - 1)
    local invList = target and target:get_field("<InventoryDataList>k__BackingField")
    local backups = target and target:get_field("_BackupDataList")
    if not invList or invList:call("get_Length") ~= 8 or not backups or backups:call("get_Length") ~= 8 then error("目标组合结构不匹配，未执行任何写入") end
    local objects, items, used = {}, {}, {}
    local armorPrefixes = {202375168, 203423744, 204472320, 205520896, 206569472}
    for i = 1, 8 do
        local ref = loaded.references[i]
        if i == 8 and type(ref) == "table" and ref.empty == true then
            items[i] = {IdVal = 0, IdType = 3, InventoryIndex = -1, TalismanDecoSlotNumList = {0,0,0,0,0}}
        else
            local obj, item = resolveOwnedReference(box, ref)
            local expectedType = i == 1 and 1 or i == 7 and 4 or i == 8 and 3 or 2
            if item.IdType ~= expectedType or ref.box ~= (i == 7 and "petalaces" or "equipment") then error("已有装备引用部位不符") end
            if i >= 2 and i <= 6 and math.floor(item.IdVal / 65536) * 65536 ~= armorPrefixes[i-1] then error("防具类型与组合部位不符") end
            local key = ref.box .. ":" .. ref.index
            if used[key] then error("同一库存实例被重复使用") end
            used[key] = true; objects[i], items[i] = obj, item
        end
    end
    local weaponType = getWeaponTypeFromIdVal(items[1].IdVal)
    if weaponType == "Unknown" or type(loaded.weaponInfo) ~= "table" or loaded.weaponInfo.type ~= weaponType or loaded.weaponInfo.idVal ~= items[1].IdVal then error("武器与模板类型不一致") end
    local insectObject, insectItem = nil, nil
    if weaponType == "InsectGlaive" then
        insectObject, insectItem = resolveOwnedReference(box, loaded.insect)
        if loaded.insect.box ~= "equipment" or insectItem.IdVal < 149946368 or insectItem.IdVal >= 150012000 or items[1].PairInsectInventoryIndex ~= insectItem.InventoryIndex then error("猎虫关联已变化，请先在游戏中配对并重新导出库存") end
    elseif loaded.insect ~= nil then error("非操虫棍方案不应包含猎虫引用") end
    local required, plans = {}, {}
    for i = 1, 8 do
        plans[i] = copyNumbers(loaded.slotDecorations[i], 3, "珠子列表")
        local slots = i == 7 and {0,0,0} or ownedSlots(items[i])
        for j, id in ipairs(plans[i]) do
            if id ~= 0 then
                local level = OWNED_STATIC.decoSlots[tostring(id)]
                if not level or level > slots[j] then error("珠子不适用于该已有装备孔位，未写入任何数据") end
                required[id] = (required[id] or 0) + 1
            end
        end
    end
    local currentCounts = decorationCounts(dm)
    for id, count in pairs(required) do if count > (currentCounts[id] or 0) then error("珠子库存已不足，请重新导出库存。不会创建珠子。") end end
    local info = loaded.mySetInfo
    if type(info) ~= "table" or type(info.Name) ~= "string" or #info.Name == 0 or #info.Name > 280 or info.Name:find("%z") then error("配装名称无效") end
    local action = copyNumbers(info.ActionIdList, 3, "替换技")
    local red, blue = copyNumbers(info.ActionIdListMR_Red, 5, "朱之书"), copyNumbers(info.ActionIdListMR_Blue, 5, "苍之书")
    local actionArray, redArray, blueArray = target:get_field("_ActionIdList"), target:get_field("_ActionIdListMR_Red"), target:get_field("_ActionIdListMR_Blue")
    if not actionArray or actionArray:call("get_Length") ~= 3 or not redArray or redArray:call("get_Length") ~= 5 or not blueArray or blueArray:call("get_Length") ~= 5 then error("替换技结构不匹配，未写入任何数据") end
    local old = {name = target:get_field("_Name"), using = target:get_field("_IsUsing"), action = arrayToTable(actionArray), red = arrayToTable(redArray), blue = arrayToTable(blueArray), refs = {}, backups = {}}
    local backupObjects = {}
    for i = 1, 8 do
        old.refs[i] = invList:call("Get", i-1)
        local backup = backups:call("Get", i-1)
        if not backup then error("组合珠子备份结构缺失，未写入任何数据") end
        local decos = backup:get_field("DecoIdList")
        if not decos or decos:call("get_Length") ~= 3 then error("备份孔位长度不匹配") end
        backupObjects[i] = backup
        old.backups[i] = {IdVal = backup:get_field("IdVal"), InsectIdVal = backup:get_field("InsectIdVal"), InsectInventoryIndex = backup:get_field("InsectInventoryIndex"), BowgunCustomizeType = backup:get_field("BowgunCustomizeType"), HyakuryuDecoId = backup:get_field("HyakuryuDecoId"), DecoIdList = arrayToTable(decos), insect = backup:get_field("<InsectInventory>k__BackingField")}
    end
    local managedName = sdk.create_managed_string(info.Name)
    if not managedName then error("无法创建组合名称，未执行写入") end
    -- All ownership/slot/quantity checks are complete. ONLY the target MySet is written.
    local ok, err = pcall(function()
        target:set_field("_Name", managedName); target:set_field("_IsUsing", true)
        tableToArray(action, actionArray); tableToArray(red, redArray); tableToArray(blue, blueArray)
        for i = 1, 8 do
            local backup, item = backupObjects[i], items[i]
            invList:call("Set", i-1, objects[i])
            backup:set_field("IdVal", item.IdVal)
            backup:set_field("InsectIdVal", i == 1 and insectItem and insectItem.IdVal or -1)
            backup:set_field("InsectInventoryIndex", i == 1 and insectItem and insectItem.InventoryIndex or -1)
            backup:set_field("<InsectInventory>k__BackingField", i == 1 and insectObject or nil)
            backup:set_field("BowgunCustomizeType", i == 1 and (item.BowgunCustomizeType or 0) or 0)
            backup:set_field("HyakuryuDecoId", i == 1 and (item.HyakuryuDecoId or 0) or 0)
            tableToArray(plans[i], backup:get_field("DecoIdList"))
        end
    end)
    if not ok then
        local restored = pcall(function()
            target:set_field("_Name", old.name); target:set_field("_IsUsing", old.using)
            tableToArray(old.action, actionArray); tableToArray(old.red, redArray); tableToArray(old.blue, blueArray)
            for i = 1, 8 do
                local backup, prior = backupObjects[i], old.backups[i]
                invList:call("Set", i-1, old.refs[i])
                for _, key in ipairs({"IdVal", "InsectIdVal", "InsectInventoryIndex", "BowgunCustomizeType", "HyakuryuDecoId"}) do backup:set_field(key, prior[key]) end
                backup:set_field("<InsectInventory>k__BackingField", prior.insect)
                tableToArray(prior.DecoIdList, backup:get_field("DecoIdList"))
            end
        end)
        error("组合写入失败；装备箱未写入。组合回滚" .. (restored and "成功：" or "未完成，请检查目标栏位：") .. tostring(err))
    end
    return true
end

local function queueOwnedPlan(data, slot, path)
    if pendingInventoryAction then error("已有库存操作正在等待执行") end
    pendingInventoryAction = {kind = "import", data = data, slot = slot, path = path}
    return true, "queued"
end

-- Experimental cleanup uses the game's equipment-box sale entry point, never clear().
-- API evidence: Fexty12573/mhr-charm-item-editor, RiseDataEditor.cpp, sell_charm().
local cleanup = {scan = nil, selected = {}, confirming = false, level = 1, page = 0, filter = 1, search = "", progress = ""}
local CLEANUP_LIMIT = 20000
local CLEANUP_LEVELS = {"未锁定且未镶珠", "未锁定（可含镶珠）", "未镶珠（可含锁定）", "全部（可含锁定和镶珠）"}

local function cleanupLevel(value)
    value = value or 1
    return requireInteger(value, "删除范围", 1, #CLEANUP_LEVELS)
end

local function cleanupJewels(item)
    local out = {}
    for _, id in ipairs(item.DecoIdList or {}) do if id ~= 0 and id ~= 1048576 then out[id] = (out[id] or 0)+1 end end
    local id = item.HyakuryuDecoId or 0
    if id ~= 0 and id ~= 1048576 then out[id] = (out[id] or 0)+1 end
    return out
end
local cleanupSequence = 0

-- Explicit no-sale protection: applies to every cleanup scope and live recheck.
-- Match stable game IDs, never display names or mutable lock / jewel state.
local CLEANUP_PROTECTED_IDS = {
    [139460644] = "传承太刀／继承宝刀一系",
    [139460645] = "传承太刀／继承宝刀一系",
    [139460646] = "传承太刀／继承宝刀一系",
    [139461053] = "传承太刀／继承宝刀一系",
    [139461055] = "传承太刀／继承宝刀一系",
    [202375340] = "公会十字系列",
    [202375358] = "黑带系列",
    [202375625] = "黑带S系列",
    [202375628] = "祝福羽饰",
    [203423916] = "公会十字系列",
    [203423934] = "黑带系列",
    [203424201] = "黑带S系列",
    [204472492] = "公会十字系列",
    [204472510] = "黑带系列",
    [204472777] = "黑带S系列",
    [205521068] = "公会十字系列",
    [205521086] = "黑带系列",
    [205521353] = "黑带S系列",
    [206569644] = "公会十字系列",
    [206569662] = "黑带系列",
    [206569929] = "黑带S系列",
    [269484039] = "新手护石",
    [269484041] = "老练护石",
    [269484042] = "家传护石",
}

local function typeName(td)
    return td and td:get_full_name() or ""
end

local function methodDescription(method)
    local types, out = method:get_param_types() or {}, {}
    for _, td in ipairs(types) do out[#out+1] = typeName(td) end
    return {name = method:get_name(), params = out, returnType = typeName(method:get_return_type()), static = method:is_static()}
end

local function cleanupSaleMethod(box, diagnostics)
    local td = box:get_type_definition()
    diagnostics.boxType = typeName(td)
    diagnostics.boxMethods = {}
    local methods = td:get_methods() or {}
    local found
    for _, method in ipairs(methods) do
        local name = method:get_name()
        if name:lower():find("sell", 1, true) or name:lower():find("delete", 1, true) or name:lower():find("remove", 1, true) then
            local description = methodDescription(method)
            diagnostics.boxMethods[#diagnostics.boxMethods+1] = description
            if name == "sellEquipment" and not description.static and method:get_num_params() == 1 and description.params[1] == "snow.data.EquipmentInventoryData" and (description.returnType == "System.Void" or description.returnType == "System.Boolean") then
                if found then error("sellEquipment 存在多个匹配重载，已停止删除") end
                found = method
            end
        end
    end
    if not found then error("未确认 sellEquipment(EquipmentInventoryData) 接口，已禁用删除") end
    return found
end

local function cleanupItemName(item)
    if item.IdType == 3 then
        local parts = {}
        for i, id in ipairs(item.TalismanSkillIdList or {}) do
            if id > 0 then parts[#parts+1] = (OWNED_STATIC.skillNames[tostring(id)] or ("技能#" .. id)) .. " Lv" .. tostring(item.TalismanSkillLvList[i] or 0) end
        end
        return #parts > 0 and table.concat(parts, " / ") or "护石"
    end
    return OWNED_STATIC.names[tostring(item.IdVal)] or ("装备#" .. item.IdVal)
end

local function cleanupKey(item)
    return tostring(item.InventoryIndex)
end

-- Discover READ-ONLY fields / property getters with actual SDK metadata. A complete
-- eight-slot loadout must be recognized; a guessed field never authorizes deletion.
local function cleanupCurrentEquipment(dm, manager, entries, protected, diagnostics)
    local visited, paths, examined = {}, {}, 0
    diagnostics.currentEquipment = {}
    local function checkArray(value, path)
        local ok, array, length = pcall(function()
            local td = value and value:get_type_definition()
            local name = typeName(td)
            if not name:find("EquipmentInventoryData", 1, true) then return nil end
            if name == "snow.data.EquipmentInventoryData" then
                local item = saveEquipmentInventoryData(value)
                if (item.IdVal or 0) > 0 then
                    local key = cleanupKey(item)
                    local entry = entries[key]
                    if entry and entry.item.IdVal == item.IdVal and entry.item.IdType == item.IdType then protected[key] = "装备上下文引用" end
                end
                return nil
            end
            if name:find("[]", 1, true) then return value, value:call("get_Length") end
            local inner = td:get_field("mItems") and value:get_field("mItems")
            if inner then return inner, value:call("get_Count") end
            local countMethod = td:get_method("get_Count")
            local itemMethod = td:get_method("get_Item(System.Int32)")
            if countMethod and itemMethod and countMethod:get_num_params() == 0 and itemMethod:get_num_params() == 1 and typeName(itemMethod:get_return_type()) == "snow.data.EquipmentInventoryData" then
                local adapter = {call = function(_, operation, i) if operation ~= "Get" then error("只读列表操作无效") end return itemMethod:call(value, i) end}
                return adapter, countMethod:call(value)
            end
        end)
        if not ok or not array or length ~= 8 then return false end
        local rows = {}
        for i = 0, 7 do
            local obj = array:call("Get", i)
            local id = obj and obj:get_field("_IdVal") or 0
            if id == 0 then
                if i < 6 or i == 6 then return false end
            else
                local item = saveEquipmentInventoryData(obj)
                local expected = i == 0 and 1 or i == 6 and 4 or i == 7 and 3 or 2
                if item.IdType ~= expected or (i == 0 and getWeaponTypeFromIdVal(item.IdVal) == "Unknown") then return false end
                if i >= 1 and i <= 5 and math.floor(item.IdVal / 65536) ~= 3088 + (i-1) * 16 then return false end
                if i ~= 6 then
                    local entry = entries[cleanupKey(item)]
                    if not entry or entry.item.IdVal ~= item.IdVal or entry.item.IdType ~= item.IdType then error("当前穿戴引用与装备箱不一致") end
                    rows[#rows+1] = cleanupKey(item)
                end
            end
        end
        for _, key in ipairs(rows) do protected[key] = "当前穿戴或装备上下文引用" end
        paths[#paths+1] = path
        diagnostics.currentEquipment[#diagnostics.currentEquipment+1] = {path = path, indices = rows}
        return true
    end
    local function visit(obj, path, depth)
        if not obj or visited[obj] or depth > 3 then return end
        local hasType, typeDefinition = pcall(function() return obj:get_type_definition() end)
        if not hasType or not typeDefinition then return end
        examined = examined + 1
        if examined > 48 then error("装备上下文过多，无法完整确认当前穿戴") end
        visited[obj] = true
        local td = typeDefinition
        local description = {path = path, type = typeName(td), fields = {}, getters = {}}
        diagnostics.types[#diagnostics.types+1] = description
        for _, field in ipairs(td:get_fields() or {}) do
            local name, kind = field:get_name(), typeName(field:get_type())
            local lower = (name .. " " .. kind):lower()
            if lower:find("equip", 1, true) and not lower:find("myset", 1, true) and not lower:find("box", 1, true) and not lower:find("backup", 1, true) then
                description.fields[#description.fields+1] = {name = name, type = kind}
                if not field:is_static() then
                    local value = obj:get_field(name)
                    if value and not checkArray(value, path .. "." .. name) and not kind:find("EquipmentInventoryData", 1, true) and depth < 3 then visit(value, path .. "." .. name, depth+1) end
                end
            end
        end
        for _, method in ipairs(td:get_methods() or {}) do
            local name = method:get_name()
            if name:match("^get_") then
                local info = methodDescription(method)
                if name:lower():find("equip", 1, true) or info.returnType:find("EquipmentInventoryData", 1, true) then description.getters[#description.getters+1] = info end
                if not info.static and method:get_num_params() == 0 and info.returnType:find("EquipmentInventoryData", 1, true) and not name:lower():find("myset", 1, true) and not name:lower():find("backup", 1, true) then
                    local value = method:call(obj)
                    if value then checkArray(value, path .. "." .. name .. "()") end
                end
            end
        end
    end
    visit(dm, "DataManager", 0)
    visit(manager, "EquipDataManager", 0)
    if #paths == 0 then error("无法确认完整的当前穿戴列表。已导出只读诊断，删除保持禁用") end
    return paths
end

local function inspectCleanup(level)
    level = cleanupLevel(level)
    local diagnostics = {version = 1, types = {}}
    local scan = {createdAt = os.time(), entries = {}, candidates = {}, excluded = {}, diagnostics = diagnostics, ready = false, level = level}
    local ok, err = pcall(function()
        local dm, manager = getDataManager(), getEquipDataManager()
        local box = dm and dm:get_field("_PlEquipBox")
        if not box or not manager then error("请先进入角色存档并回到据点") end
        local array, capacity = inventoryArray(box, "equipment")
        scan.capacity = capacity
        for i = 0, capacity-1 do
            local obj = array:call("Get", i)
            if obj and (obj:get_field("_IdVal") or 0) > 0 then
                local item = saveEquipmentInventoryData(obj)
                if item.InventoryIndex ~= i then error("装备箱索引不是稳定箱位，暂不支持删除") end
                scan.entries[tostring(i)] = {index = i, item = item, fingerprint = inventoryFingerprint(item), object = obj}
            end
        end
        local protected, setSignature = {}, {}
        local saleOK, method = pcall(cleanupSaleMethod, box, diagnostics)
        local currentOK, currentError = pcall(cleanupCurrentEquipment, dm, manager, scan.entries, protected, diagnostics)
        if not saleOK then diagnostics.saleError = tostring(method) end
        if not currentOK then diagnostics.currentError = tostring(currentError) end
        local sets = manager:get_field("_PlEquipMySetList")
        if not sets then error("无法完整读取游戏装备组合") end
        local count = requireInteger(sets:call("get_Length"), "装备组合数量", 1, 1000)
        diagnostics.mySetCount = count
        for i = 0, count-1 do
            local set = sets:call("Get", i)
            if not set then diagnostics.incompleteSet = i+1;error("装备组合 " .. (i+1) .. " 结构不完整") end
            local list = set:get_field("<InventoryDataList>k__BackingField")
            if not list or list:call("get_Length") ~= 8 then diagnostics.incompleteSet = i+1;error("装备组合 " .. (i+1) .. " 引用结构不完整") end
            local parts = {tostring(i), tostring(set:get_field("_IsUsing"))}
            for j = 0, 7 do
                local obj = list:call("Get", j)
                local id = obj and obj:get_field("_IdVal") or 0
                parts[#parts+1] = tostring(id)
                if id > 0 and j ~= 6 then
                    local index = obj:get_field("<InventoryIndex>k__BackingField")
                    local key = tostring(index)
                    local entry = scan.entries[key]
                    if not entry or entry.item.IdVal ~= id or entry.item.IdType ~= obj:get_field("_IdType") then error("组合 " .. (i+1) .. " 存在失效引用，停止清理") end
                    protected[key] = "被游戏组合引用"
                    parts[#parts+1] = key
                end
            end
            setSignature[#setSignature+1] = table.concat(parts, ":")
        end
        scan.setSignature = table.concat(setSignature, "|")
        if not currentOK then error(currentError) end
        if not saleOK then error(method) end
        local currentParts = {}
        for _, context in ipairs(diagnostics.currentEquipment) do
            currentParts[#currentParts+1] = context.path
            for _, key in ipairs(context.indices) do currentParts[#currentParts+1] = scan.entries[key].fingerprint end
        end
        scan.currentSignature = table.concat(currentParts, "|")
        for _, entry in pairs(scan.entries) do
            local pair = entry.item.PairInsectInventoryIndex
            if pair and pair >= 0 then protected[tostring(pair)] = "被猎虫关联引用" end
        end
        scan.method = method
        for key, entry in pairs(scan.entries) do
            local item, reason = entry.item, protected[key]
            local ordinary = item.IdType == 1 and getWeaponTypeFromIdVal(item.IdVal) ~= "Unknown" or item.IdType == 2 or item.IdType == 3
            if not ordinary then reason = "不清理猎虫、花链或未知类型"
            elseif CLEANUP_PROTECTED_IDS[item.IdVal] then reason = "禁止清理：" .. CLEANUP_PROTECTED_IDS[item.IdVal]
            elseif reason then -- Preserve the existing reference reason.
            elseif type(item.IsLock) ~= "boolean" then reason = "无法确认锁定状态"
            elseif (level == 1 or level == 2) and item.IsLock then reason = "当前范围排除锁定装备"
            elseif item.Type ~= 131072 then reason = "特殊状态或未知装备标记"
            elseif (item.PairInsectInventoryIndex or -1) >= 0 then reason = "装备仍关联猎虫"
            elseif #(item.DecoIdList or {}) ~= 3 then reason = "无法确认装饰品状态"
            elseif (level == 1 or level == 3) and next(cleanupJewels(item)) then reason = "当前范围排除镶珠装备"
            end
            entry.reason = reason
            if reason then scan.excluded[reason] = (scan.excluded[reason] or 0) + 1
            else
                entry.ref = {box = "equipment", index = entry.index, inventoryIndex = item.InventoryIndex, idType = item.IdType, idVal = item.IdVal, fingerprint = entry.fingerprint}
                entry.name = cleanupItemName(item)
                scan.candidates[#scan.candidates+1] = entry
            end
        end
        table.sort(scan.candidates, function(a,b) return a.index < b.index end)
        scan.ready = true
    end)
    if not ok then scan.error = tostring(err) end
    return scan
end

local function cleanupPath(prefix)
    local path
    repeat
        cleanupSequence = cleanupSequence + 1
        path = SAVE_FOLDER .. "/Cleanup/" .. prefix .. "_" .. getShortTimestamp() .. "_" .. cleanupSequence .. ".json"
    until exists(path) == false
    return path
end

local function scanCleanup(level)
    cleanup.selected, cleanup.confirming, cleanup.page = {}, false, 0
    cleanup.level = cleanupLevel(level)
    local scan = inspectCleanup(cleanup.level)
    local path = cleanupPath("scan")
    local report = {application = "Sunbreak Forge Cleanup Scan", version = 1, createdAt = scan.createdAt, ready = scan.ready, level = scan.level, error = scan.error, diagnostics = scan.diagnostics, excluded = scan.excluded, candidates = {}}
    for _, entry in ipairs(scan.candidates) do report.candidates[#report.candidates+1] = {name = entry.name, ref = entry.ref} end
    if not json.dump_file(path, report, 2) then error("扫描诊断保存失败，未启用删除") end
    local saved = json.load_file(path)
    if not saved or saved.application ~= report.application or saved.ready ~= report.ready then error("扫描诊断回读失败，未启用删除") end
    scan.path = path; cleanup.scan = scan
    notice = scan.ready and ("只读扫描完成：可选 " .. #scan.candidates .. " 件；没有删除任何装备。") or ("删除已禁用：" .. tostring(scan.error) .. "；诊断文件：" .. path)
end

local function sameDecorations(a,b)
    for id,count in pairs(a) do if b[id] ~= count then return false end end
    for id,count in pairs(b) do if a[id] ~= count then return false end end
    return true
end

local function executeCleanup(selection, confirmed, level, currentSignature)
    if confirmed ~= true then error("尚未确认删除") end
    if #selection < 1 or #selection > CLEANUP_LIMIT then error("每批请选择1至" .. CLEANUP_LIMIT .. "件，首次建议只选1件") end
    local before = inspectCleanup(level)
    if not before.ready then error(before.error) end
    if before.currentSignature ~= currentSignature then error("穿戴上下文已变化，请重新扫描") end
    local selected, unique = {}, {}
    for _, ref in ipairs(selection) do
        if ref.box ~= "equipment" then error("仅支持装备箱中的武器、防具和护石") end
        local obj, item = resolveOwnedReference(getDataManager():get_field("_PlEquipBox"), ref)
        local key = tostring(ref.index)
        local row = before.entries[key]
        if unique[key] or not row or row.reason or row.fingerprint ~= ref.fingerprint or table.concat(row.item.DecoIdList, ",") ~= ref.cleanupDecorations then error("选择项已变化或受到保护，请重新扫描") end
        unique[key] = true; selected[#selected+1] = {ref = ref, name = row.name}
    end
    local snapshot = makeInventorySnapshot()
    inventorySequence = inventorySequence + 1
    snapshot.exportId = "SBFI1-" .. getShortTimestamp() .. "-" .. inventorySequence
    local audit = {application = "Sunbreak Forge Cleanup Backup", version = 1, createdAt = os.time(), level = level, before = snapshot, selection = selected, status = "prepared", results = {}}
    local path = cleanupPath("backup")
    local resultPath = cleanupPath("result")
    local originalCounts = {};for _,d in ipairs(snapshot.decorations) do originalCounts[d.id] = d.count end
    local expectedCounts = {};for id,n in pairs(originalCounts) do expectedCounts[id]=n end
    local function saveAudit()
        if audit.status ~= "prepared" then
            local results = {};for _,row in ipairs(audit.results) do results[#results+1]={index=row.ref.index,status=row.status} end
            local ledger = {application="Sunbreak Forge Cleanup Result",version=1,backupPath=path,createdAt=audit.createdAt,level=level,status=audit.status,error=audit.error,pendingIndex=audit.pending and audit.pending.index,selectedCount=#selected,results=results,decorationsAfter=expectedCounts}
            if not json.dump_file(resultPath, ledger, 0) then error("清理结果保存失败：" .. resultPath) end
            local saved=json.load_file(resultPath)
            if not saved or saved.status~=ledger.status or saved.backupPath~=path or #(saved.results or {})~=#results or saved.pendingIndex~=ledger.pendingIndex then error("清理结果回读失败") end
            return
        end
        if not json.dump_file(path, audit, 2) then error("清理记录保存失败：" .. path) end
        local saved = json.load_file(path)
        if not saved or saved.application ~= audit.application or saved.status ~= audit.status or #(saved.results or {}) ~= #audit.results then error("清理记录回读失败") end
        if not saved.before or #(saved.before.items or {}) ~= #snapshot.items or not sameDecorations(originalCounts, (function() local out={};for _,d in ipairs(saved.before.decorations or {}) do out[d.id]=d.count end;return out end)()) then error("清理备份回读失败") end
        for i,row in ipairs(snapshot.items) do
            if saved.before.items[i].fingerprint ~= row.fingerprint or inventoryFingerprint(saved.before.items[i].item) ~= row.fingerprint or table.concat(saved.before.items[i].item.DecoIdList, ",") ~= table.concat(row.item.DecoIdList, ",") then error("清理备份指纹回读失败") end
        end
    end
    saveAudit() -- No sale can occur before the full inventory backup is read back.
    local removed = {}
    local function checkStable(scan)
        if not scan.ready or scan.capacity ~= before.capacity or scan.setSignature ~= before.setSignature or scan.currentSignature ~= before.currentSignature then error(scan.error or "装备箱、组合或穿戴已变化，停止后续操作") end
        for key, prior in pairs(before.entries) do
            local row = scan.entries[key]
            if removed[key] then
                if row then error("已删除箱位重新出现装备，停止后续操作") end
            elseif not row or row.fingerprint ~= prior.fingerprint or table.concat(row.item.DecoIdList, ",") ~= table.concat(prior.item.DecoIdList, ",") then error("其他装备发生变化，停止后续操作") end
        end
        for key in pairs(scan.entries) do if not before.entries[key] then error("装备箱新增条目，停止后续操作") end end
    end
    local ok, err = pcall(function()
        for _, chosen in ipairs(selected) do
            local live = inspectCleanup(level)
            checkStable(live)
            local ref, key = chosen.ref, tostring(chosen.ref.index)
            local row = live.entries[key]
            if not row or row.reason or row.fingerprint ~= ref.fingerprint then error("待删除装备状态已变化") end
            if not sameDecorations(decorationCounts(getDataManager()), expectedCounts) then error("珠子库存已变化，停止后续操作") end
            audit.status = "selling";audit.pending = ref;saveAudit()
            local result = live.method:call(getDataManager():get_field("_PlEquipBox"), row.object)
            local after = inspectCleanup(level)
            if result == false or not after.ready or after.entries[key] then error("游戏接口未确认目标已移除；停止后续操作") end
            removed[key] = true
            checkStable(after)
            local countsAfter, jewels = decorationCounts(getDataManager()), cleanupJewels(row.item)
            local ids = {};for id in pairs(expectedCounts) do ids[id]=true end;for id in pairs(countsAfter) do ids[id]=true end
            for id in pairs(ids) do
                local delta = (countsAfter[id] or 0)-(expectedCounts[id] or 0)
                -- _Num may represent total owned or loose jewels. Accept unchanged
                -- counts or exactly the sold item's refund; never fabricate refunds.
                if delta ~= 0 and delta ~= (jewels[id] or 0) then error("珠子数量出现非预期变化，停止后续操作") end
            end
            expectedCounts = countsAfter
            audit.pending = nil;audit.results[#audit.results+1] = {ref = ref, status = "removed", decorationsAfter = countsAfter};audit.status = "partial";saveAudit()
            cleanup.progress = "清理中：" .. #audit.results .. " / " .. #selected .. " 件"
            if #audit.results < #selected then coroutine.yield() end
        end
        audit.status = "completed";saveAudit()
    end)
    if not ok then
        audit.status = "stopped";audit.error = tostring(err);pcall(saveAudit)
        cleanup.scan = nil;cleanup.selected = {};cleanup.confirming = false;cleanup.progress = ""
        error("清理中止；已记录成功 " .. #audit.results .. " 件，接口可能已改变待处理项。未尝试自动恢复。备份记录：" .. path .. "；结果：" .. resultPath .. "；" .. tostring(err))
    end
    cleanup.scan = nil;cleanup.selected = {};cleanup.confirming = false;cleanup.progress = ""
    notice = "清理完成：" .. #audit.results .. " 件。已使用游戏出售接口；请检查装备箱并重新导出库存。备份记录：" .. path .. "；结果：" .. resultPath
end

function ELM_ScanUnusedEquipment(level)
    if pendingInventoryAction then return false end
    level = cleanupLevel(level)
    cleanup.scan = nil;cleanup.selected = {};cleanup.confirming = false
    pendingInventoryAction = {kind = "cleanup_scan", level = level}
    return true
end

local function cleanupFilteredCandidates(category, query)
    local out = {}
    query = (query or ""):lower()
    for _, entry in ipairs(cleanup.scan and cleanup.scan.candidates or {}) do
        if (category == 1 or entry.item.IdType == category-1) and (query == "" or (entry.name .. " " .. (entry.index+1)):lower():find(query, 1, true)) then out[#out+1] = entry end
    end
    return out
end

-- Selection only: no game mutation, no additional confirmation or category widening.
function ELM_SelectUnusedEquipment(category, query)
    if pendingInventoryAction or not cleanup.scan or not cleanup.scan.ready then return nil end
    category = requireInteger(category or 1, "候选类别", 1, 4)
    local refs = {}
    for _, entry in ipairs(cleanupFilteredCandidates(category, query)) do cleanup.selected[entry.index] = true;refs[#refs+1] = entry.ref end
    cleanup.confirming = false
    return refs
end

-- The one explicit confirmation covers the exact selected instances and scan scope.
function ELM_DeleteUnusedEquipment(selection, confirmed)
    if pendingInventoryAction or type(selection) ~= "table" then return false end
    if not cleanup.scan or not cleanup.scan.ready then notice = "请先完成本次只读扫描";return false end
    if confirmed ~= true or #selection < 1 or #selection > CLEANUP_LIMIT then notice = "请确认本次删除及件数";return false end
    local copy = {}
    for _, ref in ipairs(selection) do
        local scanned = type(ref) == "table" and cleanup.scan.entries[tostring(ref.index)]
        if not scanned or scanned.reason or not scanned.ref or scanned.fingerprint ~= ref.fingerprint or ref.box ~= "equipment" then notice = "所选装备不在本次可删除范围内";return false end
        copy[#copy+1] = {box = ref.box, index = ref.index, inventoryIndex = ref.inventoryIndex, idType = ref.idType, idVal = ref.idVal, fingerprint = ref.fingerprint, cleanupDecorations = table.concat(scanned.item.DecoIdList, ",")}
    end
    pendingInventoryAction = {kind = "cleanup_delete", selection = copy, confirmed = true, level = cleanup.scan.level, currentSignature = cleanup.scan.currentSignature}
    return true
end

re.on_application_entry("UpdateBehavior", function()
    local job = pendingInventoryAction
    if not job then return end
    local isCleanup = job.kind == "cleanup_delete"
    if not isCleanup then pendingInventoryAction = nil end
    local ok, err = pcall(function()
        if job.kind == "cleanup_scan" then scanCleanup(job.level)
        elseif isCleanup then
            if not job.task then job.task = coroutine.create(function() executeCleanup(job.selection, job.confirmed, job.level, job.currentSignature) end) end
            local resumed, message = coroutine.resume(job.task)
            if not resumed then error(message) end
            if coroutine.status(job.task) == "dead" then pendingInventoryAction = nil end
        elseif job.kind == "export" then exportInventorySnapshot()
        elseif job.kind == "import" then
            applyOwnedPlan(job.data, job.slot)
            rowNotices[job.path] = "已绑定已有装备至组合 " .. job.slot .. "；装备箱及珠子数量未修改。"
            notice = rowNotices[job.path]
        end
    end)
    if not ok then
        pendingInventoryAction = nil
        if job.kind == "cleanup_delete" then cleanup.scan = nil;cleanup.selected = {};cleanup.confirming = false;cleanup.progress = "" end
        notice = "库存操作已停止：" .. tostring(err)
        if job.path then rowNotices[job.path] = notice end
    end
end)

function ELM_ExportInventorySnapshot()
    if pendingInventoryAction then return false end
    pendingInventoryAction = {kind = "export"}
    notice = "准备导出完整库存与组合引用；只读，不删除或修改装备。"
    return true
end

-- Pure helper for integration checks; no game writes.
function ELM_InventoryFingerprint(item) return inventoryFingerprint(item) end
function ELM_GetInventoryStatus() return notice end

-- Load strictly into the slot encoded in the filename.
local function loadSetFromFile(relativePath)
    local slot = slotFromPath(relativePath)
    if not slot then notice = "文件名没有有效栏位（1-224）：" .. basename(relativePath); return false end
    if not json_decode then return false end
    local manager = getEquipDataManager()
    if not manager then return false end

    local fullPath = relativePath
    local file = io.open(fullPath, "r")
    if not file then return false end
    local jsonString = file:read("*a")
    file:close()
    local loadedData = json_decode(jsonString)
    if type(loadedData) ~= "table" then notice = "不是有效的配装JSON"; return false end
    local ownedName = basename(relativePath):match("^owned_") ~= nil
    if ownedName or loadedData.application == OWNED_FORMAT or loadedData.references ~= nil or loadedData.inventoryId ~= nil then
        if not ownedName or loadedData.application ~= OWNED_FORMAT or loadedData.version ~= 1 or loadedData.inventoryList ~= nil or loadedData.backupList ~= nil then
            notice = "已有装备文件格式或owned_前缀不匹配，已拒绝普通导入路径"; return false
        end
        local ok, accepted, state = pcall(queueOwnedPlan, loadedData, slot, relativePath)
        if not ok then notice = tostring(accepted); return false end
        return accepted, state
    end
    if type(loadedData.inventoryList) ~= "table" or #loadedData.inventoryList ~= 8 or type(loadedData.backupList) ~= "table" or #loadedData.backupList ~= 8 or type(loadedData.mySetInfo) ~= "table" then
        notice = "不是标准Mod配装，未执行写入"; return false
    end

    local dataManager = getDataManager()
    local equipBox = dataManager and dataManager:get_field("_PlEquipBox")

    local mySetList = manager:get_field("_PlEquipMySetList")
    if not mySetList then return false end
    if slot > mySetList:call("get_Length") then
        notice = "游戏配装栏位不存在：" .. tostring(slot)
        return false
    end
    local firstMySet = mySetList:call("Get", slot - 1)
    if not firstMySet then return false end

    local invList = firstMySet:get_field("<InventoryDataList>k__BackingField")
    if not invList then return false end

    -- 如果不保留装备，则清除当前装备槽
    if not keepEquipment then
        if invList then
            local len = invList:call("get_Length")
            for slotIdx = 0, math.min(len - 1, 7) do
                if slotIdx ~= 6 then  -- 花链槽不在此清除（单独处理）
                    local inv = invList:call("Get", slotIdx)
                    if inv then pcall(function() inv:call("clear") end) end
                end
            end
        end
    end
    pcall(function() firstMySet:call("clear") end)

    -- 加载mySetInfo（名称、替换技等）
    if loadedData.mySetInfo then
        local displayName = loadedData.mySetInfo.Name
        if not displayName or displayName == "" then
            displayName = relativePath:match("([^/]+)%.json$") or relativePath
        end
        firstMySet:set_field("_Name", sdk.create_managed_string(displayName))
        firstMySet:set_field("_IsUsing", loadedData.mySetInfo.IsUsing)
        tableToArray(loadedData.mySetInfo.ActionIdList, firstMySet:get_field("_ActionIdList"))
        tableToArray(loadedData.mySetInfo.ActionIdListMR_Red, firstMySet:get_field("_ActionIdListMR_Red"))
        tableToArray(loadedData.mySetInfo.ActionIdListMR_Blue, firstMySet:get_field("_ActionIdListMR_Blue"))
    end

    -- 加载备份数据（主要是珠子信息）
    local backupDataList = firstMySet:get_field("_BackupDataList")
    if backupDataList and loadedData.backupList then
        for i, entry in ipairs(loadedData.backupList) do
            local backup = backupDataList:call("Get", i-1)
            if backup then
                backup:set_field("IdVal", entry.IdVal or 0)
                backup:set_field("InsectIdVal", entry.InsectIdVal or 0)
                backup:set_field("InsectInventoryIndex", entry.InsectInventoryIndex or -1)
                backup:set_field("BowgunCustomizeType", entry.BowgunCustomizeType or 0)
                backup:set_field("HyakuryuDecoId", entry.HyakuryuDecoId or 0)
                tableToArray(entry.DecoIdList, backup:get_field("DecoIdList"))
            end
        end
    end

    invList = firstMySet:get_field("<InventoryDataList>k__BackingField")
    if invList and loadedData.inventoryList then
        local weaponWasCreatedNew = false

        -- 逐个槽位加载装备
        for i, invData in ipairs(loadedData.inventoryList) do
            local slotIdx = i-1
            if slotIdx == 6 then  -- 花链槽（单独处理）
                if equipBox then
                    local coralList = equipBox:get_field("_LvBuffCageInventoryList")
                    local existingCoral = nil
                    if coralList then
                        local count = coralList:call("get_Count")
                        for idx = 0, count - 1 do
                            local inv = coralList:call("get_Item", idx)
                            if inv and inv:get_field("_IdVal") == invData.IdVal then
                                existingCoral = inv
                                break
                            end
                        end
                    end
                    if existingCoral then
                        invList:call("Set", slotIdx, existingCoral)
                    else
                        local coralObj = ensureCoralExists(equipBox, invData, true)
                        if coralObj then invList:call("Set", slotIdx, coralObj) end
                    end
                end
            else
                local inv = invList:call("Get", slotIdx)
                if not inv then
                    if equipBox then
                        -- 尝试在装备箱中创建或复用
                        local skipBuildup = false
                        inv = ensureEquipmentExists(equipBox, invData, slotIdx, skipBuildup)
                        if inv then
                            invList:call("Set", slotIdx, inv)
                            setArmorBuildupIfNeeded(inv, slotIdx)
                            if slotIdx == 0 then
                                weaponWasCreatedNew = true
                            end
                            goto continue_slot
                        else
                            goto continue_slot
                        end
                    else
                        goto continue_slot
                    end
                else
                    if slotIdx == 0 then
                        loadEquipmentInventoryData(inv, invData, false)
                    else
                        loadEquipmentInventoryData(inv, invData)
                    end
                    setArmorBuildupIfNeeded(inv, slotIdx)
                end
            end
            ::continue_slot::
        end

        -- 武器炼化开启处理
        if invList and loadedData.inventoryList then
            local weaponInv = invList:call("Get", 0)
            local weaponDataFromFile = loadedData.inventoryList[1]
            if weaponInv and weaponDataFromFile then
                -- 如果是新创建的武器且启用了解锁选项，则强制开启所有预设词条
                if weaponWasCreatedNew and unlockWeaponBuildup then
                    local wData = weaponInv:call("getWeaponBaseData") or weaponInv:call("getWeaponData")
                    if wData then
                        local rare = wData:get_field("_RareType")
                        if rare == 9 then
                            weaponInv:set_field("_CustomEnable", true)
                            for _, id in ipairs(PRESET_BUILDUP_IDS) do
                                pcall(function() weaponInv:call("openCustombuildup", id) end)
                            end
                        else
                            local ids = weaponDataFromFile.CustomOpenIdArray or {}
                            for _, id in ipairs(ids) do
                                pcall(function() weaponInv:call("openCustombuildup", id) end)
                            end
                            weaponInv:set_field("_CustomEnable", weaponDataFromFile.CustomEnable or false)
                        end
                    else
                        local ids = weaponDataFromFile.CustomOpenIdArray or {}
                        for _, id in ipairs(ids) do
                            pcall(function() weaponInv:call("openCustombuildup", id) end)
                        end
                        weaponInv:set_field("_CustomEnable", weaponDataFromFile.CustomEnable or false)
                    end
                else
                    local ids = weaponDataFromFile.CustomOpenIdArray or {}
                    for _, id in ipairs(ids) do
                        pcall(function() weaponInv:call("openCustombuildup", id) end)
                    end
                    weaponInv:set_field("_CustomEnable", weaponDataFromFile.CustomEnable or false)
                end

                -- 猎虫配对
                if weaponDataFromFile.PairedInsectData and equipBox then
                    local weaponArmorList = equipBox:get_field("_WeaponArmorInventoryList")
                    if weaponArmorList then
                        local targetInsectId = weaponDataFromFile.PairedInsectData.IdVal
                        local foundInsectInv = nil
                        local insectIndex = -1
                        local count = weaponArmorList:call("get_Count")
                        for idx = 0, count - 1 do
                            local inv = weaponArmorList:call("get_Item", idx)
                            if inv and inv:get_field("_IdVal") == targetInsectId then
                                foundInsectInv = inv
                                insectIndex = idx
                                break
                            end
                        end
                        if foundInsectInv and backupDataList and backupDataList:call("get_Length") > 0 then
                            local backupData = backupDataList:call("Get", 0)
                            if backupData then
                                backupData:set_field("InsectIdVal", targetInsectId)
                                backupData:set_field("InsectInventoryIndex", insectIndex)
                                backupData:set_field("<InsectInventory>k__BackingField", foundInsectInv)
                            end
                        end
                    end
                end
            end
        end
    end
    return true
end

-- 扫描所有JSON文件，重建配装列表（用于刷新）
local function scanAllJsonFiles()
    local newConfig = {}
    local totalFiles = 0

    local pattern = [[EquipmentLoadouts\\.*\.json]]
    local files = fs.glob(pattern)
    if files and #files > 0 then
        for _, filePath in ipairs(files) do
            local filename = filePath:match("\\([^\\]+)%.json$") or filePath:match("([^/]+)%.json$")
            if filename and filename:match("^20%d+$") and #filename == 17 then
                goto continue
            end

            local opened, f = pcall(io.open, filePath, "r")
            if opened and f then
                local jsonString = f:read("*a")
                f:close()
                local ok, data = pcall(json_decode, jsonString)
                if ok and type(data) == "table" then
                    local weaponName, weaponTypeChinese, displayName
                    if data.application == OWNED_FORMAT and data.version == 1 and type(data.weaponInfo) == "table" and basename(filePath):match("^owned_") then
                        weaponName = data.weaponInfo.name or "已有武器"
                        weaponTypeChinese = WEAPON_TYPE_CHINESE[data.weaponInfo.type] or data.weaponInfo.type
                        displayName = "[已有] " .. tostring(data.displayName or "已有装备配装")
                    elseif data.uiInfo and data.uiInfo.weaponName and data.uiInfo.weaponType then
                        weaponName = data.uiInfo.weaponName
                        local weaponTypeEn = data.uiInfo.weaponType
                        weaponTypeChinese = WEAPON_TYPE_CHINESE[weaponTypeEn] or weaponTypeEn
                        displayName = data.uiInfo.displayName or (filePath:match("\\([^\\]+)%.json$") or filePath)
                    else
                        if data.inventoryList and #data.inventoryList > 0 then
                            local weaponInvData = data.inventoryList[1]
                            if weaponInvData and weaponInvData.IdVal then
                                local weaponTypeEn = getWeaponTypeFromIdVal(weaponInvData.IdVal)
                                if weaponTypeEn ~= "Unknown" then
                                    weaponTypeChinese = WEAPON_TYPE_CHINESE[weaponTypeEn] or weaponTypeEn
                                    weaponName = weaponTypeChinese
                                    displayName = (data.mySetInfo and data.mySetInfo.Name) or (filePath:match("\\([^\\]+)%.json$") or filePath)
                                else
                                    goto continue
                                end
                            else
                                goto continue
                            end
                        else
                            goto continue
                        end
                    end
                    table.insert(newConfig, {
                        relativePath = filePath,
                        slotNumber = slotFromPath(filePath),
                        weaponTypeChinese = weaponTypeChinese,
                        weaponName = weaponName,
                        displayName = displayName
                    })
                    totalFiles = totalFiles + 1
                end
            end
            ::continue::
        end
    end

    table.sort(newConfig, function(a, b)
        local sa = slotFromPath(a.relativePath) or 225
        local sb = slotFromPath(b.relativePath) or 225
        if sa ~= sb then return sa < sb end
        return a.relativePath < b.relativePath
    end)

    configList = newConfig
end

-- 读取索引文件，加载已保存的配装列表
local function readIndex()
    configList = {}
    local file = io.open(INDEX_FILE, "r")
    if file then
        local content = file:read("*a")
        file:close()
        local data = json_decode(content)
        if type(data) == "table" then
            for _, entry in ipairs(data) do
                if type(entry) == "table" and entry.relativePath and entry.weaponTypeChinese and entry.weaponName and entry.displayName then
                    table.insert(configList, entry)
                end
            end
        end
    end
    table.sort(configList, function(a, b)
        local sa = slotFromPath(a.relativePath) or 225
        local sb = slotFromPath(b.relativePath) or 225
        if sa ~= sb then return sa < sb end
        return a.relativePath < b.relativePath
    end)
end

-- 写入索引文件
local function writeIndex()
    ensureFolderExists()
    local file = io.open(INDEX_FILE, "w")
    if file then
        local content
        if next(configList) == nil then
            content = "[]"
        else
            content = json_encode(configList)
        end
        file:write(content)
        file:close()
    end
end

-- 刷新配装列表（扫描文件+更新索引）
local function refreshConfigList()
    scanAllJsonFiles()
    writeIndex()
end

-- Check a game slot without altering it. Fail closed if its state is unknown.
local function isSlotOccupied(slot)
    local manager = getEquipDataManager()
    if not manager then return nil end
    local sets = manager:get_field("_PlEquipMySetList")
    if not sets or slot < 1 or slot > sets:call("get_Length") then return nil end
    local set = sets:call("Get", slot - 1)
    if not set then return nil end
    local ok, using = pcall(function() return set:get_field("_IsUsing") end)
    if not ok then return nil end
    return using == true
end

local function requestImport(path)
    local slot = slotFromPath(path)
    if not slot then rowNotices[path] = "请先给文件设置 1-224 的栏位：" .. basename(path); return end
    local occupied = isSlotOccupied(slot)
    -- Unknown state also requires confirmation.
    if occupied == false then
        local loaded, state = loadSetFromFile(path)
        if loaded then rowNotices[path] = state == "queued" and "已有装备引用正在等待校验" or "已加载至栏位 " .. slot
        else rowNotices[path] = "加载失败，请检查文件及游戏状态" end
    else
        pendingImport = {path = path, slot = slot}
        rowNotices[path] = nil
    end
end

local function renameSlotFile(path, newSlot, allowOverwrite)
    if not slotFromPath(path) then notice = "旧文件没有可识别栏位"; return false end
    if newSlot < 1 or newSlot > 224 then notice = "栏位必须在 1-224"; return false end
    local oldname = basename(path)
    local ownedPrefix = oldname:match("^owned_") and "owned_" or ""
    local tail = oldname:match("^owned_%d+_(.+%.json)$") or oldname:match("^%d+_(.+%.json)$")
    if not tail then notice = "文件名格式错误"; return false end
    local newname = ownedPrefix .. tostring(newSlot) .. "_" .. tail
    local dest = path:sub(1, #path-#oldname) .. newname
    if dest == path then return true end
    local present, err = exists(dest)
    if present == nil then notice = err; return false end
    if present and not allowOverwrite then
        pendingRename = {path = path, target = dest, slot = newSlot}
        return false
    end
    -- No destructive rename to existing targets: reject collisions (safe option).
    if present then notice = "目标文件已存在，已拒绝覆盖：" .. newname; return false end
    -- REFramework disables process execution and may not expose rename/remove.
    -- Copy data first, verify byte-for-byte, and NEVER remove the source.
    local readOK, sourceData = pcall(function()
        local src = assert(io.open(path, "rb"))
        local okRead, content = pcall(function() return src:read("*a") end)
        src:close()
        if not okRead then error(content) end
        return content
    end)
    if not readOK or type(sourceData) ~= "string" then
        notice = "修改栏位失败：无法读取旧文件：" .. tostring(sourceData)
        return false
    end
    -- Recheck before opening in write mode to avoid replacing an existing file.
    local recheck, recheckErr = exists(dest)
    if recheck == nil then notice = recheckErr; return false end
    if recheck then
        notice = "目标文件已存在，已拒绝覆盖：" .. newname
        return false
    end
    local writeOK, writeErr = pcall(function()
        local dst = assert(io.open(dest, "wb"))
        local okWrite, result = pcall(function() return dst:write(sourceData) end)
        local okClose, closeErr = pcall(function() return dst:close() end)
        if not okWrite or not result then error("写入失败") end
        if not okClose or not closeErr then error("关闭目标文件失败") end
    end)
    if not writeOK then
        notice = "修改栏位失败：无法写入新文件；旧文件未变动：" .. tostring(writeErr)
        return false
    end
    local verifyOK, copiedData = pcall(function()
        local f = assert(io.open(dest, "rb"))
        local content = f:read("*a")
        f:close()
        return content
    end)
    if not verifyOK or copiedData ~= sourceData then
        notice = "新文件校验失败；旧文件仍在，请检查目标文件：" .. newname
        return false
    end
    refreshConfigList()
    notice = "已复制到栏位 " .. newSlot .. "（校验通过）。旧文件仍保留，请到文件夹手动删除原文件。"
    return true
end

-- 加载配置文件（保留装备、武器解锁、防具等级设置）
local function loadConfig()
    local file = io.open(CONFIG_FILE, "r")
    if file then
        local content = file:read("*a")
        file:close()
        local data = json_decode(content)
        if type(data) == "table" then
            keepEquipment = data.keepEquipment or false
            unlockWeaponBuildup = data.unlockWeaponBuildup or false
            armorBuildupMode = data.armorBuildupMode or 0
        end
    end
end

-- 保存配置文件
local function saveConfig()
    ensureFolderExists()
    local data = {
        keepEquipment = keepEquipment,
        unlockWeaponBuildup = unlockWeaponBuildup,
        armorBuildupMode = armorBuildupMode
    }
    json.dump_file(CONFIG_FILE, data)
end

-- 一键保存所有个人组合
local function exportAllSets()
    local manager = getEquipDataManager()
    if not manager then return end
    local mySetList = manager:get_field("_PlEquipMySetList")
    if not mySetList then return end

    local total = mySetList:call("get_Length")
    for slotIdx = 0, total - 1 do
        local fileName = tostring(slotIdx + 1) .. "_" .. getShortTimestamp()
        -- A second export in the same second must not overwrite existing files.
        local weaponType = nil
        local mySet = mySetList:call("Get", slotIdx)
        if mySet then
            local items = mySet:get_field("<InventoryDataList>k__BackingField")
            local weapon = items and items:call("Get", 0)
            if weapon then weaponType = getWeaponTypeFromIdVal(weapon:get_field("_IdVal")) end
        end
        if weaponType and weaponType ~= "Unknown" then
            local base = SAVE_FOLDER .. "/" .. weaponType .. "/"
            local serial = 0
            local candidate = fileName
            while serial < 100 do
                local present = exists(base .. candidate .. ".json")
                if present == nil then break end
                if not present then
                    saveSetToFile(slotIdx, candidate)
                    break
                end
                serial = serial + 1
                candidate = fileName .. "_" .. tostring(serial)
            end
        end
    end
    refreshConfigList()
end

-- 初始化
ensureFolderExists()
loadConfig()
readIndex()

-- Interface state is local to this script; drawing does not rescan game data.
local uiPage = 1
local loadoutSearch = ""
local loadoutFilter = 1
local advancedToolsEnabled = false

local function uiHeading(title, description)
    imgui.spacing()
    imgui.text_colored(title, 0xFFADD4B7)
    if description then imgui.text(description) end
    imgui.spacing()
end

local function drawInventoryPage()
    uiHeading("01  导出你的装备箱", "进入角色据点后导出；文件可直接拖入网页的“我的装备箱”。")
    if pendingInventoryAction then
        imgui.text_colored("正在等待游戏更新回调，请稍候…", 0xFFE1C88B)
    elseif imgui.button("导出完整装备箱（只读）", {280, 36}) then
        ELM_ExportInventorySnapshot()
    end
    if inventoryLastExport then
        local last = inventoryLastExport
        imgui.text_colored("最近一次导出已完成", 0xFF8FC7A6)
        imgui.text(string.format("武器 %d  /  防具 %d  /  护石 %d  /  其他 %d", last.weapons, last.armors, last.charms, last.other))
        imgui.text(string.format("珠子 %d 种  /  %d 颗  /  已使用组合 %d 套", last.decoKinds, last.decoCount, last.sets))
        imgui.text("文件：" .. last.path:match("([^/]+)$"))
    else
        imgui.text("本次脚本运行期间尚未导出库存。")
    end
    if imgui.tree_node_str_id("ELM_inventory_path", "导出文件放在哪里？") then
        imgui.text("MonsterHunterRise / reframework / data /")
        imgui.text("EquipmentLoadouts / Inventory / inventory_….json")
        imgui.tree_pop()
    end
    uiHeading("02  在网页中配装", "打开“我的装备箱” → 导入文件 → 使用这些装备配装。")
    imgui.text("网页只使用实际装备、实际炼化、护石和库存范围内的珠子。")
    uiHeading("03  把结果带回游戏", "将网页导出的 owned_….json 放入下方目录，再到“配装列表”刷新。")
    imgui.text("EquipmentLoadouts / OwnedPlans / 对应武器类型 /")
    if imgui.button("前往配装列表", {180, 30}) then uiPage = 2 end
    imgui.spacing()
    imgui.text_colored("已有模式：只更新组合引用，不创建、覆盖或销毁装备。", 0xFF8FC7A6)
    imgui.text("整理箱位或改变炼化、强化后，请重新导出库存。")
end

local function drawLoadoutPage()
    uiHeading("配装列表", "已有装备与普通方案分开标识；加载时按文件名前缀选择对应流程。")
    if imgui.button("刷新列表", {130, 28}) then refreshConfigList() end
    imgui.same_line()
    imgui.text("文件共 " .. #configList .. " 份")
    local changed
    changed, loadoutSearch = imgui.input_text("搜索武器或配装名", loadoutSearch)
    changed, loadoutFilter = imgui.combo("显示范围", loadoutFilter, {"全部方案", "仅已有装备方案", "仅普通方案"})
    local filtered = {}
    local query = loadoutSearch:lower()
    for _, entry in ipairs(configList) do
        local owned = basename(entry.relativePath):match("^owned_") ~= nil
        local text = (tostring(entry.weaponName or "") .. " " .. tostring(entry.displayName or "") .. " " .. tostring(slotFromPath(entry.relativePath) or "")):lower()
        if (loadoutFilter == 1 or (loadoutFilter == 2 and owned) or (loadoutFilter == 3 and not owned)) and (query == "" or text:find(query, 1, true)) then
            filtered[#filtered+1] = entry
        end
    end
    local configList = filtered
    local typeCounts = {}
    for _, entry in ipairs(configList) do
        local t = entry.weaponTypeChinese
        typeCounts[t] = (typeCounts[t] or 0) + 1
    end

    imgui.text("已保存配装: " .. #configList)
    if #configList == 0 then
        imgui.text("  暂无保存的配装")
    else
        -- 先按武器类型分组，再在每组内按栏位号从小到大排序。
        local grouped = {}
        local sortedTypes = {}
        for _, entry in ipairs(configList) do
            local weaponType = entry.weaponTypeChinese or "未知武器"
            if not grouped[weaponType] then
                grouped[weaponType] = {}
                table.insert(sortedTypes, weaponType)
            end
            table.insert(grouped[weaponType], entry)
        end
        table.sort(sortedTypes)
        for _, weaponType in ipairs(sortedTypes) do
            local entries = grouped[weaponType]
            table.sort(entries, function(a, b)
                local sa = slotFromPath(a.relativePath) or 225
                local sb = slotFromPath(b.relativePath) or 225
                if sa ~= sb then return sa < sb end
                return a.relativePath < b.relativePath
            end)
            -- 固定 ImGui ID：配装数量变化后仍保留展开状态。
            if imgui.tree_node_str_id("ELM_group_" .. weaponType, weaponType .. " (" .. #entries .. ")") then
                for _, entry in ipairs(entries) do
                        local slot = slotFromPath(entry.relativePath)
                        local displayText = (slot and ("[" .. slot .. "] ") or "[未指定栏位] ") .. entry.weaponName .. " · " .. entry.displayName
                        imgui.text(displayText)
                        local isOwned = basename(entry.relativePath):match("^owned_") ~= nil
                        imgui.text_colored(isOwned and "已有装备 · 仅绑定引用" or "普通方案 · 使用普通导入设置", isOwned and 0xFF8FC7A6 or 0xFFD6B77B)
                        if slot then
                            imgui.same_line()
                            if imgui.button("加载##" .. entry.relativePath) then
                                rowNotices[entry.relativePath] = nil
                                pendingImport = nil
                                requestImport(entry.relativePath)
                            end
                            imgui.same_line()
                            local key = entry.relativePath
                            if imgui.button("更换目标栏位##" .. key) then
                                editingPath = (editingPath == key) and nil or key
                                renameSlot[key] = tostring(slot)
                            end
                            if editingPath == key then
                                local current = renameSlot[key] or tostring(slot)
                                local changedInput, inputValue = imgui.input_text("目标栏位##" .. key, current)
                                if changedInput then renameSlot[key] = inputValue end
                                imgui.same_line()
                                if imgui.button("保存新栏位##" .. key) then
                                    pendingRename = nil
                                    notice = ""
                                    local copied = false
                                    local value = tonumber(renameSlot[key] or "")
                                    if not value or not tostring(renameSlot[key]):match("^%d+$") or value < 1 or value > 224 then
                                        notice = "请输入 1-224 的整数栏位"
                                    else
                                        copied = renameSlotFile(key, value, false)
                                    end
                                    if notice ~= "" then rowNotices[key] = notice; notice = "" end
                                    if copied then editingPath = nil end
                                end
                            end
                        else
                            imgui.text("文件名无有效栏位，不能导入")
                        end
                        -- 将导入确认、文件冲突和操作结果放在对应配装正下方。
                        local key = entry.relativePath
                        if pendingImport and pendingImport.path == key then
                            imgui.text("目标栏位 " .. pendingImport.slot .. " 已占用或状态不明，确认覆盖？")
                            if imgui.button("确认导入覆盖##" .. key) then
                                local p = pendingImport; pendingImport = nil
                                local loaded, state = loadSetFromFile(p.path)
                                if loaded then
                                    rowNotices[key] = state == "queued" and "已有装备引用正在等待校验" or "已加载至栏位 " .. p.slot
                                else
                                    rowNotices[key] = "加载失败，请检查文件及游戏状态"
                                end
                            end
                            imgui.same_line()
                            if imgui.button("取消导入##" .. key) then pendingImport = nil end
                        end
                        if pendingRename and pendingRename.path == key then
                            imgui.text("新栏位的同名文件已存在，已禁止覆盖：" .. basename(pendingRename.target))
                            if imgui.button("知道了##" .. key) then pendingRename = nil end
                        end
                        if rowNotices[key] and rowNotices[key] ~= "" then
                            imgui.text(rowNotices[key])
                        end
                end
                imgui.tree_pop()
            end
        end
    end
end

local function drawSavePage()
    uiHeading("导出游戏装备组合", "用于制作网页模板，或备份游戏里已经保存的组合。")
    if imgui.button("导出全部已保存组合", {220, 32}) then exportAllSets() end
    imgui.spacing()
    -- 保存单个配装的控制
    imgui.text("选择游戏装备组合（1-224）")
    local changed
    local displayIndex = saveSlotIndex + 1
    changed, displayIndex = imgui.slider_int("##saveslot", displayIndex, 1, 224)
    if changed then
        saveSlotIndex = displayIndex - 1
    end
    imgui.text("文件目标栏位（可留空，或输入如 35_模板）：")
		        imgui.same_line()
    imgui.text("（MonsterHunterRise/reframework/data/EquipmentLoadouts）")
    _, newConfigName = imgui.input_text("##newconfigname", newConfigName, 64)
    imgui.same_line()
    if imgui.button("导出这套游戏组合", {220, 32}) then
        local targetSlot, err = manualSlot(newConfigName, saveSlotIndex + 1)
        if not targetSlot then
            notice = err
        else
            local name = tostring(targetSlot) .. "_" .. getShortTimestamp()
            local manager = getEquipDataManager()
            local sets = manager and manager:get_field("_PlEquipMySetList")
            local set = sets and sets:call("Get", saveSlotIndex)
            local items = set and set:get_field("<InventoryDataList>k__BackingField")
            local weapon = items and items:call("Get", 0)
            local wt = weapon and getWeaponTypeFromIdVal(weapon:get_field("_IdVal"))
            if not wt or wt == "Unknown" then
                notice = "无法获取武器类型"
            else
                local path = SAVE_FOLDER .. "/" .. wt .. "/" .. name .. ".json"
                local present, errorText = exists(path)
                if present == nil then notice = errorText
                elseif present then pendingSave = {slot = saveSlotIndex, filename = name}
                elseif saveSetToFile(saveSlotIndex, name) then
                    refreshConfigList()
                    newConfigName = ""
                    notice = "保存成功"
                end
            end
        end
    end
    if pendingSave then
        imgui.text("同名文件已存在，覆盖本地文件？ " .. pendingSave.filename)
        if imgui.button("确认覆盖文件##save") then
            local p = pendingSave; pendingSave = nil
            if saveSetToFile(p.slot, p.filename, true) then
                refreshConfigList(); notice = "已覆盖文件"; newConfigName = ""
            end
        end
        imgui.same_line()
        if imgui.button("取消##save") then pendingSave = nil end
    end

end

local function drawSettingsPage()
    uiHeading("普通导入设置", "以下设置仅作用于普通 JSON；owned_ 已有装备方案始终保持装备原状态。")
    imgui.text_colored("普通导入可能创建或覆盖装备，请先备份存档。", 0xFFE1C88B)
    local changed

    -- 保留装备选项
    changed, keepEquipment = imgui.checkbox("保留普通方案原装备", keepEquipment)
    if changed then saveConfig() end

    -- 武器炼化解锁选项
    changed, unlockWeaponBuildup = imgui.checkbox("普通导入时解锁武器词条", unlockWeaponBuildup)
    if changed then saveConfig() end

    -- 防具强化等级选项
    imgui.text("防具强化等级:")
    imgui.same_line()
    local lv1 = (armorBuildupMode == 1)
    local lvMax = (armorBuildupMode == 2)
    local changedA1, newA1 = imgui.checkbox("1级", lv1)
    if changedA1 then
        if newA1 then armorBuildupMode = 1 else armorBuildupMode = 0 end
        saveConfig()
    end
    imgui.same_line()
    local changedA2, newA2 = imgui.checkbox("满级", lvMax)
    if changedA2 then
        if newA2 then armorBuildupMode = 2 else armorBuildupMode = 0 end
        saveConfig()
    end


    if imgui.tree_node_str_id("ELM_advanced_tools", "进阶工具（会修改存档）") then
        imgui.text_colored("这些操作会直接修改装备或物品，不是已有装备配装所需步骤。", 0xFFE1A18B)
        local changed
        changed, advancedToolsEnabled = imgui.checkbox("我已了解这些操作会修改存档", advancedToolsEnabled)
        imgui.begin_disabled(not advancedToolsEnabled)
    if imgui.button("全猎虫") and advancedToolsEnabled then
        obtainAllInsects()
    end
    imgui.same_line()
    if imgui.button("全花链") and advancedToolsEnabled then
        obtainAllCorals()
    end
    imgui.same_line()
    if imgui.button("全装饰品+10") and advancedToolsEnabled then
        addAllDecorationsPlus10()
    end
    imgui.same_line()
    imgui.text("（启用全装饰品+10后，需要重进存档才能使用珠子，否则会崩溃游戏）")

    -- 当前武器炼化词条解锁按钮
    if imgui.button("解锁当前武器炼化词条") and advancedToolsEnabled then
        unlockMessage = ""
        local smithyGui = sdk.get_managed_singleton("snow.gui.fsm.smithy.GuiSmithyFsmManager")
        if not smithyGui then
            unlockMessage = "无法获取铁匠铺管理器"
        else
            local selected = smithyGui:call("get_CustomBuildupInventoryData")
            if not selected then
                unlockMessage = "未选中任何装备或未处于强化界面"
            else
                local idType = selected:get_field("_IdType")
                if idType ~= 1 then
                    unlockMessage = "请选择武器"
                else
                    selected:set_field("_CustomEnable", true)
                    local success, err = pcall(function()
                        for _, id in ipairs(PRESET_BUILDUP_IDS) do
                            selected:call("openCustombuildup", id)
                        end
                    end)
                    if success then
                        unlockMessage = "已解锁当前武器的炼化词条"
                    else
                        unlockMessage = "解锁失败：" .. tostring(err)
                    end
                end
            end
        end
    end

    if unlockMessage ~= "" then
        imgui.text(unlockMessage)
    end

        imgui.end_disabled()
        imgui.tree_pop()
    end
    imgui.spacing()
    imgui.text("未引用装备清理位于“清理未引用”页；建议非必要不使用此功能。")
end

local function drawCleanupPage()
    uiHeading("清理未引用装备", "固定排除当前穿戴、所有游戏组合引用；仅处理武器、防具、护石。")
    imgui.text_colored("危险功能：建议非必要不使用此功能。", 0xFFE1A18B)
    imgui.text("固定保护：黑带、黑带S、公会十字、传承太刀及升级型、祝福羽饰、家传／老练／新手护石。")
    imgui.text_colored("删除不能在此处撤销；请预先备份完整存档，操作期间留在据点。", 0xFFE1A18B)
    local busy = pendingInventoryAction ~= nil
    imgui.begin_disabled(busy)
    local changed, value = imgui.combo("批量范围", cleanup.level, CLEANUP_LEVELS)
    if changed then cleanup.level = value;cleanup.scan = nil;cleanup.selected = {};cleanup.confirming = false end
    if imgui.button("扫描 / 刷新未引用装备", {240, 32}) and not busy then ELM_ScanUnusedEquipment(cleanup.level) end
    imgui.end_disabled()
    if cleanup.progress ~= "" then imgui.text_colored(cleanup.progress, 0xFFADD4B7) end
    local scan = cleanup.scan
    if not scan then imgui.text("选择范围后扫描；更改范围需要重新扫描。") return end
    imgui.text("目录：reframework/data/EquipmentLoadouts/Cleanup/")
    if not scan.ready then
        imgui.text_colored("删除不可用：" .. tostring(scan.error), 0xFFE1A18B)
        imgui.text("扫描报告：" .. (scan.path and scan.path:match("([^/]+)$") or "尚未保存"))
        return
    end
    if imgui.tree_node_str_id("ELM_cleanup_excluded", "查看固定保护与排除统计") then
        local reasons = {};for reason in pairs(scan.excluded) do reasons[#reasons+1] = reason end;table.sort(reasons)
        for _, reason in ipairs(reasons) do imgui.text(reason .. "：" .. scan.excluded[reason] .. " 件") end
        imgui.tree_pop()
    end
    if imgui.tree_node_str_id("ELM_cleanup_current", "查看检测到的当前穿戴（无需另行确认）") then
        for _, context in ipairs(scan.diagnostics.currentEquipment or {}) do
            imgui.text(context.path)
            for _, key in ipairs(context.indices) do
                local entry = scan.entries[key]
                imgui.text("箱位 " .. (entry.index+1) .. " · " .. cleanupItemName(entry.item))
            end
        end
        imgui.tree_pop()
    end
    imgui.begin_disabled(busy)
    changed, cleanup.filter = imgui.combo("候选类别", cleanup.filter, {"全部", "武器", "防具", "护石"})
    if changed then cleanup.page = 0;cleanup.confirming = false end
    changed, cleanup.search = imgui.input_text("搜索名称或箱位", cleanup.search)
    if changed then cleanup.page = 0;cleanup.confirming = false end
    local filtered = cleanupFilteredCandidates(cleanup.filter, cleanup.search)
    if imgui.small_button("全选当前筛选（含所有页）##cleanup") and not busy then ELM_SelectUnusedEquipment(cleanup.filter, cleanup.search) end
    imgui.same_line()
    if imgui.small_button("取消全部选择##cleanup") and not busy then cleanup.selected = {};cleanup.confirming = false end
    local pages = math.max(1, math.ceil(#filtered/25))
    cleanup.page = math.max(0, math.min(cleanup.page, pages-1))
    for i = cleanup.page*25+1, math.min(#filtered, (cleanup.page+1)*25) do
        local entry = filtered[i]
        local tags = (entry.item.IsLock and " · 已锁定" or "") .. (next(cleanupJewels(entry.item)) and " · 有镶珠" or "")
        changed, value = imgui.checkbox("箱位 " .. (entry.index+1) .. " · " .. entry.name .. tags .. "##ELM_cleanup_" .. entry.index, cleanup.selected[entry.index] == true)
        if changed and not busy then cleanup.selected[entry.index] = value or nil;cleanup.confirming = false end
    end
    if cleanup.page > 0 and imgui.small_button("上一页##cleanup") then cleanup.page = cleanup.page-1 end
    imgui.same_line();imgui.text((cleanup.page+1) .. " / " .. pages)
    if cleanup.page+1 < pages then imgui.same_line();if imgui.small_button("下一页##cleanup") then cleanup.page = cleanup.page+1 end end
    imgui.end_disabled()
    local selected, locked, jeweled = {}, 0, 0
    local types = {[1]=0,[2]=0,[3]=0}
    for _, entry in ipairs(scan.candidates) do
        if cleanup.selected[entry.index] then
            selected[#selected+1] = entry.ref;types[entry.item.IdType] = types[entry.item.IdType]+1
            if entry.item.IsLock then locked=locked+1 end
            if next(cleanupJewels(entry.item)) then jeweled=jeweled+1 end
        end
    end
    imgui.text(string.format("候选 %d 件 / 当前筛选 %d 件 / 已选 %d 件", #scan.candidates, #filtered, #selected))
    imgui.begin_disabled(busy or #selected == 0)
    if not cleanup.confirming then
        if imgui.button("删除已选装备…", {240, 34}) and not busy and #selected > 0 then cleanup.confirming = true end
    else
        imgui.text_colored(string.format("本次删除 %d 件：武器 %d / 防具 %d / 护石 %d", #selected, types[1], types[2], types[3]), 0xFFE1A18B)
        imgui.text(string.format("其中锁定 %d 件，镶珠 %d 件；范围：%s", locked, jeweled, CLEANUP_LEVELS[scan.level]))
        imgui.text_colored("建议非必要不使用此功能。确认即执行游戏出售接口。", 0xFFE1A18B)
        imgui.text("请确保已备份完整存档，删除数量和范围无误。")
        if jeweled > 0 then imgui.text_colored("镶珠由游戏接口处理，脚本不会手动返还珠子；扩大范围首次请单件核对。", 0xFFE1A18B) end
        if imgui.button("确认删除 " .. #selected .. " 件##cleanup_confirm", {240, 34}) and not busy then
            if ELM_DeleteUnusedEquipment(selected, true) then cleanup.confirming = false end
        end
        imgui.same_line();if imgui.button("取消##cleanup_confirm") then cleanup.confirming = false end
    end
    imgui.end_disabled()
    imgui.text("只需上述一次确认；自动备份与逐件实时复核保留，异常时停止后续项。")
end

re.on_draw_ui(function()
    if not imgui.tree_node_str_id("ELM_root", "配装管理器 · 曙光工房 0.5.0") then return end
    imgui.text_colored("SUNBREAK FORGE  /  Equipment Loadouts", 0xFFADD4B7)
    imgui.text("基于原版 Ver1.9 · 库存导出与已有装备引用扩展")
    imgui.spacing()
    local pages = {"库存与网页", "配装列表", "保存组合", "设置与工具", "清理未引用"}
    for i, name in ipairs(pages) do
        if i > 1 then imgui.same_line() end
        if imgui.button((uiPage == i and "[ " .. name .. " ]" or name) .. "##ELM_page_" .. i) then uiPage = i end
    end
    imgui.spacing()
    if notice ~= "" then
        imgui.text_colored("操作状态", 0xFFE1C88B)
        imgui.text(notice)
        if imgui.small_button("清除状态##ELM_notice") then notice = "" end
    end
    if uiPage == 1 then drawInventoryPage()
    elseif uiPage == 2 then drawLoadoutPage()
    elseif uiPage == 3 then drawSavePage()
    elseif uiPage == 4 then drawSettingsPage()
    else drawCleanupPage() end
    imgui.tree_pop()
end)

-- 公开API
function ELM_LoadSetFromFile(relativePath) requestImport(relativePath); return false end
function ELM_SaveSetToFile(slotIndex, filename) return saveSetToFile(slotIndex, filename) end
function ELM_ExportAllSets() exportAllSets() end
function ELM_ObtainAllInsects() obtainAllInsects() end
function ELM_ObtainAllCorals() obtainAllCorals() end
function ELM_AddAllDecorationsPlus10() addAllDecorationsPlus10() end