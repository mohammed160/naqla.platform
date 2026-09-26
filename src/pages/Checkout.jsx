import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatError } from '../lib/helpers';
import Toast from '../components/Toast';
import { useMembership } from '../lib/membership';

const methodMeta = {
  paymob: { title: 'Paymob', subtitle: 'Visa / Mastercard / المحافظ', icon: 'PM', currency: 'ج.م' },
  fawry: { title: 'Fawry', subtitle: 'كود دفع من منافذ فوري', icon: 'F', currency: 'ج.م' },
  fawry_wallet: { title: 'Fawry Wallet', subtitle: 'طلب دفع مباشر على المحفظة', icon: 'FW', currency: 'ج.م' },
  vodafone_cash: { title: 'Vodafone Cash', subtitle: 'فتح رابط الدفع', icon: 'VC', currency: 'ج.م' },
  instapay: { title: 'InstaPay', subtitle: 'فتح رابط الدفع', icon: 'IP', currency: 'ج.م' },
  paypal: { title: 'PayPal', subtitle: 'الدفع من حساب PayPal', icon: 'P', currency: '$' },
  trc20: { title: 'USDT TRC20', subtitle: 'تحويل على شبكة TRON', icon: 'T', currency: 'USDT' },
};

const manualProviders = new Set(['vodafone_cash', 'instapay']);

