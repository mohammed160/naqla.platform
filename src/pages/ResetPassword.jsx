import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatError } from '../lib/helpers';
import Toast from '../components/Toast';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState(null);
  const { resetPassword } = useAuth();
  const { settings } = useOutletContext();

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <section className="auth-card">
        <span className="eyebrow">استرجاع الحساب</span><h1>{settings.authPages?.resetTitle || 'استرجاع كلمة المرور'}</h1>
        {sent ? (
          <div className="success-panel"><b>راجع بريدك الإلكتروني</b><p>بعتنا رابط حقيقي وآمن لتغيير كلمة المرور. افحص مجلد Spam لو الرسالة مش ظاهرة.</p><Link className="btn primary full" to="/login">العودة للدخول</Link></div>
        ) : (
          <><p>{settings.authPages?.resetText || 'اكتب بريد حسابك وهيوصلك رابط إعادة التعيين.'}</p><form onSubmit={submit} className="stack-form"><label>البريد الإلكتروني<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><button className="btn primary large full" disabled={loading}>{loading ? 'جاري الإرسال...' : 'إرسال رابط التغيير'}</button></form></>
        )}
      </section>
    </main>
  );
}
