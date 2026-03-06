import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
  airportId?: string;
  tenantId?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  login: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      login: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null });
        // Clear TanStack Query cache on logout
        // Dynamically import to avoid circular dependency with main.tsx
        import('../main').then(({ queryClient }) => {
          queryClient.clear();
        });
      },
    }),
    {
      name: 'auth-storage',
    },
  ),
);
