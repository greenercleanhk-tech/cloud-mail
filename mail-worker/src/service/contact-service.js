/**
 * contact-service.js - 通訊錄業務邏輯
 */
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { contact, contactGroup } from '../entity/contact';
import { and, eq, like, or, sql, count } from 'drizzle-orm';
import { t } from '../i18n/i18n';
import { batchInsertContacts } from '../utils/batch-utils';

const contactService = {

    // ==================== 通訊錄 ====================

    /**
     * 獲取通訊錄列表
     */
    async list(c, params = {}) {
        const { domainId, userId, keyword, groupId, page = 1, size = 50 } = params;

        // 組合所有篩選條件到同一個 query（三個 if 不再互斥）
        const conditions = [
            eq(contact.userId, userId),
            eq(contact.isDel, 0),
            domainId ? eq(contact.domainId, domainId) : sql`1=1`
        ];
        if (keyword) {
            conditions.push(or(
                like(contact.name, `%${keyword}%`),
                like(contact.email, `%${keyword}%`)
            ));
        }
        if (groupId && groupId > 0) {
            conditions.push(eq(contact.groupId, groupId));
        }

        const query = orm(c)
            .select()
            .from(contact)
            .where(and(...conditions))
            .orderBy(sql`${contact.createTime} DESC`)
            .limit(size)
            .offset((page - 1) * size);

        const list = await query.all();

        // 總數查詢（相同過濾條件）
        const countResult = await orm(c)
            .select({ cnt: count() })
            .from(contact)
            .where(and(...conditions))
            .get();

        // allCount：全部聯絡人總數（不受 groupId 影響，用於「全部聯繫人」標籤）
        const allConditions = [
            eq(contact.userId, userId),
            eq(contact.isDel, 0),
            domainId ? eq(contact.domainId, domainId) : sql`1=1`
        ];
        if (keyword) {
            allConditions.push(or(
                like(contact.name, `%${keyword}%`),
                like(contact.email, `%${keyword}%`)
            ));
        }
        const allResult = await orm(c)
            .select({ cnt: count() })
            .from(contact)
            .where(and(...allConditions))
            .get();

        return {
            list,
            total: countResult?.cnt || 0,
            allCount: allResult?.cnt || 0
        };
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
     * CSV 內部重複 + 資料庫已存在的郵箱都會被過濾掉
     * 流式去重：每 500 條查一次資料庫，不一次查出全部現有郵箱
     */
    async batchAdd(c, params, userId) {
        const { contacts, domainId } = params;

        if (!contacts || contacts.length === 0) {
            throw new BizError(t('contactsRequired'));
        }

        const domainIdNum = domainId || 1;
        console.log(`[batchAdd] 收到 ${contacts.length} 條聯絡人`);

        // ---------- 第一步：CSV 內部去重（保留第一個） ----------
        const seenEmail = new Set();
        const csvUnique = [];
        let csvDupCount = 0;
        for (const item of contacts) {
            const email = (item.email || '').toLowerCase().trim();
            if (!email) continue;
            if (seenEmail.has(email)) {
                csvDupCount++;
                continue;
            }
            seenEmail.add(email);
            csvUnique.push({
                name: item.name || email.split('@')[0],
                email,
                groupId: Number(item.groupId) || 0,
                domainId: domainIdNum,
                userId,
                remark: item.remark || '',
                isDel: 0
            });
        }
        console.log(`[batchAdd] CSV 內部去重後: ${csvUnique.length} 條（重複: ${csvDupCount} 條）`);

        // ---------- 第二步：流式去重，每 500 條查一次資料庫 ----------
        const DEDUP_BATCH = 500;
        const toInsert = [];
        let dbDupCount = 0;
        let checkedCount = 0;

        for (let i = 0; i < csvUnique.length; i += DEDUP_BATCH) {
            const batch = csvUnique.slice(i, i + DEDUP_BATCH);
            const emails = batch.map(item => item.email.toLowerCase());

            // 用 IN 只查這批郵箱是否已存在（高效，只返回匹配的行）
            const placeholders = emails.map(() => '?').join(', ');
            const existingRows = await c.env.db.prepare(
                `SELECT email FROM contacts WHERE user_id = ? AND is_del = 0 AND email IN (${placeholders})`
            ).bind(userId, ...emails).all();

            const existingSet = new Set(existingRows.results.map(r => r.email.toLowerCase()));

            for (const item of batch) {
                const emailLower = item.email.toLowerCase();
                if (existingSet.has(emailLower)) {
                    dbDupCount++;
                } else {
                    toInsert.push(item);
                }
            }
            checkedCount += batch.length;
            console.log(`[batchAdd] 已檢查 ${checkedCount}/${csvUnique.length}，待寫入: ${toInsert.length} 條`);
        }
        console.log(`[batchAdd] 資料庫重複: ${dbDupCount} 條，實際寫入: ${toInsert.length} 條`);

        if (toInsert.length === 0) {
            return { count: 0, csvDup: csvDupCount, dbDup: dbDupCount, msg: '所有郵箱均已存在或為重複' };
        }

        try {
            await batchInsertContacts(c, toInsert, domainIdNum, userId);
        } catch (e) {
            console.error(`[batchAdd] 插入失敗: ${e.message}`);
            throw e;
        }
        return { count: toInsert.length, csvDup: csvDupCount, dbDup: dbDupCount };
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
