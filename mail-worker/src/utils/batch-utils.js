/**
 * SQLite/D1 批量插入工具（全部使用原生 D1 API，繞過 Drizzle ORM）
 *
 * 2026-07-19：Drizzle-orm/d1 的 .run() 返回值不稳定（result.ok 在某些版本可能是 method 而非 property）
 * 全面改用原生 D1 API：c.env.db.prepare(sql).bind(...).run()
 *
 * D1 限制：
 * - 每請求最多 1000 條語句 → 用 db.batch() 合併，每批次多條 INSERT
 * - 每語句最多 999 個 ? 佔位符 → contacts 表每行 9 個欄位，每批次最多 111 行
 *   (111 × 9 = 999)
 */
export const BATCH_SIZE = 111; // 9 欄位 × 111 行 = 999 個 ?，觸及 SQLite 上限

/**
 * 原生 D1 分批插入（使用 db.batch 合併多條 INSERT 為一次請求）
 * @param {Fetcher} c - Cloudflare Workers context
 * @param {string} tableName - 表名（DB 列名，snake_case）
 * @param {string[]} columns - DB 列名數組（與 VALUES 順序對應）
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

		// 將整批 INSERT 合併為一個 db.batch() 呼叫（只算 1 條語句）
		const stmts = batch.map(row => {
			const params = columns.map(col => {
				if (col in extra) return extra[col];
				const camelKey = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
				return row[camelKey] ?? row[col] ?? null;
			});
			return c.env.db.prepare(sql).bind(...params);
		});

		const results = await c.env.db.batch(stmts);
		for (let j = 0; j < results.length; j++) {
			if (!results[j].success) {
				throw new Error(`D1 insert failed at row ${i + j}: ${results[j].error}`);
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
	const now = new Date().toISOString();
	await batchInsertNative(c, 'contacts', [
		'name', 'email', 'group_id', 'domain_id', 'user_id',
		'remark', 'is_unsubscribed', 'create_time', 'is_del'
	], contacts, {
		domain_id: domainId || 1,
		user_id: userId || 1,
		is_del: 0,
		is_unsubscribed: 0,
		create_time: now
	});
	console.log(`[batchInsertContacts] extra create_time=${now}`);
}
