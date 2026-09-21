import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth';
import { AdminAccessRequiredError } from '../lib/errors';
import { tokenStorage } from '../lib/storage';
import type { AdminUser, LoginInput } from '../types/auth';

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStorage.get()));

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    window.addEventListener('manabi:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('manabi:unauthorized', handleUnauthorized);
  }, [clearSession]);

  useEffect(() => {
    if (!tokenStorage.get()) return;
    authService.me()
      .then((profile) => {
        if (!profile.is_admin) throw new Error('not-admin');
        setUser(profile);
      })
      .catch(clearSession)
      .finally(() => setLoading(false));
  }, [clearSession]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await authService.login(input);
    if (!response.user.is_admin) {
      await revokeToken(response.access_token);
      throw new AdminAccessRequiredError();
    }
    tokenStorage.set(response.access_token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function revokeToken(token: string) {
  const previous = tokenStorage.get();
  tokenStorage.set(token);
  await authService.logout().catch(() => undefined);
  if (previous) tokenStorage.set(previous);
  else tokenStorage.clear();
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
