import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

interface DiagnosticQ { subject: string; topic: string; difficulty: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correct: string; explanation: string }
interface DiagnosticResult { estimatedScore: number; weakSubjects: { subject: string; accuracy: number; weakTopics: string[] }[]; personalPlan: { weeklyPlan: { week: number; focus: string; subjects: { subject: string; chapters: string[]; tasks: string[] }[]; goal: string }[]; topPriorities: string[] } | null; message: string }

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
const SUBJECT_COLOR: Record<string, string> = { Biology: '#059669', Chemistry: '#7c3aed', Physics: '#1d4ed8' };

export default function DiagnosticPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [phase, setPhase] = useState<'intro' | 'loading' | 'quiz' | 'done'>('intro');
  const [questions, setQuestions] = useState<DiagnosticQ[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setPhase('loading');
    try {
      const data = await api.post<{ questions: DiagnosticQ[] }>('/api/diagnostic/start', { language: lang });
      setQuestions(data.questions);
      setCurrent(0);
      setAnswers({});
      setPhase('quiz');
    } catch { setPhase('intro'); setError(isTa ? 'கண்டறிதல் தேர்வை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Could not load diagnostic. Please try again.'); }
  };

  const answer = (opt: string) => {
    setAnswers((prev) => ({ ...prev, [current]: opt }));
    setTimeout(() => {
      if (current < questions.length - 1) setCurrent((c) => c + 1);
    }, 300);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = questions.map((q, i) => ({ subject: q.subject, topic: q.topic, correct: q.correct, userAnswer: answers[i] ?? null }));
      const res = await api.post<DiagnosticResult>('/api/diagnostic/complete', { answers: payload, language: lang });
      setResult(res);
      setPhase('done');
    } catch { setError('Submission failed. Try again.'); }
    finally { setSubmitting(false); }
  };

  const q = questions[current];
  const answered = Object.keys(answers).length;

  // ── INTRO ──
  if (phase === 'intro') return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#ef4444', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '2.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧠</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: '0 0 0.75rem' }}>
          {isTa ? 'NEET கண்டறிதல் தேர்வு | Diagnostic Test' : 'NEET Diagnostic Test'}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
          {isTa
            ? '18 கேள்விகள் · Physics, Chemistry, Biology · ~10 நிமிடங்கள். உங்கள் பலவீன பகுதிகளை கண்டறிந்து தனிப்பயனாக்கப்பட்ட படிப்பு திட்டம் பெறுக.'
            : '18 questions · Physics + Chemistry + Biology · ~10 minutes. We\'ll find your exact weak chapters and give you a personalised study plan on day one.'}
        </p>
        <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
          {(isTa
            ? ['Physics, Chemistry, Biology ஒவ்வொன்றிலும் 6 கேள்விகள்', 'எளிது / நடுத்தரம் / கடினம் கலவை', 'இந்த கண்டறிதலுக்கு எதிர்மறை மதிப்பெண் இல்லை', 'உங்கள் முடிவு → தனிப்பயன் 3-வார திட்டம்']
            : ['6 questions each from Physics, Chemistry, Biology', 'Mix of Easy / Medium / Hard', 'No negative marking for this diagnostic', 'Your result → personalised 3-week plan']
          ).map((tip) => (
            <p key={tip} style={{ margin: '0.35rem 0', fontSize: '0.82rem', color: '#374151' }}>✅ {tip}</p>
          ))}
        </div>
        <button onClick={start}
          style={{ width: '100%', padding: '0.9rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer' }}>
          {isTa ? 'தேர்வை தொடங்கு →' : 'Start Diagnostic →'}
        </button>
      </div>
    </div>
  );

  // ── LOADING ──
  if (phase === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '2rem' }}>⚙️</div>
      <p style={{ color: '#6b7280' }}>{isTa ? 'கேள்விகளை உருவாக்குகிறது…' : 'Generating diagnostic questions…'}</p>
    </div>
  );

  // ── QUIZ ──
  if (phase === 'quiz' && q) return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Progress */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.82rem', color: '#6b7280' }}>
          <span>{isTa ? `கேள்வி ${current + 1} / ${questions.length}` : `Q ${current + 1} of ${questions.length}`}</span>
          <span style={{ color: SUBJECT_COLOR[q.subject], fontWeight: 700 }}>{q.subject} · {q.difficulty}</span>
        </div>
        <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '99px' }}>
          <div style={{ height: '100%', background: '#1d4ed8', borderRadius: '99px', width: `${((current + 1) / questions.length) * 100}%`, transition: 'width 0.3s' }} />
        </div>
        <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#9ca3af' }}>{isTa ? 'தலைப்பு' : 'Topic'}: {q.topic}</div>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', lineHeight: 1.6, margin: '0 0 1.5rem' }}>{q.question}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {OPTION_KEYS.map((key) => {
            const text = q[`option${key}` as keyof DiagnosticQ] as string;
            const selected = answers[current] === key;
            return (
              <button key={key} onClick={() => answer(key)}
                style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: `2px solid ${selected ? '#1d4ed8' : '#e5e7eb'}`, background: selected ? '#eff6ff' : '#fff', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem', color: selected ? '#1d4ed8' : '#374151', fontWeight: selected ? 700 : 400, transition: 'all 0.15s' }}>
                <strong>{key}.</strong> {text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Skip / Submit */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        {!answers[current] && (
          <button onClick={() => setCurrent((c) => Math.min(c + 1, questions.length - 1))}
            style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '8px', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem' }}>
            {isTa ? 'தவிர் →' : 'Skip →'}
          </button>
        )}
        {current === questions.length - 1 && (
          <button onClick={submit} disabled={submitting}
            style={{ padding: '0.6rem 1.5rem', background: submitting ? '#9ca3af' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? (isTa ? 'சமர்ப்பிக்கிறது…' : 'Submitting…') : (isTa ? `சமர்ப்பி (${answered}/${questions.length} பதிலளித்தது)` : `Submit (${answered}/${questions.length} answered)`)}
          </button>
        )}
      </div>
    </div>
  );

  // ── RESULTS ──
  if (phase === 'done' && result) return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginBottom: '1.5rem', textAlign: 'center' }}>
        <CheckCircle size={40} style={{ color: '#059669', marginBottom: '0.75rem' }} />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', margin: '0 0 0.5rem' }}>{result.message}</h1>
        <div style={{ fontSize: '3rem', fontWeight: 900, color: '#1d4ed8', margin: '0.5rem 0' }}>{result.estimatedScore}<span style={{ fontSize: '1.5rem', color: '#9ca3af' }}>/720</span></div>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{isTa ? 'கண்டறிதல் மதிப்பீடு — இதை செம்மைப்படுத்த மேலும் தேர்வுகள் எடுங்கள்' : 'Diagnostic estimate — take more tests to refine this'}</p>
      </div>

      {/* Subject breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {result.weakSubjects.map((s) => (
          <div key={s.subject} style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderTop: `4px solid ${SUBJECT_COLOR[s.subject]}` }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: SUBJECT_COLOR[s.subject] }}>{s.subject}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', margin: '0.3rem 0' }}>{s.accuracy}%</div>
            {s.weakTopics.length > 0 && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{isTa ? 'பலவீனம்' : 'Weak'}: {s.weakTopics.slice(0, 2).join(', ')}</div>}
          </div>
        ))}
      </div>

      {/* 3-week plan */}
      {result.personalPlan && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: '#374151' }}>{isTa ? 'உங்கள் தனிப்பயன் 3-வார திட்டம்' : 'Your Personalised 3-Week Plan'}</h2>
          {result.personalPlan.topPriorities?.length > 0 && (
            <div style={{ background: '#fef9f0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <strong style={{ fontSize: '0.82rem', color: '#92400e' }}>{isTa ? 'முதன்மை முன்னுரிமைகள்:' : 'Top Priorities:'}</strong>
              {result.personalPlan.topPriorities.map((p, i) => <p key={i} style={{ margin: '0.2rem 0', fontSize: '0.82rem', color: '#374151' }}>• {p}</p>)}
            </div>
          )}
          {result.personalPlan.weeklyPlan?.map((week) => (
            <div key={week.week} style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1d4ed8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.82rem' }}>W{week.week}</div>
                <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.9rem' }}>{week.focus}</div>
              </div>
              {week.subjects?.map((sub) => (
                <div key={sub.subject} style={{ marginLeft: '2.2rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: SUBJECT_COLOR[sub.subject] ?? '#374151' }}>{sub.subject}: </span>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{sub.chapters?.join(', ')}</span>
                </div>
              ))}
              <div style={{ marginLeft: '2.2rem', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>{isTa ? 'இலக்கு' : 'Goal'}: {week.goal}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return null;
}
