import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRememberMePreference } from '../lib/supabase';
import { ADMIN_BASE } from '../config/adminPortal';
import { formatError } from '../lib/helpers';
import Toast from '../components/Toast';
import LoadingScreen from '../components/LoadingScreen';

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const { user, isAdmin, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user && isAdmin) navigate(ADMIN_BASE, { replace: true });
  }, [loading, user, isAdmin, navigate]);

  if (loading) return <LoadingScreen />;
  if (user && isAdmin) return <Navigate to={ADMIN_BASE} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setToast(null);

    try {
      if (user) await logout();
      const result = await login(form.email.trim(), form.password, rememberMe);

      if (!result?.isAdmin) {
        await logout();
        throw new Error('بيانات دخول الإدارة غير صحيحة أو الحساب غير مصرح له.');
      }

      navigate(ADMIN_BASE, { replace: true });
    } catch (error) {
      const message = formatError(error);
      setToast({
        type: 'error',
        message: message.includes('صلاحية') || message.includes('مصرح')
          ? 'بيانات دخول الإدارة غير صحيحة أو الحساب غير مصرح له.'
          : message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page admin-login-page">
      <div className="admin-login-noise" aria-hidden="true" />
      <Toast {...toast} onClose={() => setToast(null)} />
      <section className="auth-card admin-login-card">
        <span className="auth-icon">◆</span>
        <span className="eyebrow">Private Admin Portal</span>
        <h1>تسجيل دخول الإدارة</h1>
        <p>بوابة مستقلة للحسابات الإدارية المصرح لها فقط، ولا يوجد أي رابط لها داخل المنصة العامة.</p>
        {new URLSearchParams(location.search).get('denied') && (
          <div className="error-box">الحساب الحالي لا يملك صلاحية دخول لوحة الإدارة.</div>
        )}
        <form onSubmit={submit} className="stack-form">
          <label>
            البريد الإداري
            <input type="email" required autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            كلمة المرور
            <input type="password" required autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <label className="remember-field">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>تذكرني على هذا الجهاز</span>
          </label>
          <button className="btn primary large full" disabled={busy}>
            {busy ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}
          </button>
        </form>
        <small className="admin-security-note">الوصول محمي بصلاحية Admin وسياسات RLS داخل Supabase، وليس بإخفاء الرابط فقط.</small>
      </section>
    </main>
  );
}
