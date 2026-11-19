import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import routes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
import { pool } from './db.js';

const required = ['DATABASE_URL','JWT_SECRET'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(x=>x.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.get('/health', async (_req,res) => {
  try { await pool.query('SELECT 1'); res.json({ status:'ok', database:'connected' }); }
  catch { res.status(503).json({ status:'error', database:'unavailable' }); }
});
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error:'محاولات كثيرة. حاول بعد قليل.' } }));
app.use('/api', routes);

app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next(err);
  });
});
app.use((err,_req,res,_next) => {
  console.error(err);
  if (err.code === '23505') return res.status(409).json({ error:'البريد أو الهاتف مستخدم بالفعل' });
  if (err.code === '23503') return res.status(400).json({ error:'مرجع الفصل أو المستخدم غير صحيح' });
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'حدث خطأ داخلي' : err.message });
});
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => console.log(`Service API listening on port ${port}`));
process.on('SIGTERM', async () => { server.close(); await pool.end(); process.exit(0); });
