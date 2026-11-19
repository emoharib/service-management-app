import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { authenticate, allowRoles, canAccessClass, signToken } from './auth.js';

const router = Router();
router.post('/auth/login', async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!identifier || !password) return res.status(400).json({ error: 'أدخل اسم المستخدم وكلمة المرور' });
    const { rows } = await pool.query('SELECT * FROM app_users WHERE lower(coalesce(email, phone))=$1 OR phone=$2 LIMIT 1', [identifier, identifier]);
    const user = rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'بيانات تسجيل الدخول غير صحيحة' });
    const { rows: profile } = await pool.query(
      `SELECT u.id,u.full_name,u.email,u.phone,u.role,u.can_record_attendance,a.class_id,c.name AS class_name
       FROM app_users u LEFT JOIN user_class_assignments a ON a.user_id=u.id
       LEFT JOIN service_classes c ON c.id=a.class_id WHERE u.id=$1`, [user.id]);
    res.json({ token: signToken(user), user: profile[0] });
  } catch (e) { next(e); }
});

router.get('/auth/me', authenticate, (req, res) => res.json({ user: req.user }));
router.get('/classes', authenticate, async (req, res, next) => {
  try {
    const sql = req.user.role === 'class_servant'
      ? 'SELECT id,name,sort_order FROM service_classes WHERE id=$1 AND is_active=true ORDER BY sort_order'
      : 'SELECT id,name,sort_order FROM service_classes WHERE is_active=true ORDER BY sort_order';
    const args = req.user.role === 'class_servant' ? [req.user.class_id] : [];
    const { rows } = await pool.query(sql, args); res.json({ classes: rows });
  } catch (e) { next(e); }
});

router.get('/children/:classId', authenticate, canAccessClass, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,class_id,full_name,birth_date,guardian_name,guardian_phone,notes,address_building,address_street,address_floor,address_apartment,school_name,mother_phone,father_phone,child_phone,photo_path,responsible_servant_id,created_at,updated_at
       FROM children WHERE class_id=$1 ORDER BY full_name`, [req.params.classId]);
    res.json({ children: rows });
  } catch (e) { next(e); }
});
router.post('/children', authenticate, allowRoles('admin','service_manager','class_servant'), async (req, res, next) => {
  try {
    const { class_id, full_name, birth_date, guardian_name, guardian_phone, notes, address_building, address_street, address_floor, address_apartment, school_name, mother_phone, father_phone, child_phone, responsible_servant_id } = req.body;
    if (!class_id || !String(full_name || '').trim()) return res.status(400).json({ error: 'الفصل واسم الطفل مطلوبان' });
    if (req.user.role === 'class_servant' && req.user.class_id !== class_id) return res.status(403).json({ error: 'لا يمكنك إضافة طفل خارج فصلك' });

    if (responsible_servant_id) {
      const servantCheck = await pool.query(
        `SELECT u.id
         FROM app_users u
         JOIN user_class_assignments a ON a.user_id = u.id
         WHERE u.id::text = $1
           AND a.class_id = $2
           AND u.role = 'class_servant'
           AND u.is_active = TRUE
         LIMIT 1`,
        [String(responsible_servant_id), class_id]
      );

      if (!servantCheck.rows[0]) {
        return res.status(400).json({
          error: '\u0627\u0644\u062e\u0627\u062f\u0645 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0623\u0648 \u063a\u064a\u0631 \u0645\u0639\u064a\u0651\u0646 \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0635\u0644'
        });
      }
    }
    const { rows } = await pool.query(
      `INSERT INTO children(class_id,full_name,birth_date,guardian_name,guardian_phone,notes,created_by,address_building,address_street,address_floor,address_apartment,school_name,mother_phone,father_phone,child_phone,responsible_servant_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [class_id, String(full_name).trim(), birth_date || null, guardian_name || null, guardian_phone || null, notes || null, req.user.id, address_building || null, address_street || null, address_floor || null, address_apartment || null, school_name || null, mother_phone || null, father_phone || null, child_phone || null, responsible_servant_id || null]);
    res.status(201).json({ child: rows[0] });
  } catch (e) { next(e); }
});
router.post('/attendance', authenticate, allowRoles('admin','service_manager','class_servant'), async (req, res, next) => {
  try {
    const { child_id, class_id, attendance_date, status, followup_status='not_needed', followup_notes=null, followup_date=null } = req.body;
    if (req.user.role === 'class_servant' && (!req.user.can_record_attendance || req.user.class_id !== class_id))
      return res.status(403).json({ error: 'غير مصرح لك بتسجيل الحضور لهذا الفصل' });
    if (!['admin','service_manager','class_servant'].includes(req.user.role)) return res.sendStatus(403);
    if (!child_id || !class_id || !attendance_date || !['present','absent','excused'].includes(status) || !['not_needed','pending','contacted','completed'].includes(followup_status))
      return res.status(400).json({ error: 'بيانات الحضور غير مكتملة' });
    const { rows: child } = await pool.query('SELECT id FROM children WHERE id=$1 AND class_id=$2', [child_id, class_id]);
    if (!child[0]) return res.status(404).json({ error: 'الطفل غير موجود في الفصل المحدد' });
    const { rows } = await pool.query(
      `INSERT INTO attendance(child_id,class_id,attendance_date,status,recorded_by,followup_status,followup_notes,followup_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(child_id,attendance_date) DO UPDATE SET status=EXCLUDED.status,recorded_by=EXCLUDED.recorded_by,followup_status=EXCLUDED.followup_status,followup_notes=EXCLUDED.followup_notes,followup_date=EXCLUDED.followup_date
       RETURNING *`, [child_id,class_id,attendance_date,status,req.user.id,followup_status,followup_notes,followup_date]);
    res.status(201).json({ attendance: rows[0] });
  } catch (e) { next(e); }
});
router.get('/attendance/:classId', authenticate, canAccessClass, async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0,10);
    const { rows } = await pool.query(
      `SELECT a.*,ch.full_name FROM attendance a JOIN children ch ON ch.id=a.child_id
       WHERE a.class_id=$1 AND a.attendance_date=$2 ORDER BY ch.full_name`, [req.params.classId,date]);
    res.json({ attendance: rows });
  } catch (e) { next(e); }
});

