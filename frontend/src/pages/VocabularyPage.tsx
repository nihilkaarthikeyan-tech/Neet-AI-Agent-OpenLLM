import { useState, useEffect } from 'react';
import { BookOpen, Search, Loader2, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

const SUBJECTS = ['Biology', 'Chemistry', 'Physics'] as const;

interface TermExplanation {
  term: string; definition: string; tamilDefinition: string; tamilPronunciation: string;
  ncertContext: string; exampleInNEET: string; mnemonic: string; relatedTerms: string[];
}

interface QuizQuestion { q: string; optionA: string; optionB: string; optionC: string; optionD: string; correct: string; explanation: string; term: string }

export default function VocabularyPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [subject, setSubject] = useState<typeof SUBJECTS[number]>('Biology');
  const [terms, setTerms] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<TermExplanation | null>(null);
  const [loadingExp, setLoadingExp] = useState(false);
  const [tab, setTab] = useState<'browse' | 'quiz'>('browse');
  const [_quizTerms, setQuizTerms] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  useEffect(() => {
    api.get<{ terms: string[] }>(`/api/vocabulary/terms?subject=${subject}`)
      .then((d) => setTerms(d.terms))
      .catch(() => {});
    setSelected(null); setExplanation(null); setSearch('');
  }, [subject]);

  const explain = async (term: string) => {
    setSelected(term); setExplanation(null); setLoadingExp(true);
    try {
      const data = await api.post<{ explanation: TermExplanation }>('/api/vocabulary/explain', { term, subject, language: lang });
      setExplanation(data.explanation);
    } catch { /* ignore */ }
    finally { setLoadingExp(false); }
  };

  const startQuiz = async () => {
    const pick = terms.sort(() => Math.random() - 0.5).slice(0, 5);
    setQuizTerms(pick); setLoadingQuiz(true); setQuiz([]); setQuizAnswers({}); setQuizSubmitted(false);
    try {
      const data = await api.post<{ questions: QuizQuestion[] }>('/api/vocabulary/quiz', { terms: pick, subject, language: lang });
      setQuiz(data.questions);
    } catch { /* ignore */ }
    finally { setLoadingQuiz(false); }
  };

  const filtered = terms.filter((t) => t.toLowerCase().includes(search.toLowerCase()));
  const score = quiz.filter((q, i) => quizAnswers[i] === q.correct).length;

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <div className="page-header">
        <BookOpen size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'NEET சொல் பயிற்சி | Vocabulary Trainer' : 'NEET Vocabulary Trainer'}</h1>
          <p className="page-desc">{isTa ? '600+ NEET தொழில்நுட்ப சொற்கள் · தமிழ் + ஆங்கிலம் · நினைவு தந்திரங்கள்' : '600+ NEET technical terms · Tamil + English · Mnemonics'}</p>
        </div>
      </div>

      {/* Subject + tab */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {SUBJECTS.map((s) => (
          <button key={s} onClick={() => setSubject(s)}
            style={{ padding: '7px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', background: subject === s ? 'var(--accent)' : 'var(--bg-surface)', color: subject === s ? '#fff' : 'var(--text-secondary)', border: `1px solid ${subject === s ? 'transparent' : 'var(--border)'}` }}>
            {s}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {(['browse', 'quiz'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === 'quiz') startQuiz(); }}
              style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', background: tab === t ? 'var(--accent)' : 'var(--bg-base)', color: tab === t ? '#fff' : 'var(--text-secondary)' }}>
              {t === 'browse' ? (isTa ? '📚 படி' : '📚 Browse') : (isTa ? '⚡ சோதனை' : '⚡ Quick Quiz')}
            </button>
          ))}
        </div>
      </div>

      {tab === 'browse' && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.25rem' }}>
          {/* Term list */}
          <div className="feature-card" style={{ padding: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={isTa ? 'தேடுங்கள்…' : 'Search terms…'}
                style={{ width: '100%', paddingLeft: '30px', padding: '7px 10px 7px 30px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {filtered.length} {isTa ? 'சொற்கள்' : 'terms'}
            </p>
            {filtered.map((term) => (
              <button key={term} onClick={() => explain(term)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 10px', borderRadius: '7px', border: 'none', textAlign: 'left', cursor: 'pointer', background: selected === term ? 'rgba(79,70,229,0.1)' : 'transparent', color: selected === term ? 'var(--accent)' : 'var(--text-primary)', fontSize: '13px', fontWeight: selected === term ? 700 : 400, marginBottom: '1px' }}>
                {term}
                {selected === term && <ChevronRight size={13} />}
              </button>
            ))}
          </div>

          {/* Explanation panel */}
          <div>
            {!selected && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', flexDirection: 'column', gap: '0.5rem' }}>
                <BookOpen size={32} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: '0.875rem' }}>{isTa ? 'ஒரு சொல்லை தேர்வு செய்யுங்கள்' : 'Select a term to see its explanation'}</p>
              </div>
            )}
            {loadingExp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2rem', color: 'var(--text-muted)' }}>
                <Loader2 size={18} className="spin" />
                {isTa ? 'விளக்கம் தயாராகிறது…' : 'Generating explanation…'}
              </div>
            )}
            {explanation && !loadingExp && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="micro-lesson-card" style={{ padding: '1.75rem' }}>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>{explanation.term}</h2>
                  <p style={{ fontSize: '1rem', color: '#fcd34d', fontWeight: 700, marginBottom: '0.25rem' }}>{explanation.tamilPronunciation}</p>
                  <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.7, marginBottom: '1rem' }}>{explanation.definition}</p>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '4px' }}>{isTa ? 'தமிழ் விளக்கம்:' : 'Tamil Definition:'}</p>
                    <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.7 }}>{explanation.tamilDefinition}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="feature-card feature-card--accent">
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>📖 NCERT Context</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>{explanation.ncertContext}</p>
                  </div>
                  <div className="feature-card feature-card--success">
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>🧠 Memory Trick</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>{explanation.mnemonic}</p>
                  </div>
                </div>

                <div className="feature-card">
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>🎯 How NEET uses this</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '1rem' }}>{explanation.exampleInNEET}</p>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Related Terms</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {explanation.relatedTerms.map((t) => (
                      <button key={t} onClick={() => explain(t)}
                        style={{ padding: '4px 12px', borderRadius: '99px', background: 'rgba(79,70,229,0.08)', color: 'var(--accent)', border: '1px solid rgba(79,70,229,0.15)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'quiz' && (
        <div className="feature-card">
          {loadingQuiz && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2rem', color: 'var(--text-muted)' }}><Loader2 size={18} className="spin" /> Generating vocabulary quiz…</div>}
          {!loadingQuiz && quiz.length === 0 && <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>Could not load quiz. <button onClick={startQuiz} style={{ color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}>Try again</button></p>}
          {quiz.map((q, i) => (
            <div key={i} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                <span style={{ background: 'rgba(79,70,229,0.1)', color: 'var(--accent)', borderRadius: '99px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>{q.term}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Q{i + 1}. {q.q}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '0.5rem' }}>
                {(['A', 'B', 'C', 'D'] as const).map((key) => {
                  const text = q[`option${key}` as keyof typeof q] as string;
                  const chosen = quizAnswers[i] === key;
                  const correct = quizSubmitted && key === q.correct;
                  const wrong = quizSubmitted && chosen && key !== q.correct;
                  return (
                    <button key={key} onClick={() => !quizSubmitted && setQuizAnswers((p) => ({ ...p, [i]: key }))}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${correct ? '#059669' : wrong ? '#dc2626' : chosen ? 'var(--accent)' : 'var(--border)'}`, background: correct ? '#f0fdf4' : wrong ? '#fef2f2' : chosen ? 'rgba(79,70,229,0.08)' : 'var(--bg-surface)', textAlign: 'left', cursor: quizSubmitted ? 'default' : 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                      <strong>{key}.</strong> {text}
                    </button>
                  );
                })}
              </div>
              {quizSubmitted && <p style={{ fontSize: '0.8rem', color: '#059669', background: '#f0fdf4', padding: '8px 12px', borderRadius: '6px' }}>✅ {q.explanation}</p>}
            </div>
          ))}
          {quiz.length > 0 && !quizSubmitted && (
            <button onClick={() => setQuizSubmitted(true)} className="btn-primary" style={{ marginTop: '0.5rem' }}>
              {isTa ? 'சமர்ப்பி' : 'Submit Quiz'}
            </button>
          )}
          {quizSubmitted && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: score >= 4 ? '#059669' : score >= 3 ? '#f59e0b' : '#dc2626' }}>
                {score}/{quiz.length} correct
              </div>
              <button onClick={startQuiz} className="btn-secondary">
                {isTa ? 'மீண்டும் சோதனை' : 'New Quiz'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
