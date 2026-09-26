import { createClient } from '@supabase/supabase-js';

const REMEMBER_ME_KEY = 'naqla_remember_me';
const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabasePublishableKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || '',
).trim();

function hasWindowStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage) && Boolean(window.sessionStorage);
}

export function getRememberMePreference() {
  if (!hasWindowStorage()) return true;
  return window.localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
}

function isSupabaseAuthKey(key) {
  return String(key || '').startsWith('sb-');
}

function moveAuthItems(source, destination) {
  const items = [];

  for (let index = 0; index < source.length; index += 1) {
    const key = source.key(index);
    if (key && isSupabaseAuthKey(key)) {
      items.push([key, source.getItem(key)]);
    }
  }

  items.forEach(([key, value]) => {
    if (value != null) destination.setItem(key, value);
    source.removeItem(key);
  });
}

export function setRememberMePreference(rememberMe) {
  if (!hasWindowStorage()) return;

  const shouldRemember = Boolean(rememberMe);
  window.localStorage.setItem(REMEMBER_ME_KEY, shouldRemember ? 'true' : 'false');

  if (shouldRemember) {
    moveAuthItems(window.sessionStorage, window.localStorage);
  } else {
    moveAuthItems(window.localStorage, window.sessionStorage);
  }
}

const authStorage = {
  getItem(key) {
    if (!hasWindowStorage()) return null;
    const primary = getRememberMePreference() ? window.localStorage : window.sessionStorage;
    return primary.getItem(key);
  },
  setItem(key, value) {
    if (!hasWindowStorage()) return;
    const remember = getRememberMePreference();
    const primary = remember ? window.localStorage : window.sessionStorage;
    const secondary = remember ? window.sessionStorage : window.localStorage;
    primary.setItem(key, value);
    secondary.removeItem(key);
  },
  removeItem(key) {
    if (!hasWindowStorage()) return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabaseConfigured =
  supabaseUrl.startsWith('https://')
  && supabaseUrl.includes('.supabase.co')
  && supabasePublishableKey.length > 20;

export const supabaseConfigError = supabaseConfigured
  ? ''
  : 'بيانات Supabase ناقصة أو مكتوبة بشكل غير صحيح داخل ملف .env';

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // This is a browser-only SPA. Implicit recovery links work even when the
        // student opens the email on another browser/device, unlike PKCE which
        // requires the locally-stored code verifier from the initiating browser.
        flowType: 'implicit',
        storage: authStorage,
      },
    })
  : null;
