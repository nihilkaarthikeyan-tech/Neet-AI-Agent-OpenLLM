import { useState, useEffect } from 'react';
import { BarChart3, Brain, Loader2, TrendingUp, AlertCircle, BookOpen, Zap } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Cell,
} from 'recharts';
import { api } from '../lib/api';
import { Link } from 'react-router-dom';

interface ScorePoint {
  date: string;
  score: number;
  totalQ: number;
  subject: string;
  percentage: number;
}

interface SubjectAccuracy {
  subject: string;
  accuracy: number;
  correct: number;
  attempted: number;
  total: number;
}

interface WeakArea {
  topic: string;
  subject: string;
  reason: string;
  accuracy: number;
  recommendation: string;
}

interface AnalyticsData {
  scoreTimeline: ScorePoint[];
  subjectAccuracy: SubjectAccuracy[];
  totalTests: number;
}

const SUBJECT_COLORS: Record<string, string> = {
  Physics: '#3b82f6',
  Chemistry: '#10b981',
  Biology: '#8b5cf6',
  Mixed: '#f59e0b',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [weakAreas, setWeakAreas] = useState<WeakArea[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [weakError, setWeakError] = useState('');

  useEffect(() => {
    api.get<AnalyticsData>('/api/analytics')
      .then(setData)
      .catch(() => {/* keep null */})
      .finally(() => setIsLoadingData(false));
  }, []);

  const analyzeWeakAreas = async () => {
    setIsAnalyzing(true);
    setWeakError('');
    try {
      const res = await api.post<{ weakAreas: WeakArea[] }>('/api/analytics/weak-areas', {});
      setWeakAreas(res.weakAreas);
    } catch (err) {
      setWeakError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="page-loading-center">
        <Loader2 size={32} className="spin" />
      </div>
    );
  }

  const hasData = data && data.totalTests > 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <BarChart3 size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-desc">Performance insights, weak areas, and AI coaching</p>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="stats-row stats-row-3">
        <div className="stat-card">
          <p className="stat-value">{data?.totalTests ?? 0}</p>
          <p className="stat-label">Tests Taken</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">
            {data?.subjectAccuracy.length
              ? `${Math.max(...data.subjectAccuracy.map(s => s.accuracy))}%`
              : '—'}
          </p>
          <p className="stat-label">Best Subject Accuracy</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">
            {data?.subjectAccuracy.length
              ? data.subjectAccuracy.reduce((best, s) =>
                  s.accuracy > (best?.accuracy ?? -1) ? s : best, data.subjectAccuracy[0]
                )?.subject ?? '—'
              : '—'}
          </p>
          <p className="stat-label">Strongest Subject</p>
        </div>
      </div>

      {!hasData ? (
        <div className="coming-soon-card">
          <TrendingUp size={48} className="coming-soon-icon" />
          <h2>No test data yet</h2>
          <p>Take at least one mock test to see your performance analytics here.</p>
          <Link to="/dashboard/tests" className="btn-primary btn-start-test">
            Start a Mock Test
          </Link>
        </div>
      ) : (
        <>
          {/* Score over time */}
          <h2 className="section-heading">Score Progression</h2>
          <div className="auth-card chart-card panel-card chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.scoreTimeline} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(value: any) => [`${value}%`, 'Score']}
                />
                <Line type="monotone" dataKey="percentage" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Subject accuracy */}
          <div className="panel-grid-2 panel-margin-bottom">
            <div>
              <h2 className="section-heading">Subject Accuracy Radar</h2>
              <div className="auth-card chart-card panel-card chart-container">
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={data.subjectAccuracy}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Radar dataKey="accuracy" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      formatter={(v: any) => [`${v}%`, 'Accuracy']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h2 className="section-heading">Per-Subject Breakdown</h2>
              <div className="auth-card chart-card panel-card chart-container">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.subjectAccuracy} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      formatter={(v: any) => [`${v}%`, 'Accuracy']}
                    />
                    <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                      {data.subjectAccuracy.map((entry) => (
                        <Cell key={entry.subject} fill={SUBJECT_COLORS[entry.subject] ?? '#8b5cf6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Weak Area Analyzer */}
          <h2 className="section-heading">AI Weak Area Analyzer</h2>
          <div className="auth-card weak-area-card panel-card chart-container panel-margin-bottom">
            <div className="weak-area-header">
              <div className="weak-area-title">
                <Brain size={20} className="weak-area-title-icon" />
                <p className="weak-area-title-text">Identify your weak topics with AI</p>
              </div>
              <button
                className="btn-primary btn-analyze"
                onClick={analyzeWeakAreas}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? <><Loader2 size={14} className="spin" /> Analyzing...</> : 'Analyze Weak Areas'}
              </button>
            </div>

            {weakError && <div className="auth-error">{weakError}</div>}

            {weakAreas !== null && weakAreas.length === 0 && (
              <p className="weak-area-success">Great job! No major weak areas detected based on your test history.</p>
            )}

            {weakAreas && weakAreas.length > 0 && (
              <div className="weak-areas-list">
                {weakAreas.map((area, i) => (
                  <div key={i} className="weak-area-item">
                    <div className="weak-area-item-header">
                      <div className="weak-area-item-left">
                        <AlertCircle size={16} className="weak-area-alert-icon" />
                        <span className="weak-area-topic">{area.topic}</span>
                        <span className="weak-area-subject-badge" style={{ backgroundColor: SUBJECT_COLORS[area.subject] ?? '#8b5cf6' }}>{area.subject}</span>
                      </div>
                      <span className="weak-area-accuracy">{area.accuracy}%</span>
                    </div>
                    <p className="weak-area-reason">{area.reason}</p>
                    <p className="weak-area-tip"><strong>Tip:</strong> {area.recommendation}</p>
                    <div className="weak-area-actions">
                      <Link
                        to={`/dashboard/tutor`}
                        state={{ subject: area.subject, topic: area.topic }}
                        className="weak-area-action-btn tutor"
                      >
                        <Brain size={12} /> Ask AI Tutor
                      </Link>
                      <Link
                        to={`/dashboard/flashcards`}
                        state={{ subject: area.subject, topic: area.topic }}
                        className="weak-area-action-btn flashcards"
                      >
                        <BookOpen size={12} /> Generate Flashcards
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Planner integration CTA */}
            {weakAreas && weakAreas.length > 0 && (
              <div className="planner-cta">
                <div className="planner-cta-content">
                  <Zap size={16} className="planner-cta-icon" />
                  <p className="planner-cta-text">Update your study plan to focus on these weak areas</p>
                </div>
                <Link
                  to="/dashboard/planner"
                  state={{ weakTopics: weakAreas.map(w => w.topic).join(', ') }}
                  className="btn-update-plan"
                >
                  Update Study Plan
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
