import { useEffect, useState } from 'react';
import { BookOpen, Brain, Target, Zap, TrendingUp, Star, ArrowRight, Play, ChevronRight, AlertCircle, Lightbulb, Atom, Dna } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const quickLinks = [
  {
    to: '/dashboard/planner',
    icon: <BookOpen size={22} />,
    label: 'Study Planner',
    desc: 'Your personalised daily schedule',
    color: 'card-blue',
  },
  {
    to: '/dashboard/tutor',
    icon: <Brain size={22} />,
    label: 'AI Tutor',
    desc: 'Ask doubts — Physics, Chem, Bio',
    color: 'card-purple',
  },
  {
    to: '/dashboard/tests',
    icon: <Target size={22} />,
    label: 'Mock Tests',
    desc: 'Full NEET 180Q timed exams',
    color: 'card-green',
  },
  {
    to: '/dashboard/voice',
    icon: <Zap size={22} />,
    label: 'Voice Tutor',
    desc: 'Live AI voice conversation',
    color: 'card-orange',
  },
];

interface Stats {
  testsTaken: number;
  avgScore: number | null;
  flashcardCount: number;
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(percent, 100) / 100);
  const isLow      = percent < 40;
  const isComplete = percent >= 100;

  const svgClass = [
    'progress-ring-svg',
    isLow      ? 'ring-state-low'      : '',
    isComplete ? 'ring-state-complete' : '',
  ].filter(Boolean).join(' ');

  // Arc stroke: amber when low, green when complete, indigo otherwise
  const arcStroke = isComplete ? 'url(#ringGradComplete)' : isLow ? 'url(#ringGradLow)' : 'url(#ringGrad)';
  const labelColor = isComplete ? '#6ee7b7' : isLow ? '#fcd34d' : 'white';

  return (
    <svg width="80" height="80" viewBox="0 0 72 72" className={svgClass}>
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
        <linearGradient id="ringGradLow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient id="ringGradComplete" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={arcStroke} strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        className="ring-arc"
      />
      <text x="36" y="39" textAnchor="middle" fill={labelColor} fontSize="13" fontWeight="800" fontFamily="Inter, sans-serif">
        {isComplete ? '✓' : `${percent}%`}
      </text>
    </svg>
  );
}

