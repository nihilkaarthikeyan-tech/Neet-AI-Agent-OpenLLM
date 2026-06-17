import { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, Lightbulb, X, ImageIcon } from 'lucide-react';
import { useLang } from '../lib/useLang';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

interface Solution {
  questionText: string;
  answer: string;
  steps: string[];
  concept: string;
  memoryTip: string;
  subject: string;
}

interface UsageData {
  usedToday: number;
  limit: number;
  remaining: number;
}

export default function PhotoDoubtPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subject, setSubject] = useState('Biology');
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subjects = ['Physics', 'Chemistry', 'Biology'];

  useEffect(() => {
    const token = localStorage.getItem('neet_token');
    if (!token) return;
    fetch(`${API_BASE}/api/photo-doubt/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: UsageData) => setUsage(d))
      .catch(() => {/* ignore */});
  }, []);

  const handleFile = (f: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Only JPEG, PNG, and WebP images are supported.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }
    setError('');
    setFile(f);
    setSolution(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const clearFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSolution(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const solve = async () => {
    if (!file) { setError('Please upload an image first.'); return; }
    setError('');
    setIsSolving(true);
    setSolution(null);

    const token = localStorage.getItem('neet_token');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('subject', subject);
    formData.append('language', lang);

    try {
      const res = await fetch(`${API_BASE}/api/photo-doubt/solve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: formData,
      });

      const data = await res.json() as { solution?: Solution; error?: string; remainingToday?: number };

      if (!res.ok) {
        setError(data.error ?? 'Failed to process image.');
        return;
      }

      setSolution(data.solution ?? null);
      // Update usage
      setUsage((prev) => prev
        ? { ...prev, usedToday: prev.usedToday + 1, remaining: Math.max(0, prev.remaining - 1) }
        : null
      );
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <Camera size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'புகைப்பட சந்தேக தீர்வி' : 'Photo Doubt Solver'}</h1>
          <p className="page-desc">{isTa ? 'எந்த கேள்வியையும் படம் எடுத்து பதிவேற்றுங்கள் — AI Vision உடனே தீர்க்கும்' : 'Snap or upload any question — AI Vision solves it instantly'}</p>
        </div>
      </div>

      {/* Usage badge */}
      {usage && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: usage.remaining === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${usage.remaining === 0 ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
          borderRadius: '100px', padding: '5px 14px', fontSize: '13px',
          color: usage.remaining === 0 ? '#ef4444' : '#10b981',
          fontWeight: 600, marginBottom: '24px',
        }}>
          <Camera size={13} />
          {usage.remaining}/{usage.limit} {isTa ? 'தீர்வுகள் இன்று மீதம்' : 'solves remaining today'}
        </div>
      )}

      <div className="responsive-grid-2">
        {/* Upload panel */}
        <div>
          <div className="auth-card panel-card" style={{ maxWidth: '100%', animation: 'none', marginBottom: '16px' }}>
            <h2 className="section-heading">{isTa ? 'கேள்வி படத்தை பதிவேற்று' : 'Upload Question Image'}</h2>

            {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}

            {/* Subject selector */}
            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>{isTa ? 'பாடம்' : 'Subject'}</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
                }}
              >
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Drop zone */}
            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--accent-bright)' : 'var(--border)'}`,
                  borderRadius: '12px', padding: '40px 20px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                  cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
                  background: isDragging ? 'rgba(139,92,246,0.05)' : 'var(--bg-elevated)',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(139,92,246,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={24} style={{ color: '#8b5cf6' }} />
                </div>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{isTa ? 'படத்தை இங்கே இடுங்கள் அல்லது கிளிக் செய்யுங்கள்' : 'Drop image here or click to browse'}</p>
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>{isTa ? 'JPEG, PNG, WebP — அதிகபட்சம் 5 MB' : 'JPEG, PNG, WebP — max 5 MB'}</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img
                  src={preview!}
                  alt="Uploaded question"
                  style={{ width: '100%', borderRadius: '10px', border: '1px solid var(--border)', maxHeight: '320px', objectFit: 'contain', background: '#000' }}
                />
                <button
                  onClick={clearFile}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}
                >
                  <X size={14} />
                </button>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                  {file.name} — {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            )}

            <button
              className="btn-primary"
              onClick={solve}
              disabled={isSolving || !file || (usage?.remaining === 0)}
              style={{ marginTop: '16px', padding: '10px 24px', width: '100%' }}
            >
              {isSolving
                ? <><Loader2 size={15} className="spin" /> {isTa ? 'படத்தை பகுப்பாய்வு செய்கிறது (5–10வி)...' : 'Analyzing image (5–10s)...'}</>
                : usage?.remaining === 0
                  ? (isTa ? 'தினசரி வரம்பு எட்டப்பட்டது' : 'Daily limit reached')
                  : <><Camera size={15} /> {isTa ? 'AI Vision மூலம் தீர்' : 'Solve with AI Vision'}</>}
            </button>
          </div>

          {/* Tips */}
          <div className="auth-card panel-card" style={{ maxWidth: '100%', animation: 'none' }}>
            <h2 className="section-heading" style={{ marginBottom: '12px' }}>{isTa ? 'புகைப்பட குறிப்புகள்' : 'Photo Tips'}</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', listStyle: 'none' }}>
              {(isTa ? [
                'கேள்வி உரை தெளிவாகவும் நல்ல வெளிச்சத்திலும் தெரியும்படி பார்த்துக்கொள்ளுங்கள்',
                'கேள்வியை சுற்றி நெருக்கமாக crop செய்யுங்கள் — குறைவான background = சிறந்த துல்லியம்',
                'படங்களுக்கு, முழு உருவத்தையும் labels-ஐயும் சேர்க்கவும்',
                'மங்கலாக இருந்தால், கேள்வியை PYQ தீர்வியில் தட்டச்சு செய்து முயற்சிக்கவும்',
              ] : [
                'Ensure the question text is clearly visible and well-lit',
                'Crop tightly around the question — less background = better accuracy',
                'For diagrams, include the full figure and labels',
                'If blurry, try typing the question in the PYQ solver instead',
              ]).map((tip, i) => (
                <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#94a3b8', alignItems: 'flex-start' }}>
                  <Lightbulb size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Solution panel */}
        <div>
          {!solution && !isSolving && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '300px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '16px', gap: '12px', color: '#475569',
            }}>
              <ImageIcon size={40} />
              <p style={{ fontSize: '14px' }}>{isTa ? 'தீர்வை இங்கே பார்க்க படத்தை பதிவேற்றுங்கள்' : 'Upload an image to see the solution here'}</p>
            </div>
          )}

          {isSolving && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '300px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '16px', gap: '16px',
            }}>
              <Loader2 size={36} className="spin" style={{ color: '#8b5cf6' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 600 }}>{isTa ? 'AI உங்கள் படத்தைப் படிக்கிறது...' : 'AI is reading your image...'}</p>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>{isTa ? 'இது பொதுவாக 5–10 விநாடிகள் ஆகும்' : 'This usually takes 5–10 seconds'}</p>
              </div>
            </div>
          )}

          {solution && (
            <div className="auth-card solution-card panel-card" style={{ maxWidth: '100%', animation: 'none' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>{isTa ? 'AI தீர்வு' : 'AI Solution'}</h2>

              {/* Detected question */}
              {solution.questionText && solution.questionText !== 'Image unclear' && (
                <div style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
                }}>
                  <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>{isTa ? 'கண்டறிந்த கேள்வி' : 'Detected Question'}</p>
                  <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.6 }}>{solution.questionText}</p>
                </div>
              )}

              {/* Answer */}
              <div style={{
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: '10px', padding: '14px 18px', marginBottom: '20px',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{isTa ? 'சரியான விடை' : 'Correct Answer'}</p>
                  <p style={{ fontSize: '16px', fontWeight: 700 }}>{solution.answer}</p>
                </div>
              </div>

              {/* Steps */}
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{isTa ? 'படிப்படியாக' : 'Step-by-Step'}</h3>
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
                  borderRadius: '8px', padding: '12px 16px', marginBottom: '12px',
                }}>
                  <p style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{isTa ? 'முக்கிய கருத்து' : 'Key Concept'}</p>
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
                    <p style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{isTa ? 'நினைவு குறிப்பு' : 'Memory Tip'}</p>
                    <p style={{ fontSize: '13px', color: '#e2e8f0' }}>{solution.memoryTip}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
