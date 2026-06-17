import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Trophy, Zap, Target, BookX, Loader2,
  RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, Cell,
} from 'recharts';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

type Tab = 'best' | 'speed' | 'accuracy-speed' | 'mistakes';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BestEntry { subject: string; bestScore: number; maxPossible: number; bestPct: number; date: string; totalAttempts: number; }
interface SpeedEntry { subject: string; avgSeconds: number; questionCount: number; accuracy: number; }
interface SpeedData { bySubject: SpeedEntry[]; fastest: SpeedEntry | null; slowest: SpeedEntry | null; hasData: boolean; }
interface ScatterPoint { attemptId: string; date: string; subject: string; accuracy: number; avgSecPerQ: number; totalQ: number; }
interface MistakeQuestion { id: string; topic: string; subject: string; questionText: string; userAnswer: string | null; correctOption: string; errorType: string | null; }
interface MistakeTopic { topic: string; subject: string; count: number; errorTypes: Record<string, number>; questions: MistakeQuestion[]; }

const SUBJECT_COLORS: Record<string, string> = {
  Biology: '#22c55e', Chemistry: '#f59e0b', Physics: '#6366f1', Mixed: '#06b6d4',
};

const ERROR_LABELS: Record<string, { label: string; color: string; tip: string }> = {
  concept_gap:  { label: 'Concept Gap',      color: '#ef4444', tip: 'Re-read the NCERT chapter and use the AI Tutor.' },
  calculation:  { label: 'Calculation Error', color: '#f59e0b', tip: 'Practice more numericals for this topic.' },
  careless:     { label: 'Careless Mistake',  color: '#6366f1', tip: 'Read each option carefully before answering.' },
  trap:         { label: 'Trap Question',     color: '#8b5cf6', tip: 'Note the common traps in this topic.' },
  conceptual:   { label: 'Conceptual',        color: '#ef4444', tip: 'Review the concept thoroughly.' },
  silly:        { label: 'Silly Mistake',     color: '#f59e0b', tip: 'Slow down and double-check.' },
  misread:      { label: 'Misread',           color: '#6366f1', tip: 'Read the question stem twice.' },
  time_pressure:{ label: 'Time Pressure',     color: '#94a3b8', tip: 'Practice speed with timed mini-tests.' },
};

function medalColor(pct: number) {
  if (pct >= 80) return '#fbbf24'; // gold
  if (pct >= 60) return '#94a3b8'; // silver
  return '#cd7c2f'; // bronze
}

function secLabel(sec: number) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