router.get('/admin/users', authenticate, allowRoles('admin'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id,u.full_name,u.email,u.phone,u.role,u.can_record_attendance,u.is_active,a.class_id,c.name AS class_name
       FROM app_users u LEFT JOIN user_class_assignments a ON a.user_id=u.id LEFT JOIN service_classes c ON c.id=a.class_id ORDER BY u.created_at DESC`);
    res.json({ users: rows });
  } catch (e) { next(e); }
});
router.post('/admin/users', authenticate, allowRoles('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { full_name,email,phone,password,role,class_id,can_record_attendance=false } = req.body;
    if (!full_name || !password || password.length < 10 || !['admin','service_manager','class_servant'].includes(role))
      return res.status(400).json({ error: 'أدخل الاسم وكلمة مرور 10 أحرف على الأقل ودورًا صحيحًا' });
    if (role === 'class_servant' && !class_id) return res.status(400).json({ error: 'يجب ربط خادم الفصل بفصل واحد' });
    if (!email && !phone) return res.status(400).json({ error: 'أدخل البريد الإلكتروني أو الهاتف' });
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await client.query(
      `INSERT INTO app_users(full_name,email,phone,password_hash,role,can_record_attendance)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id,full_name,email,phone,role,can_record_attendance,is_active`,
      [full_name.trim(),email || null,phone || null,hash,role,role==='class_servant' && Boolean(can_record_attendance)]);
    if (role === 'class_servant') await client.query('INSERT INTO user_class_assignments(user_id,class_id) VALUES($1,$2)',[rows[0].id,class_id]);
    await client.query('COMMIT'); res.status(201).json({ user: rows[0] });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});
router.patch('/admin/users/:id/status', authenticate, allowRoles('admin'), async (req,res,next) => {
  try {
    if (typeof req.body.is_active !== 'boolean')
      return res.status(400).json({ error: 'قيمة حالة الحساب غير صحيحة' });
    if (req.params.id === req.user.id && req.body.is_active === false)
      return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الحالي' });
    const { rows } = await pool.query(
      'UPDATE app_users SET is_active=$1 WHERE id=$2 RETURNING id,is_active',
      [req.body.is_active,req.params.id]
    );
    if (!rows[0]) return res.sendStatus(404);
    res.json({ user: rows[0] });
  } catch(e) { next(e); }
});

// SAFE_SERVICE_EXTENSIONS_V1

// تعديل ملف مخدوم
router.patch('/children/:id', authenticate, allowRoles('admin','service_manager','class_servant'), async (req,res,next) => {
  try {
    const current = await pool.query(
      'SELECT id,class_id FROM children WHERE id=$1',
      [req.params.id]
    );
    if (!current.rows[0]) return res.sendStatus(404);

    const classId = current.rows[0].class_id;
    if (req.user.role === 'class_servant' && req.user.class_id !== classId)
      return res.status(403).json({ error: 'لا يمكنك تعديل بيانات خارج فصلك' });

    const allowed = [
      'full_name','birth_date','guardian_name','guardian_phone','notes',
      'address_building','address_street','address_floor','address_apartment',
      'school_name','mother_phone','father_phone','child_phone',
      'responsible_servant_id'
    ];

    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(req.body,key)) continue;
      let value = req.body[key];
      if (key === 'full_name') {
        value = String(value || '').trim();
        if (!value) return res.status(400).json({ error: 'اسم المخدوم مطلوب' });
      }
      if (key === 'responsible_servant_id' && value) {
        const valid = await pool.query(
          `SELECT 1 FROM app_users u
           JOIN user_class_assignments a ON a.user_id=u.id
           WHERE u.id=$1 AND a.class_id=$2
             AND u.role='class_servant' AND u.is_active=true`,
          [value,classId]
        );
        if (!valid.rows[0])
          return res.status(400).json({ error: 'الخادم المسؤول غير صالح لهذا الفصل' });
      }
      values.push(value === '' ? null : value);
      updates.push(`${key}=$${values.length}`);
    }

    if (!updates.length)
      return res.status(400).json({ error: 'لا توجد بيانات لتعديلها' });

    updates.push('updated_at=NOW()');
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE children SET ${updates.join(',')}
       WHERE id=$${values.length} RETURNING *`,
      values
    );
    res.json({ child: result.rows[0] });
  } catch(e) { next(e); }
});

