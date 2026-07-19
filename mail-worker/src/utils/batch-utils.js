/**
 * SQLite/D1 批量插入工具（全部使用原生 D1 API，繞過 Drizzle ORM）
 *
 * 2026-07-19：Drizzle-orm/d1 的 .run() 返回值不稳定（result.ok 在某些版本可能是 method 而非 property）
 * 全面改用原生 D1 API：c.env.db.prepare(sql).bind(...).run()
 *
 * D1 變量上限 999（SQLite 限制）
 * BATCH_SIZE = 10 → 每批 10×N 變量，869 條需 87 批次，CPU 時間安全
 */
export const BATCH_SIZE = 10;

/**
 * 原生 D1 分批插入
 * @param {Fetcher} c - Cloudflare Workers context
 * @param {string} tableName - 表名（DB 列名，snake_case）
 * @param {string[]} columns - DB 列名數組
 * @param {Object[]} values - 記錄數組（支援 camelCase 和 snake_case 兩種 key）
 * @param {Object} [extra] - 可選：固定覆蓋某些列的值（如 { domain_id, user_id }）
 */
export async function batchInsertNative(c, tableName, columns, values, extra = {}) {
	if (!values || values.length === 0) return;

	const colNames = columns.join(', ');
	const placeholders = columns.map(() => '?').join(', ');
	const sql = `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`;

	let inserted = 0;
	for (let i = 0; i < values.length; i += BATCH_SIZE) {
		const batch = values.slice(i, i + BATCH_SIZE);
		for (const row of batch) {
			const params = columns.map(col => {
				// 優先用 extra（固定值），再用 row（row 先試 camelCase 再試 snake_case）
				if (col in extra) return extra[col];
				const camelKey = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
				return row[camelKey] ?? row[col] ?? null;
			});
			const result = await c.env.db.prepare(sql).bind(...params).run();
			if (!result.success) {
				throw new Error(`D1 insert failed: ${result.error} | row: ${JSON.stringify(row)}`);
			}
			inserted++;
		}
		console.log(`[batchInsertNative] 已插入 ${inserted}/${values.length} 條`);
	}
}

/**
 * 簡化封裝：contacts 表（固定 domainId/userId）
 */
export async function batchInsertContacts(c, contacts, domainId, userId) {
	await batchInsertNative(c, 'contacts', [
		'name', 'email', 'group_id', 'domain_id', 'user_id',
		'remark', 'is_unsubscribed', 'create_time', 'is_del'
	], contacts, { domain_id: domainId, user_id: userId, is_del: 0, is_unsubscribed: 0 });
}
