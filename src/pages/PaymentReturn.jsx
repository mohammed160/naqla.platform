import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatError } from '../lib/helpers';

const labels = { paymob: 'Paymob', fawry: 'Fawry', fawry_wallet: 'Fawry Wallet', paypal: 'PayPal', trc20: 'USDT TRC20', instapay: 'InstaPay', vodafone_cash: 'Vodafone Cash' };

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const paymentId = params.get('paymentId') || '';
  const provider = params.get('provider') || '';
  const orderId = params.get('token') || '';
  const cancelled = params.get('cancelled') === '1';
  const once = useRef(false);
  const [result, setResult] = useState({ status: cancelled ? 'cancelled' : 'loading' });

  async function checkStatus() {
    if (!paymentId) { setResult({ status: 'error', message: 'رقم عملية الدفع غير موجود.' }); return; }
    setResult((prev) => ({ ...prev, status: 'loading' }));
    try {
      if (provider === 'paypal' && orderId && !cancelled) {
        const { error } = await supabase.functions.invoke('capture-paypal-order', { body: { paymentId, orderId } });
        if (error) throw error;
      }
      const { data: payment, error } = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle();
      if (error) throw error;
      if (!payment) throw new Error('عملية الدفع غير موجودة.');
      const { data: course } = await supabase.from('courses').select('title').eq('id', payment.course_id).maybeSingle();
      setResult({
        status: payment.status,
        courseTitle: course?.title || 'الكورس',
        referenceNumber: payment.external_reference || payment.provider_order_id || '',
        message: payment.metadata?.message || '',
        failureReason: payment.metadata?.failure_reason || '',
      });
    } catch (error) {
      setResult({ status: 'error', message: formatError(error) });
    }
  }

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (!cancelled) checkStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const status = result.status;
  const paid = status === 'paid';
  const pending = ['pending', 'created', 'awaiting_transfer', 'loading'].includes(status);
  const title = paid ? 'تم الدفع وتفعيل الكورس' : status === 'cancelled' ? 'تم إلغاء الدفع' : pending ? 'جاري تأكيد عملية الدفع' : 'لم تكتمل عملية الدفع';
  const icon = paid ? '✓' : pending ? '…' : '×';

  return (
    <main className="payment-return-page section-pad">
      <section className={`payment-result-card ${paid ? 'paid' : pending ? 'pending' : 'failed'}`}>
        <span className="result-icon">{icon}</span><span className="eyebrow">{labels[provider] || 'Payment'}</span><h1>{title}</h1>
        {status === 'loading' && <p>بنتواصل مع بوابة الدفع للتأكد من النتيجة...</p>}
        {paid && <p>الكورس <b>{result.courseTitle}</b> أصبح متاحًا داخل لوحة الطالب.</p>}
        {status === 'cancelled' && <p>لم يتم خصم أو تفعيل أي شيء من خلال هذه المحاولة.</p>}
        {!paid && status !== 'loading' && status !== 'cancelled' && <p>{result.message || result.failureReason || 'العملية ما زالت غير مؤكدة أو تعذرت. يمكنك إعادة التحقق.'}</p>}
        {result.referenceNumber && <div className="result-reference"><span>رقم المرجع</span><b>{result.referenceNumber}</b></div>}
        {paymentId && <small className="payment-id">Payment ID: {paymentId}</small>}
        <div className="result-actions">
          {paid ? <Link className="btn primary large" to="/dashboard">افتح لوحة الطالب</Link> : <button className="btn primary large" type="button" onClick={checkStatus} disabled={status === 'loading'}>إعادة التحقق</button>}
          <Link className="btn ghost large" to="/">العودة للرئيسية</Link>
        </div>
      </section>
    </main>
  );
}
