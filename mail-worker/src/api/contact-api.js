/**
 * contact-api.js - 通訊錄 HTTP 接口
 */
import app from '../hono/hono';
import contactService from '../service/contact-service';
import result from '../model/result';
import userContext from '../security/user-context';
import { base64Decode } from '../utils/crypto-utils';

// ==================== 通訊錄接口 ====================

/**
 * 獲取通訊錄列表
 * GET /contact/list
 */
app.get('/contact/list', async (c) => {
    const userId = userContext.getUserId(c);
    const list = await contactService.list(c, { ...c.req.query(), userId });
    return c.json(result.ok(list));
});

/**
 * 添加聯絡人
 * POST /contact/add
 */
app.post('/contact/add', async (c) => {
    const userId = userContext.getUserId(c);
    const contact = await contactService.add(c, await c.req.json(), userId);
    return c.json(result.ok(contact));
});

/**
 * 批量添加聯絡人
 * POST /contact/batchAdd
 */
app.post('/contact/batchAdd', async (c) => {
    const userId = userContext.getUserId(c);
    const result = await contactService.batchAdd(c, await c.req.json(), userId);
    return c.json(result.ok(result));
});

/**
 * 更新聯絡人
 * PUT /contact/update
 */
app.put('/contact/update', async (c) => {
    const userId = userContext.getUserId(c);
    await contactService.update(c, await c.req.json(), userId);
    return c.json(result.ok());
});

/**
 * 批量刪除聯絡人
 * POST /contact/batchDelete
 */
app.post('/contact/batchDelete', async (c) => {
    const userId = userContext.getUserId(c);
    const res = await contactService.batchDelete(c, await c.req.json(), userId);
    return c.json(result.ok(res));
});

/**
 * 刪除聯絡人（單條）
 * DELETE /contact/delete
 */
app.delete('/contact/delete', async (c) => {
    const userId = userContext.getUserId(c);
    await contactService.delete(c, c.req.query(), userId);
    return c.json(result.ok());
});

// ==================== 群組接口 ====================

/**
 * 獲取群組列表
 * GET /contact/group/list
 */
app.get('/contact/group/list', async (c) => {
    const userId = userContext.getUserId(c);
    const list = await contactService.groupMemberCount(c, { ...c.req.query(), userId });
    return c.json(result.ok(list));
});

/**
 * 添加群組
 * POST /contact/group/add
 */
app.post('/contact/group/add', async (c) => {
    const userId = userContext.getUserId(c);
    const group = await contactService.groupAdd(c, await c.req.json(), userId);
    return c.json(result.ok(group));
});

/**
 * 更新群組
 * PUT /contact/group/update
 */
app.put('/contact/group/update', async (c) => {
    const userId = userContext.getUserId(c);
    await contactService.groupUpdate(c, await c.req.json(), userId);
    return c.json(result.ok());
});

/**
 * 刪除群組
 * DELETE /contact/group/delete
 */
app.delete('/contact/group/delete', async (c) => {
    const userId = userContext.getUserId(c);
    await contactService.groupDelete(c, c.req.query(), userId);
    return c.json(result.ok());
});

/**
 * 退訂接口（公開，contact 點擊郵件中的連結觸發）
 * GET /contact/unsubscribe?token=<base64 email>
 */
app.get('/contact/unsubscribe', async (c) => {
    const { token } = c.req.query();
    if (!token) {
        return c.html('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>無效連結</h2><p>退訂連結無效，請聯繫我們。</p></body></html>');
    }
    try {
        const email = base64Decode(token);
        await contactService.unsubscribe(c, email);
        return c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2>✅ 退訂成功</h2>
            <p style="color:#666">您已成功退訂營銷郵件。<br>您不會再收到我們的推廣郵件。</p>
            <p style="color:#999;font-size:12px;margin-top:20px">If you prefer English, you have been successfully unsubscribed.</p>
        </body></html>`);
    } catch (e) {
        return c.html('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>退訂失敗</h2><p>請稍後再試，或聯繫我們。</p></body></html>');
    }
});

/**
 * 重新訂閱接口（公開）
 * GET /contact/resubscribe?token=<base64 email>
 */
app.get('/contact/resubscribe', async (c) => {
    const { token } = c.req.query();
    if (!token) {
        return c.html('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>無效連結</h2></body></html>');
    }
    try {
        const email = base64Decode(token);
        await contactService.resubscribe(c, email);
        return c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2>✅ 已重新訂閱</h2>
            <p style="color:#666">您已恢復訂閱。</p>
        </body></html>`);
    } catch (e) {
        return c.html('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>操作失敗</h2></body></html>');
    }
});
