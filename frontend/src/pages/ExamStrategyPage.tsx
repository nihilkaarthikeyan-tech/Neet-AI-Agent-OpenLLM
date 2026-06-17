import { useState, useRef, useEffect } from 'react';
import { Trophy, Send, Bot, User as UserIcon, Lightbulb } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../lib/useLang';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

const GREETING_EN = `Hello! I'm your NEET Exam Strategy Coach.

I'll help you with:
• **Exam day strategy** — which section to tackle first, time splits
• **Negative marking tactics** — when to attempt vs skip
• **High-yield topic targeting** — what to focus on in the final weeks
• **Anxiety management** — staying calm and focused on exam day

What would you like to work on today?`;

const GREETING_TA = `வணக்கம்! நான் உங்கள் NEET தேர்வு உத்தி பயிற்சியாளர்.

நான் உங்களுக்கு உதவுவேன்:
• **தேர்வு நாள் உத்தி** — எந்த பகுதியை முதலில் செய்வது, நேர பங்கீடு
• **எதிர்மறை மதிப்பெண் தந்திரங்கள்** — எப்போது முயற்சிப்பது vs தவிர்ப்பது
• **அதிக மதிப்பெண் தலைப்புகள்** — கடைசி வாரங்களில் எதில் கவனம் செலுத்துவது
• **பதற்றம் மேலாண்மை** — தேர்வு நாளில் அமைதியாக இருப்பது

இன்று எதில் வேலை செய்ய விரும்புகிறீர்கள்?`;

const QUICK_PROMPTS_EN = [
  'How should I split my time across Physics, Chemistry, Biology?',
  'When should I skip a question to avoid negative marking?',
  'What are the highest-weightage topics I must not miss?',
  'How do I handle exam anxiety on the day of NEET?',
  'Give me a last-week revision strategy',
  'How do I use elimination to maximise marks?',
];

const QUICK_PROMPTS_TA = [
  'இயற்பியல், வேதியியல், உயிரியல் முழுவதும் என் நேரத்தை எப்படி பிரிப்பது?',
  'எதிர்மறை மதிப்பெண்ணைத் தவிர்க்க எப்போது ஒரு கேள்வியை விட வேண்டும்?',
  'நான் தவறவிடக்கூடாத அதிக மதிப்பெண் தலைப்புகள் என்ன?',
  'NEET தேர்வு நாளில் பதற்றத்தை எப்படி கையாள்வது?',
  'கடைசி வார மறுபரிசீலனை உத்தியை சொல்லுங்கள்',
  'மதிப்பெண்களை அதிகரிக்க elimination-ஐ எப்படி பயன்படுத்துவது?',
];

export default function ExamStrategyPage() {
  const { token } = useAuthStore();
  const lang = useLang();
  const isTa = lang === 'ta';
  const QUICK_PROMPTS = isTa ? QUICK_PROMPTS_TA : QUICK_PROMPTS_EN;
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: isTa ? GREETING_TA : GREETING_EN },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';
      const response = await fetch(`${API_BASE}/api/strategy/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: trimmed, history, language: lang }),
      });

      if (!response.ok) throw new Error('Failed to reach strategy coach.');

      const botId = Date.now().toString() + 'bot';
      setMessages(prev => [...prev, { id: botId, role: 'assistant', content: '' }]);
      setStreamingId(botId);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false, buffer = '';

      while (!done && reader) {
        const { value, done: rd } = await reader.read();
        done = rd;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const d = line.slice(6);
              if (d === '[DONE]') break;
              try {
                const parsed = JSON.parse(d);
                if (parsed.text) setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: m.content + parsed.text } : m));
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: isTa ? 'மன்னிக்கவும், உத்தி பயிற்சியாளருடன் இணைக்க முடியவில்லை.' : 'Sorry, I could not connect to the strategy coach.' }]);
    } finally {
      setIsTyping(false);
      setStreamingId(null);
    }
  };

  const renderContent = (text: string) => {
    // Simple markdown: bold
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  };

  return (
    <div className="page-container tutor-panel" style={{ minHeight: '100vh', paddingBottom: '20px' }}>
      <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
        <Trophy size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'தேர்வு உத்தி பயிற்சியாளர்' : 'Exam Strategy Coach'}</h1>
          <p className="page-desc">{isTa ? 'தனிப்பயன் NEET உத்தி — நேர மேலாண்மை, எதிர்மறை மதிப்பெண், மற்றும் பல' : 'Get personalised NEET strategy — time management, negative marking, and more'}</p>
        </div>
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', flexShrink: 0 }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p} onClick={() => sendMessage(p)}
              style={{ padding: '7px 14px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lightbulb size={12} style={{ color: 'var(--accent)' }} />
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="chat-container chat-subject-biology">
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={16} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{isTa ? 'உத்தி பயிற்சியாளர்' : 'Strategy Coach'}</span>
            <span style={{ fontSize: '12px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '20px' }}>{isTa ? 'ஆன்லைன்' : 'Online'}</span>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`chat-bubble-wrapper ${msg.role === 'user' ? 'chat-right' : 'chat-left'}`}>
              <div className="chat-avatar">
                {msg.role === 'user' ? <UserIcon size={16} /> : <Trophy size={16} />}
              </div>
              <div className="chat-bubble">
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '14px' }}>
                  {msg.id === streamingId
                    ? <>{renderContent(msg.content)}<span className="chat-cursor">▋</span></>
                    : <>{renderContent(msg.content)}{msg.id === streamingId && <span className="chat-cursor">▋</span>}</>
                  }
                </p>
              </div>
            </div>
          ))}
          {isTyping && !streamingId && (
            <div className="chat-bubble-wrapper chat-left">
              <div className="chat-avatar"><Bot size={16} /></div>
              <div className="typing-indicator">
                <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="chat-input-area">
          <input type="text" className="chat-input" placeholder={isTa ? 'தேர்வு உத்தி பற்றி கேளுங்கள்…' : 'Ask about exam strategy…'}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)} />
          <button className="chat-send" onClick={() => sendMessage(input)} disabled={isTyping || !input.trim()}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
