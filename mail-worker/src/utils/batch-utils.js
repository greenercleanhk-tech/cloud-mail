/**
 * SQLite/D1 批量插入工具
 * SQLite 變量上限 999，計算公式：limit = floor(999 / columnCount)
 * 7列 → 142，6列 → 166，5列 → 199，4列 → 249，3列 → 333
 * 統一用 100 條/批，安全且兼顧效率
 */
export const BATCH_SIZE = 100;

/**
 * 將大數組分批插入
 * @param {Function} ormFn - 調用 orm(c).insert(...).values(...).run() 的函數
 * @param {Array} values - 要插入的數組
 */
export async function batchInsert(ormFn, values) {
	if (!values || values.length === 0) return;
	for (let i = 0; i < values.length; i += BATCH_SIZE) {
		const batch = values.slice(i, i + BATCH_SIZE);
		console.log(`[batchInsert] 第${Math.floor(i/BATCH_SIZE)+1}批，數量=${batch.length}，變量數=${batch.length * 7}`);
		await ormFn(batch);
	}
}
