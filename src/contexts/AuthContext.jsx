import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  setRememberMePreference,
  supabase,
  supabaseConfigured,
  supabaseConfigError,
} from '../lib/supabase';

const AuthContext = createContext(null);

function normalizeUser(rawUser) {
  if (!rawUser) return null;
  return {
    ...rawUser,
    uid: rawUser.id,
    displayName:
      rawUser.user_metadata?.display_name ||
      rawUser.user_metadata?.full_name ||
      rawUser.email?.split('@')[0] ||
      '',
    emailVerified: true,
  };
}

const PENDING_EMAIL_KEY = 'naqla_pending_verification_email';

// Absolute URL on this site, used as the landing page for links in auth emails.
// Must be listed under Supabase > Authentication > URL Configuration > Redirect URLs.
function appUrl(path) {
  const configuredUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_APP_URL || '').trim().replace(/\/$/, '');
  if (configuredUrl) return `${configuredUrl}${path}`;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function getPendingVerificationEmail() {
  try { return localStorage.getItem(PENDING_EMAIL_KEY) || ''; } catch { return ''; }
}

export function setPendingVerificationEmail(email) {
  try {
    if (email) localStorage.setItem(PENDING_EMAIL_KEY, email);
    else localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch { /* storage unavailable */ }
}

function logAuthEvent(event, session) {
  const currentUser = session?.user || null;
  console.info('[AUTH]', event, {
    hasSession: Boolean(session),
    user: currentUser?.id ? `${currentUser.id.slice(0, 8)}…` : null,
    expiresAt: session?.expires_at || null,
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const authUserIdRef = useRef(null);
  const initializedRef = useRef(false);

  async function loadProfile(rawUser) {
    if (!supabase || !rawUser) {
      if (!rawUser) setIsAdmin(false);
      return false;
    }

    const requestedUserId = rawUser.id;
    const { data, error } = await supabase
      .from('profiles')
      .select('role, is_active, display_name')
      .eq('id', requestedUserId)
      .maybeSingle();

    // Ignore a response that belongs to an older session. This prevents a slow
    // profile request from restoring stale auth/admin state after sign-out or
    // after another account signs in.
    if (authUserIdRef.current !== requestedUserId) return false;

    if (error) {
      console.error('Profile loading error:', error);
      setIsAdmin(false);
      return false;
    }

    if (data?.display_name) {
      setUser((current) => (
        current?.id === requestedUserId
          ? { ...current, displayName: data.display_name }
          : current
      ));
    }

    const admin = data?.role === 'admin' && data?.is_active !== false;
    setIsAdmin(admin);
    return admin;
  }

  useEffect(() => {
    let active = true;

    if (!supabaseConfigured || !supabase) {
      console.error(supabaseConfigError);
      initializedRef.current = true;
      setLoading(false);
      return undefined;
    }

    async function initialize() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) throw error;

        const currentUser = session?.user || null;
        authUserIdRef.current = currentUser?.id || null;
        setUser(normalizeUser(currentUser));
        if (currentUser) await loadProfile(currentUser);
        else setIsAdmin(false);
      } catch (error) {
        console.error('Authentication initialization error:', error);
      } finally {
        if (active) {
          initializedRef.current = true;
          setLoading(false);
        }
      }
    }

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      logAuthEvent(event, session);

      // getSession() above owns the first page-load state. Supabase can emit
      // INITIAL_SESSION while initialize() is still running, so don't start a
      // second auth transition or full-screen loader here.
      if (event === 'INITIAL_SESSION' && !initializedRef.current) return;

      if (event === 'SIGNED_OUT') {
        authUserIdRef.current = null;
        setUser(null);
        setIsAdmin(false);
        return;
      }

      const currentUser = session?.user || null;

      // Do not treat a transient event without a session as an explicit logout.
      // Only SIGNED_OUT above is allowed to clear an authenticated user.
      if (!currentUser) return;

      authUserIdRef.current = currentUser.id;
      setUser(normalizeUser(currentUser));

      // Token refreshes are normal background maintenance and should never hide
      // the dashboard or re-query the profile. Other session/user changes may
      // affect profile-derived state, so refresh it asynchronously outside the
      // auth callback.
      if (event === 'TOKEN_REFRESHED') return;

      window.setTimeout(async () => {
        if (!active || authUserIdRef.current !== currentUser.id) return;
        await loadProfile(currentUser);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function ensureSupabase() {
    if (!supabaseConfigured || !supabase) throw new Error(supabaseConfigError);
  }

  async function signup({ name, email, password }) {
    ensureSupabase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    setRememberMePreference(true);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { display_name: cleanName, full_name: cleanName },
        emailRedirectTo: appUrl('/dashboard'),
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('تعذر إنشاء الحساب.');

    // "Confirm email" is on in Supabase: the account exists but has no session
    // until the student opens the link in the confirmation email.
    if (!data.session) {
      setPendingVerificationEmail(cleanEmail);
      return { user: null, session: null, isAdmin: false, needsConfirmation: true };
    }

    setPendingVerificationEmail('');
    authUserIdRef.current = data.user.id;
    setUser(normalizeUser(data.user));
    const admin = await loadProfile(data.user);

    return {
      user: normalizeUser(data.user),
      session: data.session,
      isAdmin: admin,
      needsConfirmation: false,
    };
  }

  async function resendVerification(email) {
    ensureSupabase();
    const target = String(email || getPendingVerificationEmail()).trim().toLowerCase();
    if (!target) throw new Error('اكتب بريدك الإلكتروني الأول.');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: target,
      options: { emailRedirectTo: appUrl('/dashboard') },
    });
    if (error) throw error;
    setPendingVerificationEmail(target);
  }

  async function login(email, password, rememberMe = true) {
    ensureSupabase();
    setRememberMePreference(rememberMe);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error('تعذر تسجيل الدخول.');

    setPendingVerificationEmail('');
    authUserIdRef.current = data.user.id;
    setUser(normalizeUser(data.user));
    const admin = await loadProfile(data.user);
    return { user: normalizeUser(data.user), isAdmin: admin };
  }

  async function resetPassword(email) {
    ensureSupabase();
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: appUrl('/update-password') },
    );
    if (error) throw error;
    return data;
  }

  async function logout() {
    ensureSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    authUserIdRef.current = null;
    setUser(null);
    setIsAdmin(false);
  }

  async function refreshClaims() {
    ensureSupabase();
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();
    if (error || !currentUser) {
      setIsAdmin(false);
      return false;
    }
    authUserIdRef.current = currentUser.id;
    return loadProfile(currentUser);
  }

  // The action functions only use refs, state setters and the Supabase client,
  // so re-creating the context value on user/isAdmin/loading changes is enough.
  const value = useMemo(() => ({
    user,
    isAdmin,
    loading,
    signup,
    resendVerification,
    login,
    resetPassword,
    logout,
    refreshClaims,
  }), [user, isAdmin, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
