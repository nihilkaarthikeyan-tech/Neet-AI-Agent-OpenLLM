import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;

  setToken: (token: string) => void;
  login: (email: string, password: string, captchaToken?: string) => Promise<{ requiresVerification?: boolean }>;
  register: (email: string, password: string, name: string, role?: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  verifyEmail: (otp: string) => Promise<void>;
  resendOtp: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,

      setToken: (token) => {
        localStorage.setItem('neet_token', token);
        set({ token });
      },

      login: async (email, password, captchaToken?: string) => {
        set({ isLoading: true });
        try {
          const data = await api.post<{ token: string; user: User; requiresVerification?: boolean }>(
            '/api/auth/login', { email, password, captchaToken }
          );
          localStorage.setItem('neet_token', data.token);
          set({ token: data.token, user: data.user, isLoading: false });
          return { requiresVerification: data.requiresVerification };
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (email, password, name, role = 'STUDENT', captchaToken?: string) => {
        set({ isLoading: true });
        try {
          const data = await api.post<{ token: string; user: User }>(
            '/api/auth/register', { email, password, name, role, captchaToken }
          );
          localStorage.setItem('neet_token', data.token);
          set({ token: data.token, user: data.user, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        await api.post('/api/auth/logout', {}).catch(() => {});
        localStorage.removeItem('neet_token');
        set({ token: null, user: null });
      },

      refreshAccessToken: async () => {
        try {
          const data = await api.post<{ token: string }>('/api/auth/refresh', {});
          localStorage.setItem('neet_token', data.token);
          set({ token: data.token });
          return true;
        } catch {
          localStorage.removeItem('neet_token');
          set({ token: null, user: null });
          return false;
        }
      },

      fetchMe: async () => {
        if (!get().token) return;
        try {
          const data = await api.get<{ user: User }>('/api/auth/me');
          set({ user: data.user });
        } catch (err) {
          // Try refreshing access token before logging out
          const refreshed = await get().refreshAccessToken();
          if (refreshed) {
            const data = await api.get<{ user: User }>('/api/auth/me').catch(() => null);
            if (data) { set({ user: data.user }); return; }
          }
          localStorage.removeItem('neet_token');
          set({ token: null, user: null });
        }
      },

      verifyEmail: async (otp) => {
        set({ isLoading: true });
        try {
          await api.post('/api/auth/verify-email', { otp });
          const current = get().user;
          if (current) set({ user: { ...current, emailVerified: true } });
        } finally {
          set({ isLoading: false });
        }
      },

      resendOtp: async () => {
        await api.post('/api/auth/resend-otp', {});
      },
    }),
    {
      name: 'neet-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
