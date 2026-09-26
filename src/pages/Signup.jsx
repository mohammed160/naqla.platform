import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatError } from '../lib/helpers';
import Toast from '../components/Toast';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const { settings } = useOutletContext();

  async function submit(event) {
    event.preventDefault();
    if (form.password.length < 8) return setToast({ type: 'error', message: 'كلمة المرور لازم تكون 8 أحرف على الأقل.' });
    if (form.password !== form.confirm) return setToast({ type: 'error', message: 'تأكيد كلمة المرور غير مطابق.' });
    setLoading(true);
    try {
      const result = await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate(result.needsConfirmation ? '/verify-email' : '/dashboard', { replace: true });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <section className="auth-card wider">
        <span className="eyebrow">ابدأ رحلتك</span><h1>{settings.authPages?.signupTitle || 'إنشاء حساب جديد'}</h1><p>{settings.authPages?.signupText || 'أنشئ حسابك في دقيقة، وابدأ رحلتك مع نقلة.'}</p>
        <form onSubmit={submit} className="stack-form">
          <label>الاسم بالكامل<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>البريد الإلكتروني<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <div className="two-cols">
            <label>كلمة المرور<input type="password" required minLength="8" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label>تأكيد كلمة المرور<input type="password" required minLength="8" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></label>
          </div>
          <button className="btn primary large full" disabled={loading}>{loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}</button>
        </form>
        <p className="auth-switch">عندك حساب؟ <Link to="/login">سجّل الدخول</Link></p>
      </section>
    </main>
  );
}
