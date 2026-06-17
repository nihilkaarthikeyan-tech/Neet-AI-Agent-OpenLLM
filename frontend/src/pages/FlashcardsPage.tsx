import { useState, useEffect, useCallback } from 'react';
import { Layers, Loader2, Plus, Zap, ChevronRight, BookOpen } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../lib/useLang';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

// ─── Types ────────────────────────────────────────────────────────────────────
type Flashcard = {
  id: string;
  subject: string;
  topic: string;
  front: string;
  back: string;
  lastRating: string;
  nextReview: string;
  reviewCount: number;
  easeFactor: number;
  interval: number;
  repetitions: number;
};

// SM-2 — mirrors the backend calculation so buttons show real next intervals
function sm2Preview(reps: number, ef: number, interval: number, quality: number) {
  let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, newEF);
  if (quality < 3) return 1;
  if (reps === 0) return 1;
  if (reps === 1) return 6;
  return Math.round(interval * ef);
}

function daysLabel(days: number): string {
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

type View = 'home' | 'generating' | 'studying';

const SUBJECTS = ['Biology', 'Chemistry', 'Physics'];
const COUNTS = [5, 10, 20];

const getRatingConfig = (isTa: boolean) => ({
  easy:   { label: isTa ? 'எளிது'    : 'Easy',   color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.3)',  next: isTa ? '7 நாட்கள்'  : '7 days' },
  medium: { label: isTa ? 'நடுத்தரம்' : 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', next: isTa ? '3 நாட்கள்'  : '3 days' },
  hard:   { label: isTa ? 'கடினம்'    : 'Hard',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)',  next: isTa ? 'நாளை'      : 'Tomorrow' },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const { token } = useAuthStore();
  const lang = useLang();
  const isTa = lang === 'ta';

  // Config
  const [subject, setSubject] = useState('Biology');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);

  // View state
  const [view, setView] = useState<View>('home');
  const [error, setError] = useState('');

  // Study state
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [deckIdx, setDeckIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // All cards (home)
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  // Group cards by subject for home view
  const cardsBySubject = allCards.reduce<Record<string, Flashcard[]>>((acc, c) => {
    if (!acc[c.subject]) acc[c.subject] = [];
    acc[c.subject].push(c);
    return acc;
  }, {});

  const dueCount = allCards.filter((c) => new Date(c.nextReview) <= new Date()).length;

  const loadAllCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const res = await fetch(`${API_BASE}/api/flashcards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { flashcards: Flashcard[] };
      if (res.ok) setAllCards(data.flashcards);
    } catch (_) {
      // ignore
    } finally {
      setLoadingCards(false);
    }
  }, [token]);

  useEffect(() => {
    loadAllCards();
  }, [loadAllCards]);

  // ── Generate ────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic to generate flashcards for.');
      return;
    }
    setError('');
    setView('generating');
    try {
      const res = await fetch(`${API_BASE}/api/flashcards/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, topic: topic.trim(), count, language: lang }),
      });
      const data = await res.json() as { flashcards?: Flashcard[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate flashcards');

      setDeck(data.flashcards!);
      setDeckIdx(0);
      setFlipped(false);
      await loadAllCards(); // refresh sidebar
      setView('studying');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
      setView('home');
    }
  };

  // ── Study due cards ─────────────────────────────────────────────────────────
  const handleStudyDue = () => {
    const due = allCards.filter((c) => new Date(c.nextReview) <= new Date());
    if (due.length === 0) return;
    setDeck(due);
    setDeckIdx(0);
    setFlipped(false);
    setView('studying');
  };

  // ── Study a specific subject ─────────────────────────────────────────────────
  const handleStudySubject = (subj: string) => {
    const cards = allCards.filter((c) => c.subject === subj);
    if (cards.length === 0) return;
    setDeck(cards);
    setDeckIdx(0);
    setFlipped(false);
    setView('studying');
  };

  // ── Rate card ───────────────────────────────────────────────────────────────
  const handleRate = async (rating: string) => {
    const card = deck[deckIdx];

    // Call API (fire and forget)
    fetch(`${API_BASE}/api/flashcards/${card.id}/rate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating }),
    }).catch(() => {});

    // Advance to next card
    if (deckIdx < deck.length - 1) {
      setDeckIdx((i) => i + 1);
      setFlipped(false);
    } else {
      // Done with deck
      await loadAllCards();
      setView('home');
    }
  };

  // ─── View: Generating ─────────────────────────────────────────────────────
  const RATING_CONFIG = getRatingConfig(isTa);

  if (view === 'generating') {
    return (
      <div className="page-loading-center">
        <Loader2 size={48} className="spin" />
        <div style={{ textAlign: 'center' }}>
          <h2 className="section-heading" style={{ color: '#e2e8f0', margin: 0 }}>
            {isTa ? `${subject} ஃபிளாஷ்கார்டுகள் உருவாக்கப்படுகிறது…` : `Generating ${subject} flashcards…`}
          </h2>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>
            {isTa ? `"${topic}" தலைப்பில் ${count} அட்டைகள் உருவாக்கப்படுகிறது. சில நொடிகள் ஆகலாம்.` : `Creating ${count} cards on "${topic}". This may take a few seconds.`}
          </p>
        </div>
      </div>
    );
  }

  // ─── View: Studying ───────────────────────────────────────────────────────
  if (view === 'studying' && deck.length > 0) {
    const card = deck[deckIdx];
    const progress = Math.round((deckIdx / deck.length) * 100);
    const isLastCard = deckIdx === deck.length - 1;

    return (
      <div className="page-container flashcard-panel">
        {/* Header */}
        <div className="flashcard-summary">
          <div>
            <h2 className="section-heading" style={{ color: '#e2e8f0', margin: 0 }}>{card.subject} — {card.topic}</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>
              {isTa ? `அட்டை ${deckIdx + 1} / ${deck.length}` : `Card ${deckIdx + 1} of ${deck.length}`}
            </p>
          </div>
          <button onClick={() => setView('home')} className="btn-secondary" style={{ padding: '10px 18px' }}>
            {isTa ? 'வெளியேறு' : 'Exit'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="flashcard-progress">
          <div className="flashcard-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Card */}
        <div
          onClick={() => setFlipped((f) => !f)}
          className="flashcard-card flashcard-large panel-card--dark"
          style={{
            minHeight: '280px',
            cursor: 'pointer',
            userSelect: 'none',
            position: 'relative',
            border: `2px solid ${flipped ? '#6366f1' : '#334155'}`,
          }}
        >
          <div
            style={{
              position: 'absolute', top: '14px', left: '16px', fontSize: '11px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.07em', color: flipped ? '#818cf8' : '#64748b',
            }}
          >
            {flipped ? (isTa ? 'விடை' : 'Answer') : (isTa ? 'கேள்வி / கருத்து' : 'Question / Concept')}
          </div>

          <p style={{ fontSize: '18px', lineHeight: 1.7, color: '#e2e8f0', whiteSpace: 'pre-wrap', maxWidth: '600px' }}>
            {flipped ? card.back : card.front}
          </p>

          {!flipped && (
            <p style={{ marginTop: '24px', fontSize: '13px', color: '#475569' }}>{isTa ? 'விடையை காட்ட கிளிக் செய்க' : 'Click to reveal answer'}</p>
          )}
        </div>

        {/* Rating buttons (only shown after flip) */}
        {flipped && (() => {
          const qualityMap: Record<string, number> = { hard: 1, medium: 3, easy: 5 };
          return (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {(Object.entries(RATING_CONFIG) as [string, typeof RATING_CONFIG[keyof typeof RATING_CONFIG]][]).map(([key, cfg]) => {
                const nextDays = sm2Preview(card.repetitions, card.easeFactor, card.interval, qualityMap[key]);
                return (
                  <button
                    key={key}
                    onClick={() => handleRate(key)}
                    style={{
                      padding: '12px 28px', borderRadius: '10px', border: `2px solid ${cfg.border}`,
                      background: cfg.bg, color: cfg.color, cursor: 'pointer', fontWeight: 700, fontSize: '15px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      minWidth: '100px',
                    }}
                  >
                    <span>{cfg.label}</span>
                    <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 400 }}>
                      {isTa ? `மீண்டும்: ${daysLabel(nextDays)}` : `in ${daysLabel(nextDays)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {!flipped && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setFlipped(true)}
              style={{ padding: '12px 32px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '15px' }}
            >
              {isTa ? 'அட்டையை திருப்பு' : 'Flip Card'}
            </button>
          </div>
        )}

        {/* Remaining indicator */}
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#475569' }}>
          {isTa
            ? `${deck.length - deckIdx - 1} அட்டைகள் எஞ்சியுள்ளன${isLastCard ? ' — கடைசி அட்டை!' : ''}`
            : `${deck.length - deckIdx - 1} cards remaining${isLastCard ? ' — last card!' : ''}`}
        </p>
      </div>
    );
  }

  // ─── View: Home ───────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <div className="page-header">
        <Layers size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'ஃபிளாஷ்கார்டுகள்' : 'Flashcards'}</h1>
          <p className="page-desc">{isTa ? 'AI-உருவாக்கிய NEET மீட்பு அட்டைகள் — இடைவெளி மீட்பு முறை' : 'AI-generated spaced repetition cards for NEET revision'}</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Due cards CTA */}
      {dueCount > 0 && (
        <button
          className="flashcard-card btn-secondary"
          onClick={handleStudyDue}
          style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={20} style={{ color: '#818cf8' }} />
            <div>
              <p style={{ fontWeight: 700, color: '#334155', fontSize: '15px', margin: 0 }}>{isTa ? `${dueCount} அட்டைகள் மீட்பிற்கு தயார்` : `${dueCount} cards due for review`}</p>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>{isTa ? 'உங்கள் தொடர்ச்சியை தக்கவைக்க இப்போது படியுங்கள்!' : 'Study now to keep your streak going!'}</p>
            </div>
          </div>
          <ChevronRight size={20} style={{ color: '#818cf8' }} />
        </button>
      )}

      {/* Generator form */}
      <div className="flashcard-card panel-card--dark" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} style={{ color: '#6366f1' }} /> {isTa ? 'புதிய ஃபிளாஷ்கார்டுகள் உருவாக்கு' : 'Generate New Flashcards'}
        </h2>

        <div className="form-panel">
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {/* Subject */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>{isTa ? 'பாடம்' : 'Subject'}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {SUBJECTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    style={{
                      padding: '8px 14px', borderRadius: '8px', border: `2px solid ${subject === s ? '#6366f1' : '#334155'}`,
                      background: subject === s ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: subject === s ? '#a5b4fc' : '#94a3b8',
                      cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>{isTa ? 'அட்டைகள்' : 'Cards'}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCount(c)}
                    style={{
                      padding: '8px 14px', borderRadius: '8px', border: `2px solid ${count === c ? '#6366f1' : '#334155'}`,
                      background: count === c ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: count === c ? '#a5b4fc' : '#94a3b8',
                      cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Topic input */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>{isTa ? 'தலைப்பு' : 'Topic'}</label>
            <input
              type="text"
              placeholder={`e.g. ${subject === 'Biology' ? 'Cell Division, Photosynthesis' : subject === 'Chemistry' ? 'Organic Reactions, Periodic Table' : 'Laws of Motion, Optics'}`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              style={{
                width: '100%', maxWidth: '480px', padding: '10px 14px', borderRadius: '8px',
                border: '2px solid #334155', background: '#0f172a', color: '#e2e8f0',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <button
              onClick={handleGenerate}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 24px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}
            >
              <Zap size={16} /> {isTa ? 'அட்டைகளை உருவாக்கு' : 'Generate Cards'}
            </button>
          </div>
        </div>
      </div>

      {/* Existing cards by subject */}
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={16} style={{ color: '#6366f1' }} /> {isTa ? 'உங்கள் அட்டை நூலகம்' : 'Your Card Library'}
        </h2>

        {loadingCards && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
            <Loader2 size={16} className="spin" /> {isTa ? 'அட்டைகள் ஏற்றப்படுகிறது…' : 'Loading cards…'}
          </div>
        )}

        {!loadingCards && allCards.length === 0 && (
          <p style={{ color: '#475569', fontSize: '14px' }}>{isTa ? 'இன்னும் ஃபிளாஷ்கார்டுகள் இல்லை. மேலே உங்கள் முதல் அட்டைகளை உருவாக்குங்கள்!' : 'No flashcards yet. Generate your first deck above!'}</p>
        )}

        {!loadingCards && Object.entries(cardsBySubject).map(([subj, cards]) => {
          const due = cards.filter((c) => new Date(c.nextReview) <= new Date()).length;
          const byTopic = cards.reduce<Record<string, number>>((acc, c) => {
            acc[c.topic] = (acc[c.topic] ?? 0) + 1;
            return acc;
          }, {});

          return (
            <div key={subj} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: '#e2e8f0' }}>{subj}</span>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{cards.length} {isTa ? 'அட்டைகள்' : 'cards'}</span>
                  {due > 0 && (
                    <span style={{ fontSize: '12px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '99px', fontWeight: 600 }}>
                      {due} due
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleStudySubject(subj)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                >
                  {isTa ? 'படி' : 'Study'} <ChevronRight size={14} />
                </button>
              </div>

              {/* Topics breakdown */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {Object.entries(byTopic).map(([t, n]) => (
                  <span key={t} style={{ fontSize: '12px', background: '#0f172a', color: '#94a3b8', padding: '4px 10px', borderRadius: '99px', border: '1px solid #334155' }}>
                    {t} ({n})
                  </span>
                ))}
              </div>
              {/* SM-2 status line */}
              {(() => {
                const reviewed = cards.filter((c) => c.reviewCount > 0);
                const avgInterval = reviewed.length > 0 ? Math.round(reviewed.reduce((s, c) => s + c.interval, 0) / reviewed.length) : 0;
                const nextDue = cards.reduce<Date | null>((min, c) => {
                  const d = new Date(c.nextReview);
                  return min === null || d < min ? d : min;
                }, null);
                return reviewed.length > 0 ? (
                  <div style={{ fontSize: '11px', color: '#475569', display: 'flex', gap: '12px' }}>
                    <span>⏱ Avg interval: {avgInterval}d</span>
                    {nextDue && <span>📅 Next due: {nextDue <= new Date() ? 'Today' : nextDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                ) : null;
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
