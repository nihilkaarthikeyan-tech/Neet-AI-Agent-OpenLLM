import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, MessageCircle, ClipboardList, Layers,
  BarChart3, Camera, Phone, LogOut, BookOpen, BookMarked, Flame,
  GraduationCap, Trophy, X, GitMerge, Heart, TrendingUp, Stethoscope,
  Briefcase, Users, Zap, Timer, Sparkles, ScanLine, Languages, AlertTriangle, Award, Lightbulb,
  BarChart2, School, Medal, ListChecks, FileText, CalendarDays, RotateCcw,
  Globe, Users2, ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../lib/translations';

interface SidebarProps { isOpen?: boolean; onClose?: () => void; }

// Static route-to-group key map used for auto-expansion (avoids navGroups dependency)
const ROUTE_GROUP_MAP: Array<{ key: string; prefixes: string[]; exact?: boolean }> = [
  { key: 'overview',      prefixes: ['/dashboard'], exact: true },
  { key: 'study',         prefixes: ['/dashboard/planner', '/dashboard/tutor', '/dashboard/tests', '/dashboard/flashcards', '/dashboard/pyq', '/dashboard/ncert', '/dashboard/vocabulary', '/dashboard/strategy', '/dashboard/learning-tools', '/dashboard/chapter-tracker', '/dashboard/notes', '/dashboard/pomodoro'] },
  { key: 'intelligence',  prefixes: ['/dashboard/outcomes', '/dashboard/progress', '/dashboard/nta', '/dashboard/microlesson', '/dashboard/diagnostic'] },
  { key: 'tn_guidance',   prefixes: ['/dashboard/samacheer', '/dashboard/counselling', '/dashboard/career', '/dashboard/wellbeing'] },
  { key: 'teachers',      prefixes: ['/dashboard/teacher'] },
  { key: 'community',     prefixes: ['/dashboard/community', '/dashboard/pods', '/dashboard/parent-link'] },
  { key: 'tools',         prefixes: ['/dashboard/analytics', '/dashboard/performance', '/dashboard/rank-predictor', '/dashboard/gamification', '/dashboard/heatmap', '/dashboard/quick-revise', '/dashboard/photo-doubt', '/dashboard/snap', '/dashboard/voice', '/dashboard/motivation'] },
];

