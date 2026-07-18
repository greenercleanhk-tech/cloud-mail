/**
 * domain-service.js - 域名業務邏輯
 * 支持多域名管理
 */
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { domain } from '../entity/domain';
import { eq, and, sql, count } from 'drizzle-orm';
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

        // 檢查域名是否已存在
        const existing = await this.getByDomain(c, domainName);
        if (existing) {
            throw new BizError(t('domainAlreadyExists'));
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
        // 這裡可以擴展更多統計
        return {
            domainId,
            status: 'ok'
        };
    }
};

export default domainService;
