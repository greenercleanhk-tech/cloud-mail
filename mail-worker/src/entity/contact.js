/**
 * contact entity - 通訊錄實體
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const contact = sqliteTable('contacts', {
    contactId: integer('contact_id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().default(''),      // 聯絡人姓名
    email: text('email').notNull(),                // 郵箱地址
    groupId: integer('group_id').default(0),       // 所屬群組，0=無群組
    domainId: integer('domain_id').notNull(),     // 所屬域名
    userId: integer('user_id').notNull(),         // 所屬用戶
    remark: text('remark').default(''),            // 備註
    createTime: text('create_time').default(sql`datetime('now', 'localtime')`).notNull(),
    isDel: integer('is_del').default(0).notNull()  // 軟刪除
});

export const contactGroup = sqliteTable('contact_groups', {
    groupId: integer('group_id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),                  // 群組名稱
    domainId: integer('domain_id').notNull(),      // 所屬域名
    userId: integer('user_id').notNull(),          // 所屬用戶
    sort: integer('sort').default(0),               // 排序
    createTime: text('create_time').default(sql`datetime('now', 'localtime')`).notNull(),
    isDel: integer('is_del').default(0).notNull()   // 軟刪除
});

export default contact;
