function normalizeAdminBase(value) {
  const raw = String(value || '/naqla-studio-x7k').trim();
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/naqla-studio-x7k';
}

export const ADMIN_BASE = normalizeAdminBase(import.meta.env.VITE_ADMIN_PORTAL_PATH);
export const ADMIN_ROUTE_SEGMENT = ADMIN_BASE.replace(/^\/+/, '');
export const ADMIN_LOGIN_PATH = `${ADMIN_BASE}/login`;

export function adminPath(suffix = '') {
  const cleanSuffix = String(suffix || '').replace(/^\/+/, '');
  return cleanSuffix ? `${ADMIN_BASE}/${cleanSuffix}` : ADMIN_BASE;
}
