import { useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { setPendingVerificationEmail, useAuth } from '../contexts/AuthContext';
import { getRememberMePreference } from '../lib/supabase';
import { formatError, isEmailNotConfirmed } from '../lib/helpers';
import Toast from '../components/Toast';
import { ADMIN_BASE } from '../config/adminPortal';

const SAVED_EMAIL_KEY = 'naqla_saved_email';

export default function Login() {
  const [form, setForm] = useState(() => ({
    email: localStorage.getItem(SAVED_EMAIL_KEY) || '',
    password: '',
  }));
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useOutletContext();

  async function submit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const cleanEmail = form.email.trim().toLowerCase();

      if (rememberMe) localStorage.setItem(SAVED_EMAIL_KEY, cleanEmail);
      else localStorage.removeItem(SAVED_EMAIL_KEY);

      await login(cleanEmail, form.password, rememberMe);
      const requestedPath = location.state?.from?.pathname;
      navigate(
        requestedPath && !requestedPath.startsWith(ADMIN_BASE) ? requestedPath : '/dashboard',
        { replace: true },
      );
    } catch (error) {
      if (isEmailNotConfirmed(error)) {
        setPendingVerificationEmail(form.email.trim().toLowerCase());
        navigate('/verify-email');
        return;
      }
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <section className="auth-card">
        <span className="auth-icon">↗</span>
        <span className="eyebrow">أهلًا برجوعك</span>
        <h1>{settings.authPages?.loginTitle || 'تسجيل الدخول'}</h1>
        <p>{settings.authPages?.loginText || 'ادخل بيانات حسابك للوصول لمحاضراتك وتقدمك.'}</p>
        <form onSubmit={submit} className="stack-form">
          <label>
            البريد الإلكتروني
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            كلمة المرور
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <div className="form-row between login-options-row">
            <label className="remember-field">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>تذكرني على هذا الجهاز</span>
            </label>
            <Link to="/reset-password">نسيت كلمة المرور؟</Link>
          </div>
          <button className="btn primary large full" disabled={loading}>
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
        <p className="auth-switch">لسه معندكش حساب؟ <Link to="/signup">أنشئ حساب جديد</Link></p>
      </section>
    </main>
  );
}
