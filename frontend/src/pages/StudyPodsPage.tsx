import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, LogIn, Trophy, Layers, Loader2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

// ── Types ──────────────────────────────────────────────────────────────────────
interface MyPod { id: string; name: string; code: string; isOwner: boolean; memberCount: number; flashcardCount: number; joinedAt: string; }
interface LeaderEntry { rank: number; name: string; xp: number; level: number; streak: number; isMe: boolean; }
interface PodCard { id: string; front: string; back: string; subject: string; topic: string; createdAt: string; }
interface PodDetail { pod: { id: string; name: string; code: string; isOwner: boolean }; leaderboard: LeaderEntry[]; flashcards: PodCard[]; }

const SUBJECTS = ['Biology', 'Physics', 'Chemistry'];
const SUBJECT_COLORS: Record<string, string> = { Biology: '#22c55e', Chemistry: '#f59e0b', Physics: '#6366f1' };

export default function StudyPodsPage() {
  const { token, user } = useAuthStore();
  const [pods, setPods] = useState<MyPod[]>([]);
  const [selected, setSelected] = useState<PodDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create/join forms
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);

  // Flashcard form
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [cardSubject, setCardSubject] = useState('Biology');
  const [cardTopic, setCardTopic] = useState('');
  const [addingCard, setAddingCard] = useState(false);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  const loadPods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/pods/mine`, { headers });
      const data = await res.json() as { pods: MyPod[] };
      setPods(data.pods ?? []);
    } catch { setError('Failed to load pods.'); }
    finally { setLoading(false); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadPods(); }, [loadPods]);

  const openPod = async (podId: string) => {
    setLoading(true); setSelected(null);
    try {
      const res = await fetch(`${API_BASE}/api/pods/${podId}`, { headers });
      setSelected(await res.json() as PodDetail);
    } catch { setError('Failed to load pod.'); }
    finally { setLoading(false); }
  };

  async function createPod() {
    if (!createName.trim() || acting) return;
    setActing(true); setActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/pods/create`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ name: createName.trim() }),
      });
      const data = await res.json() as { pod?: MyPod; error?: string };
      if (!res.ok) { setActionMsg(data.error ?? 'Failed.'); return; }
      setCreateName('');
      setActionMsg(`Pod created! Share code: ${data.pod!.code}`);
      await loadPods();
    } catch { setActionMsg('Failed to create pod.'); }
    finally { setActing(false); }
  }

  async function joinPod() {
    if (!joinCode.trim() || acting) return;
    setActing(true); setActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/pods/join`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json() as { pod?: MyPod; error?: string };
      if (!res.ok) { setActionMsg(data.error ?? 'Failed.'); return; }
      setJoinCode('');
      setActionMsg(`Joined "${data.pod!.name}"!`);
      await loadPods();
    } catch { setActionMsg('Failed to join pod.'); }
    finally { setActing(false); }
  }

  async function leavePod(podId: string) {
    if (!window.confirm('Leave this pod?')) return;
    try {
      await fetch(`${API_BASE}/api/pods/${podId}/leave`, { method: 'DELETE', headers });
      setSelected(null);
      await loadPods();
    } catch { setError('Failed to leave pod.'); }
  }

  async function addFlashcard(podId: string) {
    if (!cardFront.trim() || !cardBack.trim() || addingCard) return;
    setAddingCard(true);
    try {
      const res = await fetch(`${API_BASE}/api/pods/${podId}/flashcard`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ front: cardFront.trim(), back: cardBack.trim(), subject: cardSubject, topic: cardTopic.trim() }),
      });
      if (res.ok) {
        setCardFront(''); setCardBack(''); setCardTopic('');
        await openPod(podId);
      }
    } catch { setError('Failed to add flashcard.'); }
    finally { setAddingCard(false); }
  }

  function toggleFlip(id: string) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const cardStyle: React.CSSProperties = { background: '#1e293b', borderRadius: '12px', padding: '20px' };
  const inputStyle: React.CSSProperties = { padding: '9px 14px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '14px' };
  const btnStyle = (bg: string): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', border: 'none', background: bg, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' });

  // ── Pod detail view ──
  if (selected) {
    const pod = selected.pod;
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => setSelected(null)} style={{ ...btnStyle('#334155'), padding: '7px 12px' }}>← Back</button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{pod.name}</h1>
            <p style={{ color: '#64748b', fontSize: '13px' }}>Code: <span style={{ color: '#6366f1', fontWeight: 700, letterSpacing: '0.1em' }}>{pod.code}</span></p>
          </div>
          {!pod.isOwner && (
            <button onClick={() => leavePod(pod.id)} style={{ ...btnStyle('#ef4444'), marginLeft: 'auto', padding: '7px 12px' }}>
              <Trash2 size={14} /> Leave
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Leaderboard */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Trophy size={16} style={{ color: '#fbbf24' }} />
              <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '14px' }}>Pod Leaderboard</p>
            </div>
            {selected.leaderboard.map((entry) => (
              <div key={entry.rank} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: entry.isMe ? 'rgba(99,102,241,0.15)' : '#0f172a', borderRadius: '8px', marginBottom: '6px', border: entry.isMe ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent' }}>
                <span style={{ fontWeight: 800, color: entry.rank <= 3 ? '#fbbf24' : '#64748b', width: '24px', textAlign: 'center' }}>
                  {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: entry.isMe ? '#a5b4fc' : '#e2e8f0', fontWeight: entry.isMe ? 700 : 500, fontSize: '13px' }}>
                    {entry.isMe ? `${entry.name} (You)` : entry.name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#475569' }}>Lv.{entry.level} · 🔥{entry.streak} streak</p>
                </div>
                <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '13px' }}>{entry.xp.toLocaleString('en-IN')} XP</span>
              </div>
            ))}
          </div>

          {/* Add flashcard */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Layers size={16} style={{ color: '#6366f1' }} />
              <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '14px' }}>Add Shared Flashcard</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {SUBJECTS.map((s) => (
                <button key={s} onClick={() => setCardSubject(s)}
                  style={{ padding: '5px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: cardSubject === s ? SUBJECT_COLORS[s] : '#0f172a', color: cardSubject === s ? '#fff' : '#64748b' }}>
                  {s}
                </button>
              ))}
            </div>
            <input placeholder="Front (question)" value={cardFront} onChange={(e) => setCardFront(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '8px' }} />
            <textarea placeholder="Back (answer)" value={cardBack} onChange={(e) => setCardBack(e.target.value)} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', marginBottom: '8px' }} />
            <input placeholder="Topic (optional)" value={cardTopic} onChange={(e) => setCardTopic(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '10px' }} />
            <button onClick={() => addFlashcard(pod.id)} disabled={addingCard || !cardFront.trim() || !cardBack.trim()}
              style={{ ...btnStyle('#6366f1'), opacity: addingCard || !cardFront.trim() || !cardBack.trim() ? 0.6 : 1 }}>
              {addingCard ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Add Card
            </button>
          </div>
        </div>

        {/* Shared flashcards */}
        {selected.flashcards.length > 0 && (
          <div style={{ ...cardStyle, marginTop: '20px' }}>
            <p style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '14px' }}>
              Shared Deck ({selected.flashcards.length} cards)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {selected.flashcards.map((card) => {
                const isFlipped = flipped.has(card.id);
                const color = SUBJECT_COLORS[card.subject] ?? '#6366f1';
                return (
                  <div key={card.id} onClick={() => toggleFlip(card.id)}
                    style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', cursor: 'pointer', borderLeft: `3px solid ${color}`, minHeight: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontSize: '10px', color, fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>
                      {card.subject}{card.topic ? ` · ${card.topic}` : ''} · {isFlipped ? 'Answer' : 'Question'}
                    </p>
                    <p style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: 1.5 }}>
                      {isFlipped ? card.back : card.front}
                    </p>
                    <p style={{ fontSize: '10px', color: '#334155', marginTop: '8px' }}>Tap to flip</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Pods list view ──
  return (
    <div className="page-container">
      <div className="page-header">
        <Users size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Study Group Pods</h1>
          <p className="page-desc">5 students · shared flashcard deck · XP leaderboard</p>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Create */}
        <div style={cardStyle}>
          <p style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '12px' }}>Create a Pod</p>
          <input placeholder="Pod name (e.g. NEET Warriors 2025)" value={createName} onChange={(e) => setCreateName(e.target.value)}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '10px' }}
            onKeyDown={(e) => e.key === 'Enter' && createPod()} />
          <button onClick={createPod} disabled={acting || !createName.trim()} style={{ ...btnStyle('#22c55e'), opacity: acting || !createName.trim() ? 0.6 : 1 }}>
            {acting ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Create Pod
          </button>
        </div>

        {/* Join */}
        <div style={cardStyle}>
          <p style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '12px' }}>Join a Pod</p>
          <input placeholder="Enter code (e.g. POD-7F3K)" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '10px', fontFamily: 'monospace', letterSpacing: '0.1em' }}
            onKeyDown={(e) => e.key === 'Enter' && joinPod()} />
          <button onClick={joinPod} disabled={acting || !joinCode.trim()} style={{ ...btnStyle('#6366f1'), opacity: acting || !joinCode.trim() ? 0.6 : 1 }}>
            {acting ? <Loader2 size={14} className="spin" /> : <LogIn size={14} />} Join Pod
          </button>
        </div>
      </div>

      {actionMsg && (
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#a5b4fc', marginBottom: '16px', fontWeight: 600 }}>
          {actionMsg}
        </div>
      )}

      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', padding: '24px 0' }}><Loader2 size={20} className="spin" /> Loading…</div>}

      {!loading && pods.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px', color: '#475569' }}>
          <Users size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p style={{ fontWeight: 600, marginBottom: '6px' }}>No pods yet</p>
          <p style={{ fontSize: '13px' }}>Create one and share the code with up to 4 friends to study together.</p>
        </div>
      )}

      {!loading && pods.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {pods.map((pod) => (
            <div key={pod.id} onClick={() => openPod(pod.id)}
              style={{ ...cardStyle, cursor: 'pointer', borderTop: `3px solid ${pod.isOwner ? '#22c55e' : '#6366f1'}`, transition: 'transform 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '15px' }}>{pod.name}</p>
                {pod.isOwner && <span style={{ fontSize: '10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Owner</span>}
              </div>
              <p style={{ fontFamily: 'monospace', color: '#6366f1', fontWeight: 700, letterSpacing: '0.1em', fontSize: '14px', marginBottom: '10px' }}>{pod.code}</p>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                <span><Users size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />{pod.memberCount}/5 members</span>
                <span><Layers size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />{pod.flashcardCount} cards</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '12px', color: '#334155', marginTop: '20px', textAlign: 'center' }}>
        Pods are capped at 5 members · {user?.name ? `Hi ${user.name.split(' ')[0]}!` : ''} Share your pod code with classmates to study together.
      </p>
    </div>
  );
}
