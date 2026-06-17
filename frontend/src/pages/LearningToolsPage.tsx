import { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import {
  Share2, Brain, Smile, BarChart3, BookOpen, Zap,
  Lightbulb, Calculator, AlertCircle, Link2,
  Loader2, Copy, Check, Download, Save, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import MarkdownText from '../components/MarkdownText';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

// ── Types ──────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'ta' | 'tanglish';
type Subject = 'Biology' | 'Chemistry' | 'Physics' | 'General';

interface MindMapChild { id: string; label: string; description: string; }
interface MindMapBranch { id: string; label: string; description: string; children: MindMapChild[]; }
interface MindMapData { root: string; branches: MindMapBranch[]; neetQuestions: string[]; }

interface MnemonicData {
  mnemonic: string;
  explanation: string;
  breakdown: { letter: string; word: string; meaning: string }[];
}

interface CompareRow { feature: string; a: string; b: string; }
interface CompareData { title: string; headers: [string, string, string]; rows: CompareRow[]; summary: string; }

interface AnalogyData { analogy: string; explanation: string; realLifeContext: string; neetTip: string; }
interface WhyWrongData { wrongOptionAnalysis: string; commonMistake: string; correctReasoning: string; tip: string; }
interface ConnectorData { connection: string; similarities: string[]; differences: string[]; bridge: string; studyTip: string; }

type ToolOutput =
  | { type: 'mindmap'; data: MindMapData }
  | { type: 'mnemonic'; data: MnemonicData }
  | { type: 'compare'; data: CompareData }
  | { type: 'analogy'; data: AnalogyData }
  | { type: 'why-wrong'; data: WhyWrongData }
  | { type: 'connector'; data: ConnectorData }
  | { type: 'stream'; text: string };

interface SavedItem { id: string; toolType: string; title: string; content: Record<string, unknown>; createdAt: string; }

// ── Tool Config ────────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'mindmap',       name: 'AI Mind Map',          icon: Share2,      color: '#3B82F6', desc: 'Visual branching map of any topic',          streaming: false },
  { id: 'mnemonic',      name: 'Mnemonic Generator',   icon: Brain,       color: '#8B5CF6', desc: 'Tamil/English memory tricks for any list',   streaming: false },
  { id: 'eli5',          name: 'Explain Like I\'m 5',  icon: Smile,       color: '#F59E0B', desc: 'Simplest analogy-based child explanation',   streaming: true  },
  { id: 'compare',       name: 'Comparison Table',     icon: BarChart3,   color: '#10B981', desc: 'Side-by-side NEET comparison table',         streaming: false },
  { id: 'story',         name: 'AI Story Mode',        icon: BookOpen,    color: '#EC4899', desc: 'Learn via Tamil Nadu short stories',         streaming: true  },
  { id: 'quick-revise',  name: 'Quick Revise',         icon: Zap,         color: '#EF4444', desc: '5-minute NEET-only bullet revision',        streaming: true  },
  { id: 'analogy',       name: 'Analogy Engine',       icon: Lightbulb,   color: '#F97316', desc: 'Relatable local Tamil Nadu analogies',      streaming: false },
  { id: 'formula',       name: 'Formula Derivation',   icon: Calculator,  color: '#06B6D4', desc: 'Step-by-step from first principles',        streaming: true  },
  { id: 'why-wrong',     name: 'Why Is This Wrong?',   icon: AlertCircle, color: '#DC2626', desc: 'Dissect why a wrong PYQ option is wrong',   streaming: false },
  { id: 'connector',     name: 'Concept Connector',    icon: Link2,       color: '#7C3AED', desc: 'Cross-subject links (Enzymes ↔ Catalysts)', streaming: false },
] as const;

const SUBJECTS: Subject[] = ['Biology', 'Chemistry', 'Physics', 'General'];
const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'tanglish', label: 'Tanglish' },
];

const BRANCH_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#F97316', '#06B6D4'];

// ── Sub-components ─────────────────────────────────────────────────────────────

