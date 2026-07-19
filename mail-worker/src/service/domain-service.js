/**
 * domain-service.js - 域名業務邏輯
 * 支持多域名管理
 */
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { domain } from '../entity/domain';
import { account } from '../entity/account';
import { email } from '../entity/email';
import { contact } from '../entity/contact';
import { eq, and, sql, count, like } from 'drizzle-orm';
import { emailConst } from '../const/entity-const';
import { t } from '../i18n/i18n';

const domainService = {

    /**
     * 列出所有域名
     * @param {object} c - Cloudflare Context
     * @param {object} params - 查詢參數
     * @returns {Promise<Array>} 域名列表
     */
    async list(c, params = {}) {
        const list = await orm(c)
            .select()
            .from(domain)
            .where(eq(domain.isDel, 0))
            .orderBy(domain.createTime)
            .all();
        return list;
    },

    /**
     * 獲取所有啟用的域名（下拉框用）
     * @param {object} c - Cloudflare Context
     * @returns {Promise<Array>} 啟用的域名列表
     */
    async listActive(c) {
        const list = await orm(c)
            .select()
            .from(domain)
            .where(and(
                eq(domain.isDel, 0),
                eq(domain.isActive, 1)
            ))
            .orderBy(domain.createTime)
            .all();
        return list;
    },

    /**
     * 根據 ID 獲取域名
     * @param {object} c - Cloudflare Context
     * @param {number} domainId - 域名 ID
     * @returns {Promise<Object>} 域名信息
     */
    async getById(c, domainId) {
        const row = await orm(c)
            .select()
            .from(domain)
            .where(and(
                eq(domain.domainId, domainId),
                eq(domain.isDel, 0)
            ))
            .get();
        return row;
    },

    /**
     * 根據域名稱獲取域名
     * @param {object} c - Cloudflare Context
     * @param {string} domainName - 域名稱
     * @returns {Promise<Object>} 域名信息
     */
    async getByDomain(c, domainName) {
        const row = await orm(c)
            .select()
            .from(domain)
            .where(and(
                eq(domain.domain, domainName),
                eq(domain.isDel, 0)
            ))
            .get();
        return row;
    },

    /**
     * 添加新域名
     * @param {object} c - Cloudflare Context
     * @param {object} params - 域名參數
     * @returns {Promise<Object>} 新增的域名
     */
    async add(c, params) {
        const { domain: domainName, displayName, resendApiKey } = params;

        // 校驗域名格式
        if (!domainName) {
            throw new BizError(t('domainRequired'));
        }

        // 簡單的域名格式校驗
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domainName)) {
            throw new BizError(t('invalidDomainFormat'));
        }

        // 檢查是否有同名記錄（無論是否已軟刪除），有的話先徹底刪除再新增
        // 避免 soft-delete 殘留導致 "domain already exists" 錯誤
        const existingAny = await orm(c)
            .select()
            .from(domain)
            .where(eq(domain.domain, domainName))
            .get();
        if (existingAny) {
            // 硬刪除（永久移除）
            await orm(c).delete(domain).where(eq(domain.domainId, existingAny.domainId)).run();
        }

        const row = await orm(c)
            .insert(domain)
            .values({
                domain: domainName,
                displayName: displayName || domainName,
                resendApiKey: resendApiKey || '',
                mxStatus: 'pending',
                spfStatus: 'pending',
                dkimStatus: 'pending',
                isActive: 1,
                isDel: 0
            })
            .returning()
            .get();

        return row;
    },

    /**
     * 更新域名
     * @param {object} c - Cloudflare Context
     * @param {object} params - 更新參數
     * @returns {Promise<void>}
     */
    async update(c, params) {
        const { domainId, displayName, resendApiKey, isActive, mxStatus, spfStatus, dkimStatus } = params;

        const updateData = {};
        if (displayName !== undefined) updateData.displayName = displayName;
        if (resendApiKey !== undefined) updateData.resendApiKey = resendApiKey;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (mxStatus !== undefined) updateData.mxStatus = mxStatus;
        if (spfStatus !== undefined) updateData.spfStatus = spfStatus;
        if (dkimStatus !== undefined) updateData.dkimStatus = dkimStatus;

        await orm(c)
            .update(domain)
            .set(updateData)
            .where(and(
                eq(domain.domainId, domainId),
                eq(domain.isDel, 0)
            ))
            .run();
    },

    /**
     * 刪除域名（軟刪除）
     * @param {object} c - Cloudflare Context
     * @param {number} domainId - 域名 ID
     * @returns {Promise<void>}
     */
    async delete(c, domainId) {
        await orm(c)
            .update(domain)
            .set({ isDel: 1 })
            .where(and(
                eq(domain.domainId, domainId),
                eq(domain.isDel, 0)
            ))
            .run();
    },

    /**
     * 獲取域名的基本統計
     * @param {object} c - Cloudflare Context
     * @param {number} domainId - 域名 ID
     * @returns {Promise<Object>} 統計信息
     */
    async getStats(c, domainId) {
        const domainRow = await this.getById(c, domainId);
        if (!domainRow) throw new BizError(t('domainNotFound'), 404);

        const domainName = domainRow.domain; // e.g. "psybridgemedical.info"

        // 該域名下所有郵箱
        const accounts = await orm(c)
            .select()
            .from(account)
            .where(and(eq(account.domainId, domainId), eq(account.isDel, 0)))
            .all();

        // 該域名所有郵箱的郵箱統計
        const accountStats = await Promise.all(accounts.map(async (acc) => {
            // 發送總數（type=SEND）
            const sentResult = await orm(c)
                .select({ cnt: count() })
                .from(email)
                .where(and(eq(email.accountId, acc.accountId), eq(email.type, emailConst.type.SEND)))
                .get();
            const sent = sentResult?.cnt ?? 0;

            // 退信數（status=BOUNCED）
            const bouncedResult = await orm(c)
                .select({ cnt: count() })
                .from(email)
                .where(and(eq(email.accountId, acc.accountId), eq(email.status, emailConst.status.BOUNCED)))
                .get();
            const bounced = bouncedResult?.cnt ?? 0;

            // 開啟數（status=DELIVERED，表示已送達但未退回 = 疑似開啟；實際開啟追蹤需要追蹤像素）
            const deliveredResult = await orm(c)
                .select({ cnt: count() })
                .from(email)
                .where(and(eq(email.accountId, acc.accountId), eq(email.status, emailConst.status.DELIVERED)))
                .get();
            const delivered = deliveredResult?.cnt ?? 0;

            // 健康度 = (sent - bounced) / sent，100% 為完美
            const health = sent > 0 ? Math.round(((sent - bounced) / sent) * 100) : 100;

            // 該郵箱地址的退訂人數（contacts 表中該郵箱作為發件來源的退訂數）
            // 注意：contacts.is_unsubscribed 是按 email 標記的
            const unsubResult = await orm(c)
                .select({ cnt: count() })
                .from(contact)
                .where(and(
                    like(contact.email, `%@${domainName}`),
                    eq(contact.isUnsubscribed, 1)
                ))
                .get();
            const unsubscribed = unsubResult?.cnt ?? 0;

            return {
                accountId: acc.accountId,
                email: acc.email,
                name: acc.name,
                status: acc.status,
                sent,
                delivered,
                bounced,
                unsubscribed,
                health
            };
        }));

        // 域名級統計
        const totalSent = accountStats.reduce((sum, a) => sum + a.sent, 0);
        const totalBounced = accountStats.reduce((sum, a) => sum + a.bounced, 0);
        const totalUnsubscribed = accountStats.reduce((sum, a) => sum + a.unsubscribed, 0);
        const domainHealth = totalSent > 0 ? Math.round(((totalSent - totalBounced) / totalSent) * 100) : 100;

        return {
            domainId,
            domain: domainName,
            health: domainHealth,
            totalSent,
            totalDelivered,
            totalBounced,
            totalUnsubscribed,
            accounts: accountStats
        };
    }
};

export default domainService;
