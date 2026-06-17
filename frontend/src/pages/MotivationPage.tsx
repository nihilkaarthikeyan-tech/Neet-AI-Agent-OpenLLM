import { useState, useEffect } from 'react';
import { Flame, Loader2, RefreshCw, Calendar, Target, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

interface DailyMessage {
  message: string;
  date: string;
  fresh: boolean;
}

interface StreakData {
  streak: number;
  weeklyTests: number;
  totalTests: number;
}

export default function MotivationPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [daily, setDaily] = useState<DailyMessage | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    setError('');
    try {
      const [msg, str] = await Promise.all([
        api.get<DailyMessage>('/api/motivation/daily'),
        api.get<StreakData>('/api/motivation/streak'),
      ]);
      setDaily(msg);
      setStreak(str);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const today = new Date().toLocaleDateString(isTa ? 'ta-IN' : 'en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (isLoading) {
    return (
      <div className="page-loading-center">
        <Loader2 size={32} className="spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Flame size={28} className="page-icon" style={{ color: '#f59e0b' }} />
        <div>
          <h1 className="page-title">{isTa ? 'உந்துதல் பயிற்சியாளர்' : 'Motivation Coach'}</h1>
          <p className="page-desc">{isTa ? 'உங்கள் தினசரி AI ஊக்கவுரை — உங்கள் NEET பயணத்திற்காக' : 'Your daily AI pep-talk — personalized for your NEET journey'}</p>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {/* Streak + stats row */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '32px' }}>
        <div className="stat-card" style={{ borderColor: streak && streak.streak > 0 ? 'rgba(245,158,11,0.4)' : undefined }}>
          <p className="stat-value" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Flame size={22} style={{ color: '#f59e0b' }} />
            {streak?.streak ?? 0}
          </p>
          <p className="stat-label">{isTa ? 'நாள் தொடர்' : 'Day Streak'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{streak?.weeklyTests ?? 0}</p>
          <p className="stat-label">{isTa ? 'இந்த வார தேர்வுகள்' : 'Tests This Week'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{streak?.totalTests ?? 0}</p>
          <p className="stat-label">{isTa ? 'மொத்த தேர்வுகள்' : 'Total Tests'}</p>
        </div>
      </div>

      {/* Daily message card */}
      <h2 className="section-heading">{isTa ? 'இன்றைய செய்தி' : "Today's Message"}</h2>
      <div className="solution-card panel-card--dark" style={{ marginBottom: '28px', position: 'relative', overflow: 'hidden', background: '#0f172a', border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '200px', height: '200px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.15), transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>{today}</span>
          </div>
          <button
            onClick={() => fetchAll(true)}
            disabled={isRefreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '6px',
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              border: '1px solid rgba(245,158,11,0.2)', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'spin' : ''} />
            {isTa ? 'புதுப்பி' : 'Refresh'}
          </button>
        </div>

        {daily ? (
          <p style={{
            fontSize: '18px', lineHeight: 1.7, color: '#f1f5f9',
            fontWeight: 500, position: 'relative',
          }}>
            <span style={{ fontSize: '40px', color: '#f59e0b', lineHeight: 1, marginRight: '4px', verticalAlign: 'sub' }}>"</span>
            {daily.message}
            <span style={{ fontSize: '40px', color: '#f59e0b', lineHeight: 1, marginLeft: '4px', verticalAlign: 'sub' }}>"</span>
          </p>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: '15px' }}>{isTa ? 'இன்றைய செய்தியை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : "Could not load today's message. Try refreshing."}</p>
        )}
      </div>

      {/* Weekly breakdown */}
      <h2 className="section-heading">{isTa ? 'வாராந்திர சுருக்கம்' : 'Weekly Summary'}</h2>
      <div className="panel-grid-3" style={{ marginBottom: '28px' }}>
        <div className="quick-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} style={{ color: '#8b5cf6' }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{isTa ? 'இந்த வார தேர்வுகள்' : 'Tests This Week'}</span>
          </div>
          <p style={{ fontSize: '32px', fontWeight: 800, color: '#8b5cf6' }}>{streak?.weeklyTests ?? 0}</p>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>{isTa ? 'தினமும் குறைந்தது 1 தேர்வு எடுங்கள்' : 'Keep taking at least 1 test per day'}</p>
        </div>

        <div className="quick-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} style={{ color: '#f59e0b' }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{isTa ? 'செயலில் உள்ள தொடர்' : 'Active Streak'}</span>
          </div>
          <p style={{ fontSize: '32px', fontWeight: 800, color: '#f59e0b' }}>{streak?.streak ?? 0} {isTa ? 'நாட்கள்' : 'days'}</p>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>
            {streak?.streak === 0 ? (isTa ? 'உங்கள் தொடரைத் தொடங்க இன்று ஒரு தேர்வு எடுங்கள்!' : 'Take a test today to start your streak!') : (isTa ? 'அருமையான தொடர்ச்சி — தொடருங்கள்!' : 'Amazing consistency — keep it up!')}
          </p>
        </div>

        <div className="quick-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} style={{ color: '#10b981' }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{isTa ? 'மொத்த பயிற்சி' : 'Total Practice'}</span>
          </div>
          <p style={{ fontSize: '32px', fontWeight: 800, color: '#10b981' }}>{streak?.totalTests ?? 0}</p>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>{isTa ? 'இதுவரை முடித்த மொத்த தேர்வுகள்' : 'Total tests completed so far'}</p>
        </div>
      </div>

      {/* Motivation tips */}
      <h2 className="section-heading">{isTa ? 'NEET டாப்பர் குறிப்புகள்' : 'NEET Topper Tips'}</h2>
      <div className="auth-card panel-card" style={{ maxWidth: '100%', animation: 'none' }}>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '14px', listStyle: 'none' }}>
          {(isTa ? [
            'தினமும் குறைந்தது 50 MCQ-களை தீர்க்கவும் — தொடர்ச்சி, தீவிரத்தை விட முக்கியம்.',
            'ஒவ்வொரு மாதிரி தேர்விற்குப் பிறகும் தவறான விடைகளை உடனே மறுபரிசீலனை செய்யுங்கள். உண்மையான கற்றல் அங்குதான்.',
            'உயிரியலுக்கு NCERT பாடப்புத்தகங்களுக்கு முன்னுரிமை கொடுங்கள் — NEET உயிரியலில் 80% நேரடியாக NCERT-ல் இருந்து வருகிறது.',
            'இயற்பியலுக்கு, formula-களை மனப்பாடம் செய்வதை விட concepts-ஐ ஆழமாக புரிந்துகொள்வதில் கவனம் செலுத்துங்கள்.',
            'நேர மேலாண்மை: 180 கேள்விகளையும் 160 நிமிடங்களுக்குள் முடிக்க இலக்கு வைக்கவும், மறுபரிசீலனைக்கு 20 நிமிடங்கள் விடவும்.',
            '7-8 மணி நேரம் தூங்குங்கள். தூக்கத்தின் போது நினைவு வலுப்படுகிறது — அது வீண் நேரம் அல்ல.',
          ] : [
            'Solve at least 50 MCQs every day — consistency beats intensity.',
            'Review wrong answers immediately after every mock test. That\'s where the real learning is.',
            'Prioritize NCERT textbooks for Biology — 80% of NEET Biology is directly from NCERT.',
            'For Physics, focus on understanding concepts deeply rather than memorizing formulas.',
            'Time management: aim to finish all 180 questions in under 160 minutes, leaving 20 for review.',
            'Sleep 7-8 hours. Consolidation happens during sleep — it\'s not wasted time.',
          ]).map((tip, i) => (
            <li key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{
                width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(245,158,11,0.15)',
                color: '#f59e0b', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</span>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
