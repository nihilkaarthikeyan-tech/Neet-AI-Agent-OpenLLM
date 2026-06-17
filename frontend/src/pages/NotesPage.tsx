import { useState, useEffect, useCallback } from 'react';
import { FileText, Highlighter, Star, Plus, Trash2, Pin, Loader2, Save, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';
type Tab = 'notes' | 'highlights' | 'formulas';

interface Note { id: string; title: string; content: string; subject: string; pinned: boolean; createdAt: string; updatedAt: string; }
interface Highlight { id: string; content: string; sourceContext: string; subject: string; createdAt: string; }
interface Formula { id: string; formula: string; subject: string; topic: string; createdAt: string; }

const SUBJECTS = ['', 'Biology', 'Chemistry', 'Physics'];
const SUBJECT_COLORS: Record<string, string> = { Biology: '#22c55e', Chemistry: '#f59e0b', Physics: '#6366f1' };

export default function NotesPage() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<Tab>('notes');

  const [notes, setNotes] = useState<Note[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(false);

  // Notes form
  const [editing, setEditing] = useState<Note | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);

  // Formula form
  const [newFormula, setNewFormula] = useState('');
  const [newFormulaSubject, setNewFormulaSubject] = useState('Physics');
  const [newFormulaTopic, setNewFormulaTopic] = useState('');
  const [showFormulaForm, setShowFormulaForm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  const load = useCallback(async (t: Tab) => {
    setLoading(true); setError('');
    try {
      if (t === 'notes') {
        const r = await fetch(`${API_BASE}/api/notes`, { headers });
        setNotes((await r.json() as { notes: Note[] }).notes);
      } else if (t === 'highlights') {
        const r = await fetch(`${API_BASE}/api/notes/highlights`, { headers });
        setHighlights((await r.json() as { highlights: Highlight[] }).highlights);
      } else {
        const r = await fetch(`${API_BASE}/api/notes/formulas`, { headers });
        setFormulas((await r.json() as { formulas: Formula[] }).formulas);
      }
    } catch { setError('Failed to load.'); }
    finally { setLoading(false); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(tab); }, [tab, load]);

  // ── Note CRUD ────────────────────────────────────────────────────────────────
  const openNew = () => { setEditing(null); setNewTitle(''); setNewContent(''); setNewSubject(''); setShowNoteForm(true); };
  const openEdit = (n: Note) => { setEditing(n); setNewTitle(n.title); setNewContent(n.content); setNewSubject(n.subject); setShowNoteForm(true); };

  const saveNote = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const r = await fetch(`${API_BASE}/api/notes/${editing.id}`, {
          method: 'PUT', headers: jsonHeaders,
          body: JSON.stringify({ title: newTitle, content: newContent, subject: newSubject }),
        });
        const d = await r.json() as { note: Note };
        setNotes((prev) => prev.map((n) => n.id === editing.id ? d.note : n));
      } else {
        const r = await fetch(`${API_BASE}/api/notes`, {
          method: 'POST', headers: jsonHeaders,
          body: JSON.stringify({ title: newTitle, content: newContent, subject: newSubject }),
        });
        const d = await r.json() as { note: Note };
        setNotes((prev) => [d.note, ...prev]);
      }
      setShowNoteForm(false);
    } catch { setError('Failed to save note.'); }
    finally { setSaving(false); }
  };

  const deleteNote = async (id: string) => {
    await fetch(`${API_BASE}/api/notes/${id}`, { method: 'DELETE', headers });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const togglePin = async (n: Note) => {
    const r = await fetch(`${API_BASE}/api/notes/${n.id}`, {
      method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ pinned: !n.pinned }),
    });
    const d = await r.json() as { note: Note };
    setNotes((prev) => prev.map((x) => x.id === n.id ? d.note : x));
  };

  // ── Highlight delete ──────────────────────────────────────────────────────────
  const deleteHighlight = async (id: string) => {
    await fetch(`${API_BASE}/api/notes/highlights/${id}`, { method: 'DELETE', headers });
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  // ── Formula CRUD ──────────────────────────────────────────────────────────────
  const saveFormula = async () => {
    if (!newFormula.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/notes/formulas`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ formula: newFormula, subject: newFormulaSubject, topic: newFormulaTopic }),
      });
      const d = await r.json() as { bookmark: Formula };
      setFormulas((prev) => [d.bookmark, ...prev]);
      setNewFormula(''); setNewFormulaTopic(''); setShowFormulaForm(false);
    } catch { setError('Failed to save formula.'); }
    finally { setSaving(false); }
  };

  const deleteFormula = async (id: string) => {
    await fetch(`${API_BASE}/api/notes/formulas/${id}`, { method: 'DELETE', headers });
    setFormulas((prev) => prev.filter((f) => f.id !== id));
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'notes',      label: 'My Notes',         icon: <FileText size={14} />,    count: notes.length },
    { id: 'highlights', label: 'Saved Highlights',  icon: <Highlighter size={14} />, count: highlights.length },
    { id: 'formulas',   label: 'Formula Bookmarks', icon: <Star size={14} />,        count: formulas.length },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <FileText size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Study Notes</h1>
          <p className="page-desc">Personal notes, saved highlights from AI responses, and bookmarked formulas</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', background: '#1e293b', padding: '6px', borderRadius: '10px' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#6366f1' : 'transparent', color: tab === t.id ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            {t.icon} {t.label}
            {t.count > 0 && <span style={{ background: tab === t.id ? 'rgba(255,255,255,0.2)' : '#334155', borderRadius: '999px', padding: '1px 6px', fontSize: '11px' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}
      {loading && <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#64748b' }}><Loader2 size={18} className="spin" /> Loading…</div>}

      {/* ── Notes Tab ── */}
      {!loading && tab === 'notes' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
            <button onClick={openNew}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
              <Plus size={16} /> New Note
            </button>
          </div>

          {/* Note form */}
          {showNoteForm && (
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #6366f1' }}>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Note title (optional)"
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', padding: '9px 12px', color: '#e2e8f0', fontSize: '14px', marginBottom: '10px', boxSizing: 'border-box' }} />
              <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)}
                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', padding: '8px 12px', color: '#e2e8f0', fontSize: '13px', marginBottom: '10px' }}>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s || 'No subject'}</option>)}
              </select>
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Write your notes here…" rows={6}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', padding: '10px 12px', color: '#e2e8f0', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, marginBottom: '12px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveNote} disabled={saving || !newContent.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                  {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : <><Save size={14} /> Save</>}
                </button>
                <button onClick={() => setShowNoteForm(false)}
                  style={{ padding: '8px 14px', borderRadius: '7px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {notes.length === 0 && !showNoteForm && (
            <div style={{ textAlign: 'center', color: '#475569', padding: '40px', background: '#1e293b', borderRadius: '12px' }}>
              <FileText size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
              <p>No notes yet. Click "New Note" to start writing.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notes.map((note) => (
              <div key={note.id} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', border: note.pinned ? '1px solid rgba(251,191,36,0.3)' : '1px solid transparent', cursor: 'pointer' }} onClick={() => openEdit(note)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {note.pinned && <Pin size={12} style={{ color: '#fbbf24' }} />}
                    <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '14px' }}>{note.title}</span>
                    {note.subject && <span style={{ fontSize: '10px', fontWeight: 600, color: SUBJECT_COLORS[note.subject] ?? '#64748b', background: `${SUBJECT_COLORS[note.subject] ?? '#475569'}1a`, padding: '2px 7px', borderRadius: '4px' }}>{note.subject}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => togglePin(note)} title="Pin"
                      style={{ background: 'none', border: 'none', color: note.pinned ? '#fbbf24' : '#475569', cursor: 'pointer', padding: '4px' }}>
                      <Pin size={14} />
                    </button>
                    <button onClick={() => deleteNote(note.id)} title="Delete"
                      style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '4px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {note.content}
                </p>
                <p style={{ color: '#334155', fontSize: '11px', marginTop: '8px' }}>
                  {new Date(note.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Highlights Tab ── */}
      {!loading && tab === 'highlights' && (
        <>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '14px' }}>
            Highlights you've saved from AI responses. Use the 📌 button in the AI Tutor to save any message.
          </p>
          {highlights.length === 0 && (
            <div style={{ textAlign: 'center', color: '#475569', padding: '40px', background: '#1e293b', borderRadius: '12px' }}>
              <Highlighter size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
              <p>No highlights yet. Save AI responses using the 📌 button in the tutor.</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {highlights.map((h) => (
              <div key={h.id} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', borderLeft: `3px solid ${SUBJECT_COLORS[h.subject] ?? '#6366f1'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {h.subject && <span style={{ fontSize: '10px', fontWeight: 600, color: SUBJECT_COLORS[h.subject] ?? '#6366f1' }}>{h.subject}</span>}
                    {h.sourceContext && <span style={{ fontSize: '10px', color: '#475569' }}>{h.sourceContext}</span>}
                  </div>
                  <button onClick={() => deleteHighlight(h.id)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{h.content}</p>
                <p style={{ color: '#334155', fontSize: '11px', marginTop: '8px' }}>{new Date(h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Formulas Tab ── */}
      {!loading && tab === 'formulas' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
            <button onClick={() => setShowFormulaForm(!showFormulaForm)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#000', cursor: 'pointer', fontWeight: 700 }}>
              {showFormulaForm ? <><X size={14} /> Close</> : <><Star size={14} /> Star Formula</>}
            </button>
          </div>

          {showFormulaForm && (
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid rgba(245,158,11,0.3)' }}>
              <textarea value={newFormula} onChange={(e) => setNewFormula(e.target.value)} placeholder="Enter formula (e.g., F = ma, PV = nRT, v = u + at)" rows={3}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', padding: '10px 12px', color: '#e2e8f0', fontSize: '14px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <select value={newFormulaSubject} onChange={(e) => setNewFormulaSubject(e.target.value)}
                  style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', padding: '8px 12px', color: '#e2e8f0', fontSize: '13px' }}>
                  {['Biology', 'Chemistry', 'Physics'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <input value={newFormulaTopic} onChange={(e) => setNewFormulaTopic(e.target.value)} placeholder="Topic (optional)"
                  style={{ flex: 1, minWidth: '140px', background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', padding: '8px 12px', color: '#e2e8f0', fontSize: '13px' }} />
              </div>
              <button onClick={saveFormula} disabled={saving || !newFormula.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#f59e0b', color: '#000', cursor: 'pointer', fontWeight: 700 }}>
                {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : <><Star size={14} /> Bookmark</>}
              </button>
            </div>
          )}

          {formulas.length === 0 && !showFormulaForm && (
            <div style={{ textAlign: 'center', color: '#475569', padding: '40px', background: '#1e293b', borderRadius: '12px' }}>
              <Star size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
              <p>No formulas bookmarked. Star any important formula to access it quickly before exams.</p>
            </div>
          )}

          {/* Group formulas by subject */}
          {['Physics', 'Chemistry', 'Biology'].map((subj) => {
            const subFormulas = formulas.filter((f) => f.subject === subj);
            if (subFormulas.length === 0) return null;
            return (
              <div key={subj} style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SUBJECT_COLORS[subj] }} />
                  <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{subj}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{subFormulas.length} formulas</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {subFormulas.map((f) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0f172a', borderRadius: '8px', padding: '10px 14px' }}>
                      <code style={{ flex: 1, color: SUBJECT_COLORS[subj] ?? '#e2e8f0', fontSize: '14px', fontFamily: 'monospace', background: 'transparent' }}>{f.formula}</code>
                      {f.topic && <span style={{ fontSize: '11px', color: '#475569' }}>{f.topic}</span>}
                      <button onClick={() => deleteFormula(f.id)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
