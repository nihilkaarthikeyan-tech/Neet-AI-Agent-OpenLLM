import { useState } from 'react';
import { Zap, Loader2, BookOpen, MessageCircle, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import MarkdownText from '../components/MarkdownText';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

interface ReviseData {
  summary: string;
  testCount: number;
  doubtCount: number;
  lessonCount: number;
  subjects: string[];
}

const SUBJECT_COLORS: Record<string, string> = { Biology: '#22c55e', Chemistry: '#f59e0b', Physics: '#6366f1' };

export default function QuickRevisePage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<ReviseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const res = await fetch(`${API_BASE}/api/quick-revise`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to generate summary.');
      setData(await res.json() as ReviseData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <Zap size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Quick Revise — Last 3 Days</h1>
          <p className="page-desc">AI summarises everything you studied in the past 3 days — perfect before a test</p>
        </div>
      </div>

      {/* Trigger card */}
      <div style={{ background: '#1e293b', borderRadius: '14px', padding: '28px', marginBottom: '20px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
          Tap below to get a concise AI-generated recap of your tests, doubts, and micro-lessons from the last 3 days — including key concepts and what to review next.
        </p>
        <button onClick={generate} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '13px 32px', borderRadius: '10px', border: 'none', background: loading ? '#334155' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '16px' }}>
          {loading ? <><Loader2 size={18} className="spin" /> Generating summary…</> : <><Zap size={18} /> Generate Last 3 Days Recap</>}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#f87171', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Activity stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
            <div style={{ background: '#1e293b', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <BookOpen size={18} style={{ color: '#6366f1', margin: '0 auto 6px' }} />
              <p style={{ fontSize: '22px', fontWeight: 800, color: '#6366f1', margin: 0 }}>{data.testCount}</p>
              <p style={{ fontSize: '11px', color: '#64748b' }}>Tests Done</p>
            </div>
            <div style={{ background: '#1e293b', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <MessageCircle size={18} style={{ color: '#22c55e', margin: '0 auto 6px' }} />
              <p style={{ fontSize: '22px', fontWeight: 800, color: '#22c55e', margin: 0 }}>{data.doubtCount}</p>
              <p style={{ fontSize: '11px', color: '#64748b' }}>Doubts Asked</p>
            </div>
            <div style={{ background: '#1e293b', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <Sparkles size={18} style={{ color: '#f59e0b', margin: '0 auto 6px' }} />
              <p style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b', margin: 0 }}>{data.lessonCount}</p>
              <p style={{ fontSize: '11px', color: '#64748b' }}>Lessons Done</p>
            </div>
            {data.subjects.length > 0 && (
              <div style={{ background: '#1e293b', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>Subjects</p>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {data.subjects.map((s) => (
                    <span key={s} style={{ fontSize: '10px', fontWeight: 700, color: SUBJECT_COLORS[s] ?? '#94a3b8', background: `${SUBJECT_COLORS[s] ?? '#475569'}1a`, padding: '2px 7px', borderRadius: '4px' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Summary */}
          <div style={{ background: '#1e293b', borderRadius: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Zap size={16} style={{ color: '#6366f1' }} />
              <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '15px' }}>Last 3 Days — AI Summary</span>
            </div>
            <MarkdownText content={data.summary} style={{ color: '#cbd5e1', fontSize: '14px' }} />
          </div>

          <button onClick={generate}
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>
            <Zap size={14} /> Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
