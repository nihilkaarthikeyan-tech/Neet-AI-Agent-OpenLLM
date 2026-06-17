import { useAuthStore } from '../store/authStore';

/** Returns the current user's language preference ('en' | 'ta'). Default: 'en'. */
export function useLang(): 'en' | 'ta' {
  return useAuthStore((s) => s.user?.language ?? 'en');
}
