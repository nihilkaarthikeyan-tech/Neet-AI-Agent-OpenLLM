import { useState, useRef, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useLang } from '../lib/useLang';

const SUBJECTS = ['Physics', 'Chemistry', 'Biology'];

interface Message {
  role: 'user' | 'ai';
  text: string;
}

type CallState = 'idle' | 'listening' | 'thinking' | 'speaking';

// Browser Speech Recognition type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

type ResponseStyle = 'en' | 'ta' | 'tanglish';

const STYLE_OPTIONS: { value: ResponseStyle; label: string; emoji: string }[] = [
  { value: 'en',       label: 'English',  emoji: '🇬🇧' },
  { value: 'ta',       label: 'தமிழ்',    emoji: '🇮🇳' },
  { value: 'tanglish', label: 'Tanglish', emoji: '💬' },
];

export default function VoiceCallPage() {
  const lang = useLang();
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(lang === 'ta' ? 'ta' : 'en');
  // Speech recognition lang: Tamil STT for ta, English for en/tanglish (Tanglish is spoken in English script)
  const speechLang = responseStyle === 'ta' ? 'ta-IN' : 'en-IN';
  const [subject, setSubject] = useState('Physics');
  const [callState, setCallState] = useState<CallState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isActiveRef = useRef(false); // call is active
  const isSpeakingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
    synthRef.current = window.speechSynthesis;
    return () => {
      synthRef.current?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = useCallback((text: string, onDone: () => void) => {
    const synth = synthRef.current;
    if (!synth) { onDone(); return; }

    isSpeakingRef.current = true;
    synth.cancel();

    // Strip markdown for cleaner speech
    const clean = text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\n+/g, ' ');

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = speechLang;

    // Pick best available voice for the selected language
    const voices = synth.getVoices();
    const langPrefix = responseStyle === 'ta' ? 'ta' : 'en';
    const preferred =
      voices.find((v) => v.lang.startsWith(langPrefix) && (v.name.includes('Google') || v.name.includes('Natural'))) ??
      voices.find((v) => v.lang.startsWith(langPrefix)) ??
      voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      isSpeakingRef.current = false;
      onDone();
    };
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      onDone();
    };

    synth.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim || finalTranscript);
    };

    recognition.onend = async () => {
      setInterimText('');
      if (!isActiveRef.current) return;
      if (!finalTranscript.trim()) {
        // Nothing heard — restart listening
        setCallState('listening');
        setTimeout(() => { if (isActiveRef.current) startListening(); }, 500);
        return;
      }

      const userText = finalTranscript.trim();
      setMessages((prev) => [...prev, { role: 'user', text: userText }]);
      setCallState('thinking');

      try {
        const token = localStorage.getItem('neet_token');
        const res = await fetch(`${API_BASE}/api/tutor/voice-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ subject, message: userText, language: responseStyle }),
        });

        const data = await res.json() as { response?: string; error?: string };

        if (!res.ok || !data.response) {
          throw new Error(data.error ?? 'AI response failed');
        }

        const aiText = data.response;
        setMessages((prev) => [...prev, { role: 'ai', text: aiText }]);
        setCallState('speaking');

        speak(aiText, () => {
          if (isActiveRef.current) {
            setCallState('listening');
            startListening();
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error getting AI response');
        setCallState('listening');
        if (isActiveRef.current) startListening();
      }
    };

    recognition.onerror = () => {
      setInterimText('');
      if (isActiveRef.current) {
        setCallState('listening');
        setTimeout(() => { if (isActiveRef.current) startListening(); }, 800);
      }
    };

    setCallState('listening');
    try {
      recognition.start();
    } catch {
      // already started — ignore
    }
  }, [subject, speak]);

  const startCall = useCallback(() => {
    if (!isSupported) return;
    setError('');
    setMessages([]);
    isActiveRef.current = true;

    // Greet the student in their chosen style
    const greeting =
      responseStyle === 'tanglish'
        ? `Vanakkam da! Naan un AI tutor for ${subject}. Formulas, concepts, problems — evvalo ketta aagathu, sollu! Inga irukken.`
        : responseStyle === 'ta'
        ? `வணக்கம்! நான் உங்கள் ${subject} AI tutor. Formulas, concepts, problems — எந்த கேள்வியும் கேளுங்கள்!`
        : `Hello! I'm your AI tutor for ${subject}. Ask me anything — formulas, concepts, problems, or previous year questions. I'm here to help.`;
    setMessages([{ role: 'ai', text: greeting }]);
    setCallState('speaking');

    speak(greeting, () => {
      if (isActiveRef.current) {
        setCallState('listening');
        startListening();
      }
    });
  }, [isSupported, subject, speak, startListening]);

  const endCall = useCallback(() => {
    isActiveRef.current = false;
    recognitionRef.current?.abort();
    synthRef.current?.cancel();
    setCallState('idle');
    setInterimText('');
  }, []);

  const stateLabel: Record<CallState, string> = {
    idle: '',
    listening: lang === 'ta' ? 'கேட்கிறது...' : 'Listening...',
    thinking: lang === 'ta' ? 'AI யோசிக்கிறது...' : 'AI is thinking...',
    speaking: lang === 'ta' ? 'AI பேசுகிறது...' : 'AI is speaking...',
  };

  const stateColor: Record<CallState, string> = {
    idle: '#6b7280',
    listening: '#10b981',
    thinking: '#f59e0b',
    speaking: '#8b5cf6',
  };

  return (
    <div className="page-container voice-panel">
      <div className="page-header">
        <Phone size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{lang === 'ta' ? 'AI குரல் ஆசிரியர்' : 'AI Voice Tutor'}</h1>
          <p className="page-desc">{lang === 'ta' ? 'உங்கள் AI பயிற்சியாளருடன் நேரடி குரல் உரையாடல்' : 'Have a real-time voice conversation with your AI coach'}</p>
        </div>
      </div>

      {!isSupported && (
        <div style={{
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          color: '#fca5a5',
          marginBottom: '1.5rem',
        }}>
          {lang === 'ta' ? 'உங்கள் உலாவி Web Speech API-ஐ ஆதரிக்கவில்லை. குரல் ஆசிரியருக்கு Google Chrome பயன்படுத்தவும்.' : 'Your browser does not support the Web Speech API. Please use Google Chrome for the voice tutor.'}
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '0.75rem',
          padding: '0.75rem 1rem',
          color: '#fca5a5',
          marginBottom: '1rem',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Call UI */}
      <div className="voice-panel" style={{ marginBottom: '1.5rem' }}>
        {/* Subject + Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {callState === 'idle' && (
            <>
            {/* Response style picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI speaks in</span>
              {STYLE_OPTIONS.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  onClick={() => setResponseStyle(value)}
                  style={{
                    padding: '4px 12px', borderRadius: '99px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    border: `1.5px solid ${responseStyle === value ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                    background: responseStyle === value ? 'rgba(99,102,241,0.2)' : 'transparent',
                    color: responseStyle === value ? '#a5b4fc' : '#64748b',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
            </>
          )}

          {callState === 'idle' && (
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '0.5rem',
                color: '#e2e8f0',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s} style={{ background: '#1e293b' }}>{s}</option>
              ))}
            </select>
          )}

          {callState !== 'idle' && (
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#94a3b8',
              background: 'rgba(255,255,255,0.05)',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
            }}>
              {subject} {lang === 'ta' ? 'அமர்வு' : 'Session'}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {callState !== 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: stateColor[callState],
                  animation: callState === 'listening' ? 'pulse 1.5s infinite' : 'none',
                }} />
                <span style={{ fontSize: '0.8rem', color: stateColor[callState], fontWeight: 500 }}>
                  {stateLabel[callState]}
                </span>
              </div>
            )}

            {callState === 'idle' ? (
              <button
                onClick={startCall}
                disabled={!isSupported}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '2rem',
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: isSupported ? 'pointer' : 'not-allowed',
                  opacity: isSupported ? 1 : 0.5,
                }}
              >
                <Phone size={16} />
                {lang === 'ta' ? 'அழைப்பைத் தொடங்கு' : 'Start Call'}
              </button>
            ) : (
              <button
                onClick={endCall}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '2rem',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                <PhoneOff size={16} />
                {lang === 'ta' ? 'அழைப்பை முடி' : 'End Call'}
              </button>
            )}
          </div>
        </div>

        {/* Status Orb */}
        {callState !== 'idle' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${stateColor[callState]}33 0%, ${stateColor[callState]}11 70%)`,
              border: `2px solid ${stateColor[callState]}55`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: callState === 'listening' ? 'pulse 1.5s infinite' : 'none',
            }}>
              {callState === 'listening' && <Mic size={36} style={{ color: stateColor[callState] }} />}
              {callState === 'thinking' && <Loader2 size={36} className="spin" style={{ color: stateColor[callState] }} />}
              {callState === 'speaking' && <Volume2 size={36} style={{ color: stateColor[callState] }} />}
            </div>
          </div>
        )}

        {/* Interim speech text */}
        {interimText && (
          <div style={{
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '0.9rem',
            fontStyle: 'italic',
            marginBottom: '1rem',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(255,255,255,0.04)',
          }}>
            "{interimText}"
          </div>
        )}

        {/* Idle state CTA */}
        {callState === 'idle' && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', padding: '1rem 0' }}>
            <MicOff size={32} style={{ margin: '0 auto 0.75rem', display: 'block', color: '#475569' }} />
            {lang === 'ta' ? '"அழைப்பைத் தொடங்கு" அழுத்தி உங்கள் குரல் அமர்வைத் தொடங்குங்கள்.' : 'Press "Start Call" to begin your voice session.'}<br />
            {lang === 'ta' ? 'இயல்பாகப் பேசுங்கள் — AI ஒரு தொலைபேசி அழைப்பு போல பதிலளிக்கும்.' : 'Speak naturally — the AI will respond just like a phone call.'}
          </div>
        )}
      </div>

      {/* Conversation Transcript */}
      {messages.length > 0 && (
        <div>
          <h2 className="section-heading" style={{ marginBottom: '1rem' }}>{lang === 'ta' ? 'உரையாடல்' : 'Conversation'}</h2>
          <div className="voice-transcript">
            {messages.map((msg, i) => (
              <div key={i} className={`voice-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  color: msg.role === 'user' ? '#6366f1' : '#10b981',
                  marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {msg.role === 'user' ? (lang === 'ta' ? 'நீங்கள்' : 'You') : (lang === 'ta' ? 'AI ஆசிரியர்' : 'AI Tutor')}
                </div>
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
