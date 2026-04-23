import { useState, useEffect } from 'react';
import { BookMarked, Loader2, Lightbulb, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';

interface Solution {
  answer: string;
  steps: string[];
  concept: string;
  memoryTip: string;
  difficulty: string;
}

interface TopicsData {
  topics: Record<string, string[]>;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: '#10b981',
  Medium: '#f59e0b',
  Hard: '#ef4444',
};

export default function PYQPage() {
  const [question, setQuestion] = useState('');
  const [subject, setSubject] = useState('Biology');
  const [year, setYear] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [error, setError] = useState('');
  const [topics, setTopics] = useState<Record<string, string[]>>({});
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    api.get<TopicsData>('/api/pyq/topics')
      .then((d) => setTopics(d.topics))
      .catch(() => {/* ignore */});
  }, []);

  const solve = async () => {
    if (!question.trim()) {
      setError('Please paste a question first.');
      return;
    }
    setError('');
    setIsSolving(true);
    setSolution(null);
    try {
      const res = await api.post<{ solution: Solution }>('/api/pyq/ask', {
        question: question.trim(),
        subject,
        year: year ? parseInt(year) : undefined,
      });
      setSolution(res.solution);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to solve question');
    } finally {
      setIsSolving(false);
    }
  };

  const subjects = ['Physics', 'Chemistry', 'Biology'];
  const years = Array.from({ length: 10 }, (_, i) => String(2024 - i));

  return (
    <div className="page-container">
      <div className="page-header">
        <BookMarked size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Previous Year Questions</h1>
          <p className="page-desc">Paste any NEET PYQ — get a step-by-step AI solution</p>
        </div>
      </div>

      <div className="panel-grid-2">
        {/* Solver panel */}
        <div>
          <div className="auth-card panel-card" style={{ maxWidth: '100%', animation: 'none', marginBottom: '24px' }}>
            <h2 className="section-heading">Solve a Question</h2>

            {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Subject</label>
                <div className="input-wrap">
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                  >
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group" style={{ width: '120px', marginBottom: 0 }}>
                <label>Year (optional)</label>
                <div className="input-wrap">
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                  >
                    <option value="">Any</option>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>Question Text</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Paste your NEET PYQ here... e.g. 'Which of the following is the correct sequence of events during mitosis?'"
                rows={5}
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px',
                  resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
                }}
              />
            </div>

            <button
              className="btn-primary"
              onClick={solve}
              disabled={isSolving}
              style={{ padding: '10px 24px', width: 'auto' }}
            >
              {isSolving ? <><Loader2 size={15} className="spin" /> Solving...</> : 'Get AI Solution'}
            </button>
          </div>

          {/* Solution display */}
          {solution && (
            <div className="auth-card solution-card panel-card" style={{ maxWidth: '100%', animation: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>AI Solution</h2>
                <span style={{
                  background: DIFFICULTY_COLOR[solution.difficulty] ?? '#8b5cf6',
                  color: '#fff', fontSize: '12px', fontWeight: 600,
                  padding: '3px 10px', borderRadius: '100px',
                }}>
                  {solution.difficulty}
                </span>
              </div>

              {/* Answer */}
              <div style={{
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: '10px', padding: '14px 18px', marginBottom: '20px',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correct Answer</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{solution.answer}</p>
                </div>
              </div>

              {/* Steps */}
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Step-by-Step Solution</h3>
              <ol style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '4px', marginBottom: '20px' }}>
                {solution.steps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '14px', lineHeight: 1.6 }}>
                    <span style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: 'var(--accent)', color: '#fff',
                      fontSize: '11px', fontWeight: 700, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px',
                    }}>{i + 1}</span>
                    <span style={{ color: '#e2e8f0' }}>{step.replace(/^Step \d+:\s*/i, '')}</span>
                  </li>
                ))}
              </ol>

              {/* Concept */}
              {solution.concept && (
                <div style={{
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '8px', padding: '12px 16px', marginBottom: '14px',
                }}>
                  <p style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Key Concept</p>
                  <p style={{ fontSize: '13px', color: '#e2e8f0' }}>{solution.concept}</p>
                </div>
              )}

              {/* Memory tip */}
              {solution.memoryTip && (
                <div style={{
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: '8px', padding: '12px 16px',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <Lightbulb size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <p style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Memory Tip</p>
                    <p style={{ fontSize: '13px', color: '#e2e8f0' }}>{solution.memoryTip}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Topic browser */}
        <div>
          <h2 className="section-heading">Browse Topics</h2>
          <div className="auth-card topic-card panel-card" style={{ maxWidth: '100%', animation: 'none' }}>
            {Object.entries(topics).map(([subj, topicList]) => (
              <div key={subj} style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => setExpandedTopic(expandedTopic === subj ? null : subj)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: '8px',
                    background: expandedTopic === subj ? 'var(--bg-elevated)' : 'transparent',
                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px',
                    cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                >
                  <span>{subj}</span>
                  {expandedTopic === subj ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {expandedTopic === subj && (
                  <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {topicList.map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setSubject(subj);
                          setQuestion(`[${subj} - ${t}] `);
                        }}
                        style={{
                          textAlign: 'left', padding: '7px 10px', borderRadius: '6px',
                          background: 'var(--bg-glass)', color: '#94a3b8', fontSize: '13px',
                          cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-glass-hover)'; (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9'; }}
                        onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-glass)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
