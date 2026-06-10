'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, getAccessToken, logout as apiLogout } from '@/lib/api';

export interface AdminUser {
  id: string;
  email: string;
  fullName?: string | null;
  roles: { name: string; label: string }[];
  permissions: string[];
}

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  can: () => false,
  refresh: async () => undefined,
  signOut: async () => undefined,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await authFetch<AdminUser>('/auth/me'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const can = useCallback(
    (permission: string) =>
      !!user && (user.permissions.includes('*') || user.permissions.includes(permission)),
    [user],
  );

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, can, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
