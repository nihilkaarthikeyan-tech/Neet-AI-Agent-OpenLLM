import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

const OPTIONS = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'ta', label: 'தமிழ் + EN', short: 'தமிழ்' },
] as const;

export default function LanguageSwitcher() {
  const { user, fetchMe } = useAuthStore();
  const current = user?.language ?? 'en';
  const [saving, setSaving] = useState(false);

  const handleChange = async (lang: string) => {
    if (lang === current || saving) return;
    setSaving(true);
    try {
      await api.patch('/api/auth/preferences', { language: lang });
      // Refresh user so the new language preference is reflected everywhere
      await fetchMe();
    } catch {
      // Non-critical: silently ignore, preference will retry next session
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '4px', padding: '0.5rem 0.75rem' }}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => void handleChange(o.value)}
          disabled={saving}
          title={o.label}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            fontWeight: 700,
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            background: current === o.value ? '#1d4ed8' : '#e5e7eb',
            color: current === o.value ? '#fff' : '#374151',
            transition: 'all 0.15s',
          }}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
