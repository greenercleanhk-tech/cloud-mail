/**
 * schedule_task entity - 排程子任務（一個域名一個 task，郵箱輪流）
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const scheduleTask = sqliteTable('schedule_task', {
    taskId: integer('task_id').primaryKey({ autoIncrement: true }),
    jobId: integer('job_id').notNull(),
    // 郵箱輪流池（JSON 數組，創建時亂序，之後按順序輪流）
    accountPool: text('account_pool').default('[]').notNull(),
    // accountPool 中的當前位置
    accountPoolIndex: integer('account_pool_index').default(0).notNull(),
    // 當前使用的帳號（來自 accountPool[accountPoolIndex]）
    accountId: integer('account_id').notNull(),
    cursor: integer('cursor').default(0).notNull(),              // 在 shuffledContactIds 中的位置
    sentToday: integer('sent_today').default(0).notNull(),       // 今日已發（域名級）
    lastSentDate: text('last_sent_date').default(''),             // 上次發送日期
    sentCount: integer('sent_count').default(0).notNull(),         // 累計已發
    failedCount: integer('failed_count').default(0).notNull(),     // 累計失敗
    status: text('status').default('pending').notNull(),           // pending/running/completed/cancelled/waiting_limit
    scheduledAt: text('scheduled_at').notNull(),
    finishedAt: text('finished_at'),
    createTime: text('create_time').default(sql`datetime('now', 'localtime')`).notNull()
});

export default scheduleTask;
