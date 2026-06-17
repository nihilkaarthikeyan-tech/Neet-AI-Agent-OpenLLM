import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, Flag, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

interface NTAQuestion {
  subject: string; section: string; topic: string;
  question: string; optionA: string; optionB: string; optionC: string; optionD: string;
  correct: string; explanation: string;
}

interface ExamData {
  questions: NTAQuestion[];
  mode: string;
  durationMinutes: number;
  totalQuestions: number;
  marking: { correct: number; wrong: number; skipped: number };
  maxScore: number;
}

interface Result {
  totalScore: number; maxScore: number; percentage: number; scaledTo720: number;
  correct: number; wrong: number; skipped: number; timeTakenMinutes: number;
  subjectStats: Record<string, { correct: number; wrong: number; skipped: number; score: number }>;
}

type QStatus = 'skipped' | 'answered' | 'marked';
const OPTIONS = ['A', 'B', 'C', 'D'] as const;
const SUBJECT_COLOR: Record<string, string> = { Physics: '#3b82f6', Chemistry: '#10b981', Biology: '#f59e0b' };

function fmt(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function NTASimulatorPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const navigate = useNavigate();

  const [phase, setPhase] = useState<'setup' | 'loading' | 'exam' | 'result'>('setup');
  const [mode, setMode] = useState<'mini' | 'full'>('mini');
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string | null>>({});
  const [statuses, setStatuses] = useState<Record<number, QStatus>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [subject, setSubject] = useState('Physics');
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [setupError, setSetupError] = useState('');
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const subjects = examData ? [...new Set(examData.questions.map((q) => q.subject))] : [];
  const subjectQs = examData?.questions.map((q, i) => ({ ...q, idx: i })).filter((q) => q.subject === subject) ?? [];

  // Timer
  useEffect(() => {
    if (phase !== 'exam' || !examData) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, examData]);

  const timerClass = timeLeft > 300 ? 'nta-timer--ok' : timeLeft > 60 ? 'nta-timer--warn' : 'nta-timer--danger';

  const startExam = async () => {
    setPhase('loading');
    try {
      const data = await api.post<ExamData>('/api/nta/generate', { mode, language: lang });
      setExamData(data);
      setAnswers({});
      setStatuses({});
      setCurrent(0);
      setTimeLeft(data.durationMinutes * 60);
      startTimeRef.current = Date.now();
      setSubject(data.questions[0].subject);
      setPhase('exam');
    } catch { setPhase('setup'); setSetupError('Could not generate exam. Please try again.'); }
  };

  const selectAnswer = (opt: string) => {
    setAnswers((prev) => ({ ...prev, [current]: opt }));
    setStatuses((prev) => ({ ...prev, [current]: 'answered' }));
  };

  const clearAnswer = () => {
    setAnswers((prev) => ({ ...prev, [current]: null }));
    setStatuses((prev) => ({ ...prev, [current]: 'skipped' }));
  };

  const markReview = () => {
    setStatuses((prev) => ({ ...prev, [current]: 'marked' }));
    goNext();
  };

  const goNext = useCallback(() => {
    if (!examData) return;
    const nextIdx = examData.questions.findIndex((q, i) => i > current && q.subject === subject);
    if (nextIdx !== -1) { setCurrent(nextIdx); return; }
    const nextSubjectIdx = subjects.indexOf(subject) + 1;
    if (nextSubjectIdx < subjects.length) {
      const ns = subjects[nextSubjectIdx];
      setSubject(ns);
      const first = examData.questions.findIndex((q) => q.subject === ns);
      setCurrent(first);
    }
  }, [current, examData, subject, subjects]);

  const goPrev = useCallback(() => {
    if (!examData) return;
    let i = current - 1;
    while (i >= 0) {
      if (examData.questions[i].subject === subject) { setCurrent(i); return; }
      i--;
    }
  }, [current, examData, subject]);

  const handleSubmit = useCallback(async () => {
    if (!examData || submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const timeTakenSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const payload: Record<string, string | null> = {};
    for (let i = 0; i < examData.questions.length; i++) payload[String(i)] = answers[i] ?? null;
    try {
      const res = await api.post<Result>('/api/nta/submit', { examData, answers: payload, timeTakenSeconds, language: lang });
      setResult(res);
      setPhase('result');
    } catch { setSetupError('Failed to submit. Please try again.'); }
    finally { setSubmitting(false); setShowConfirm(false); }
  }, [examData, answers, lang, submitting]);

  // ── SETUP ──
  if (phase === 'setup') return (
    <div className="page-container">
      {setupError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {setupError}
        </div>
      )}
      <div className="page-header">
        <BookOpen size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'NTA தேர்வு சிமுலேட்டர் | NTA Exam Simulator' : 'NTA Exam Simulator'}</h1>
          <p className="page-desc">{isTa ? 'உண்மையான NTA இடைமுகம் · தமிழ் · நேர வரையறை · கழித்தல் மதிப்பெண்' : 'Real NTA interface · Tamil support · Live timer · Negative marking'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '680px', marginBottom: '2rem' }}>
        {([
          { key: 'mini', title: isTa ? 'சிறு தேர்வு' : 'Mini Mock', sub: isTa ? '45 கேள்விகள் · 50 நிமிடம்' : '45 questions · 50 min', detail: isTa ? 'வேகமான பயிற்சிக்கு' : 'Quick practice session' },
          { key: 'full', title: isTa ? 'முழு தேர்வு' : 'Full Mock', sub: isTa ? '90 கேள்விகள் · 100 நிமிடம்' : '90 questions · 100 min', detail: isTa ? 'முழுமையான தேர்வு அனுபவம்' : 'Closest to exam day experience' },
        ] as const).map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={`feature-card ${mode === m.key ? 'feature-card--accent' : ''}`}
            style={{ textAlign: 'left', cursor: 'pointer', border: mode === m.key ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: mode === m.key ? 'var(--accent)' : 'var(--text-primary)', marginBottom: '4px' }}>{m.title}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{m.sub}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{m.detail}</div>
          </button>
        ))}
      </div>

      <div className="feature-card" style={{ maxWidth: '680px', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {isTa ? 'NTA மதிப்பெண் விதிகள்' : 'NTA Marking Scheme'}
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[
            { label: isTa ? 'சரியான பதில்' : 'Correct', value: '+4', color: '#059669' },
            { label: isTa ? 'தவறான பதில்' : 'Wrong', value: '−1', color: '#dc2626' },
            { label: isTa ? 'தவிர்க்கப்பட்டது' : 'Skipped', value: '0', color: '#9ca3af' },
          ].map((r) => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-base)' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: r.color }}>{r.value}</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={startExam}
        className="btn-primary"
        style={{ maxWidth: '680px', width: '100%', fontSize: '1.05rem', padding: '14px' }}>
        {isTa ? 'தேர்வை தொடங்கு →' : 'Start Exam →'}
      </button>
    </div>
  );

  // ── LOADING ──
  if (phase === 'loading') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: '1rem', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: '3rem' }}>⚙️</div>
      <p style={{ fontWeight: 600 }}>{isTa ? 'தேர்வு தயாராகிறது…' : 'Preparing your exam…'}</p>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{isTa ? 'NEET தரம் கேள்விகளை உருவாக்குகிறது' : 'Generating NEET-standard questions'}</p>
    </div>
  );

  // ── EXAM ──
  if (phase === 'exam' && examData) {
    const q = examData.questions[current];
    const answered = Object.values(answers).filter((a) => a !== null).length;
    const marked = Object.values(statuses).filter((s) => s === 'marked').length;

    return (
      <div className="nta-shell">
        <div className="nta-main">
          {/* Header */}
          <div className="nta-header">
            <div className="nta-title">
              {isTa ? 'NEET AI — தேர்வு சிமுலேட்டர்' : 'NEET AI — Exam Simulator'}
              <span style={{ fontSize: '11px', color: '#475569', marginLeft: '12px', fontWeight: 400 }}>
                {answered}/{examData.totalQuestions} answered
              </span>
            </div>
            <div className={`nta-timer ${timerClass}`}>{fmt(timeLeft)}</div>
            <button onClick={() => setShowConfirm(true)}
              className="nta-btn nta-btn--danger"
              disabled={submitting}>
              {submitting ? '…' : isTa ? 'சமர்ப்பி' : 'Submit'}
            </button>
          </div>

          {/* Subject tabs */}
          <div className="nta-subject-nav">
            {subjects.map((s) => {
              const cnt = examData.questions.filter((q) => q.subject === s).length;
              const ans = examData.questions.filter((q, i) => q.subject === s && answers[i]).length;
              return (
                <button key={s} onClick={() => {
                  setSubject(s);
                  setCurrent(examData.questions.findIndex((q) => q.subject === s));
                }}
                  className={`nta-subject-btn nta-subject-btn--${s.toLowerCase()} ${subject === s ? 'nta-subject-btn--active' : ''}`}>
                  {s} ({ans}/{cnt})
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="nta-body">
            <div className="nta-question-panel">
              <div className="nta-q-number">
                {isTa ? 'கேள்வி' : 'Question'} {current + 1} · {q.topic} · Section {q.section}
              </div>
              <div className="nta-q-text">{q.question}</div>
              <div className="nta-options">
                {OPTIONS.map((key) => (
                  <button key={key} onClick={() => selectAnswer(key)}
                    className={`nta-option ${answers[current] === key ? 'nta-option--selected' : ''}`}>
                    <div className="nta-option-key">{key}</div>
                    <span>{q[`option${key}` as keyof NTAQuestion] as string}</span>
                  </button>
                ))}
              </div>
              <div className="nta-actions">
                <button onClick={() => { goPrev(); }} className="nta-btn nta-btn--outline" disabled={current === 0}>
                  <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> {isTa ? 'முந்தைய' : 'Previous'}
                </button>
                <button onClick={markReview} className="nta-btn nta-btn--mark">
                  <Flag size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  {isTa ? 'மதிப்பாய்வுக்கு' : 'Mark for Review'}
                </button>
                <button onClick={clearAnswer} className="nta-btn nta-btn--outline">
                  {isTa ? 'நீக்கு' : 'Clear'}
                </button>
                <button onClick={goNext} className="nta-btn nta-btn--primary">
                  {isTa ? 'அடுத்தது' : 'Next'} <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
                </button>
              </div>
            </div>

            {/* Palette */}
            <div className="nta-palette">
              <div className="nta-palette-header">{isTa ? 'கேள்வி பலகம்' : 'Question Palette'}</div>
              <div className="nta-palette-legend">
                {[
                  { cls: 'palette-q--answered', label: isTa ? 'பதிலளிக்கப்பட்டது' : 'Answered', bg: '#059669' },
                  { cls: 'palette-q--marked',   label: isTa ? 'மதிப்பாய்வு'       : 'Marked',   bg: '#f59e0b' },
                  { cls: 'palette-q--skipped',  label: isTa ? 'தவிர்க்கப்பட்டது' : 'Not visited', bg: 'rgba(255,255,255,0.07)' },
                ].map((l) => (
                  <div key={l.label} className="legend-row">
                    <div className="legend-dot" style={{ background: l.bg }} />
                    {l.label}
                  </div>
                ))}
              </div>
              <div className="nta-palette-grid">
                {subjectQs.map(({ idx }) => {
                  const s = statuses[idx];
                  const cls = idx === current ? 'palette-q--current' : s === 'answered' ? 'palette-q--answered' : s === 'marked' ? 'palette-q--marked' : 'palette-q--skipped';
                  return (
                    <button key={idx} onClick={() => setCurrent(idx)} className={`palette-q ${cls}`}>
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="nta-submit-area">
                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', textAlign: 'center' }}>
                  {answered} answered · {marked} marked
                </div>
                <button onClick={() => setShowConfirm(true)} className="nta-btn nta-btn--primary" style={{ width: '100%' }} disabled={submitting}>
                  {submitting ? '…' : isTa ? 'தேர்வை சமர்ப்பி' : 'Submit Exam'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Confirm dialog */}
        {showConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#1a2035', borderRadius: '16px', padding: '2rem', maxWidth: '400px', width: '90%', border: '1px solid rgba(255,255,255,0.1)' }}>
              <AlertTriangle size={32} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
              <h2 style={{ color: '#f1f5f9', margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
                {isTa ? 'தேர்வை சமர்ப்பிக்கவா?' : 'Submit Exam?'}
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
                {answered}/{examData.totalQuestions} answered · {examData.totalQuestions - answered} unanswered.
                {isTa ? ' சமர்ப்பித்த பிறகு திரும்ப மாற்ற முடியாது.' : ' You cannot change answers after submission.'}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowConfirm(false)} className="nta-btn nta-btn--outline" style={{ flex: 1 }}>
                  {isTa ? 'தொடரு' : 'Continue Exam'}
                </button>
                <button onClick={handleSubmit} className="nta-btn nta-btn--danger" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? '…' : isTa ? 'சமர்ப்பி' : 'Submit Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── RESULT ──
  if (phase === 'result' && result) {
    const pct = result.percentage;
    const r = 60;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - Math.min(pct, 100) / 100);
    const ringColor = pct >= 70 ? '#6ee7b7' : pct >= 50 ? '#fcd34d' : '#fca5a5';

    return (
      <div className="page-container nta-result-shell">
        <div className="feature-card" style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '2.5rem' }}>
          <svg width="140" height="140" viewBox="0 0 140 140" style={{ margin: '0 auto 1rem', display: 'block' }}>
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg-base)" strokeWidth="8" />
            <circle cx="70" cy="70" r={r} fill="none" stroke={ringColor} strokeWidth="8"
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
            <text x="70" y="65" textAnchor="middle" fill="var(--text-primary)" fontSize="22" fontWeight="800" fontFamily="Inter">{result.scaledTo720}</text>
            <text x="70" y="82" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="Inter">/ 720</text>
          </svg>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>
            {isTa ? 'தேர்வு முடிந்தது' : 'Exam Complete'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Score: {result.totalScore} marks · {pct}% · {result.timeTakenMinutes} min
          </p>
        </div>

        <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: isTa ? 'சரியானவை' : 'Correct',  value: String(result.correct),  color: '#059669' },
            { label: isTa ? 'தவறானவை' : 'Wrong',    value: String(result.wrong),    color: '#dc2626' },
            { label: isTa ? 'தவிர்க்கப்பட்டவை' : 'Skipped', value: String(result.skipped), color: '#9ca3af' },
            { label: isTa ? 'மொத்த மதிப்பெண்' : 'Raw Score', value: String(result.totalScore), color: 'var(--accent)' },
          ].map((m) => (
            <div key={m.label} className="metric-card">
              <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Subject breakdown */}
        <div className="feature-card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
            {isTa ? 'பாடம்வாரி செயல்திறன்' : 'Subject Performance'}
          </h2>
          {Object.entries(result.subjectStats).map(([sub, stats]) => {
            const total = stats.correct + stats.wrong + stats.skipped;
            const acc = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
            return (
              <div key={sub} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.875rem' }}>
                  <span style={{ fontWeight: 700, color: SUBJECT_COLOR[sub] ?? 'var(--text-primary)' }}>{sub}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{stats.score} marks · {acc}% accuracy</span>
                </div>
                <div className="acc-bar">
                  <div className={`acc-bar-fill ${acc >= 70 ? 'acc-high' : acc >= 50 ? 'acc-mid' : acc >= 30 ? 'acc-low' : 'acc-danger'}`}
                    style={{ width: `${acc}%` }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {stats.correct} correct · {stats.wrong} wrong · {stats.skipped} skipped
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => { setPhase('setup'); setResult(null); setExamData(null); }}
            className="btn-secondary" style={{ flex: 1 }}>
            {isTa ? 'மீண்டும் தேர்வு எழுது' : 'Take Another Exam'}
          </button>
          <button onClick={() => navigate('/dashboard/progress')}
            className="btn-primary" style={{ flex: 1 }}>
            {isTa ? 'முன்னேற்றத்தை பார்' : 'View Progress →'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
