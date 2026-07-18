import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const account = sqliteTable('account', {
	accountId: integer('account_id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	name: text('name').default('').notNull(),
	status: text('status').default('active').notNull(),
	latestEmailTime: text('latest_email_time'),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	userId: integer('user_id').notNull(),
	allReceive: integer('all_receive').default(1).notNull(),
	sort: integer('sort').default(0).notNull(),
	isDel: integer('is_del').default(0).notNull(),
	domainId: integer('domain_id').notNull(),
});

export default account
