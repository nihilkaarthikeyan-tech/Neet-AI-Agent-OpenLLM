import { useEffect, useState } from 'react';
import { TrendingUp, Target, AlertTriangle, CheckCircle, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

interface ProgressPoint { index: number; date: string; subject: string; scaledTo720: number; trendScore: number; percentage: number }
interface HeatmapTopic { topic: string; accuracy: number; attempted: number; dominantError: string | null }
interface HeatmapSubject { subject: string; topics: HeatmapTopic[] }
interface Predictor { predicted: number; projected30d: number; trend: string; gap: number; gapMessage: string; targetScore: number; seatAssessment: Record<string, { cutoff: number; likely: boolean; close: boolean }> }
interface GapItem { subject: string; topic: string; accuracy: number; marksLost: number; wrong: number }
interface DistrictRank { available: boolean; district?: string; myScore?: number; percentile?: number; totalInDistrict?: number; message: string }

const SUBJECT_COLOR: Record<string, string> = { Biology: '#059669', Chemistry: '#7c3aed', Physics: '#1d4ed8' };

function accuracyColor(acc: number) {
  if (acc >= 75) return '#059669';
  if (acc >= 50) return '#f59e0b';
  if (acc >= 25) return '#f97316';
  return '#dc2626';
}

// Simple SVG line chart — no external library needed
function LineChart({ points }: { points: ProgressPoint[] }) {
  if (points.length < 2) return <p style={{ color: '#9ca3af', fontSize: '0.875rem', padding: '1rem' }}>Take at least 2 tests to see your improvement graph.</p>;
  const W = 600; const H = 180; const PAD = 40;
  const scores = points.map((p) => p.trendScore);
  const minS = Math.max(0, Math.min(...scores) - 30);
  const maxS = Math.min(720, Math.max(...scores) + 30);
  const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = (s: number) => H - PAD - ((s - minS) / (maxS - minS)) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.trendScore)}`).join(' ');
  const rawPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.scaledTo720)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '180px' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = PAD + t * (H - PAD * 2);
        const score = Math.round(maxS - t * (maxS - minS));
        return (
          <g key={t}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{score}</text>
          </g>
        );
      })}
      {/* Raw score dots (faint) */}
      <path d={rawPath} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />
      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.scaledTo720)} r="3" fill={SUBJECT_COLOR[p.subject] ?? '#6b7280'} opacity="0.6">
          <title>{p.date}: {p.scaledTo720}/720 ({p.subject})</title>
        </circle>
      ))}
      {/* Trend line (bold) */}
      <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Trend dots */}
      {points.map((p, i) => (
        <circle key={`t${i}`} cx={toX(i)} cy={toY(p.trendScore)} r="4" fill="#1d4ed8">
          <title>Trend: {p.trendScore}/720</title>
        </circle>
      ))}
    </svg>
  );
}

export default function ProgressPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [tab, setTab] = useState<'graph' | 'heatmap' | 'predictor' | 'gap'>('graph');
  const [summary, setSummary]   = useState<{ points: ProgressPoint[]; improvement: number | null; latestEstimate: number | null; totalTests: number } | null>(null);
  const [heatmap, setHeatmap]   = useState<{ heatmap: HeatmapSubject[] } | null>(null);
  const [predictor, setPredictor] = useState<Predictor | null>(null);
  const [gaps, setGaps]         = useState<{ gaps: GapItem[]; totalMarksAvailable: number } | null>(null);
  const [districtRank, setDistrictRank] = useState<DistrictRank | null>(null);
  const [loading, setLoading]   = useState(true);
  const [targetInput, setTargetInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<typeof summary>('/api/progress/summary'),
      api.get<typeof heatmap>('/api/progress/heatmap'),
      api.get<typeof predictor>('/api/progress/predictor'),
      api.get<typeof gaps>('/api/progress/gap-closer'),
      api.get<DistrictRank>('/api/progress/district-rank').catch(() => null),
    ]).then(([s, h, p, g, d]) => { setSummary(s); setHeatmap(h); setPredictor(p as Predictor); setGaps(g); setDistrictRank(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveTarget = async () => {
    const val = parseInt(targetInput);
    if (!val || val < 100 || val > 720) return;
    setSavingTarget(true);
    await api.post('/api/progress/profile', { targetScore: val }).catch(() => {});
    const p = await api.get<Predictor>('/api/progress/predictor').catch(() => null);
    if (p) setPredictor(p);
    setSavingTarget(false);
    setTargetInput('');
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading your progress…</div>;

  const tabs = [
    { key: 'graph',     label: isTa ? '📈 வளர்ச்சி வரைபடம்' : '📈 Improvement Graph' },
    { key: 'heatmap',   label: isTa ? '🔥 பலவீன வரைபடம்'  : '🔥 Weakness Heatmap' },
    { key: 'predictor', label: isTa ? '🎯 மதிப்பெண் கணிப்பு' : '🎯 Score Predictor' },
    { key: 'gap',       label: isTa ? '⚠️ 720 இடைவெளி'     : '⚠️ 720 Gap Closer' },
  ] as const;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', margin: '0 0 0.3rem' }}>
          <TrendingUp size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {isTa ? 'உங்கள் முன்னேற்ற பகுப்பாய்வு | Your Progress' : 'Progress & Intelligence Dashboard'}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {isTa ? 'உங்கள் மதிப்பெண் வளர்ச்சி, பலவீன பகுதிகள் மற்றும் 720/720 இலக்கு.' : 'Your score trajectory, weakness heatmap, and path to 720/720.'}
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: isTa ? 'மொத்த தேர்வுகள்' : 'Tests Taken', value: summary?.totalTests ?? 0 },
          { label: isTa ? 'தற்போதைய மதிப்பீடு' : 'Current Estimate', value: summary?.latestEstimate ? `${summary.latestEstimate}/720` : 'N/A' },
          { label: isTa ? 'மேம்பாடு' : 'Improvement', value: summary?.improvement != null ? `+${summary.improvement} pts` : 'N/A' },
          { label: isTa ? 'இலக்கு மதிப்பெண்' : 'Target Score', value: predictor?.targetScore ? `${predictor.targetScore}/720` : 'Not set' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* District rank banner */}
      {districtRank?.available ? (
        <div style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(16,185,129,0.04))', border: '1px solid rgba(5,150,105,0.25)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <MapPin size={18} style={{ color: '#059669', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#065f46' }}>
              {isTa
                ? `${districtRank.district} மாவட்டத்தில் ${districtRank.percentile}% மாணவர்களை முன்னிட்டீர்கள்`
                : `Top ${100 - (districtRank.percentile ?? 0)}% in ${districtRank.district}`}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>{districtRank.message}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', lineHeight: 1 }}>{districtRank.percentile}%</div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{isTa ? 'மாவட்ட தரவரிசை' : 'district percentile'}</div>
          </div>
        </div>
      ) : districtRank && !districtRank.available && (
        <div style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '0.75rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <MapPin size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {districtRank.message}{' '}
            <a href="/dashboard/progress" style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); void api.post('/api/progress/profile', { district: prompt(isTa ? 'உங்கள் மாவட்டம்?' : 'Enter your district (e.g. Chennai, Madurai):') ?? '' }); }}>
              {isTa ? 'மாவட்டம் அமை →' : 'Set district →'}
            </a>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, background: tab === t.key ? '#1d4ed8' : '#e5e7eb', color: tab === t.key ? '#fff' : '#374151' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GRAPH TAB ── */}
      {tab === 'graph' && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>
            {isTa ? 'தேர்வு மதிப்பெண் வரலாறு (720 மதிப்பில்)' : 'Test Score History (scaled to 720)'}
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 1rem' }}>
            {isTa ? 'நீல கோடு = போக்கு சராசரி. வண்ண புள்ளிகள் = உண்மையான மதிப்பெண்.' : 'Blue line = rolling trend. Coloured dots = actual scores by subject.'}
          </p>
          <LineChart points={summary?.points ?? []} />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {Object.entries(SUBJECT_COLOR).map(([s, c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
                {s}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
              <div style={{ width: '20px', height: '2px', background: '#1d4ed8' }} />
              {isTa ? 'போக்கு' : 'Trend'}
            </div>
          </div>
        </div>
      )}

      {/* ── HEATMAP TAB ── */}
      {tab === 'heatmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {heatmap?.heatmap.length === 0 && <p style={{ color: '#9ca3af' }}>Take some tests to see your heatmap.</p>}
          {heatmap?.heatmap.map((sub) => (
            <div key={sub.subject} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: SUBJECT_COLOR[sub.subject] ?? '#374151' }}>
                {sub.subject}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sub.topics.slice(0, 8).map((t) => (
                  <div key={t.topic}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#374151' }}>{t.topic}</span>
                      <span style={{ fontSize: '0.78rem', color: accuracyColor(t.accuracy), fontWeight: 700 }}>{t.accuracy}% ({t.attempted} Qs)</span>
                    </div>
                    <div style={{ height: '7px', background: '#f3f4f6', borderRadius: '99px' }}>
                      <div style={{ height: '100%', borderRadius: '99px', background: accuracyColor(t.accuracy), width: `${t.accuracy}%`, transition: 'width 0.6s' }} />
                    </div>
                    {t.dominantError && <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.15rem' }}>Main error: {t.dominantError}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PREDICTOR TAB ── */}
      {tab === 'predictor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!predictor?.predicted ? (
            <p style={{ color: '#9ca3af' }}>Take at least one test to see your score prediction.</p>
          ) : (
            <>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#1d4ed8' }}>{predictor.predicted}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Current estimate /720</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: predictor.projected30d > predictor.predicted ? '#059669' : '#dc2626' }}>{predictor.projected30d}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Projected in 30 days</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: predictor.trend === 'improving' ? '#059669' : predictor.trend === 'declining' ? '#dc2626' : '#f59e0b' }}>
                      {predictor.trend === 'improving' ? '↗' : predictor.trend === 'declining' ? '↘' : '→'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', textTransform: 'capitalize' }}>{predictor.trend}</div>
                  </div>
                </div>
                <div style={{ background: predictor.gap === 0 ? '#f0fdf4' : '#fef9f0', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.875rem', color: predictor.gap === 0 ? '#166534' : '#92400e', fontWeight: 600 }}>
                  {predictor.gapMessage}
                </div>
              </div>

              {/* TN seat assessment */}
              <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#374151' }}>
                  🏛️ {isTa ? 'TN MBBS இடம் கிடைக்கும் வாய்ப்பு' : 'TN MBBS Seat Probability'}
                </h3>
                {Object.entries(predictor.seatAssessment).map(([key, val]) => {
                  const labels: Record<string, string> = isTa
                    ? { tnGovtQuota75: '7.5% அரசு பள்ளி ஒதுக்கீடு', generalGovt: 'பொது — அரசு கல்லூரி', selfFinance: 'பொது — சுயநிதி', obcGovt: 'OBC — அரசு கல்லூரி' }
                    : { tnGovtQuota75: '7.5% Govt School Quota', generalGovt: 'General — Govt College', selfFinance: 'General — Self Finance', obcGovt: 'OBC — Govt College' };
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{labels[key] ?? key}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{isTa ? 'கட்-ஆஃப்' : 'Cutoff'} ~{val.cutoff}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700, color: val.likely ? '#059669' : val.close ? '#f59e0b' : '#9ca3af' }}>
                        {val.likely ? <CheckCircle size={14} /> : val.close ? <AlertTriangle size={14} /> : null}
                        {val.likely ? (isTa ? 'வாய்ப்பு உண்டு' : 'Likely') : val.close ? (isTa ? 'நெருக்கம்' : 'Close') : (isTa ? 'இன்னும் இல்லை' : 'Not yet')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Set target */}
              <div style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>
                  <Target size={14} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                  {isTa ? 'உங்கள் இலக்கு மதிப்பெண் அமை' : 'Set Your Target Score'}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="number" min="100" max="720" value={targetInput} onChange={(e) => setTargetInput(e.target.value)}
                    placeholder={isTa ? 'எ.கா. 600' : 'e.g. 600'} style={{ flex: 1, padding: '0.6rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }} />
                  <button onClick={saveTarget} disabled={savingTarget}
                    style={{ padding: '0.6rem 1.2rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                    {savingTarget ? '…' : (isTa ? 'சேமி' : 'Save')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── GAP CLOSER TAB ── */}
      {tab === 'gap' && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 700, color: '#374151' }}>
            {isTa ? '720 இலக்கிற்கு தடையாக உள்ள தலைப்புகள்' : 'Chapters blocking your 720 target'}
          </h2>
          {gaps && gaps.totalMarksAvailable > 0 && (
            <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1.25rem' }}>
              {isTa ? `இந்த தலைப்புகளை சரி செய்தால் ~${gaps.totalMarksAvailable} மதிப்பெண்கள் மேம்படும்` : `Fix these chapters to recover ~${gaps.totalMarksAvailable} marks`}
            </p>
          )}
          {gaps?.gaps.length === 0 && <p style={{ color: '#9ca3af' }}>Take some tests to see your gap analysis.</p>}
          {gaps?.gaps.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: i < 3 ? '#dc2626' : i < 6 ? '#f59e0b' : '#6b7280', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{g.topic}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{g.subject} · {g.accuracy}% accuracy · {g.wrong} wrong answers</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dc2626' }}>−{g.marksLost} marks</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>potential</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
