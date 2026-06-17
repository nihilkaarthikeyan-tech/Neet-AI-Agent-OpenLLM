import { useState, useEffect } from 'react';
import { GraduationCap, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

interface Scheme { name: string; eligibility: string; benefit: string; contact: string }
interface SimResult { govtMBBS: { likelihood: string; reason: string }; sfMBBS: { likelihood: string; reason: string }; quota75: { eligible: boolean; likelihood: string; reason: string }; collegeOptions?: { name: string; course: string; type: string; approxCutoff: number }[]; actionPoints: string[]; alliedPaths: string[] }

const LIKELIHOOD_COLOR: Record<string, string> = { High: '#059669', Medium: '#f59e0b', Low: '#f97316', Unlikely: '#dc2626' };
const CATEGORIES = ['General', 'OBC', 'BC_Muslim', 'SC', 'ST'] as const;

export default function CounsellingPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [tab, setTab] = useState<'sim' | 'info' | 'schemes'>('sim');
  const [score, setScore] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('General');
  const [isGovtSchool, setIsGovtSchool] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [openScheme, setOpenScheme] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ schemes: Scheme[] }>('/api/counselling/schemes').then((d) => setSchemes(d.schemes)).catch(() => {});
    api.get<Record<string, unknown>>('/api/counselling/info').then(setInfo).catch(() => {});
  }, []);

  const simulate = async () => {
    const s = parseInt(score);
    if (!s || s < 0 || s > 720) return;
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await api.post<{ simulation: SimResult }>('/api/counselling/simulate', { score: s, category, isGovtSchool, language: lang });
      setSimResult(res.simulation);
    } catch { setSimResult(null); }
    finally { setSimLoading(false); }
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', margin: '0 0 0.3rem' }}>
          <GraduationCap size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {isTa ? 'TN NEET ஆலோசனை | TN NEET Counselling' : 'TN NEET Counselling Guide'}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {isTa ? '7.5% இட ஒதுக்கீடு, TN கல்லூரி வாய்ப்புகள், இலவச திட்டங்கள்.' : '7.5% reservation, TN college simulator, free government schemes.'}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'sim',     label: isTa ? '🎯 கல்லூரி சிமுலேட்டர்' : '🎯 College Simulator' },
          { key: 'info',    label: isTa ? '📋 7.5% விவரங்கள்' : '📋 7.5% Reservation Info' },
          { key: 'schemes', label: isTa ? '💰 இலவச திட்டங்கள்' : '💰 Free Schemes' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, background: tab === t.key ? '#1d4ed8' : '#e5e7eb', color: tab === t.key ? '#fff' : '#374151' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SIMULATOR ── */}
      {tab === 'sim' && (
        <div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  {isTa ? 'உங்கள் NEET மதிப்பெண் (720 இல்)' : 'Your NEET Score (out of 720)'}
                </label>
                <input type="number" min="0" max="720" value={score} onChange={(e) => setScore(e.target.value)}
                  placeholder="e.g. 565"
                  style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  {isTa ? 'உங்கள் வகை (Category)' : 'Category'}
                </label>
                <select value={category} onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
                  style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: '1rem', padding: '0.75rem', background: '#fef9f0', borderRadius: '8px', border: '1px solid #fed7aa' }}>
              <input type="checkbox" checked={isGovtSchool} onChange={(e) => setIsGovtSchool(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400e' }}>
                  {isTa ? '✅ நான் அரசு பள்ளியில் படித்தேன் (7.5% ஒதுக்கீடு)' : '✅ I studied in a TN Government School (7.5% quota eligible)'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  {isTa ? 'வகுப்பு 6 முதல் 12 வரை அரசு பள்ளியில் படித்தீர்களா?' : 'Completed Classes 6–12 in a TN government school?'}
                </div>
              </div>
            </label>

            <button onClick={simulate} disabled={simLoading || !score}
              style={{ width: '100%', padding: '0.75rem', background: simLoading || !score ? '#9ca3af' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '1rem', cursor: simLoading || !score ? 'not-allowed' : 'pointer' }}>
              {simLoading ? (isTa ? 'பகுப்பாய்வு செய்கிறது…' : 'Analysing…') : (isTa ? 'என் வாய்ப்புகளைக் காட்டு →' : 'Show My Chances →')}
            </button>
          </div>

          {simResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Likelihood cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {[
                  { label: isTa ? 'MBBS — அரசு கல்லூரி' : 'MBBS — Govt College', data: simResult.govtMBBS },
                  { label: isTa ? 'MBBS — சுயநிதி' : 'MBBS — Self Finance', data: simResult.sfMBBS },
                  { label: isGovtSchool ? (isTa ? '7.5% ஒதுக்கீடு' : '7.5% Quota') : (isTa ? '7.5% (தகுதியில்லை)' : '7.5% (not eligible)'), data: simResult.quota75 },
                ].map((item) => (
                  <div key={item.label} style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `4px solid ${LIKELIHOOD_COLOR[item.data.likelihood] ?? '#9ca3af'}` }}>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>{item.label}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: LIKELIHOOD_COLOR[item.data.likelihood] ?? '#374151', marginBottom: '0.3rem' }}>{item.data.likelihood}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.data.reason}</div>
                  </div>
                ))}
              </div>

              {/* College options */}
              {simResult.collegeOptions && simResult.collegeOptions.length > 0 && (
                <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>{isTa ? 'நடைமுறை கல்லூரி வாய்ப்புகள்' : 'Realistic College Options'}</h3>
                  {simResult.collegeOptions.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
                      <span style={{ color: '#374151', fontWeight: 500 }}>{c.name} — {c.course}</span>
                      <span style={{ color: '#6b7280' }}>{c.type} · ~{c.approxCutoff}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action points */}
              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#166534' }}>{isTa ? 'உங்கள் செயல் திட்டங்கள்' : 'Your Action Points'}</h3>
                {simResult.actionPoints.map((a, i) => (
                  <p key={i} style={{ margin: '0 0 0.4rem', fontSize: '0.875rem', color: '#166534' }}>✅ {a}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 7.5% INFO ── */}
      {tab === 'info' && info && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(() => {
            const r = info.reservation75 as { title: string; description: string; keyFacts: string[]; cutoffs2024: Record<string, Record<string, number>> };
            return (
              <>
                <div style={{ background: '#fef9f0', border: '2px solid #fed7aa', borderRadius: '12px', padding: '1.5rem' }}>
                  <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: 700, color: '#92400e' }}>{r.title}</h2>
                  <p style={{ color: '#374151', fontSize: '0.875rem', lineHeight: 1.7, margin: '0 0 1rem' }}>{r.description}</p>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    {r.keyFacts.map((f, i) => <li key={i} style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.35rem', lineHeight: 1.5 }}>{f}</li>)}
                  </ul>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#374151' }}>{isTa ? '2024 தோராயமான கட்-ஆஃப்' : '2024 Approximate Cutoffs'}</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#374151', fontWeight: 700 }}>{isTa ? 'படிப்பு' : 'Course'}</th>
                          {Object.keys(Object.values(r.cutoffs2024)[0]).map((cat) => (
                            <th key={cat} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#374151', fontWeight: 700 }}>{cat}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(r.cutoffs2024).map(([course, cats]) => (
                          <tr key={course} style={{ borderTop: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#111827' }}>{course}</td>
                            {Object.values(cats).map((val, i) => (
                              <td key={i} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#374151' }}>{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── SCHEMES ── */}
      {tab === 'schemes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {schemes.map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <button onClick={() => setOpenScheme(openScheme === i ? null : i)}
                style={{ width: '100%', textAlign: 'left', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>{s.name}</span>
                {openScheme === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openScheme === i && (
                <div style={{ padding: '0 1.25rem 1.25rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}><strong>{isTa ? 'தகுதி:' : 'Eligibility:'}</strong> {s.eligibility}</p>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}><strong>{isTa ? 'பலன்:' : 'Benefit:'}</strong> {s.benefit}</p>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>{isTa ? 'தொடர்பு:' : 'Contact:'}</strong> {s.contact}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
