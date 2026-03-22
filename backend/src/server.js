import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import os from 'os';
import { authRouter } from './routes/auth.js';
import { bookingsRouter } from './routes/bookings.js';
import { analyticsRouter } from './routes/analytics.js';
import { exportRouter } from './routes/export.js';
import { experimentersRouter } from './routes/experimenters.js';
import { usersRouter } from './routes/users.js';
import { rolesRouter } from './routes/roles.js';
import { systemLogsRouter } from './routes/system-logs.js';
import { calendarRouter } from './routes/calendar.js';
import { seqTypesRouter } from './routes/seq-types.js';
import { getPool } from './db.js';
import { requireAuth, requirePermission } from './auth.js';

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/** CORS_ALLOW_ALL=0 时仅允许 ALLOWED_ORIGINS 白名单；未配置白名单时仍允许全部（与旧行为一致） */
const corsStrict = process.env.CORS_ALLOW_ALL === '0';

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl / 同源无 Origin
    if (!corsStrict || !allowedOrigins.length) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      api: 'sc-booking',
      /** 用于确认是否已部署含日历/测序类型的版本；无此字段则为旧后端 */
      features: { calendar: true, seqTypes: true, bookingTripWindow: true }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/bookings', requireAuth, bookingsRouter);
app.use('/api/analytics', requireAuth, requirePermission('analytics:read'), analyticsRouter);
app.use('/api/export', requireAuth, requirePermission('booking:export'), exportRouter);
app.use('/api/experimenters', requireAuth, experimentersRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/roles', requireAuth, rolesRouter);
app.use('/api/system-logs', requireAuth, systemLogsRouter);
app.use('/api/calendar', requireAuth, calendarRouter);
app.use('/api/seq-types', requireAuth, seqTypesRouter);

// 未匹配路由时统一 JSON（避免 Express 默认 HTML「Cannot GET …」）；含日历相关路径时给出排查提示
app.use((req, res) => {
  const path = req.originalUrl || req.url || '';
  const calendarHint =
    path.startsWith('/api/calendar') || path.startsWith('/api/seq-types')
      ? '若刚升级过代码：请在本机结束占用 PORT 的旧 node 进程后，在 fullstack/backend 目录执行 npm run dev 再试。'
      : undefined;
  res.status(404).json({ error: 'Not found', path, ...(calendarHint ? { hint: calendarHint } : {}) });
});

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const msg = String(err?.message || err || 'Unknown error');
  res.status(500).json({ error: msg });
});

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const values of Object.values(nets)) {
    for (const net of values || []) {
      if (net && net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

app.listen(port, host, () => {
  const lanIp = getLanIp();
  console.log(`API listening on http://${lanIp}:${port}`);
  console.log(
    'Routes: GET /api/calendar/summary, GET /api/calendar/day, GET|POST|DELETE /api/seq-types (均需 Bearer)'
  );
});

