import { useState } from 'react';
import { TrendingUp, School, BookOpen, Trophy, AlertCircle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

type Category = 'OC' | 'OBC' | 'SC' | 'ST';
type Tab = 'rank' | 'colleges' | 'cutoffs';

interface RankResult {
  aiRank: { min: number; max: number };
  categoryRank: { min: number; max: number };
  tnRank: { min: number; max: number };
  qualifies: boolean;
  band: string;
  score: number;
  category: string;
  isGovtSchool: boolean;
}

interface College {
  name: string;
  seats: number;
  cutoffs: Record<Category, number>;
  govtBonus: number;
}

interface CollegeResult {
  likely: College[];
  possible: College[];
  reach: College[];
  isGovtSchool: boolean;
}

interface CutoffRow {
  year: number;
  qualifyOC: number; qualifyOBC: number; qualifySC: number; qualifyST: number;
  tnOC: number; tnOBC: number; tnSC: number; tnST: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function rankLabel(min: number, max: number) {
  return `${min.toLocaleString('en-IN')} – ${max.toLocaleString('en-IN')}`;
}

function CollegeCard({ college, category, isGovtSchool, bucket }: {
  college: College; category: Category; isGovtSchool: boolean; bucket: 'likely' | 'possible' | 'reach';
}) {
  const effectiveCutoff = college.cutoffs[category] - (isGovtSchool ? college.govtBonus : 0);
  const colors = { likely: '#22c55e', possible: '#f59e0b', reach: '#6366f1' };
  const labels = { likely: 'Likely', possible: 'Possible', reach: 'Reach' };
  return (
    <div style={{ background: '#0f172a', borderRadius: '10px', padding: '14px 16px', borderLeft: `3px solid ${colors[bucket]}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px', margin: 0 }}>{college.name}</p>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{college.seats} MBBS seats</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: colors[bucket], background: `${colors[bucket]}22`, padding: '2px 8px', borderRadius: '20px' }}>{labels[bucket]}</span>
          <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Cutoff ~{effectiveCutoff}</p>
          {isGovtSchool && <p style={{ color: '#f59e0b', fontSize: '11px' }}>7.5% quota: −{college.govtBonus}</p>}
        </div>
      </div>
    </div>
  );
}

export default function RankPredictorPage() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<Tab>('rank');

  // Shared inputs
  const [score, setScore] = useState('');
  const [category, setCategory] = useState<Category>('OC');
  const [isGovtSchool, setIsGovtSchool] = useState(false);

  // Results
  const [rankResult, setRankResult] = useState<RankResult | null>(null);
  const [collegeResult, setCollegeResult] = useState<CollegeResult | null>(null);
  const [cutoffs, setCutoffs] = useState<CutoffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  async function predictRank() {
    const s = Number(score);
    if (isNaN(s) || s < 0 || s > 720) { setError('Enter a valid score (0–720).'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rank-predictor/predict`, {
        method: 'POST', headers, body: JSON.stringify({ score: s, category, isGovtSchool }),
      });
      const data = await res.json() as RankResult;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed');
      setRankResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  async function predictColleges() {
    const s = Number(score);
    if (isNaN(s) || s < 0 || s > 720) { setError('Enter a valid score (0–720).'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rank-predictor/colleges`, {
        method: 'POST', headers, body: JSON.stringify({ score: s, category, isGovtSchool }),
      });
      const data = await res.json() as CollegeResult;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed');
      setCollegeResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  async function loadCutoffs() {
    if (cutoffs.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rank-predictor/cutoffs`, { headers });
      const data = await res.json() as { cutoffs?: CutoffRow[] };
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to load cutoffs');
      setCutoffs(data.cutoffs ?? []);
    } catch { setError('Failed to load cutoff history.'); }
    finally { setLoading(false); }
  }

  // Load cutoffs when tab changes
  const handleTab = (t: Tab) => {
    setTab(t); setError('');
    if (t === 'cutoffs') void loadCutoffs();
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'rank',    label: 'Rank Predictor',    icon: <TrendingUp size={15} /> },
    { id: 'colleges', label: 'TN College Finder', icon: <School size={15} /> },
    { id: 'cutoffs', label: 'Cut-off History',   icon: <BookOpen size={15} /> },
  ];

  const CATEGORIES: Category[] = ['OC', 'OBC', 'SC', 'ST'];

  // Shared score + category inputs
  const InputPanel = ({ onSubmit, btnLabel }: { onSubmit: () => void; btnLabel: string }) => (
    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>YOUR NEET SCORE (0–720)</label>
          <input
            type="number" min={0} max={720} value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="e.g. 580"
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '16px', width: '160px', fontWeight: 700 }}
          />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>CATEGORY</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                style={{ padding: '9px 14px', borderRadius: '8px', border: `1.5px solid ${category === c ? '#6366f1' : '#334155'}`, background: category === c ? 'rgba(99,102,241,0.15)' : 'transparent', color: category === c ? '#a5b4fc' : '#94a3b8', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '2px' }}>
          <input type="checkbox" id="govtSchool" checked={isGovtSchool} onChange={(e) => setIsGovtSchool(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          <label htmlFor="govtSchool" style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600, cursor: 'pointer' }}>
            7.5% Govt School Quota
          </label>
        </div>
        <button onClick={onSubmit} disabled={loading}
          style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Calculating…' : btnLabel}
        </button>
      </div>
      {isGovtSchool && (
        <p style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
          7.5% horizontal reservation for TN government school students — cutoff effectively lowered by 18–26 marks.
        </p>
      )}
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <TrendingUp size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Rank & College Predictor</h1>
          <p className="page-desc">Predict your NEET rank and find reachable TN medical colleges</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', background: '#1e293b', padding: '6px', borderRadius: '10px', width: 'fit-content' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => handleTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#6366f1' : 'transparent', color: tab === t.id ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Tab: Rank Predictor ── */}
      {tab === 'rank' && (
        <>
          <InputPanel onSubmit={predictRank} btnLabel="Predict Rank" />

          {rankResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Qualification status */}
              <div style={{ background: rankResult.qualifies ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${rankResult.qualifies ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {rankResult.qualifies
                  ? <><CheckCircle size={20} style={{ color: '#22c55e' }} /><span style={{ color: '#86efac', fontWeight: 600 }}>You qualify for NEET counselling! Score {rankResult.score} ≥ {rankResult.category} cutoff.</span></>
                  : <><AlertCircle size={20} style={{ color: '#ef4444' }} /><span style={{ color: '#fca5a5', fontWeight: 600 }}>Score {rankResult.score} is below the qualifying cutoff for {rankResult.category}. Keep preparing!</span></>
                }
              </div>

              {/* Rank cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {[
                  { label: 'All India Rank', range: rankResult.aiRank, color: '#6366f1', icon: '🇮🇳' },
                  { label: `${rankResult.category} Category Rank`, range: rankResult.categoryRank, color: '#f59e0b', icon: '📋' },
                  { label: 'TN State Rank', range: rankResult.tnRank, color: '#22c55e', icon: '🏛️' },
                ].map((card) => (
                  <div key={card.label} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', borderTop: `3px solid ${card.color}` }}>
                    <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{card.icon} {card.label}</p>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: card.color }}>{rankLabel(card.range.min, card.range.max)}</p>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center' }}>
                * Estimates based on 2020–2024 historical data. Actual ranks depend on exam difficulty, number of candidates, and NTA normalisation.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Tab: TN College Finder ── */}
      {tab === 'colleges' && (
        <>
          <InputPanel onSubmit={predictColleges} btnLabel="Find Colleges" />

          {collegeResult && (() => {
            const total = collegeResult.likely.length + collegeResult.possible.length + collegeResult.reach.length;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {total === 0 && (
                  <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    <Trophy size={36} style={{ marginBottom: '8px', opacity: 0.4 }} />
                    <p>No TN government colleges found in range. Consider aiming higher or look at private/deemed colleges.</p>
                  </div>
                )}
                {[
                  { key: 'likely' as const, label: 'Safe Picks (Score ≥ cutoff + 20)', color: '#22c55e', colleges: collegeResult.likely },
                  { key: 'possible' as const, label: 'Within Range (Score ≥ cutoff)', color: '#f59e0b', colleges: collegeResult.possible },
                  { key: 'reach' as const, label: 'Stretch Goals (Score within 30 of cutoff)', color: '#6366f1', colleges: collegeResult.reach },
                ].map(({ key, label, color, colleges }) => colleges.length > 0 && (
                  <div key={key}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                      {label} ({colleges.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {colleges.map((c) => (
                        <CollegeCard key={c.name} college={c} category={category} isGovtSchool={collegeResult.isGovtSchool} bucket={key} />
                      ))}
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center' }}>
                  * Cutoffs are approximate (2023/2024 data). TN counselling uses state merit list and reservation rules.
                </p>
              </div>
            );
          })()}
        </>
      )}

      {/* ── Tab: Cut-off History ── */}
      {tab === 'cutoffs' && (
        <div>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
            NEET qualifying cutoffs (minimum to enter counselling) and TN state MBBS admission cutoffs by year.
          </p>

          {loading && <p style={{ color: '#64748b' }}>Loading…</p>}

          {cutoffs.length > 0 && (
            <>
              {/* Qualifying cutoff table */}
              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '16px', overflowX: 'auto' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={15} style={{ color: '#22c55e' }} /> NEET Qualifying Cutoff (Min. score to sit counselling)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      {['Year', 'OC', 'OBC', 'SC', 'ST'].map((h) => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #334155' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cutoffs.map((row) => (
                      <tr key={row.year}>
                        <td style={{ padding: '8px 14px', color: '#e2e8f0', fontWeight: 700 }}>{row.year}</td>
                        {(['qualifyOC', 'qualifyOBC', 'qualifySC', 'qualifyST'] as const).map((k) => (
                          <td key={k} style={{ padding: '8px 14px', color: '#a5b4fc' }}>{row[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TN admission cutoff table */}
              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <School size={15} style={{ color: '#f59e0b' }} /> TN State MBBS Admission Cutoff (Govt colleges, approx.)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      {['Year', 'OC', 'OBC', 'SC', 'ST'].map((h) => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #334155' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cutoffs.map((row) => (
                      <tr key={row.year}>
                        <td style={{ padding: '8px 14px', color: '#e2e8f0', fontWeight: 700 }}>{row.year}</td>
                        {(['tnOC', 'tnOBC', 'tnSC', 'tnST'] as const).map((k) => (
                          <td key={k} style={{ padding: '8px 14px', color: '#fbbf24' }}>{row[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: '12px', color: '#475569', marginTop: '12px' }}>
                  * TN admission cutoffs are approximate averages across major govt medical colleges. Actual cutoffs vary by college and reservation category.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Unused import workaround */}
      <span style={{ display: 'none' }}><ChevronDown size={1} /><ChevronRight size={1} /></span>
    </div>
  );
}
