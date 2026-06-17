/**
 * ParentDashboardPage — accessed at /parent/:code
 * No auth required. Student shares the 8-char code with their parent.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, Trophy, Flame, BarChart3, Loader2, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

interface SubjectRow { subject: string; avgPct: number; testCount: number; }
interface RecentTest { subject: string; scorePct: number; date: string; }
interface ParentData {
  student: { name: string; district: string | null; school: string | null; xp: number; streak: number; longestStreak: number; level: number; memberSince: string; };
  stats: { totalTests: number; avgScorePct: number | null; estNeet: number | null; activeDays: number; doubtsThisWeek: number; weakAreas: string[]; };
  subjects: SubjectRow[];
  chapters: { done: number; revised: number; reading: number; notStarted: number; };
  recentTests: RecentTest[];
}

const SUBJECT_COLORS: Record<string, string> = { Biology: '#22c55e', Chemistry: '#f59e0b', Physics: '#6366f1' };
const LEVEL_NAMES = ['', 'Beginner', 'Improving', 'Competitive', 'NEET Ready', 'Champion'];

export default function ParentDashboardPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<ParentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/parent/view/${code}`);
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          setError(err.error ?? 'Invalid access code.');
          return;
        }
        setData(await res.json() as ParentData);
      } catch { setError('Failed to load dashboard.'); }
      finally { setLoading(false); }
    })();
  }, [code]);

  const cardStyle: React.CSSProperties = { background: '#1e293b', borderRadius: '14px', padding: '20px' };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <Loader2 size={32} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: '16px' }}>
      <AlertCircle size={40} style={{ color: '#ef4444' }} />
      <p style={{ color: '#f87171', fontSize: '16px', fontWeight: 600 }}>{error || 'Dashboard not found.'}</p>
      <p style={{ color: '#64748b', fontSize: '13px' }}>Ask your child to share a valid parent access code.</p>
    </div>
  );

  const { student, stats, subjects, chapters, recentTests } = data;
  const totalChapters = chapters.done + chapters.revised + chapters.reading + chapters.notStarted;
  const completedChapters = chapters.done + chapters.revised;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '24px 16px', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', padding: '20px 24px', background: '#1e293b', borderRadius: '16px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, flexShrink: 0 }}>
            {student.name?.[0]?.toUpperCase() ?? 'S'}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{student.name}</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
              {student.school ? `${student.school} · ` : ''}{student.district ?? 'Tamil Nadu'} · Level {student.level} ({LEVEL_NAMES[student.level] ?? 'Student'})
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
              <BookOpen size={14} style={{ color: '#6366f1' }} />
              <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: '14px' }}>NEET AI</span>
            </div>
            <p style={{ color: '#334155', fontSize: '11px' }}>Parent Dashboard</p>
          </div>
        </div>

        {/* Key stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Tests Taken', value: stats.totalTests, icon: <BarChart3 size={18} style={{ color: '#6366f1' }} />, color: '#6366f1' },
            { label: 'Avg NEET Score (est.)', value: stats.estNeet !== null ? `${stats.estNeet}/720` : '—', icon: <Trophy size={18} style={{ color: '#fbbf24' }} />, color: '#fbbf24' },
            { label: 'Active Study Days', value: stats.activeDays, icon: <BookOpen size={18} style={{ color: '#22c55e' }} />, color: '#22c55e' },
            { label: 'Current Streak', value: `${student.streak} days`, icon: <Flame size={18} style={{ color: '#ef4444' }} />, color: '#ef4444' },
          ].map((s) => (
            <div key={s.label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Subject performance */}
        {subjects.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: '16px' }}>
            <p style={{ fontWeight: 700, color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Subject Performance</p>
            {subjects.map((s) => (
              <div key={s.subject} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '14px' }}>{s.subject}</span>
                  <span style={{ color: SUBJECT_COLORS[s.subject] ?? '#64748b', fontWeight: 700 }}>{s.avgPct}% <span style={{ color: '#475569', fontWeight: 400, fontSize: '12px' }}>({s.testCount} tests)</span></span>
                </div>
                <div style={{ background: '#0f172a', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.avgPct}%`, background: SUBJECT_COLORS[s.subject] ?? '#6366f1', borderRadius: '999px', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
            {stats.weakAreas.length > 0 && (
              <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '10px' }}>
                ⚠️ Needs more practice: {stats.weakAreas.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Chapter progress */}
        {totalChapters > 0 && (
          <div style={{ ...cardStyle, marginBottom: '16px' }}>
            <p style={{ fontWeight: 700, color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>NCERT Chapter Progress</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
              {[
                { label: 'Done', count: chapters.done, color: '#22c55e' },
                { label: 'Revised', count: chapters.revised, color: '#6366f1' },
                { label: 'Reading', count: chapters.reading, color: '#f59e0b' },
                { label: 'Not Started', count: chapters.notStarted, color: '#475569' },
              ].map((c) => (
                <div key={c.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '22px', fontWeight: 800, color: c.color }}>{c.count}</p>
                  <p style={{ fontSize: '11px', color: '#64748b' }}>{c.label}</p>
                </div>
              ))}
            </div>
            <div style={{ background: '#0f172a', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(completedChapters / totalChapters) * 100}%`, background: 'linear-gradient(90deg, #22c55e, #6366f1)', borderRadius: '999px' }} />
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>{completedChapters}/{totalChapters} chapters covered</p>
          </div>
        )}

        {/* Recent tests */}
        {recentTests.length > 0 && (
          <div style={cardStyle}>
            <p style={{ fontWeight: 700, color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Recent Tests</p>
            {recentTests.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < recentTests.length - 1 ? '1px solid #1e293b' : 'none' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SUBJECT_COLORS[t.subject] ?? '#6366f1', flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#cbd5e1', fontSize: '13px' }}>{t.subject}</span>
                <span style={{ fontWeight: 700, color: t.scorePct >= 60 ? '#22c55e' : t.scorePct >= 40 ? '#f59e0b' : '#ef4444', fontSize: '14px' }}>{t.scorePct}%</span>
                <span style={{ color: '#475569', fontSize: '12px' }}>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#334155', fontSize: '11px', marginTop: '24px' }}>
          NEET AI · Tamil Nadu Government Platform · Data shown is for {student.name} only · Read-only view
        </p>
      </div>
    </div>
  );
}
