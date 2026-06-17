import { useState, useEffect } from 'react';
import {
  Users, Plus, FileText, ShieldCheck, ClipboardList,
  Loader2, CheckCircle2, AlertTriangle, BarChart2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import { useAuthStore } from '../store/authStore';
import MarkdownText from '../components/MarkdownText';

interface Student {
  id: string;
  name: string | null;
  email: string;
  district: string | null;
  school: string | null;
  diagnosticCompleted: boolean;
  latestScoreEstimate: number | null;
  _count: { testAttempts: number; doubtHistory: number };
}

interface ClassReport {
  report: string | null;
  weakTopics: { topic: string; accuracy: number; total: number }[];
  studentsAnalysed: number;
  questionsAnalysed: number;
  message?: string;
}

interface AnswerMsg {
  id: string;
  content: string;
  subject: string;
  verified: boolean;
  createdAt: string;
  user: { name: string | null; email: string };
}

interface ClassTestRow {
  id: string;
  title: string;
  subject: string;
  totalQ: number;
  createdAt: string;
  studentCount: number;
  submittedCount: number;
  avgScore: number | null;
  rows: {
    studentName: string;
    studentEmail: string;
    scorePct: number | null;
    submitted: boolean;
    submittedAt: string | null;
  }[];
}

const SUBJECTS = ['Biology', 'Physics', 'Chemistry'];

type TabKey = 'students' | 'report' | 'verify' | 'bulk-test';

function scoreBadgeClass(score: number): string {
  if (score >= 550) return 'score-badge score-badge--high';
  if (score >= 400) return 'score-badge score-badge--mid';
  return 'score-badge score-badge--low';
}

export default function TeacherPortalPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const { token } = useAuthStore();

  const [students,       setStudents]       = useState<Student[]>([]);
  const [report,         setReport]         = useState<ClassReport | null>(null);
  const [loadingStudents,setLoadingStudents] = useState(true);
  const [loadingReport,  setLoadingReport]  = useState(false);
  const [addEmail,       setAddEmail]       = useState('');
  const [addMsg,         setAddMsg]         = useState('');
  const [adding,         setAdding]         = useState(false);
  const [tab,            setTab]            = useState<TabKey>('students');
  const [answers,        setAnswers]        = useState<AnswerMsg[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [verifying,      setVerifying]      = useState<string | null>(null);

  const [btTitle,    setBtTitle]    = useState('');
  const [btSubject,  setBtSubject]  = useState('Biology');
  const [btCount,    setBtCount]    = useState(10);
  const [creatingBT, setCreatingBT] = useState(false);
  const [btMsg,      setBtMsg]      = useState('');
  const [classTests, setClassTests] = useState<ClassTestRow[]>([]);
  const [loadingBT,  setLoadingBT]  = useState(false);
  const [expandedBT, setExpandedBT] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ students: Student[] }>('/api/teacher/students')
      .then((d) => setStudents(d.students))
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  const addStudent = async () => {
    if (!addEmail.trim()) return;
    setAdding(true); setAddMsg('');
    try {
      const res = await api.post<{ message: string }>('/api/teacher/add-student', { studentEmail: addEmail.trim() });
      setAddMsg(res.message);
      setAddEmail('');
      const fresh = await api.get<{ students: Student[] }>('/api/teacher/students');
      setStudents(fresh.students);
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : 'Failed to add student.');
    } finally { setAdding(false); }
  };

  const getReport = async () => {
    setLoadingReport(true);
    try {
      const res = await api.get<ClassReport>(`/api/teacher/class-report?language=${lang}`);
      setReport(res);
    } catch { setReport(null); }
    finally { setLoadingReport(false); }
  };

  const loadBulkTests = async () => {
    setLoadingBT(true);
    try {
      const res = await api.get<{ classTests: ClassTestRow[] }>('/api/teacher/bulk-tests');
      setClassTests(res.classTests ?? []);
    } catch { /* ignore */ }
    finally { setLoadingBT(false); }
  };

  const createBulkTest = async () => {
    if (!btTitle.trim() || creatingBT) return;
    setCreatingBT(true); setBtMsg('');
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5005'}/api/teacher/bulk-test`, {
        method: 'POST', headers,
        body: JSON.stringify({ title: btTitle.trim(), subject: btSubject, count: btCount }),
      });
      const data = await res.json() as { classTest?: { title: string }; assignedTo?: number; error?: string };
      if (!res.ok) { setBtMsg(data.error ?? 'Failed.'); return; }
      setBtMsg(`✅ "${data.classTest!.title}" assigned to ${data.assignedTo} students!`);
      setBtTitle('');
      await loadBulkTests();
    } catch { setBtMsg('Failed to create test.'); }
    finally { setCreatingBT(false); }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'students',  label: isTa ? '👥 மாணவர்கள்'    : '👥 My Students' },
    { key: 'report',    label: isTa ? '📊 வகுப்பு அறிக்கை' : '📊 Class Report' },
    { key: 'verify',    label: isTa ? '✅ சரிபார்'         : '✅ Verify Answers' },
    { key: 'bulk-test', label: isTa ? '📝 வகுப்பு தேர்வு'  : '📝 Bulk Test' },
  ];

  const handleTabClick = (key: TabKey) => {
    setTab(key);
    if (key === 'report' && !report) void getReport();
    if (key === 'verify' && answers.length === 0) {
      setLoadingAnswers(true);
      api.get<{ answers: AnswerMsg[] }>('/api/teacher/recent-answers')
        .then((d) => setAnswers(d.answers)).catch(() => {}).finally(() => setLoadingAnswers(false));
    }
    if (key === 'bulk-test' && classTests.length === 0) void loadBulkTests();
  };

  return (
    <div className="page-container">

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-icon">
          <Users size={22} />
        </div>
        <div>
          <h1 className="page-title">{isTa ? 'ஆசிரியர் போர்டல்' : 'Teacher Portal'}</h1>
          <p className="page-desc">
            {isTa
              ? 'உங்கள் அரசு பள்ளி மாணவர்களின் NEET முன்னேற்றத்தை கண்காணிக்கவும்.'
              : "Track your government school students' NEET progress."}
          </p>
        </div>
      </div>

      {/* Add student */}
      <div className="panel-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={15} />
          {isTa ? 'வகுப்பில் மாணவரை சேர்க்கவும்' : 'Add Student to Your Class'}
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addStudent()}
            placeholder="student@email.com"
            style={{ flex: 1, minWidth: 220, padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          <button
            onClick={() => void addStudent()}
            disabled={adding || !addEmail.trim()}
            className="btn-primary"
            style={{ width: 'auto', padding: '9px 20px', opacity: adding || !addEmail.trim() ? 0.6 : 1 }}
          >
            {adding ? <Loader2 size={15} className="spin" /> : (isTa ? 'சேர்' : 'Add')}
          </button>
        </div>
        {addMsg && (
          <p style={{
            fontSize: 13, marginTop: 8, fontWeight: 600,
            color: addMsg.includes('added') || addMsg.includes('சேர்') ? '#059669' : '#dc2626',
          }}>
            {addMsg}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="page-tabs" style={{ marginBottom: 24 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`page-tab${tab === t.key ? ' page-tab--active' : ''}`}
            onClick={() => handleTabClick(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Students tab ── */}
      {tab === 'students' && (
        <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loadingStudents ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block', color: 'var(--accent)' }} />
              {isTa ? 'ஏற்றுகிறது…' : 'Loading students…'}
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No students yet</p>
              <p style={{ fontSize: 13 }}>Add students above using their registered email.</p>
            </div>
          ) : (
            <div className="teacher-table-wrap">
              <table className="teacher-table">
                <thead>
                  <tr>
                    {[
                      isTa ? 'பெயர்' : 'Name',
                      isTa ? 'பள்ளி / மாவட்டம்' : 'School / District',
                      isTa ? 'மதிப்பெண் (மதிப்பீடு)' : 'Est. Score',
                      isTa ? 'தேர்வுகள்' : 'Tests',
                      isTa ? 'அமர்வுகள்' : 'Sessions',
                      isTa ? 'கண்டறிதல்' : 'Diagnostic',
                    ].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name ?? 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.email}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {s.school ?? '—'}
                        <br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.district ?? '—'}</span>
                      </td>
                      <td>
                        {s.latestScoreEstimate ? (
                          <span className={scoreBadgeClass(s.latestScoreEstimate)}>
                            {s.latestScoreEstimate}/720
                          </span>
                        ) : (
                          <span className="score-badge score-badge--na">N/A</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s._count.testAttempts}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s._count.doubtHistory}</td>
                      <td>
                        {s.diagnosticCompleted ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#059669' }}>
                            <CheckCircle2 size={14} /> {isTa ? 'முடிந்தது' : 'Done'}
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#d97706' }}>
                            <AlertTriangle size={14} /> {isTa ? 'நிலுவையில்' : 'Pending'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Class Report tab ── */}
      {tab === 'report' && (
        <div>
          {loadingReport && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block', color: 'var(--accent)' }} />
              {isTa ? 'வகுப்பு அறிக்கை உருவாக்கப்படுகிறது…' : 'Generating class report…'}
            </div>
          )}

          {!loadingReport && !report && (
            <div className="panel-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <BarChart2 size={32} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--accent)', opacity: 0.5 }} />
              <p style={{ fontWeight: 700, marginBottom: 8 }}>
                {isTa ? 'வகுப்பு அறிக்கையை உருவாக்கவும்' : 'Generate a class report'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                {isTa
                  ? 'AI உங்கள் மாணவர்களின் பலவீனங்களை பகுப்பாய்வு செய்யும்.'
                  : 'AI will analyse your class's weak topics and give you a report.'}
              </p>
              <button onClick={() => void getReport()} className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                {isTa ? 'அறிக்கையை உருவாக்கு' : 'Generate Report'}
              </button>
            </div>
          )}

          {report?.message && !report.report && (
            <div className="panel-card">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{report.message}</p>
            </div>
          )}

          {report?.weakTopics && report.weakTopics.length > 0 && (
            <div className="panel-card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 18 }}>
                {isTa ? 'வகுப்பு பலவீன தலைப்புகள்' : 'Class Weakness Map'}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  {report.studentsAnalysed} students · {report.questionsAnalysed} questions
                </span>
              </h3>
              {report.weakTopics.map((t) => (
                <div key={t.topic} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{t.topic}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, color: t.accuracy < 50 ? '#dc2626' : '#d97706' }}>
                      {t.accuracy}% <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t.total} Qs)</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: t.accuracy < 50 ? '#dc2626' : '#d97706', width: `${t.accuracy}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {report?.report && (
            <div className="panel-card">
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <FileText size={15} style={{ color: 'var(--accent)' }} />
                {isTa ? 'AI உருவாக்கிய அறிக்கை' : 'AI-Generated Class Report'}
              </h3>
              <MarkdownText content={report.report} style={{ fontSize: 14, color: 'var(--text-primary)' }} />
            </div>
          )}
        </div>
      )}

      {/* ── Bulk Test tab ── */}
      {tab === 'bulk-test' && (
        <div>
          <div className="panel-card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={16} style={{ color: 'var(--accent)' }} />
              {isTa ? 'முழு வகுப்பிற்கும் தேர்வு அமை' : 'Assign Test to Whole Class'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.5 }}>
              {isTa
                ? `AI ${btCount} கேள்விகளை ${btSubject} இல் உருவாக்கும். ஒவ்வொரு மாணவருக்கும் தானாக ஒதுக்கப்படும்.`
                : `AI generates a fresh ${btCount}-question test in ${btSubject}. Every linked student gets their own attempt automatically.`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                placeholder={isTa ? 'தேர்வு தலைப்பு (எ.கா. அலகு 3 உயிரியல் திருத்தம்)' : 'Test title (e.g. Unit 3 Biology Revision)'}
                value={btTitle}
                onChange={(e) => setBtTitle(e.target.value)}
                style={{ padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              />

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {SUBJECTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setBtSubject(s)}
                      className={btSubject === s ? 'btn-primary' : 'btn-secondary'}
                      style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 600 }}>{isTa ? 'கேள்விகள்:' : 'Questions:'}</span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[5, 10, 20, 30, 45].map((n) => (
                      <button
                        key={n}
                        onClick={() => setBtCount(n)}
                        style={{
                          padding: '5px 10px', borderRadius: 6, border: `1.5px solid ${btCount === n ? 'var(--accent)' : 'var(--border)'}`,
                          background: btCount === n ? 'var(--accent)' : 'var(--bg-surface)', color: btCount === n ? '#fff' : 'var(--text-secondary)',
                          fontWeight: 700, fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => void createBulkTest()}
                disabled={creatingBT || !btTitle.trim()}
                className="btn-primary"
                style={{ width: 'fit-content', padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {creatingBT
                  ? <><Loader2 size={15} className="spin" /> {isTa ? 'உருவாக்கப்படுகிறது…' : 'Generating…'}</>
                  : <><ClipboardList size={15} /> {isTa ? 'தேர்வை உருவாக்கி ஒதுக்கு' : 'Create & Assign Test'}</>}
              </button>

              {btMsg && (
                <p style={{ fontSize: 13, fontWeight: 600, color: btMsg.startsWith('✅') ? '#059669' : '#dc2626' }}>
                  {btMsg}
                </p>
              )}
            </div>
          </div>

          {loadingBT && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="spin" style={{ display: 'block', margin: '0 auto 8px', color: 'var(--accent)' }} />
              {isTa ? 'தேர்வுகள் ஏற்றப்படுகின்றன…' : 'Loading tests…'}
            </div>
          )}

          {!loadingBT && classTests.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>
              {isTa ? 'இன்னும் வகுப்பு தேர்வுகள் இல்லை. மேலே ஒன்று உருவாக்கவும்.' : 'No bulk tests yet. Create one above to assign it to your class.'}
            </p>
          )}

          {classTests.map((ct) => (
            <div key={ct.id} className="panel-card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, margin: 0 }}>{ct.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {ct.subject} · {ct.totalQ} Qs · {new Date(ct.createdAt).toLocaleDateString('en-IN')} · {ct.submittedCount}/{ct.studentCount} submitted
                    {ct.avgScore !== null ? ` · Avg ${ct.avgScore}%` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setExpandedBT(expandedBT === ct.id ? null : ct.id)}
                  className="btn-secondary"
                  style={{ padding: '5px 14px', fontSize: 12, flexShrink: 0 }}
                >
                  {expandedBT === ct.id ? (isTa ? 'மறை' : 'Hide') : (isTa ? 'முடிவுகள்' : 'See Results')}
                </button>
              </div>

              <div style={{ height: 5, background: 'var(--bg-base)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', borderRadius: 999, background: 'var(--accent-green)', width: `${(ct.submittedCount / ct.studentCount) * 100}%`, transition: 'width 0.5s' }} />
              </div>

              {expandedBT === ct.id && (
                <div className="teacher-table-wrap" style={{ marginTop: 12 }}>
                  <table className="teacher-table">
                    <thead>
                      <tr>
                        <th>{isTa ? 'மாணவர்' : 'Student'}</th>
                        <th>{isTa ? 'மதிப்பெண்' : 'Score'}</th>
                        <th>{isTa ? 'சமர்பித்தது' : 'Submitted'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ct.rows.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{r.studentName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.studentEmail}</div>
                          </td>
                          <td>
                            {r.scorePct !== null ? (
                              <span className={scoreBadgeClass(r.scorePct * 7.2)}>
                                {r.scorePct}%
                              </span>
                            ) : <span className="score-badge score-badge--na">—</span>}
                          </td>
                          <td style={{ fontSize: 13, color: r.submitted ? '#059669' : 'var(--text-muted)', fontWeight: r.submitted ? 600 : 400 }}>
                            {r.submitted ? (r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN') : isTa ? 'ஆம்' : 'Yes') : (isTa ? 'நிலுவையில்' : 'Pending')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Verify Answers tab ── */}
      {tab === 'verify' && (
        <div>
          <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#065f46', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {isTa
                ? 'உங்கள் மாணவர்களுக்கு AI கொடுத்த பதில்களை சரிபார்க்கவும். சரிபார்க்கப்பட்ட பதில்களில் ✅ பேட்ஜ் காண்பிக்கப்படும்.'
                : 'Review AI answers given to your students. Verified answers show a ✅ Teacher Verified badge in the student chat.'}
            </span>
          </div>

          {loadingAnswers && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="spin" style={{ display: 'block', margin: '0 auto 8px', color: 'var(--accent)' }} />
              {isTa ? 'சமீபத்திய பதில்கள் ஏற்றப்படுகிறது…' : 'Loading recent answers…'}
            </div>
          )}

          {!loadingAnswers && answers.length === 0 && (
            <div className="panel-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <ShieldCheck size={28} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {isTa ? 'இன்னும் AI பதில்கள் இல்லை. மாணவர்கள் AI ஆசிரியரை முதலில் பயன்படுத்த வேண்டும்.' : 'No AI answers found yet. Students need to use the AI Tutor first.'}
              </p>
            </div>
          )}

          {answers.map((a) => (
            <div
              key={a.id}
              className="panel-card"
              style={{
                marginBottom: 12,
                borderColor: a.verified ? 'rgba(5,150,105,0.3)' : 'var(--border)',
                background: a.verified ? 'rgba(5,150,105,0.02)' : 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>{a.user.name ?? a.user.email}</strong>
                  {' · '}{a.subject}{' · '}{new Date(a.createdAt).toLocaleDateString('en-IN')}
                </div>
                {a.verified ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <ShieldCheck size={12} /> {isTa ? 'சரிபார்க்கப்பட்டது' : 'Verified'}
                  </span>
                ) : (
                  <button
                    disabled={verifying === a.id}
                    onClick={async () => {
                      setVerifying(a.id);
                      try {
                        await api.post('/api/teacher/verify-answer', { messageId: a.id });
                        setAnswers((prev) => prev.map((msg) => msg.id === a.id ? { ...msg, verified: true } : msg));
                      } catch { /* ignore */ }
                      finally { setVerifying(null); }
                    }}
                    className="btn-secondary"
                    style={{ padding: '4px 12px', fontSize: 11, fontWeight: 700, flexShrink: 0, opacity: verifying === a.id ? 0.6 : 1 }}
                  >
                    {verifying === a.id ? '…' : (isTa ? '✅ சரிபார்' : '✅ Verify')}
                  </button>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {a.content}
              </p>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
