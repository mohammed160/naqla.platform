import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatError } from '../../lib/helpers';
import Toast from '../../components/Toast';

const sourceLabels = { payment: 'دفع', activation_code: 'كود تفعيل', manual: 'يدوي', gift: 'هدية' };

function dateText(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ar-EG');
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminPlan() {
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', price_egp: '', price_usd: '', price_usdt: '', published: true });
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyUser, setBusyUser] = useState('');
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const [planResult, memberResult, profileResult] = await Promise.all([
      supabase.from('plans').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('memberships').select('*').order('granted_at', { ascending: false }),
      supabase.from('profiles').select('id,email,display_name'),
    ]);
    const error = planResult.error || memberResult.error || profileResult.error;
    if (error) throw error;

    const row = planResult.data;
    setPlan(row);
    if (row) {
      setForm({
        title: row.title || '',
        description: row.description || '',
        price_egp: row.price_egp ?? '',
        price_usd: row.price_usd ?? '',
        price_usdt: row.price_usdt ?? '',
        published: row.published,
      });
    }
    const profiles = new Map((profileResult.data || []).map((item) => [item.id, item]));
    setMembers((memberResult.data || []).map((item) => ({
      ...item,
      name: profiles.get(item.user_id)?.display_name || 'طالب',
      email: profiles.get(item.user_id)?.email || '',
    })));
  }, []);

  useEffect(() => {
    load().catch((error) => setToast({ type: 'error', message: formatError(error) }));
  }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query));
  }, [members, search]);

  const activeCount = members.filter((item) => item.active).length;

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function savePlan(event) {
    event.preventDefault();
    if (!plan) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('plans').update({
        title: form.title.trim(),
        description: form.description.trim(),
        price_egp: Number(form.price_egp || 0),
        price_usd: numberOrNull(form.price_usd),
        price_usdt: numberOrNull(form.price_usdt),
        published: form.published,
      }).eq('id', plan.id);
      if (error) throw error;
      await load();
      setToast({ type: 'success', message: 'تم حفظ الاشتراك.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
    }
  }

  async function grant(event) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('admin_grant_membership', { p_email: email.trim() });
      if (error) throw error;
      setEmail('');
      await load();
      setToast({ type: 'success', message: 'تم منح الاشتراك.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(member) {
    const next = !member.active;
    if (!window.confirm(next ? 'إعادة تفعيل اشتراك هذا الطالب؟' : 'إيقاف اشتراك هذا الطالب؟')) return;
    setBusyUser(member.user_id);
    try {
      const { error } = await supabase.rpc('admin_set_membership_active', { p_user: member.user_id, p_active: next });
      if (error) throw error;
      await load();
      setToast({ type: 'success', message: next ? 'تم تفعيل الاشتراك.' : 'تم إيقاف الاشتراك.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusyUser('');
    }
  }

  return (
    <section className="admin-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Membership</span>
          <h1>الاشتراك والأعضاء</h1>
          <p>اشتراك واحد مدى الحياة يفتح كل الكورسات المنشورة. عدّل السعر والنص من هنا، وامنح أو أوقف الوصول لأي طالب.</p>
        </div>
      </div>

      <div className="admin-stats">
        <article><span>الأعضاء النشطون</span><b>{activeCount}</b><small>من {members.length} عضوية</small></article>
        <article><span>السعر الحالي</span><b>{Number(plan?.price_egp || 0).toLocaleString('ar-EG')}</b><small>ج.م، دفعة واحدة</small></article>
      </div>

      {!plan ? (
        <div className="empty-state">لم يتم العثور على اشتراك. شغّل ملف <code dir="ltr">supabase/naqla_full_setup.sql</code> من Supabase SQL Editor (آمن لو اتعاد).</div>
      ) : (
        <form className="admin-form-card" onSubmit={savePlan}>
          <div className="panel-heading compact"><h2>بيانات الاشتراك</h2><span>{plan.is_lifetime ? 'مدى الحياة' : `${plan.duration_days} يوم`}</span></div>
          <label>العنوان<input required value={form.title} onChange={(e) => update('title', e.target.value)} /></label>
          <label>الوصف<textarea value={form.description} onChange={(e) => update('description', e.target.value)} /></label>
          <div className="three-cols">
            <label>السعر بالجنيه<input type="number" min="0" step="0.01" required value={form.price_egp} onChange={(e) => update('price_egp', e.target.value)} /></label>
            <label>السعر بالدولار (PayPal)<input type="number" min="0" step="0.01" value={form.price_usd} onChange={(e) => update('price_usd', e.target.value)} /></label>
            <label>السعر بـ USDT<input type="number" min="0" step="0.01" value={form.price_usdt} onChange={(e) => update('price_usdt', e.target.value)} /></label>
          </div>
          <label className="check-row" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={form.published} onChange={(e) => update('published', e.target.checked)} /> منشور ومتاح للشراء
          </label>
          <button className="btn primary" disabled={busy}>{busy ? 'جاري الحفظ...' : 'حفظ التغييرات'}</button>
        </form>
      )}

      <form className="admin-form-card" onSubmit={grant}>
        <div className="panel-heading compact"><h2>منح اشتراك يدويًا</h2><span>بالبريد الإلكتروني للطالب</span></div>
        <div className="two-cols">
          <label>البريد الإلكتروني<input type="email" dir="ltr" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn primary align-end" disabled={busy || !plan}>منح الاشتراك</button>
        </div>
      </form>

      <div className="admin-table-card">
        <div className="payment-filters">
          <input className="admin-search" placeholder="ابحث بالاسم أو البريد..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="payment-table-wrap">
          <table className="payment-table">
            <thead><tr><th>الطالب</th><th>المصدر</th><th>منذ</th><th>الحالة</th><th>إجراء</th></tr></thead>
            <tbody>
              {visible.map((member) => (
                <tr key={member.id}>
                  <td><b>{member.name}</b><small>{member.email}</small></td>
                  <td>{sourceLabels[member.source] || member.source}</td>
                  <td>{dateText(member.granted_at)}</td>
                  <td><span className={`status ${member.active ? 'paid' : 'failed'}`}>{member.active ? 'فعّال' : 'موقوف'}</span></td>
                  <td>
                    <div className="row-actions">
                      <button disabled={busyUser === member.user_id} className={member.active ? 'danger-text' : ''} onClick={() => toggle(member)}>
                        {member.active ? 'إيقاف' : 'تفعيل'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visible.length && <tr><td colSpan="5"><div className="empty-state">لا يوجد أعضاء بعد.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
