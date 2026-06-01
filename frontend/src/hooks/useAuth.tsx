// src/hooks/useAuth.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { TOKEN_KEY, REFRESH_KEY, apiGet, apiPost } from '@/lib/api-client';
import type { AuthUser } from '@/types/auth';

interface MeResponse {
  id: string;
  phone: string;
  email: string | null;
  roles: string[];
  permissions: string[];
  activeRole: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  permissions: string[];
}

const AuthContext = createContext<AuthContextType | null>(null);
const USER_KEY = 'g2sentry_user';

async function fetchMe(): Promise<AuthUser> {
  const me = await apiGet<MeResponse>('/users/me');
  const name = me.email ?? me.phone;
  const role = me.roles[0] ?? 'GUARDIAN';
  return { id: me.id, name, role, permissions: me.permissions };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    let active = true;
    fetchMe()
      .then((u) => {
        if (!active) return;
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const tokens = await apiPost<{ accessToken: string; refreshToken: string }>(
      '/auth/sign-in/password',
      { login: phone, password },
    );
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    const me = await fetchMe();
    setUser(me);
    localStorage.setItem(USER_KEY, JSON.stringify(me));
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      await apiPost('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        permissions: user?.permissions ?? [],
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
