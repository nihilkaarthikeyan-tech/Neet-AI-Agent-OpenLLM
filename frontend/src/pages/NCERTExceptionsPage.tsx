import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

const SUBJECTS = ['Biology', 'Chemistry', 'Physics'] as const;
const EXCEPTION_LABELS: Record<string, string> = {
  exception: '⚠️ Exception',
  bracket_example: '( ) Bracket',
  table_footnote: '📋 Table Note',
  figure_caption: '🖼️ Figure',
  special_case: '🔍 Special Case',
};

interface ExceptionQ {
  question: string; optionA: string; optionB: string; optionC: string; optionD: string;
  correct: string; explanation: string; exceptionType: string; ncertSource: string; whyItTricks: string;
}

export default function NCERTExceptionsPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [subject, setSubject] = useState<typeof SUBJECTS[number]>('Biology');
  const [chapter, setChapter] = useState('');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<ExceptionQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'quiz' | 'result'>('setup');

  const generate = async () => {
    setLoading(true);
    try {
      const data = await api.post<{ questions: ExceptionQ[] }>('/api/ncertexceptions/generate', { subject, chapter: chapter.trim() || undefined, count, language: lang });
      setQuestions(data.questions); setAnswers({}); setSubmitted(false); setCurrent(0); setPhase('quiz');
    } catch { setGenError('Could not generate. Please try again.'); }
    finally { setLoading(false); }
  };

  const score = questions.filter((q, i) => answers[i] === q.correct).length;
  const q = questions[current];

  if (phase === 'setup') return (
    <div className="page-container" style={{ maxWidth: '680px' }}>
      {genError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', marginBottom: '16px', fontSize: '14px' }}>
          {genError}
        </div>
      )}
      <div className="page-header">
        <AlertTriangle size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'NCERT விதிவிலக்கு வேட்டை | Exception Hunter' : 'NCERT Exception & Bracket Hunter'}</h1>
          <p className="page-desc">{isTa ? 'NEET விரும்பும் மறைந்த NCERT வரிகள் — விதிவிலக்குகள், அடைப்புக்குறி, அட்டவணை குறிப்புகள்' : 'NEET\'s favourite traps: exceptions, bracketed examples, table footnotes, figure captions'}</p>
        </div>
      </div>

      <div className="feature-card feature-card--warning" style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
          {isTa ? 'ஏன் இது முக்கியம்?' : 'Why this matters:'}
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
          {isTa
            ? 'NEET-ல் 20-30% கேள்விகள் NCERT-ல் முக்கிய வரிகளுக்கு பக்கத்தில் உள்ள சிறு குறிப்புகளிலிருந்து வருகின்றன. பெரும்பாலான மாணவர்கள் இவற்றைத் தவறவிடுகிறார்கள்.'
            : '20-30% of hard NEET questions come from exceptions and bracketed content most students skip. This mode drills only those lines.'}
        </p>
      </div>

      <div className="feature-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value as typeof SUBJECTS[number])}
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {isTa ? 'அத்தியாயம் (விருப்பம்)' : 'Chapter (optional)'}
            </label>
            <input value={chapter} onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Cell Cycle and Cell Division"
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            {isTa ? 'கேள்விகள் எண்ணிக்கை' : 'Number of questions'}: {count}
          </label>
          <input type="range" min="5" max="20" value={count} onChange={(e) => setCount(Number(e.target.value))}
            style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}><span>5</span><span>20</span></div>
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary" style={{ width: '100%', fontSize: '1rem' }}>
          {loading ? <><Loader2 size={16} className="spin" /> {isTa ? 'கேள்விகள் தயாராகிறது…' : 'Generating tricky questions…'}</> : isTa ? '⚠️ விதிவிலக்கு தேர்வை தொடங்கு' : '⚠️ Hunt Exceptions →'}
        </button>
      </div>
    </div>
  );

  if (phase === 'quiz' && q) return (
    <div className="page-container" style={{ maxWidth: '720px' }}>
      {/* Progress */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span>Q {current + 1} / {questions.length}</span>
          <span style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706', borderRadius: '99px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>{EXCEPTION_LABELS[q.exceptionType] ?? q.exceptionType}</span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-base)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '99px', width: `${((current + 1) / questions.length) * 100}%`, transition: 'width 0.3s' }} />
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{q.ncertSource}</p>
      </div>

      <div className="feature-card" style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.65, marginBottom: '1.25rem' }}>{q.question}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(['A', 'B', 'C', 'D'] as const).map((key) => {
            const text = q[`option${key}` as keyof ExceptionQ] as string;
            const chosen = answers[current] === key;
            const correct = submitted && key === q.correct;
            const wrong = submitted && chosen && key !== q.correct;
            return (
              <button key={key} onClick={() => !submitted && setAnswers((p) => ({ ...p, [current]: key }))}
                style={{ padding: '12px 16px', borderRadius: '9px', border: `1.5px solid ${correct ? '#059669' : wrong ? '#dc2626' : chosen ? 'var(--accent)' : 'var(--border)'}`, background: correct ? '#f0fdf4' : wrong ? '#fef2f2' : chosen ? 'rgba(79,70,229,0.08)' : 'var(--bg-surface)', textAlign: 'left', cursor: submitted ? 'default' : 'pointer', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <strong>{key}.</strong> {text}
              </button>
            );
          })}
        </div>
        {submitted && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <p style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>✅ {q.explanation}</p>
            </div>
            <div style={{ background: '#fef9f0', borderRadius: '8px', padding: '10px 14px' }}>
              <p style={{ fontSize: '0.78rem', color: '#92400e' }}>⚠️ {isTa ? 'ஏன் கஷ்டம்:' : 'Why this tricks students:'} {q.whyItTricks}</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {!submitted && answers[current] && (
          <button onClick={() => setSubmitted(true)} className="btn-primary" style={{ flex: 1 }}>
            {isTa ? 'சரி பார்' : 'Check Answer'}
          </button>
        )}
        {submitted && current < questions.length - 1 && (
          <button onClick={() => { setCurrent((c) => c + 1); setSubmitted(false); }} className="btn-primary" style={{ flex: 1 }}>
            {isTa ? 'அடுத்து →' : 'Next →'}
          </button>
        )}
        {submitted && current === questions.length - 1 && (
          <button onClick={() => setPhase('result')} className="btn-primary" style={{ flex: 1 }}>
            {isTa ? 'முடிவுகளை பார்' : 'See Results →'}
          </button>
        )}
        <button onClick={() => { setPhase('setup'); setQuestions([]); }} className="btn-secondary">
          {isTa ? 'வெளியேறு' : 'Exit'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-container" style={{ maxWidth: '680px' }}>
      <div className="feature-card" style={{ textAlign: 'center', padding: '2.5rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{score >= questions.length * 0.8 ? '🏆' : score >= questions.length * 0.6 ? '👍' : '📚'}</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>{score}/{questions.length}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {score >= questions.length * 0.8
            ? (isTa ? 'சிறப்பு! விதிவிலக்குகளை நன்கு அறிவீர்கள்.' : 'Excellent! You\'re reading NCERT carefully.')
            : (isTa ? 'இன்னும் பயிற்சி தேவை. NCERT-ஐ மறுபடியும் படியுங்கள்.' : 'Needs work. Re-read those NCERT sections carefully.')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={() => { setPhase('setup'); setQuestions([]); }} className="btn-secondary" style={{ flex: 1 }}>New Hunt</button>
        <button onClick={generate} className="btn-primary" style={{ flex: 1 }}>Retry Same Subject</button>
      </div>
    </div>
  );
}
