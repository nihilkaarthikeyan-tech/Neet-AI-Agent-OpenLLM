import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Mail, Lock, Eye, EyeOff, Loader2, Target, Zap, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await login(email, password);
      if (result?.requiresVerification) {
        navigate('/verify-email');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.toLowerCase().includes('not verified')) {
        try {
          const data = await api.post<{ token: string; user: unknown; requiresVerification: boolean }>(
            '/api/auth/login', { email, password }
          );
          if (data.requiresVerification) {
            navigate('/verify-email');
            return;
          }
        } catch { /* fall through to show error */ }
      }
      setError(msg);
    }
  };

  return (
    <div className="auth-split">
      {/* ── Left brand panel ── */}
      <div className="auth-split-left">
        <div className="auth-brand-logo">
          <div className="auth-brand-icon">
            <BookOpen size={20} />
          </div>
          <div>
            <p className="auth-brand-name">NEET AI</p>
            <p className="auth-brand-tagline">AI-powered prep platform</p>
          </div>
        </div>

        <div className="auth-brand-content">
          <div>
            <h2 className="auth-brand-heading">
              Crack NEET with <span>AI at your side</span>
            </h2>
            <p className="auth-brand-desc">
              Personalised study plans, instant doubt solving, adaptive mock tests — everything a NEET aspirant needs in one place.
            </p>
          </div>

          <div className="auth-brand-stats">
            <div className="auth-stat-row">
              <div className="auth-stat-icon indigo"><Target size={16} /></div>
              <div>
                <p className="auth-stat-label">AI-generated mock tests</p>
                <p className="auth-stat-value">Physics · Chemistry · Biology</p>
              </div>
            </div>
            <div className="auth-stat-row">
              <div className="auth-stat-icon green"><Zap size={16} /></div>
              <div>
                <p className="auth-stat-label">Real-time streaming tutor</p>
                <p className="auth-stat-value">Ask any doubt, get answers instantly</p>
              </div>
            </div>
            <div className="auth-stat-row">
              <div className="auth-stat-icon amber"><BarChart3 size={16} /></div>
              <div>
                <p className="auth-stat-label">Smart performance analytics</p>
                <p className="auth-stat-value">Track weak areas and improve fast</p>
              </div>
            </div>
          </div>
        </div>

        <p className="auth-brand-footer">© 2026 NEET AI Platform. All rights reserved.</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-split-right">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="auth-logo-title">NEET AI</h1>
              <p className="auth-logo-sub">Your personal study partner</p>
            </div>
          </div>

          <h2 className="auth-heading">Welcome back</h2>
          <p className="auth-sub">Sign in to continue your studies</p>

          {error && <div className="auth-error">{error}</div>}

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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '4px' }}>
              <Link to="/forgot-password" style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>

            <button id="login-submit" type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <Loader2 size={17} className="spin" /> : 'Sign In'}
            </button>
          </form>


          <div className="auth-divider"><span>or</span></div>

          <a
            href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:5005'}/api/auth/google`}
            className="btn-google"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/register">Create one →</Link>
          </p>

          <div style={{ textAlign: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <Link to="/kiosk" style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Using a shared / school computer? Continue as Guest →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
