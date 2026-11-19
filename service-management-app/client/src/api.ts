// Same-origin API works for desktop and mobile deployments. Set VITE_API_URL only when the API is hosted on a separate origin.
const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export type User = { id:string; full_name:string; role:'admin'|'service_manager'|'class_servant'; class_id?:string; class_name?:string; can_record_attendance:boolean };
export function getToken(){ return sessionStorage.getItem('service_token'); }
export function saveSession(token:string,user:User){ sessionStorage.setItem('service_token',token); sessionStorage.setItem('service_user',JSON.stringify(user)); }
export function clearSession(){ sessionStorage.removeItem('service_token'); sessionStorage.removeItem('service_user'); }
export async function api<T>(path:string, options:RequestInit={}) : Promise<T> {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type':'application/json', ...(getToken()?{Authorization:`Bearer ${getToken()}`}:{ }), ...options.headers } });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || 'تعذر الاتصال بالخادم');
  return data as T;
}
