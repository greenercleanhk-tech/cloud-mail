-- Migration: 20260718_multi_contact_group
-- 支持排程選擇多個通訊組
-- contactGroupId 從 INTEGER 改為 TEXT（存 JSON 數組）

-- 1. 將現有的 contact_group_id 列改為 TEXT 類型
ALTER TABLE schedule_job RENAME COLUMN contact_group_id TO contact_group_id_old;

-- 2. 建立新的 TEXT 類型列
ALTER TABLE schedule_job ADD COLUMN contact_group_id TEXT NOT NULL DEFAULT '[]';

-- 3. 把舊數據轉換為 JSON 數組格式（單值 → [單值]）
UPDATE schedule_job SET contact_group_id = '[' || contact_group_id_old || ']'
  WHERE contact_group_id_old IS NOT NULL AND contact_group_id_old != 0;

-- 4. 清理舊列
ALTER TABLE schedule_job DROP COLUMN contact_group_id_old;
