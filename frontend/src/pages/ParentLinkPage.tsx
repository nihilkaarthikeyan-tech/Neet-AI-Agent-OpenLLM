/**
 * ParentLinkPage — students set up a read-only parent dashboard.
 * They share the generated code with their parent; parent visits /parent/:code.
 */
import { useState, useEffect } from 'react';
import { Heart, Copy, Check, Loader2, Phone } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

export default function ParentLinkPage() {
  const { token } = useAuthStore();
  const [code, setCode] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/parent/my-link`, { headers });
        const data = await res.json() as { code: string | null; parentPhone?: string | null };
        setCode(data.code);
        if (data.parentPhone) setPhone(data.parentPhone);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setupLink() {
    setSaving(true); setMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/parent/setup`, { method: 'POST', headers: jsonHeaders, body: '{}' });
      const data = await res.json() as { code?: string; error?: string };
      if (data.code) setCode(data.code);
    } catch { setMsg('Failed to create link.'); }
    finally { setSaving(false); }
  }

  async function savePhone() {
    if (!phone.trim() || saving) return;
    setSaving(true); setMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/parent/phone`, {
        method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ phone: phone.trim() }),
      });
      if (res.ok) { setMsg('✅ Phone number saved!'); }
      else { const d = await res.json() as { error?: string }; setMsg(d.error ?? 'Failed.'); }
    } catch { setMsg('Failed to save phone.'); }
    finally { setSaving(false); }
  }

  function copyCode() {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const parentUrl = code ? `${window.location.origin}/parent/${code}` : '';

  const cardStyle: React.CSSProperties = { background: '#1e293b', borderRadius: '14px', padding: '24px' };
  const inputStyle: React.CSSProperties = { padding: '9px 14px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '14px', width: '100%', boxSizing: 'border-box' };

  return (
    <div className="page-container">
      <div className="page-header">
        <Heart size={28} className="page-icon" style={{ color: '#f43f5e' }} />
        <div>
          <h1 className="page-title">Parent Dashboard</h1>
          <p className="page-desc">Share a read-only view of your progress with your parent</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', padding: '24px 0' }}>
          <Loader2 size={20} className="spin" /> Loading…
        </div>
      ) : !code ? (
        <div style={cardStyle}>
          <p style={{ color: '#cbd5e1', marginBottom: '16px', lineHeight: 1.7 }}>
            Generate a unique access code. Share it with your parents — they visit the link to see your study progress, test scores, and active days. <strong style={{ color: '#a5b4fc' }}>No login needed for parents.</strong>
          </p>
          <button onClick={setupLink} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={14} className="spin" /> : <Heart size={14} />} Generate Parent Code
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Code card */}
          <div style={{ ...cardStyle, borderLeft: '4px solid #f43f5e' }}>
            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Your Parent Access Code</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
              <span style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '0.18em', color: '#e2e8f0', fontFamily: 'monospace' }}>{code}</span>
              <button onClick={copyCode}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: copied ? '#22c55e' : '#334155', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Or share the direct link:</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0f172a', borderRadius: '8px', padding: '10px 14px' }}>
              <span style={{ color: '#a5b4fc', fontSize: '13px', flex: 1, wordBreak: 'break-all' }}>{parentUrl}</span>
              <button onClick={() => { void navigator.clipboard.writeText(parentUrl); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}><Copy size={14} /></button>
            </div>
          </div>

          {/* What parents see */}
          <div style={cardStyle}>
            <p style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '12px' }}>What your parent will see</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {['✅ Tests taken & avg score', '🔥 Study streak', '📚 NCERT chapter progress', '📊 Subject-wise performance', '⏱ Active study days', '❓ Doubts asked this week'].map((item) => (
                <div key={item} style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#cbd5e1' }}>{item}</div>
              ))}
            </div>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '12px' }}>
              🔒 Read-only — your parent cannot change anything. No personal messages or chat history is shown.
            </p>
          </div>

          {/* Phone number */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Phone size={16} style={{ color: '#22c55e' }} />
              <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '14px' }}>Parent's Phone (optional)</p>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>Save for WhatsApp/SMS weekly report (coming soon)</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)}
                style={{ ...inputStyle, width: 'auto', flex: 1 }} />
              <button onClick={savePhone} disabled={saving || !phone.trim()}
                style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: saving || !phone.trim() ? 'not-allowed' : 'pointer', opacity: saving || !phone.trim() ? 0.6 : 1 }}>
                {saving ? <Loader2 size={14} className="spin" /> : 'Save'}
              </button>
            </div>
            {msg && <p style={{ fontSize: '13px', color: msg.startsWith('✅') ? '#22c55e' : '#f87171', marginTop: '8px' }}>{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
