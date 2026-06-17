import { useState, useEffect } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import {
  Menu, X, BookOpen,
  LayoutDashboard, BookOpen as BookOpenIcon, Brain, ClipboardList, MoreHorizontal,
} from 'lucide-react';
import Sidebar from './Sidebar';
import { useTranslation } from '../lib/translations';

// ─── Mobile bottom tab bar ────────────────────────────────────────────────────
interface BottomTabBarProps { onMore: () => void; isTa: boolean; }

function BottomTabBar({ onMore, isTa }: BottomTabBarProps) {
  const location = useLocation();
  const p = location.pathname;

  const tabs = [
    { to: '/dashboard',       label: isTa ? 'முகப்பு'    : 'Home',    icon: <LayoutDashboard size={20} />, exact: true },
    { to: '/dashboard/planner', label: isTa ? 'திட்டம்'  : 'Planner', icon: <BookOpenIcon size={20} /> },
    { to: '/dashboard/tutor', label: isTa ? 'AI ஆசிரியர்' : 'Tutor',  icon: <Brain size={20} /> },
    { to: '/dashboard/tests', label: isTa ? 'தேர்வு'     : 'Tests',   icon: <ClipboardList size={20} /> },
  ];

  return (
    <nav className="bottom-tab-bar" aria-label={isTa ? 'கீழ் வழிசெலுத்தல்' : 'Bottom navigation'}>
      {tabs.map(tab => {
        const isActive = tab.exact ? p === tab.to : p.startsWith(tab.to);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.exact}
            className={`tab-item${isActive ? ' tab-item--active' : ''}`}
          >
            <div className="tab-icon-wrap">{tab.icon}</div>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        );
      })}
      {/* More button — opens full sidebar */}
      <button
        className="tab-item"
        onClick={onMore}
        aria-label={isTa ? 'மேலும்' : 'More'}
      >
        <div className="tab-icon-wrap">
          <MoreHorizontal size={20} />
        </div>
        <span className="tab-label">{isTa ? 'மேலும்' : 'More'}</span>
      </button>
    </nav>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t, isTa } = useTranslation();

  useEffect(() => { setSidebarOpen(false); }, [location]);

  return (
    <div className="dashboard-layout">
      {/* GIGW: skip navigation */}
      <a href="#main-content" className="skip-nav">
        {isTa ? 'முக்கிய உள்ளடக்கத்திற்கு தாவு' : 'Skip to main content'}
      </a>

      {/* Mobile header */}
      <header className="mobile-header" role="banner">
        <div className="sidebar-logo mobile-logo">
          <div className="sidebar-logo-icon" style={{ width: 30, height: 30 }}>
            <BookOpen size={16} />
          </div>
          <div>
            <span className="sidebar-logo-text" style={{ fontSize: 15 }}>NEET AI</span>
            {isTa && (
              <p style={{ fontSize: '9px', color: '#64748b', margin: 0, lineHeight: 1 }}>
                தமிழ்நாடு அரசு
              </p>
            )}
          </div>
        </div>
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={isTa ? 'பட்டியல் திற' : 'Toggle Menu'}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main id="main-content" className="dashboard-main" aria-label={isTa ? 'முக்கிய உள்ளடக்கம்' : 'Main content'}>
        {/* TN Government branding bar */}
        <div className="tn-bar" role="banner" aria-label="Government of Tamil Nadu">
          <div className="tn-bar-left">
            <div className="tn-emblem" role="img" aria-label="Tamil Nadu Government Emblem">
              TN
            </div>
            <div>
              <p className="tn-bar-title">
                {isTa ? 'தமிழ்நாடு அரசின் முன்முயற்சி' : 'Government of Tamil Nadu Initiative'}
              </p>
              <p className="tn-bar-sub">
                {isTa
                  ? 'Government of Tamil Nadu · NEET AI Study Platform'
                  : 'Free · Secure · For every student in Tamil Nadu'}
              </p>
            </div>
          </div>
          <div className="tn-bar-right">
            <span className="tn-badge tn-badge--nta">NTA Aligned</span>
            <span className="tn-badge tn-badge--secure">
              <span className="tn-status-dot" aria-hidden="true" />
              India-hosted
            </span>
          </div>
        </div>

        <Outlet />
      </main>

      {/* Desktop footer */}
      <footer className="dashboard-footer" role="contentinfo">
        <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px' }} aria-hidden="true">🏛️</span>
          {t('footer_initiative')} · &copy; 2026 NEET AI
        </p>
        <nav aria-label={isTa ? 'அடிக்குறிப்பு இணைப்புகள்' : 'Footer links'} className="footer-links">
          <a href="/privacy">{t('footer_privacy')}</a>
          <a href="mailto:support@neetai.tn.gov.in">{t('footer_support')}</a>
          {isTa && <a href="mailto:support@neetai.tn.gov.in">தொடர்பு கொள்ளுங்கள்</a>}
        </nav>
      </footer>

      {/* Mobile bottom tab bar */}
      <BottomTabBar onMore={() => setSidebarOpen(true)} isTa={isTa} />
    </div>
  );
}
