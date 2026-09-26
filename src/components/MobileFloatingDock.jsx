import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function MobileFloatingDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');

  // Update active tab based on route and hash
  useEffect(() => {
    const path = location.pathname;
    const hash = location.hash;

    if (path.startsWith('/join') || path.startsWith('/courses')) {
      setActiveTab('join');
    } else if (path.startsWith('/faq') || path.startsWith('/projects')) {
      setActiveTab('faq');
    } else if (hash === '#free') {
      setActiveTab('free');
    } else if (path === '/' && !hash) {
      setActiveTab('home');
    } else {
      setActiveTab('');
    }
  }, [location.pathname, location.hash]);

  const navItems = [
    {
      id: 'home',
      label: 'الرئيسية',
      url: '/',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      id: 'free',
      label: 'المحاضرات',
      url: '/#free',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      ),
    },
    {
      id: 'faq',
      label: 'الأسئلة',
      url: '/faq',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5"/>
          <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 3.9"/>
          <path d="M12 17.2h.01"/>
        </svg>
      ),
    },
    {
      id: 'join',
      label: 'الاشتراك',
      url: '/join',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      ),
    },
  ];

  const handleNavClick = (item) => {
    setActiveTab(item.id);

    if (item.url === '/') {
      if (location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
    } else if (item.url.startsWith('/#')) {
      const sectionId = item.url.replace('/#', '');
      if (location.pathname === '/') {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          window.history.pushState(null, '', item.url);
        }
      } else {
        navigate('/');
        setTimeout(() => {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 150);
      }
    } else {
      navigate(item.url);
    }
  };

  return (
    <aside className="mobile-floating-dock-wrapper" aria-label="شريط التنقل السريع">
      {/* Laser aura behind dock */}
      <div className="dock-laser-aura" aria-hidden="true" />

      <nav className="mobile-floating-dock">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`dock-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item)}
              aria-label={item.label}
            >
              {/* Active Animated Pill Background */}
              {isActive && (
                <motion.div
                  layoutId="dockActivePill"
                  className="dock-active-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}

              <div className="dock-icon-box">
                {item.icon}
                {item.badge && <span className="dock-badge">{item.badge}</span>}
              </div>

              <span className="dock-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
