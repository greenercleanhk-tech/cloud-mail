/**
 * contact-service.js - 通訊錄業務邏輯
 */
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { contact, contactGroup } from '../entity/contact';
import { and, eq, like, or, sql, count } from 'drizzle-orm';
import { t } from '../i18n/i18n';

const contactService = {

    // ==================== 通訊錄 ====================

    /**
     * 獲取通訊錄列表
     */
    async list(c, params = {}) {
        const { domainId, userId, keyword, groupId, page = 1, size = 50 } = params;

        let query = orm(c)
            .select()
            .from(contact)
            .where(and(
                eq(contact.userId, userId),
                eq(contact.isDel, 0),
                domainId ? eq(contact.domainId, domainId) : sql`1=1`
            ));

        if (keyword) {
            query = orm(c)
                .select()
                .from(contact)
                .where(and(
                    eq(contact.userId, userId),
                    eq(contact.isDel, 0),
                    domainId ? eq(contact.domainId, domainId) : sql`1=1`,
                    or(
                        like(contact.name, `%${keyword}%`),
                        like(contact.email, `%${keyword}%`)
                    )
                ));
        }

        if (groupId && groupId > 0) {
            query = orm(c)
                .select()
                .from(contact)
                .where(and(
                    eq(contact.userId, userId),
                    eq(contact.groupId, groupId),
                    eq(contact.isDel, 0),
                    domainId ? eq(contact.domainId, domainId) : sql`1=1`
                ));
        }

        const list = await query
            .orderBy(sql`${contact.createTime} DESC`)
            .limit(size)
            .offset((page - 1) * size)
            .all();

        return list;
    },

    /**
     * 添加聯絡人
     */
    async add(c, params, userId) {
        const { name, email, groupId, domainId, remark } = params;

        if (!email) {
            throw new BizError(t('emailRequired'));
        }

        // 簡單郵箱校驗
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new BizError(t('invalidEmail'));
        }

        const row = await orm(c)
            .insert(contact)
            .values({
                name: name || email.split('@')[0],
                email,
                groupId: groupId || 0,
                domainId: domainId || 1,
                userId,
                remark: remark || '',
                isDel: 0
            })
            .returning()
            .get();

        return row;
    },

    /**
     * 批量添加聯絡人
     */
    async batchAdd(c, params, userId) {
        const { contacts, domainId } = params;

        if (!contacts || contacts.length === 0) {
            throw new BizError(t('contactsRequired'));
        }

        const values = contacts.map(item => ({
            name: item.name || item.email.split('@')[0],
            email: item.email,
            groupId: item.groupId || 0,
            domainId: domainId || 1,
            userId,
            remark: item.remark || '',
            isDel: 0
        }));

        await orm(c).insert(contact).values(values).run();
        return { count: values.length };
    },

    /**
     * 更新聯絡人
     */
    async update(c, params, userId) {
        const { contactId, name, email, groupId, remark } = params;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (groupId !== undefined) updateData.groupId = groupId;
        if (remark !== undefined) updateData.remark = remark;

        await orm(c)
            .update(contact)
            .set(updateData)
            .where(and(
                eq(contact.contactId, contactId),
                eq(contact.userId, userId),
                eq(contact.isDel, 0)
            ))
            .run();
    },

    /**
     * 刪除聯絡人（軟刪除）
     */
    async delete(c, params, userId) {
        const { contactId } = params;

        await orm(c)
            .update(contact)
            .set({ isDel: 1 })
            .where(and(
                eq(contact.contactId, contactId),
                eq(contact.userId, userId)
            ))
            .run();
    },

    // ==================== 群組 ====================

    /**
     * 獲取群組列表
     */
    async groupList(c, params = {}) {
        const { domainId, userId } = params;

        const list = await orm(c)
            .select()
            .from(contactGroup)
            .where(and(
                eq(contactGroup.userId, userId),
                eq(contactGroup.isDel, 0),
                domainId ? eq(contactGroup.domainId, domainId) : sql`1=1`
            ))
            .orderBy(contactGroup.sort, contactGroup.createTime)
            .all();

        return list;
    },

    /**
     * 添加群組
     */
    async groupAdd(c, params, userId) {
        const { name, domainId, sort } = params;

        if (!name) {
            throw new BizError(t('groupNameRequired'));
        }

        const row = await orm(c)
            .insert(contactGroup)
            .values({
                name,
                domainId: domainId || 1,
                userId,
                sort: sort || 0,
                isDel: 0
            })
            .returning()
            .get();

        return row;
    },

    /**
     * 更新群組
     */
    async groupUpdate(c, params, userId) {
        const { groupId, name, sort } = params;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (sort !== undefined) updateData.sort = sort;

        await orm(c)
            .update(contactGroup)
            .set(updateData)
            .where(and(
                eq(contactGroup.groupId, groupId),
                eq(contactGroup.userId, userId),
                eq(contactGroup.isDel, 0)
            ))
            .run();
    },

    /**
     * 刪除群組
     */
    async groupDelete(c, params, userId) {
        const { groupId } = params;

        // 軟刪除群組
        await orm(c)
            .update(contactGroup)
            .set({ isDel: 1 })
            .where(and(
                eq(contactGroup.groupId, groupId),
                eq(contactGroup.userId, userId)
            ))
            .run();

        // 該群組的聯絡人移到「無群組」
        await orm(c)
            .update(contact)
            .set({ groupId: 0 })
            .where(and(
                eq(contact.groupId, groupId),
                eq(contact.userId, userId)
            ))
            .run();
    },

    /**
     * 獲取群組內的成員數量
     */
    async groupMemberCount(c, params = {}) {
        const { domainId, userId } = params;

        const groups = await this.groupList(c, { domainId, userId });
        const contacts = await orm(c)
            .select({
                groupId: contact.groupId,
                count: count()
            })
            .from(contact)
            .where(and(
                eq(contact.userId, userId),
                eq(contact.isDel, 0),
                domainId ? eq(contact.domainId, domainId) : sql`1=1`
            ))
            .groupBy(contact.groupId)
            .all();

        return groups.map(g => ({
            ...g,
            memberCount: contacts.find(c => c.groupId === g.groupId)?.count || 0
        }));
    }
};

export default contactService;
