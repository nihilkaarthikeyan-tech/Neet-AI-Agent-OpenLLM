import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardList, Play, ChevronLeft, ChevronRight,
  Clock, CheckCircle, XCircle, AlertCircle, RotateCcw, Loader2, BookOpen,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

// ─── Types ────────────────────────────────────────────────────────────────────
type Question = {
  id: string;
  orderIndex: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  subject: string;
  topic?: string;
  userAnswer: string | null;
  // only present after submission
  correctOption?: string;
  explanation?: string;
  errorType?: string | null;
};

type Attempt = {
  id: string;
  subject: string;
  totalQ: number;
  score: number | null;
  timeTaken: number | null;
  submittedAt: string | null;
  createdAt: string;
  questions: Question[];
};

type PastAttempt = {
  id: string;
  subject: string;
  totalQ: number;
  score: number | null;
  timeTaken: number | null;
  submittedAt: string | null;
  createdAt: string;
};

type View = 'home' | 'generating' | 'inprogress' | 'results';

const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mixed'];
const COUNTS = [10, 20, 45];
const OPTIONS = ['A', 'B', 'C', 'D'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function scoreColor(pct: number): string {
  if (pct >= 70) return '#22c55e';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TestsPage() {
  const { token } = useAuthStore();

  // Config
  const [subject, setSubject] = useState('Physics');
  const [count, setCount] = useState(10);
  const [adaptive, setAdaptive] = useState(false);

  // Error classification
  const [classified, setClassified] = useState<Record<string, string>>({});

  // State machine
  const [view, setView] = useState<View>('home');
  const [error, setError] = useState('');

  // Active test
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);

  // Past tests
  const [pastTests, setPastTests] = useState<PastAttempt[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  // Timer — 2 minutes per question
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTime = (attempt?.totalQ ?? 0) * 120;

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (view === 'inprogress') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [view, stopTimer]);

  // Auto-submit when time is up
  useEffect(() => {
    if (view === 'inprogress' && maxTime > 0 && elapsed >= maxTime) {
      stopTimer();
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, maxTime, view]);

  // Load past tests on mount
  useEffect(() => {
    async function loadPast() {
      setLoadingPast(true);
      try {
        const res = await fetch(`${API_BASE}/api/tests`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json() as { attempts: PastAttempt[] };
        if (res.ok) setPastTests(data.attempts);
      } catch (_) {
        // ignore
      } finally {
        setLoadingPast(false);
      }
    }
    loadPast();
  }, [token, view]); // re-fetch when returning to home

  // ── Generate test ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError('');
    setView('generating');
    try {
      const res = await fetch(`${API_BASE}/api/tests/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, count, adaptive }),
      });
      const data = await res.json() as { attempt?: Attempt; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate test');
      setAttempt(data.attempt!);
      setAnswers({});
      setCurrentIdx(0);
      setElapsed(0);
      setView('inprogress');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate test');
      setView('home');
    }
  };

  // ── Save answer ──────────────────────────────────────────────────────────
  const handleAnswer = async (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    // Fire-and-forget to backend
    fetch(`${API_BASE}/api/tests/${attempt!.id}/answer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ questionId, answer }),
    }).catch(() => {
      /* ignore — will submit at end */
    });
  };

  // ── Submit test ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!attempt) return;
    stopTimer();
    try {
      const res = await fetch(`${API_BASE}/api/tests/${attempt.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ timeTaken: elapsed }),
      });
      const data = await res.json() as { attempt?: Attempt; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit');
      setAttempt(data.attempt!);
      setView('results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit test');
    }
  };

  // ─── Views ────────────────────────────────────────────────────────────────
  if (view === 'generating') {
    return (
      <div className="page-loading-center">
        <Loader2 size={48} className="spin" />
        <div style={{ textAlign: 'center' }}>
          <h2 className="section-heading" style={{ color: '#e2e8f0', margin: 0 }}>Generating your {subject} test…</h2>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>Our AI is crafting {count} NEET-level questions. This may take 15–30 seconds.</p>
        </div>
      </div>
    );
  }

  if (view === 'inprogress' && attempt) {
    const q = attempt.questions[currentIdx];
    const totalQ = attempt.questions.length;
    const answered = Object.keys(answers).length;

    return (
      <div className="page-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', borderRadius: '12px', padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={20} style={{ color: '#6366f1' }} />
            <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{attempt.subject} Mock Test</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: maxTime - elapsed <= 60 ? '#ef4444' : '#94a3b8' }}>
              <Clock size={16} />
              <span style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700 }}>{formatTime(Math.max(0, maxTime - elapsed))}</span>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>{answered}/{totalQ} answered</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>

          {/* Question panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#6366f1', fontWeight: 600 }}>Q{currentIdx + 1} of {totalQ}</span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{q.subject}</span>
              </div>
              <p style={{ color: '#e2e8f0', fontSize: '16px', lineHeight: 1.7, marginBottom: '24px', whiteSpace: 'pre-wrap' }}>{q.questionText}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {OPTIONS.map((opt) => {
                  const label = q[`option${opt}` as keyof Question] as string;
                  const isSelected = (answers[q.id] ?? q.userAnswer) === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleAnswer(q.id, opt)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `2px solid ${isSelected ? '#6366f1' : '#334155'}`,
                        background: isSelected ? 'rgba(99,102,241,0.15)' : '#0f172a',
                        color: isSelected ? '#a5b4fc' : '#cbd5e1',
                        cursor: 'pointer',
                        fontSize: '14px',
                        lineHeight: 1.5,
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                      }}
                    >
                      <span style={{ fontWeight: 700, minWidth: '18px', color: isSelected ? '#818cf8' : '#475569' }}>{opt}.</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: currentIdx === 0 ? '#1e293b' : '#334155', color: currentIdx === 0 ? '#475569' : '#e2e8f0', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                <ChevronLeft size={16} /> Prev
              </button>

              {currentIdx === totalQ - 1 ? (
                <button
                  onClick={handleSubmit}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '15px' }}
                >
                  <CheckCircle size={16} /> Submit Test
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIdx((i) => Math.min(totalQ - 1, i + 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#334155', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600 }}
                >
                  Next <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Question navigator */}
          <div style={{ width: '200px', background: '#1e293b', borderRadius: '12px', padding: '16px', alignSelf: 'flex-start', position: 'sticky', top: '20px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {attempt.questions.map((aq, idx) => {
                const isAnswered = !!(answers[aq.id] ?? aq.userAnswer);
                const isCurrent = idx === currentIdx;
                return (
                  <button
                    key={aq.id}
                    onClick={() => setCurrentIdx(idx)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '6px', border: `2px solid ${isCurrent ? '#6366f1' : 'transparent'}`,
                      background: isCurrent ? '#6366f1' : isAnswered ? '#166534' : '#334155',
                      color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#166534', flexShrink: 0 }} /> Answered
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#334155', flexShrink: 0 }} /> Not visited
              </div>
            </div>
            <button
              onClick={handleSubmit}
              style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
            >
              End Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'results' && attempt && attempt.submittedAt) {
    const questions = attempt.questions;
    const maxScore = questions.length * 4;
    const correct = questions.filter((q) => q.userAnswer === q.correctOption).length;
    const wrong = questions.filter((q) => q.userAnswer && q.userAnswer !== q.correctOption).length;
    const skipped = questions.filter((q) => !q.userAnswer).length;
    const pct = Math.round(((attempt.score ?? 0) / maxScore) * 100);

    return (
      <div className="page-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Score card */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>{attempt.subject} Test — Results</h2>
          <div style={{ fontSize: '64px', fontWeight: 800, color: scoreColor(pct), margin: '16px 0' }}>
            {attempt.score ?? 0}
          </div>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>out of {maxScore} marks ({pct}%)</p>
          {attempt.timeTaken && (
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>Time taken: {formatTime(attempt.timeTaken)}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>{correct}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Correct (+{correct * 4})</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>{wrong}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Wrong (−{wrong})</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#94a3b8' }}>{skipped}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Skipped</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={() => setView('home')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#334155', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600 }}
            >
              <RotateCcw size={16} /> New Test
            </button>
          </div>
        </div>

        {/* Question review */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px' }}>Detailed Review</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.map((q, idx) => {
              const isCorrect = q.userAnswer === q.correctOption;
              const isWrong = q.userAnswer && !isCorrect;
              const isSkipped = !q.userAnswer;
              return (
                <div key={q.id} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', borderLeft: `4px solid ${isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#475569'}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                    {isCorrect && <CheckCircle size={18} style={{ color: '#22c55e', flexShrink: 0, marginTop: '2px' }} />}
                    {isWrong && <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />}
                    {isSkipped && <AlertCircle size={18} style={{ color: '#94a3b8', flexShrink: 0, marginTop: '2px' }} />}
                    <p style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: 1.6 }}><strong>Q{idx + 1}.</strong> {q.questionText}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                    {OPTIONS.map((opt) => {
                      const label = q[`option${opt}` as keyof Question] as string;
                      const isUserAns = q.userAnswer === opt;
                      const isRightAns = q.correctOption === opt;
                      return (
                        <div
                          key={opt}
                          style={{
                            padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                            background: isRightAns ? 'rgba(34,197,94,0.15)' : isUserAns && !isRightAns ? 'rgba(239,68,68,0.15)' : 'transparent',
                            color: isRightAns ? '#86efac' : isUserAns && !isRightAns ? '#fca5a5' : '#94a3b8',
                            border: `1px solid ${isRightAns ? 'rgba(34,197,94,0.3)' : isUserAns && !isRightAns ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
                          }}
                        >
                          <strong>{opt}.</strong> {label}
                          {isRightAns && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4ade80' }}>✓ Correct</span>}
                          {isUserAns && !isRightAns && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#f87171' }}>✗ Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #6366f1' }}>
                      <p style={{ fontSize: '13px', color: '#a5b4fc', lineHeight: 1.6 }}><strong>Explanation:</strong> {q.explanation}</p>
                    </div>
                  )}
                  {isWrong && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Classify your mistake:</p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                          { key: 'conceptual', label: '🧠 Conceptual', color: '#ef4444' },
                          { key: 'silly', label: '🤦 Silly', color: '#f59e0b' },
                          { key: 'misread', label: '👁️ Misread', color: '#6366f1' },
                          { key: 'time_pressure', label: '⏱️ Time Pressure', color: '#06b6d4' },
                        ].map(({ key, label, color }) => {
                          const active = (classified[q.id] ?? q.errorType) === key;
                          return (
                            <button key={key} onClick={async () => {
                              setClassified(c => ({ ...c, [q.id]: key }));
                              await fetch(`${API_BASE}/api/tests/${attempt!.id}/classify`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ questionId: q.id, errorType: key }),
                              }).catch(() => {});
                            }}
                              style={{ padding: '5px 12px', borderRadius: '20px', border: `1.5px solid ${active ? color : '#334155'}`, background: active ? `${color}22` : 'transparent', color: active ? color : '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Home view ──────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <div className="page-header">
        <ClipboardList size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Mock Tests</h1>
          <p className="page-desc">NEET-style timed exams with AI-powered explanations</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Test configurator */}
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#e2e8f0', marginBottom: '20px' }}>
          <Play size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#6366f1' }} />
          Start a New Test
        </h2>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Subject</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: `2px solid ${subject === s ? '#6366f1' : '#334155'}`,
                    background: subject === s ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: subject === s ? '#a5b4fc' : '#94a3b8',
                    cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Questions</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {COUNTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCount(c)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: `2px solid ${count === c ? '#6366f1' : '#334155'}`,
                    background: count === c ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: count === c ? '#a5b4fc' : '#94a3b8',
                    cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={handleGenerate}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '15px' }}
          >
            <Play size={18} /> Generate Test
          </button>
          <button
            onClick={() => setAdaptive(a => !a)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', border: `2px solid ${adaptive ? '#f59e0b' : '#334155'}`, background: adaptive ? 'rgba(245,158,11,0.1)' : 'transparent', color: adaptive ? '#f59e0b' : '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
            title="Focuses questions on your weak areas from analytics"
          >
            🎯 {adaptive ? 'Adaptive ON' : 'Adaptive Mode'}
          </button>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Scoring: +4 correct, −1 wrong, 0 skipped
          </p>
        </div>
      </div>

      {/* Past tests */}
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={16} style={{ color: '#6366f1' }} /> Past Tests
        </h2>

        {loadingPast && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
            <Loader2 size={16} className="spin" /> Loading…
          </div>
        )}

        {!loadingPast && pastTests.length === 0 && (
          <p style={{ color: '#475569', fontSize: '14px' }}>No tests taken yet. Generate your first test above!</p>
        )}

        {!loadingPast && pastTests.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pastTests.map((t) => {
              const maxScore = t.totalQ * 4;
              const pct = t.score != null ? Math.round((t.score / maxScore) * 100) : null;
              return (
                <div key={t.id} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '15px' }}>{t.subject}</span>
                    <span style={{ marginLeft: '8px', fontSize: '13px', color: '#64748b' }}>{t.totalQ} questions</span>
                  </div>
                  {pct !== null ? (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 800, fontSize: '20px', color: scoreColor(pct) }}>{t.score}</span>
                      <span style={{ fontSize: '13px', color: '#64748b' }}> / {maxScore} ({pct}%)</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#f59e0b' }}>In progress</span>
                  )}
                  {t.timeTaken && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '13px' }}>
                      <Clock size={14} /> {formatTime(t.timeTaken)}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
