import { emailConst } from '../const/entity-const';
import { eq, inArray } from 'drizzle-orm';
import { account } from '../entity/account';

const analysisDao = {
	/**
	 * 獲取域名下所有帳號 ID，若 domainId 為 null 則返回空陣列（Global 模式不走這裡）
	 */
	async getDomainAccountIds(c, domainId) {
		if (!domainId) return null; // null = 全域
		const rows = await c.env.DB.prepare(
			'SELECT account_id FROM account WHERE domain_id = ? AND is_del = 0'
		).bind(domainId).all();
		return rows.results.map(r => r.account_id);
	},

	async numberCount(c, domainId) {
		const bindValues = domainId ? [domainId, domainId, domainId] : [];

		const emailFilter = domainId
			? 'AND email.account_id IN (SELECT account_id FROM account WHERE domain_id = ? AND is_del = 0)'
			: '';
		const accountFilter = domainId ? 'WHERE domain_id = ? AND is_del = 0' : 'WHERE is_del = 0';
		const userFilter = domainId
			? 'WHERE user_id IN (SELECT user_id FROM account WHERE domain_id = ? AND is_del = 0)'
			: '';

		const sql = `
			SELECT
				COALESCE(e.receiveTotal, 0) AS receiveTotal,
				COALESCE(e.sendTotal, 0) AS sendTotal,
				COALESCE(e.delReceiveTotal, 0) AS delReceiveTotal,
				COALESCE(e.delSendTotal, 0) AS delSendTotal,
				COALESCE(e.normalReceiveTotal, 0) AS normalReceiveTotal,
				COALESCE(e.normalSendTotal, 0) AS normalSendTotal,
				COALESCE(u.userTotal, 0) AS userTotal,
				COALESCE(u.normalUserTotal, 0) AS normalUserTotal,
				COALESCE(u.delUserTotal, 0) AS delUserTotal,
				COALESCE(a.accountTotal, 0) AS accountTotal,
				COALESCE(a.normalAccountTotal, 0) AS normalAccountTotal,
				COALESCE(a.delAccountTotal, 0) AS delAccountTotal
			FROM
				(
					SELECT
						SUM(CASE WHEN type = 0 THEN 1 ELSE 0 END) AS receiveTotal,
						SUM(CASE WHEN type = 1 THEN 1 ELSE 0 END) AS sendTotal,
						SUM(CASE WHEN type = 0 AND is_del = 1 THEN 1 ELSE 0 END) AS delReceiveTotal,
						SUM(CASE WHEN type = 1 AND is_del = 1 THEN 1 ELSE 0 END) AS delSendTotal,
						SUM(CASE WHEN type = 0 AND is_del = 0 THEN 1 ELSE 0 END) AS normalReceiveTotal,
						SUM(CASE WHEN type = 1 AND is_del = 0 THEN 1 ELSE 0 END) AS normalSendTotal
					FROM
						email
					WHERE
						status != ${emailConst.status.SAVING}
						${emailFilter}
				) e
			CROSS JOIN (
				SELECT
					COUNT(*) AS userTotal,
					SUM(CASE WHEN is_del = 1 THEN 1 ELSE 0 END) AS delUserTotal,
					SUM(CASE WHEN is_del = 0 THEN 1 ELSE 0 END) AS normalUserTotal
				FROM
					user
				${userFilter}
			) u
			CROSS JOIN (
				SELECT
					COUNT(*) AS accountTotal,
					SUM(CASE WHEN is_del = 1 THEN 1 ELSE 0 END) AS delAccountTotal,
					SUM(CASE WHEN is_del = 0 THEN 1 ELSE 0 END) AS normalAccountTotal
				FROM
					account
				${accountFilter}
			) a
		`;

		const { results } = await c.env.DB.prepare(sql).bind(...bindValues).all();
		return results[0];
	},

	async userDayCount(c, diffHours, domainId) {
		const { results } = await c.env.DB.prepare(`
			SELECT
				DATE(user.create_time, '+' || ? || ' hours') AS date,
				COUNT(DISTINCT user.user_id) AS total
			FROM
				user
			WHERE
				DATE(user.create_time, '+' || ? || ' hours') BETWEEN
					DATE('now', '-15 days', '+' || ? || ' hours') AND
					DATE('now', '-1 day', '+' || ? || ' hours')
			GROUP BY
				DATE(user.create_time, '+' || ? || ' hours')
			ORDER BY
				date ASC
		`).bind(diffHours, diffHours, diffHours, diffHours, diffHours).all();
		return results;
	},

	async receiveDayCount(c, diffHours, domainId) {
		const emailFilter = domainId
			? `AND email.account_id IN (SELECT account_id FROM account WHERE domain_id = ${domainId} AND is_del = 0)`
			: '';

		const { results } = await c.env.DB.prepare(`
			SELECT
				DATE(email.create_time, '+' || ? || ' hours') AS date,
				COUNT(*) AS total
			FROM
				email
			WHERE
				DATE(email.create_time, '+' || ? || ' hours') BETWEEN
					DATE('now', '-15 days', '+' || ? || ' hours') AND
					DATE('now', '-1 day', '+' || ? || ' hours')
				AND email.type = 0
				${emailFilter}
			GROUP BY
				DATE(email.create_time, '+' || ? || ' hours')
			ORDER BY
				date ASC
		`).bind(diffHours, diffHours, diffHours, diffHours, diffHours).all();
		return results;
	},

	async sendDayCount(c, diffHours, domainId) {
		const emailFilter = domainId
			? `AND email.account_id IN (SELECT account_id FROM account WHERE domain_id = ${domainId} AND is_del = 0)`
			: '';

		const { results } = await c.env.DB.prepare(`
			SELECT
				DATE(email.create_time, '+' || ? || ' hours') AS date,
				COUNT(*) AS total
			FROM
				email
			WHERE
				DATE(email.create_time, '+' || ? || ' hours') BETWEEN
					DATE('now', '-15 days', '+' || ? || ' hours') AND
					DATE('now', '-1 day', '+' || ? || ' hours')
				AND email.type = 1
				${emailFilter}
			GROUP BY
				DATE(email.create_time, '+' || ? || ' hours')
			ORDER BY
				date ASC
		`).bind(diffHours, diffHours, diffHours, diffHours, diffHours).all();
		return results;
	}
};

export default analysisDao;
