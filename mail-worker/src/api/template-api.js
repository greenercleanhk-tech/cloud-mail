/**
 * template-api.js - 郵件模板 HTTP 接口
 */
import app from '../hono/hono';
import templateService from '../service/template-service';
import result from '../model/result';
import userContext from '../security/user-context';

/**
 * 獲取模板列表
 * GET /template/list?domainId=1
 */
app.get('/template/list', async (c) => {
    const { domainId } = c.req.query();
    const userId = await userContext.getUserId(c);
    const list = await templateService.list(c, Number(domainId), userId);
    return c.json(result.ok(list));
});

/**
 * 獲取單個模板
 * GET /template/get?templateId=1
 */
app.get('/template/get', async (c) => {
    const { templateId } = c.req.query();
    const row = await templateService.getById(c, Number(templateId));
    return c.json(result.ok(row));
});

/**
 * 新增模板
 * POST /template/add
 */
app.post('/template/add', async (c) => {
    const userId = await userContext.getUserId(c);
    const body = await c.req.json();
    const row = await templateService.add(c, body, userId);
    return c.json(result.ok(row));
});

/**
 * 更新模板
 * PUT /template/update
 */
app.put('/template/update', async (c) => {
    const body = await c.req.json();
    const row = await templateService.update(c, body);
    return c.json(result.ok(row));
});

/**
 * 刪除模板
 * DELETE /template/delete?templateId=1
 */
app.delete('/template/delete', async (c) => {
    const { templateId } = c.req.query();
    await templateService.delete(c, Number(templateId));
    return c.json(result.ok());
});
