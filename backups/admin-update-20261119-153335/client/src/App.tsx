import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Users, ShieldCheck, LogOut, Wifi, WifiOff, CalendarDays,
  UserPlus, Search, Sparkles, ChevronDown, HeartHandshake, Save, X,
  Pencil, Printer, Download, BarChart3, GraduationCap, UserCog, Plus, RefreshCw
} from 'lucide-react';
import { api, clearSession, saveSession, type User } from './api';

type ClassItem = { id:string; name:string; sort_order:number; is_active?:boolean; children_count?:number };
type Child = {
  id:string; class_id:string; full_name:string; birth_date:string|null; guardian_name:string|null;
  guardian_phone:string|null; school_name:string|null; mother_phone:string|null; father_phone:string|null;
  child_phone:string|null; address_building:string|null; address_street:string|null; address_floor:string|null;
  address_apartment:string|null; notes:string|null;
};
type ChildDraft = Omit<Child,'id'|'class_id'>;
type Tab = 'dashboard'|'children'|'attendance'|'reports'|'classes'|'users';
type UserRow = {id:string;full_name:string;email:string|null;phone:string|null;role:User['role'];can_record_attendance:boolean;is_active:boolean;class_id:string|null;class_name:string|null};
type ReportRow = {child_id:string;full_name:string;guardian_name:string|null;guardian_phone:string|null;recorded_count:number;present_count:number;absent_count:number;excused_count:number;followup_count:number;completed_followups:number};
type ReportData = {totals:{children:number;recorded:number;present:number;absent:number;excused:number;followups:number;completed:number};rows:ReportRow[]};
const emptyDraft:ChildDraft = {full_name:'',birth_date:null,guardian_name:'',guardian_phone:'',school_name:'',mother_phone:'',father_phone:'',child_phone:'',address_building:'',address_street:'',address_floor:'',address_apartment:'',notes:''};
const roleNames:Record<User['role'],string> = {admin:'مدير النظام',service_manager:'مسؤول الخدمة',class_servant:'خادم فصل'};
const tabNames:Record<Tab,string> = {dashboard:'لوحة المتابعة',children:'المخدومون',attendance:'الحضور والافتقاد',reports:'التقارير',classes:'إدارة الفصول',users:'إدارة المستخدمين'};
const csvCell = (v:unknown) => `"${String(v ?? '').replace(/"/g,'""')}"`;

