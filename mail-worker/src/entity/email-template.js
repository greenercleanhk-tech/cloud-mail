/**
 * email_template entity - 郵件模板實體
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const emailTemplate = sqliteTable('email_template', {
    templateId: integer('template_id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),              // 模板名稱
    subject: text('subject').notNull(),       // 郵件標題
    content: text('content').notNull(),        // 郵件內容（HTML）
    domainId: integer('domain_id').notNull(), // 所屬域名（每個域名只能用自己的模板）
    userId: integer('user_id').notNull(),     // 建立者
    createTime: text('create_time').default(sql`datetime('now', 'localtime')`).notNull(),
    isDel: integer('is_del').default(0).notNull() // 軟刪除
});

export default emailTemplate;