function getActiveGroupKey(pathname: string): string | null {
  for (const { key, prefixes, exact } of ROUTE_GROUP_MAP) {
    const hit = exact
      ? prefixes.includes(pathname)
      : prefixes.some(p => pathname.startsWith(p));
    if (hit) return key;
  }
  return null;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isTa } = useTranslation();

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  const navGroups = [
    {
      key: 'overview',
      label: t('nav_overview'),
      items: [
        { to: '/dashboard', label: t('dashboard'), icon: <LayoutDashboard size={17} />, end: true },
      ],
    },
    {
      key: 'study',
      label: t('nav_study'),
      items: [
        { to: '/dashboard/planner',          label: t('study_planner'),      icon: <Calendar size={17} /> },
        { to: '/dashboard/tutor',            label: t('ai_tutor'),           icon: <MessageCircle size={17} /> },
        { to: '/dashboard/tests',            label: t('mock_tests'),         icon: <ClipboardList size={17} /> },
        { to: '/dashboard/flashcards',       label: t('flashcards'),         icon: <Layers size={17} /> },
        { to: '/dashboard/pyq',              label: t('pyq_bank'),           icon: <BookMarked size={17} /> },
        { to: '/dashboard/ncert',            label: t('ncert_coverage'),     icon: <GraduationCap size={17} /> },
        { to: '/dashboard/ncert-exceptions', label: t('ncert_exceptions'),   icon: <AlertTriangle size={17} /> },
        { to: '/dashboard/vocabulary',       label: t('vocabulary_trainer'), icon: <Languages size={17} /> },
        { to: '/dashboard/strategy',         label: t('exam_strategy'),      icon: <Trophy size={17} /> },
        { to: '/dashboard/learning-tools',   label: t('learning_tools'),     icon: <Lightbulb size={17} /> },
        { to: '/dashboard/chapter-tracker',  label: t('chapter_tracker'),    icon: <ListChecks size={17} /> },
        { to: '/dashboard/notes',            label: t('study_notes'),        icon: <FileText size={17} /> },
        { to: '/dashboard/pomodoro',         label: t('pomodoro'),           icon: <Timer size={17} /> },
      ],
    },
    {
      key: 'intelligence',
      label: t('nav_intelligence'),
      items: [
        { to: '/dashboard/outcomes',    label: t('outcomes'),         icon: <Award size={17} /> },
        { to: '/dashboard/progress',    label: t('progress_heatmap'), icon: <TrendingUp size={17} /> },
        { to: '/dashboard/nta',         label: t('nta_simulator'),    icon: <Timer size={17} /> },
        { to: '/dashboard/microlesson', label: t('daily_lesson'),     icon: <Sparkles size={17} /> },
        { to: '/dashboard/diagnostic',  label: t('diagnostic_test'),  icon: <Zap size={17} /> },
      ],
    },
    {
      key: 'tn_guidance',
      label: t('nav_tn_guidance'),
      items: [
        { to: '/dashboard/samacheer',   label: t('samacheer_neet'), icon: <GitMerge size={17} /> },
        { to: '/dashboard/counselling', label: t('tn_counselling'), icon: <Stethoscope size={17} /> },
        { to: '/dashboard/career',      label: t('career_paths'),   icon: <Briefcase size={17} /> },
        { to: '/dashboard/wellbeing',   label: t('wellbeing'),      icon: <Heart size={17} /> },
      ],
    },
    {
      key: 'teachers',
      label: t('nav_teachers'),
      items: [
        { to: '/dashboard/teacher', label: t('teacher_portal'), icon: <Users size={17} /> },
      ],
    },
    {
      key: 'community',
      label: t('nav_community'),
      items: [
        { to: '/dashboard/community',   label: t('community'),   icon: <Globe size={17} /> },
        { to: '/dashboard/pods',        label: t('study_pods'),  icon: <Users2 size={17} /> },
        { to: '/dashboard/parent-link', label: t('parent_link'), icon: <Heart size={17} /> },
      ],
    },
    {
      key: 'tools',
      label: t('nav_tools'),
      items: [
        { to: '/dashboard/analytics',      label: t('analytics'),       icon: <BarChart3 size={17} /> },
        { to: '/dashboard/performance',    label: t('performance'),      icon: <BarChart2 size={17} /> },
        { to: '/dashboard/rank-predictor', label: t('rank_predictor'),   icon: <School size={17} /> },
        { to: '/dashboard/gamification',   label: t('gamification'),     icon: <Medal size={17} /> },
        { to: '/dashboard/heatmap',        label: t('revision_heatmap'), icon: <CalendarDays size={17} /> },
        { to: '/dashboard/quick-revise',   label: t('quick_revise'),     icon: <RotateCcw size={17} /> },
        { to: '/dashboard/photo-doubt',    label: t('photo_doubt'),      icon: <Camera size={17} /> },
        { to: '/dashboard/snap',           label: t('snap_textbook'),    icon: <ScanLine size={17} /> },
        { to: '/dashboard/voice',          label: t('voice_tutor'),      icon: <Phone size={17} /> },
        { to: '/dashboard/motivation',     label: t('motivation'),       icon: <Flame size={17} /> },
      ],
    },
  ];

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(['overview', 'study'])
  );

  // Auto-expand the group that contains the current route
  useEffect(() => {
    const key = getActiveGroupKey(location.pathname);
    if (key) {
      setOpenGroups(prev => prev.has(key) ? prev : new Set([...prev, key]));
    }
  }, [location.pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      <button className="sidebar-close-btn" onClick={onClose} aria-label="Close Sidebar">
        <X size={18} />
      </button>

      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <BookOpen size={18} />
        </div>
        <div>
          <span className="sidebar-logo-text">NEET AI</span>
          <p className="sidebar-logo-tagline">
            {isTa ? 'தமிழ்நாடு அரசு தளம்' : 'Tamil Nadu Govt. Platform'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label={isTa ? 'பக்கவாட்டு வழிசெலுத்தல்' : 'Sidebar navigation'}>
        {navGroups.map((group) => {
          const isGroupOpen = openGroups.has(group.key);
          return (
            <div key={group.key}>
              <button
                className="sidebar-group-header"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isGroupOpen}
                aria-controls={`nav-group-${group.key}`}
              >
                <span className="sidebar-group-label">{group.label}</span>
                <ChevronDown
                  size={13}
                  className={`sidebar-group-chevron${isGroupOpen ? ' sidebar-group-chevron--open' : ''}`}
                />
              </button>

              {isGroupOpen && (
                <div id={`nav-group-${group.key}`} className="sidebar-group-items">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={'end' in item ? item.end : undefined}
                      className={({ isActive }) =>
                        `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
                      }
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Language switcher */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '0.25rem' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(148,163,184,0.5)', padding: '0.5rem 0.75rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('lang_label')} / Language
        </p>
        <LanguageSwitcher />
      </div>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.name ?? (isTa ? 'மாணவர்' : 'Student')}</p>
            <p className="sidebar-user-email">{user?.email}</p>
          </div>
        </div>
        <button
          id="logout-btn"
          className="sidebar-logout"
          onClick={handleLogout}
          aria-label={t('logout')}
          title={t('logout')}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
