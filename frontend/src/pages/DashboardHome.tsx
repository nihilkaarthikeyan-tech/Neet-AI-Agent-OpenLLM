import { useEffect, useState } from 'react';
import {
  BookOpen, Brain, Target, Zap, TrendingUp, Star,
  ArrowRight, Play, ChevronRight, AlertCircle, Lightbulb,
  CheckCircle2, Circle,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  testsTaken: number;
  avgScore: number | null;
  flashcardCount: number;
}

interface MissionItem {
  step: number;
  label: string;
  sub: string;
  pill: string;
  to: string;
  done: boolean;
}

// ─── Progress Ring ────────────────────────────────────────────────────────────
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

  const arcStroke    = isComplete ? 'url(#ringGradComplete)' : isLow ? 'url(#ringGradLow)' : 'url(#ringGrad)';
  const labelColor   = isComplete ? '#6ee7b7' : isLow ? '#fcd34d' : 'white';

  return (
    <svg width="80" height="80" viewBox="0 0 72 72" className={svgClass}>
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
        <linearGradient id="ringGradLow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient id="ringGradComplete" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#6ee7b7" />
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

// ─── Subject Progress ─────────────────────────────────────────────────────────
function SubjectProgress({ isTa }: { isTa: boolean }) {
  const subjects = [
    { key: 'physics',   label: 'Physics',   labelTa: 'இயற்பியல்',  pct: 62, to: '/dashboard/tutor' },
    { key: 'chemistry', label: 'Chemistry', labelTa: 'வேதியியல்',  pct: 74, to: '/dashboard/tutor' },
    { key: 'biology',   label: 'Biology',   labelTa: 'உயிரியல்',   pct: 81, to: '/dashboard/tutor' },
  ];

  return (
    <div className="subject-progress-card">
      <div className="subject-progress-header">
        <p className="subject-progress-title">
          {isTa ? 'பாட முன்னேற்றம்' : 'Subject Progress'}
        </p>
        <Link to="/dashboard/analytics" className="subject-progress-link">
          {isTa ? 'விரிவான பகுப்பாய்வு' : 'Full analytics'} <ArrowRight size={13} />
        </Link>
      </div>

      {subjects.map(s => (
        <div key={s.key} className="subject-row">
          <span className={`subject-dot subject-dot--${s.key}`} aria-hidden="true" />
          <span className="subject-name">{isTa ? s.labelTa : s.label}</span>
          <div className="subject-bar-track" role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`subject-bar-fill subject-bar-fill--${s.key}`} style={{ width: `${s.pct}%` }} />
          </div>
          <span className="subject-pct">{s.pct}%</span>
          <Link to={s.to} className="subject-tutor-btn">
            {isTa ? 'கேள்' : 'Tutor'}
          </Link>
        </div>
      ))}
    </div>
  );
}

