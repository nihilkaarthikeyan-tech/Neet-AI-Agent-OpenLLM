import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, BookOpen, FlaskConical, Atom, Clock, Shield } from 'lucide-react';

export default function KioskPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'en' | 'ta'>('en');
  const isTa = lang === 'ta';

  const start = () => {
    sessionStorage.setItem('kiosk_start', Date.now().toString());
    sessionStorage.setItem('kiosk_lang', lang);
    navigate('/kiosk/session');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>

      {/* Language toggle */}
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', display: 'flex', gap: '6px' }}>
        {(['en', 'ta'] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)}
            style={{ padding: '5px 14px', borderRadius: '8px', border: `1px solid ${lang === l ? 'var(--accent)' : 'var(--border)'}`, fontWeight: 600, fontSize: '12px', cursor: 'pointer', background: lang === l ? 'var(--accent)' : 'var(--bg-surface)', color: lang === l ? '#fff' : 'var(--text-secondary)' }}>
            {l === 'en' ? '🇬🇧 English' : '🇮🇳 தமிழ்'}
          </button>
        ))}
      </div>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--accent)', borderRadius: '12px', padding: '10px', display: 'flex' }}>
          <BookOpen size={22} color="#fff" />
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>NEET AI</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            {isTa ? 'தமிழ்நாடு அரசு தளம்' : 'Tamil Nadu Govt. Platform'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '560px', width: '100%', textAlign: 'center' }}>
        {/* Kiosk badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, marginBottom: '1.5rem' }}>
          <Monitor size={13} />
          {isTa ? 'KIOSK / பகிரப்பட்ட சாதன பயன்முறை' : 'KIOSK / SHARED DEVICE MODE'}
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: '0.75rem' }}>
          {isTa ? 'கணக்கு இல்லாமல் படிக்கலாம்' : 'Study without an account'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          {isTa
            ? 'இந்த கணினியை விருந்தினர் படிப்பு அமர்வுக்கு பயன்படுத்துங்கள். தனிப்பட்ட தரவு சேமிக்கப்படவில்லை — நீங்கள் அமர்வை முடிக்கும்போது அல்லது தாவலை மூடும்போது எல்லாம் அழிக்கப்படும்.'
            : 'Use this computer for a guest study session. No personal data is stored — everything clears when you close the tab or click End Session.'}
        </p>

        {/* What's available */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
          {[
            { icon: <BookOpen size={20} />, label: isTa ? 'PYQ அட்டைகள்' : 'PYQ Flashcards', desc: isTa ? 'கடந்த NEET வினாக்கள் பயிற்சி' : 'Practice past NEET questions', color: '#7c3aed' },
            { icon: <FlaskConical size={20} />, label: isTa ? 'சொல்லகராதி' : 'Vocabulary', desc: isTa ? '600 NEET சொற்கள்' : 'Browse 600 NEET terms', color: '#059669' },
            { icon: <Atom size={20} />, label: isTa ? 'சூத்திர தாள்' : 'Formula Sheet', desc: isTa ? 'Physics & Chemistry குறிப்பு' : 'Quick reference for Physics & Chemistry', color: '#2563eb' },
          ].map(({ icon, label, desc, color }) => (
            <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', textAlign: 'left' }}>
              <div style={{ color, marginBottom: '6px' }}>{icon}</div>
              <p style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', margin: '0 0 2px' }}>{label}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Privacy note */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.75rem', textAlign: 'left' }}>
          <Shield size={15} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: '#059669' }}>{isTa ? 'உங்கள் தனியுரிமை பாதுகாக்கப்படுகிறது.' : 'Your privacy is protected.'}</strong>{' '}
            {isTa
              ? 'உள்நுழைவு தேவையில்லை. அமர்வு தரவு இந்த உலாவி தாவலில் மட்டுமே சேமிக்கப்படுகிறது — நீங்கள் அமர்வை முடிக்கும்போது அல்லது தாவலை மூடும்போது தானாக நீக்கப்படும்.'
              : 'No login required. Session data is stored only in this browser tab — it is deleted automatically when you end the session or close the tab.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={start} className="btn-primary" style={{ padding: '0.8rem 2.5rem', fontSize: '1rem' }}>
            {isTa ? 'விருந்தினர் அமர்வைத் தொடங்கு →' : 'Start Guest Session →'}
          </button>
          <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.8rem 1.5rem', borderRadius: '9px', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>
            {isTa ? 'கணக்கு உள்ளதா? உள்நுழையவும்' : 'Have an account? Sign in'}
          </a>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          <Clock size={12} />
          {isTa ? 'AI அம்சங்களுக்கு (tutor, photo doubt) இலவச கணக்கு தேவை' : 'AI features (tutor, photo doubt) require a free account'}
        </p>
      </div>
    </div>
  );
}
