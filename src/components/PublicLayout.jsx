import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import BrandMedia from './BrandMedia';
import MobileFloatingDock from './MobileFloatingDock';
import { defaultSiteSettings, normalizeSiteSettings } from '../config/siteDefaults';

function isExternal(url = '') {
  return /^(https?:)?\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('tel:');
}

function SmartLink({ item, children, className = '', onClick }) {
  if (!item?.url) return null;

  let targetUrl = item.url;
  // If this is the courses link or matches #courses, route to the dedicated /courses page
  if (item.id === 'courses' || targetUrl === '/#courses' || targetUrl === '#courses' || item.label === 'الكورسات') {
    targetUrl = '/courses';
  }

  if (isExternal(targetUrl)) {
    return (
      <a className={className} href={targetUrl} target={item.newTab === false ? undefined : '_blank'} rel="noreferrer" onClick={onClick}>
        {children ?? item.label}
      </a>
    );
  }

  if (targetUrl.startsWith('/#')) {
    return <a className={className} href={targetUrl} onClick={onClick}>{children ?? item.label}</a>;
  }

  return <Link className={className} to={targetUrl} onClick={onClick}>{children ?? item.label}</Link>;
}

function FooterLink({ link }) {
  return <SmartLink item={link}>{link.label}</SmartLink>;
}

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState(defaultSiteSettings);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('site_settings')
        .select('settings')
        .eq('id', 'public')
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error('Site settings loading error:', error);
        return;
      }
      if (data?.settings) setSettings(normalizeSiteSettings(data.settings));
    }

    function handleSettingsUpdated(event) {
      if (event.detail) setSettings(normalizeSiteSettings(event.detail));
    }

    loadSettings();
    window.addEventListener('naqla-settings-updated', handleSettingsUpdated);
    return () => {
      active = false;
      window.removeEventListener('naqla-settings-updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    document.title = settings.seoTitle || settings.siteName || 'نقلة';
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', settings.seoDescription || settings.footerText || '');
  }, [settings.seoTitle, settings.seoDescription, settings.siteName, settings.footerText]);

  useEffect(() => {
    if (!settings.animationSettings?.enabled || !settings.animationSettings?.cursorGlow) return undefined;

    function updatePointer(event) {
      document.documentElement.style.setProperty('--pointer-x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--pointer-y', `${event.clientY}px`);
    }

    window.addEventListener('pointermove', updatePointer, { passive: true });
    return () => window.removeEventListener('pointermove', updatePointer);
  }, [settings.animationSettings]);

  const copyright = useMemo(() => {
    const template = settings.footerCopyright || defaultSiteSettings.footerCopyright;
    return template
      .replaceAll('{year}', String(new Date().getFullYear()))
      .replaceAll('{siteName}', settings.siteName || defaultSiteSettings.siteName);
  }, [settings.footerCopyright, settings.siteName]);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const visibleNavLinks = (settings.navLinks || []).filter((item) => item.visible !== false && item.label && item.url);
  const shellClasses = [
    'public-shell',
    settings.animationSettings?.enabled ? 'motion-enabled' : 'motion-disabled',
    `motion-intensity-${settings.animationSettings?.intensity || 'high'}`,
    settings.animationSettings?.cursorGlow ? 'cursor-glow-enabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={shellClasses}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      {settings.animationSettings?.cursorGlow && <div className="cursor-glow" aria-hidden="true" />}

      <header className="site-header">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <BrandMedia settings={settings} />
          <span>{settings.siteName}</span>
        </Link>

        <nav className="desktop-nav">
          {visibleNavLinks.map((item) => (
            <SmartLink key={item.id || `${item.label}-${item.url}`} item={item}>
              {item.label}
            </SmartLink>
          ))}
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <Link className="btn ghost compact" to="/dashboard">{settings.headerDashboardText || 'لوحتي'}</Link>
              <button className="btn text compact" type="button" onClick={handleLogout}>خروج</button>
            </>
          ) : (
            <>
              <Link className="btn text compact" to="/login">{settings.headerLoginText || 'دخول'}</Link>
              <Link className="btn primary compact" to="/signup">{settings.headerSignupText || 'ابدأ الآن'}</Link>
            </>
          )}
        </div>

        <div className="mobile-header-right">
          {user ? (
            <Link className="mobile-quick-btn" to="/dashboard" aria-label="لوحة التحكم">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>{settings.headerDashboardText || 'لوحتي'}</span>
            </Link>
          ) : (
            <Link className="mobile-quick-btn" to="/login" aria-label="تسجيل الدخول">
              <span>{settings.headerLoginText || 'دخول'}</span>
            </Link>
          )}

          <button
            className={`mobile-menu ${menuOpen ? 'is-open' : ''}`}
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation-drawer"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      <div className={`mobile-nav-layer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <button className="mobile-nav-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} />
        <aside id="mobile-navigation-drawer" className="mobile-nav-drawer" aria-label="القائمة الرئيسية">
          <div className="mobile-nav-head">
            <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
              <BrandMedia settings={settings} />
              <span>{settings.siteName}</span>
            </Link>
            <button className="mobile-nav-close" type="button" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة">×</button>
          </div>

          <nav className="mobile-nav-links">
            {visibleNavLinks.map((item) => (
              <SmartLink key={item.id || `${item.label}-${item.url}`} item={item} onClick={() => setMenuOpen(false)}>
                <span>{item.label}</span><b>←</b>
              </SmartLink>
            ))}
          </nav>

          <div className="mobile-nav-actions">
            {user ? (
              <>
                <Link className="btn primary full" to="/dashboard" onClick={() => setMenuOpen(false)}>{settings.headerDashboardText || 'لوحتي'}</Link>
                <button className="btn ghost full" type="button" onClick={async () => { setMenuOpen(false); await handleLogout(); }}>خروج</button>
              </>
            ) : (
              <>
                <Link className="btn primary full" to="/signup" onClick={() => setMenuOpen(false)}>{settings.headerSignupText || 'ابدأ الآن'}</Link>
                <Link className="btn ghost full" to="/login" onClick={() => setMenuOpen(false)}>{settings.headerLoginText || 'دخول'}</Link>
              </>
            )}
          </div>
        </aside>
      </div>

      {!supabaseConfigured && (
        <div className="setup-banner" role="status">
          وضع العرض: بيانات Supabase غير مضافة. انسخ <code dir="ltr">.env.example</code> إلى <code dir="ltr">.env</code> وأضف بياناتك ثم أعد تشغيل <code dir="ltr">npm run dev</code>.
        </div>
      )}
      {settings.announcement?.enabled && settings.announcement?.text && (
        <div className="site-announcement">
          <span>{settings.announcement.text}</span>
          {settings.announcement.url && (
            <SmartLink item={{
              label: settings.announcement.buttonText || 'اعرف أكثر',
              url: settings.announcement.url,
              newTab: settings.announcement.newTab,
            }}>
              {settings.announcement.buttonText || 'اعرف أكثر'} ↗
            </SmartLink>
          )}
        </div>
      )}

      <Outlet context={{ settings }} />

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-about">
            <Link to="/" className="brand footer-brand">
              <BrandMedia settings={settings} footer />
              <span>{settings.footerTitle || settings.siteName}</span>
            </Link>
            <p>{settings.footerText}</p>
          </div>

          <div className="footer-link-sections">
            {(settings.footerSections || []).map((section) => (
              <section className="footer-link-column" key={section.id || section.title}>
                <h3>{section.title}</h3>
                <div>
                  {(section.links || []).map((link) => <FooterLink key={link.id || `${link.label}-${link.url}`} link={link} />)}
                </div>
              </section>
            ))}
          </div>

          {(settings.socialLinks || []).some((item) => item.url) && (
            <section className="footer-social-column">
              <h3>{settings.footerSocialTitle || 'تابعنا على'}</h3>
              <div className="social-links">
                {(settings.socialLinks || []).map((item) => item.url ? (
                  <a key={item.id || `${item.label}-${item.url}`} href={item.url} target={item.newTab === false ? undefined : '_blank'} rel="noreferrer" aria-label={item.label}>
                    <span>{(item.label || 'S').trim().slice(0, 2).toUpperCase()}</span>
                    {item.label}
                  </a>
                ) : null)}
              </div>
            </section>
          )}
        </div>

        <div className="footer-bottom"><small>{copyright}</small></div>
      </footer>

      {/* Trendy Mobile Floating Glass Island / Dock */}
      <MobileFloatingDock />
    </div>
  );
}
