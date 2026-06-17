import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface DashboardData {
  overview: {
    totalStudents: number;
    newLast7Days: number;
    newLast30Days: number;
    totalTests: number;
    testsLast7: number;
    totalDoubtMessages: number;
    doubtsLast7: number;
    totalFlashcards: number;
    avgScore: number | null;
  };
  costMetrics: {
    totalAiCostINR: number;
    costPerStudentINR: number;
    privateCoachingCost: number;
    savingsPerStudent: number;
    costRatio: string;
  };
  subjectBreakdown: { subject: string; tests: number; avgScore: number | null }[];
  languageBreakdown: { language: string; students: number }[];
  dailyRegistrations: { date: string; count: number }[];
}

const LANG_LABEL: Record<string, string> = { en: 'English', ta: 'Tamil (தமிழ்)', bilingual: 'Bilingual' };

export default function AdminDashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<DashboardData>('/api/admin/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b7280', fontSize: '1.1rem' }}>
      Loading dashboard…
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#dc2626' }}>
      {error}
    </div>
  );

  const o = data!.overview;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'system-ui, sans-serif' }}>

      {/* Top bar */}
      <header style={{ background: '#1a1a2e', color: '#fff', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>🏛️ Government of Tamil Nadu — NEET AI Platform</h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Official Dashboard · {user?.name ?? user?.email}</p>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '6px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem' }}>
          Sign Out
        </button>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Key metrics */}
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', margin: '0 0 1rem' }}>Platform Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Students', value: o.totalStudents.toLocaleString(), sub: `+${o.newLast7Days} this week`, color: '#1d4ed8' },
            { label: 'New (Last 30 Days)', value: o.newLast30Days.toLocaleString(), sub: `+${o.newLast7Days} last 7 days`, color: '#059669' },
            { label: 'Tests Taken', value: o.totalTests.toLocaleString(), sub: `${o.testsLast7} this week`, color: '#7c3aed' },
            { label: 'AI Tutor Sessions', value: o.totalDoubtMessages.toLocaleString(), sub: `${o.doubtsLast7} this week`, color: '#dc2626' },
            { label: 'Flashcards Created', value: o.totalFlashcards.toLocaleString(), sub: 'All time', color: '#d97706' },
            { label: 'Avg Test Score', value: o.avgScore !== null ? `${o.avgScore} / 720` : 'N/A', sub: 'Across all subjects', color: '#0891b2' },
          ].map((card) => (
            <div key={card.label} style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `4px solid ${card.color}` }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</p>
              <p style={{ margin: '0 0 0.2rem', fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>{card.value}</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af' }}>{card.sub}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

          {/* Subject breakdown */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ margin: '0 0 1.2rem', fontSize: '0.95rem', fontWeight: 700, color: '#374151' }}>Subject Performance</h3>
            {data!.subjectBreakdown.length === 0
              ? <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No test data yet.</p>
              : data!.subjectBreakdown.map((s) => (
                <div key={s.subject} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{s.subject}</span>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{s.tests} tests · avg {s.avgScore ?? 'N/A'}</span>
                  </div>
                  <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '99px' }}>
                    <div style={{ height: '100%', borderRadius: '99px', background: s.subject === 'Biology' ? '#059669' : s.subject === 'Chemistry' ? '#7c3aed' : '#1d4ed8', width: `${Math.min(100, (s.tests / Math.max(...data!.subjectBreakdown.map(x => x.tests), 1)) * 100)}%` }} />
                  </div>
                </div>
              ))
            }
          </div>

          {/* Language preference */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ margin: '0 0 1.2rem', fontSize: '0.95rem', fontWeight: 700, color: '#374151' }}>Language Preference</h3>
            <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0 0 1rem' }}>Tamil-medium adoption — key TN equity metric</p>
            {data!.languageBreakdown.map((l) => {
              const pct = o.totalStudents > 0 ? Math.round((l.students / o.totalStudents) * 100) : 0;
              return (
                <div key={l.language} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{LANG_LABEL[l.language] ?? l.language}</span>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{l.students.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '99px' }}>
                    <div style={{ height: '100%', borderRadius: '99px', background: l.language === 'ta' ? '#f59e0b' : l.language === 'bilingual' ? '#10b981' : '#6b7280', width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily registrations trend */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <h3 style={{ margin: '0 0 1.2rem', fontSize: '0.95rem', fontWeight: 700, color: '#374151' }}>Daily New Registrations (Last 30 Days)</h3>
          {(() => {
            // Fill all 30 days so chart always shows 30 evenly-sized bars
            const regMap: Record<string, number> = {};
            for (const d of data!.dailyRegistrations) regMap[d.date] = d.count;
            const days30: { date: string; count: number }[] = [];
            for (let i = 29; i >= 0; i--) {
              const dt = new Date(); dt.setDate(dt.getDate() - i);
              const key = dt.toISOString().split('T')[0];
              days30.push({ date: key, count: regMap[key] ?? 0 });
            }
            const max = Math.max(...days30.map((x) => x.count), 1);
            const totalNew = days30.reduce((s, d) => s + d.count, 0);
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
                  {days30.map((d) => {
                    const h = d.count > 0 ? Math.max(8, Math.round((d.count / max) * 76)) : 3;
                    return (
                      <div key={d.date} title={`${d.date}: ${d.count} new student${d.count !== 1 ? 's' : ''}`}
                        style={{ flex: 1, height: `${h}px`, background: d.count > 0 ? '#1d4ed8' : '#e5e7eb', borderRadius: '2px 2px 0 0', cursor: 'default' }}
                      />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{days30[0]?.date}</span>
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>{totalNew} new registrations this month</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{days30[29]?.date}</span>
                </div>
              </>
            );
          })()}
        </div>

        {/* Cost-per-student dashboard */}
        {data!.costMetrics && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginTop: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#374151' }}>
              💰 Cost-per-Student Analysis
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0 0 1.25rem' }}>
              Use this to justify the platform budget in Assembly presentations.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {[
                { label: 'Total AI Cost (est.)', value: `₹${data!.costMetrics.totalAiCostINR.toLocaleString('en-IN')}`, color: '#7c3aed', sub: 'Since launch' },
                { label: 'Cost per Student', value: `₹${data!.costMetrics.costPerStudentINR.toLocaleString('en-IN')}`, color: '#1d4ed8', sub: 'AI compute only' },
                { label: 'Private Coaching', value: `₹${data!.costMetrics.privateCoachingCost.toLocaleString('en-IN')}`, color: '#9ca3af', sub: 'Average market rate' },
                { label: 'Saving per Student', value: `₹${data!.costMetrics.savingsPerStudent.toLocaleString('en-IN')}`, color: '#059669', sub: 'vs private coaching' },
              ].map((card) => (
                <div key={card.label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', borderLeft: `3px solid ${card.color}` }}>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{card.label}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '3px' }}>{card.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#166534', fontWeight: 600 }}>
              📢 Assembly talking point: "{data!.costMetrics.costRatio} — {data!.overview.totalStudents.toLocaleString('en-IN')} students reached."
            </div>
            <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.5rem 0 0' }}>{data!.costMetrics.costRatio.includes('₹') ? '' : ''} Based on Together AI token pricing. Actual infrastructure costs to be added separately.</p>
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.78rem', marginTop: '2rem' }}>
          An initiative of the Government of Tamil Nadu · Data updated in real time · No individual PII displayed
        </p>
      </main>
    </div>
  );
}
