import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Mail, Lock, User, Eye, EyeOff, Loader2, Brain, Layers, Trophy } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!consentGiven) {
      setError('Please accept the Privacy Policy to continue (required under the DPDP Act 2023)');
      return;
    }
    try {
      await register(email, password, name, 'STUDENT', undefined, consentGiven);
      navigate('/verify-email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
              Your NEET journey <span>starts here</span>
            </h2>
            <p className="auth-brand-desc">
              Join thousands of aspirants using AI-powered tools to study smarter, track progress, and stay on top of their NEET preparation.
            </p>
          </div>

          <div className="auth-brand-stats">
            <div className="auth-stat-row">
              <div className="auth-stat-icon indigo"><Brain size={16} /></div>
              <div>
                <p className="auth-stat-label">Adaptive AI tutor</p>
                <p className="auth-stat-value">Explains concepts at your level</p>
              </div>
            </div>
            <div className="auth-stat-row">
              <div className="auth-stat-icon green"><Layers size={16} /></div>
              <div>
                <p className="auth-stat-label">Spaced repetition flashcards</p>
                <p className="auth-stat-value">Retain more with smart review intervals</p>
              </div>
            </div>
            <div className="auth-stat-row">
              <div className="auth-stat-icon amber"><Trophy size={16} /></div>
              <div>
                <p className="auth-stat-label">Full-length mock exams</p>
                <p className="auth-stat-value">NEET-pattern with detailed analysis</p>
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

          <h2 className="auth-heading">Create your account</h2>
          <p className="auth-sub">Start your NEET journey today — it's free</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label htmlFor="name">Full name</label>
              <div className="input-wrap">
                <User size={15} className="input-icon" />
                <input
                  id="name"
                  type="text"
                  placeholder="Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

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
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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

            {/* DPDP Act 2023 consent */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${consentGiven ? 'rgba(5,150,105,0.4)' : 'var(--border)'}`, background: consentGiven ? 'rgba(5,150,105,0.04)' : 'var(--bg-surface)' }}>
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                style={{ marginTop: '2px', flexShrink: 0, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                I have read and agree to the{' '}
                <Link to="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  Privacy Policy
                </Link>{' '}
                and consent to the processing of my personal data for NEET preparation services, as required under the{' '}
                <strong>Digital Personal Data Protection Act, 2023</strong>.
              </span>
            </label>

            <button id="register-submit" type="submit" className="btn-primary" disabled={isLoading || !consentGiven}>
              {isLoading ? <Loader2 size={17} className="spin" /> : 'Create Account'}
            </button>
          </form>

          <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '4px' }}>
            Protected by reCAPTCHA — <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}>Privacy</a> &amp; <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}>Terms</a>
          </p>

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
            Sign up with Google
          </a>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/login">Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
