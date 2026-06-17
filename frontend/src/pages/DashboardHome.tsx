import { useEffect, useState } from 'react';
import { BookOpen, Brain, Target, Zap, TrendingUp, Star, ArrowRight, Play, ChevronRight, AlertCircle, Lightbulb, Atom, Dna } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

const getQuickLinks = (isTa: boolean) => [
  { to: '/dashboard/planner', icon: <BookOpen size={22} />, label: isTa ? 'படிப்பு திட்டமிடல்' : 'Study Planner', desc: isTa ? 'உங்கள் தனிப்பட்ட தினசரி அட்டவணை' : 'Your personalised daily schedule', color: 'card-blue' },
  { to: '/dashboard/tutor',   icon: <Brain size={22} />,   label: isTa ? 'AI ஆசிரியர்' : 'AI Tutor',       desc: isTa ? 'சந்தேகங்கள் கேளுங்கள் — இயற்பியல், வேதியியல், உயிரியல்' : 'Ask doubts — Physics, Chem, Bio', color: 'card-purple' },
  { to: '/dashboard/tests',   icon: <Target size={22} />,  label: isTa ? 'மாதிரி தேர்வுகள்' : 'Mock Tests',   desc: isTa ? 'முழு NEET 180 கேள்வி நேர தேர்வு' : 'Full NEET 180Q timed exams', color: 'card-green' },
  { to: '/dashboard/voice',   icon: <Zap size={22} />,     label: isTa ? 'குரல் ஆசிரியர்' : 'Voice Tutor',   desc: isTa ? 'நேரலை AI குரல் உரையாடல்' : 'Live AI voice conversation', color: 'card-orange' },
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

function SubjectConstellation({ isTa }: { isTa: boolean }) {
  return (
    <div className="constellation-card">
      <div className="constellation-info">
        <p className="constellation-title">{isTa ? 'உங்கள் படிப்பு பிரபஞ்சம்' : 'Your Study Universe'}</p>
        <p className="constellation-sub">{isTa ? 'மூன்று பாடங்கள். ஒரே இலக்கு. தட்டி நுழையுங்கள்.' : 'Three subjects. One goal. Tap to jump in.'}</p>
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
    : (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

  const studyStreak = 7;
  const todayGoal = 85;

  return (
    <div className="page-container">

      {/* ── Welcome Banner ── */}
      <div className="welcome-banner">
        <div className="welcome-left">
          <p className="welcome-greeting">{greeting}</p>
          <h1 className="welcome-name">{firstName}</h1>
          <p className="welcome-tagline">{isTa ? 'NEET வெல்ல தயாரா? இன்றை நாளை சிறப்பாக்குவோம்.' : "Ready to crack NEET? Let's make today count."}</p>
          <div className="banner-meta">
            <div className="banner-streak">
              <span className="streak-fire">🔥</span>
              <span className="streak-count">{studyStreak}</span>
              <span className="streak-label">{isTa ? 'நாள் தொடர்' : 'day streak'}</span>
            </div>
            <div className="banner-divider" />
            <div className="banner-goal-bar">
              <span className="goal-label-small">{isTa ? 'இன்றைய இலக்கு' : "Today's goal"}</span>
              <div className="banner-progress-track">
                <div className="banner-progress-fill" style={{ width: `${todayGoal}%` }} />
              </div>
              <span className="goal-pct">{todayGoal}%</span>
            </div>
          </div>
          <p className="banner-motivational">{isTa ? '"ஒவ்வொரு நிபுணரும் ஒரு காலத்தில் தொடக்கக்காரர். தொடர்ந்து முயற்சி செய்."' : '"Every expert was once a beginner. Keep going."'}</p>
        </div>
        <div className="banner-ring">
          <ProgressRing percent={todayGoal} />
          <p className="ring-caption">{isTa ? 'தினசரி இலக்கு' : 'Daily Goal'}</p>
        </div>
      </div>

      {/* ── Intelligence Layer ── */}
      <p className="section-heading">{isTa ? 'உங்கள் AI டாஷ்போர்டு' : 'Your AI Dashboard'}</p>
      <div className="intelligence-grid">

        <Link to="/dashboard/tutor" className="continue-card">
          <div className="continue-icon-wrap">
            <Play size={16} />
          </div>
          <div className="continue-body">
            <p className="continue-eyebrow">{isTa ? 'நிறுத்திய இடத்திலிருந்து தொடரு' : 'Continue where you left off'}</p>
            <p className="continue-title">{isTa ? 'இயற்பியல் — இயக்க விதிகள்' : 'Physics — Laws of Motion'}</p>
            <p className="continue-sub">{isTa ? 'AI ஆசிரியர் · இன்று 3 சந்தேகங்கள் தீர்க்கப்பட்டன' : 'AI Tutor · 3 doubts resolved today'}</p>
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
          <p className="insight-title">{isTa ? <><span>இயற்பியலில்</span> நீங்கள் பலவீனமாக இருக்கிறீர்கள்</> : <>You're weakest in <span>Physics</span></>}</p>
          <p className="insight-sub">{isTa ? 'இயக்கவியல் துல்லியம்: 62% — சராசரியை விட 18% குறைவு' : 'Mechanics accuracy: 62% — 18% below your avg'}</p>
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
          <p className="recommend-sub">{isTa ? 'அதிக NEET முக்கியத்துவம் · இந்த வாரம் படிக்கவில்லை' : 'High NEET weightage · Not studied this week'}</p>
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

      {/* ── Subject Constellation ── */}
      <SubjectConstellation isTa={isTa} />

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