export default function Checkout() {
  const { courseId } = useParams();
  const planMode = !courseId;
  const { settings } = useOutletContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasAccess } = useMembership(user?.id);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('paymob');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState(null);
  const [txId, setTxId] = useState('');
  const [toast, setToast] = useState(null);

  const enabledMethods = useMemo(() => {
    const configured = {
      paymob: false,
      fawry: false,
      fawry_wallet: false,
      vodafone_cash: false,
      instapay: false,
      paypal: false,
      trc20: false,
      ...(settings?.paymentMethods || {}),
    };
    return Object.keys(methodMeta).filter((name) => configured[name] === true);
  }, [settings]);

  useEffect(() => {
    if (!enabledMethods.includes(provider)) setProvider(enabledMethods[0] || 'paymob');
  }, [enabledMethods, provider]);

  useEffect(() => {
    let active = true;
    async function loadCheckout() {
      const [targetResult, profileResult] = await Promise.all([
        planMode
          ? supabase.from('plans').select('*').eq('published', true).order('created_at', { ascending: true }).limit(1).maybeSingle()
          : supabase.from('courses').select('*').eq('id', courseId).maybeSingle(),
        supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (targetResult.data) {
        const row = targetResult.data;
        setCourse(planMode
          ? { ...row, price: row.price_egp, thumbnailUrl: '/assets/cover-default.svg', paypalPriceUsd: row.price_usd, trc20PriceUsdt: row.price_usdt }
          : { ...row, thumbnailUrl: row.thumbnail_url, paypalPriceUsd: row.paypal_price_usd, trc20PriceUsdt: row.trc20_price_usdt });
      } else {
        setCourse(null);
      }
      if (profileResult.data?.phone) setPhone(profileResult.data.phone);
      setLoading(false);
    }
    loadCheckout();
    return () => { active = false; };
  }, [courseId, planMode, user.id]);

  function displayPrice(name) {
    if (!course) return '';
    if (name === 'paypal') return course.paypalPriceUsd ? `$${Number(course.paypalPriceUsd).toFixed(2)}` : 'يُحسب تلقائيًا';
    if (name === 'trc20') return course.trc20PriceUsdt ? `${Number(course.trc20PriceUsdt).toFixed(2)} USDT` : 'يُحسب تلقائيًا';
    return `${Number(course.price || 0).toLocaleString('ar-EG')} ج.م`;
  }

  function manualPaymentConfig(name) {
    if (name === 'vodafone_cash') return settings?.manualPayments?.vodafoneCash || {};
    if (name === 'instapay') return settings?.manualPayments?.instaPay || {};
    return {};
  }

  async function startPayment(event) {
    event.preventDefault();

    if (provider === 'fawry' && !/^01\d{9}$/.test(phone.replace(/\s/g, ''))) {
      setToast({ type: 'error', message: 'اكتب رقم موبايل مصري صحيح لإصدار كود فوري.' });
      return;
    }

    if (provider === 'fawry_wallet' && !/^01\d{9}$/.test(phone.replace(/\s/g, ''))) {
      setToast({ type: 'error', message: 'اكتب رقم المحفظة المصري الصحيح لإرسال طلب الدفع.' });
      return;
    }

    setBusy(true);
    setSession(null);

    try {
      // TRC20 is a manual blockchain transfer. The wallet address is public data,
      // so there is no reason to call an Edge Function just to display it.
      // This also prevents checkout from failing when create-payment-session is not deployed.
      if (provider === 'trc20') {
        const walletAddress = String(settings?.trc20?.walletAddress || '').trim();
        const amount = Number(course?.trc20PriceUsdt || 0);

        if (!walletAddress) {
          setToast({ type: 'error', message: 'عنوان محفظة TRC20 غير مضاف من لوحة الإدارة.' });
          return;
        }

        if (!amount || amount <= 0) {
          setToast({ type: 'error', message: 'السعر بالـ USDT غير محدد. أضفه من صفحة الاشتراك في لوحة الإدارة أولًا.' });
          return;
        }

        setSession({
          provider: 'trc20',
          amount: amount.toFixed(2),
          network: 'TRON (TRC20)',
          walletAddress,
          explorerUrl: `https://tronscan.org/#/address/${encodeURIComponent(walletAddress)}`,
          manualOnly: true,
        });
        return;
      }

      if (provider === 'fawry_wallet') {
        const { data, error } = await supabase.functions.invoke('fawry-wallet-charge', {
          body: { ...(planMode ? { planId: course.id } : { courseId }), phone: phone.trim() },
        });
        if (error) throw error;
        setSession({ provider: 'fawry_wallet', ...data });
        if (data?.status === 'paid') navigate(`/payment-return?provider=fawry_wallet&paymentId=${data.paymentId}`);
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: { ...(planMode ? { planId: course.id } : { courseId }), provider, phone: phone.trim() },
      });
      if (error) throw error;
      setSession(data);
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
      if (data.status === 'paid') navigate(`/payment-return?provider=${provider}&paymentId=${data.paymentId}`);
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusy(false);
    }
  }

  async function verifyTrc20(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-trc20-payment', {
        body: { paymentId: session.paymentId, txId: txId.trim() },
      });
      if (error) throw error;
      if (data?.status === 'paid') navigate(`/payment-return?provider=trc20&paymentId=${session.paymentId}`);
    } catch (error) {
      setToast({ type: 'error', message: formatError(error) });
    } finally { setBusy(false); }
  }

  async function copyValue(value, label) {
    await navigator.clipboard.writeText(value);
    setToast({ type: 'success', message: `تم نسخ ${label}.` });
  }

  if (loading) return <main className="loading-screen"><div className="loader-ring" /><p>جاري تحميل بيانات الاشتراك...</p></main>;
  if (!course) return <main className="auth-page"><div className="auth-card centered"><h1>{planMode ? 'الاشتراك غير متاح حاليًا' : 'الكورس غير موجود'}</h1><Link className="btn primary" to="/">العودة للرئيسية</Link></div></main>;

  if (planMode && hasAccess) {
    return <main className="auth-page"><div className="auth-card centered"><h1>اشتراكك فعّال بالفعل</h1><p>وصولك للكورسات الثلاثة مفتوح مدى الحياة.</p><Link className="btn primary" to="/dashboard">ادخل لوحتي</Link></div></main>;
  }

  const manualConfig = manualPaymentConfig(provider);
  const supportUrl = settings?.support?.whatsappUrl || '';
  const supportLabel = settings?.support?.label || 'تواصل مع الدعم';

  return (
    <main className="checkout-page section-pad">
      <Toast {...toast} onClose={() => setToast(null)} />
      <header className="checkout-heading">
        <div><span className="eyebrow">إتمام الدفع</span><h1>إتمام الاشتراك</h1><p>{planMode ? 'اختار طريقة الدفع المناسبة، وبعد تأكيد العملية يتفتح لك الكورسات الثلاثة على حسابك مدى الحياة.' : 'اختار طريقة الدفع المناسبة، وبعد تأكيد العملية هيتفعل الكورس تلقائيًا على حسابك.'}</p></div>
        <div className="row-actions">
          {supportUrl && <a className="btn ghost compact" href={supportUrl} target="_blank" rel="noreferrer">{supportLabel}</a>}
          <Link className="btn ghost compact" to={planMode ? '/join' : '/courses'}>رجوع</Link>
        </div>
      </header>

      <div className="checkout-layout">
        <section className="checkout-panel">
          <div className="panel-heading compact"><h2>طريقة الدفع</h2><span>اتصال آمن بالسيرفر</span></div>
          {!enabledMethods.length ? <div className="empty-state">طرق الدفع متوقفة مؤقتًا.</div> : (
            <>
              <div className="payment-method-grid">
                {enabledMethods.map((name) => {
                  const item = methodMeta[name];
                  return (
                    <button type="button" className={`payment-method ${provider === name ? 'active' : ''}`} onClick={() => { setProvider(name); setSession(null); }} key={name}>
                      <i>{item.icon}</i><span><b>{item.title}</b><small>{item.subtitle}</small></span><em>{displayPrice(name)}</em>
                    </button>
                  );
                })}
              </div>

              {manualProviders.has(provider) ? (
                <div className="payment-instructions">
                  <span className="instruction-icon">{methodMeta[provider]?.icon}</span>
                  <h2>{methodMeta[provider]?.title}</h2>
                  <p>{manualConfig.note || 'افتح رابط الدفع وأكمل العملية، ثم تواصل مع الدعم إذا احتجت مساعدة.'}</p>
                  {manualConfig.paymentUrl ? (
                    <a className="btn primary large full" href={manualConfig.paymentUrl} target="_blank" rel="noreferrer">فتح رابط الدفع</a>
                  ) : (
                    <div className="payment-warning"><b>الرابط غير مضاف بعد</b><p>طريقة الدفع ظاهرة لكن رابط الدفع غير محفوظ من لوحة الإدارة.</p></div>
                  )}
                  {supportUrl && <a className="btn ghost full" href={supportUrl} target="_blank" rel="noreferrer">{supportLabel}</a>}
                </div>
              ) : (
                <form onSubmit={startPayment}>
                  {(provider === 'fawry' || provider === 'fawry_wallet') && (
                    <label className="payment-phone">
                      {provider === 'fawry_wallet' ? 'رقم المحفظة' : 'رقم الموبايل'}
                      <input inputMode="tel" dir="ltr" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </label>
                  )}

                  {provider === 'trc20' && <div className="payment-warning"><b>تنبيه شبكة</b><p>استخدم شبكة TRON (TRC20) فقط. أي تحويل على شبكة مختلفة لن يصل إلى المحفظة.</p></div>}

                  {!session && (
                    <button className="btn primary large full" disabled={busy}>
                      {busy
                        ? 'جاري إنشاء عملية الدفع...'
                        : provider === 'fawry'
                          ? 'إصدار كود فوري'
                          : provider === 'fawry_wallet'
                            ? 'إرسال طلب الدفع للمحفظة'
                            : provider === 'trc20'
                              ? 'إظهار بيانات التحويل'
                              : `الدفع بواسطة ${methodMeta[provider]?.title}`}
                    </button>
                  )}
                </form>
              )}
            </>
          )}

          {session?.provider === 'fawry' && (
            <div className="payment-instructions success-box">
              <span className="instruction-icon">F</span><h2>تم إصدار كود فوري</h2><p>ادفع من أقرب منفذ فوري باستخدام الرقم التالي:</p>
              <button className="copy-code" type="button" onClick={() => copyValue(session.referenceNumber, 'كود فوري')}>{session.referenceNumber}<small>اضغط للنسخ</small></button>
              <p className="muted-line">صالح حتى {new Date(session.expiresAt).toLocaleString('ar-EG')}</p>
              <Link className="btn ghost full" to={`/payment-return?provider=fawry&paymentId=${session.paymentId}`}>متابعة حالة الدفع</Link>
            </div>
          )}

          {session?.provider === 'fawry_wallet' && (
            <div className="payment-instructions success-box">
              <span className="instruction-icon">FW</span>
              <h2>تم إرسال طلب الدفع للمحفظة</h2>
              <p>افتح إشعار المحفظة على رقم <b dir="ltr">{session.walletNumber || phone}</b> ووافق على عملية الدفع.</p>
              {session.referenceNumber && <div className="result-reference"><span>رقم المرجع</span><b>{session.referenceNumber}</b></div>}
              <Link className="btn primary full" to={`/payment-return?provider=fawry_wallet&paymentId=${session.paymentId}`}>متابعة حالة الدفع</Link>
              {supportUrl && <a className="btn ghost full" href={supportUrl} target="_blank" rel="noreferrer">{supportLabel}</a>}
            </div>
          )}

          {session?.provider === 'trc20' && (
            <div className="payment-instructions crypto-box">
              <span className="instruction-icon">T</span><h2>بيانات تحويل USDT</h2>
              <div className="crypto-amount"><small>المبلغ المطلوب</small><b>{session.amount} USDT</b><span>{session.network}</span></div>
              <div className="wallet-row"><code dir="ltr">{session.walletAddress}</code><button type="button" onClick={() => copyValue(session.walletAddress, 'عنوان المحفظة')}>نسخ</button></div>
              <a className="text-link" href={session.explorerUrl} target="_blank" rel="noreferrer">فتح العنوان على Tronscan ↗</a>
              {session.manualOnly ? (
                <>
                  <div className="payment-warning">
                    <b>بعد التحويل</b>
                    <p>احتفظ بـ Transaction Hash الخاص بالعملية. التفعيل التلقائي على شبكة TRON سيتم إضافته لاحقًا، وحاليًا تواصل مع الدعم لتأكيد التحويل وتفعيل اشتراكك.</p>
                  </div>
                  {supportUrl && (
                    <a className="btn primary full" href={supportUrl} target="_blank" rel="noreferrer">
                      إرسال بيانات التحويل للدعم
                    </a>
                  )}
                </>
              ) : (
                <form className="tx-form" onSubmit={verifyTrc20}><label>Transaction Hash<input dir="ltr" required minLength="64" maxLength="64" placeholder="64-character transaction hash" value={txId} onChange={(e) => setTxId(e.target.value.trim())} /></label><button className="btn primary full" disabled={busy}>{busy ? 'جاري التحقق من الشبكة...' : 'تحقق وفعّل الاشتراك'}</button></form>
              )}
            </div>
          )}
        </section>

        <aside className="order-summary">
          <img src={course.thumbnailUrl || '/assets/cover-default.svg'} alt={course.title} />
          <span className="eyebrow">ملخص الطلب</span><h2>{course.title}</h2><p>{course.description}</p>
          <div className="summary-row"><span>{planMode ? 'سعر الاشتراك' : 'سعر الكورس'}</span><b>{Number(course.price || 0).toLocaleString('ar-EG')} ج.م</b></div>
          <div className="summary-row"><span>الحساب</span><small>{user.email}</small></div>
          <div className="summary-total"><span>الإجمالي</span><b>{provider === 'paypal' ? displayPrice('paypal') : provider === 'trc20' ? displayPrice('trc20') : `${Number(course.price || 0).toLocaleString('ar-EG')} ج.م`}</b></div>
          <ul className="secure-points"><li>لا يتم حفظ بيانات البطاقة داخل المنصة.</li><li>التفعيل يتم بعد تأكيد البوابة أو الشبكة.</li><li>{planMode ? 'الاشتراك مرتبط بحسابك ومدى الحياة.' : 'كل عملية مرتبطة بحسابك والكورس المحدد.'}</li></ul>
        </aside>
      </div>
    </main>
  );
}
