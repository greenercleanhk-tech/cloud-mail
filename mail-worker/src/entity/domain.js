/**
 * domain entity - 域名實體
 * 用於支持多域名管理
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const domain = sqliteTable('domain', {
    domainId: integer('domain_id').primaryKey({ autoIncrement: true }),
    domain: text('domain').notNull().unique(),           // 如 greenercleanhk.com
    displayName: text('display_name').default(''),        // 如 綠適居
    isActive: integer('is_active').default(1).notNull(), // 1=啟用 0=停用
    resendApiKey: text('resend_api_key').default(''),    // 該域名專用 Resend API Key
    customDomain: text('custom_domain').default(''),     // 自訂網域 URL，如 mail.parkin.hk
    mxStatus: text('mx_status').default('pending'),       // pending/ok/failed
    spfStatus: text('spf_status').default('pending'),    // pending/ok/failed
    dkimStatus: text('dkim_status').default('pending'),  // pending/ok/failed
    dailyLimit: integer('daily_limit').default(500).notNull(),  // 每日發件上限
    sentToday: integer('sent_today').default(0).notNull(),     // 今日已發（跨帳號共享）
    lastSentDate: text('last_sent_date').default(''),         // 上次發送日期（YYYY-MM-DD）
    createTime: text('create_time').default(sql`datetime('now', 'localtime')`).notNull(),
    isDel: integer('is_del').default(0).notNull()        // 軟刪除
});

export default domain;
