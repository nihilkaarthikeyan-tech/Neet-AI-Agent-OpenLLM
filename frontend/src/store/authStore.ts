import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string; // "STUDENT" | "TEACHER"
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;

  login: (email: string, password: string, expectedRole?: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,

      login: async (email, password, expectedRole) => {
        set({ isLoading: true });
        try {
          const data = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password, role: expectedRole });
          localStorage.setItem('neet_token', data.token);
          set({ token: data.token, user: data.user, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (email, password, name, role = 'STUDENT') => {
        set({ isLoading: true });
        try {
          const data = await api.post<{ token: string; user: User }>('/api/auth/register', {
            email,
            password,
            name,
            role,
          });
          localStorage.setItem('neet_token', data.token);
          set({ token: data.token, user: data.user, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem('neet_token');
        set({ token: null, user: null });
      },

      fetchMe: async () => {
        if (!get().token) return;
        try {
          const data = await api.get<{ user: User }>('/api/auth/me');
          set({ user: data.user });
        } catch {
          // token invalid — log out
          get().logout();
        }
      },
    }),
    {
      name: 'neet-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
