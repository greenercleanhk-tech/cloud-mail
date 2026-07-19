/**
 * SQLite/D1 批量插入工具
 * D1 有嚴格 SQL 變量上限，標準 batch 也會爆
 * 改用逐條插入，犧牲速度換取穩定性
 */
export const BATCH_SIZE = 1;

/**
 * 將大數組逐條插入（SQLite/D1 兼容）
 * @param {Function} ormFn - 單行插入函數，簽名：values => orm(c).insert(tbl).values(values).run()
 * @param {Array} values - 要插入的數組
 */
export async function batchInsert(ormFn, values) {
	if (!values || values.length === 0) return;
	for (let i = 0; i < values.length; i++) {
		await ormFn(values[i]);
		if ((i + 1) % 100 === 0) {
			console.log(`[batchInsert] 已插入 ${i + 1}/${values.length}`);
		}
	}
}
