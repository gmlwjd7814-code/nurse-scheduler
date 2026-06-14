/**
 * 인증 유틸리티
 * JWT 토큰 및 병동 정보를 localStorage에 저장/조회/삭제
 */

const TOKEN_KEY = 'nurse_scheduler_token';
const WARD_KEY = 'nurse_scheduler_ward';

export interface AuthInfo {
  wardId: number;
  wardName: string;
  token: string;
}

export function getAuth(): AuthInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const wardRaw = localStorage.getItem(WARD_KEY);
    if (!token || !wardRaw) return null;
    const ward = JSON.parse(wardRaw) as { wardId: number; wardName: string };
    return { token, wardId: ward.wardId, wardName: ward.wardName };
  } catch {
    return null;
  }
}

export function setAuth(info: AuthInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, info.token);
  localStorage.setItem(WARD_KEY, JSON.stringify({ wardId: info.wardId, wardName: info.wardName }));
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WARD_KEY);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
