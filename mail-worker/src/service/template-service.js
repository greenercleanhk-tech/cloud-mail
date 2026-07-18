/**
 * template-service.js - 郵件模板業務邏輯
 */
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { emailTemplate } from '../entity/email-template';
import { eq, and, desc } from 'drizzle-orm';
import { t } from '../i18n/i18n';

const templateService = {

    /**
     * 列出某域名的所有模板
     */
    async list(c, domainId, userId) {
        return orm(c)
            .select()
            .from(emailTemplate)
            .where(and(
                eq(emailTemplate.domainId, domainId),
                eq(emailTemplate.userId, userId),
                eq(emailTemplate.isDel, 0)
            ))
            .orderBy(desc(emailTemplate.createTime))
            .all();
    },

    /**
     * 根據 ID 獲取模板
     */
    async getById(c, templateId) {
        return orm(c)
            .select()
            .from(emailTemplate)
            .where(and(
                eq(emailTemplate.templateId, templateId),
                eq(emailTemplate.isDel, 0)
            ))
            .get();
    },

    /**
     * 新增模板
     */
    async add(c, params, userId) {
        const { name, subject, content, domainId } = params;

        if (!name || !subject || !content) {
            throw new BizError(t('templateFieldRequired'));
        }

        const row = await orm(c)
            .insert(emailTemplate)
            .values({
                name,
                subject,
                content,
                domainId: Number(domainId),
                userId
            })
            .returning()
            .get();

        return row;
    },

    /**
     * 更新模板
     */
    async update(c, params) {
        const { templateId, name, subject, content } = params;

        if (!templateId) {
            throw new BizError(t('templateIdRequired'));
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (subject !== undefined) updateData.subject = subject;
        if (content !== undefined) updateData.content = content;

        const row = await orm(c)
            .update(emailTemplate)
            .set(updateData)
            .where(and(
                eq(emailTemplate.templateId, Number(templateId)),
                eq(emailTemplate.isDel, 0)
            ))
            .returning()
            .get();

        return row;
    },

    /**
     * 刪除模板（軟刪除）
     */
    async delete(c, templateId) {
        await orm(c)
            .update(emailTemplate)
            .set({ isDel: 1 })
            .where(and(
                eq(emailTemplate.templateId, Number(templateId)),
                eq(emailTemplate.isDel, 0)
            ))
            .run();
    }
};

export default templateService;