// ── Custom scatter tooltip ────────────────────────────────────────────────────
function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      <p style={{ color: '#e2e8f0', fontWeight: 700, margin: 0 }}>{d.subject}</p>
      <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>{d.date}</p>
      <p style={{ color: '#22c55e', margin: '2px 0 0' }}>Accuracy: {d.accuracy}%</p>
      <p style={{ color: '#6366f1', margin: '2px 0 0' }}>Avg time: {secLabel(d.avgSecPerQ)}/Q</p>
      <p style={{ color: '#64748b', margin: '2px 0 0' }}>{d.totalQ} questions</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<Tab>('best');

  const [bests, setBests] = useState<BestEntry[]>([]);
  const [speedData, setSpeedData] = useState<SpeedData | null>(null);
  const [scatterPoints, setScatterPoints] = useState<ScatterPoint[]>([]);
  const [mistakes, setMistakes] = useState<MistakeTopic[]>([]);
  const [totalWrong, setTotalWrong] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [classifying, setClassifying] = useState<Set<string>>(new Set());
  const [classifyDone, setClassifyDone] = useState<Set<string>>(new Set());

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async (t: Tab) => {
    setError(''); setLoading(true);
    try {
      if (t === 'best') {
        const res = await fetch(`${API_BASE}/api/study-analytics/best`, { headers });
        const data = await res.json() as { bests: BestEntry[] };
        setBests(data.bests ?? []);
      } else if (t === 'speed') {
        const res = await fetch(`${API_BASE}/api/study-analytics/speed`, { headers });
        const data = await res.json() as SpeedData;
        setSpeedData(data);
      } else if (t === 'accuracy-speed') {
        const res = await fetch(`${API_BASE}/api/study-analytics/accuracy-speed`, { headers });
        const data = await res.json() as { points: ScatterPoint[] };
        setScatterPoints(data.points ?? []);
      } else if (t === 'mistakes') {
        const res = await fetch(`${API_BASE}/api/study-analytics/mistakes`, { headers });
        const data = await res.json() as { topics: MistakeTopic[]; totalWrong: number };
        setMistakes(data.topics ?? []);
        setTotalWrong(data.totalWrong ?? 0);
      }
    } catch { setError('Failed to load data. Make sure you have completed some tests.'); }
    finally { setLoading(false); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(tab); }, [tab, load]);

  const handleTab = (t: Tab) => { setTab(t); setError(''); };

  async function classifyTopic(topic: MistakeTopic) {
    const qIds = topic.questions.map((q) => q.id);
    const key = `${topic.subject}::${topic.topic}`;
    setClassifying((s) => new Set([...s, key]));
    try {
      const res = await fetch(`${API_BASE}/api/study-analytics/classify-ai`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: qIds }),
      });
      const data = await res.json() as { classified: Array<{ id: string; errorType: string; reason: string }> };
      if (res.ok) {
        // Merge AI classifications back into local state
        setMistakes((prev) => prev.map((t2) => {
          if (`${t2.subject}::${t2.topic}` !== key) return t2;
          return {
            ...t2,
            questions: t2.questions.map((q) => {
              const hit = data.classified.find((c) => c.id === q.id);
              return hit ? { ...q, errorType: hit.errorType } : q;
            }),
          };
        }));
        setClassifyDone((s) => new Set([...s, key]));
      }
    } catch { /* silently ignore */ }
    finally { setClassifying((s) => { const n = new Set(s); n.delete(key); return n; }); }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'best',           label: 'Beat Your Best',     icon: <Trophy size={14} /> },
    { id: 'speed',          label: 'Speed Tracker',      icon: <Zap size={14} /> },
    { id: 'accuracy-speed', label: 'Accuracy vs Speed',  icon: <Target size={14} /> },
    { id: 'mistakes',       label: 'Mistake Diary',      icon: <BookX size={14} /> },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <BarChart2 size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Performance Insights</h1>
          <p className="page-desc">Speed, accuracy, mistakes and personal bests — all in one place</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', background: '#1e293b', padding: '6px', borderRadius: '10px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => handleTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#6366f1' : 'transparent', color: tab === t.id ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', marginBottom: '16px' }}>{error}</div>}
      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', padding: '24px 0' }}><Loader2 size={20} className="spin" /> Loading…</div>}

      {/* ── Beat Your Best ── */}
      {!loading && tab === 'best' && (
        <div>
          {bests.length === 0 ? (
            <EmptyState text="Complete at least one test to see your personal bests." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {bests.sort((a, b) => b.bestPct - a.bestPct).map((b) => {
                const color = medalColor(b.bestPct);
                return (
                  <div key={b.subject} style={{ background: '#1e293b', borderRadius: '14px', padding: '24px', textAlign: 'center', border: `2px solid ${color}44` }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                      {b.bestPct >= 80 ? '🥇' : b.bestPct >= 60 ? '🥈' : '🥉'}
                    </div>
                    <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{b.subject}</p>
                    <p style={{ fontSize: '40px', fontWeight: 800, color, margin: '0 0 4px' }}>{b.bestPct}%</p>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>{b.bestScore} / {b.maxPossible} marks</p>
                    <p style={{ fontSize: '12px', color: '#475569', marginTop: '8px' }}>Achieved {b.date}</p>
                    <p style={{ fontSize: '12px', color: '#475569' }}>{b.totalAttempts} test{b.totalAttempts !== 1 ? 's' : ''} taken</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Speed Tracker ── */}
      {!loading && tab === 'speed' && speedData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!speedData.hasData ? (
            <EmptyState text="No speed data yet. Time tracking starts automatically when you answer questions in a test." />
          ) : (
            <>
              {/* Summary cards */}
              {speedData.fastest && speedData.slowest && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ background: '#1e293b', borderRadius: '12px', padding: '18px', borderTop: '3px solid #22c55e' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>⚡ Fastest Subject</p>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: '#22c55e', margin: '6px 0 2px' }}>{speedData.fastest.subject}</p>
                    <p style={{ fontSize: '14px', color: '#94a3b8' }}>{secLabel(speedData.fastest.avgSeconds)} / question</p>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: '12px', padding: '18px', borderTop: '3px solid #ef4444' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>🐢 Slowest Subject</p>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: '#ef4444', margin: '6px 0 2px' }}>{speedData.slowest.subject}</p>
                    <p style={{ fontSize: '14px', color: '#94a3b8' }}>{secLabel(speedData.slowest.avgSeconds)} / question</p>
                  </div>
                </div>
              )}

              {/* Bar chart */}
              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' }}>Avg Time Per Question (seconds)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={speedData.bySubject} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis dataKey="subject" type="category" tick={{ fill: '#94a3b8', fontSize: 13 }} width={80} />
                    <Tooltip formatter={(v: number) => [`${v}s`, 'Avg time']} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    <Bar dataKey="avgSeconds" radius={[0, 6, 6, 0]}>
                      {speedData.bySubject.map((entry) => (
                        <Cell key={entry.subject} fill={SUBJECT_COLORS[entry.subject] ?? '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p style={{ fontSize: '12px', color: '#475569', marginTop: '8px' }}>NEET target: ≤120s per question (3 hrs for 180 Qs)</p>
              </div>

              {/* Per-subject stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {speedData.bySubject.map((s) => (
                  <div key={s.subject} style={{ background: '#1e293b', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: SUBJECT_COLORS[s.subject] ?? '#6366f1', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{s.subject}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>{secLabel(s.avgSeconds)}/Q</span>
                      <span style={{ color: '#22c55e' }}>{s.accuracy}% accuracy</span>
                      <span style={{ color: '#64748b' }}>{s.questionCount} Qs</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Accuracy vs Speed ── */}
      {!loading && tab === 'accuracy-speed' && (
        <div>
          {scatterPoints.length < 2 ? (
            <EmptyState text="Complete at least 2 timed tests to see the accuracy vs speed chart." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>Accuracy vs Speed</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Each dot is a test attempt. Top-left = fast + accurate (ideal for NEET).</p>
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="avgSecPerQ" name="Avg sec/Q" type="number"
                      label={{ value: 'Avg sec / question', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 12 }}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="accuracy" name="Accuracy" type="number" domain={[0, 100]}
                      label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <Tooltip content={<ScatterTooltip />} />
                    <Scatter data={scatterPoints} name="Tests">
                      {scatterPoints.map((p, i) => (
                        <Cell key={i} fill={SUBJECT_COLORS[p.subject] ?? '#6366f1'} opacity={0.85} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {Object.entries(SUBJECT_COLORS).map(([subj, color]) =>
                    scatterPoints.some((p) => p.subject === subj) ? (
                      <div key={subj} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                        {subj}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>

              {/* Quadrant hint */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: '✅ Fast & Accurate', desc: 'Top-left — NEET ideal zone', color: '#22c55e' },
                  { label: '⚠️ Slow but Accurate', desc: 'Top-right — need more speed drills', color: '#f59e0b' },
                  { label: '⚠️ Fast but Wrong', desc: 'Bottom-left — need more concept work', color: '#6366f1' },
                  { label: '❌ Slow & Wrong', desc: 'Bottom-right — focus on fundamentals', color: '#ef4444' },
                ].map((q) => (
                  <div key={q.label} style={{ background: '#1e293b', borderRadius: '8px', padding: '12px', borderLeft: `3px solid ${q.color}` }}>
                    <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '13px', margin: 0 }}>{q.label}</p>
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{q.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mistake Diary ── */}
      {!loading && tab === 'mistakes' && (
        <div>
          {mistakes.length === 0 ? (
            <EmptyState text="No mistakes recorded in the last 30 days. Keep attempting tests!" />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{totalWrong}</span> wrong answers across <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{mistakes.length}</span> topics (last 30 days)
                </p>
                <button onClick={() => void load('mistakes')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mistakes.map((topic) => {
                  const key = `${topic.subject}::${topic.topic}`;
                  const expanded = expandedTopics.has(key);
                  const isClassifying = classifying.has(key);
                  const isDone = classifyDone.has(key);

                  return (
                    <div key={key} style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                      {/* Topic header */}
                      <div
                        onClick={() => setExpandedTopics((s) => { const n = new Set(s); if (expanded) n.delete(key); else n.add(key); return n; })}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SUBJECT_COLORS[topic.subject] ?? '#6366f1', flexShrink: 0 }} />
                          <div>
                            <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '14px', margin: 0 }}>{topic.topic}</p>
                            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>{topic.subject}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                            {topic.count} wrong
                          </span>
                          {/* Error type breakdown */}
                          {Object.entries(topic.errorTypes).slice(0, 3).map(([et, count]) => {
                            const info = ERROR_LABELS[et];
                            return info ? (
                              <span key={et} style={{ fontSize: '11px', color: info.color, background: `${info.color}15`, padding: '2px 7px', borderRadius: '20px', fontWeight: 600 }}>
                                {count}× {info.label}
                              </span>
                            ) : null;
                          })}
                          {expanded ? <ChevronUp size={16} style={{ color: '#64748b' }} /> : <ChevronDown size={16} style={{ color: '#64748b' }} />}
                        </div>
                      </div>

                      {/* Expanded questions */}
                      {expanded && (
                        <div style={{ borderTop: '1px solid #0f172a', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {topic.questions.map((q) => {
                            const errInfo = q.errorType ? ERROR_LABELS[q.errorType] : null;
                            return (
                              <div key={q.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px' }}>
                                <p style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>{q.questionText.slice(0, 200)}{q.questionText.length > 200 ? '…' : ''}</p>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px' }}>
                                  <span style={{ color: '#ef4444' }}>You: {q.userAnswer}</span>
                                  <span style={{ color: '#22c55e' }}>Correct: {q.correctOption}</span>
                                  {errInfo && (
                                    <span style={{ color: errInfo.color }}>
                                      {errInfo.label} — {errInfo.tip}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* AI Classify button */}
                          <button
                            onClick={() => void classifyTopic(topic)}
                            disabled={isClassifying || isDone}
                            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: `1px solid ${isDone ? '#22c55e' : '#334155'}`, background: 'transparent', color: isDone ? '#22c55e' : '#94a3b8', cursor: isClassifying || isDone ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}>
                            {isClassifying ? <><Loader2 size={12} className="spin" /> Classifying…</> : isDone ? '✓ AI Classified' : '🤖 AI Classify Errors'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#475569' }}>
      <BarChart2 size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
      <p style={{ fontSize: '14px' }}>{text}</p>
    </div>
  );
}
