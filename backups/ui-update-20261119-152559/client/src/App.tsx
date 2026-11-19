import { useEffect, useState } from 'react';
import {
  BookOpen, Users, ShieldCheck, LogOut, Wifi, WifiOff, CalendarDays,
  UserPlus, Search, Sparkles, ChevronDown, HeartHandshake, Save, X
} from 'lucide-react';
import { api, clearSession, saveSession, type User } from './api';

type ClassItem = { id: string; name: string; sort_order: number };
type Child = { id: string; full_name: string; birth_date: string | null; guardian_name: string | null; guardian_phone?: string | null; school_name?: string | null; mother_phone?: string | null; father_phone?: string | null; child_phone?: string | null; address_building?: string | null; address_street?: string | null; address_floor?: string | null; address_apartment?: string | null; notes?: string | null };
type ChildDraft = { full_name:string; birth_date:string; guardian_name:string; guardian_phone:string; address_building:string; address_street:string; address_floor:string; address_apartment:string; school_name:string; mother_phone:string; father_phone:string; child_phone:string; notes:string };
const emptyDraft: ChildDraft = { full_name:'',birth_date:'',guardian_name:'',guardian_phone:'',address_building:'',address_street:'',address_floor:'',address_apartment:'',school_name:'',mother_phone:'',father_phone:'',child_phone:'',notes:'' };
const roleNames = { admin: 'مدير النظام', service_manager: 'مسؤول الخدمة', class_servant: 'خادم فصل' };

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('service_user') || 'null'); } catch { return null; }
  });
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selected, setSelected] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [draft, setDraft] = useState<ChildDraft>(emptyDraft);
  const [showChildForm, setShowChildForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'children'|'attendance'>('children');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0,10));
  const [attendance, setAttendance] = useState<Record<string,{status:string;followup_status:string;followup_notes:string}>>({});
  const [search, setSearch] = useState('');
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (user) api<{ classes: ClassItem[] }>('/classes').then(r => {
      setClasses(r.classes);
      setSelected(user.class_id || r.classes[0]?.id || '');
    }).catch(e => setError(e.message));
  }, [user]);

  useEffect(() => {
    if (user && selected) api<{ children: Child[] }>(`/children/${selected}`)
      .then(r => setChildren(r.children)).catch(e => setError(e.message));
  }, [user, selected]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ identifier, password })
      });
      saveSession(r.token, r.user); setUser(r.user); setPassword('');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  function logout() {
    clearSession(); setUser(null); setClasses([]); setChildren([]); setSelected('');
  }

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !draft.full_name.trim()) return;
    try {
      await api('/children', { method: 'POST', body: JSON.stringify({ ...draft, class_id: selected, birth_date: draft.birth_date || null }) });
      setDraft(emptyDraft); setShowChildForm(false);
      const r = await api<{ children: Child[] }>(`/children/${selected}`); setChildren(r.children);
    } catch (e) { setError((e as Error).message); }
  }

  async function loadAttendance() {
    if (!selected) return;
    try {
      const r = await api<{attendance:Array<{child_id:string;status:string;followup_status:string;followup_notes:string|null}>}>(`/attendance/${selected}?date=${attendanceDate}`);
      const next: typeof attendance = {};
      r.attendance.forEach(a => { next[a.child_id] = { status:a.status, followup_status:a.followup_status || 'not_needed', followup_notes:a.followup_notes || '' }; });
      setAttendance(next);
    } catch(e) { setError((e as Error).message); }
  }

  async function saveAttendance(child: Child) {
    const row = attendance[child.id] || {status:'present',followup_status:'not_needed',followup_notes:''};
    try {
      await api('/attendance', {method:'POST',body:JSON.stringify({child_id:child.id,class_id:selected,attendance_date:attendanceDate,...row})});
      setError('');
    } catch(e) { setError((e as Error).message); }
  }


  const selectedClass = classes.find(c => c.id === selected);
  const filteredChildren = children.filter(c => c.full_name.includes(search.trim()));
  useEffect(() => { if (user && selected && activeTab === 'attendance') loadAttendance(); }, [user, selected, activeTab, attendanceDate]);

  if (!user) return (
    <main className="login-page">
      <div className="login-art" aria-hidden="true">
        <img className="login-saint" src="/saint-mina.jpg" alt="" />
        <div className="art-shade" />
        <div className="login-art-copy"><span>خدمة بمحبة وأمانة</span><h2>«دعوا الأولاد يأتون إليّ»</h2><p>نظام متابعة وتنظيم خدمة الفصول</p></div>
      </div>
      <section className="login-side">
        <div className="login-brand">
          <img src="/logo-mark.png" alt="شعار مارمرقس" />
          <div><span>خدمة مارمرقس</span><h1>إدارة الخدمة</h1><p>نظام متابعة الفصول والمخدومين</p></div>
        </div>
        <form className="login-form" onSubmit={login}>
          <div className="form-heading"><span className="eyebrow">مرحبًا بعودتك</span><h2>تسجيل الدخول</h2><p>سجّل دخولك لمتابعة أعمال الخدمة</p></div>
          <label htmlFor="identifier">البريد الإلكتروني أو رقم الهاتف</label>
          <input id="identifier" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
          <label htmlFor="password">كلمة المرور</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button className="primary-button" disabled={busy}>{busy ? 'جارٍ الدخول...' : 'دخول إلى حسابي'}</button>
          {error && <p className="error">{error}</p>}
        </form>
        <div className="login-foot"><ShieldCheck size={16} /> بيانات الخدمة محفوظة وفق صلاحيات حسابك</div>
      </section>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="side-brand">
          <img src="/logo-mark.png" alt="" />
          <div><b>إدارة الخدمة</b><small>خدمة مارمرقس</small></div>
        </div>
        <div className="side-caption">القائمة الرئيسية</div>
        <nav>
          <a className={activeTab === 'children' ? 'active' : ''} onClick={() => setActiveTab('children')}><Users size={18} /> بيانات المخدومين</a>
          <a className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}><CalendarDays size={18} /> الحضور والافتقاد</a>
          {user.role === 'admin' && <a><ShieldCheck size={18} /> إدارة المستخدمين</a>}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card"><div className="avatar">{user.full_name.slice(0, 1)}</div><div><b>{user.full_name}</b><small>{roleNames[user.role]}</small></div></div>
          <button className="logout" onClick={logout}><LogOut size={17} /> تسجيل الخروج</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><span className="eyebrow">أهلًا بك في خدمة مارمرقس</span><h1>لوحة المتابعة</h1><p>معًا ننظم خدمتنا ونتابع أبناءنا بمحبة</p></div>
          <span className={online ? 'connection online' : 'connection offline'}>{online ? <Wifi size={16} /> : <WifiOff size={16} />}{online ? 'متصل' : 'غير متصل'}</span>
        </header>

        <section className="welcome-banner">
          <div className="welcome-copy"><span><Sparkles size={15} /> خدمة بمحبة</span><h2>«كونوا رعاة لرعية الله»</h2><p>كل مخدوم أمانة، وكل متابعة تصنع فرقًا.</p></div>
          <img src="/saint-mina.jpg" alt="صورة القديس مارمينا" />
          <div className="welcome-seal"><HeartHandshake size={23}/><span>محبة · متابعة · أمانة</span></div>
        </section>

        <section className="stats">
          <article><div className="stat-icon"><Users /></div><span>المخدومون في الفصل</span><strong>{children.length}</strong><small>إجمالي المسجلين حاليًا</small></article>
          <article><div className="stat-icon"><BookOpen /></div><span>الفصل الحالي</span><strong className="stat-class">{selectedClass?.name || '—'}</strong><small>الفصل المحدد للمتابعة</small></article>
          <article><div className="stat-icon"><ShieldCheck /></div><span>صلاحية الحساب</span><strong className="stat-role">{roleNames[user.role]}</strong><small>وصول حسب دورك في الخدمة</small></article>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">{activeTab === 'children' ? 'سجل المخدومين' : 'المتابعة الدورية'}</span><h2>{activeTab === 'children' ? 'بيانات المخدومين' : 'الحضور والافتقاد'}</h2><p>{activeTab === 'children' ? 'ملف متكامل لكل مخدوم وفق كشف الخدمة' : 'سجّل الحضور وتابع حالات الافتقاد لكل مخدوم'}</p></div>
            {user.role !== 'class_servant' && <label className="class-select"><span>الفصل</span><select value={selected} onChange={e => setSelected(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={15}/></label>}
            {user.role === 'class_servant' && <span className="class-pill">{user.class_name || selectedClass?.name || 'فصلك'}</span>}
          </div>
          {activeTab === 'children' ? <>
            <div className="panel-actions"><div className="table-title">قائمة المخدومين <span>{filteredChildren.length}</span></div><button className="primary-button" onClick={() => setShowChildForm(v => !v)}><UserPlus size={17}/>{showChildForm ? 'إغلاق النموذج' : 'إضافة مخدوم'}</button></div>
            {showChildForm && <form className="child-profile-form" onSubmit={addChild}>
              <h3>البيانات الأساسية</h3><div className="form-grid">
                <label>اسم المخدوم<input value={draft.full_name} onChange={e=>setDraft({...draft,full_name:e.target.value})} required/></label>
                <label>تاريخ الميلاد<input type="date" value={draft.birth_date} onChange={e=>setDraft({...draft,birth_date:e.target.value})}/></label>
                <label>المدرسة<input value={draft.school_name} onChange={e=>setDraft({...draft,school_name:e.target.value})}/></label>
                <label>اسم ولي الأمر<input value={draft.guardian_name} onChange={e=>setDraft({...draft,guardian_name:e.target.value})}/></label>
                <label>رقم موبايل الأم<input inputMode="tel" value={draft.mother_phone} onChange={e=>setDraft({...draft,mother_phone:e.target.value})}/></label>
                <label>رقم موبايل الأب<input inputMode="tel" value={draft.father_phone} onChange={e=>setDraft({...draft,father_phone:e.target.value})}/></label>
                <label>رقم موبايل المخدوم<input inputMode="tel" value={draft.child_phone} onChange={e=>setDraft({...draft,child_phone:e.target.value})}/></label>
                <label>رقم تواصل إضافي<input inputMode="tel" value={draft.guardian_phone} onChange={e=>setDraft({...draft,guardian_phone:e.target.value})}/></label>
              </div>
              <h3>العنوان</h3><div className="form-grid address-grid">
                <label>رقم العقار<input value={draft.address_building} onChange={e=>setDraft({...draft,address_building:e.target.value})}/></label>
                <label>الشارع<input value={draft.address_street} onChange={e=>setDraft({...draft,address_street:e.target.value})}/></label>
                <label>الدور<input value={draft.address_floor} onChange={e=>setDraft({...draft,address_floor:e.target.value})}/></label>
                <label>الشقة<input value={draft.address_apartment} onChange={e=>setDraft({...draft,address_apartment:e.target.value})}/></label>
              </div>
              <label className="wide-label">ملاحظات الخدمة<textarea rows={3} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
              <div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowChildForm(false)}><X size={16}/> إلغاء</button><button className="primary-button"><Save size={16}/> حفظ بيانات المخدوم</button></div>
            </form>}
            <div className="table-toolbar"><label className="search-box"><Search size={16}/><input placeholder="ابحث بالاسم..." value={search} onChange={e => setSearch(e.target.value)} /></label></div>
            <div className="table-wrap"><table><thead><tr><th>اسم المخدوم</th><th>تاريخ الميلاد</th><th>المدرسة</th><th>ولي الأمر</th><th>موبايل الأم</th></tr></thead><tbody>
              {filteredChildren.map(c => <tr key={c.id}><td><span className="child-avatar">{c.full_name.slice(0, 1)}</span><b>{c.full_name}</b></td><td>{c.birth_date || '—'}</td><td>{c.school_name || '—'}</td><td>{c.guardian_name || '—'}</td><td>{c.mother_phone || '—'}</td></tr>)}
              {!filteredChildren.length && <tr><td colSpan={5} className="empty">{search ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد بيانات مسجلة في هذا الفصل حتى الآن'}</td></tr>}
            </tbody></table></div>
          </> : <>
            <div className="attendance-toolbar"><label>تاريخ الاجتماع<input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)}/></label><span>{children.length} مخدوم</span></div>
            <div className="attendance-list">{children.map(child => { const row=attendance[child.id] || {status:'present',followup_status:'not_needed',followup_notes:''}; return <article className="attendance-row" key={child.id}><b>{child.full_name}</b><label>الحضور<select value={row.status} onChange={e=>setAttendance({...attendance,[child.id]:{...row,status:e.target.value}})}><option value="present">حاضر</option><option value="absent">غائب</option><option value="excused">اعتذار</option></select></label><label>الافتقاد<select value={row.followup_status} onChange={e=>setAttendance({...attendance,[child.id]:{...row,followup_status:e.target.value}})}><option value="not_needed">لا يحتاج</option><option value="pending">مطلوب افتقاد</option><option value="contacted">تم التواصل</option><option value="completed">اكتملت المتابعة</option></select></label><input aria-label="ملاحظات الافتقاد" placeholder="ملاحظات الافتقاد" value={row.followup_notes} onChange={e=>setAttendance({...attendance,[child.id]:{...row,followup_notes:e.target.value}})}/><button className="primary-button compact" onClick={()=>saveAttendance(child)}><Save size={15}/> حفظ</button></article>; })}{!children.length && <p className="empty">لا يوجد مخدومون في هذا الفصل.</p>}</div>
          </>}
          {error && <p className="error">{error}</p>}
        </section>
        <footer><img src="/logo-mark.png" alt="" /> <span>خدمة مارمرقس · نظام إدارة ومتابعة الخدمة</span><span className="footer-note">نسخة اختبار محلية</span></footer>
      </main>
    </div>
  );
}
