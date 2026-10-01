'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from '@/lib/api';
import { authStorage } from '@/lib/authStorage';
import type { AuthResponse, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      authStorage.clear();
      setUser(null);
    });

    if (!authStorage.getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => authStorage.clear())
      .finally(() => setLoading(false));

    return () => setUnauthorizedHandler(null);
  }, []);

  const completeAuth = useCallback((result: AuthResponse) => {
    authStorage.setToken(result.token);
    setUser(result.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    completeAuth(await api.login({ email, password }));
  }, [completeAuth]);

  const register = useCallback(async (email: string, password: string) => {
    completeAuth(await api.register({ email, password }));
  }, [completeAuth]);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
