import { useState, useEffect } from 'react';
import { BookOpen, FlaskConical, Atom, Clock, LogOut, ChevronRight, ChevronDown } from 'lucide-react';

// ── Static content (no backend) ──────────────────────────────────────────────

const PYQ_QUESTIONS = [
  { subject: 'Biology', q: 'Which of the following organelles is known as the "powerhouse of the cell"?', opts: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'], ans: 2, exp: 'Mitochondria produce ATP via oxidative phosphorylation — the cell\'s energy currency.' },
  { subject: 'Biology', q: 'The lac operon in E. coli is an example of:', opts: ['Inducible operon', 'Repressible operon', 'Constitutive expression', 'Post-translational regulation'], ans: 0, exp: 'Lac operon is induced by allolactose (a lactose metabolite) when glucose is absent.' },
  { subject: 'Biology', q: 'Which type of RNA carries the genetic code from DNA to the ribosome?', opts: ['rRNA', 'tRNA', 'mRNA', 'snRNA'], ans: 2, exp: 'Messenger RNA (mRNA) is the intermediate transcript from DNA used for translation.' },
  { subject: 'Biology', q: 'In a dihybrid cross between RRYY × rryy, the F2 ratio is:', opts: ['3:1', '1:1', '9:3:3:1', '1:2:1'], ans: 2, exp: 'Mendel\'s law of independent assortment gives the classic 9:3:3:1 ratio in F2.' },
  { subject: 'Chemistry', q: 'Which of the following has the highest electronegativity?', opts: ['Oxygen', 'Fluorine', 'Chlorine', 'Nitrogen'], ans: 1, exp: 'Fluorine has the highest electronegativity (3.98 on Pauling scale).' },
  { subject: 'Chemistry', q: 'The IUPAC name of CH3–CH(OH)–CH3 is:', opts: ['1-propanol', '2-propanol', 'propan-1-ol', 'propanone'], ans: 1, exp: 'The OH group is on carbon 2, so this is propan-2-ol (2-propanol).' },
  { subject: 'Chemistry', q: 'Which type of isomerism is shown by [Co(NH3)5Cl]SO4 and [Co(NH3)5SO4]Cl?', opts: ['Linkage', 'Ionisation', 'Geometric', 'Optical'], ans: 1, exp: 'The anion exchanges position inside and outside the coordination sphere — ionisation isomerism.' },
  { subject: 'Physics', q: 'A body is thrown vertically upward. At its highest point, its acceleration is:', opts: ['Zero', 'g downward', 'g upward', '2g downward'], ans: 1, exp: 'Gravity always acts downward at g ≈ 9.8 m/s², even at the top of the trajectory.' },
  { subject: 'Physics', q: 'The unit of electric field intensity is:', opts: ['C/m', 'N/C', 'J/C', 'V·m'], ans: 1, exp: 'Electric field E = F/q, so units are N/C (equivalent to V/m).' },
  { subject: 'Physics', q: 'Which law states that the total EMF in a closed loop equals the sum of IR drops?', opts: ['Ohm\'s law', 'Kirchhoff\'s Voltage Law', 'Gauss\'s law', 'Faraday\'s law'], ans: 1, exp: 'Kirchhoff\'s Voltage Law (KVL): ΣV = 0 around any closed loop.' },
];

const VOCAB_TERMS: Record<string, string[]> = {
  Biology: ['Mitosis', 'Meiosis', 'Mitochondria', 'Chloroplast', 'Ribosome', 'Enzyme', 'Hormone', 'Synapse', 'Osmosis', 'Diffusion', 'Photosynthesis', 'Respiration', 'Haemoglobin', 'Antibody', 'Genome'],
  Chemistry: ['Oxidation', 'Reduction', 'Catalyst', 'Electronegativity', 'Hybridisation', 'pH', 'Titration', 'Polymer', 'Isomer', 'Ligand', 'Enthalpy', 'Entropy', 'Molarity', 'Electrolyte', 'Buffer'],
  Physics: ['Velocity', 'Momentum', 'Torque', 'Refraction', 'Diffraction', 'Capacitor', 'Inductor', 'Entropy', 'Photoelectric effect', 'Semiconductor', 'Radioactivity', 'Amplitude', 'Frequency', 'Impedance', 'Flux'],
};

