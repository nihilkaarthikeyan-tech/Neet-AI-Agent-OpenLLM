import { useState, useEffect, useCallback } from 'react';
import { Users, Trophy, Lightbulb, MessageSquare, Loader2, Send, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

type Tab = 'leaderboard' | 'benchmark' | 'peer-doubts';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeaderEntry { rank: number; avgScore: number; isMe: boolean; }
interface LeaderData { leaderboard: LeaderEntry[]; myRank: number | null; district: string; totalStudents: number; }
interface BenchmarkData { benchmark: string; myNeetEstimate: number; achieversCount: number; }
interface AnsweredDoubt { id: string; subject: string; question: string; askCount: number; aiAnswer: string; answeredAt: string; }
interface PendingDoubt { id: string; subject: string; question: string; askCount: number; threshold: number; progressPct: number; }
interface PeerDoubtData { answered: AnsweredDoubt[]; pending: PendingDoubt[]; }

const SUBJECTS = ['Biology', 'Physics', 'Chemistry'];
const SUBJECT_COLORS: Record<string, string> = { Biology: '#22c55e', Chemistry: '#f59e0b', Physics: '#6366f1' };

export default function CommunityPage() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<Tab>('leaderboard');

  const [leaderData, setLeaderData] = useState<LeaderData | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [peerData, setPeerData] = useState<PeerDoubtData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Peer doubt form
  const [doubtQ, setDoubtQ] = useState('');
  const [doubtSubject, setDoubtSubject] = useState('Biology');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  // Filter for peer doubts
  const [filterSubject, setFilterSubject] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  const load = useCallback(async (t: Tab) => {
    setError(''); setLoading(true);
    try {
      if (t === 'leaderboard') {
        const res = await fetch(`${API_BASE}/api/community/district-leaderboard`, { headers });
        setLeaderData(await res.json() as LeaderData);
      } else if (t === 'benchmark') {
        const res = await fetch(`${API_BASE}/api/community/students-like-you`, { headers });
        setBenchmark(await res.json() as BenchmarkData);
      } else if (t === 'peer-doubts') {
        const url = filterSubject
          ? `${API_BASE}/api/community/peer-doubts?subject=${encodeURIComponent(filterSubject)}`
          : `${API_BASE}/api/community/peer-doubts`;
        const res = await fetch(url, { headers });
        setPeerData(await res.json() as PeerDoubtData);
      }
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  }, [token, filterSubject]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(tab); }, [tab, load]);

  async function submitDoubt() {
    if (!doubtQ.trim() || submitting) return;
    setSubmitting(true); setSubmitMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/community/peer-doubt`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ question: doubtQ.trim(), subject: doubtSubject }),
      });
      const data = await res.json() as { peerDoubt?: { askCount: number; answered: boolean; aiAnswer?: string | null; progressPct: number; threshold: number }; alreadyAsked?: boolean; error?: string };
      if (!res.ok) { setSubmitMsg(data.error ?? 'Failed.'); return; }
      const pd = data.peerDoubt!;
      if (pd.answered && pd.aiAnswer) {
        setSubmitMsg(`AI answered this doubt! ${pd.askCount} students asked it. Scroll to see the answer.`);
      } else if (data.alreadyAsked) {
        setSubmitMsg(`You already asked this. ${pd.askCount}/${pd.threshold} students needed — ${pd.progressPct}% there.`);
      } else {
        setSubmitMsg(`Doubt submitted! ${pd.askCount}/${pd.threshold} students have asked this (${pd.progressPct}% — AI answers at ${pd.threshold}).`);
      }
      setDoubtQ('');
      await load('peer-doubts');
    } catch { setSubmitMsg('Failed to submit. Please try again.'); }
    finally { setSubmitting(false); }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const TABS = [
    { id: 'leaderboard' as Tab, label: 'District Leaderboard', icon: <Trophy size={14} /> },
    { id: 'benchmark'   as Tab, label: 'Students Like You',    icon: <Lightbulb size={14} /> },
    { id: 'peer-doubts' as Tab, label: 'Peer Doubt Pool',      icon: <MessageSquare size={14} /> },
  ];

  const cardStyle: React.CSSProperties = { background: '#1e293b', borderRadius: '12px', padding: '20px' };

  return (
    <div className="page-container">
      <div className="page-header">
        <Users size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Community & Social</h1>
          <p className="page-desc">Compare with your district, learn from top scorers, ask shared doubts</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', background: '#1e293b', padding: '6px', borderRadius: '10px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#6366f1' : 'transparent', color: tab === t.id ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', marginBottom: '16px' }}>{error}</div>}
      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', padding: '24px 0' }}><Loader2 size={20} className="spin" /> Loading…</div>}

      {/* ── 39. District Leaderboard ── */}
      {!loading && tab === 'leaderboard' && leaderData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'Your District', value: leaderData.district },
              { label: 'Your Rank', value: leaderData.myRank ? `#${leaderData.myRank}` : 'N/A' },
              { label: 'Students Ranked', value: leaderData.totalStudents },
            ].map((s) => (
              <div key={s.label} style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>{s.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: '#e2e8f0' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {leaderData.leaderboard.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b', padding: '40px' }}>
              <Trophy size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>No students in your district yet. You'll be #1 as soon as you take a test!</p>
            </div>
          ) : (
            <div style={cardStyle}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                Top 50 — Anonymous (rank number only, no names)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leaderData.leaderboard.map((entry) => (
                  <div key={entry.rank} style={{
                    display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px',
                    background: entry.isMe ? 'rgba(99,102,241,0.15)' : '#0f172a',
                    border: entry.isMe ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                    borderRadius: '8px',
                  }}>
                    <span style={{ width: '32px', fontWeight: 800, color: entry.rank <= 3 ? '#fbbf24' : '#64748b', fontSize: '14px', textAlign: 'center' }}>
                      {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
                    </span>
                    <span style={{ flex: 1, color: entry.isMe ? '#a5b4fc' : '#94a3b8', fontWeight: entry.isMe ? 700 : 400 }}>
                      {entry.isMe ? 'You' : `Student #${entry.rank}`}
                    </span>
                    <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{entry.avgScore}/720</span>
                    <div style={{ width: '80px', background: '#1e293b', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(entry.avgScore / 720) * 100}%`, background: entry.isMe ? '#6366f1' : '#334155', borderRadius: '999px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 40. Students Like You ── */}
      {!loading && tab === 'benchmark' && benchmark && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...cardStyle, borderTop: '3px solid #6366f1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Lightbulb size={20} style={{ color: '#6366f1' }} />
              <div>
                <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '15px' }}>Your current NEET estimate</p>
                <p style={{ color: '#6366f1', fontWeight: 800, fontSize: '28px' }}>{benchmark.myNeetEstimate}/720</p>
              </div>
            </div>
          </div>

          {benchmark.achieversCount > 0 ? (
            <div style={cardStyle}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                {benchmark.achieversCount} students like you scored 600+ — here's what they did differently:
              </p>
              <p style={{ color: '#cbd5e1', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: '14px' }}>{benchmark.benchmark}</p>
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b', padding: '40px' }}>
              <p>Not enough data yet. Take more tests to see your benchmark comparison.</p>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'benchmark' && !benchmark && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b', padding: '40px' }}>
          <p>Take at least one test to see how you compare.</p>
        </div>
      )}

      {/* ── 41. Peer Doubt Pool ── */}
      {!loading && tab === 'peer-doubts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Submit form */}
          <div style={cardStyle}>
            <p style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '14px' }}>Submit a Doubt</p>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              When 10 students ask the same doubt, AI answers it publicly for everyone.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {SUBJECTS.map((s) => (
                <button key={s} onClick={() => setDoubtSubject(s)}
                  style={{ padding: '6px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    background: doubtSubject === s ? SUBJECT_COLORS[s] : '#0f172a',
                    color: doubtSubject === s ? '#fff' : '#64748b' }}>
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={doubtQ}
              onChange={(e) => setDoubtQ(e.target.value)}
              placeholder="Type your NEET doubt here… (e.g. 'What is the difference between light and dark reactions?')"
              rows={3}
              style={{ width: '100%', background: '#0f172a', border: '1.5px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
              <button
                onClick={submitDoubt}
                disabled={submitting || !doubtQ.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: submitting || !doubtQ.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !doubtQ.trim() ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                Submit Doubt
              </button>
              {submitMsg && <p style={{ fontSize: '13px', color: '#22c55e' }}>{submitMsg}</p>}
            </div>
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterSubject('')}
              style={{ padding: '6px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: !filterSubject ? '#6366f1' : '#1e293b', color: !filterSubject ? '#fff' : '#64748b' }}>
              All
            </button>
            {SUBJECTS.map((s) => (
              <button key={s} onClick={() => setFilterSubject(s)}
                style={{ padding: '6px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: filterSubject === s ? SUBJECT_COLORS[s] : '#1e293b', color: filterSubject === s ? '#fff' : '#64748b' }}>
                {s}
              </button>
            ))}
          </div>

          {/* Pending doubts (building momentum) */}
          {peerData && peerData.pending.length > 0 && (
            <div style={cardStyle}>
              <p style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '12px', fontSize: '13px' }}>
                ⏳ Building Up ({peerData.pending.length}) — Need 10 students to unlock AI answer
              </p>
              {peerData.pending.map((d) => (
                <div key={d.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: SUBJECT_COLORS[d.subject] ?? '#64748b', display: 'block', marginBottom: '4px' }}>{d.subject}</span>
                      <p style={{ color: '#cbd5e1', fontSize: '13px' }}>{d.question}</p>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{d.askCount}/{d.threshold} asked</span>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: '999px', height: '4px', overflow: 'hidden', marginTop: '8px' }}>
                    <div style={{ height: '100%', width: `${d.progressPct}%`, background: '#f59e0b', borderRadius: '999px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Answered doubts */}
          {peerData && peerData.answered.length > 0 ? (
            <div style={cardStyle}>
              <p style={{ fontWeight: 700, color: '#22c55e', marginBottom: '12px', fontSize: '13px' }}>
                ✅ AI-Answered ({peerData.answered.length})
              </p>
              {peerData.answered.map((d) => {
                const expanded = expandedIds.has(d.id);
                return (
                  <div key={d.id} style={{ background: '#0f172a', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} onClick={() => toggleExpand(d.id)}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: SUBJECT_COLORS[d.subject] ?? '#64748b', display: 'block', marginBottom: '4px' }}>{d.subject}</span>
                        <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>{d.question}</p>
                        <p style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{d.askCount} students asked this</p>
                      </div>
                      <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                    {expanded && (
                      <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', marginBottom: '6px' }}>AI Answer</p>
                        <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.aiAnswer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !loading && peerData && (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b', padding: '40px' }}>
              <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>No AI-answered doubts yet for this subject. Be the first to submit one!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
