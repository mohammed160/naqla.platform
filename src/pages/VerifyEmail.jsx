import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getPendingVerificationEmail, useAuth } from '../contexts/AuthContext';
import { formatError } from '../lib/helpers';
import Toast from '../components/Toast';

// Shown after signup when "Confirm email" is on in Supabase.
export default function VerifyEmail() {
  const { resendVerification } = useAuth();
  const [email, setEmail] = useState(getPendingVerificationEmail);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  async function resend(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await resendVerification(email);
      setToast({ type: 'success', message: 'بعتنالك رسالة التأكيد تاني. بص على البريد الوارد والـ Spam.' });
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <section className="auth-card centered">
        <span className="mail-visual">✉</span>
        <span className="eyebrow">خطوة واحدة</span>
        <h1>أكد بريدك الإلكتروني</h1>
        <p>
          بعتنا رسالة لـ <b dir="ltr">{email || 'بريدك'}</b>. افتح الرابط اللي فيها وهتدخل لوحتك على طول.
        </p>
        <form onSubmit={resend} className="stack-form">
          <label>
            البريد الإلكتروني
            <input type="email" required autoComplete="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button className="btn primary full" disabled={loading}>{loading ? 'جاري الإرسال...' : 'إعادة إرسال الرسالة'}</button>
        </form>
        <Link className="btn ghost full" to="/login">الذهاب لتسجيل الدخول</Link>
      </section>
    </main>
  );
}
