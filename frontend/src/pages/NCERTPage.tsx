import { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, CheckCircle2, XCircle, RotateCcw, Loader2, GraduationCap } from 'lucide-react';
import { api } from '../lib/api';

type Chapter = { subject: string; classLevel: string; chapter: string };
type Question = {
  question: string; optionA: string; optionB: string; optionC: string; optionD: string;
  correct: string; explanation: string; ncertLine: string;
};
type ChapterMap = Record<string, Record<string, string[]>>;

const SUBJECTS = ['Physics', 'Chemistry', 'Biology'];
const OPTIONS = ['A', 'B', 'C', 'D'] as const;

export default function NCERTPage() {
  const [chapterMap, setChapterMap] = useState<ChapterMap>({});
  const [selected, setSelected] = useState<Chapter>({ subject: 'Biology', classLevel: 'Class 11', chapter: '' });
  const [count, setCount] = useState(10);
  const [view, setView] = useState<'setup' | 'loading' | 'quiz' | 'results'>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [current, setCurrent] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get<{ chapters: ChapterMap }>('/api/ncert/chapters').then(d => {
      setChapterMap(d.chapters);
      const firstChapter = Object.values(d.chapters['Biology']?.['Class 11'] ?? {})[0] as string ?? '';
      setSelected(s => ({ ...s, chapter: firstChapter }));
    }).catch(() => {});
  }, []);

  const chapters = chapterMap[selected.subject]?.[selected.classLevel] ?? [];

  const handleSubjectChange = (subject: string) => {
    const classLevel = 'Class 11';
    const chapter = chapterMap[subject]?.[classLevel]?.[0] ?? '';
    setSelected({ subject, classLevel, chapter });
  };

  const handleClassChange = (classLevel: string) => {
    const chapter = chapterMap[selected.subject]?.[classLevel]?.[0] ?? '';
    setSelected(s => ({ ...s, classLevel, chapter }));
  };

  const startQuiz = async () => {
    if (!selected.chapter) return;
    setView('loading');
    try {
      const data = await api.post<{ questions: Question[] }>('/api/ncert/quiz', {
        subject: selected.subject, chapter: selected.chapter, count,
      });
      setQuestions(data.questions);
      setAnswers({});
      setCurrent(0);
      setShowExplanation(false);
      setSubmitted(false);
      setView('quiz');
    } catch {
      setView('setup');
      alert('Failed to generate quiz. Please try again.');
    }
  };

  const selectAnswer = (opt: string) => {
    if (submitted) return;
    setAnswers(a => ({ ...a, [current]: opt }));
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (current < questions.length - 1) setCurrent(c => c + 1);
    else setSubmitted(true), setView('results');
  };

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.correct).length
    : 0;

  const optionLabel: Record<string, keyof Question> = {
    A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD',
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <GraduationCap size={28} className="page-icon" />
        <div>
          <h1 className="page-title">NCERT Coverage</h1>
          <p className="page-desc">Chapter-by-chapter quiz — test every NCERT line</p>
        </div>
      </div>

      {/* ── Setup ── */}
      {view === 'setup' && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Subject */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Subject</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {SUBJECTS.map(s => (
                  <button key={s} onClick={() => handleSubjectChange(s)}
                    className={`subject-badge ${selected.subject === s ? `subject-badge-active subject-badge-${s.toLowerCase()}` : ''}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Class */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Class</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Class 11', 'Class 12'].map(c => (
                  <button key={c} onClick={() => handleClassChange(c)}
                    style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: selected.classLevel === c ? 'var(--accent)' : 'var(--bg-surface)', color: selected.classLevel === c ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Chapter */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Chapter</label>
              <select value={selected.chapter} onChange={e => setSelected(s => ({ ...s, chapter: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '14px' }}>
                {chapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>

            {/* Count */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                Number of Questions: <span style={{ color: 'var(--accent)' }}>{count}</span>
              </label>
              <input type="range" min={5} max={30} step={5} value={count} onChange={e => setCount(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
              </div>
            </div>

            <button className="btn-primary" onClick={startQuiz} disabled={!selected.chapter} style={{ marginTop: '4px' }}>
              <BookOpen size={16} /> Start NCERT Quiz
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {view === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '60px' }}>
          <Loader2 size={40} className="spin" style={{ color: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Generating {count} questions from <strong>{selected.chapter}</strong>…</p>
        </div>
      )}

      {/* ── Quiz ── */}
      {view === 'quiz' && questions[current] && (
        <div style={{ maxWidth: 680 }}>
          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Question {current + 1} of {questions.length}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{selected.chapter}</span>
          </div>
          <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '24px' }}>
            <div style={{ height: '100%', width: `${((current + 1) / questions.length) * 100}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>

          <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{ fontSize: '15px', lineHeight: 1.6, fontWeight: 500, color: 'var(--text-primary)' }}>
              {questions[current].question}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {OPTIONS.map(opt => {
                const chosen = answers[current] === opt;
                const isCorrect = questions[current].correct === opt;
                const showResult = chosen || (showExplanation && isCorrect);
                return (
                  <button key={opt} onClick={() => { selectAnswer(opt); setShowExplanation(true); }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px',
                      borderRadius: '10px', border: `1.5px solid ${showResult ? (isCorrect ? '#10b981' : chosen ? '#ef4444' : 'var(--border)') : 'var(--border)'}`,
                      background: showResult ? (isCorrect ? 'rgba(16,185,129,0.08)' : chosen ? 'rgba(239,68,68,0.08)' : 'var(--bg-surface)') : 'var(--bg-surface)',
                      cursor: answers[current] ? 'default' : 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.4,
                    }}>
                    <span style={{ fontWeight: 700, minWidth: '20px', color: showResult ? (isCorrect ? '#10b981' : chosen ? '#ef4444' : 'var(--text-secondary)') : 'var(--accent)' }}>{opt}.</span>
                    <span>{questions[current][optionLabel[opt] as keyof Question] as string}</span>
                    {showResult && isCorrect && <CheckCircle2 size={16} style={{ color: '#10b981', marginLeft: 'auto', flexShrink: 0 }} />}
                    {showResult && chosen && !isCorrect && <XCircle size={16} style={{ color: '#ef4444', marginLeft: 'auto', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            {showExplanation && (
              <div style={{ background: 'var(--bg-base)', borderRadius: '10px', padding: '14px 16px', borderLeft: '3px solid var(--accent)' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginBottom: '6px' }}>Explanation</p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>{questions[current].explanation}</p>
                {questions[current].ncertLine && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    NCERT: "{questions[current].ncertLine}"
                  </p>
                )}
              </div>
            )}

            {answers[current] && (
              <button className="btn-primary" onClick={handleNext}>
                {current < questions.length - 1 ? <>Next <ChevronRight size={16} /></> : 'See Results'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {view === 'results' && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '48px', fontWeight: 800, color: score / questions.length >= 0.7 ? '#10b981' : score / questions.length >= 0.5 ? '#f59e0b' : '#ef4444' }}>
              {score}/{questions.length}
            </div>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {Math.round((score / questions.length) * 100)}% — {selected.chapter}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>{selected.subject} · {selected.classLevel}</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => { setView('setup'); }}>
                <RotateCcw size={15} /> New Chapter
              </button>
              <button onClick={startQuiz} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={15} /> Retry
              </button>
            </div>
          </div>

          {/* Review */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.map((q, i) => {
              const correct = answers[i] === q.correct;
              return (
                <div key={i} className="card" style={{ padding: '16px 20px', borderLeft: `3px solid ${correct ? '#10b981' : '#ef4444'}` }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {correct ? <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} /> : <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>{q.question}</p>
                      {!correct && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Your answer: <strong style={{ color: '#ef4444' }}>{answers[i] || 'Skipped'}</strong> · Correct: <strong style={{ color: '#10b981' }}>{q.correct}</strong>
                        </p>
                      )}
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>{q.explanation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
