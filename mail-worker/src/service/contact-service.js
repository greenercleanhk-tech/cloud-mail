/**
 * contact-service.js - 通訊錄業務邏輯
 */
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { contact, contactGroup } from '../entity/contact';
import { and, eq, like, or, sql, count } from 'drizzle-orm';
import { t } from '../i18n/i18n';
import { batchInsertNative } from '../utils/batch-utils';

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

        // 同時計算總數（與 list 相同過濾條件）
        const countResult = await orm(c)
            .select({ cnt: count() })
            .from(contact)
            .where(and(
                eq(contact.userId, userId),
                eq(contact.isDel, 0),
                domainId ? eq(contact.domainId, domainId) : sql`1=1`,
                groupId && groupId > 0 ? eq(contact.groupId, groupId) : sql`1=1`,
                keyword ? or(like(contact.name, `%${keyword}%`), like(contact.email, `%${keyword}%`)) : sql`1=1`
            ))
            .get();

        return { list, total: countResult?.cnt || 0 };
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
     * SQLite 有 999 SQL 變量上限，分批處理避免爆掉
     */
    async batchAdd(c, params, userId) {
        const { contacts, domainId } = params;

        if (!contacts || contacts.length === 0) {
            throw new BizError(t('contactsRequired'));
        }

        console.log(`[batchAdd] 收到 ${contacts.length} 條聯絡人`);

        // 收集 unique groupIds 供日誌確認
        const groupIds = [...new Set(contacts.map(c => c.groupId))];
        console.log(`[batchAdd] 這些聯絡人的 groupIds: ${JSON.stringify(groupIds)}`);

        const values = contacts.map(item => ({
            name: item.name || item.email.split('@')[0],
            email: item.email,
            groupId: Number(item.groupId) || 0,
            domainId: domainId || 1,
            userId,
            remark: item.remark || '',
            isDel: 0
        }));

        try {
            // 使用原生 D1 API，列名為 DB 列名（非 entity camelCase）
            await batchInsertNative(c, 'contacts', [
                'name',
                'email',
                'group_id',
                'domain_id',
                'user_id',
                'remark',
                'is_unsubscribed',
                'create_time',
                'is_del'
            ], values, domainId || 1, userId);
        } catch (e) {
            console.error(`[batchAdd] 插入失敗: ${e.message}`);
            throw e;
        }
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
                eq(contact.contactId, Number(contactId)),
                eq(contact.userId, userId)
            ))
            .run();
    },

    /**
     * 批量刪除聯絡人（軟刪除）
     */
    async batchDelete(c, params, userId) {
        const { contactIds } = params;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            throw new BizError(t('contactsRequired'));
        }

        const ids = contactIds.map(id => Number(id));
        await orm(c)
            .update(contact)
            .set({ isDel: 1 })
            .where(and(
                sql`${contact.contactId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
                eq(contact.userId, userId)
            ))
            .run();

        return { count: ids.length };
    },

    /**
     * 按條件批量刪除（軟刪除）- 支援 groupId / keyword 過濾
     */
    async batchDeleteByFilter(c, params, userId) {
        const { domainId, groupId, keyword } = params;
        const domainIdNum = Number(domainId) || 1;

        // 先計算符合條件的數量
        const countResult = await orm(c)
            .select({ cnt: count() })
            .from(contact)
            .where(and(
                eq(contact.userId, userId),
                eq(contact.isDel, 0),
                eq(contact.domainId, domainIdNum),
                groupId && Number(groupId) > 0 ? eq(contact.groupId, Number(groupId)) : sql`1=1`,
                keyword ? or(like(contact.name, `%${keyword}%`), like(contact.email, `%${keyword}%`)) : sql`1=1`
            ))
            .get();

        const deleteConditions = [
            eq(contact.userId, userId),
            eq(contact.isDel, 0),
            eq(contact.domainId, domainIdNum)
        ];
        if (groupId && Number(groupId) > 0) deleteConditions.push(eq(contact.groupId, Number(groupId)));
        if (keyword) deleteConditions.push(or(like(contact.name, `%${keyword}%`), like(contact.email, `%${keyword}%`)));

        await orm(c)
            .update(contact)
            .set({ isDel: 1 })
            .where(and(...deleteConditions))
            .run();

        return { count: countResult?.cnt || 0 };
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
     * 獲取群組列表（含成員數量）
     */
    async groupMemberCount(c, params = {}) {
        const { domainId, userId } = params;
        const domainIdNum = Number(domainId) || 1;

        const groups = await this.groupList(c, { domainId: domainIdNum, userId });

        const contacts = await orm(c)
            .select({
                groupId: contact.groupId,
                cnt: count()
            })
            .from(contact)
            .where(and(
                eq(contact.userId, userId),
                eq(contact.isDel, 0),
                eq(contact.domainId, domainIdNum)
            ))
            .groupBy(contact.groupId)
            .all();

        return groups.map(g => ({
            ...g,
            memberCount: contacts.find(x => Number(x.groupId) === g.groupId)?.cnt || 0
        }));
    },

    // ==================== 退訂管理 ====================

    /**
     * 標記退訂（按 email 查找並更新）
     */
    async unsubscribe(c, email) {
        const row = await orm(c)
            .select({ contactId: contact.contactId })
            .from(contact)
            .where(eq(contact.email, email))
            .get();
        if (!row) throw new BizError('聯絡人不存在');
        await orm(c)
            .update(contact)
            .set({ isUnsubscribed: 1 })
            .where(eq(contact.contactId, row.contactId))
            .run();
    },

    /**
     * 重新訂閱（按 email 查找並更新）
     */
    async resubscribe(c, email) {
        const row = await orm(c)
            .select({ contactId: contact.contactId })
            .from(contact)
            .where(eq(contact.email, email))
            .get();
        if (!row) throw new BizError('聯絡人不存在');
        await orm(c)
            .update(contact)
            .set({ isUnsubscribed: 0 })
            .where(eq(contact.contactId, row.contactId))
            .run();
    },

    /**
     * 查詢退訂名單
     */
    async unsubscribeList(c, params = {}) {
        const { userId, domainId, keyword, page = 1, size = 50 } = params;
        let query = orm(c)
            .select()
            .from(contact)
            .where(and(
                eq(contact.userId, userId),
                eq(contact.isUnsubscribed, 1),
                eq(contact.isDel, 0)
            ));
        if (keyword) {
            query = orm(c)
                .select()
                .from(contact)
                .where(and(
                    eq(contact.userId, userId),
                    eq(contact.isUnsubscribed, 1),
                    eq(contact.isDel, 0),
                    or(
                        like(contact.name, `%${keyword}%`),
                        like(contact.email, `%${keyword}%`)
                    )
                ));
        }
        const offset = (Number(page) - 1) * Number(size);
        const list = await query.orderBy(contact.createTime).offset(offset).limit(Number(size)).all();
        const total = await orm(c)
            .select({ count: count() })
            .from(contact)
            .where(and(
                eq(contact.userId, userId),
                eq(contact.isUnsubscribed, 1),
                eq(contact.isDel, 0)
            ))
            .get();
        return { list, total: total.count };
    }
};

export default contactService;
