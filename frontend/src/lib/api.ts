/**
 * API 클라이언트
 * 백엔드 Express 서버와 통신하는 모든 함수를 모아둡니다
 */

import {
  Nurse, WardSettings, FullSchedule, ScheduleViolation,
  NurseMonthlyStats, ShiftRequest, ShiftCode
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// 공통 fetch 헬퍼
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || data.message || '서버 오류');
  }
  return data.data as T;
}

// ===== 간호사 API =====
export const nurseApi = {
  list: (wardId?: number) =>
    apiFetch<Nurse[]>(`/nurses${wardId ? `?wardId=${wardId}` : ''}`),

  get: (id: number) => apiFetch<Nurse>(`/nurses/${id}`),

  create: (data: Partial<Nurse>) =>
    apiFetch<Nurse>('/nurses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Nurse>) =>
    apiFetch<Nurse>(`/nurses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deactivate: (id: number) =>
    apiFetch<void>(`/nurses/${id}/deactivate`, { method: 'PATCH' }),

  delete: (id: number) =>
    apiFetch<void>(`/nurses/${id}`, { method: 'DELETE' }),
};

// ===== 근무표 API =====
export const scheduleApi = {
  // 근무표 조회
  get: (wardId: number, year: number, month: number) =>
    apiFetch<FullSchedule | null>(`/schedule/${wardId}/${year}/${month}`),

  // AI 자동 생성
  generate: (wardId: number, year: number, month: number, useRequests = true) =>
    apiFetch<{
      scheduleId: number;
      entryCount: number;
      violationCount: number;
      violations: ScheduleViolation[];
      elapsed: number;
    }>('/schedule/generate', {
      method: 'POST',
      body: JSON.stringify({ wardId, year, month, useRequests }),
    }),

  // 셀 수정 (드래그&드롭)
  updateEntry: (entryId: number, shift: ShiftCode) =>
    apiFetch<{ nurseId: number; day: number; shift: ShiftCode; violations: string[] }>(
      `/schedule/entry/${entryId}`,
      { method: 'PUT', body: JSON.stringify({ shift }) }
    ),

  // Excel 다운로드 URL
  excelUrl: (wardId: number, year: number, month: number) =>
    `${BASE_URL}/schedule/${wardId}/${year}/${month}/excel`,

  // 희망 오프 신청
  submitRequest: (data: {
    nurseId: number;
    year: number;
    month: number;
    day: number;
    requestedShift: 'O' | 'Y' | 'H' | 'YH';
  }) =>
    apiFetch<ShiftRequest>('/schedule/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 희망 오프 목록
  getRequests: (wardId: number, year: number, month: number) =>
    apiFetch<ShiftRequest[]>(`/schedule/${wardId}/${year}/${month}/requests`),

  // 희망 오프 삭제
  deleteRequest: (id: number) =>
    apiFetch<void>(`/schedule/request/${id}`, { method: 'DELETE' }),
};

// ===== 설정 API =====
export const settingsApi = {
  get: (wardId: number) => apiFetch<WardSettings>(`/settings/${wardId}`),
  update: (wardId: number, data: Partial<WardSettings>) =>
    apiFetch<WardSettings>(`/settings/${wardId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getWards: () =>
    apiFetch<{ id: number; name: string; description: string }[]>('/settings/wards'),
};

// ===== 통계 API =====
export const statsApi = {
  get: (wardId: number, year: number, month: number) =>
    apiFetch<NurseMonthlyStats[]>(`/stats/${wardId}/${year}/${month}`),
};

// ===== 공휴일 API =====
export interface Holiday {
  id: number;
  year: number;
  month: number;
  day: number;
  name: string;
}

export const holidayApi = {
  list: (year: number) =>
    apiFetch<Holiday[]>(`/holidays?year=${year}`),

  create: (data: { year: number; month: number; day: number; name: string }) =>
    apiFetch<Holiday>('/holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<null>(`/holidays/${id}`, { method: 'DELETE' }),
};
