import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X, BookOpen } from 'lucide-react';
import Sidebar from './Sidebar';
import { useTranslation } from '../lib/translations';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t, isTa } = useTranslation();

  useEffect(() => { setSidebarOpen(false); }, [location]);

  return (
    <div className="dashboard-layout">
      {/* GIGW: skip navigation — must be first focusable element */}
      <a href="#main-content" className="skip-nav">
        {isTa ? 'முக்கிய உள்ளடக்கத்திற்கு தாவு' : 'Skip to main content'}
      </a>

      {/* Mobile Header */}
      <header className="mobile-header" role="banner">
        <div className="sidebar-logo mobile-logo">
          <div className="sidebar-logo-icon" style={{ width: 30, height: 30 }}>
            <BookOpen size={16} />
          </div>
          <div>
            <span className="sidebar-logo-text" style={{ fontSize: 15 }}>NEET AI</span>
            {isTa && <p style={{ fontSize: '9px', color: '#64748b', margin: 0, lineHeight: 1 }}>தமிழ்நாடு அரசு</p>}
          </div>
        </div>
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle Menu">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main id="main-content" className="dashboard-main" aria-label={isTa ? 'முக்கிய உள்ளடக்கம்' : 'Main content'}>
        {/* TN Government branding bar — shown to all students */}
        <div style={{
          background: 'linear-gradient(90deg, #1a0533 0%, #0f172a 40%, #0a1628 100%)',
          borderBottom: '1px solid rgba(99,102,241,0.2)',
          padding: '6px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* TN emblem placeholder */}
            <div role="img" aria-label="Tamil Nadu Government Emblem" style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 800, color: '#1a0533', flexShrink: 0,
            }}>TN</div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', margin: 0, lineHeight: 1.3 }}>
                {isTa ? 'தமிழ்நாடு அரசின் முன்முயற்சி' : 'An initiative of the Government of Tamil Nadu'}
              </p>
              {isTa && (
                <p style={{ fontSize: '9px', color: '#64748b', margin: 0, lineHeight: 1.2 }}>
                  An initiative of the Government of Tamil Nadu
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>
              {isTa ? '100% இந்தியாவில் இயங்குகிறது' : '100% India-hosted · No data leaves India'}
            </span>
            <div role="status" aria-label="All systems online" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
          </div>
        </div>

        <Outlet />
      </main>

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
    </div>
  );
}
