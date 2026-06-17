import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const SUBJECTS = ['Biology', 'Chemistry', 'Physics'] as const;
const CLASSES = ['Class 11', 'Class 12'] as const;

interface BridgeResult {
  topic: string;
  samacheerSummary: string;
  ncertVersion: string;
  keyDifferences: string[];
  neetFocusPoints: string[];
  extraNcertConcepts: string[];
  expectedQuestions: { question: string; answer: string }[];
}

export default function SamacheerPage() {
  const { user } = useAuthStore();
  const lang = user?.language ?? 'en';
  const isTa = lang === 'ta';

  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState<typeof SUBJECTS[number]>('Biology');
  const [classLevel, setClassLevel] = useState<typeof CLASSES[number]>('Class 11');
  const [result, setResult] = useState<BridgeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openQ, setOpenQ] = useState<number | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.post<{ bridge: BridgeResult }>('/api/samacheer/bridge', { topic, subject, classLevel, language: lang });
      setResult(data.bridge);
    } catch (err) {
      setError(err instanceof Error ? err.message : isTa ? 'மீண்டும் முயலவும்.' : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', margin: '0 0 0.4rem' }}>
          {isTa ? 'சமச்சீர் கல்வி → NEET பாலம்' : 'Samacheer Kalvi → NEET Bridge'}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {isTa
            ? 'சமச்சீர் கல்வியில் நீங்கள் படித்த தலைப்பை உள்ளிடுங்கள் — NCERT என்ன சேர்க்கிறது, NEET என்ன கேட்கிறது என்பதை காட்டுவோம்.'
            : "Enter a topic you studied in Samacheer Kalvi — we'll show exactly what NCERT adds and what NEET tests."}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
              {isTa ? 'பாடம்' : 'Subject'}
            </label>
            <select value={subject} onChange={(e) => setSubject(e.target.value as typeof SUBJECTS[number])}
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
              {isTa ? 'வகுப்பு' : 'Class'}
            </label>
            <select value={classLevel} onChange={(e) => setClassLevel(e.target.value as typeof CLASSES[number])}
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}>
              {CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
            {isTa ? 'தலைப்பு (சமச்சீரில் நீங்கள் அறிந்தபடி)' : 'Topic (as you know it from Samacheer)'}
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={isTa ? 'எ.கா. செல் பிளவு, வேதிப் பிணைப்பு, இயக்க விதிகள்…' : 'e.g. Cell Division, Chemical Bonding, Laws of Motion…'}
            required
            style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </div>

        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '0.75rem', background: loading ? '#9ca3af' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading
            ? (isTa ? 'பகுப்பாய்வு செய்கிறோம்…' : 'Analyzing gap…')
            : (isTa ? 'NEET இடைவெளியை காட்டு →' : 'Show NEET Gap →')}
        </button>
      </form>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem 1rem', color: '#dc2626', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Card title={isTa ? '📚 சமச்சீர் கல்வி சொல்வது' : '📚 How Samacheer teaches it'} color="#f59e0b">
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{result.samacheerSummary}</p>
            </Card>
            <Card title={isTa ? '📖 NCERT சொல்வது' : '📖 How NCERT presents it'} color="#1d4ed8">
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{result.ncertVersion}</p>
            </Card>
          </div>

          <Card title={isTa ? '⚠️ இடைவெளி — நீங்கள் தவறவிடுவது' : '⚠️ The gap — what you\'re missing'} color="#dc2626">
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {result.keyDifferences.map((d, i) => <li key={i} style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.4rem', lineHeight: 1.5 }}>{d}</li>)}
            </ul>
          </Card>

          <Card title={isTa ? '🎯 NEET உண்மையில் என்ன கேட்கிறது' : '🎯 What NEET actually tests here'} color="#059669">
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {result.neetFocusPoints.map((p, i) => <li key={i} style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.4rem', lineHeight: 1.5 }}>{p}</li>)}
            </ul>
          </Card>

          {result.extraNcertConcepts.length > 0 && (
            <Card title={isTa ? '➕ உங்கள் குறிப்புகளில் சேர்க்க வேண்டிய NCERT கருத்துகள்' : '➕ Extra NCERT concepts to add to your notes'} color="#7c3aed">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {result.extraNcertConcepts.map((c, i) => (
                  <span key={i} style={{ background: '#ede9fe', color: '#5b21b6', borderRadius: '99px', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>{c}</span>
                ))}
              </div>
            </Card>
          )}

          <Card title={isTa ? '❓ எதிர்பார்க்கப்படும் NEET வினாக்கள்' : '❓ Likely NEET questions'} color="#0891b2">
            {result.expectedQuestions.map((q, i) => (
              <div key={i} style={{ marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenQ(openQ === i ? null : i)}
                  style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: '#f9fafb', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                  {isTa ? `வி${i + 1}.` : `Q${i + 1}.`} {q.question}
                </button>
                {openQ === i && (
                  <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', fontSize: '0.875rem', color: '#166534', lineHeight: 1.6 }}>
                    <strong>{isTa ? 'விடை:' : 'Answer:'}</strong> {q.answer}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ background: color, padding: '0.6rem 1rem' }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '0.875rem', fontWeight: 700 }}>{title}</h3>
      </div>
      <div style={{ padding: '1rem' }}>{children}</div>
    </div>
  );
}
