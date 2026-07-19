/**
 * schedule_task entity - 排程子任務（每個帳號的發送任務）
 * 一個 job 會拆成多個 task（每個帳號一個）
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const scheduleTask = sqliteTable('schedule_task', {
    taskId: integer('task_id').primaryKey({ autoIncrement: true }),
    jobId: integer('job_id').notNull(),            // 所屬 job
    accountId: integer('account_id').notNull(),     // 負責的帳號
    recipientStart: integer('recipient_start').notNull(), // 收件人起始索引
    recipientEnd: integer('recipient_end').notNull(),     // 收件人結束索引
    sentCount: integer('sent_count').default(0).notNull(),  // 已發（累計）
    failedCount: integer('failed_count').default(0).notNull(), // 失敗
    status: text('status').default('pending').notNull(), // pending / running / completed / cancelled / waiting_limit
    scheduledAt: text('scheduled_at').notNull(),    // 計劃時間
    finishedAt: text('finished_at'),               // 完成時間
    lastContactId: integer('last_contact_id').default(0).notNull(),  // cursor：上次發到哪個聯絡人
    sentToday: integer('sent_today').default(0).notNull(),           // 這個帳號今日已發
    lastSentDate: text('last_sent_date').default(''),               // 這個帳號上次發送日期
    createTime: text('create_time').default(sql`datetime('now', 'localtime')`).notNull()
});

export default scheduleTask;
