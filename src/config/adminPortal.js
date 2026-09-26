function normalizeAdminBase(value) {
  let raw = String(value || '/admin.1').trim();
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      raw = url.pathname;
    } catch (_) {
      raw = raw.replace(/^https?:\/\/[^/]+/, '');
    }
  }
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/admin.1';
}

export const ADMIN_BASE = normalizeAdminBase(import.meta.env.VITE_ADMIN_PORTAL_PATH);
export const ADMIN_ROUTE_SEGMENT = ADMIN_BASE.replace(/^\/+/, '');
export const ADMIN_LOGIN_PATH = `${ADMIN_BASE}/login`;

export function adminPath(suffix = '') {
  const cleanSuffix = String(suffix || '').replace(/^\/+/, '');
  return cleanSuffix ? `${ADMIN_BASE}/${cleanSuffix}` : ADMIN_BASE;
}
