import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, supabaseConfigError } from '../lib/supabase';
import { formatError } from '../lib/helpers';
import Toast from '../components/Toast';

function parseRecoveryUrl() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return {
    urlError:
      query.get('error_description')
      || hash.get('error_description')
      || query.get('error')
      || hash.get('error')
      || '',
    tokenHash: query.get('token_hash') || hash.get('token_hash') || '',
    type: query.get('type') || hash.get('type') || '',
    code: query.get('code') || '',
    accessToken: hash.get('access_token') || query.get('access_token') || '',
    refreshToken: hash.get('refresh_token') || query.get('refresh_token') || '',
  };
}

function cleanRecoveryUrl() {
  if (window.location.search || window.location.hash) {
    window.history.replaceState({}, document.title, '/update-password');
  }
}

function recoveryErrorMessage(error) {
  const raw = String(error?.message || '').toLowerCase();
  if (raw.includes('code verifier') || raw.includes('pkce')) {
    return 'الرابط ده اتعمل بطريقة قديمة أو اتفتح على جهاز مختلف. اطلب رابط استرجاع جديد وجربه مرة تانية.';
  }
  return formatError(error);
}

export default function UpdatePassword() {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [recoveryState, setRecoveryState] = useState('checking');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let ready = false;

    function markReady() {
      if (!active || ready) return;
      ready = true;
      setRecoveryState('ready');
      setRecoveryMessage('');
      cleanRecoveryUrl();
    }

    function markInvalid(message) {
      if (!active || ready) return;
      setRecoveryState('invalid');
      setRecoveryMessage(message || 'رابط تغيير كلمة المرور غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.');
    }

    if (!supabase) {
      markInvalid(supabaseConfigError);
      return undefined;
    }

    const params = parseRecoveryUrl();

    if (params.urlError) {
      markInvalid(decodeURIComponent(String(params.urlError).replace(/\+/g, ' ')));
      return undefined;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session?.user) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        markReady();
      }
    });

    async function establishRecoverySession() {
      try {
        if (params.tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: params.tokenHash,
            type: params.type === 'recovery' ? 'recovery' : 'recovery',
          });
          if (error) throw error;
          if (data?.session?.user) {
            markReady();
            return;
          }
        }

        if (params.accessToken && params.refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          if (error) throw error;
          if (data?.session?.user) {
            markReady();
            return;
          }
        }

        if (params.code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) throw error;
          if (data?.session?.user) {
            markReady();
            return;
          }
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (session?.user) {
          markReady();
          return;
        }

        // Supabase may still be consuming the redirect fragment during app bootstrap.
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        if (!active || ready) return;

        const { data: { session: delayedSession }, error: delayedError } = await supabase.auth.getSession();
        if (delayedError) throw delayedError;
        if (delayedSession?.user) {
          markReady();
          return;
        }

        markInvalid('الرابط غير صالح أو انتهت صلاحيته. اطلب رابط استرجاع جديد من صفحة نسيت كلمة المرور.');
      } catch (error) {
        markInvalid(recoveryErrorMessage(error));
      }
    }

    establishRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (recoveryState !== 'ready') return;

    if (form.password.length < 8) {
      setToast({ type: 'error', message: 'كلمة المرور لازم تكون 8 أحرف على الأقل.' });
      return;
    }
    if (form.password !== form.confirm) {
      setToast({ type: 'error', message: 'تأكيد كلمة المرور غير مطابق.' });
      return;
    }

    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw userError || new Error('جلسة الاسترجاع انتهت. اطلب رابطًا جديدًا.');
      }

      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) throw error;

      try {
        await supabase.auth.signOut();
      } catch {
        // Password change already succeeded. Continue to login.
      }

      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (error) {
      const message = recoveryErrorMessage(error);
      setToast({ type: 'error', message });

      const raw = String(error?.message || '').toLowerCase();
      if (raw.includes('session') || raw.includes('jwt') || raw.includes('token')) {
        setRecoveryState('invalid');
        setRecoveryMessage('انتهت جلسة تغيير كلمة المرور. اطلب رابط استرجاع جديد.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Toast {...toast} onClose={() => setToast(null)} />
      <section className="auth-card">
        <span className="eyebrow">تأمين الحساب</span>
        <h1>اكتب كلمة المرور الجديدة</h1>

        {recoveryState === 'checking' && (
          <div className="success-panel">
            <b>جاري التحقق من رابط الاسترجاع...</b>
            <p>ثوانٍ بسيطة وهنفتح لك تغيير كلمة المرور.</p>
          </div>
        )}

        {recoveryState === 'invalid' && (
          <div className="success-panel">
            <b>الرابط غير صالح</b>
            <p>{recoveryMessage || 'الرابط انتهت صلاحيته أو تم استخدامه من قبل.'}</p>
            <Link className="btn primary full" to="/reset-password">إرسال رابط جديد</Link>
          </div>
        )}

        {recoveryState === 'ready' && (done ? (
          <div className="success-panel">
            <b>تم تغيير كلمة المرور بنجاح</b>
            <p>هنحوّلك لصفحة تسجيل الدخول عشان تدخل بكلمة المرور الجديدة.</p>
            <Link className="btn primary full" to="/login">تسجيل الدخول</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="stack-form">
            <label>
              كلمة المرور الجديدة
              <input
                type="password"
                minLength="8"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              تأكيد كلمة المرور
              <input
                type="password"
                minLength="8"
                autoComplete="new-password"
                required
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              />
            </label>
            <button className="btn primary large full" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
            </button>
          </form>
        ))}
      </section>
    </main>
  );
}
