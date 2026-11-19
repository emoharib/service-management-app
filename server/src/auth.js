import jwt from 'jsonwebtoken';
import { pool } from './db.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.can_record_attendance, u.is_active,
              a.class_id, c.name AS class_name
       FROM app_users u LEFT JOIN user_class_assignments a ON a.user_id=u.id
       LEFT JOIN service_classes c ON c.id=a.class_id WHERE u.id=$1`, [payload.sub]);
    if (!rows[0] || !rows[0].is_active) return res.status(401).json({ error: 'الحساب غير متاح' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة الدخول غير صالحة أو انتهت' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next() : res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء' });
}

export function canAccessClass(req, res, next) {
  const classId = req.params.classId || req.body.class_id || req.query.class_id;
  if (!classId) return res.status(400).json({ error: 'يجب تحديد الفصل' });
  if (req.user.role === 'admin' || req.user.role === 'service_manager') return next();
  if (req.user.role === 'class_servant' && req.user.class_id === classId) return next();
  return res.status(403).json({ error: 'لا يمكنك الوصول إلى بيانات هذا الفصل' });
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '8h', issuer: 'service-management' });
}
