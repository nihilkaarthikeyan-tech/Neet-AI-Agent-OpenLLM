import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { LogOut, Users, BookOpen, BarChart3, MessageSquare, Layers, TrendingUp } from 'lucide-react';

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

const LANG_LABEL: Record<string, string> = {
  en:        'English',
  ta:        'Tamil (தமிழ்)',
  bilingual: 'Bilingual',
};

const SUBJECT_COLORS: Record<string, string> = {
  Biology:   '#059669',
  Chemistry: '#7c3aed',
  Physics:   '#1d4ed8',
};

export default function AdminDashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get<DashboardData>('/api/admin/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  if (loading) return (
    <div className="admin-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spin" style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 12px' }} />
        Loading dashboard…
      </div>
    </div>
  );

  if (error) return (
    <div className="admin-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#dc2626', textAlign: 'center' }}>
      <div>
        <p style={{ fontWeight: 700, marginBottom: 4 }}>Failed to load</p>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    </div>
  );

  const o = data!.overview;

  const metrics = [
    { label: 'Total Students',   value: o.totalStudents.toLocaleString(),          sub: `+${o.newLast7Days} this week`,    icon: <Users size={18} />,        color: '#1d4ed8' },
    { label: 'New (30 Days)',    value: o.newLast30Days.toLocaleString(),           sub: `+${o.newLast7Days} last 7 days`,  icon: <TrendingUp size={18} />,   color: '#059669' },
    { label: 'Tests Taken',      value: o.totalTests.toLocaleString(),             sub: `${o.testsLast7} this week`,       icon: <BarChart3 size={18} />,    color: '#7c3aed' },
    { label: 'AI Tutor Sessions',value: o.totalDoubtMessages.toLocaleString(),     sub: `${o.doubtsLast7} this week`,      icon: <MessageSquare size={18} />, color: '#dc2626' },
    { label: 'Flashcards',       value: o.totalFlashcards.toLocaleString(),        sub: 'All time',                        icon: <Layers size={18} />,       color: '#d97706' },
    { label: 'Avg Test Score',   value: o.avgScore !== null ? `${o.avgScore}/720` : 'N/A', sub: 'Across all subjects',  icon: <BookOpen size={18} />,     color: '#0891b2' },
  ];

  // 30-day registration bar chart data
  const regMap: Record<string, number> = {};
  for (const d of data!.dailyRegistrations) regMap[d.date] = d.count;
  const days30: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().split('T')[0];
    days30.push({ date: key, count: regMap[key] ?? 0 });
  }
  const barMax     = Math.max(...days30.map((x) => x.count), 1);
  const totalNew30 = days30.reduce((s, d) => s + d.count, 0);

  return (
    <div className="admin-layout">

      {/* TN Branding top bar */}
      <header className="admin-topbar" role="banner">
        <div className="admin-topbar-left">
          <div className="tn-emblem" role="img" aria-label="Tamil Nadu Government Emblem">TN</div>
          <div>
            <p className="admin-topbar-title">Government of Tamil Nadu — NEET AI Platform</p>
            <p className="admin-topbar-sub">Official Admin Dashboard · {user?.name ?? user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: 'transparent', border: '1px solid rgba(148,163,184,0.3)', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      <main className="admin-body">

        {/* Key metrics */}
        <p className="admin-section-title">Platform Overview</p>
        <div className="admin-metric-grid">
          {metrics.map((m) => (
            <div key={m.label} className="admin-metric-card">
              <div className="admin-metric-accent" style={{ background: m.color }} />
              <div style={{ paddingLeft: 12 }}>
                <p className="admin-metric-label">{m.label}</p>
                <p className="admin-metric-value">{m.value}</p>
                <p className="admin-metric-sub">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Subject + Language */}
        <div className="admin-2col">

          {/* Subject breakdown */}
          <div className="panel-card">
            <p className="admin-section-title" style={{ marginBottom: 16 }}>Subject Performance</p>
            {data!.subjectBreakdown.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No test data yet.</p>
              : data!.subjectBreakdown.map((s) => {
                  const maxTests = Math.max(...data!.subjectBreakdown.map((x) => x.tests), 1);
                  return (
                    <div key={s.subject} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.subject}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {s.tests} tests{s.avgScore !== null ? ` · avg ${s.avgScore}` : ''}
                        </span>
                      </div>
                      <div style={{ height: 7, background: 'var(--bg-base)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, background: SUBJECT_COLORS[s.subject] ?? 'var(--accent)', width: `${Math.min(100, (s.tests / maxTests) * 100)}%`, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {/* Language breakdown */}
          <div className="panel-card">
            <p className="admin-section-title" style={{ marginBottom: 4 }}>Language Preference</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Tamil-medium adoption — key TN equity metric</p>
            {data!.languageBreakdown.map((l) => {
              const pct = o.totalStudents > 0 ? Math.round((l.students / o.totalStudents) * 100) : 0;
              const barColor = l.language === 'ta' ? '#f59e0b' : l.language === 'bilingual' ? '#10b981' : '#6b7280';
              return (
                <div key={l.language} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{LANG_LABEL[l.language] ?? l.language}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {l.students.toLocaleString()} <span style={{ color: 'var(--text-muted)' }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 7, background: 'var(--bg-base)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: barColor, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily registrations */}
        <div className="panel-card" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Daily New Registrations — Last 30 Days</p>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              {totalNew30.toLocaleString()} total this month
            </span>
          </div>
          <div className="admin-bar-chart">
            {days30.map((d) => {
              const h = d.count > 0 ? Math.max(8, Math.round((d.count / barMax) * 76)) : 3;
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count} new student${d.count !== 1 ? 's' : ''}`}
                  style={{ flex: 1, height: `${h}px`, background: d.count > 0 ? 'var(--accent)' : 'var(--border)', borderRadius: '2px 2px 0 0', cursor: 'default', transition: 'opacity 0.15s', opacity: 0.85 }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{days30[0]?.date}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{days30[29]?.date}</span>
          </div>
        </div>

        {/* Cost-per-student */}
        {data!.costMetrics && (
          <div className="panel-card" style={{ marginBottom: 28 }}>
            <p className="admin-section-title">Cost-per-Student Analysis</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
              Use this to justify the platform budget in Assembly presentations.
            </p>
            <div className="admin-cost-grid">
              {[
                { label: 'Total AI Cost (est.)', value: `₹${data!.costMetrics.totalAiCostINR.toLocaleString('en-IN')}`,          sub: 'Since launch',           color: '#7c3aed' },
                { label: 'Cost per Student',     value: `₹${data!.costMetrics.costPerStudentINR.toLocaleString('en-IN')}`,        sub: 'AI compute only',        color: '#1d4ed8' },
                { label: 'Private Coaching',     value: `₹${data!.costMetrics.privateCoachingCost.toLocaleString('en-IN')}`,      sub: 'Average market rate',    color: '#9ca3af' },
                { label: 'Saving per Student',   value: `₹${data!.costMetrics.savingsPerStudent.toLocaleString('en-IN')}`,        sub: 'vs private coaching',    color: '#059669' },
              ].map((card) => (
                <div key={card.label} className="admin-cost-card" style={{ borderLeftColor: card.color }}>
                  <p className="admin-cost-label">{card.label}</p>
                  <p className="admin-cost-value" style={{ color: card.color }}>{card.value}</p>
                  <p className="admin-cost-sub">{card.sub}</p>
                </div>
              ))}
            </div>
            <div className="admin-callout">
              📢 Assembly talking point: "{data!.costMetrics.costRatio} — {o.totalStudents.toLocaleString('en-IN')} students reached."
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              Based on Together AI token pricing. Actual infrastructure costs to be added separately.
            </p>
          </div>
        )}

        <p className="admin-footer">
          An initiative of the Government of Tamil Nadu · Data updated in real time · No individual PII displayed
        </p>

      </main>
    </div>
  );
}
