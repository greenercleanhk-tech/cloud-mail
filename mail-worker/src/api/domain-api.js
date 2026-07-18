/**
 * domain-api.js - 域名 HTTP 接口
 */
import app from '../hono/hono';
import domainService from '../service/domain-service';
import result from '../model/result';
import userContext from '../security/user-context';

/**
 * 獲取域名列表
 * GET /domain/list
 */
app.get('/domain/list', async (c) => {
    const list = await domainService.list(c, c.req.query());
    return c.json(result.ok(list));
});

/**
 * 獲取啟用的域名列表（下拉框用）
 * GET /domain/active
 */
app.get('/domain/active', async (c) => {
    const list = await domainService.listActive(c);
    return c.json(result.ok(list));
});

/**
 * 獲取單個域名
 * GET /domain/get
 */
app.get('/domain/get', async (c) => {
    const { domainId } = c.req.query();
    const domain = await domainService.getById(c, Number(domainId));
    return c.json(result.ok(domain));
});

/**
 * 添加域名
 * POST /domain/add
 */
app.post('/domain/add', async (c) => {
    const domain = await domainService.add(c, await c.req.json());
    return c.json(result.ok(domain));
});

/**
 * 更新域名
 * PUT /domain/update
 */
app.put('/domain/update', async (c) => {
    await domainService.update(c, await c.req.json());
    return c.json(result.ok());
});

/**
 * 刪除域名
 * DELETE /domain/delete
 */
app.delete('/domain/delete', async (c) => {
    const { domainId } = c.req.query();
    await domainService.delete(c, Number(domainId));
    return c.json(result.ok());
});

/**
 * 獲取域名統計
 * GET /domain/stats
 */
app.get('/domain/stats', async (c) => {
    const { domainId } = c.req.query();
    const stats = await domainService.getStats(c, Number(domainId));
    return c.json(result.ok(stats));
});
