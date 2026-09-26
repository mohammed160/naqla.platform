import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatError } from '../../lib/helpers';
import Toast from '../../components/Toast';

const providerLabels = { paymob: 'Paymob', fawry: 'Fawry', paypal: 'PayPal', instapay: 'InstaPay', vodafone_cash: 'Vodafone Cash', trc20: 'TRC20', manual: 'Manual' };
const statusLabels = { created: 'جديدة', pending: 'معلقة', awaiting_transfer: 'بانتظار التحويل', paid: 'مدفوعة', failed: 'فاشلة', cancelled: 'ملغاة', refunded: 'مسترجعة' };

function dateText(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ar-EG');
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [provider, setProvider] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [toast, setToast] = useState(null);

  const loadPayments = useCallback(async () => {
    const [paymentResult, profileResult, courseResult, planResult] = await Promise.all([
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,email,display_name'),
      supabase.from('courses').select('id,title'),
      supabase.from('plans').select('id,title'),
    ]);
    const error = paymentResult.error || profileResult.error || courseResult.error;
    const plans = new Map((planResult.error ? [] : planResult.data || []).map((item) => [item.id, item]));
    if (error) throw error;
    const profiles = new Map((profileResult.data || []).map((item) => [item.id, item]));
    const courses = new Map((courseResult.data || []).map((item) => [item.id, item]));
    setPayments((paymentResult.data || []).map((item) => ({
      ...item,
      userName: profiles.get(item.user_id)?.display_name || 'طالب',
      userEmail: profiles.get(item.user_id)?.email || '',
      courseTitle: item.plan_id ? (plans.get(item.plan_id)?.title || 'اشتراك نقلة') : (courses.get(item.course_id)?.title || '—'),
    })));
  }, []);

  useEffect(() => { loadPayments().catch((error) => setToast({ type: 'error', message: formatError(error) })); }, [loadPayments]);

  const filtered = useMemo(() => payments
    .filter((item) => provider === 'all' || item.provider === provider)
    .filter((item) => status === 'all' || item.status === status)
    .filter((item) => `${item.userName} ${item.userEmail} ${item.courseTitle} ${item.external_reference || ''} ${item.provider_order_id || ''}`.toLowerCase().includes(search.toLowerCase())), [payments, provider, status, search]);

  const stats = useMemo(() => {
    const paid = payments.filter((item) => item.status === 'paid');
    return {
      total: payments.length,
      paid: paid.length,
      pending: payments.filter((item) => ['created', 'pending', 'awaiting_transfer'].includes(item.status)).length,
      revenue: paid.reduce((sum, item) => sum + (item.currency === 'EGP' ? Number(item.amount || 0) : 0), 0),
    };
  }, [payments]);

  async function review(paymentId, action) {
    if (!window.confirm(action === 'approve' ? 'اعتماد العملية وتفعيل الكورس؟' : 'رفض العملية؟')) return;
    setBusyId(paymentId);
    try {
      const { error } = await supabase.rpc('admin_set_payment_status', { p_payment_id: paymentId, p_action: action });
      if (error) throw error;
      await loadPayments();
      setToast({ type: 'success', message: action === 'approve' ? 'تم اعتماد الدفع وتفعيل الكورس.' : 'تم رفض العملية.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="admin-page"><Toast {...toast} onClose={() => setToast(null)} />
      <div className="admin-page-heading"><div><span className="eyebrow">Payments</span><h1>المدفوعات والاشتراكات</h1><p>متابعة جميع العمليات من Supabase.</p></div></div>
      <div className="admin-stats payment-stats"><article><span>إجمالي العمليات</span><b>{stats.total}</b><small>كل طرق الدفع</small></article><article><span>العمليات الناجحة</span><b>{stats.paid}</b><small>تم تفعيل الكورسات</small></article><article><span>بانتظار التأكيد</span><b>{stats.pending}</b><small>تحتاج متابعة</small></article><article><span>إيراد بالجنيه</span><b>{stats.revenue.toLocaleString('ar-EG')}</b><small>EGP</small></article></div>
      <div className="admin-table-card">
        <div className="payment-filters"><input className="admin-search" placeholder="بحث بالطالب أو الكورس أو المرجع..." value={search} onChange={(e) => setSearch(e.target.value)} /><select value={provider} onChange={(e) => setProvider(e.target.value)}><option value="all">كل البوابات</option>{Object.entries(providerLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">كل الحالات</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>الطالب</th><th>الكورس</th><th>البوابة</th><th>المبلغ</th><th>الحالة</th><th>المرجع</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>
          {filtered.map((payment) => <tr key={payment.id}><td><b>{payment.userName}</b><small>{payment.userEmail}</small></td><td>{payment.courseTitle}</td><td><span className={`provider-pill ${payment.provider}`}>{providerLabels[payment.provider] || payment.provider}</span></td><td><b>{Number(payment.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</b> {payment.currency}</td><td><span className={`status ${payment.status}`}>{statusLabels[payment.status] || payment.status}</span></td><td><code dir="ltr">{payment.external_reference || payment.provider_order_id || '—'}</code></td><td>{dateText(payment.created_at)}</td><td>{payment.status !== 'paid' && <div className="row-actions"><button disabled={busyId === payment.id} onClick={() => review(payment.id, 'approve')}>اعتماد</button><button className="danger-text" disabled={busyId === payment.id} onClick={() => review(payment.id, 'reject')}>رفض</button></div>}</td></tr>)}
          {!filtered.length && <tr><td colSpan="8"><div className="empty-state">لا توجد عمليات مطابقة.</div></td></tr>}
        </tbody></table></div>
      </div>
    </section>
  );
}
