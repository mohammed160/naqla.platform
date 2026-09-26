import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getPublishableKey() {
  const legacyAnon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (legacyAnon) return legacyAnon;

  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    return String(keys?.default || '');
  } catch {
    return '';
  }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ code: 'method_not_allowed', error: 'Method not allowed' }, 405);

  try {
    const { lectureId } = await req.json();
    if (!lectureId) return json({ code: 'missing_lecture_id', error: 'Missing lectureId' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseClientKey = getPublishableKey();
    const bunnyLibraryId = Deno.env.get('BUNNY_LIBRARY_ID') || '';
    const bunnyTokenSecurityKey = Deno.env.get('BUNNY_TOKEN_SECURITY_KEY') || '';

    if (!supabaseUrl || !supabaseClientKey) {
      console.error('get-bunny-embed: Supabase environment is incomplete');
      return json({ code: 'supabase_environment_missing', error: 'Supabase function environment is incomplete' }, 500);
    }

    if (!bunnyLibraryId || !bunnyTokenSecurityKey) {
      console.error('get-bunny-embed: Bunny secrets missing', {
        hasLibraryId: Boolean(bunnyLibraryId),
        hasTokenKey: Boolean(bunnyTokenSecurityKey),
      });
      return json({ code: 'bunny_secrets_missing', error: 'Bunny Stream secrets are not configured' }, 503);
    }

    const authorization = req.headers.get('Authorization') || '';
    const clientOptions = authorization
      ? {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        }
      : {
          auth: { persistSession: false, autoRefreshToken: false },
        };

    const supabase = createClient(supabaseUrl, supabaseClientKey, clientOptions);

    const { data: source, error: sourceError } = await supabase
      .rpc('get_lecture_playback', { p_lecture_id: lectureId })
      .maybeSingle();

    if (sourceError) {
      console.error('get-bunny-embed: playback RPC failed', {
        lectureId,
        code: sourceError.code,
        message: sourceError.message,
      });
      return json({
        code: 'playback_rpc_failed',
        error: sourceError.message,
      }, 403);
    }

    if (!source) {
      console.warn('get-bunny-embed: access denied or no source', {
        lectureId,
        hasAuthorization: Boolean(authorization),
      });
      return json({
        code: 'lecture_access_denied',
        error: 'Lecture access denied or no playback source is available',
      }, 403);
    }

    if (source.provider !== 'bunny' || !source.provider_video_id) {
      console.warn('get-bunny-embed: lecture source is not Bunny', {
        lectureId,
        provider: source.provider,
      });
      return json({
        code: 'not_bunny_source',
        error: 'Lecture is not configured for Bunny Stream',
      }, 409);
    }

    const videoId = source.provider_video_id;
    const expires = Math.floor(Date.now() / 1000) + 300;
    const token = await sha256Hex(`${bunnyTokenSecurityKey}${videoId}${expires}`);

    console.log('get-bunny-embed: signed playback issued', {
      lectureId,
      videoId,
      expires,
    });

    return json({
      provider: 'bunny',
      videoId,
      expires,
      embedUrl: `https://iframe.mediadelivery.net/embed/${encodeURIComponent(bunnyLibraryId)}/${encodeURIComponent(videoId)}?token=${token}&expires=${expires}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('get-bunny-embed: unhandled error', message);
    return json({ code: 'unexpected_error', error: message }, 500);
  }
});
