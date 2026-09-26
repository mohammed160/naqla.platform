import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_LOGIN_PATH, adminPath } from '../config/adminPortal';

const links = [
  ['', 'نظرة عامة', '⌂'],
  ['courses', 'الكورسات', '▦'],
  ['plan', 'الاشتراك والأعضاء', '∞'],
  ['lectures', 'المحاضرات والماتريال', '▶'],
  ['codes', 'أكواد التفعيل', '#'],
  ['payments', 'المدفوعات', '◉'],
  ['reviews', 'آراء الطلبة', '★'],
  ['content', 'محتوى المنصة', '✎'],
  ['users', 'الطلاب والصلاحيات', '◎'],
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate(ADMIN_LOGIN_PATH, { replace: true });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img className="brand-media" src="/brand/logo-mark.svg" alt="" style={{ "--brand-media-size": "40px" }} />
          <div><b>نقلة</b><small>Private Admin Center</small></div>
        </div>
        <nav>
          {links.map(([suffix, label, icon]) => {
            const to = adminPath(suffix);
            return (
              <NavLink key={to} to={to} end={!suffix}>
                <i>{icon}</i><span>{label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="admin-profile">
          <span>{(user?.displayName || user?.email || 'A').slice(0, 1).toUpperCase()}</span>
          <div><b>{user?.displayName || 'Admin'}</b><small>{user?.email}</small></div>
          <button type="button" onClick={handleLogout}>خروج</button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div><span className="live-dot" /> النظام متصل — بوابة خاصة</div>
          <a href="/" target="_blank" rel="noreferrer" className="btn ghost compact">معاينة المنصة ↗</a>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
