import { useState, useEffect } from 'react';
import { Users, Plus, FileText, ShieldCheck, ClipboardList, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import { useAuthStore } from '../store/authStore';
import MarkdownText from '../components/MarkdownText';

interface Student { id: string; name: string | null; email: string; district: string | null; school: string | null; diagnosticCompleted: boolean; latestScoreEstimate: number | null; _count: { testAttempts: number; doubtHistory: number } }
interface ClassReport { report: string | null; weakTopics: { topic: string; accuracy: number; total: number }[]; studentsAnalysed: number; questionsAnalysed: number; message?: string }
interface AnswerMsg { id: string; content: string; subject: string; verified: boolean; createdAt: string; user: { name: string | null; email: string } }
interface ClassTestRow { id: string; title: string; subject: string; totalQ: number; createdAt: string; studentCount: number; submittedCount: number; avgScore: number | null; rows: { studentName: string; studentEmail: string; scorePct: number | null; submitted: boolean; submittedAt: string | null; }[] }

const SUBJECTS = ['Biology', 'Physics', 'Chemistry'];

export default function TeacherPortalPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const { token } = useAuthStore();
  const [students, setStudents] = useState<Student[]>([]);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<'students' | 'report' | 'verify' | 'bulk-test'>('students');
  const [answers, setAnswers] = useState<AnswerMsg[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  // Bulk test state
  const [btTitle, setBtTitle] = useState('');
  const [btSubject, setBtSubject] = useState('Biology');
  const [btCount, setBtCount] = useState(10);
  const [creatingBT, setCreatingBT] = useState(false);
  const [btMsg, setBtMsg] = useState('');
  const [classTests, setClassTests] = useState<ClassTestRow[]>([]);
  const [loadingBT, setLoadingBT] = useState(false);
  const [expandedBT, setExpandedBT] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ students: Student[] }>('/api/teacher/students')
      .then((d) => setStudents(d.students))
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  const addStudent = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    setAddMsg('');
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

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', margin: '0 0 0.3rem' }}>
          <Users size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {isTa ? 'ஆசிரியர் போர்டல் | Teacher Portal' : 'Teacher Portal'}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {isTa ? 'உங்கள் மாணவர்களின் முன்னேற்றத்தை கண்காணிக்கவும்.' : 'Track your government school students\' NEET progress.'}
        </p>
      </div>

      {/* Add student */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>
          <Plus size={14} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          {isTa ? 'மாணவரை சேர்க்கவும்' : 'Add Student to Your Class'}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="student@email.com"
            style={{ flex: 1, padding: '0.6rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }} />
          <button onClick={addStudent} disabled={adding}
            style={{ padding: '0.6rem 1.2rem', background: adding ? '#9ca3af' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer' }}>
            {adding ? '…' : isTa ? 'சேர்' : 'Add'}
          </button>
        </div>
        {addMsg && <p style={{ color: addMsg.includes('added') || addMsg.includes('சேர்') ? '#059669' : '#dc2626', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>{addMsg}</p>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
    { key: 'students',  label: isTa ? '👥 மாணவர்கள்' : '👥 My Students' },
    { key: 'report',    label: isTa ? '📊 அறிக்கை' : '📊 Class Report' },
    { key: 'verify',    label: isTa ? '✅ சரிபார்' : '✅ Verify Answers' },
    { key: 'bulk-test', label: isTa ? '📝 வகுப்பு தேர்வு' : '📝 Bulk Test' },
  ].map((t) => (
          <button key={t.key} onClick={() => {
            setTab(t.key as typeof tab);
            if (t.key === 'report' && !report) getReport();
            if (t.key === 'verify' && answers.length === 0) {
              setLoadingAnswers(true);
              api.get<{ answers: AnswerMsg[] }>('/api/teacher/recent-answers')
                .then((d) => setAnswers(d.answers)).catch(() => {}).finally(() => setLoadingAnswers(false));
            }
            if (t.key === 'bulk-test' && classTests.length === 0) void loadBulkTests();
          }}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, background: tab === t.key ? '#1d4ed8' : '#e5e7eb', color: tab === t.key ? '#fff' : '#374151' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Students tab */}
      {tab === 'students' && (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          {loadingStudents ? (
            <p style={{ padding: '2rem', color: '#9ca3af', textAlign: 'center' }}>{isTa ? 'ஏற்றுகிறது…' : 'Loading…'}</p>
          ) : students.length === 0 ? (
            <p style={{ padding: '2rem', color: '#9ca3af', textAlign: 'center' }}>No students yet. Add students above using their registered email.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Name', 'School / District', 'Est. Score', 'Tests', 'Sessions', 'Diagnostic'].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{s.name ?? 'Unknown'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.email}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{s.school ?? '—'}<br /><span style={{ fontSize: '0.75rem' }}>{s.district ?? '—'}</span></td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {s.latestScoreEstimate ? (
                        <span style={{ fontWeight: 700, color: s.latestScoreEstimate >= 550 ? '#059669' : s.latestScoreEstimate >= 400 ? '#f59e0b' : '#dc2626' }}>{s.latestScoreEstimate}/720</span>
                      ) : <span style={{ color: '#9ca3af' }}>N/A</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{s._count.testAttempts}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{s._count.doubtHistory}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {s.diagnosticCompleted
                        ? <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.78rem' }}>✅ Done</span>
                        : <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.78rem' }}>⚠ Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Class report tab */}
      {tab === 'report' && (
        <div>
          {loadingReport && <p style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>{isTa ? 'வகுப்பு அறிக்கை உருவாக்கப்படுகிறது…' : 'Generating class report…'}</p>}
          {report?.message && !report.report && <p style={{ color: '#9ca3af' }}>{report.message}</p>}
          {report?.weakTopics && report.weakTopics.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>
                Class Weakness Data · {report.studentsAnalysed} students · {report.questionsAnalysed} questions
              </h3>
              {report.weakTopics.map((t) => (
                <div key={t.topic} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{t.topic}</span>
                    <span style={{ color: t.accuracy < 50 ? '#dc2626' : '#f59e0b', fontWeight: 700 }}>{t.accuracy}% ({t.total} Qs)</span>
                  </div>
                  <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '99px' }}>
                    <div style={{ height: '100%', borderRadius: '99px', background: t.accuracy < 50 ? '#dc2626' : '#f59e0b', width: `${t.accuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {report?.report && (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>
                <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                AI-Generated Class Report
              </h3>
              <MarkdownText content={report.report} style={{ fontSize: '0.875rem', color: '#374151' }} />
            </div>
          )}
          {!loadingReport && !report && (
            <button onClick={getReport}
              style={{ padding: '0.75rem 1.5rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              Generate Class Report
            </button>
          )}
        </div>
      )}

      {/* Bulk Test tab */}
      {tab === 'bulk-test' && (
        <div>
          {/* Create form */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ClipboardList size={15} /> Assign Test to Whole Class
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
              AI generates a fresh {btCount}-question test in {btSubject}. Every linked student gets their own attempt automatically.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input placeholder="Test title (e.g. Unit 3 Biology Revision)" value={btTitle} onChange={(e) => setBtTitle(e.target.value)}
                style={{ padding: '0.6rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }} />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {SUBJECTS.map((s) => (
                    <button key={s} onClick={() => setBtSubject(s)}
                      style={{ padding: '5px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        background: btSubject === s ? '#1d4ed8' : '#e5e7eb', color: btSubject === s ? '#fff' : '#374151' }}>
                      {s}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
                  Questions:
                  {[5, 10, 20, 30, 45].map((n) => (
                    <button key={n} onClick={() => setBtCount(n)}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        background: btCount === n ? '#1d4ed8' : '#e5e7eb', color: btCount === n ? '#fff' : '#374151' }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={createBulkTest} disabled={creatingBT || !btTitle.trim()}
                style={{ padding: '0.6rem 1.2rem', background: creatingBT || !btTitle.trim() ? '#9ca3af' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: creatingBT || !btTitle.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}>
                {creatingBT ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating & Assigning…</> : <><ClipboardList size={14} /> Create & Assign Test</>}
              </button>
              {btMsg && <p style={{ fontSize: '0.82rem', color: btMsg.startsWith('✅') ? '#059669' : '#dc2626', fontWeight: 600 }}>{btMsg}</p>}
            </div>
          </div>

          {/* Past class tests */}
          {loadingBT && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1.5rem' }}>Loading tests…</p>}
          {!loadingBT && classTests.length === 0 && (
            <p style={{ color: '#9ca3af', padding: '1rem' }}>No bulk tests yet. Create one above to assign it to your class.</p>
          )}
          {classTests.map((ct) => (
            <div key={ct.id} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <p style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem', margin: 0 }}>{ct.title}</p>
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '2px 0 0' }}>
                    {ct.subject} · {ct.totalQ} Qs · {new Date(ct.createdAt).toLocaleDateString('en-IN')} · {ct.submittedCount}/{ct.studentCount} submitted
                    {ct.avgScore !== null ? ` · Avg ${ct.avgScore}%` : ''}
                  </p>
                </div>
                <button onClick={() => setExpandedBT(expandedBT === ct.id ? null : ct.id)}
                  style={{ padding: '4px 12px', background: '#e5e7eb', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  {expandedBT === ct.id ? 'Hide' : 'See Results'}
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '99px', marginBottom: '8px' }}>
                <div style={{ height: '100%', borderRadius: '99px', background: '#059669', width: `${(ct.submittedCount / ct.studentCount) * 100}%` }} />
              </div>

              {/* Results table */}
              {expandedBT === ct.id && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '10px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#374151' }}>Student</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#374151' }}>Score</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#374151' }}>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ct.rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 10px' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{r.studentName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.studentEmail}</div>
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: r.scorePct === null ? '#9ca3af' : r.scorePct >= 60 ? '#059669' : r.scorePct >= 40 ? '#f59e0b' : '#dc2626' }}>
                          {r.scorePct !== null ? `${r.scorePct}%` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', color: r.submitted ? '#059669' : '#9ca3af', fontWeight: r.submitted ? 600 : 400 }}>
                          {r.submitted ? (r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN') : 'Yes') : 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Verify answers tab */}
      {tab === 'verify' && (
        <div>
          <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#065f46' }}>
            <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {isTa
              ? 'உங்கள் மாணவர்களுக்கு AI கொடுத்த பதில்களை சரிபார்க்கவும். சரிபார்க்கப்பட்ட பதில்களில் ✅ பேட்ஜ் காண்பிக்கப்படும்.'
              : 'Review AI answers given to your students. Verified answers show a ✅ Teacher Verified badge in the student chat.'}
          </div>
          {loadingAnswers && <p style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>{isTa ? 'சமீபத்திய பதில்கள் ஏற்றப்படுகிறது…' : 'Loading recent answers…'}</p>}
          {!loadingAnswers && answers.length === 0 && (
            <p style={{ color: '#9ca3af', padding: '1rem' }}>No AI answers found yet. Students need to use the AI Tutor first.</p>
          )}
          {answers.map((a) => (
            <div key={a.id} style={{ background: '#fff', borderRadius: '10px', border: `1px solid ${a.verified ? 'rgba(5,150,105,0.3)' : 'var(--border)'}`, padding: '1rem', marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  <strong>{a.user.name ?? a.user.email}</strong> · {a.subject} · {new Date(a.createdAt).toLocaleDateString('en-IN')}
                </div>
                {a.verified
                  ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={12} /> {isTa ? 'சரிபார்க்கப்பட்டது' : 'Verified'}
                    </span>
                  : (
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
                      style={{ padding: '4px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: verifying === a.id ? 'not-allowed' : 'pointer', opacity: verifying === a.id ? 0.6 : 1 }}>
                      {verifying === a.id ? '…' : isTa ? '✅ சரிபார்' : '✅ Verify'}
                    </button>
                  )}
              </div>
              <p style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.6, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {a.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
