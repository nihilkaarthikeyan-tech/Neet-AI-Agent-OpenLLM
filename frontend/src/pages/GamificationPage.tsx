import { useState, useEffect, useCallback } from 'react';
import { Trophy, Flame, Zap, Star, Target, Calendar, BookOpen, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import MarkdownText from '../components/MarkdownText';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

type Tab = 'profile' | 'challenge' | 'mastery' | 'report';

// ── Types ─────────────────────────────────────────────────────────────────────
interface LevelInfo { level: number; name: string; icon: string; minXP: number; nextLevel: { name: string; minXP: number } | null; xpToNext: number; progressPct: number; }
interface BadgeDef { id: string; name: string; desc: string; icon: string; color: string; }
interface BadgeEntry { badgeId: string; earnedAt: string; def?: BadgeDef; }
interface GamProfile { xp: number; levelInfo: LevelInfo; streak: number; longestStreak: number; gapDays: number; badges: BadgeEntry[]; allBadgeDefs: BadgeDef[]; }
interface MasterySubject { subject: string; mastery: number; correct: number; total: number; }
interface WeakTopic { key: string; subject: string; topic: string; mastery: number; total: number; }
interface MasteryData { subjects: MasterySubject[]; weakTopics: WeakTopic[]; totalQuestions: number; }
interface ChallengeData {
  challenge: { id: string; date: string; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption?: string; explanation?: string; subject: string; topic: string; };
  alreadyAttempted: boolean; userAnswer: string | null; userCorrect: boolean | null;
  stats: { totalAttempts: number; correctCount: number; correctPct: number; };
}
interface LeaderboardEntry { rank: number; displayName: string; timeTaken: number | null; }
interface WeeklyReportData { totalTests: number; totalQuestionsAttempted: number; overallAccuracy: number; doubtQuestions: number; streak: number; subjects: Array<{ subject: string; tests: number; accuracy: number; avgScore: number; maxScore: number; }>; narrative: string; weekStart: string; }

const OPTIONS = ['A', 'B', 'C', 'D'] as const;
const SUBJECT_COLORS: Record<string, string> = { Biology: '#22c55e', Chemistry: '#f59e0b', Physics: '#6366f1' };

function masteryColor(pct: number) {
  if (pct >= 70) return '#22c55e';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

function MasteryBar({ pct, subject }: { pct: number; subject: string }) {
  const color = SUBJECT_COLORS[subject] ?? masteryColor(pct);
  return (
    <div style={{ background: '#0f172a', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GamificationPage() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<Tab>('profile');

  const [profile, setProfile] = useState<GamProfile | null>(null);
  const [mastery, setMastery] = useState<MasteryData | null>(null);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challengeStart] = useState(Date.now());
  const [submitResult, setSubmitResult] = useState<{ isCorrect: boolean; correctOption: string; explanation: string } | null>(null);
  const [newBadges, setNewBadges] = useState<BadgeDef[]>([]);
  const [comebackMsg, setComebackMsg] = useState('');

  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  const load = useCallback(async (t: Tab) => {
    setError(''); setLoading(true);
    try {
      if (t === 'profile') {
        const [profRes, comebackRes] = await Promise.all([
          fetch(`${API_BASE}/api/gamification/profile`, { headers }),
          fetch(`${API_BASE}/api/gamification/comeback`, { headers }),
        ]);
        const profData = await profRes.json() as GamProfile;
        setProfile(profData);
        const cb = await comebackRes.json() as { needsComeback: boolean; message?: string };
        if (cb.needsComeback && cb.message) setComebackMsg(cb.message);
      } else if (t === 'mastery') {
        const res = await fetch(`${API_BASE}/api/gamification/mastery`, { headers });
        setMastery(await res.json() as MasteryData);
      } else if (t === 'challenge') {
        const [chalRes, lbRes] = await Promise.all([
          fetch(`${API_BASE}/api/daily-challenge/today`, { headers }),
          fetch(`${API_BASE}/api/daily-challenge/leaderboard`, { headers }),
        ]);
        const chalData = await chalRes.json() as ChallengeData;
        setChallenge(chalData);
        const lbData = await lbRes.json() as { leaderboard: LeaderboardEntry[] };
        setLeaderboard(lbData.leaderboard ?? []);
        if (chalData.alreadyAttempted && chalData.userAnswer) {
          setSelectedAnswer(chalData.userAnswer);
          if (chalData.challenge.correctOption) {
            setSubmitResult({ isCorrect: !!chalData.userCorrect, correctOption: chalData.challenge.correctOption, explanation: chalData.challenge.explanation ?? '' });
          }
        }
      } else if (t === 'report') {
        const res = await fetch(`${API_BASE}/api/weekly-report`, { headers });
        const data = await res.json() as { report: WeeklyReportData };
        setWeeklyReport(data.report);
      }
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(tab); }, [tab, load]);

  const handleTab = (t: Tab) => { setTab(t); setError(''); };

  async function submitChallenge() {
    if (!selectedAnswer || !challenge || submitting) return;
    setSubmitting(true);
    try {
      const timeTaken = Math.round((Date.now() - challengeStart) / 1000);
      const res = await fetch(`${API_BASE}/api/daily-challenge/submit`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ answer: selectedAnswer, timeTaken }),
      });
      const data = await res.json() as { isCorrect: boolean; correctOption: string; explanation: string };
      setSubmitResult(data);

      // Award XP
      const actType = data.isCorrect ? 'challenge_correct' : 'challenge_attempt';
      const actRes = await fetch(`${API_BASE}/api/gamification/activity`, {
        method: 'POST', headers: jsonHeaders, body: JSON.stringify({ type: actType }),
      });
      const actData = await actRes.json() as { newBadges?: BadgeDef[]; xpGained?: number };
      if (actData.newBadges?.length) setNewBadges(actData.newBadges);

      // Refresh challenge + leaderboard
      await load('challenge');
    } catch { setError('Failed to submit. Please try again.'); }
    finally { setSubmitting(false); }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile',   label: 'My Profile',      icon: <Star size={14} /> },
    { id: 'challenge', label: 'Daily Challenge',  icon: <Zap size={14} /> },
    { id: 'mastery',   label: 'Subject Mastery',  icon: <Target size={14} /> },
    { id: 'report',    label: 'Weekly Report',    icon: <Calendar size={14} /> },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Trophy size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Gamification & Progress</h1>
          <p className="page-desc">Streaks, XP, badges, daily challenges — stay motivated every day</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', background: '#1e293b', padding: '6px', borderRadius: '10px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => handleTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#6366f1' : 'transparent', color: tab === t.id ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* New badge toast */}
      {newBadges.length > 0 && (
        <div style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
          <p style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '8px' }}>🎉 New Badge{newBadges.length > 1 ? 's' : ''} Unlocked!</p>
          {newBadges.map((b) => b && (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <span style={{ fontSize: '24px' }}>{b.icon}</span>
              <div>
                <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '14px' }}>{b.name}</p>
                <p style={{ color: '#94a3b8', fontSize: '12px' }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', marginBottom: '16px' }}>{error}</div>}
      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', padding: '24px 0' }}><Loader2 size={20} className="spin" /> Loading…</div>}

      {/* ── Profile ── */}
      {!loading && tab === 'profile' && profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Comeback message */}
          {comebackMsg && (
            <div style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '16px 20px' }}>
              <p style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '6px' }}>💪 Welcome Back!</p>
              <MarkdownText content={comebackMsg} style={{ color: '#c4b5fd', fontSize: '14px' }} />
            </div>
          )}

          {/* XP + Level card */}
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px' }}>{profile.levelInfo.icon}</div>
              <div>
                <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level {profile.levelInfo.level}</p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{profile.levelInfo.name}</p>
                <p style={{ color: '#6366f1', fontWeight: 700, fontSize: '16px' }}>{profile.xp.toLocaleString('en-IN')} XP</p>
              </div>
            </div>

            {/* Progress bar */}
            {profile.levelInfo.nextLevel && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#64748b' }}>
                  <span>{profile.levelInfo.name}</span>
                  <span>{profile.levelInfo.xpToNext} XP to {profile.levelInfo.nextLevel.name}</span>
                </div>
                <div style={{ background: '#0f172a', borderRadius: '999px', height: '12px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${profile.levelInfo.progressPct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: '999px', transition: 'width 0.6s ease' }} />
                </div>
                <p style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                  {profile.levelInfo.progressPct}% to Level {profile.levelInfo.level + 1}
                </p>
              </div>
            )}
            {!profile.levelInfo.nextLevel && (
              <div style={{ background: 'rgba(251,191,36,0.1)', borderRadius: '8px', padding: '10px', textAlign: 'center', color: '#fbbf24', fontWeight: 700 }}>
                🏆 Maximum Level Reached — You are a NEET Champion!
              </div>
            )}
          </div>

          {/* Streak cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', borderTop: '3px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Flame size={18} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Current Streak</span>
              </div>
              <p style={{ fontSize: '40px', fontWeight: 800, color: '#ef4444', margin: 0 }}>{profile.streak}</p>
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>consecutive days</p>
              {profile.streak === 0 && <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '4px' }}>Study today to start your streak!</p>}
            </div>
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', borderTop: '3px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Star size={18} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Longest Streak</span>
              </div>
              <p style={{ fontSize: '40px', fontWeight: 800, color: '#f59e0b', margin: 0 }}>{profile.longestStreak}</p>
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>personal best</p>
            </div>
          </div>

          {/* Level path */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level Path</p>
            <div style={{ display: 'flex', gap: '0', alignItems: 'center' }}>
              {[
                { level: 1, name: 'Beginner', icon: '🌱', minXP: 0 },
                { level: 2, name: 'Improving', icon: '📚', minXP: 500 },
                { level: 3, name: 'Competitive', icon: '⚔️', minXP: 1500 },
                { level: 4, name: 'NEET Ready', icon: '🎯', minXP: 3500 },
                { level: 5, name: 'Champion', icon: '🏆', minXP: 7000 },
              ].map((l, i) => {
                const isCurrentOrPast = profile.xp >= l.minXP;
                const isCurrent = profile.levelInfo.level === l.level;
                return (
                  <div key={l.level} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isCurrent ? '#6366f1' : isCurrentOrPast ? '#1e3a5f' : '#1e293b', border: `2px solid ${isCurrent ? '#6366f1' : isCurrentOrPast ? '#334155' : '#1e293b'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                        {l.icon}
                      </div>
                      <p style={{ fontSize: '10px', color: isCurrent ? '#a5b4fc' : isCurrentOrPast ? '#64748b' : '#334155', textAlign: 'center', maxWidth: '60px' }}>{l.name}</p>
                    </div>
                    {i < 4 && <div style={{ flex: 1, height: '2px', background: profile.xp >= [500, 1500, 3500, 7000][i] ? '#334155' : '#1e293b', margin: '0 2px 16px' }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badges */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Badge Collection — {profile.badges.length} / {profile.allBadgeDefs.length} earned
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '10px' }}>
              {profile.allBadgeDefs.map((def) => {
                const earned = profile.badges.find((b) => b.badgeId === def.id);
                return (
                  <div key={def.id} title={`${def.name}: ${def.desc}`}
                    style={{ background: earned ? '#0f172a' : '#0d1117', borderRadius: '10px', padding: '12px 8px', textAlign: 'center', border: `1px solid ${earned ? def.color + '44' : '#1e293b'}`, opacity: earned ? 1 : 0.35, transition: 'opacity 0.2s' }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>{def.icon}</div>
                    <p style={{ fontSize: '10px', color: earned ? '#e2e8f0' : '#475569', fontWeight: 600, lineHeight: 1.2 }}>{def.name}</p>
                    {earned && <p style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{new Date(earned.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Daily Challenge ── */}
      {!loading && tab === 'challenge' && challenge && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Challenge header */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, color: '#fbbf24', fontSize: '14px' }}>⚡ Daily Challenge — {challenge.challenge.date}</p>
              <p style={{ color: '#64748b', fontSize: '12px' }}>{challenge.challenge.subject} · {challenge.challenge.topic}</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#94a3b8' }}>
              <p>{challenge.stats.totalAttempts} attempted</p>
              <p style={{ color: '#22c55e' }}>{challenge.stats.correctPct}% got it right</p>
            </div>
          </div>

          {/* Question */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
            <p style={{ color: '#e2e8f0', fontSize: '16px', lineHeight: 1.7, marginBottom: '20px', whiteSpace: 'pre-wrap' }}>{challenge.challenge.questionText}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {OPTIONS.map((opt) => {
                const label = challenge.challenge[`option${opt}` as keyof typeof challenge.challenge] as string;
                const isSelected = selectedAnswer === opt;
                const isCorrect = submitResult?.correctOption === opt;
                const isWrong = submitResult && isSelected && !isCorrect;

                let bg = '#0f172a', border = '#334155', color = '#cbd5e1';
                if (submitResult) {
                  if (isCorrect) { bg = 'rgba(34,197,94,0.12)'; border = '#22c55e'; color = '#86efac'; }
                  else if (isWrong) { bg = 'rgba(239,68,68,0.12)'; border = '#ef4444'; color = '#fca5a5'; }
                } else if (isSelected) {
                  bg = 'rgba(99,102,241,0.15)'; border = '#6366f1'; color = '#a5b4fc';
                }

                return (
                  <button key={opt}
                    onClick={() => !submitResult && !challenge.alreadyAttempted && setSelectedAnswer(opt)}
                    disabled={!!submitResult || challenge.alreadyAttempted}
                    style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: `2px solid ${border}`, background: bg, color, cursor: submitResult || challenge.alreadyAttempted ? 'default' : 'pointer', fontSize: '14px', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, minWidth: '18px' }}>{opt}.</span>
                    <span style={{ flex: 1 }}>{label}</span>
                    {submitResult && isCorrect && <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />}
                    {submitResult && isWrong && <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            {!submitResult && !challenge.alreadyAttempted && (
              <button onClick={submitChallenge} disabled={!selectedAnswer || submitting}
                style={{ marginTop: '16px', padding: '11px 28px', borderRadius: '9px', border: 'none', background: selectedAnswer ? '#6366f1' : '#334155', color: '#fff', cursor: selectedAnswer ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {submitting ? <><Loader2 size={16} className="spin" /> Submitting…</> : '⚡ Submit Answer'}
              </button>
            )}

            {submitResult && (
              <div style={{ marginTop: '16px', background: submitResult.isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${submitResult.isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '10px', padding: '14px' }}>
                <p style={{ fontWeight: 700, color: submitResult.isCorrect ? '#22c55e' : '#ef4444', marginBottom: '6px' }}>
                  {submitResult.isCorrect ? '✅ Correct! +100 XP' : `❌ Wrong — correct answer was ${submitResult.correctOption}`}
                </p>
                <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6 }}>{submitResult.explanation}</p>
              </div>
            )}

            {challenge.alreadyAttempted && !submitResult && (
              <div style={{ marginTop: '12px', color: '#64748b', fontSize: '13px' }}>Already submitted today's challenge.</div>
            )}
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>🏆 Today's Fastest Correct</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leaderboard.map((entry) => (
                  <div key={entry.rank} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#0f172a', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 800, color: entry.rank <= 3 ? '#fbbf24' : '#475569', minWidth: '24px', fontSize: '15px' }}>
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `${entry.rank}.`}
                    </span>
                    <span style={{ flex: 1, color: '#e2e8f0', fontSize: '14px' }}>{entry.displayName}</span>
                    {entry.timeTaken !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '12px' }}>
                        <Clock size={12} /> {entry.timeTaken}s
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Subject Mastery ── */}
      {!loading && tab === 'mastery' && mastery && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mastery.totalQuestions === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#475569' }}>
              <BookOpen size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
              <p>No test data yet. Complete some tests to see your subject mastery.</p>
            </div>
          ) : (
            <>
              <p style={{ color: '#64748b', fontSize: '13px' }}>Based on {mastery.totalQuestions.toLocaleString('en-IN')} questions answered across all tests.</p>

              {mastery.subjects.map((s) => (
                <div key={s.subject} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: SUBJECT_COLORS[s.subject] ?? '#6366f1', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '16px' }}>{s.subject}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '28px', fontWeight: 800, color: masteryColor(s.mastery) }}>{s.mastery}%</span>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{s.correct}/{s.total} correct</p>
                    </div>
                  </div>
                  <MasteryBar pct={s.mastery} subject={s.subject} />
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px' }}>
                    {s.mastery >= 70
                      ? <span style={{ color: '#22c55e' }}>✅ Mastered — maintain this level</span>
                      : s.mastery >= 50
                      ? <span style={{ color: '#f59e0b' }}>⚠️ Improving — aim for 70%+</span>
                      : <span style={{ color: '#ef4444' }}>🔴 Needs work — focus more practice here</span>}
                  </div>
                </div>
              ))}

              {/* Weak topics */}
              {mastery.weakTopics.length > 0 && (
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>🎯 Focus These Topics</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {mastery.weakTopics.map((t) => (
                      <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', borderRadius: '8px', padding: '10px 14px' }}>
                        <div>
                          <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '13px', margin: 0 }}>{t.topic}</p>
                          <p style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{t.subject} · {t.total} questions</p>
                        </div>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: masteryColor(t.mastery) }}>{t.mastery}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Weekly Report ── */}
      {!loading && tab === 'report' && weeklyReport && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stats summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Tests Taken',   value: weeklyReport.totalTests,            color: '#6366f1', icon: '📝' },
              { label: 'Qs Attempted',  value: weeklyReport.totalQuestionsAttempted, color: '#22c55e', icon: '❓' },
              { label: 'Accuracy',      value: `${weeklyReport.overallAccuracy}%`,  color: '#f59e0b', icon: '🎯' },
              { label: 'Doubts Asked',  value: weeklyReport.doubtQuestions,         color: '#06b6d4', icon: '💬' },
              { label: 'Streak',        value: `${weeklyReport.streak}d`,           color: '#ef4444', icon: '🔥' },
            ].map((stat) => (
              <div key={stat.label} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: '20px', marginBottom: '4px' }}>{stat.icon}</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: stat.color, margin: '0 0 2px' }}>{stat.value}</p>
                <p style={{ fontSize: '11px', color: '#64748b' }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Subject breakdown */}
          {weeklyReport.subjects.length > 0 && (
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>This Week's Subjects</p>
              {weeklyReport.subjects.map((s) => (
                <div key={s.subject} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #0f172a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SUBJECT_COLORS[s.subject] ?? '#6366f1' }} />
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{s.subject}</span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>{s.tests} test{s.tests !== 1 ? 's' : ''}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: masteryColor(s.accuracy) }}>{s.accuracy}%</span>
                </div>
              ))}
            </div>
          )}

          {/* AI narrative */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Calendar size={16} style={{ color: '#6366f1' }} />
              <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '15px' }}>Week of {weeklyReport.weekStart}</p>
            </div>
            {weeklyReport.narrative
              ? <MarkdownText content={weeklyReport.narrative} style={{ color: '#cbd5e1', fontSize: '14px' }} />
              : <p style={{ color: '#cbd5e1', fontSize: '14px' }}>Complete some tests this week to generate your personalised report card.</p>
            }
          </div>
        </div>
      )}
    </div>
  );
}
