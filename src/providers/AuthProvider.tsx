import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  const sessionVersionRef = useRef(0);

  const clearSession = useCallback(() => {
    sessionVersionRef.current += 1;
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
    const token = tokenStorage.get();
    if (!token) {
      setLoading(false);
      return;
    }
    const version = sessionVersionRef.current;
    const isStale = () => sessionVersionRef.current !== version || tokenStorage.get() !== token;
    let cancelled = false;
    authService.me()
      .then((profile) => {
        if (cancelled || isStale()) return;
        if (!profile.is_admin) throw new Error('not-admin');
        setUser(profile);
      })
      .catch(() => {
        if (!cancelled && !isStale()) clearSession();
      })
      .finally(() => {
        if (!cancelled && !isStale()) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
    sessionVersionRef.current += 1;
    tokenStorage.set(response.access_token);
    setUser(response.user);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    const token = tokenStorage.get() ?? undefined;
    clearSession();
    if (!token) return;
    const revoked = await revokeToken(token);
    if (!revoked) {
      pendingRevocationStorage.add(token);
      setPending(pendingRevocationStorage.list());
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
