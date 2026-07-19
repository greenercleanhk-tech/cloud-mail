/**
 * SQLite/D1 批量插入工具
 * D1 bytecode 限制：每批次需足夠小以避免超限，同時又需足夠大以在 30 秒 CPU 內完成
 * 869 條紀錄，目標 ≤ 30 秒 CPU 時間
 * 2026-07-19：降為 BATCH_SIZE=10，更保守，避免 D1 bytecode 超限
 */
export const BATCH_SIZE = 10;

/**
 * 將大數組分批插入
 * @param {Function} ormFn - 調用 orm(c).insert(tbl).values(batch).run() 的函數
 * @param {Array} values - 要插入的數組
 */
export async function batchInsert(ormFn, values) {
	if (!values || values.length === 0) return;
	let lastError = null;
	for (let i = 0; i < values.length; i += BATCH_SIZE) {
		const batch = values.slice(i, i + BATCH_SIZE);
		try {
			const result = await ormFn(batch);
			// Drizzle .run() 返回 D1Result，result.ok === false 表示 D1 層面失敗
			if (result && result.ok === false) {
				throw new Error(`D1 batch failed: ${result.error?.message || JSON.stringify(result.error)}`);
			}
			const done = Math.min(i + BATCH_SIZE, values.length);
			console.log(`[batchInsert] 已插入 ${done}/${values.length}`);
		} catch (e) {
			// 記錄已成功插入的數量，併發給上層
			const inserted = Math.min(i, values.length);
			lastError = e;
			console.error(`[batchInsert] 第 ${i + 1} 批次失敗（已插入 ${inserted}/${values.length}）: ${e.message}`);
			break;
		}
	}
	if (lastError) throw lastError;
}
