import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Bot, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const GREETING = "Hi! I'm your NEET AI coach. I specialize in stepping through difficult concepts and numericals. What doubt can I clear for you today?";

export default function TutorPage() {
  const { token } = useAuthStore();
  const [subject, setSubject] = useState('Physics');
  const [inputVal, setInputVal] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: GREETING }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  
  const endRef = useRef<HTMLDivElement>(null);

  // Load history when subject changes
  useEffect(() => {
    api.get<{ history: Array<{ role: string; content: string }> }>(`/api/tutor/history?subject=${subject}`)
      .then(data => {
        if (data.history.length > 0) {
          setMessages(data.history.map((m, i) => ({
            id: String(i),
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })));
        } else {
          setMessages([{ id: '1', role: 'assistant', content: GREETING }]);
        }
      })
      .catch(() => {
        setMessages([{ id: '1', role: 'assistant', content: GREETING }]);
      });
  }, [subject]);

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
        body: JSON.stringify({ subject, message: userMsg })
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

  return (
    <div className="page-container tutor-panel" style={{ minHeight: '100vh', paddingBottom: '20px' }}>
      <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
        <MessageCircle size={28} className="page-icon" />
        <div>
          <h1 className="page-title">AI Text Tutor</h1>
          <p className="page-desc">Ask doubts in Physics, Chemistry, and Biology — 24/7</p>
        </div>
      </div>

      <div className={`chat-container chat-subject-${subject.toLowerCase()}`}>

        {/* Tutor Topbar & Subject Selector */}
        <div className="chat-header">
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
        </div>

        {/* Chat Messages */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-bubble-wrapper ${msg.role === 'user' ? 'chat-right' : 'chat-left'}`}>
              <div className="chat-avatar">
                {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
              </div>
              <div className="chat-bubble">
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '14px' }}>
                  {msg.id === streamingId && msg.content ? (() => {
                    const lastSpace = msg.content.lastIndexOf(' ');
                    const before = lastSpace === -1 ? '' : msg.content.slice(0, lastSpace + 1);
                    const currentWord = lastSpace === -1 ? msg.content : msg.content.slice(lastSpace + 1);
                    return (
                      <>
                        {before}
                        <span className="chat-word-cursor">{currentWord}<span className="chat-cursor">▋</span></span>
                      </>
                    );
                  })() : (
                    <>
                      {msg.content}
                      {msg.id === streamingId && <span className="chat-cursor">▋</span>}
                    </>
                  )}
                </p>
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

        {/* Input Area */}
        <div className="chat-input-area">
          <input 
            type="text" 
            className="chat-input" 
            placeholder={`Ask a ${subject} question...`} 
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
