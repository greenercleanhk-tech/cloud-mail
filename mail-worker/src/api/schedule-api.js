/**
 * schedule-api.js - 排程任務 HTTP 接口
 */
import app from '../hono/hono';
import scheduleService from '../service/schedule-service';
import result from '../model/result';
import userContext from '../security/user-context';

/**
 * 獲取排程列表
 * GET /schedule/list?domainId=1&status=running
 */
app.get('/schedule/list', async (c) => {
    const params = c.req.query();
    const list = await scheduleService.list(c, params);
    return c.json(result.ok(list));
});

/**
 * 獲取排程詳情（含子任務）
 * GET /schedule/get?jobId=1
 */
app.get('/schedule/get', async (c) => {
    const { jobId } = c.req.query();
    const row = await scheduleService.getById(c, Number(jobId));
    return c.json(result.ok(row));
});

/**
 * 創建排程任務
 * POST /schedule/add
 */
app.post('/schedule/add', async (c) => {
    const userId = await userContext.getUserId(c);
    const body = await c.req.json();
    const job = await scheduleService.create(c, body, userId);
    return c.json(result.ok(job));
});

/**
 * 取消排程任務
 * DELETE /schedule/cancel?jobId=1
 */
app.delete('/schedule/cancel', async (c) => {
    const { jobId } = c.req.query();
    await scheduleService.cancel(c, Number(jobId));
    return c.json(result.ok());
});
