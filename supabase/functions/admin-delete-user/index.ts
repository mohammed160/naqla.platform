import { createClient } from 'jsr:@supabase/supabase-js@2';

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

function addPath(target: Set<string>, value: unknown) {
  if (typeof value === 'string' && value.trim()) target.add(value.trim());
}

async function removeStorageFiles(
  adminClient: ReturnType<typeof createClient>,
  bucket: string,
  paths: Set<string>,
) {
  if (!paths.size) return;
  const values = Array.from(paths);

  for (let index = 0; index < values.length; index += 100) {
    const chunk = values.slice(index, index + 100);
    const { error } = await adminClient.storage.from(bucket).remove(chunk);
    if (error) throw new Error(`Could not clean ${bucket}: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ code: 'method_not_allowed', error: 'Method not allowed' }, 405);

  try {
    const authorization = req.headers.get('Authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return json({ code: 'authentication_required', error: 'Authentication required' }, 401);
    }

    const { userId } = await req.json();
    if (!userId) return json({ code: 'missing_user_id', error: 'Missing userId' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('admin-delete-user: missing Supabase environment');
      return json({ code: 'supabase_environment_missing', error: 'Supabase function environment is incomplete' }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Verify caller
    const { data: callerData, error: callerError } = await adminClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return json({ code: 'invalid_session', error: 'Invalid session' }, 401);
    }

    const callerId = callerData.user.id;

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('role,is_active')
      .eq('id', callerId)
      .maybeSingle();

    if (callerProfileError || callerProfile?.role !== 'admin' || callerProfile?.is_active === false) {
      return json({ code: 'admin_required', error: 'Admin permission required' }, 403);
    }

    if (callerId === userId) {
      return json({ code: 'cannot_delete_self', error: 'You cannot delete your current admin account' }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('id,email,display_name,role,avatar_path')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfileError) {
      console.error('admin-delete-user: target profile lookup failed', targetProfileError);
      return json({ code: 'profile_lookup_failed', error: targetProfileError.message }, 500);
    }

    if (!targetProfile) {
      return json({ code: 'user_not_found', error: 'User not found' }, 404);
    }

    if (targetProfile.role === 'admin') {
      return json({ code: 'cannot_delete_admin', error: 'Admin accounts cannot be deleted from the students screen' }, 400);
    }

    const [projectsResult, paymentsResult] = await Promise.all([
      adminClient
        .from('projects')
        .select('image_path,image_paths,cover_path')
        .eq('user_id', userId),
      adminClient
        .from('payments')
        .select('payment_proof_path')
        .eq('user_id', userId),
    ]);

    if (projectsResult.error) throw new Error(`Could not read project files: ${projectsResult.error.message}`);
    if (paymentsResult.error) throw new Error(`Could not read payment files: ${paymentsResult.error.message}`);

    const projectFiles = new Set<string>();
    const publicAssetFiles = new Set<string>();
    const paymentProofFiles = new Set<string>();

    addPath(publicAssetFiles, targetProfile.avatar_path);

    for (const project of projectsResult.data || []) {
      addPath(projectFiles, project.image_path);
      for (const path of Array.isArray(project.image_paths) ? project.image_paths : []) addPath(projectFiles, path);

      if (typeof project.cover_path === 'string' && project.cover_path.trim()) {
        if (project.cover_path.startsWith('project-covers/')) addPath(publicAssetFiles, project.cover_path);
        else addPath(projectFiles, project.cover_path);
      }
    }

    for (const payment of paymentsResult.data || []) {
      addPath(paymentProofFiles, payment.payment_proof_path);
    }

    await Promise.all([
      removeStorageFiles(adminClient, 'student-projects', projectFiles),
      removeStorageFiles(adminClient, 'public-assets', publicAssetFiles),
      removeStorageFiles(adminClient, 'payment-proofs', paymentProofFiles),
    ]);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('admin-delete-user: auth deletion failed', { userId, message: deleteError.message });
      return json({ code: 'delete_failed', error: deleteError.message }, 500);
    }

    return json({
      success: true,
      deletedUser: {
        id: targetProfile.id,
        email: targetProfile.email,
        displayName: targetProfile.display_name,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('admin-delete-user: unhandled error', message);
    return json({ code: 'unexpected_error', error: message }, 500);
  }
});
