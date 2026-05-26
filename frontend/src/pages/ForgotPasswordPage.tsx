import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Mail, Loader2, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setIsLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccess('OTP sent! Check your email and proceed to reset your password.');
      setTimeout(() => navigate('/reset-password', { state: { email } }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
            <h2 className="auth-brand-heading">Forgot your <span>password?</span></h2>
            <p className="auth-brand-desc">
              No worries — enter your email and we'll send you a secure OTP to reset your password in minutes.
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
              <p className="auth-logo-sub">Password Recovery</p>
            </div>
          </div>

          <h2 className="auth-heading">Reset your password</h2>
          <p className="auth-sub">Enter your registered email and we'll send you an OTP.</p>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label htmlFor="email">Email address</label>
              <div className="input-wrap">
                <Mail size={15} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <Loader2 size={17} className="spin" /> : 'Send OTP'}
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
