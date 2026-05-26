import { useState, useRef, type FormEvent, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail = (location.state as { email?: string })?.email ?? '';

  const [email, setEmail] = useState(prefillEmail);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

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
    if (otp.length < 6) { setError('Please enter all 6 OTP digits.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setError(''); setIsLoading(true);
    try {
      await api.post('/api/auth/reset-password', { email, otp, newPassword });
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
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
            <h2 className="auth-brand-heading">Create a <span>new password</span></h2>
            <p className="auth-brand-desc">
              Enter the OTP from your email and choose a strong new password to secure your account.
            </p>
          </div>
        </div>
        <p className="auth-brand-footer">© 2026 NEET AI Platform. All rights reserved.</p>
      </div>

      <div className="auth-split-right">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><BookOpen size={24} /></div>
            <div>
              <h1 className="auth-logo-title">NEET AI</h1>
              <p className="auth-logo-sub">Set New Password</p>
            </div>
          </div>

          <h2 className="auth-heading">Set new password</h2>
          <p className="auth-sub">Enter the OTP sent to your email, then your new password.</p>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {!prefillEmail && (
              <div className="input-group">
                <label htmlFor="email">Email address</label>
                <div className="input-wrap">
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label>OTP from email</label>
              <div style={{ display: 'flex', gap: '10px' }}>
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
                      width: '44px', height: '52px', textAlign: 'center',
                      fontSize: '20px', fontWeight: 700, border: '2px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
                      color: 'var(--text-primary)', outline: 'none',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                ))}
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="newPassword">New password</label>
              <div className="input-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="input-eye" onClick={() => setShowPassword(v => !v)} aria-label="Toggle">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <div className="input-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <Loader2 size={17} className="spin" /> : 'Reset Password'}
            </button>
          </form>

          <p className="auth-switch">
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
