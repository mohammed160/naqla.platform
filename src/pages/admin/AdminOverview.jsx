import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatError } from '../../lib/helpers';
import Toast from '../../components/Toast';

const initialData = {
  users: [],
  courses: [],
  lectures: [],
  projects: [],
  codes: [],
  payments: [],
};

export default function AdminOverview() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [users, courses, lectures, projects, codes, payments] = await Promise.all([
        supabase.from('profiles').select('id, role, is_active, created_at'),
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('lectures').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('activation_codes').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
      ]);

      const firstError = [users, courses, lectures, projects, codes, payments].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      setData({
        users: users.data || [],
        courses: courses.data || [],
        lectures: lectures.data || [],
        projects: projects.data || [],
        codes: codes.data || [],
        payments: payments.data || [],
      });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => [
    ['الطلاب', data.users.filter((x) => x.role === 'student').length, 'حساب طالب'],
    ['الكورسات', data.courses.length, `${data.courses.filter((x) => x.published).length} منشور`],
    ['المحاضرات', data.lectures.length, `${data.lectures.filter((x) => x.is_free).length} مجانية`],
    ['المشاريع', data.projects.length, `${data.projects.filter((x) => x.status === 'pending').length} للمراجعة`],
  ], [data]);

  const usedCodes = data.codes.filter((code) => code.used_at).length;
  const paidPayments = data.payments.filter((payment) => payment.status === 'paid');
  const revenueEgp = paidPayments.reduce(
    (sum, payment) => sum + (payment.currency === 'EGP' ? Number(payment.amount || 0) : 0),
    0,
  );
  const freeLectures = data.lectures.filter((lecture) => lecture.is_free && lecture.published);

  return (
    <section className="admin-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>نظرة عامة</h1>
          <p>ملخص مباشر من قاعدة بيانات Supabase.</p>
        </div>
        <div className="heading-actions">
          <span className="date-chip">{new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' })}</span>
          <button type="button" className="btn ghost compact" onClick={loadDashboard} disabled={loading}>
            {loading ? 'جاري التحديث...' : 'تحديث البيانات'}
          </button>
        </div>
      </div>

      <div className="admin-stats">
        {stats.map(([label, value, sub]) => (
          <article key={label}><span>{label}</span><b>{loading ? '—' : value}</b><small>{sub}</small></article>
        ))}
      </div>

      <div className="admin-stats payment-overview-stats">
        <article><span>المدفوعات الناجحة</span><b>{paidPayments.length}</b><small>من {data.payments.length} عملية</small></article>
        <article><span>الإيراد المسجل</span><b>{revenueEgp.toLocaleString('ar-EG')}</b><small>جنيه مصري</small></article>
        <article><span>Paymob</span><b>{data.payments.filter((p) => p.provider === 'paymob').length}</b><small>عملية</small></article>
        <article><span>طرق أخرى</span><b>{data.payments.filter((p) => p.provider !== 'paymob').length}</b><small>عملية</small></article>
      </div>

      <div className="admin-two-columns">
        <article className="admin-panel">
          <div className="panel-heading compact"><h2>أكواد التفعيل</h2><span>{data.codes.length} إجمالي</span></div>
          <div className="donut-row">
            <div className="donut" style={{ '--percent': `${data.codes.length ? Math.round((usedCodes / data.codes.length) * 100) : 0}%` }}>
              <b>{data.codes.length ? Math.round((usedCodes / data.codes.length) * 100) : 0}%</b><span>مستخدم</span>
            </div>
            <div className="metric-list">
              <div><span>تم استخدامها</span><b>{usedCodes}</b></div>
              <div><span>متاحة</span><b>{data.codes.length - usedCodes}</b></div>
            </div>
          </div>
        </article>

        <article className="admin-panel">
          <div className="panel-heading compact"><h2>المحاضرات المجانية</h2><span>تظهر في الرئيسية</span></div>
          <div className="data-list compact-list">
            {freeLectures.slice(0, 5).map((lecture) => (
              <div key={lecture.id}>
                <img className="tiny-thumb" src={lecture.thumbnail_url || '/assets/cover-default.svg'} alt="" />
                <div><b>{lecture.title}</b><small>{lecture.duration_text || 'بدون مدة'}</small></div>
                <span className="status approved">منشورة</span>
              </div>
            ))}
            {!freeLectures.length && <div className="empty-state">لم يتم نشر محاضرات مجانية بعد.</div>}
          </div>
        </article>
      </div>

      <article className="admin-panel">
        <div className="panel-heading compact"><h2>آخر مشاريع الطلبة</h2><span>{data.projects.filter((p) => p.status === 'pending').length} تحتاج مراجعة</span></div>
        <div className="project-review-row">
          {data.projects.slice(0, 5).map((project) => (
            <div key={project.id}>
              <img src={project.image_url || '/assets/cover-default.svg'} alt="" />
              <span><b>{project.title}</b><small>{project.student_name}</small></span>
            </div>
          ))}
          {!data.projects.length && <div className="empty-state">لا توجد مشاريع بعد.</div>}
        </div>
      </article>
    </section>
  );
}
