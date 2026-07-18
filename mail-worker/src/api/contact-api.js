/**
 * contact-api.js - 通訊錄 HTTP 接口
 */
import app from '../hono/hono';
import contactService from '../service/contact-service';
import result from '../model/result';
import userContext from '../security/user-context';

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
 * 刪除聯絡人
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
