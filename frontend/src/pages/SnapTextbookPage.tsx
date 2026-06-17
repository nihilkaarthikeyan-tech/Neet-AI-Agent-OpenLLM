import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../lib/useLang';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

interface SnapResult {
  extractedText: string; subject: string; topic: string;
  samacheerContent: string; neetRelevance: string;
  extraNcertConcepts: string[];
  neetQuestions: { q: string; a: string }[];
  memoryTips: string[];
}

export default function SnapTextbookPage() {
  const { token } = useAuthStore();
  const lang = useLang();
  const isTa = lang === 'ta';
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<SnapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openQ, setOpenQ] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f); setResult(null); setError('');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const analyse = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('language', lang);
      const res = await fetch(`${API_BASE}/api/snap/analyse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: form,
      });
      const data = await res.json() as { result?: SnapResult; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to analyse');
      setResult(data.result!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Try a clearer photo.');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-container" style={{ maxWidth: '820px' }}>
      <div className="page-header">
        <Camera size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'சமச்சீர் புத்தக OCR | Snap Textbook' : 'Snap a Textbook Page'}</h1>
          <p className="page-desc">
            {isTa
              ? 'உங்கள் சமச்சீர் கல்வி புத்தகத்தின் பக்கத்தை புகைப்படம் எடுங்கள் → NEET விளக்கம் பெறுங்கள்'
              : 'Photograph any Samacheer Kalvi page → instant NEET-aligned explanation + bridge to NCERT'}
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div className="feature-card" style={{ marginBottom: '1.5rem' }}>
        {!preview ? (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '3rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <Upload size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {isTa ? 'புத்தக பக்கத்தை பதிவேற்றுங்கள்' : 'Upload or drop your textbook page'}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isTa ? 'JPEG, PNG, WebP · 8MB வரை' : 'JPEG, PNG, WebP · up to 8MB'}
            </p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <img src={preview} alt="Textbook page" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '10px', background: '#f9fafb' }} />
            <button onClick={() => { setFile(null); setPreview(null); setResult(null); }}
              style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {file && !loading && (
          <button onClick={analyse} className="btn-primary" style={{ marginTop: '1rem', fontSize: '1rem' }}>
            {isTa ? '🔍 NEET பகுப்பாய்வு செய்' : '🔍 Analyse for NEET →'}
          </button>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <Loader2 size={18} className="spin" />
            {isTa ? 'பக்கத்தை படித்து NEET உடன் பொருத்துகிறது…' : 'Reading your page and mapping to NEET…'}
          </div>
        )}

        {error && <p style={{ color: '#dc2626', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Detected */}
          <div className="feature-card feature-card--accent">
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '6px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>{result.subject}</span>
              <span style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', borderRadius: '6px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>{result.topic}</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              {isTa ? 'கண்டுபிடிக்கப்பட்ட உள்ளடக்கம்:' : 'Detected content:'} {result.extractedText.slice(0, 200)}…
            </p>
          </div>

          {/* Samacheer vs NEET */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="feature-card feature-card--warning">
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', margin: '0 0 0.5rem' }}>
                📚 {isTa ? 'சமச்சீர் கல்வி' : 'What Samacheer teaches'}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{result.samacheerContent}</p>
            </div>
            <div className="feature-card feature-card--accent">
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3730a3', margin: '0 0 0.5rem' }}>
                🎯 {isTa ? 'NEET என்ன கேட்கிறது' : 'What NEET tests here'}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{result.neetRelevance}</p>
            </div>
          </div>

          {/* Extra NCERT concepts */}
          {result.extraNcertConcepts.length > 0 && (
            <div className="feature-card feature-card--danger">
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#991b1b', margin: '0 0 0.75rem' }}>
                ➕ {isTa ? 'NEET கேட்கும், சமச்சீரில் இல்லாத கருத்துக்கள்' : 'Extra NCERT concepts NEET tests (NOT in your Samacheer page)'}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {result.extraNcertConcepts.map((c, i) => (
                  <span key={i} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '99px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* NEET questions */}
          <div className="feature-card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
              ❓ {isTa ? 'இந்த பக்கத்திலிருந்து NEET கேள்விகள்' : 'NEET questions from this page'}
            </h3>
            {result.neetQuestions.map((q, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '0.5rem', overflow: 'hidden' }}>
                <button onClick={() => setOpenQ(openQ === i ? null : i)}
                  style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'var(--bg-base)', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Q{i + 1}. {q.q}
                </button>
                {openQ === i && (
                  <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', fontSize: '0.875rem', color: '#166534', lineHeight: 1.6 }}>
                    <strong>{isTa ? 'விடை:' : 'Answer:'}</strong> {q.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Memory tips */}
          {result.memoryTips.length > 0 && (
            <div className="feature-card feature-card--success">
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065f46', margin: '0 0 0.5rem' }}>
                💡 {isTa ? 'தேர்வு நாளுக்கான நினைவு குறிப்புகள்' : 'Memory tips for exam day'}
              </h3>
              {result.memoryTips.map((tip, i) => (
                <p key={i} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0.3rem 0', lineHeight: 1.6 }}>✅ {tip}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
