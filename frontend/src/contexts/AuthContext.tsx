'use client';

/**
 * 인증 컨텍스트
 * JWT 토큰 기반 로그인/로그아웃 상태 전역 관리
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthInfo, getAuth, setAuth, clearAuth } from '@/lib/auth';
import { authApi } from '@/lib/api';

interface AuthContextValue {
  auth: AuthInfo | null;
  wardId: number;
  wardName: string;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  auth: null,
  wardId: 0,
  wardName: '',
  isLoggedIn: false,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuthState] = useState<AuthInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // 마운트 후 localStorage에서 인증 정보 복원
  useEffect(() => {
    const stored = getAuth();
    if (stored) {
      setAuthState(stored);
    }
    setMounted(true);
  }, []);

  const login = async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    const info: AuthInfo = {
      token: data.token,
      wardId: data.wardId,
      wardName: data.wardName,
    };
    setAuth(info);
    setAuthState(info);
  };

  const logout = () => {
    clearAuth();
    setAuthState(null);
    router.push('/login');
  };

  const value: AuthContextValue = {
    auth,
    wardId: auth?.wardId ?? 0,
    wardName: auth?.wardName ?? '',
    isLoggedIn: !!auth,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {mounted ? children : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
