-- 退訂功能：contacts 表新增 is_unsubscribed 欄位
ALTER TABLE contacts ADD COLUMN is_unsubscribed INTEGER NOT NULL DEFAULT 0;
