/**
 * schedule_job entity - 排程任務（一個新建的排程算一個 job）
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const scheduleJob = sqliteTable('schedule_job', {
    jobId: integer('job_id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),                  // 任務名稱，如「夏季優惠」
    domainId: integer('domain_id').notNull(),       // 所屬域名
    templateId: integer('template_id').notNull(),   // 所屬模板
    contactGroupId: text('contact_group_id').notNull(), // 通訊組 ID（JSON 數組，如 "[1,2,3]"）
    totalRecipients: integer('total_recipients').notNull(), // 總收件人數
    sentCount: integer('sent_count').default(0).notNull(), // 已發數
    failedCount: integer('failed_count').default(0).notNull(), // 失敗數
    status: text('status').default('pending').notNull(), // pending / running / completed / cancelled
    scheduledAt: text('scheduled_at').notNull(),   // 計劃開始時間（ISO 8601）
    finishedAt: text('finished_at'),               // 完成時間
    userId: integer('user_id').notNull(),          // 建立者
    createTime: text('create_time').default(sql`datetime('now', 'localtime')`).notNull(),
    isDel: integer('is_del').default(0).notNull()
});

export default scheduleJob;
