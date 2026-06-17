import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, Coffee, BookOpen } from 'lucide-react';

type Phase = 'work' | 'break' | 'long_break';
const DURATIONS: Record<Phase, number> = { work: 25 * 60, break: 5 * 60, long_break: 15 * 60 };
const PHASE_LABELS: Record<Phase, string> = { work: 'Focus', break: 'Short Break', long_break: 'Long Break' };
const PHASE_COLORS: Record<Phase, string> = { work: '#6366f1', break: '#22c55e', long_break: '#06b6d4' };

function fmt(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const TIPS = [
  'Keep your NCERT textbook open — passive re-reading during breaks helps consolidate memory.',
  'Quick stretch after every Pomodoro — blood flow helps concentration.',
  'One Pomodoro = ~5 NEET questions. That\'s a realistic goal for each session.',
  'During your break, close your eyes and mentally recall what you just studied.',
  'After 4 Pomodoros, take a 15-minute long break before the next round.',
  'Silence your phone. NEET has a 3-hour exam duration — practice sustained focus.',
  'Drink water at every break. Dehydration drops cognitive performance by 10%.',
];

export default function PomodoroPage() {
  const [phase, setPhase] = useState<Phase>('work');
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS.work);
  const [running, setRunning] = useState(false);
  const [completedWork, setCompletedWork] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // Update page title while running
  useEffect(() => {
    if (running) document.title = `${fmt(secondsLeft)} — ${PHASE_LABELS[phase]} | NEET AI`;
    else document.title = 'Pomodoro Timer | NEET AI';
    return () => { document.title = 'NEET AI'; };
  }, [secondsLeft, running, phase]);

  const playBell = useCallback(() => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.0);
    } catch { /* audio not supported */ }
  }, []);

  const nextPhase = useCallback(() => {
    playBell();
    setRunning(false);
    if (phase === 'work') {
      const newCompleted = completedWork + 1;
      setCompletedWork(newCompleted);
      setTipIdx((i) => (i + 1) % TIPS.length);
      const nextP: Phase = newCompleted % 4 === 0 ? 'long_break' : 'break';
      setPhase(nextP);
      setSecondsLeft(DURATIONS[nextP]);
    } else {
      setPhase('work');
      setSecondsLeft(DURATIONS.work);
    }
  }, [phase, completedWork, playBell]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) { nextPhase(); return 0; }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, nextPhase]);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(DURATIONS[phase]);
  };

  const switchPhase = (p: Phase) => {
    setRunning(false);
    setPhase(p);
    setSecondsLeft(DURATIONS[p]);
  };

  const color = PHASE_COLORS[phase];
  const total = DURATIONS[phase];
  const pct = ((total - secondsLeft) / total) * 100;

  // SVG ring
  const R = 90, cx = 110, cy = 110;
  const circumference = 2 * Math.PI * R;
  const strokeDash = circumference - (pct / 100) * circumference;

  return (
    <div className="page-container">
      <div className="page-header">
        <Timer size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Pomodoro Timer</h1>
          <p className="page-desc">25 min focus · 5 min break · proven productivity technique for NEET prep</p>
        </div>
      </div>

      {/* Phase selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', background: '#1e293b', padding: '6px', borderRadius: '10px', width: 'fit-content' }}>
        {(['work', 'break', 'long_break'] as Phase[]).map((p) => (
          <button key={p} onClick={() => switchPhase(p)}
            style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', background: phase === p ? PHASE_COLORS[p] : 'transparent', color: phase === p ? '#fff' : '#94a3b8' }}>
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Timer ring + controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}>
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width={220} height={220} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1e293b" strokeWidth={12} />
            <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={12}
              strokeDasharray={circumference} strokeDashoffset={strokeDash}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '48px', fontWeight: 800, color: '#e2e8f0', fontFamily: 'monospace', letterSpacing: '-2px' }}>{fmt(secondsLeft)}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{PHASE_LABELS[phase]}</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <button onClick={reset} title="Reset"
            style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={18} />
          </button>
          <button onClick={() => setRunning((r) => !r)}
            style={{ width: 68, height: 68, borderRadius: '50%', border: 'none', background: color, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 24px ${color}55` }}>
            {running ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '3px' }} />}
          </button>
          <button onClick={() => switchPhase(phase === 'work' ? 'break' : 'work')} title="Skip"
            style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            ⏭
          </button>
        </div>

        {/* Pomodoro dots */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: i < (completedWork % 4) ? '#6366f1' : '#1e293b', border: '2px solid #334155', transition: 'background 0.3s' }} />
          ))}
          <span style={{ color: '#475569', fontSize: '12px', marginLeft: '6px' }}>{completedWork} completed today</span>
        </div>
      </div>

      {/* Today's sessions */}
      {completedWork > 0 && (
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px 20px', marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '14px' }}>Today's Focus</span>
            <span style={{ fontWeight: 800, color: '#6366f1', fontSize: '20px' }}>{completedWork * 25} min</span>
          </div>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
            {completedWork} Pomodoro{completedWork !== 1 ? 's' : ''} ≈ ~{completedWork * 5} NEET questions at full focus
          </p>
        </div>
      )}

      {/* Study tip */}
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px 20px', marginTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          {phase === 'work' ? <BookOpen size={16} style={{ color: '#6366f1', flexShrink: 0, marginTop: '2px' }} /> : <Coffee size={16} style={{ color: '#22c55e', flexShrink: 0, marginTop: '2px' }} />}
          <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>{TIPS[tipIdx]}</p>
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px 20px', marginTop: '14px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>How Pomodoro Works</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { icon: '🎯', text: 'Work for 25 minutes without distraction' },
            { icon: '☕', text: 'Take a 5-minute break after each session' },
            { icon: '🔄', text: 'After 4 sessions, take a 15-minute long break' },
            { icon: '📈', text: 'Repeat — one NEET chapter typically needs 3–4 Pomodoros' },
          ].map((step) => (
            <div key={step.icon} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{step.icon}</span>
              <span style={{ color: '#475569', fontSize: '12px', lineHeight: 1.5 }}>{step.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