// تقرير الحضور والافتقاد لفصل خلال فترة
router.get('/reports/:classId', authenticate, canAccessClass, async (req,res,next) => {
  try {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');

    const validDate = value =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value + 'T00:00:00Z'));

    if (!validDate(from) || !validDate(to) || from > to)
      return res.status(400).json({ error: 'حدد فترة زمنية صحيحة للتقرير' });

    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT ch.id)::int AS children_count,
         COUNT(a.id)::int AS recorded_count,
         COUNT(a.id) FILTER (WHERE a.status='present')::int AS present_count,
         COUNT(a.id) FILTER (WHERE a.status='absent')::int AS absent_count,
         COUNT(a.id) FILTER (WHERE a.status='excused')::int AS excused_count,
         COUNT(a.id) FILTER (WHERE a.followup_status='pending')::int AS pending_followup_count,
         COUNT(a.id) FILTER (WHERE a.followup_status='contacted')::int AS contacted_count,
         COUNT(a.id) FILTER (WHERE a.followup_status='completed')::int AS completed_followup_count
       FROM children ch
       LEFT JOIN attendance a
         ON a.child_id=ch.id
        AND a.attendance_date BETWEEN $2 AND $3
       WHERE ch.class_id=$1`,
      [req.params.classId,from,to]
    );

    const daily = await pool.query(
      `SELECT attendance_date,
         COUNT(*)::int AS recorded_count,
         COUNT(*) FILTER (WHERE status='present')::int AS present_count,
         COUNT(*) FILTER (WHERE status='absent')::int AS absent_count,
         COUNT(*) FILTER (WHERE status='excused')::int AS excused_count
       FROM attendance
       WHERE class_id=$1 AND attendance_date BETWEEN $2 AND $3
       GROUP BY attendance_date
       ORDER BY attendance_date`,
      [req.params.classId,from,to]
    );

    res.json({ summary: result.rows[0], daily: daily.rows, from, to });
  } catch(e) { next(e); }
});

// قائمة الفصول الإدارية
router.get('/admin/classes', authenticate, allowRoles('admin'), async (_req,res,next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id,c.name,c.sort_order,c.is_active,
         COUNT(ch.id)::int AS children_count
       FROM service_classes c
       LEFT JOIN children ch ON ch.class_id=c.id
       GROUP BY c.id
       ORDER BY c.sort_order,c.name`
    );
    res.json({ classes: rows });
  } catch(e) { next(e); }
});

// إضافة فصل
router.post('/admin/classes', authenticate, allowRoles('admin'), async (req,res,next) => {
  try {
    const name = String(req.body.name || '').trim();
    const sortOrder = Number(req.body.sort_order ?? 0);
    if (!name || name.length > 120 || !Number.isInteger(sortOrder))
      return res.status(400).json({ error: 'اسم الفصل وترتيبه غير صحيحين' });

    const { rows } = await pool.query(
      `INSERT INTO service_classes(name,sort_order)
       VALUES($1,$2) RETURNING id,name,sort_order,is_active`,
      [name,sortOrder]
    );
    res.status(201).json({ class: rows[0] });
  } catch(e) { next(e); }
});

// تعديل اسم الفصل أو ترتيبه أو حالته
router.patch('/admin/classes/:id', authenticate, allowRoles('admin'), async (req,res,next) => {
  try {
    const allowed = ['name','sort_order','is_active'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(req.body,key)) continue;
      let value = req.body[key];

      if (key === 'name') {
        value = String(value || '').trim();
        if (!value || value.length > 120)
          return res.status(400).json({ error: 'اسم الفصل غير صحيح' });
      }
      if (key === 'sort_order' && !Number.isInteger(value))
        return res.status(400).json({ error: 'ترتيب الفصل غير صحيح' });
      if (key === 'is_active' && typeof value !== 'boolean')
        return res.status(400).json({ error: 'حالة الفصل غير صحيحة' });

      values.push(value);
      updates.push(`${key}=$${values.length}`);
    }

    if (!updates.length)
      return res.status(400).json({ error: 'لا توجد بيانات لتعديلها' });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE service_classes SET ${updates.join(',')}
       WHERE id=$${values.length}
       RETURNING id,name,sort_order,is_active`,
      values
    );
    if (!rows[0]) return res.sendStatus(404);
    res.json({ class: rows[0] });
  } catch(e) { next(e); }
});
// Sync endpoint is intentionally a guarded placeholder; offline events are not applied until conflict rules are tested.
router.post('/sync', authenticate, (req,res) => res.status(501).json({
  error: 'المزامنة لم تُفعّل بعد. لن يتم إرسال أو تعديل بيانات قبل اكتمال قواعد التعارض والتحقق من الصلاحيات.',
  accepted: false
}));
export default router;
