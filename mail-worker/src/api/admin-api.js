import app from '../hono/hono';
import result from '../model/result';
import loginService from '../service/login-service';

app.post('/admin/login', async (c) => {
	const { email, password } = await c.req.json();
	if (email === 'admin@parkin.hk' && password === 'chencen') {
		// 直接用 KV 存一個固定 token，跳過 D1 查詢
		const fixedToken = 'admin-fixed-token-2026';
		const { KvConst } = await import('../const/kv-const.js');
		const { constant } = await import('../const/constant.js');
		const authInfo = {
			tokens: [fixedToken],
			user: { userId: 1, email: 'admin@parkin.hk' },
			refreshTime: new Date().toISOString()
		};
		await c.env.kv.put(KvConst.AUTH_INFO + 1, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
		const jwt = await (await import('../utils/jwt-utils.js')).default.generateToken(c, { userId: 1, token: fixedToken });
		return c.json(result.ok({ token: jwt }));
	}
	return c.json(result.fail('無效帳戶', 401));
});
