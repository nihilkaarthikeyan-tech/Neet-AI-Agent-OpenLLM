import { useState, useRef, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ShieldCheck, Loader2, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { verifyEmail, resendOtp, user, token } = useAuthStore();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (user?.emailVerified) { navigate('/dashboard'); return; }
  }, [token, user, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleDigit = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      refs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < 6) { setError('Please enter all 6 digits.'); return; }
    setError(''); setIsLoading(true);
    try {
      await verifyEmail(otp);
      setSuccess('Email verified! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(''); setIsLoading(true);
    try {
      await resendOtp();
      setSuccess('New OTP sent to your email.');
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-split">
      <div className="auth-split-left">
        <div className="auth-brand-logo">
          <div className="auth-brand-icon"><BookOpen size={20} /></div>
          <div>
            <p className="auth-brand-name">NEET AI</p>
            <p className="auth-brand-tagline">AI-powered prep platform</p>
          </div>
        </div>
        <div className="auth-brand-content">
          <div>
            <h2 className="auth-brand-heading">One step <span>away</span></h2>
            <p className="auth-brand-desc">
              Verify your email to unlock your full NEET AI dashboard — tutor, mock tests, flashcards, and more.
            </p>
          </div>
        </div>
        <p className="auth-brand-footer">© 2026 NEET AI Platform. All rights reserved.</p>
      </div>

      <div className="auth-split-right">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><ShieldCheck size={24} /></div>
            <div>
              <h1 className="auth-logo-title">NEET AI</h1>
              <p className="auth-logo-sub">Email Verification</p>
            </div>
          </div>

          <h2 className="auth-heading">Check your inbox</h2>
          <p className="auth-sub">
            We sent a 6-digit OTP to <strong>{user?.email}</strong>. Enter it below.
          </p>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '8px 0' }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { refs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  style={{
                    width: '48px', height: '56px', textAlign: 'center',
                    fontSize: '22px', fontWeight: 700, border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
                    color: 'var(--text-primary)', outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              ))}
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <Loader2 size={17} className="spin" /> : 'Verify Email'}
            </button>
          </form>

          <p className="auth-switch">
            Didn't receive it?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isLoading}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: resendCooldown > 0 ? 'default' : 'pointer', fontWeight: 600, fontSize: '14px' }}
            >
              <RefreshCw size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