function SubjectConstellation() {
  return (
    <div className="constellation-card">
      <div className="constellation-info">
        <p className="constellation-title">Your Study Universe</p>
        <p className="constellation-sub">Three subjects. One goal. Tap to jump in.</p>
        <div className="constellation-legend">
          <span className="cleg cleg-physics">Physics</span>
          <span className="cleg cleg-chemistry">Chemistry</span>
          <span className="cleg cleg-biology">Biology</span>
        </div>
      </div>
      <div className="constellation-stage">
        {/* Orbit paths */}
        <div className="c-orbit-path" style={{ width: 136, height: 136 }} />
        <div className="c-orbit-path" style={{ width: 184, height: 184 }} />
        <div className="c-orbit-path" style={{ width: 232, height: 232 }} />

        {/* Center hub */}
        <div className="c-center">
          <Brain size={22} />
        </div>

        {/* Physics */}
        <div className="c-orbit c-orbit-1">
          <Link to="/dashboard/tutor" className="c-node c-node-physics c-counter-1">
            <Zap size={13} />
            <span>Physics</span>
          </Link>
        </div>

        {/* Chemistry */}
        <div className="c-orbit c-orbit-2">
          <Link to="/dashboard/tutor" className="c-node c-node-chemistry c-counter-2">
            <Atom size={13} />
            <span>Chemistry</span>
          </Link>
        </div>

        {/* Biology */}
        <div className="c-orbit c-orbit-3">
          <Link to="/dashboard/tutor" className="c-node c-node-biology c-counter-3">
            <Dna size={13} />
            <span>Biology</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] ?? 'Student';
  const [stats, setStats] = useState<Stats>({ testsTaken: 0, avgScore: null, flashcardCount: 0 });

  useEffect(() => {
    api.get<Stats>('/api/stats')
      .then(setStats)
      .catch(() => {/* keep defaults on error */});
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const studyStreak = 7;
  const todayGoal = 85;

  return (
    <div className="page-container">

      {/* ── Welcome Banner ── */}
      <div className="welcome-banner">
        <div className="welcome-left">
          <p className="welcome-greeting">{greeting}</p>
          <h1 className="welcome-name">{firstName}</h1>
          <p className="welcome-tagline">Ready to crack NEET? Let's make today count.</p>
          <div className="banner-meta">
            <div className="banner-streak">
              <span className="streak-fire">🔥</span>
              <span className="streak-count">{studyStreak}</span>
              <span className="streak-label">day streak</span>
            </div>
            <div className="banner-divider" />
            <div className="banner-goal-bar">
              <span className="goal-label-small">Today's goal</span>
              <div className="banner-progress-track">
                <div className="banner-progress-fill" style={{ width: `${todayGoal}%` }} />
              </div>
              <span className="goal-pct">{todayGoal}%</span>
            </div>
          </div>
          <p className="banner-motivational">"Every expert was once a beginner. Keep going."</p>
        </div>
        <div className="banner-ring">
          <ProgressRing percent={todayGoal} />
          <p className="ring-caption">Daily Goal</p>
        </div>
      </div>

      {/* ── Intelligence Layer ── */}
      <p className="section-heading">Your AI Dashboard</p>
      <div className="intelligence-grid">

        <Link to="/dashboard/tutor" className="continue-card">
          <div className="continue-icon-wrap">
            <Play size={16} />
          </div>
          <div className="continue-body">
            <p className="continue-eyebrow">Continue where you left off</p>
            <p className="continue-title">Physics — Laws of Motion</p>
            <p className="continue-sub">AI Tutor · 3 doubts resolved today</p>
          </div>
          <ChevronRight size={18} className="continue-arrow" />
        </Link>

        <div className="ai-insight-card">
          <div className="insight-header">
            <div className="insight-icon-wrap">
              <AlertCircle size={15} />
            </div>
            <p className="insight-eyebrow">AI Insight</p>
          </div>
          <p className="insight-title">You're weakest in <span>Physics</span></p>
          <p className="insight-sub">Mechanics accuracy: 62% — 18% below your avg</p>
          <Link to="/dashboard/tests" className="insight-cta">
            Practice now <ArrowRight size={12} />
          </Link>
        </div>

        <div className="recommend-card">
          <div className="recommend-header">
            <div className="recommend-icon-wrap">
              <Lightbulb size={15} />
            </div>
            <p className="recommend-eyebrow">Recommended</p>
          </div>
          <p className="recommend-title">Human Physiology</p>
          <p className="recommend-sub">High NEET weightage · Not studied this week</p>
          <Link to="/dashboard/planner" className="recommend-cta">
            Add to plan <ArrowRight size={12} />
          </Link>
        </div>

      </div>

      {/* ── Stats ── */}
      <p className="section-heading">Your Statistics</p>
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 32 }}>
        {[
          { label: 'Tests Taken',  value: String(stats.testsTaken),                              icon: <Target size={20} /> },
          { label: 'Avg. Score',   value: stats.avgScore !== null ? `${stats.avgScore}%` : '—', icon: <TrendingUp size={20} /> },
          { label: 'Flashcards',   value: String(stats.flashcardCount),                          icon: <Star size={20} /> },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <p className="stat-value">{stat.value}</p>
            <p className="stat-label">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Subject Constellation ── */}
      <SubjectConstellation />

      {/* ── Quick Access ── */}
      <p className="section-heading">Quick Access</p>
      <div className="quick-grid">
        {quickLinks.map((item) => (
          <Link key={item.to} to={item.to} className={`quick-card ${item.color}`}>
            <div className="quick-icon">{item.icon}</div>
            <div style={{ flex: 1 }}>
              <p className="quick-label">{item.label}</p>
              <p className="quick-desc">{item.desc}</p>
            </div>
            <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>

    </div>
  );
}
