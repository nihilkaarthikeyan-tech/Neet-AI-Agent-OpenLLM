import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Mail, Lock, Eye, EyeOff, Loader2, Target, Zap, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

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
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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

            <button id="login-submit" type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <Loader2 size={17} className="spin" /> : 'Sign In'}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/register">Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
