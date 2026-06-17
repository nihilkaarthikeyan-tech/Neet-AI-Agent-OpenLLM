import { useState, useEffect } from 'react';
import { Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import MarkdownText from '../components/MarkdownText';

interface CareerPath { name: string; duration: string; seats: string; neetRequired: boolean; avgSalary: string; description: string }
interface CareerCategory { category: string; paths: CareerPath[] }

export default function CareerPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [paths, setPaths] = useState<CareerCategory[]>([]);
  const [openCat, setOpenCat] = useState<string | null>('Medical');
  const [score, setScore] = useState('');
  const [interests, setInterests] = useState('');
  const [guide, setGuide] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ paths: CareerCategory[] }>('/api/career/paths').then((d) => setPaths(d.paths)).catch(() => {});
  }, []);

  const getGuide = async () => {
    const s = parseInt(score);
    if (!s) return;
    setLoading(true);
    setGuide('');
    try {
      const res = await api.post<{ guide: string }>('/api/career/guide', {
        score: s,
        interests: interests.split(',').map((i) => i.trim()).filter(Boolean),
        language: lang,
      });
      setGuide(res.guide);
    } catch { setGuide(isTa ? 'வழிகாட்டுதலை ஏற்ற முடியவில்லை. கீழே உள்ள வாழ்க்கை பாதைகளைப் பார்க்கவும்.' : 'Could not load guidance. Please see career paths below.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', margin: '0 0 0.3rem' }}>
          <Briefcase size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {isTa ? 'உங்கள் வாழ்க்கை பாதை | Career Paths Beyond MBBS' : 'Career Paths Beyond MBBS'}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {isTa ? 'MBBS மட்டும் மருத்துவ துறை அல்ல. உங்கள் Biology+Chemistry அறிவிற்கு பல வாய்ப்புகள் உள்ளன.' : 'Your Biology + Chemistry knowledge opens many healthcare careers — MBBS is just one door.'}
        </p>
      </div>

      {/* Personalised guide */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#0c4a6e' }}>
          {isTa ? 'உங்களுக்கான வழிகாட்டுதல்' : 'Get Personalised Career Guidance'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{isTa ? 'NEET மதிப்பெண் (0–720)' : 'NEET Score (0–720)'}</label>
            <input type="number" min="0" max="720" value={score} onChange={(e) => setScore(e.target.value)} placeholder={isTa ? 'எ.கா. 480' : 'e.g. 480'}
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{isTa ? 'ஆர்வங்கள் (விரும்பினால்)' : 'Interests (optional)'}</label>
            <input type="text" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder={isTa ? 'எ.கா. நோயாளிகளுக்கு உதவுதல், ஆராய்ச்சி, தொழில்நுட்பம்' : 'e.g. helping patients, research, tech'}
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
        </div>
        <button onClick={getGuide} disabled={loading || !score}
          style={{ padding: '0.65rem 1.5rem', background: loading || !score ? '#9ca3af' : '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: loading || !score ? 'not-allowed' : 'pointer' }}>
          {loading ? (isTa ? 'வழிகாட்டுதல் வருகிறது…' : 'Getting guidance…') : isTa ? 'வழிகாட்டுதல் பெறுக →' : 'Get Guidance →'}
        </button>
        {guide && (
          <MarkdownText content={guide} style={{ marginTop: '1rem', padding: '1rem', background: '#fff', borderRadius: '8px', fontSize: '0.875rem', color: '#374151' }} />
        )}
      </div>

      {/* Career paths */}
      {paths.map((cat) => (
        <div key={cat.category} style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem', overflow: 'hidden' }}>
          <button onClick={() => setOpenCat(openCat === cat.category ? null : cat.category)}
            style={{ width: '100%', textAlign: 'left', padding: '1.1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>{cat.category}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{cat.paths.length} {isTa ? 'பாதைகள்' : 'paths'}</span>
              {openCat === cat.category ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>
          {openCat === cat.category && (
            <div style={{ borderTop: '1px solid #f3f4f6' }}>
              {cat.paths.map((p) => (
                <div key={p.name} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f9fafb', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>{p.name}</span>
                      {!p.neetRequired && <span style={{ fontSize: '0.68rem', background: '#dcfce7', color: '#166534', borderRadius: '99px', padding: '0.1rem 0.5rem', fontWeight: 700 }}>{isTa ? 'NEET கட்-ஆஃப் இல்லை' : 'No NEET cutoff'}</span>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.25rem' }}>{p.description}</div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{p.duration} · {p.seats}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>{p.avgSalary}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{isTa ? 'சராசரி சம்பளம்' : 'avg salary'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
