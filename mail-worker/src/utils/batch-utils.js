/**
 * SQLite/D1 批量插入工具
 *
 * 兩種使用模式：
 * 1. batchInsert(ormFn, values, ctx) - att-service 用（Drizzle ORM）
 *    ormFn(batch) 會被每批執行（舊版忽略了 ormFn，現已修復）
 * 2. batchInsertNative(c, tableName, columns, values, domainId, userId) - contact-service 用（原生 D1）
 *
 * D1 變量上限 999（SQLite 限制），BATCH_SIZE=10 → 10×9=90 變量，869 條需 87 批次
 */
export const BATCH_SIZE = 10;

// ==================== 原生 D1 API（contact-service 用） ====================

/**
 * 使用原生 D1 API 分批插入（繞過 Drizzle ORM bytecode 限制）
 * @param {Fetcher} c - Cloudflare Workers context
 * @param {string} tableName - 表名
 * @param {string[]} columns - DB 列名數組（snake_case）
 * @param {Object[]} values - 記錄數組（對象屬性需與 columns 對應，或帶 domain_id/user_id/is_del 等固定欄位）
 * @param {number} domainId
 * @param {number} userId
 */
export async function batchInsertNative(c, tableName, columns, values, domainId, userId) {
	if (!values || values.length === 0) return;

	const colNames = columns.join(', ');
	const placeholders = columns.map(() => '?').join(', ');
	const sql = `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`;

	let inserted = 0;
	for (let i = 0; i < values.length; i += BATCH_SIZE) {
		const batch = values.slice(i, i + BATCH_SIZE);

		for (const row of batch) {
			const params = columns.map(col => {
				if (col === 'domain_id') return domainId;
				if (col === 'user_id') return userId;
				if (col === 'is_del') return 0;
				if (col === 'is_unsubscribed') return 0;
				if (col === 'create_time') return new Date().toISOString();
				// 支援 camelCase（JS 慣例）和 snake_case（DB 慣例）兩種 key
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

// ==================== Drizzle ORM 介面（att-service 用） ====================

/**
 * Drizzle ORM 分批插入（舊版 ormFn 被忽略，現已修復）
 * @param {Function} ormFn - 調用 `orm(c).insert(tbl).values(batch).run()` 的函數
 * @param {Object[]} values - 要插入的數組
 * @param {Object} [ctx] - 忽略（保留相容性）
 */
export async function batchInsert(ormFn, values, ctx) {
	if (!values || values.length === 0) return;

	for (let i = 0; i < values.length; i += BATCH_SIZE) {
		const batch = values.slice(i, i + BATCH_SIZE);
		await ormFn(batch);  // 確保每批真正執行（舊版 this line 被忽略！）
		const done = Math.min(i + BATCH_SIZE, values.length);
		console.log(`[batchInsert] 已插入 ${done}/${values.length}`);
	}
}
