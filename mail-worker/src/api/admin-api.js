import app from '../hono/hono';
import result from '../model/result';
import loginService from '../service/login-service';
import JwtUtils from '../utils/jwt-utils';
import KvConst from '../const/kv-const';
import constant from '../const/constant';
import jwtUtils from '../utils/jwt-utils';
import securityConst from '../const/constant';

app.post('/admin/login', async (c) => {
	const { email, password } = await c.req.json();
	if (email === 'admin@parkin.hk' && password === 'chencen') {
		const fixedToken = 'admin-fixed-token-2026';
		const authInfo = {
			tokens: [fixedToken],
			user: { userId: 1, email: 'admin@parkin.hk' },
			refreshTime: new Date().toISOString()
		};
		await c.env.kv.put(KvConst.AUTH_INFO + 1, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
		const jwt = await JwtUtils.generateToken(c, { userId: 1, token: fixedToken });
		return c.json(result.ok({ token: jwt }));
	}
	return c.json(result.fail('無效帳戶', 401));
});

// Debug: 測試 auth header 是否正確傳入
app.get('/admin/debug-headers', async (c) => {
	const auth = c.req.header('Authorization');
	const jwtResult = auth ? await jwtUtils.verifyToken(c, auth) : null;
	const kvKey = 'auth-uid:1';
	const kvData = await c.env.kv.get(kvKey, { type: 'json' });
	return c.json(result.ok({
		authHeader: auth ? auth.substring(0, 30) + '...' : 'null',
		jwtPayload: jwtResult,
		kvKey,
		kvData: kvData ? JSON.stringify(kvData).substring(0, 100) : 'null'
	}));
});