const FORMULAS: { section: string; sectionTa: string; items: { name: string; formula: string; note: string }[] }[] = [
  {
    section: 'Physics — Mechanics',
    sectionTa: 'Physics — இயக்கவியல்',
    items: [
      { name: 'Newton\'s 2nd Law', formula: 'F = ma', note: 'Force = mass × acceleration' },
      { name: 'Kinetic Energy', formula: 'KE = ½mv²', note: 'm = mass, v = velocity' },
      { name: 'Gravitational PE', formula: 'PE = mgh', note: 'h = height above reference' },
      { name: 'Equations of motion', formula: 'v = u + at | s = ut + ½at²', note: 'u = initial vel, a = accel' },
    ],
  },
  {
    section: 'Physics — Electricity',
    sectionTa: 'Physics — மின்னியல்',
    items: [
      { name: 'Ohm\'s Law', formula: 'V = IR', note: 'V = voltage, I = current, R = resistance' },
      { name: 'Power', formula: 'P = VI = I²R = V²/R', note: 'All three forms used in NEET' },
      { name: 'Coulomb\'s Law', formula: 'F = kq₁q₂/r²', note: 'k = 9×10⁹ N·m²/C²' },
    ],
  },
  {
    section: 'Chemistry — Thermodynamics',
    sectionTa: 'Chemistry — வெப்பவியக்கவியல்',
    items: [
      { name: 'Gibbs Free Energy', formula: 'ΔG = ΔH − TΔS', note: 'ΔG < 0 → spontaneous reaction' },
      { name: 'Arrhenius Equation', formula: 'k = Ae^(−Ea/RT)', note: 'Ea = activation energy' },
      { name: 'Ideal Gas Law', formula: 'PV = nRT', note: 'R = 8.314 J/mol·K' },
    ],
  },
  {
    section: 'Chemistry — Solutions',
    sectionTa: 'Chemistry — கரைசல்கள்',
    items: [
      { name: 'Molarity', formula: 'M = n/V(L)', note: 'n = moles, V = volume in litres' },
      { name: 'pH', formula: 'pH = −log[H⁺]', note: 'pH + pOH = 14 at 25°C' },
      { name: 'Henderson-Hasselbalch', formula: 'pH = pKa + log([A⁻]/[HA])', note: 'Buffer equation' },
    ],
  },
];

// ── Component ────────────────────────────────────────────────────────────────

