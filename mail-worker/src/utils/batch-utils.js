/**
 * SQLite/D1 批量插入工具
 * D1 bytecode 限制：每批次需足夠小以避免超限，同時又需足夠大以在 30 秒 CPU 內完成
 * 869 條紀錄，目標 ≤ 30 秒 CPU 時間
 * 測試下來：BATCH_SIZE=30 兼顧速度與穩定性
 */
export const BATCH_SIZE = 30;

/**
 * 將大數組分批插入
 * @param {Function} ormFn - 調用 orm(c).insert(tbl).values(batch).run() 的函數
 * @param {Array} values - 要插入的數組
 */
export async function batchInsert(ormFn, values) {
	if (!values || values.length === 0) return;
	for (let i = 0; i < values.length; i += BATCH_SIZE) {
		const batch = values.slice(i, i + BATCH_SIZE);
		await ormFn(batch);
		const done = Math.min(i + BATCH_SIZE, values.length);
		console.log(`[batchInsert] 已插入 ${done}/${values.length}`);
	}
}
