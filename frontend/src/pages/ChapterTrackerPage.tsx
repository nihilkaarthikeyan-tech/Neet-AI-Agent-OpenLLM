import { useState, useEffect } from 'react';
import { BookOpen, Loader2, CheckCircle, Circle, Eye, RotateCcw, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

type Status = 'not_started' | 'reading' | 'revised' | 'done';

interface Chapter {
  id: string;
  subject: string;
  cls: number;
  num: number;
  name: string;
  status: Status;
}

interface StatusConfig { label: string; color: string; bg: string; border: string; icon: React.ReactNode; }

const STATUS_CONFIG: Record<Status, StatusConfig> = {
  not_started: { label: 'Not Started', color: '#475569', bg: '#0f172a',          border: '#1e293b',          icon: <Circle size={14} /> },
  reading:     { label: 'Reading',     color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', icon: <Eye size={14} /> },
  revised:     { label: 'Revised',     color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.3)', icon: <RotateCcw size={14} /> },
  done:        { label: 'Done',        color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)',  icon: <CheckCircle size={14} /> },
};

const STATUS_ORDER: Status[] = ['not_started', 'reading', 'revised', 'done'];

const SUBJECT_COLORS: Record<string, string> = {
  Biology: '#22c55e',
  Physics: '#6366f1',
  Chemistry: '#f59e0b',
};

function nextStatus(s: Status): Status {
  const idx = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

export default function ChapterTrackerPage() {
  const { token } = useAuthStore();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [filterSubject, setFilterSubject] = useState<string>('All');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/chapter-tracker`, { headers })
      .then((r) => r.json())
      .then((d: { chapters: Chapter[] }) => setChapters(d.chapters))
      .catch(() => setError('Failed to load chapters.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (chapterId: string, status: Status) => {
    setUpdating((prev) => new Set(prev).add(chapterId));
    setChapters((prev) => prev.map((c) => c.id === chapterId ? { ...c, status } : c));
    try {
      await fetch(`${API_BASE}/api/chapter-tracker/${chapterId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch {
      // revert on error
      setChapters((prev) => prev.map((c) => c.id === chapterId ? { ...c, status: nextStatus(status) as Status } : c));
    }
    setUpdating((prev) => { const s = new Set(prev); s.delete(chapterId); return s; });
  };

  const filtered = filterSubject === 'All' ? chapters : chapters.filter((c) => c.subject === filterSubject);

  // Group by subject + class
  const groups: Array<{ key: string; subject: string; cls: number; chapters: Chapter[] }> = [];
  for (const subj of ['Biology', 'Physics', 'Chemistry']) {
    for (const cls of [11, 12]) {
      const chs = filtered.filter((c) => c.subject === subj && c.cls === cls);
      if (chs.length > 0) groups.push({ key: `${subj}${cls}`, subject: subj, cls, chapters: chs });
    }
  }

  // Progress stats
  const stats = (chs: Chapter[]) => ({
    total: chs.length,
    done: chs.filter((c) => c.status === 'done').length,
    revised: chs.filter((c) => c.status === 'revised').length,
    reading: chs.filter((c) => c.status === 'reading').length,
    pct: chs.length > 0 ? Math.round((chs.filter((c) => c.status === 'done').length / chs.length) * 100) : 0,
  });

  const overallStats = stats(chapters);

  return (
    <div className="page-container">
      <div className="page-header">
        <BookOpen size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Chapter Tracker</h1>
          <p className="page-desc">All 97 NCERT chapters — track your progress through the syllabus</p>
        </div>
      </div>

      {/* Overall progress */}
      <div style={{ background: '#1e293b', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '15px' }}>Overall Progress</span>
          <span style={{ fontWeight: 800, color: '#22c55e', fontSize: '20px' }}>{overallStats.done}/{overallStats.total} done</span>
        </div>
        <div style={{ background: '#0f172a', borderRadius: '999px', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{ height: '100%', width: `${overallStats.pct}%`, background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
          {(['done', 'revised', 'reading', 'not_started'] as Status[]).map((s) => (
            <span key={s} style={{ color: STATUS_CONFIG[s].color }}>
              {STATUS_CONFIG[s].icon} {chapters.filter((c) => c.status === s).length} {STATUS_CONFIG[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* Subject filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['All', 'Biology', 'Physics', 'Chemistry'].map((s) => (
          <button key={s} onClick={() => setFilterSubject(s)}
            style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
              background: filterSubject === s ? (SUBJECT_COLORS[s] ?? '#6366f1') : '#1e293b',
              color: filterSubject === s ? '#fff' : '#94a3b8' }}>
            {s}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#f87171', padding: '10px', marginBottom: '12px' }}>{error}</div>}
      {loading && <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#64748b' }}><Loader2 size={18} className="spin" /> Loading chapters…</div>}

      {/* Chapter groups */}
      {groups.map((group) => {
        const s = stats(group.chapters);
        const subjectColor = SUBJECT_COLORS[group.subject] ?? '#6366f1';
        return (
          <div key={group.key} style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            {/* Group header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: subjectColor, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '15px' }}>{group.subject}</span>
                <span style={{ background: '#0f172a', color: '#64748b', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>Class {group.cls}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>{s.done}/{s.total}</span>
                <div style={{ background: '#0f172a', borderRadius: '999px', height: '6px', width: '80px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, background: subjectColor, borderRadius: '999px' }} />
                </div>
              </div>
            </div>

            {/* Chapter list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {group.chapters.map((ch) => {
                const cfg = STATUS_CONFIG[ch.status];
                const isUpdating = updating.has(ch.id);
                return (
                  <div key={ch.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => !isUpdating && updateStatus(ch.id, nextStatus(ch.status))}>
                    {/* Status indicator */}
                    <span style={{ color: cfg.color, flexShrink: 0 }}>
                      {isUpdating ? <Loader2 size={14} className="spin" /> : cfg.icon}
                    </span>

                    {/* Chapter name */}
                    <span style={{ flex: 1, fontSize: '13px', color: ch.status === 'done' ? '#86efac' : '#cbd5e1', textDecoration: ch.status === 'done' ? 'none' : 'none' }}>
                      <span style={{ color: '#64748b', fontSize: '11px', marginRight: '6px' }}>{ch.num}.</span>
                      {ch.name}
                    </span>

                    {/* Status badge */}
                    <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap' }}>
                      {cfg.label}
                    </span>

                    {ch.status === 'done' && <Check size={12} style={{ color: '#22c55e', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p style={{ color: '#334155', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
        Click any chapter to cycle: Not Started → Reading → Revised → Done
      </p>
    </div>
  );
}
