import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Bot, User as UserIcon, Smile } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import MarkdownText from '../components/MarkdownText';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  verified?: boolean;
  dbId?: string;
};

const getGreeting = (style: ResponseStyle) => {
  if (style === 'ta') return 'வணக்கம்! நான் உங்கள் NEET AI coach. கஷ்டமான concepts மற்றும் numericals-ஐ step-by-step புரிய வைப்பேன். இன்று என்ன doubt clear பண்ணலாம்? | Hi! I am your NEET AI coach. I will explain difficult concepts step by step. What doubt shall we clear today?';
  if (style === 'tanglish') return "Vanakkam da! Naan un NEET AI coach. Kasta concepts-a simple-a explain panrom, numericals-a step-by-step solve panrom. Enna doubt irukku? Sollu!";
  return "Hi! I'm your NEET AI coach. I specialize in stepping through difficult concepts and numericals. What doubt can I clear for you today?";
};

type ResponseStyle = 'en' | 'ta' | 'tanglish';

const STYLE_OPTIONS: { value: ResponseStyle; label: string; emoji: string }[] = [
  { value: 'en',       label: 'English',   emoji: '🇬🇧' },
  { value: 'ta',       label: 'தமிழ்',     emoji: '🇮🇳' },
  { value: 'tanglish', label: 'Tanglish',  emoji: '💬' },
];

