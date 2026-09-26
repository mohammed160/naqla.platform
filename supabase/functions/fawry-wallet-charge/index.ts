import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function numericCustomerId(uuid: string) {
  const hex = uuid.replace(/-/g, '').slice(0, 13);
  const value = BigInt(`0x${hex}`) % 9999999999999n;
  return value.toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const merchantCode = Deno.env.get('FAWRY_MERCHANT_CODE') || '';
    const secureKey = Deno.env.get('FAWRY_SECURE_KEY') || '';
    const chargeUrl = Deno.env.get('FAWRY_CHARGE_URL') || 'https://atfawry.fawrystaging.com/ECommerceWeb/api/payments/charge';

    if (!merchantCode || !secureKey) {
      return json({ error: 'Fawry merchant secrets are not configured.' }, 503);
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'Authentication required.' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: 'Authentication required.' }, 401);

    const { courseId, planId, phone } = await req.json();
    // Naqla sells one lifetime plan; a course id is still accepted for single-course sales.
    const isPlan = Boolean(planId);
    const targetId = isPlan ? planId : courseId;
    const cleanPhone = String(phone || '').replace(/\s/g, '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(targetId || ''))) {
      return json({ error: isPlan ? 'Invalid plan id.' : 'Invalid course id.' }, 400);
    }
    if (!/^01\d{9}$/.test(cleanPhone)) {
      return json({ error: 'Invalid Egyptian wallet number.' }, 400);
    }

    const [{ data: course, error: courseError }, { data: profile }] = await Promise.all([
      isPlan
        ? serviceClient.from('plans').select('id,title,price_egp,published').eq('id', planId).maybeSingle()
        : serviceClient.from('courses').select('id,title,price,published').eq('id', courseId).maybeSingle(),
      serviceClient.from('profiles').select('display_name,phone').eq('id', user.id).maybeSingle(),
    ]);

    if (courseError || !course || course.published === false) return json({ error: isPlan ? 'Plan not found.' : 'Course not found.' }, 404);

    const amount = Number(isPlan ? course.price_egp : course.price || 0);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Invalid price.' }, 400);

    const amountFixed = amount.toFixed(2);
    const merchantRefNum = `${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const customerProfileId = numericCustomerId(user.id);
    const paymentMethod = 'MWALLET';
    const signature = await sha256Hex(
      merchantCode + merchantRefNum + customerProfileId + paymentMethod + amountFixed + cleanPhone + secureKey,
    );

    const { data: payment, error: paymentError } = await serviceClient
      .from('payments')
      .insert({
        user_id: user.id,
        course_id: isPlan ? null : course.id,
        plan_id: isPlan ? course.id : null,
        provider: 'fawry',
        status: 'pending',
        amount,
        currency: 'EGP',
        external_reference: merchantRefNum,
        metadata: {
          mode: 'wallet_r2p',
          wallet_number: cleanPhone,
          message: 'Waiting for wallet confirmation.',
        },
      })
      .select('id')
      .single();

    if (paymentError || !payment) throw paymentError || new Error('Could not create payment record.');

    const payload = {
      merchantCode,
      merchantRefNum,
      customerProfileId,
      customerName: profile?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Naqla Student',
      customerMobile: cleanPhone,
      customerEmail: user.email || '',
      amount: amountFixed,
      paymentMethod,
      currencyCode: 'EGP',
      description: course.title,
      language: 'ar-eg',
      chargeItems: [
        {
          itemId: course.id,
          description: course.title,
          price: amountFixed,
          quantity: 1,
        },
      ],
      debitMobileWalletNo: cleanPhone,
      signature,
    };

    const response = await fetch(chargeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let fawryData: any = {};
    try { fawryData = rawText ? JSON.parse(rawText) : {}; } catch { fawryData = { raw: rawText }; }

    const ok = response.ok && Number(fawryData?.statusCode ?? 200) === 200;

    if (!ok) {
      await serviceClient.from('payments').update({
        status: 'failed',
        metadata: {
          mode: 'wallet_r2p',
          wallet_number: cleanPhone,
          failure_reason: fawryData?.statusDescription || fawryData?.message || `Fawry HTTP ${response.status}`,
          fawry_response: fawryData,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id);

      return json({
        error: fawryData?.statusDescription || fawryData?.message || 'Fawry wallet request failed.',
        details: fawryData,
      }, 502);
    }

    const referenceNumber = String(fawryData?.referenceNumber || fawryData?.fawryRefNumber || '');
    await serviceClient.from('payments').update({
      provider_order_id: referenceNumber || null,
      metadata: {
        mode: 'wallet_r2p',
        wallet_number: cleanPhone,
        message: 'Wallet payment request sent. Waiting for confirmation.',
        fawry_response: fawryData,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id);

    return json({
      paymentId: payment.id,
      provider: 'fawry_wallet',
      status: 'pending',
      walletNumber: cleanPhone,
      referenceNumber,
      merchantRefNum,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500);
  }
});