// ─── Today's Mission ──────────────────────────────────────────────────────────
function TodayMission({ isTa }: { isTa: boolean }) {
  const missions: MissionItem[] = [
    {
      step: 1,
      label:  isTa ? 'ஃபிளாஷ்கார்டுகள் மதிப்பாய்வு'  : 'Review Flashcards',
      sub:    isTa ? '10 கார்டுகள் இன்று பாக்கி உள்ளன' : '10 cards due today (Thermodynamics)',
      pill:   isTa ? 'இன்று பாக்கி'                    : 'Due today',
      to:     '/dashboard/flashcards',
      done:   true,
    },
    {
      step: 2,
      label:  isTa ? 'மினி மாக் தேர்வு எடு'              : 'Take Mini Mock Test',
      sub:    isTa ? 'தலைப்பு 5: வெப்ப இயக்கவியல் (30 கே)' : 'Chapter 5: Thermodynamics · 30 Qs',
      pill:   isTa ? 'முடிக்கவில்லை'                      : 'Pending',
      to:     '/dashboard/tests',
      done:   false,
    },
    {
      step: 3,
      label:  isTa ? 'AI நுண்பாடம் படி'       : 'Read AI Micro-Lesson',
      sub:    isTa ? 'இன்று: செல் பிரிவு'    : "Today's topic: Cell Division",
      pill:   isTa ? 'முடிக்கவில்லை'          : 'Pending',
      to:     '/dashboard/microlesson',
      done:   false,
    },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <p className="section-heading">
        {isTa ? 'இன்றைய பணி' : "Today's Mission"}
      </p>
      <div className="mission-grid">
        {missions.map(m => (
          <Link
            key={m.step}
            to={m.to}
            className={`mission-card${m.done ? ' mission-card--done' : ''}`}
          >
            <div className="mission-top">
              <div className={`mission-badge mission-badge--${m.done ? 'done' : 'todo'}`}>
                {m.done
                  ? <CheckCircle2 size={13} />
                  : <span>{m.step}</span>
                }
              </div>
              <span className="mission-step-label">
                {isTa ? `படி ${m.step}` : `Step ${m.step}`}
              </span>
            </div>
            <p className={`mission-task${m.done ? ' mission-task--done' : ''}`}>{m.label}</p>
            <p className="mission-sub">{m.sub}</p>
            <span className={`mission-pill mission-pill--${m.done ? 'done' : 'todo'}`}>
              {m.done
                ? <><CheckCircle2 size={10} /> {isTa ? 'முடிந்தது' : 'Done'}</>
                : <><Circle size={10} /> {m.pill}</>
              }
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Quick links ──────────────────────────────────────────────────────────────
const getQuickLinks = (isTa: boolean) => [
  { to: '/dashboard/planner', icon: <BookOpen size={22} />, label: isTa ? 'படிப்பு திட்டமிடல்' : 'Study Planner', desc: isTa ? 'உங்கள் தனிப்பட்ட தினசரி அட்டவணை' : 'Your personalised daily schedule', color: 'card-blue' },
  { to: '/dashboard/tutor',   icon: <Brain size={22} />,   label: isTa ? 'AI ஆசிரியர்'       : 'AI Tutor',       desc: isTa ? 'சந்தேகங்கள் கேளுங்கள் — இயற்பியல், வேதியியல், உயிரியல்' : 'Ask doubts — Physics, Chem, Bio', color: 'card-purple' },
  { to: '/dashboard/tests',   icon: <Target size={22} />,  label: isTa ? 'மாதிரி தேர்வுகள்' : 'Mock Tests',     desc: isTa ? 'முழு NEET 180 கேள்வி நேர தேர்வு' : 'Full NEET 180Q timed exams', color: 'card-green' },
  { to: '/dashboard/voice',   icon: <Zap size={22} />,     label: isTa ? 'குரல் ஆசிரியர்'   : 'Voice Tutor',    desc: isTa ? 'நேரலை AI குரல் உரையாடல்'       : 'Live AI voice conversation', color: 'card-orange' },
];

// ─── Dashboard Home ───────────────────────────────────────────────────────────
export default function DashboardHome() {
  const { user } = useAuthStore();
  const lang = useLang();
  const isTa = lang === 'ta';
  const firstName = user?.name?.split(' ')[0] ?? (isTa ? 'மாணவர்' : 'Student');
  const [stats, setStats] = useState<Stats>({ testsTaken: 0, avgScore: null, flashcardCount: 0 });

  useEffect(() => {
    api.get<Stats>('/api/stats')
      .then(setStats)
      .catch(() => {/* keep defaults on error */});
  }, []);

  const hour = new Date().getHours();
  const greeting = isTa
    ? (hour < 12 ? 'காலை வணக்கம்' : hour < 17 ? 'மதிய வணக்கம்' : 'மாலை வணக்கம்')
    : (hour < 12 ? 'Good morning'  : hour < 17 ? 'Good afternoon' : 'Good evening');

  const studyStreak = 7;
  const todayGoal   = 85;

  return (
    <div className="page-container">

      {/* ── Welcome Banner ── */}
      <div className="welcome-banner">
        <div className="welcome-left">
          <p className="welcome-greeting">{greeting}</p>
          <h1 className="welcome-name">{firstName}</h1>
          <p className="welcome-tagline">
            {isTa ? 'NEET வெல்ல தயாரா? இன்றை நாளை சிறப்பாக்குவோம்.' : "Ready to crack NEET? Let's make today count."}
          </p>
          <div className="banner-meta">
            <div className="banner-streak">
              <span className="streak-fire" aria-hidden="true">🔥</span>
              <span className="streak-count">{studyStreak}</span>
              <span className="streak-label">{isTa ? 'நாள் தொடர்' : 'day streak'}</span>
            </div>
            <div className="banner-divider" aria-hidden="true" />
            <div className="banner-goal-bar">
              <span className="goal-label-small">{isTa ? 'இன்றைய இலக்கு' : "Today's goal"}</span>
              <div className="banner-progress-track" role="progressbar" aria-valuenow={todayGoal} aria-valuemin={0} aria-valuemax={100}>
                <div className="banner-progress-fill" style={{ width: `${todayGoal}%` }} />
              </div>
              <span className="goal-pct">{todayGoal}%</span>
            </div>
          </div>
          <p className="banner-motivational">
            {isTa
              ? '"ஒவ்வொரு நிபுணரும் ஒரு காலத்தில் தொடக்கக்காரர். தொடர்ந்து முயற்சி செய்."'
              : '"Every expert was once a beginner. Keep going."'}
          </p>
        </div>
        <div className="banner-ring">
          <ProgressRing percent={todayGoal} />
          <p className="ring-caption">{isTa ? 'தினசரி இலக்கு' : 'Daily Goal'}</p>
        </div>
      </div>

      {/* ── Today's Mission ── */}
      <TodayMission isTa={isTa} />

      {/* ── AI Dashboard cards ── */}
      <p className="section-heading">{isTa ? 'உங்கள் AI டாஷ்போர்டு' : 'Your AI Dashboard'}</p>
      <div className="intelligence-grid">

        <Link to="/dashboard/tutor" className="continue-card">
          <div className="continue-icon-wrap">
            <Play size={16} />
          </div>
          <div className="continue-body">
            <p className="continue-eyebrow">
              {isTa ? 'நிறுத்திய இடத்திலிருந்து தொடரு' : 'Continue where you left off'}
            </p>
            <p className="continue-title">
              {isTa ? 'இயற்பியல் — இயக்க விதிகள்' : 'Physics — Laws of Motion'}
            </p>
            <p className="continue-sub">
              {isTa ? 'AI ஆசிரியர் · இன்று 3 சந்தேகங்கள் தீர்க்கப்பட்டன' : 'AI Tutor · 3 doubts resolved today'}
            </p>
          </div>
          <ChevronRight size={18} className="continue-arrow" />
        </Link>

        <div className="ai-insight-card">
          <div className="insight-header">
            <div className="insight-icon-wrap">
              <AlertCircle size={15} />
            </div>
            <p className="insight-eyebrow">{isTa ? 'AI நுண்ணறிவு' : 'AI Insight'}</p>
          </div>
          <p className="insight-title">
            {isTa
              ? <><span>இயற்பியலில்</span> நீங்கள் பலவீனமாக இருக்கிறீர்கள்</>
              : <>You're weakest in <span>Physics</span></>}
          </p>
          <p className="insight-sub">
            {isTa
              ? 'இயக்கவியல் துல்லியம்: 62% — சராசரியை விட 18% குறைவு'
              : 'Mechanics accuracy: 62% — 18% below your avg'}
          </p>
          <Link to="/dashboard/tests" className="insight-cta">
            {isTa ? 'இப்போது பயிற்சி செய்' : 'Practice now'} <ArrowRight size={12} />
          </Link>
        </div>

        <div className="recommend-card">
          <div className="recommend-header">
            <div className="recommend-icon-wrap">
              <Lightbulb size={15} />
            </div>
            <p className="recommend-eyebrow">{isTa ? 'பரிந்துரை' : 'Recommended'}</p>
          </div>
          <p className="recommend-title">{isTa ? 'மனித உடலியல்' : 'Human Physiology'}</p>
          <p className="recommend-sub">
            {isTa
              ? 'அதிக NEET முக்கியத்துவம் · இந்த வாரம் படிக்கவில்லை'
              : 'High NEET weightage · Not studied this week'}
          </p>
          <Link to="/dashboard/planner" className="recommend-cta">
            {isTa ? 'திட்டத்தில் சேர்' : 'Add to plan'} <ArrowRight size={12} />
          </Link>
        </div>

      </div>

      {/* ── Stats ── */}
      <p className="section-heading">{isTa ? 'உங்கள் புள்ளிவிவரங்கள்' : 'Your Statistics'}</p>
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 32 }}>
        {[
          { label: isTa ? 'எடுத்த தேர்வுகள்' : 'Tests Taken',  value: String(stats.testsTaken),                              icon: <Target size={20} /> },
          { label: isTa ? 'சராசரி மதிப்பெண்' : 'Avg. Score',   value: stats.avgScore !== null ? `${stats.avgScore}%` : '—', icon: <TrendingUp size={20} /> },
          { label: isTa ? 'ஃபிளாஷ்கார்டுகள்' : 'Flashcards',   value: String(stats.flashcardCount),                          icon: <Star size={20} /> },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <p className="stat-value">{stat.value}</p>
            <p className="stat-label">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Subject Progress ── */}
      <p className="section-heading">{isTa ? 'பாட நிலை' : 'Subject Progress'}</p>
      <SubjectProgress isTa={isTa} />

      {/* ── Quick Access ── */}
      <p className="section-heading">{isTa ? 'விரைவு அணுகல்' : 'Quick Access'}</p>
      <div className="quick-grid">
        {getQuickLinks(isTa).map((item) => (
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
