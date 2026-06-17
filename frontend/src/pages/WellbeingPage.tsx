import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const MOODS = [
  { value: 'great',       emoji: '😄', label: 'Great',       labelTa: 'நன்றாக இருக்கிறேன்',   color: '#059669' },
  { value: 'okay',        emoji: '🙂', label: 'Okay',        labelTa: 'சரியாக இருக்கிறேன்',    color: '#0891b2' },
  { value: 'stressed',    emoji: '😟', label: 'Stressed',    labelTa: 'மன அழுத்தம் உள்ளது',   color: '#d97706' },
  { value: 'overwhelmed', emoji: '😰', label: 'Overwhelmed', labelTa: 'மிகவும் கஷ்டமாக உள்ளது', color: '#dc2626' },
  { value: 'anxious',     emoji: '😨', label: 'Anxious',     labelTa: 'பதட்டமாக உள்ளது',      color: '#7c3aed' },
] as const;

type MoodValue = typeof MOODS[number]['value'];

interface Helpline { name: string; number: string; note?: string }
interface CheckinResponse { crisis: boolean; message: string; helplines: Helpline[] }

export default function WellbeingPage() {
  const { user } = useAuthStore();
  const lang = user?.language ?? 'en';
  const isTamil = lang === 'ta';

  const [mood, setMood] = useState<MoodValue | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!mood) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.post<CheckinResponse>('/api/wellbeing/checkin', { mood, note: note.trim() || undefined, language: lang });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setMood(null); setNote(''); setResult(null); setError(''); };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', margin: '0 0 0.4rem' }}>
          🌱 {isTamil ? 'மன நல சரிபார்ப்பு' : 'Wellbeing Check-in'}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {isTamil
            ? 'NEET மட்டுமே உங்கள் வாழ்க்கை அல்ல. உங்கள் உணர்வுகள் முக்கியம். இன்று எப்படி உணர்கிறீர்கள்?'
            : 'NEET is important, but so are you. How are you feeling today?'}
        </p>
      </div>

      {!result ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>
            {isTamil ? 'உங்கள் மனநிலை எப்படி உள்ளது?' : 'How are you feeling right now?'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {MOODS.map((m) => (
              <button key={m.value} onClick={() => setMood(m.value)}
                style={{ padding: '1rem 0.5rem', border: `2px solid ${mood === m.value ? m.color : '#e5e7eb'}`, borderRadius: '10px', background: mood === m.value ? `${m.color}15` : '#fafafa', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>{m.emoji}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: mood === m.value ? m.color : '#374151' }}>{m.label}</div>
                {isTamil && <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '0.15rem' }}>{m.labelTa}</div>}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              {isTamil ? 'ஏதாவது சொல்ல விரும்புகிறீர்களா? (விரும்பினால்)' : 'Want to share what\'s on your mind? (optional)'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={isTamil ? 'தாராளமாக தமிழிலோ ஆங்கிலத்திலோ எழுதுங்கள்…' : 'It\'s okay to write anything — exam pressure, family, anything…'}
              style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

          <button onClick={handleSubmit} disabled={!mood || loading}
            style={{ width: '100%', padding: '0.75rem', background: !mood || loading ? '#9ca3af' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '1rem', cursor: !mood || loading ? 'not-allowed' : 'pointer' }}>
            {loading ? (isTamil ? 'உங்கள் செய்தி வருகிறது…' : 'Getting your message…') : isTamil ? 'அனுப்பு →' : 'Submit →'}
          </button>
        </div>
      ) : (
        <div>
          {result.crisis ? (
            /* Crisis path — always prominent, never hidden */
            <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
              <h2 style={{ color: '#991b1b', margin: '0 0 1rem', fontSize: '1.1rem' }}>💙 {isTamil ? 'நாங்கள் உங்களுடன் இருக்கிறோம்' : "We're here for you"}</h2>
              <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 1.25rem' }}>{result.message}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {result.helplines.map((h) => (
                  <div key={h.number} style={{ background: '#fff', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{h.name}</div>
                      {h.note && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{h.note}</div>}
                    </div>
                    <a href={`tel:${h.number.replace(/\s/g, '')}`}
                      style={{ background: '#dc2626', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                      📞 {h.number}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Normal path */
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
              <p style={{ color: '#166534', fontSize: '0.95rem', lineHeight: 1.75, margin: '0 0 1.25rem', whiteSpace: 'pre-wrap' }}>{result.message}</p>

              {/* Always show helplines — NEET stress is real */}
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>
                  📞 {isTamil ? 'இலவச மனநல உதவி எண்கள் (எப்போதும் கிடைக்கும்)' : 'Free mental health helplines (always available)'}
                </summary>
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {result.helplines.map((h) => (
                    <div key={h.number} style={{ fontSize: '0.8rem', color: '#374151' }}>
                      <strong>{h.name}</strong>: <a href={`tel:${h.number.replace(/\s/g, '')}`} style={{ color: '#1d4ed8' }}>{h.number}</a>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          <button onClick={reset}
            style={{ width: '100%', padding: '0.65rem', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '8px', color: '#6b7280', cursor: 'pointer', fontSize: '0.9rem' }}>
            {isTamil ? 'மீண்டும் சரிபார்க்கவும்' : 'Check in again'}
          </button>
        </div>
      )}
    </div>
  );
}
