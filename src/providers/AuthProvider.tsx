import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth';
import { AdminAccessRequiredError, apiErrorStatus } from '../lib/errors';
import { pendingRevocationStorage, tokenStorage } from '../lib/storage';
import type { AdminUser, LoginInput } from '../types/auth';

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  pendingRevocations: number;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  retryPendingRevocations: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStorage.get()));
  const [pending, setPending] = useState<string[]>(() => pendingRevocationStorage.list());

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

  const retryPendingRevocations = useCallback(async () => {
    let allRevoked = true;
    for (const token of pendingRevocationStorage.list()) {
      if (await revokeToken(token)) pendingRevocationStorage.remove(token);
      else allRevoked = false;
    }
    setPending(pendingRevocationStorage.list());
    return allRevoked;
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await authService.login(input);
    if (!response.user.is_admin) {
      const revoked = await revokeToken(response.access_token);
      if (!revoked) {
        pendingRevocationStorage.add(response.access_token);
        setPending(pendingRevocationStorage.list());
      }
      throw new AdminAccessRequiredError(!revoked);
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

  const value = useMemo(() => ({
    user,
    loading,
    pendingRevocations: pending.length,
    login,
    logout,
    retryPendingRevocations,
  }), [user, loading, pending, login, logout, retryPendingRevocations]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function revokeToken(token: string): Promise<boolean> {
  try {
    await authService.logout(token);
    return true;
  } catch (error) {
    return apiErrorStatus(error) === 401;
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