type Tab = 'pyq' | 'vocab' | 'formulas';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function KioskSessionPage() {
  const lang = (sessionStorage.getItem('kiosk_lang') ?? 'en') as 'en' | 'ta';
  const isTa = lang === 'ta';

  const [tab, setTab] = useState<Tab>('pyq');
  const [elapsed, setElapsed] = useState(0);

  // PYQ state
  const [qIdx, setQIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [subject, setSubject] = useState<'All' | 'Biology' | 'Chemistry' | 'Physics'>('All');

  // Vocab state
  const [vocabSubject, setVocabSubject] = useState<'Biology' | 'Chemistry' | 'Physics'>('Biology');

  // Formula state
  const [openSection, setOpenSection] = useState<string | null>(FORMULAS[0].section);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const endSession = () => {
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const filteredQ = subject === 'All' ? PYQ_QUESTIONS : PYQ_QUESTIONS.filter((q) => q.subject === subject);
  const q = filteredQ[qIdx % filteredQ.length];

  const handleAnswer = (i: number) => {
    if (revealed) return;
    setChosen(i);
    setRevealed(true);
    setAttempted((a) => a + 1);
    if (i === q.ans) setCorrect((c) => c + 1);
  };

  const nextQ = () => {
    setQIdx((i) => (i + 1) % filteredQ.length);
    setChosen(null);
    setRevealed(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: '#854d0e', color: '#fef9c3', padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} />
          {isTa ? 'விருந்தினர் அமர்வு — இந்த அமர்வை முடிக்கும்போது எதுவும் சேமிக்கப்படாது' : 'Guest Session — Nothing is saved when you end this session'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>⏱ {formatTime(elapsed)}</span>
          <button onClick={endSession}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.25)', border: 'none', color: '#fef9c3', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
            <LogOut size={13} /> {isTa ? 'அமர்வை முடி' : 'End Session'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: '860px', margin: '0 auto', width: '100%', padding: '1.5rem' }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
          <BookOpen size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>NEET AI</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {isTa ? '— விருந்தினர் படிப்பு அமர்வு' : '— Guest Study Session'}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem' }}>
          {([
            ['pyq', <BookOpen size={15} key="b" />, isTa ? 'PYQ அட்டைகள்' : 'PYQ Flashcards'],
            ['vocab', <FlaskConical size={15} key="f" />, isTa ? 'சொல்லகராதி' : 'Vocabulary'],
            ['formulas', <Atom size={15} key="a" />, isTa ? 'சூத்திர தாள்' : 'Formula Sheet'],
          ] as const).map(([t, icon, label]) => (
            <button key={t} onClick={() => setTab(t as Tab)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', background: tab === t ? 'var(--accent)' : 'var(--bg-surface)', color: tab === t ? '#fff' : 'var(--text-secondary)', outline: `1px solid ${tab === t ? 'transparent' : 'var(--border)'}` }}>
              {icon}{label}
            </button>
          ))}
          {tab === 'pyq' && attempted > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 700, color: correct / attempted >= 0.7 ? '#059669' : '#d97706', alignSelf: 'center' }}>
              {isTa ? `மதிப்பெண்: ${correct}/${attempted}` : `Score: ${correct}/${attempted}`}
            </span>
          )}
        </div>

        {/* ── PYQ Flashcards ── */}
        {tab === 'pyq' && (
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '1.25rem' }}>
              {(['All', 'Biology', 'Chemistry', 'Physics'] as const).map((s) => (
                <button key={s} onClick={() => { setSubject(s); setQIdx(0); setChosen(null); setRevealed(false); }}
                  style={{ padding: '5px 14px', borderRadius: '7px', border: `1px solid ${subject === s ? 'transparent' : 'var(--border)'}`, fontWeight: 600, fontSize: '12px', cursor: 'pointer', background: subject === s ? 'var(--accent)' : 'var(--bg-surface)', color: subject === s ? '#fff' : 'var(--text-secondary)' }}>
                  {s === 'All' ? (isTa ? 'அனைத்தும்' : 'All') : s}
                </button>
              ))}
            </div>

            <div className="feature-card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span style={{ background: 'rgba(79,70,229,0.1)', color: 'var(--accent)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>{q.subject}</span>
                <span>{isTa ? `வி ${(qIdx % filteredQ.length) + 1} / ${filteredQ.length}` : `Q ${(qIdx % filteredQ.length) + 1} / ${filteredQ.length}`}</span>
              </div>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.65, marginBottom: '1.25rem' }}>{q.q}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.opts.map((opt, i) => {
                  const isChosen = chosen === i;
                  const isCorrect = revealed && i === q.ans;
                  const isWrong = revealed && isChosen && i !== q.ans;
                  return (
                    <button key={i} onClick={() => handleAnswer(i)}
                      style={{ padding: '11px 15px', borderRadius: '9px', textAlign: 'left', cursor: revealed ? 'default' : 'pointer', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, border: `1.5px solid ${isCorrect ? '#059669' : isWrong ? '#dc2626' : isChosen ? 'var(--accent)' : 'var(--border)'}`, background: isCorrect ? '#f0fdf4' : isWrong ? '#fef2f2' : isChosen ? 'rgba(79,70,229,0.06)' : 'var(--bg-surface)' }}>
                      <strong>{String.fromCharCode(65 + i)}.</strong> {opt}
                    </button>
                  );
                })}
              </div>
              {revealed && (
                <div style={{ marginTop: '1rem', background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px' }}>
                  <p style={{ fontSize: '0.82rem', color: '#166534', margin: 0, lineHeight: 1.6 }}>✅ {q.exp}</p>
                </div>
              )}
            </div>
            {revealed && (
              <button onClick={nextQ} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isTa ? 'அடுத்த வினா' : 'Next Question'} <ChevronRight size={15} />
              </button>
            )}
          </div>
        )}

        {/* ── Vocabulary browse ── */}
        {tab === 'vocab' && (
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '1.25rem' }}>
              {(['Biology', 'Chemistry', 'Physics'] as const).map((s) => (
                <button key={s} onClick={() => setVocabSubject(s)}
                  style={{ padding: '6px 16px', borderRadius: '8px', border: `1px solid ${vocabSubject === s ? 'transparent' : 'var(--border)'}`, fontWeight: 600, fontSize: '13px', cursor: 'pointer', background: vocabSubject === s ? 'var(--accent)' : 'var(--bg-surface)', color: vocabSubject === s ? '#fff' : 'var(--text-secondary)' }}>
                  {s}
                </button>
              ))}
            </div>
            <div className="feature-card">
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                {isTa ? `முக்கிய ${vocabSubject} சொற்கள் — உங்கள் பாடப்புத்தகத்தில் பாருங்கள்` : `Key ${vocabSubject} terms — look these up in your textbook`}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {VOCAB_TERMS[vocabSubject].map((term) => (
                  <span key={term} style={{ padding: '6px 14px', borderRadius: '99px', background: 'rgba(79,70,229,0.07)', color: 'var(--accent)', border: '1px solid rgba(79,70,229,0.15)', fontSize: '13px', fontWeight: 600 }}>
                    {term}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                {isTa
                  ? 'AI விளக்கங்கள், தமிழ் மொழிபெயர்ப்புகள் மற்றும் நினைவுக்குறிப்புகளுக்கு இலவச கணக்கில் உள்நுழையவும்.'
                  : 'Log in with a free account to get AI explanations, Tamil translations, and mnemonics for each term.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Formula Sheet ── */}
        {tab === 'formulas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FORMULAS.map(({ section, sectionTa, items }) => (
              <div key={section} className="feature-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button onClick={() => setOpenSection(openSection === section ? null : section)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {isTa ? sectionTa : section}
                  {openSection === section ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {openSection === section && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {items.map(({ name, formula, note }) => (
                      <div key={name} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                        <code style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)', fontSize: '14px' }}>{formula}</code>
                        <span style={{ color: 'var(--text-muted)' }}>{note}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
