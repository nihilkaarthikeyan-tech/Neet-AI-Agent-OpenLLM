import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  MessageCircle,
  ClipboardList,
  Layers,
  BarChart3,
  Camera,
  Phone,
  LogOut,
  BookOpen,
  BookMarked,
  Flame,
  GraduationCap,
  Trophy,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type NavItem = { to: string; label: string; icon: React.ReactElement; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} />, end: true },
    ],
  },
  {
    label: 'Study',
    items: [
      { to: '/dashboard/planner',   label: 'Study Planner', icon: <Calendar size={17} /> },
      { to: '/dashboard/tutor',     label: 'AI Tutor',      icon: <MessageCircle size={17} /> },
      { to: '/dashboard/tests',     label: 'Mock Tests',    icon: <ClipboardList size={17} /> },
      { to: '/dashboard/flashcards',label: 'Flashcards',    icon: <Layers size={17} /> },
      { to: '/dashboard/pyq',       label: 'PYQ Bank',      icon: <BookMarked size={17} /> },
      { to: '/dashboard/ncert',     label: 'NCERT Coverage',icon: <GraduationCap size={17} /> },
      { to: '/dashboard/strategy',  label: 'Exam Strategy', icon: <Trophy size={17} /> },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/dashboard/analytics',   label: 'Analytics',    icon: <BarChart3 size={17} /> },
      { to: '/dashboard/photo-doubt', label: 'Photo Doubt',  icon: <Camera size={17} /> },
      { to: '/dashboard/voice',       label: 'Voice Tutor',  icon: <Phone size={17} /> },
      { to: '/dashboard/motivation',  label: 'Motivation',   icon: <Flame size={17} /> },
    ],
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      {/* Mobile close */}
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
          <p className="sidebar-logo-tagline">AI-powered prep platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="sidebar-section-label">{group.label}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.name ?? 'Student'}</p>
            <p className="sidebar-user-email">{user?.email}</p>
          </div>
        </div>
        <button
          id="logout-btn"
          className="sidebar-logout"
          onClick={handleLogout}
          aria-label="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
