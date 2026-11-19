import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { pool } from './db.js';
const rl = createInterface({ input, output });
try {
  const full_name = (await rl.question('اسم مدير النظام: ')).trim();
  const email = (await rl.question('البريد الإلكتروني: ')).trim().toLowerCase();
  const password = await rl.question('كلمة المرور (10 أحرف على الأقل): ');
  if (!full_name || !email || password.length < 10) throw new Error('البيانات غير مكتملة أو كلمة المرور قصيرة');
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO app_users(full_name,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id,full_name,email,role`,
    [full_name,email,hash]);
  console.log('تم إنشاء مدير النظام:', rows[0]);
} catch (e) { console.error('تعذر إنشاء المدير:', e.message); process.exitCode = 1; }
finally { rl.close(); await pool.end(); }
