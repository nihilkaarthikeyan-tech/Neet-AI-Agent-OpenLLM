import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { fetchMe, setToken } = useAuthStore();

  useEffect(() => {
    // Token arrives via URL fragment (#token=...) so it is never sent to the
    // server and won't appear in nginx/proxy access logs.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('token') ?? params.get('token'); // fallback for old links
    const error = params.get('error');

    if (error || !token) {
      navigate('/login?error=google_failed');
      return;
    }

    setToken(token);
    fetchMe().then(() => navigate('/dashboard')).catch(() => navigate('/login'));
  }, [params, navigate, fetchMe, setToken]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
      <Loader2 size={36} className="spin" style={{ color: 'var(--accent)' }} />
      <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Signing you in with Google...</p>
    </div>
  );
}
