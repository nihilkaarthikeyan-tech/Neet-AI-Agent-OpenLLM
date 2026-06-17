import { useState, useEffect } from 'react';
import { TrendingUp, Trophy, Star, Loader2, Users, Target, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../lib/useLang';

interface Milestone { date: string; score: number; type: string; message: string }
interface MyData { milestones: Milestone[]; currentBest: number; totalTests: number; message?: string }
interface WeeklyPoint { week: string; avgScore: number; students: number }
interface CohortData { weeklyProgress: WeeklyPoint[]; improvedStudents: number; studentsNearCutoff: number; totalTracked: number }

const MILESTONE_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  first:          { icon: '🚀', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  personal_best:  { icon: '🎉', color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  cutoff_566:     { icon: '🏛️', color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  cutoff_600:     { icon: '💪', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
};

export default function OutcomesPage() {
  const { user } = useAuthStore();
  const lang = useLang();
  const isTa = lang === 'ta';
  const isAdmin = user?.role === 'ADMIN';

  const [myData, setMyData] = useState<MyData | null>(null);
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [tab, setTab] = useState<'my' | 'cohort'>('my');

  useEffect(() => {
    api.get<MyData>('/api/outcomes/my')
      .then(setMyData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadCohort = async () => {
    if (cohort) return;
    setCohortLoading(true);
    try { setCohort(await api.get<CohortData>('/api/outcomes/cohort')); }
    catch { /* ignore */ }
    finally { setCohortLoading(false); }
  };

  const switchTab = (t: 'my' | 'cohort') => {
    setTab(t);
    if (t === 'cohort') loadCohort();
  };

  const chartData = cohort?.weeklyProgress.map((w) => ({
    week: w.week.slice(0, 10),
    score: w.avgScore,
    students: w.students,
  })) ?? [];

  return (
    <div className="page-container" style={{ maxWidth: '860px' }}>
      <div className="page-header">
        <TrendingUp size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'கல்வி பயண மைல்கற்கள் | Outcomes' : 'Learning Outcomes & Milestones'}</h1>
          <p className="page-desc">
            {isTa
              ? 'உங்கள் NEET முன்னேற்ற மைல்கற்கள் மற்றும் தேர்வு திட்ட நிலை'
              : 'Your NEET score progression, personal bests, and goal milestones'}
          </p>
        </div>
      </div>

      {/* Tab bar — admin sees both tabs */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem' }}>
          {(['my', 'cohort'] as const).map((t) => (
            <button key={t} onClick={() => switchTab(t)}
              style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', background: tab === t ? 'var(--accent)' : 'var(--bg-surface)', color: tab === t ? '#fff' : 'var(--text-secondary)', border: `1px solid ${tab === t ? 'transparent' : 'var(--border)'}` }}>
              {t === 'my' ? (isTa ? '🎯 என் பயணம்' : '🎯 My Journey') : (isTa ? '👥 மாணவர் குழு' : '👥 Cohort View')}
            </button>
          ))}
        </div>
      )}

      {/* ── My milestones ── */}
      {tab === 'my' && (
        <>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '3rem', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="spin" />
              {isTa ? 'உங்கள் பயண மைல்கற்கள் ஏற்றுகிறது…' : 'Loading your milestones…'}
            </div>
          )}

          {!loading && myData && (
            <>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="feature-card feature-card--accent" style={{ textAlign: 'center' }}>
                  <Trophy size={22} style={{ color: 'var(--accent)', marginBottom: '6px' }} />
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{myData.currentBest || '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isTa ? 'சிறந்த மதிப்பெண்' : 'Personal Best'} / 720
                  </div>
                </div>
                <div className="feature-card" style={{ textAlign: 'center' }}>
                  <Star size={22} style={{ color: '#f59e0b', marginBottom: '6px' }} />
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{myData.totalTests}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isTa ? 'மொத்த தேர்வுகள்' : 'Tests Taken'}
                  </div>
                </div>
                <div className="feature-card" style={{ textAlign: 'center' }}>
                  <Target size={22} style={{ color: '#059669', marginBottom: '6px' }} />
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: myData.currentBest >= 566 ? '#059669' : '#dc2626' }}>
                    {myData.currentBest >= 566 ? '✓' : `${566 - myData.currentBest}`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {myData.currentBest >= 566 ? (isTa ? 'இலக்கை எட்டினீர்!' : 'Quota Cutoff Met!') : (isTa ? 'இலக்கிற்கு தேவை' : 'Points to 566 Cutoff')}
                  </div>
                </div>
              </div>

              {/* Milestone timeline */}
              {myData.message && (
                <div className="feature-card feature-card--warning" style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>
                    {isTa ? 'இன்னும் தேர்வு எடுக்கவில்லை' : 'No tests recorded yet'}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {isTa ? 'மாதிரி தேர்வுகளை எடுத்து மைல்கற்களை திறக்கவும்' : 'Take mock tests to start tracking your journey and unlock milestones'}
                  </p>
                </div>
              )}

              {myData.milestones.length > 0 && (
                <div className="feature-card">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.25rem' }}>
                    {isTa ? '🏁 உங்கள் பயண மைல்கற்கள்' : '🏁 Your Journey Milestones'}
                  </h3>
                  <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                    {/* Vertical line */}
                    <div style={{ position: 'absolute', left: '12px', top: 0, bottom: 0, width: '2px', background: 'var(--border)', borderRadius: '99px' }} />
                    {myData.milestones.map((m, i) => {
                      const style = MILESTONE_STYLE[m.type] ?? { icon: '⭐', color: 'var(--accent)', bg: 'rgba(79,70,229,0.08)' };
                      return (
                        <div key={i} style={{ position: 'relative', marginBottom: '1.25rem', paddingLeft: '1.25rem' }}>
                          {/* Dot */}
                          <div style={{ position: 'absolute', left: '-1.6rem', top: '4px', width: '14px', height: '14px', borderRadius: '50%', background: style.color, border: '3px solid var(--bg-surface)', boxShadow: `0 0 0 2px ${style.color}` }} />
                          <div style={{ background: style.bg, borderRadius: '10px', padding: '0.75rem 1rem', border: `1px solid ${style.color}22` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '1.1rem' }}>{style.icon}</span>
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: style.color }}>{m.score}/720</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{m.date}</span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{m.message}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Goal ladder */}
              <div className="feature-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
                  {isTa ? '🎯 இலக்கு ஏணி' : '🎯 Score Goal Ladder'}
                </h3>
                {[
                  { score: 566, label: isTa ? '7.5% ஒதுக்கீடு இலக்கு (அரசு MBBS)' : '7.5% Quota cutoff — Govt MBBS seat', color: '#d97706' },
                  { score: 600, label: isTa ? 'பொது அரசு MBBS போட்டி' : 'General Govt MBBS competitive', color: '#2563eb' },
                  { score: 650, label: isTa ? 'சிறந்த அரசு மருத்துவக் கல்லூரி (Madras/Stanley)' : 'Top govt medical colleges (Madras/Stanley)', color: '#7c3aed' },
                  { score: 680, label: isTa ? 'தனியார் MBBS / AIIMS போட்டி' : 'Private MBBS / AIIMS competitive', color: '#059669' },
                ].map(({ score, label, color }) => {
                  const pct = Math.min(100, myData.currentBest > 0 ? (myData.currentBest / score) * 100 : 0);
                  const reached = myData.currentBest >= score;
                  return (
                    <div key={score} style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: reached ? 700 : 500, color: reached ? color : 'var(--text-secondary)' }}>
                          {reached ? '✅ ' : ''}{score} — {label}
                        </span>
                        <span style={{ fontWeight: 700, color }}>{Math.round(pct)}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-base)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: color, borderRadius: '99px', width: `${pct}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Admin cohort view ── */}
      {tab === 'cohort' && isAdmin && (
        <>
          {cohortLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '3rem', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="spin" />
              Loading cohort analytics…
            </div>
          )}
          {cohort && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="feature-card feature-card--accent" style={{ textAlign: 'center' }}>
                  <Users size={22} style={{ color: 'var(--accent)', marginBottom: '6px' }} />
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{cohort.totalTracked}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Students Tracked</div>
                </div>
                <div className="feature-card feature-card--success" style={{ textAlign: 'center' }}>
                  <Award size={22} style={{ color: '#059669', marginBottom: '6px' }} />
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{cohort.improvedStudents}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Improved &gt;20 pts</div>
                </div>
                <div className="feature-card feature-card--warning" style={{ textAlign: 'center' }}>
                  <Target size={22} style={{ color: '#d97706', marginBottom: '6px' }} />
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{cohort.studentsNearCutoff}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Near 566 Cutoff</div>
                </div>
              </div>

              {/* Weekly chart */}
              {chartData.length > 0 ? (
                <div className="feature-card">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.25rem' }}>
                    📈 Cohort Weekly Average Score (estimated / 720)
                  </h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis domain={[0, 720]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}
                        formatter={(v: number, name: string) => [v, name === 'score' ? 'Avg Score /720' : 'Students']}
                      />
                      <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4 }} name="score" />
                    </LineChart>
                  </ResponsiveContainer>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Score normalised to /720 NEET scale. Red line at 566 = 7.5% quota cutoff.
                  </p>
                </div>
              ) : (
                <div className="feature-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No test attempt data yet. Weekly cohort chart will appear once students take tests.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