export default function App() {
  const [user,setUser] = useState<User|null>(() => {
    try { return JSON.parse(sessionStorage.getItem('service_user') || 'null'); } catch { return null; }
  });
  const [identifier,setIdentifier] = useState('');
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [classes,setClasses] = useState<ClassItem[]>([]);
  const [selected,setSelected] = useState('');
  const [children,setChildren] = useState<Child[]>([]);
  const [activeTab,setActiveTab] = useState<Tab>('dashboard');
  const [search,setSearch] = useState('');
  const [online,setOnline] = useState(navigator.onLine);
  const [childDraft,setChildDraft] = useState<ChildDraft>(emptyDraft);
  const [editingChild,setEditingChild] = useState<string|null>(null);
  const [showChildForm,setShowChildForm] = useState(false);
  const [attendanceDate,setAttendanceDate] = useState(new Date().toISOString().slice(0,10));
  const [attendance,setAttendance] = useState<Record<string,{status:string;followup_status:string;followup_notes:string}>>({});
  const [reportFrom,setReportFrom] = useState('');
  const [reportTo,setReportTo] = useState('');
  const [report,setReport] = useState<ReportData|null>(null);
  const [users,setUsers] = useState<UserRow[]>([]);
  const [userDraft,setUserDraft] = useState({full_name:'',email:'',phone:'',password:'',role:'class_servant' as User['role'],class_id:'',can_record_attendance:true});
  const [classDraft,setClassDraft] = useState({name:'',sort_order:0});
  const [editingClass,setEditingClass] = useState<string|null>(null);

  const isAdmin = user?.role === 'admin';
  const canManageChildren = user?.role !== 'class_servant' || Boolean(user.class_id);
  const selectedClass = classes.find(c=>c.id===selected);
  const filteredChildren = useMemo(()=>children.filter(c=>c.full_name.includes(search.trim())),[children,search]);

  const refreshChildren = useCallback(async (classId:string) => {
    if (!classId) return;
    const r = await api<{children:Child[]}>(`/children/${classId}`);
    setChildren(r.children);
  },[]);
  const refreshAdmin = useCallback(async () => {
    if (!isAdmin) return;
    const [u,c] = await Promise.all([
      api<{users:UserRow[]}>('/admin/users'),
      api<{classes:ClassItem[]}>('/admin/classes')
    ]);
    setUsers(u.users); setClasses(c.classes);
  },[isAdmin]);

  useEffect(()=>{
    const on=()=>setOnline(true),off=()=>setOnline(false);
    window.addEventListener('online',on);window.addEventListener('offline',off);
    return ()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};
  },[]);
  useEffect(()=>{
    if (!user) return;
    api<{classes:ClassItem[]}>('/classes').then(r=>{
      setClasses(r.classes); setSelected(user.class_id || r.classes[0]?.id || '');
    }).catch(e=>setError(e.message));
  },[user]);
  useEffect(()=>{
    if (user && selected) refreshChildren(selected).catch(e=>setError(e.message));
  },[user,selected,refreshChildren]);
  useEffect(()=>{
    if (isAdmin) refreshAdmin().catch(e=>setError(e.message));
  },[isAdmin,refreshAdmin]);
  useEffect(()=>{
    if (!user || !selected || activeTab!=='attendance') return;
    api<{attendance:Array<{child_id:string;status:string;followup_status:string;followup_notes:string|null}>}>(`/attendance/${selected}?date=${attendanceDate}`)
      .then(r=>{const next:typeof attendance={};r.attendance.forEach(a=>{next[a.child_id]={status:a.status,followup_status:a.followup_status||'not_needed',followup_notes:a.followup_notes||''};});setAttendance(next);})
      .catch(e=>setError(e.message));
  },[user,selected,activeTab,attendanceDate]);

  async function login(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {const r=await api<{token:string;user:User}>('/auth/login',{method:'POST',body:JSON.stringify({identifier,password})});saveSession(r.token,r.user);setUser(r.user);setPassword('');}
    catch(e){setError((e as Error).message);} finally{setBusy(false);}
  }
  function logout(){clearSession();setUser(null);setClasses([]);setChildren([]);setSelected('');setActiveTab('dashboard');}
  function openNewChild(){setEditingChild(null);setChildDraft(emptyDraft);setShowChildForm(true);setError('');}
  function openEditChild(c:Child){setEditingChild(c.id);setChildDraft({...emptyDraft,...c,birth_date:c.birth_date?.slice(0,10)||''});setShowChildForm(true);setError('');}
  async function saveChild(e:React.FormEvent){
    e.preventDefault();if(!selected||!childDraft.full_name?.trim())return;
    setBusy(true);setError('');
    try{
      const payload={...childDraft,birth_date:childDraft.birth_date||null};
      if(editingChild) await api(`/children/${editingChild}`,{method:'PATCH',body:JSON.stringify(payload)});
      else await api('/children',{method:'POST',body:JSON.stringify({...payload,class_id:selected})});
      setShowChildForm(false);setEditingChild(null);setChildDraft(emptyDraft);await refreshChildren(selected);
      setNotice(editingChild?'تم تحديث ملف المخدوم بنجاح':'تمت إضافة المخدوم بنجاح');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function saveAttendance(child:Child){
    const row=attendance[child.id]||{status:'present',followup_status:'not_needed',followup_notes:''};
    try{await api('/attendance',{method:'POST',body:JSON.stringify({child_id:child.id,class_id:selected,attendance_date:attendanceDate,...row})});setNotice(`تم حفظ متابعة ${child.full_name}`);setError('');}
    catch(e){setError((e as Error).message);}
  }
  async function loadReport(){
    if(!selected)return;
    const qs=new URLSearchParams();if(reportFrom)qs.set('from',reportFrom);if(reportTo)qs.set('to',reportTo);
    try{const r=await api<ReportData>(`/reports/${selected}?${qs.toString()}`);setReport(r);setError('');}
    catch(e){setError((e as Error).message);}
  }
  function exportReport(){
    if(!report)return;
    const rows=[['اسم المخدوم','ولي الأمر','هاتف ولي الأمر','مرات التسجيل','حاضر','غائب','اعتذار','حالات الافتقاد','افتقاد مكتمل'],
      ...report.rows.map(r=>[r.full_name,r.guardian_name,r.guardian_phone,r.recorded_count,r.present_count,r.absent_count,r.excused_count,r.followup_count,r.completed_followups])];
    const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a');a.href=url;a.download=`تقرير-${selectedClass?.name||'الفصل'}.csv`;a.click();URL.revokeObjectURL(url);
  }
  function printReport(){window.print();}
  async function saveClass(e:React.FormEvent){
    e.preventDefault();setError('');
    try{
      if(editingClass)await api(`/admin/classes/${editingClass}`,{method:'PATCH',body:JSON.stringify(classDraft)});
      else await api('/admin/classes',{method:'POST',body:JSON.stringify(classDraft)});
      setClassDraft({name:'',sort_order:0});setEditingClass(null);await refreshAdmin();
      const r=await api<{classes:ClassItem[]}>('/classes');setClasses(r.classes);
      setNotice('تم حفظ بيانات الفصل');
    }catch(e){setError((e as Error).message);}
  }
  async function toggleClass(c:ClassItem){
    try{await api(`/admin/classes/${c.id}`,{method:'PATCH',body:JSON.stringify({is_active:!c.is_active})});await refreshAdmin();const r=await api<{classes:ClassItem[]}>('/classes');setClasses(r.classes);setNotice('تم تحديث حالة الفصل');}
    catch(e){setError((e as Error).message);}
  }
  async function createUser(e:React.FormEvent){
    e.preventDefault();setError('');
    try{await api('/admin/users',{method:'POST',body:JSON.stringify(userDraft)});setUserDraft({full_name:'',email:'',phone:'',password:'',role:'class_servant',class_id:'',can_record_attendance:true});await refreshAdmin();setNotice('تم إنشاء الحساب بنجاح');}
    catch(e){setError((e as Error).message);}
  }
  async function toggleUser(u:UserRow){
    try{await api(`/admin/users/${u.id}/status`,{method:'PATCH',body:JSON.stringify({is_active:!u.is_active})});await refreshAdmin();setNotice('تم تحديث حالة الحساب');}
    catch(e){setError((e as Error).message);}
  }
  function updateAttendance(childId:string,patch:Partial<{status:string;followup_status:string;followup_notes:string}>){
    setAttendance(prev=>({ ...prev,[childId]:{...(prev[childId]||{status:'present',followup_status:'not_needed',followup_notes:''}),...patch} }));
  }

  if(!user)return <main className="login-page"><div className="login-art" aria-hidden="true"><img className="login-saint" src="/saint-mina.jpg" alt=""/><div className="art-shade"/><div className="login-art-copy"><span>خدمة بمحبة وأمانة</span><h2>«دعوا الأولاد يأتون إليّ»</h2><p>نظام متابعة وتنظيم خدمة الفصول</p></div></div><section className="login-side"><div className="login-brand"><img src="/logo-mark.png" alt="شعار مارمرقس"/><div><span>خدمة مارمرقس</span><h1>إدارة الخدمة</h1><p>نظام متابعة الفصول والمخدومين</p></div></div><form className="login-form" onSubmit={login}><div className="form-heading"><span className="eyebrow">مرحبًا بعودتك</span><h2>تسجيل الدخول</h2><p>سجّل دخولك لمتابعة أعمال الخدمة</p></div><label htmlFor="identifier">البريد الإلكتروني أو رقم الهاتف</label><input id="identifier" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required/><label htmlFor="password">كلمة المرور</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary-button" disabled={busy}>{busy?'جارٍ الدخول...':'دخول إلى حسابي'}</button>{error&&<p className="error">{error}</p>}</form><div className="login-foot"><ShieldCheck size={16}/> بيانات الخدمة محفوظة وفق صلاحيات حسابك</div></section></main>;

  const visibleTabs:Tab[]=['dashboard','children','attendance','reports',...(isAdmin?['classes','users'] as Tab[]:[])];
  return <div className="app-shell">
    <aside className="sidebar"><div className="side-brand"><img src="/logo-mark.png" alt=""/><div><b>إدارة الخدمة</b><small>خدمة مارمرقس</small></div></div><div className="side-caption">القائمة الرئيسية</div>
      <nav>{visibleTabs.map(tab=><a key={tab} className={activeTab===tab?'active':''} onClick={()=>{setActiveTab(tab);setError('');setNotice('');}}>{tab==='dashboard'?<BarChart3 size={18}/>:tab==='children'?<Users size={18}/>:tab==='attendance'?<CalendarDays size={18}/>:tab==='reports'?<BookOpen size={18}/>:tab==='classes'?<GraduationCap size={18}/>:<UserCog size={18}/>} {tabNames[tab]}</a>)}</nav>
      <div className="sidebar-bottom"><div className="user-card"><div className="avatar">{user.full_name.slice(0,1)}</div><div><b>{user.full_name}</b><small>{roleNames[user.role]}</small></div></div><button className="logout" onClick={logout}><LogOut size={17}/> تسجيل الخروج</button></div>
    </aside>
    <main className="content">
      <header className="topbar"><div><span className="eyebrow">أهلًا بك في خدمة مارمرقس</span><h1>{tabNames[activeTab]}</h1><p>معًا ننظم خدمتنا ونتابع أبناءنا بمحبة</p></div><span className={online?'connection online':'connection offline'}>{online?<Wifi size={16}/>:<WifiOff size={16}/>} {online?'متصل':'غير متصل'}</span></header>
      {activeTab==='dashboard'&&<><section className="welcome-banner"><div className="welcome-copy"><span><Sparkles size={15}/> خدمة بمحبة</span><h2>«كونوا رعاة لرعية الله»</h2><p>كل مخدوم أمانة، وكل متابعة تصنع فرقًا.</p></div><img src="/saint-mina.jpg" alt="صورة القديس مارمينا"/><div className="welcome-seal"><HeartHandshake size={23}/><span>محبة · متابعة · أمانة</span></div></section><section className="stats"><article><div className="stat-icon"><Users/></div><span>المخدومون في الفصل</span><strong>{children.length}</strong><small>إجمالي المسجلين حاليًا</small></article><article><div className="stat-icon"><BookOpen/></div><span>الفصل الحالي</span><strong className="stat-class">{selectedClass?.name||'—'}</strong><small>الفصل المحدد للمتابعة</small></article><article><div className="stat-icon"><ShieldCheck/></div><span>صلاحية الحساب</span><strong className="stat-role">{roleNames[user.role]}</strong><small>وصول حسب دورك في الخدمة</small></article></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">بداية سريعة</span><h2>متابعة الخدمة</h2><p>اختر القسم الذي تريد العمل عليه</p></div>{user.role==='class_servant'?<span className="class-pill">{user.class_name||selectedClass?.name||'فصلك'}</span>:<label className="class-select"><span>الفصل الحالي</span><select value={selected} onChange={e=>setSelected(e.target.value)}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={15}/></label>}</div><div className="quick-actions"><button className="quick-action" onClick={()=>setActiveTab('children')}><Users/> <b>ملفات المخدومين</b><small>إضافة وتعديل البيانات</small></button><button className="quick-action" onClick={()=>setActiveTab('attendance')}><CalendarDays/><b>الحضور والافتقاد</b><small>تسجيل ومتابعة الاجتماع</small></button><button className="quick-action" onClick={()=>setActiveTab('reports')}><BarChart3/><b>التقارير</b><small>عرض وطباعة وتصدير</small></button></div></section></>}
      {activeTab!=='dashboard'&&<section className="panel">
        <div className="panel-head"><div><span className="eyebrow">{tabNames[activeTab]}</span><h2>{activeTab==='children'?'ملفات المخدومين':activeTab==='attendance'?'تسجيل الحضور ومتابعة الغياب':activeTab==='reports'?'تقارير الفصل':activeTab==='classes'?'الفصول الدراسية':'حسابات المستخدمين'}</h2><p>{activeTab==='children'?'عرض وتحديث بيانات المخدومين':activeTab==='attendance'?'حدد حالة الحضور وسجل الافتقاد والتواصل':activeTab==='reports'?'إحصائيات الحضور والافتقاد خلال فترة محددة':activeTab==='classes'?'إضافة الفصول وتعديل ترتيبها وحالتها':'إنشاء الحسابات وتحديد الدور والفصل والصلاحيات'}</p></div>
          {['children','attendance','reports'].includes(activeTab)&&<>{user.role==='class_servant'?<span className="class-pill">{user.class_name||selectedClass?.name||'فصلك'}</span>:<label className="class-select"><span>الفصل</span><select value={selected} onChange={e=>{setSelected(e.target.value);setReport(null);}}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={15}/></label>}</>}
        </div>
        {activeTab==='children'&&<><div className="panel-actions"><div className="table-title">قائمة المخدومين <span>{filteredChildren.length}</span></div>{canManageChildren&&<button className="primary-button" onClick={openNewChild}><UserPlus size={17}/> إضافة مخدوم</button>}</div>
          {showChildForm&&<form className="child-profile-form" onSubmit={saveChild}><h3>{editingChild?'تعديل ملف المخدوم':'البيانات الأساسية'}</h3><div className="form-grid">
            <label>اسم المخدوم<input value={childDraft.full_name} onChange={e=>setChildDraft({...childDraft,full_name:e.target.value})} required/></label>
            <label>تاريخ الميلاد<input type="date" value={childDraft.birth_date||''} onChange={e=>setChildDraft({...childDraft,birth_date:e.target.value})}/></label>
            <label>المدرسة<input value={childDraft.school_name||''} onChange={e=>setChildDraft({...childDraft,school_name:e.target.value})}/></label>
            <label>اسم ولي الأمر<input value={childDraft.guardian_name||''} onChange={e=>setChildDraft({...childDraft,guardian_name:e.target.value})}/></label>
            <label>رقم موبايل الأم<input inputMode="tel" value={childDraft.mother_phone||''} onChange={e=>setChildDraft({...childDraft,mother_phone:e.target.value})}/></label>
            <label>رقم موبايل الأب<input inputMode="tel" value={childDraft.father_phone||''} onChange={e=>setChildDraft({...childDraft,father_phone:e.target.value})}/></label>
            <label>رقم موبايل المخدوم<input inputMode="tel" value={childDraft.child_phone||''} onChange={e=>setChildDraft({...childDraft,child_phone:e.target.value})}/></label>
            <label>رقم تواصل إضافي<input inputMode="tel" value={childDraft.guardian_phone||''} onChange={e=>setChildDraft({...childDraft,guardian_phone:e.target.value})}/></label>
          </div><h3>العنوان</h3><div className="form-grid"><label>رقم العقار<input value={childDraft.address_building||''} onChange={e=>setChildDraft({...childDraft,address_building:e.target.value})}/></label><label>الشارع<input value={childDraft.address_street||''} onChange={e=>setChildDraft({...childDraft,address_street:e.target.value})}/></label><label>الدور<input value={childDraft.address_floor||''} onChange={e=>setChildDraft({...childDraft,address_floor:e.target.value})}/></label><label>الشقة<input value={childDraft.address_apartment||''} onChange={e=>setChildDraft({...childDraft,address_apartment:e.target.value})}/></label></div><label className="wide-label">ملاحظات الخدمة<textarea rows={3} value={childDraft.notes||''} onChange={e=>setChildDraft({...childDraft,notes:e.target.value})}/></label><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowChildForm(false)}><X size={16}/> إلغاء</button><button className="primary-button" disabled={busy}><Save size={16}/> {busy?'جارٍ الحفظ...':'حفظ البيانات'}</button></div></form>}
          <div className="table-toolbar"><label className="search-box"><Search size={16}/><input placeholder="ابحث بالاسم..." value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="secondary-button" onClick={()=>refreshChildren(selected).catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث</button></div>
          <div className="table-wrap"><table><thead><tr><th>اسم المخدوم</th><th>تاريخ الميلاد</th><th>المدرسة</th><th>ولي الأمر</th><th>موبايل الأم</th><th>إجراء</th></tr></thead><tbody>{filteredChildren.map(c=><tr key={c.id}><td><span className="child-avatar">{c.full_name.slice(0,1)}</span><b>{c.full_name}</b></td><td>{c.birth_date?.slice(0,10)||'—'}</td><td>{c.school_name||'—'}</td><td>{c.guardian_name||'—'}</td><td>{c.mother_phone||'—'}</td><td><button className="icon-button" title="تعديل الملف" onClick={()=>openEditChild(c)}><Pencil size={16}/></button></td></tr>)}{!filteredChildren.length&&<tr><td colSpan={6} className="empty">لا توجد بيانات مطابقة</td></tr>}</tbody></table></div>
        </>}
        {activeTab==='attendance'&&<><div className="attendance-toolbar"><label>تاريخ الاجتماع<input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)}/></label><span>{children.length} مخدوم</span></div><div className="attendance-list">{children.map(child=>{const row=attendance[child.id]||{status:'present',followup_status:'not_needed',followup_notes:''};return <article className="attendance-row" key={child.id}><b>{child.full_name}</b><label>الحضور<select value={row.status} onChange={e=>updateAttendance(child.id,{status:e.target.value})}><option value="present">حاضر</option><option value="absent">غائب</option><option value="excused">اعتذار</option></select></label><label>الافتقاد<select value={row.followup_status} onChange={e=>updateAttendance(child.id,{followup_status:e.target.value})}><option value="not_needed">لا يحتاج</option><option value="pending">مطلوب افتقاد</option><option value="contacted">تم التواصل</option><option value="completed">اكتملت المتابعة</option></select></label><input aria-label="ملاحظات الافتقاد" placeholder="ملاحظات الافتقاد" value={row.followup_notes} onChange={e=>updateAttendance(child.id,{followup_notes:e.target.value})}/><button className="primary-button compact" onClick={()=>saveAttendance(child)}><Save size={15}/> حفظ</button></article>;})}{!children.length&&<p className="empty">لا يوجد مخدومون في هذا الفصل.</p>}</div></>}
        {activeTab==='reports'&&<><div className="report-filters"><label>من تاريخ<input type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/></label><label>إلى تاريخ<input type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)}/></label><button className="primary-button" onClick={loadReport}><BarChart3 size={16}/> عرض التقرير</button></div>{report&&<><div className="report-summary"><article><span>عدد المخدومين</span><b>{report.totals.children}</b></article><article><span>مرات الحضور</span><b>{report.totals.present}</b></article><article><span>مرات الغياب</span><b>{report.totals.absent}</b></article><article><span>الاعتذارات</span><b>{report.totals.excused}</b></article><article><span>حالات الافتقاد</span><b>{report.totals.followups}</b></article><article><span>افتقاد مكتمل</span><b>{report.totals.completed}</b></article></div><div className="panel-actions report-actions"><b>تفاصيل المخدومين</b><div><button className="secondary-button" onClick={printReport}><Printer size={16}/> طباعة</button><button className="secondary-button" onClick={exportReport}><Download size={16}/> تصدير Excel (CSV)</button></div></div><div className="table-wrap"><table><thead><tr><th>اسم المخدوم</th><th>ولي الأمر</th><th>عدد التسجيلات</th><th>حاضر</th><th>غائب</th><th>اعتذار</th><th>الافتقاد</th><th>مكتمل</th></tr></thead><tbody>{report.rows.map(r=><tr key={r.child_id}><td>{r.full_name}</td><td>{r.guardian_name||'—'}</td><td>{r.recorded_count}</td><td>{r.present_count}</td><td>{r.absent_count}</td><td>{r.excused_count}</td><td>{r.followup_count}</td><td>{r.completed_followups}</td></tr>)}</tbody></table></div></>}</>}
        {activeTab==='classes'&&isAdmin&&<><form className="inline-admin-form" onSubmit={saveClass}><label>اسم الفصل<input value={classDraft.name} onChange={e=>setClassDraft({...classDraft,name:e.target.value})} required/></label><label>ترتيب العرض<input type="number" value={classDraft.sort_order} onChange={e=>setClassDraft({...classDraft,sort_order:Number(e.target.value)})}/></label><button className="primary-button"><Plus size={16}/>{editingClass?'حفظ التعديل':'إضافة فصل'}</button>{editingClass&&<button type="button" className="secondary-button" onClick={()=>{setEditingClass(null);setClassDraft({name:'',sort_order:0});}}>إلغاء</button>}</form><div className="table-wrap"><table><thead><tr><th>اسم الفصل</th><th>الترتيب</th><th>عدد المخدومين</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{classes.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.sort_order}</td><td>{c.children_count??'—'}</td><td><span className={c.is_active===false?'status-off':'status-on'}>{c.is_active===false?'موقوف':'نشط'}</span></td><td><button className="icon-button" title="تعديل" onClick={()=>{setEditingClass(c.id);setClassDraft({name:c.name,sort_order:c.sort_order});}}><Pencil size={16}/></button><button className="secondary-button small" onClick={()=>toggleClass(c)}>{c.is_active===false?'تفعيل':'إيقاف'}</button></td></tr>)}</tbody></table></div></>}
        {activeTab==='users'&&isAdmin&&<><form className="user-create-form" onSubmit={createUser}><h3>إنشاء حساب جديد</h3><div className="form-grid"><label>الاسم بالكامل<input value={userDraft.full_name} onChange={e=>setUserDraft({...userDraft,full_name:e.target.value})} required/></label><label>البريد الإلكتروني<input type="email" value={userDraft.email} onChange={e=>setUserDraft({...userDraft,email:e.target.value})}/></label><label>رقم الهاتف<input inputMode="tel" value={userDraft.phone} onChange={e=>setUserDraft({...userDraft,phone:e.target.value})}/></label><label>كلمة المرور (10 أحرف على الأقل)<input type="password" minLength={10} value={userDraft.password} onChange={e=>setUserDraft({...userDraft,password:e.target.value})} required/></label><label>الدور<select value={userDraft.role} onChange={e=>setUserDraft({...userDraft,role:e.target.value as User['role']})}><option value="admin">مدير النظام</option><option value="service_manager">مسؤول الخدمة</option><option value="class_servant">خادم فصل</option></select></label>{userDraft.role==='class_servant'&&<><label>الفصل المخصص<select value={userDraft.class_id} onChange={e=>setUserDraft({...userDraft,class_id:e.target.value})} required><option value="">اختر الفصل</option>{classes.filter(c=>c.is_active!==false).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={userDraft.can_record_attendance} onChange={e=>setUserDraft({...userDraft,can_record_attendance:e.target.checked})}/> السماح بتسجيل الحضور</label></>}</div><button className="primary-button"><UserPlus size={16}/> إنشاء الحساب</button></form><div className="table-wrap"><table><thead><tr><th>الاسم</th><th>بيانات الدخول</th><th>الدور</th><th>الفصل</th><th>تسجيل الحضور</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.full_name}</td><td>{u.email||u.phone||'—'}</td><td>{roleNames[u.role]}</td><td>{u.class_name||'—'}</td><td>{u.can_record_attendance?'مسموح':'—'}</td><td><span className={u.is_active?'status-on':'status-off'}>{u.is_active?'نشط':'موقوف'}</span></td><td><button className="secondary-button small" disabled={u.id===user.id&&!u.is_active} onClick={()=>toggleUser(u)}>{u.is_active?'تعطيل':'تفعيل'}</button></td></tr>)}</tbody></table></div></>}
        {error&&<p className="error">{error}</p>}{notice&&<p className="success-message">{notice}</p>}
      </section>}
      <footer><img src="/logo-mark.png" alt=""/><span>خدمة مارمرقس · نظام إدارة ومتابعة الخدمة</span><span className="footer-note">نسخة تطوير محلية</span></footer>
    </main>
  </div>;
}
