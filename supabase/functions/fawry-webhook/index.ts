import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function money(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('', { status: 405 });

  try {
    const service = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { persistSession: false } },
    );
    const secureKey = Deno.env.get('FAWRY_SECURE_KEY') || '';
    if (!secureKey) return new Response('', { status: 500 });

    const body = await req.json();
    const merchantRefNumber = String(body?.merchantRefNumber || body?.merchantRefNum || '');
    const paymentReferenceNumber = String(body?.paymentRefrenceNumber || body?.paymentReferenceNumber || '');
    const expectedSignature = await sha256Hex(
      String(body?.fawryRefNumber || '') +
      merchantRefNumber +
      money(body?.paymentAmount) +
      money(body?.orderAmount) +
      String(body?.orderStatus || '') +
      String(body?.paymentMethod || '') +
      paymentReferenceNumber +
      secureKey,
    );

    if (!body?.messageSignature || expectedSignature.toLowerCase() !== String(body.messageSignature).toLowerCase()) {
      console.error('Invalid Fawry webhook signature');
      return new Response('', { status: 401 });
    }

    const { data: payment, error: paymentError } = await service
      .from('payments')
      .select('id,user_id,course_id,status,metadata')
      .eq('provider', 'fawry')
      .eq('external_reference', merchantRefNumber)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return new Response('', { status: 200 });

    const fawryStatus = String(body?.orderStatus || '').toUpperCase();
    const mappedStatus = fawryStatus === 'PAID'
      ? 'paid'
      : ['CANCELED', 'CANCELLED'].includes(fawryStatus)
        ? 'cancelled'
        : fawryStatus === 'REFUNDED'
          ? 'refunded'
          : ['FAILED', 'EXPIRED'].includes(fawryStatus)
            ? 'failed'
            : 'pending';

    const updatePayload: Record<string, unknown> = {
      status: mappedStatus,
      provider_order_id: String(body?.fawryRefNumber || paymentReferenceNumber || '') || null,
      metadata: {
        ...(payment.metadata || {}),
        fawry_webhook: body,
        message: mappedStatus === 'paid' ? 'Payment confirmed by Fawry.' : `Fawry status: ${fawryStatus || 'UNKNOWN'}`,
      },
      updated_at: new Date().toISOString(),
    };
    if (mappedStatus === 'paid') updatePayload.paid_at = new Date().toISOString();

    const { error: updateError } = await service.from('payments').update(updatePayload).eq('id', payment.id);
    if (updateError) throw updateError;

    if (mappedStatus === 'paid') {
      if (payment.plan_id) {
        // Naqla lifetime membership: unlocks every published course.
        const { error: grantError } = await service.rpc('grant_membership', {
          p_user: payment.user_id,
          p_plan: payment.plan_id,
          p_source: 'payment',
          p_payment: payment.id,
          p_code: null,
        });
        if (grantError) throw grantError;
      } else {
        const { error: enrollError } = await service.from('enrollments').upsert({
          user_id: payment.user_id,
          course_id: payment.course_id,
          source: 'payment',
          payment_id: payment.id,
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,course_id' });
        if (enrollError) throw enrollError;
      }
    }

    return new Response('', { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('', { status: 500 });
  }
});
