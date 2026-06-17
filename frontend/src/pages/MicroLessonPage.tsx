import { useState, useEffect } from 'react';
import { Zap, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

interface Lesson { id: string; subject: string; topic: string; content: string; completed: boolean; date: string }
interface StreakData { streak: number; totalCompleted: number }

const SUBJECT_EMOJI: Record<string, string> = { Biology: '🧬', Chemistry: '⚗️', Physics: '⚡' };

export default function MicroLessonPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');

  const fetchLesson = async () => {
    setLoading(true); setError('');
    try {
      const [lessonData, streakData] = await Promise.all([
        api.get<{ lesson: Lesson }>(`/api/microlesson/today?language=${lang}`),
        api.get<StreakData>('/api/microlesson/streak'),
      ]);
      setLesson(lessonData.lesson);
      setStreak(streakData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load today\'s lesson.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void fetchLesson(); }, []);

  const complete = async () => {
    setCompleting(true);
    try {
      await api.post('/api/microlesson/complete', {});
      setLesson((l) => l ? { ...l, completed: true } : l);
      setStreak((s) => s ? { ...s, streak: s.streak + 1, totalCompleted: s.totalCompleted + 1 } : s);
    } catch { /* non-critical */ }
    finally { setCompleting(false); }
  };

  return (
    <div className="page-container" style={{ maxWidth: '720px' }}>
      <div className="page-header">
        <Zap size={28} className="page-icon" />
        <div>
          <h1 className="page-title">
            {isTa ? '5 நிமிட பாடம் | 5-Minute Lesson' : '5-Minute Daily Lesson'}
          </h1>
          <p className="page-desc">
            {isTa ? 'ஒரு நாளைக்கு ஒரு தலைப்பு · தினமும் படி · மதிப்பெண் உயரும்' : 'One focused concept a day. Build the habit. Watch scores rise.'}
          </p>
        </div>
      </div>

      {/* Streak bar */}
      {streak && (
        <div className="micro-streak-bar">
          <div>
            <div className="micro-streak-num">🔥 {streak.streak}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
              {isTa ? 'நாள் தொடர்' : 'day streak'}
            </div>
          </div>
          <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#a5b4fc' }}>{streak.totalCompleted}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {isTa ? 'மொத்த பாடங்கள்' : 'total lessons'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
              {isTa ? 'இன்றைய இலக்கு' : "Today's goal"}
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '99px', background: lesson?.completed ? '#6ee7b7' : '#6366f1', width: lesson?.completed ? '100%' : '0%', transition: 'width 0.6s ease' }} />
            </div>
          </div>
          <div style={{ fontSize: '1.2rem' }}>
            {lesson?.completed ? '✅' : '⏳'}
          </div>
        </div>
      )}

      {/* Lesson already done today */}
      {lesson?.completed && (
        <div className="micro-done-banner">
          <CheckCircle size={24} style={{ color: '#6ee7b7', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: '#6ee7b7', fontSize: '0.95rem' }}>
              {isTa ? 'இன்றைய பாடம் முடிந்தது! 🎉' : "Today's lesson complete! 🎉"}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#4b5563', marginTop: '2px' }}>
              {isTa ? 'நாளை மீண்டும் வாருங்கள்.' : 'Come back tomorrow for a new topic.'}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="spin" />
          <p>{isTa ? 'இன்றைய பாடம் தயாராகிறது…' : 'Preparing today\'s lesson…'}</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
          <button onClick={fetchLesson} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      )}

      {/* Lesson card */}
      {lesson && !loading && (
        <div className="micro-lesson-card" style={{ marginBottom: '1.5rem' }}>
          <div className={`micro-subject-badge micro-subject-badge--${lesson.subject}`}>
            <span>{SUBJECT_EMOJI[lesson.subject] ?? '📚'}</span>
            <span>{lesson.subject}</span>
          </div>
          <div className="micro-topic">{lesson.topic}</div>
          <div className="micro-content">{lesson.content}</div>
        </div>
      )}

      {/* Action */}
      {lesson && !loading && !lesson.completed && (
        <button onClick={complete} disabled={completing}
          className="btn-primary"
          style={{ width: '100%', fontSize: '1.05rem', padding: '14px' }}>
          {completing
            ? <><Loader2 size={16} className="spin" /> {isTa ? 'சேமிக்கிறது…' : 'Saving…'}</>
            : isTa ? '✅ பாடம் முடிந்தது — அடுத்த நாளுக்கு புள்ளி சேர்' : '✅ Mark Complete — Add to streak'}
        </button>
      )}

      {/* Subject schedule info */}
      <div className="feature-card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>
          {isTa ? 'பாட சுழற்சி' : 'Daily Subject Rotation'}
        </h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { day: isTa ? 'நாள் 1' : 'Day 1', sub: 'Biology',   emoji: '🧬', color: '#fcd34d', bg: 'rgba(217,119,6,0.1)' },
            { day: isTa ? 'நாள் 2' : 'Day 2', sub: 'Chemistry', emoji: '⚗️', color: '#6ee7b7', bg: 'rgba(5,150,105,0.1)' },
            { day: isTa ? 'நாள் 3' : 'Day 3', sub: 'Physics',   emoji: '⚡', color: '#93c5fd', bg: 'rgba(59,130,246,0.1)' },
          ].map((d) => (
            <div key={d.sub} style={{ padding: '8px 14px', borderRadius: '8px', background: d.bg, fontSize: '0.8rem', fontWeight: 700, color: d.color }}>
              {d.emoji} {d.day} — {d.sub}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>
          {isTa ? 'ஒவ்வொரு நாளும் ஒரு பாடம் மாறும். 30 நாளில் அனைத்து முக்கிய தலைப்புகளும் உள்ளடங்கும்.' : 'Subject rotates daily. 30 days covers all high-yield NEET topics.'}
        </p>
      </div>
    </div>
  );
}