export default function TutorPage() {
  const { token, user } = useAuthStore();
  const [subject, setSubject] = useState('Physics');
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>((user?.language as ResponseStyle) ?? 'en');
  const [inputVal, setInputVal] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: getGreeting(responseStyle) }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [eli5Loading, setEli5Loading] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);

  // Load history when subject changes
  useEffect(() => {
    api.get<{ history: Array<{ id: string; role: string; content: string; verified: boolean }> }>(`/api/tutor/history?subject=${subject}`)
      .then(data => {
        if (data.history.length > 0) {
          setMessages(data.history.map((m, i) => ({
            id: String(i),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            verified: m.verified,
            dbId: m.id,
          })));
        } else {
          setMessages([{ id: '1', role: 'assistant', content: getGreeting(responseStyle) }]);
        }
      })
      .catch(() => {
        setMessages([{ id: '1', role: 'assistant', content: getGreeting(responseStyle) }]);
      });
  }, [subject, responseStyle]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputVal.trim() || isTyping) return;
    
    const userMsg = inputVal.trim();
    setInputVal('');
    
    // Add user message to UI immediately
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: userMsg };
    setMessages((prev) => [...prev, newUserMsg]);
    setIsTyping(true);

    try {
      // Because we need to consume an SSE stream, we use native fetch rather than our api wrapper.
      const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';
      const response = await fetch(`${API_BASE}/api/tutor/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subject, message: userMsg, language: responseStyle })
      });

      if (!response.ok) {
         throw new Error('Failed to reach tutor.');
      }

      // Add a blank assistant message that we will mutate word-by-word
      const botMsgId = Date.now().toString() + 'bot';
      setMessages((prev) => [...prev, { id: botMsgId, role: 'assistant', content: '' }]);
      setStreamingId(botMsgId);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      let done = false;
      let buffer = '';
      
      while (!done && reader) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          let isErrorEvent = false;
          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('event: error')) {
              isErrorEvent = true;
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') {
                setIsTyping(false);
                setStreamingId(null);
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (isErrorEvent || data.error) {
                  setMessages((prev) => prev.map(m => 
                    m.id === botMsgId ? { ...m, content: m.content + (data.error || 'Server error occurred') } : m
                  ));
                  setIsTyping(false);
                  isErrorEvent = false;
                } else if (data.text) {
                   setMessages((prev) => prev.map(m => 
                     m.id === botMsgId ? { ...m, content: m.content + data.text } : m
                   ));
                }
              } catch (e) {
                 // ignore partial chunks or bad parses
              }
            }
          }
        }
      }
      setIsTyping(false);
      setStreamingId(null);
    } catch (err) {
      console.error(err);
      setIsTyping(false);
      setStreamingId(null);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, I encountered an error connecting to my servers.' }]);
    }
  };

  // Feature 3: ELI5 — re-explains the last AI answer in child-friendly language
  const handleELI5 = async () => {
    if (eli5Loading || isTyping) return;
    // Find the last user message to re-explain
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    setEli5Loading(true);
    const eli5Prompt = `Explain like I'm a child (age 10): ${lastUserMsg.content}. Use a simple real-life analogy from daily Tamil Nadu life. No jargon.`;
    setInputVal('');

    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: '🧒 Explain like I\'m a child' };
    setMessages((prev) => [...prev, newUserMsg]);
    setIsTyping(true);

    try {
      const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';
      const response = await fetch(`${API_BASE}/api/tutor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, message: eli5Prompt, language: responseStyle }),
      });
      if (!response.ok) throw new Error('Failed');

      const botMsgId = Date.now().toString() + 'bot';
      setMessages((prev) => [...prev, { id: botMsgId, role: 'assistant', content: '' }]);
      setStreamingId(botMsgId);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false; let buffer = '';
      while (!done && reader) {
        const { value, done: rd } = await reader.read();
        done = rd;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;
            try { const d = JSON.parse(dataStr); if (d.text) setMessages((prev) => prev.map((m) => m.id === botMsgId ? { ...m, content: m.content + d.text } : m)); } catch { /* ignore */ }
          }
        }
      }
    } catch { /* ignore */ }
    finally { setIsTyping(false); setStreamingId(null); setEli5Loading(false); }
  };

  return (
    <div className="page-container tutor-panel" style={{ minHeight: '100vh', paddingBottom: '20px' }}>
      <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
        <MessageCircle size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{responseStyle === 'ta' ? 'AI உரை ஆசிரியர்' : responseStyle === 'tanglish' ? 'AI Text Tutor' : 'AI Text Tutor'}</h1>
          <p className="page-desc">{responseStyle === 'ta' ? 'இயற்பியல், வேதியியல், உயிரியல் சந்தேகங்களைக் கேளுங்கள் — 24/7' : responseStyle === 'tanglish' ? 'Physics, Chemistry, Biology doubts-a kelunga — 24/7' : 'Ask doubts in Physics, Chemistry, and Biology — 24/7'}</p>
        </div>
      </div>

      <div className={`chat-container chat-subject-${subject.toLowerCase()}`}>

        {/* Tutor Topbar & Subject Selector */}
        <div className="chat-header" style={{ flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
          {/* Subject row */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Physics', 'Chemistry', 'Biology'].map(sub => (
              <button
                key={sub}
                onClick={() => setSubject(sub)}
                className={`subject-badge ${subject === sub ? `subject-badge-active subject-badge-${sub.toLowerCase()}` : ''}`}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Response style row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '2px' }}>
              Reply in
            </span>
            {STYLE_OPTIONS.map(({ value, label, emoji }) => (
              <button
                key={value}
                onClick={() => setResponseStyle(value)}
                title={value === 'tanglish' ? 'Tamil words in English script — like a Chennai tutor!' : label}
                style={{
                  padding: '4px 12px',
                  borderRadius: '99px',
                  border: `1.5px solid ${responseStyle === value ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                  background: responseStyle === value ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: responseStyle === value ? '#a5b4fc' : '#64748b',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {emoji} {label}
                {value === 'tanglish' && responseStyle === value && (
                  <span style={{ fontSize: '9px', background: '#6366f1', color: '#fff', borderRadius: '4px', padding: '1px 4px', marginLeft: '2px' }}>NEW</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-bubble-wrapper ${msg.role === 'user' ? 'chat-right' : 'chat-left'}`}>
              <div className="chat-avatar">
                {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
              </div>
              <div className="chat-bubble">
                {msg.role === 'assistant' && msg.verified && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#6ee7b7', marginBottom: '6px', opacity: 0.9 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="5" fill="#059669"/><path d="M2.5 5l1.5 1.5L7.5 3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Teacher Verified
                  </div>
                )}
                {msg.id === streamingId && msg.content ? (
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '14px' }}>
                    {(() => {
                      const lastSpace = msg.content.lastIndexOf(' ');
                      const before = lastSpace === -1 ? '' : msg.content.slice(0, lastSpace + 1);
                      const currentWord = lastSpace === -1 ? msg.content : msg.content.slice(lastSpace + 1);
                      return <>{before}<span className="chat-word-cursor">{currentWord}<span className="chat-cursor">▋</span></span></>;
                    })()}
                  </p>
                ) : (
                  <MarkdownText content={msg.content} style={{ fontSize: '14px' }} />
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="chat-bubble-wrapper chat-left">
              <div className="chat-avatar"><Bot size={16} /></div>
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* ELI5 quick-action button — appears when there's at least one exchange */}
        {messages.length > 1 && !isTyping && (
          <div style={{ padding: '6px 16px 0', display: 'flex', gap: '8px' }}>
            <button
              onClick={handleELI5}
              disabled={eli5Loading}
              title="Re-explain the last topic in the simplest possible language with a real-life analogy"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '999px', border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.08)', color: '#a5b4fc', fontSize: '12px', fontWeight: 600, cursor: eli5Loading ? 'not-allowed' : 'pointer', opacity: eli5Loading ? 0.6 : 1 }}>
              <Smile size={13} /> Explain like I'm a child
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="chat-input-area">
          <input
            type="text"
            className="chat-input"
            placeholder={responseStyle === 'tanglish' ? `${subject} pathi enna doubt? Sollu...` : responseStyle === 'ta' ? `${subject} பற்றி என்ன சந்தேகம்?` : `Ask a ${subject} question...`}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button className="chat-send" onClick={handleSend} disabled={isTyping || !inputVal.trim()}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