function MindMapView({ data }: { data: MindMapData }) {
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(data.branches.map(b => b.id)));

  const toggle = (id: string) => {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0' }}>
      {/* Root */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        color: '#fff',
        padding: '12px 28px',
        borderRadius: 50,
        fontWeight: 700,
        fontSize: '1.1rem',
        boxShadow: '0 4px 20px rgba(79,70,229,0.4)',
        textAlign: 'center',
      }}>
        {data.root}
      </div>

      {/* Connector */}
      <div style={{ width: 2, height: 20, background: '#cbd5e1' }} />

      {/* Branches grid */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900 }}>
        {data.branches.map((branch, i) => {
          const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
          const isOpen = expandedBranches.has(branch.id);
          return (
            <div key={branch.id} style={{
              minWidth: 170, maxWidth: 220,
              background: '#fff',
              border: `2px solid ${color}`,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              flex: '1 1 170px',
            }}>
              <button
                onClick={() => toggle(branch.id)}
                style={{
                  width: '100%',
                  background: color,
                  color: '#fff',
                  padding: '9px 12px',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>{branch.label}</span>
                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {isOpen && (
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {branch.description && (
                    <p style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
                      {branch.description}
                    </p>
                  )}
                  {branch.children.map(child => (
                    <div key={child.id} style={{
                      borderLeft: `3px solid ${color}`,
                      paddingLeft: 8,
                      paddingTop: 2,
                      paddingBottom: 2,
                    }}>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#1e293b', margin: 0 }}>{child.label}</p>
                      {child.description && (
                        <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '2px 0 0' }}>{child.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* NEET Questions */}
      {data.neetQuestions.length > 0 && (
        <div style={{
          background: 'rgba(79,70,229,0.06)',
          border: '1px solid rgba(79,70,229,0.2)',
          borderRadius: 10,
          padding: '12px 16px',
          width: '100%',
          maxWidth: 700,
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#4f46e5', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Likely NEET Questions
          </p>
          {data.neetQuestions.map((q, i) => (
            <p key={i} style={{ fontSize: '0.82rem', color: '#374151', margin: '4px 0', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: '#4f46e5', marginRight: 6 }}>{i + 1}.</span>{q}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function MnemonicView({ data }: { data: MnemonicData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(79,70,229,0.06))',
        border: '2px solid rgba(139,92,246,0.3)',
        borderRadius: 14,
        padding: '20px 24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed', letterSpacing: '0.15em', marginBottom: 8 }}>
          {data.mnemonic}
        </p>
        <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6 }}>{data.explanation}</p>
      </div>

      {data.breakdown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontWeight: 700, fontSize: '0.75rem', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Breakdown</p>
          {data.breakdown.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '8px 14px',
            }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#7c3aed', minWidth: 24 }}>{item.letter}</span>
              <span style={{ fontWeight: 600, color: '#1e293b', minWidth: 120 }}>{item.word}</span>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{item.meaning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompareView({ data }: { data: CompareData }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const copyAsMarkdown = () => {
    const header = `| ${data.headers[0]} | ${data.headers[1]} | ${data.headers[2]} |`;
    const divider = '|---|---|---|';
    const rows = data.rows.map(r => `| ${r.feature} | ${r.a} | ${r.b} |`).join('\n');
    navigator.clipboard.writeText([header, divider, rows].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPNG = async () => {
    if (!tableRef.current || downloading) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(tableRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      link.download = `${data.title.replace(/\s+/g, '_')}_comparison.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
        <button onClick={copyAsMarkdown} style={btnStyle('#10B981')}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy Table'}
        </button>
        <button onClick={downloadPNG} disabled={downloading} style={btnStyle('#6366f1')}>
          {downloading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
          {downloading ? 'Saving…' : 'Download PNG'}
        </button>
      </div>
      <div ref={tableRef} style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.83rem',
          background: '#fff',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        }}>
          <thead>
            <tr style={{ background: '#10B981' }}>
              {data.headers.map((h, i) => (
                <th key={i} style={{ color: '#fff', padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '9px 14px', fontWeight: 600, color: '#374151' }}>{row.feature}</td>
                <td style={{ padding: '9px 14px', color: '#4b5563' }}>{row.a}</td>
                <td style={{ padding: '9px 14px', color: '#4b5563' }}>{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.summary && (
        <div style={{
          marginTop: 12,
          background: 'rgba(16,185,129,0.07)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: '0.83rem',
          color: '#374151',
          lineHeight: 1.6,
        }}>
          <strong>Key Distinction:</strong> {data.summary}
        </div>
      )}
    </div>
  );
}

function AnalogyView({ data }: { data: AnalogyData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 12, padding: '16px 18px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.72rem', color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>The Analogy</p>
        <p style={{ fontSize: '1rem', color: '#1e293b', lineHeight: 1.6, fontStyle: 'italic' }}>"{data.analogy}"</p>
      </div>
      <InfoCard title="How It Maps to the Science" body={data.explanation} color="#3B82F6" />
      <InfoCard title="Where You'd See This in Tamil Nadu" body={data.realLifeContext} color="#10B981" />
      <InfoCard title="NEET Tip" body={data.neetTip} color="#8B5CF6" />
    </div>
  );
}

function WhyWrongView({ data }: { data: WhyWrongData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 12, padding: '16px 18px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.72rem', color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Why That Option Is WRONG</p>
        <p style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.65 }}>{data.wrongOptionAnalysis}</p>
      </div>
      <InfoCard title="Why Students Pick This (The Trap)" body={data.commonMistake} color="#F97316" />
      <InfoCard title="Why the Correct Answer Is Right" body={data.correctReasoning} color="#10B981" />
      <div style={{ background: 'rgba(79,70,229,0.07)', border: '1px solid rgba(79,70,229,0.25)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: '1.2rem' }}>💡</span>
        <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#4f46e5', lineHeight: 1.5, margin: 0 }}>{data.tip}</p>
      </div>
    </div>
  );
}

function ConnectorView({ data }: { data: ConnectorData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 12, padding: '16px 18px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.72rem', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>The Connection</p>
        <p style={{ fontSize: '0.95rem', color: '#1e293b', lineHeight: 1.65 }}>{data.connection}</p>
      </div>
      {data.similarities.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
          <p style={{ fontWeight: 700, fontSize: '0.75rem', color: '#10B981', marginBottom: 8, textTransform: 'uppercase' }}>Similarities</p>
          {data.similarities.map((s, i) => (
            <p key={i} style={{ fontSize: '0.85rem', color: '#374151', margin: '4px 0', lineHeight: 1.5 }}>✓ {s}</p>
          ))}
        </div>
      )}
      {data.differences.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
          <p style={{ fontWeight: 700, fontSize: '0.75rem', color: '#EF4444', marginBottom: 8, textTransform: 'uppercase' }}>Key Differences</p>
          {data.differences.map((d, i) => (
            <p key={i} style={{ fontSize: '0.85rem', color: '#374151', margin: '4px 0', lineHeight: 1.5 }}>• {d}</p>
          ))}
        </div>
      )}
      <div style={{ background: 'rgba(79,70,229,0.07)', border: '1px solid rgba(79,70,229,0.25)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: '1.2rem' }}>🌉</span>
        <div>
          <p style={{ fontWeight: 700, fontSize: '0.75rem', color: '#4f46e5', marginBottom: 4 }}>The Bridge</p>
          <p style={{ fontSize: '0.88rem', color: '#374151', lineHeight: 1.5, margin: 0 }}>{data.bridge}</p>
        </div>
      </div>
      <InfoCard title="Exam Day Tip" body={data.studyTip} color="#10B981" />
    </div>
  );
}

function StreamView({ text, streaming }: { text: string; streaming?: boolean }) {
  const containerStyle = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px 20px',
    fontSize: '0.88rem',
    color: '#1e293b',
    minHeight: 80,
  };
  if (!text) return <div style={containerStyle}><span style={{ color: '#94a3b8' }}>Output will appear here…</span></div>;
  if (streaming) return <div style={{ ...containerStyle, whiteSpace: 'pre-wrap', lineHeight: 1.8, wordBreak: 'break-word' }}>{text}</div>;
  return <MarkdownText content={text} style={containerStyle} />;
}

function InfoCard({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
      <p style={{ fontWeight: 700, fontSize: '0.72rem', color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{title}</p>
      <p style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.6, margin: 0 }}>{body}</p>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    background: color, color: '#fff',
    border: 'none', borderRadius: 7, padding: '6px 12px',
    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
  };
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LearningToolsPage() {
  const { token } = useAuthStore();

  const [activeTool, setActiveTool] = useState<string>('mindmap');
  const [language, setLanguage] = useState<Lang>('en');
  const [subject, setSubject] = useState<Subject>('Biology');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<ToolOutput | null>(null);
  const [streamText, setStreamText] = useState('');
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  // Per-tool inputs
  const [topic, setTopic] = useState('');
  const [topicA, setTopicA] = useState('');
  const [topicB, setTopicB] = useState('');
  const [items, setItems] = useState('');
  const [concept, setConcept] = useState('');
  const [formula, setFormula] = useState('');
  const [question, setQuestion] = useState('');
  const [wrongOption, setWrongOption] = useState('');
  const [correctOption, setCorrectOption] = useState('');

  const outputRef = useRef<HTMLDivElement>(null);
  const toolConfig = TOOLS.find(t => t.id === activeTool)!;

  useEffect(() => {
    if (output || streamText) {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [output, streamText]);

  const loadSaved = useCallback(async () => {
    try {
      const res = await api.get<{ items: SavedItem[] }>('/api/learning-tools/saved');
      setSavedItems(res.items);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (showSaved) loadSaved();
  }, [showSaved, loadSaved]);

  const resetOutput = () => {
    setOutput(null);
    setStreamText('');
    setError('');
  };

  const handleToolChange = (id: string) => {
    setActiveTool(id);
    resetOutput();
  };

  // ── JSON tool call ───────────────────────────────────────────────────────────
  const callJSON = async (endpoint: string, body: Record<string, unknown>) => {
    setIsLoading(true);
    setError('');
    resetOutput();
    try {
      const data = await api.post<Record<string, unknown>>(`/api/learning-tools/${endpoint}`, { ...body, language });
      setOutput({ type: endpoint as ToolOutput['type'], data } as unknown as ToolOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Streaming tool call ──────────────────────────────────────────────────────
  const callStream = async (endpoint: string, body: Record<string, unknown>) => {
    setIsLoading(true);
    setError('');
    setStreamText('');
    setOutput(null);

    try {
      const res = await fetch(`${API_BASE}/api/learning-tools/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...body, language }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Generation failed');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') { setIsLoading(false); return; }
          try {
            const { text } = JSON.parse(raw) as { text?: string };
            if (text) setStreamText(prev => prev + text);
          } catch { /* partial chunk */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Generate dispatcher ──────────────────────────────────────────────────────
  const handleGenerate = () => {
    switch (activeTool) {
      case 'mindmap':      return callJSON('mindmap', { topic, subject });
      case 'mnemonic':     return callJSON('mnemonic', { items });
      case 'eli5':         return callStream('eli5', { concept, subject });
      case 'compare':      return callJSON('compare', { topicA, topicB, subject });
      case 'story':        return callStream('story', { concept, subject });
      case 'quick-revise': return callStream('quick-revise', { topic, subject });
      case 'analogy':      return callJSON('analogy', { concept, subject });
      case 'formula':      return callStream('formula', { formula, subject });
      case 'why-wrong':    return callJSON('why-wrong', { question, wrongOption, correctOption, subject });
      case 'connector':    return callJSON('connector', { topicA, topicB });
    }
  };

  const canGenerate = (): boolean => {
    if (isLoading) return false;
    switch (activeTool) {
      case 'mindmap':      return topic.trim().length > 0;
      case 'mnemonic':     return items.trim().length > 0;
      case 'eli5':         return concept.trim().length > 0;
      case 'compare':      return topicA.trim().length > 0 && topicB.trim().length > 0;
      case 'story':        return concept.trim().length > 0;
      case 'quick-revise': return topic.trim().length > 0;
      case 'analogy':      return concept.trim().length > 0;
      case 'formula':      return formula.trim().length > 0;
      case 'why-wrong':    return question.trim().length > 0 && wrongOption.trim().length > 0 && correctOption.trim().length > 0;
      case 'connector':    return topicA.trim().length > 0 && topicB.trim().length > 0;
      default: return false;
    }
  };

  const handleSave = async () => {
    if (!output || (output.type !== 'mindmap' && output.type !== 'mnemonic')) return;
    try {
      const title = output.type === 'mindmap'
        ? (output.data as MindMapData).root
        : (output.data as MnemonicData).mnemonic;
      await api.post('/api/learning-tools/save', {
        toolType: output.type,
        title,
        content: output.data as unknown as Record<string, unknown>,
      });
      loadSaved();
    } catch { /* ignore */ }
  };

  const handleDeleteSaved = async (id: string) => {
    await api.del(`/api/learning-tools/saved/${id}`);
    setSavedItems(prev => prev.filter(i => i.id !== id));
  };


  // ── Input form for each tool ─────────────────────────────────────────────────
  const renderInputForm = () => {
    const inputStyle: React.CSSProperties = {
      width: '100%', padding: '9px 12px',
      border: '1px solid #e2e8f0', borderRadius: 8,
      fontSize: '0.88rem', background: '#fff', color: '#1e293b',
      outline: 'none',
    };
    const labelStyle: React.CSSProperties = {
      fontWeight: 600, fontSize: '0.78rem', color: '#475569', marginBottom: 4, display: 'block',
    };

    switch (activeTool) {
      case 'mindmap':
      case 'quick-revise':
        return (
          <>
            <SubjectSelector subject={subject} onChange={setSubject} />
            <div>
              <label style={labelStyle}>Topic</label>
              <input
                style={inputStyle}
                placeholder={activeTool === 'mindmap' ? 'e.g. Photosynthesis, Cell Division, Newton\'s Laws' : 'e.g. Cell Biology, Acids & Bases'}
                value={topic} onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canGenerate() && handleGenerate()}
              />
            </div>
          </>
        );

      case 'mnemonic':
        return (
          <div>
            <label style={labelStyle}>Items to memorize (one per line or comma-separated)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              placeholder={'e.g.\nCranial nerve 1: Olfactory\nCranial nerve 2: Optic\n...\n\nOr: Olfactory, Optic, Oculomotor, Trochlear, Trigeminal...'}
              value={items} onChange={e => setItems(e.target.value)}
            />
          </div>
        );

      case 'eli5':
      case 'story':
      case 'analogy':
        return (
          <>
            <SubjectSelector subject={subject} onChange={setSubject} />
            <div>
              <label style={labelStyle}>Concept</label>
              <input
                style={inputStyle}
                placeholder={
                  activeTool === 'eli5' ? 'e.g. Osmosis, Newton\'s 3rd Law, Mitosis' :
                  activeTool === 'story' ? 'e.g. Cell Membrane as a Security Guard, DNA Replication' :
                  'e.g. Osmosis, Electrochemistry, Gravitational Force'
                }
                value={concept} onChange={e => setConcept(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canGenerate() && handleGenerate()}
              />
            </div>
          </>
        );

      case 'compare':
        return (
          <>
            <SubjectSelector subject={subject} onChange={setSubject} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Topic A</label>
                <input style={inputStyle} placeholder="e.g. Mitosis" value={topicA} onChange={e => setTopicA(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Topic B</label>
                <input style={inputStyle} placeholder="e.g. Meiosis" value={topicB} onChange={e => setTopicB(e.target.value)} />
              </div>
            </div>
          </>
        );

      case 'formula':
        return (
          <>
            <SubjectSelector subject={subject} onChange={setSubject} />
            <div>
              <label style={labelStyle}>Formula or Equation</label>
              <input
                style={inputStyle}
                placeholder="e.g. E = mc², PV = nRT, v² = u² + 2as, Henderson-Hasselbalch"
                value={formula} onChange={e => setFormula(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canGenerate() && handleGenerate()}
              />
            </div>
          </>
        );

      case 'why-wrong':
        return (
          <>
            <SubjectSelector subject={subject} onChange={setSubject} />
            <div>
              <label style={labelStyle}>Question</label>
              <textarea
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                placeholder="Paste the NEET question here..."
                value={question} onChange={e => setQuestion(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Wrong Option You Picked</label>
                <input style={inputStyle} placeholder="e.g. ATP synthesis occurs in cytoplasm" value={wrongOption} onChange={e => setWrongOption(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Correct Answer</label>
                <input style={inputStyle} placeholder="e.g. ATP synthesis occurs in mitochondria" value={correctOption} onChange={e => setCorrectOption(e.target.value)} />
              </div>
            </div>
          </>
        );

      case 'connector':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Topic A</label>
              <input style={inputStyle} placeholder="e.g. Enzymes (Biology)" value={topicA} onChange={e => setTopicA(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Topic B</label>
              <input style={inputStyle} placeholder="e.g. Catalysts (Chemistry)" value={topicB} onChange={e => setTopicB(e.target.value)} />
            </div>
          </div>
        );

      default: return null;
    }
  };

  const renderOutput = () => {
    if (isLoading && !streamText) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, color: '#64748b' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.9rem' }}>Generating with AI…</span>
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '12px 16px', color: '#DC2626', fontSize: '0.85rem' }}>
          {error}
        </div>
      );
    }

    if (toolConfig.streaming && streamText) {
      return <StreamView text={streamText} />;
    }

    if (!output) return null;

    switch (output.type) {
      case 'mindmap':    return <MindMapView data={output.data as MindMapData} />;
      case 'mnemonic':   return <MnemonicView data={output.data as MnemonicData} />;
      case 'compare':    return <CompareView data={output.data as CompareData} />;
      case 'analogy':    return <AnalogyView data={output.data as AnalogyData} />;
      case 'why-wrong':  return <WhyWrongView data={output.data as WhyWrongData} />;
      case 'connector':  return <ConnectorView data={output.data as ConnectorData} />;
      default: return null;
    }
  };

  const hasOutput = !!output || !!streamText;
  const canSave = output && (output.type === 'mindmap' || output.type === 'mnemonic');

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>AI Learning Tools</h1>
        <p style={{ color: '#64748b', fontSize: '0.88rem' }}>10 AI-powered study tools — from mind maps to story mode, built for NEET toppers.</p>
      </div>

      {/* Tool grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 10,
        marginBottom: 24,
      }}>
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolChange(tool.id)}
              style={{
                background: isActive ? tool.color : '#fff',
                border: `2px solid ${isActive ? tool.color : '#e2e8f0'}`,
                borderRadius: 12,
                padding: '14px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 4px 16px ${tool.color}33` : '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon size={16} color={isActive ? '#fff' : tool.color} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isActive ? '#fff' : '#1e293b' }}>
                  {tool.name}
                </span>
              </div>
              <p style={{ fontSize: '0.68rem', color: isActive ? 'rgba(255,255,255,0.8)' : '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                {tool.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active tool panel */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      }}>
        {/* Panel header */}
        <div style={{
          background: `linear-gradient(135deg, ${toolConfig.color}15, ${toolConfig.color}08)`,
          borderBottom: `1px solid ${toolConfig.color}25`,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: toolConfig.color,
              borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <toolConfig.icon size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{toolConfig.name}</h2>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{toolConfig.desc}</p>
            </div>
          </div>
          {/* Language selector */}
          <div style={{ display: 'flex', gap: 6 }}>
            {LANGS.map(l => (
              <button
                key={l.value}
                onClick={() => setLanguage(l.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: `1px solid ${language === l.value ? toolConfig.color : '#e2e8f0'}`,
                  background: language === l.value ? toolConfig.color : '#fff',
                  color: language === l.value ? '#fff' : '#64748b',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input section */}
        <div style={{ padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {renderInputForm()}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate()}
              style={{
                background: canGenerate() ? toolConfig.color : '#e2e8f0',
                color: canGenerate() ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: 9,
                padding: '11px 24px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: canGenerate() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                alignSelf: 'flex-start',
                transition: 'all 0.15s ease',
              }}
            >
              {isLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <toolConfig.icon size={15} />}
              {isLoading ? 'Generating…' : `Generate ${toolConfig.name}`}
            </button>
          </div>
        </div>

        {/* Output section */}
        {(hasOutput || error) && (
          <div ref={outputRef} style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Output</p>
              {canSave && (
                <button onClick={handleSave} style={btnStyle('#4f46e5')}>
                  <Save size={13} /> Save
                </button>
              )}
            </div>
            {renderOutput()}
          </div>
        )}
      </div>

      {/* Saved items */}
      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => setShowSaved(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: '1px solid #e2e8f0',
            borderRadius: 8, padding: '7px 14px',
            color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showSaved ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showSaved ? 'Hide' : 'Show'} Saved Mind Maps & Mnemonics
        </button>

        {showSaved && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savedItems.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No saved items yet. Generate a mind map or mnemonic and hit Save.</p>
            ) : savedItems.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px',
              }}>
                <div>
                  <span style={{
                    display: 'inline-block', background: item.toolType === 'mindmap' ? '#3B82F620' : '#8B5CF620',
                    color: item.toolType === 'mindmap' ? '#3B82F6' : '#8B5CF6',
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, marginRight: 8, textTransform: 'uppercase',
                  }}>
                    {item.toolType}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{item.title}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: 8 }}>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={() => handleDeleteSaved(item.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          .dashboard-layout aside,
          .dashboard-layout header { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Subject selector ───────────────────────────────────────────────────────────

function SubjectSelector({ subject, onChange }: { subject: Subject; onChange: (s: Subject) => void }) {
  const COLORS: Record<Subject, string> = {
    Biology: '#10B981', Chemistry: '#3B82F6', Physics: '#F97316', General: '#8B5CF6',
  };
  return (
    <div>
      <span style={{ fontWeight: 600, fontSize: '0.78rem', color: '#475569', display: 'block', marginBottom: 6 }}>Subject</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SUBJECTS.map(s => (
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              background: subject === s ? COLORS[s] : '#fff',
              border: `1.5px solid ${subject === s ? COLORS[s] : '#e2e8f0'}`,
              color: subject === s ? '#fff' : '#64748b',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
