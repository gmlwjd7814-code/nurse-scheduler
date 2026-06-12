/**
 * 프론트엔드 타입 정의 (백엔드 types/index.ts와 동기화)
 */

export type ShiftCode =
  | 'D' | 'E' | 'N' | 'M' | 'Y' | 'H' | 'YH'
  | 'O' | 'V' | 'I' | 'CB' | 'C' | 'NE';

export type NurseRank = 'HEAD' | 'CHARGE' | 'RN' | 'GN';
export type WorkType = 'THREE_SHIFT' | 'NIGHT_ONLY' | 'HEAD_NURSE';
export type Capability = 'Desk' | 'SubDesk' | 'Acting';
export type DailyRole = 'Desk' | 'SubDesk' | 'Acting' | null;

export interface Nurse {
  id: number;
  name: string;
  rank: NurseRank;
  yearsOfService: number;
  workType: WorkType;
  capability: Capability;
  isActive: boolean;
  wardId: number;
  wardName?: string;
  preceptorId?: number | null;
  preceptorName?: string | null;
  monthlyOffOverride?: number | null;
}

export interface WardSettings {
  id: number;
  wardId: number;
  wardName: string;
  weekdayDCount: number;
  weekdayECount: number;
  weekdayNCount: number;
  weekendDCount: number;
  weekendECount: number;
  weekendNCount: number;
  monthlyOffCount: number;
  maxConsecutiveNE: number;
  maxConsecutiveWork: number; // 최대 연속 근무일 (기본 6)
}

export interface ShiftRequest {
  id: number;
  nurseId: number;
  nurseName?: string;
  year: number;
  month: number;
  day: number;
  requestedShift: 'O' | 'Y' | 'H' | 'YH';
  createdAt?: string;
}

export interface ScheduleEntry {
  id: number;
  scheduleId: number;
  nurseId: number;
  day: number;
  shift: ShiftCode;
  role: DailyRole;
  isViolation: boolean;
  violationReason?: string;
}

export interface Schedule {
  id: number;
  wardId: number;
  year: number;
  month: number;
  isPublished: boolean;
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FullSchedule {
  schedule: Schedule;
  entries: ScheduleEntry[];
  nurses: Nurse[];
}

export interface ScheduleViolation {
  nurseId: number;
  nurseName: string;
  day: number;
  rule: string;
  description: string;
  severity: 'ERROR' | 'WARNING';
}

export interface NurseMonthlyStats {
  nurseId: number;
  nurseName: string;
  rank: NurseRank;
  workType: WorkType;
  dCount: number;
  eCount: number;
  nCount: number;
  neCount: number;
  oCount: number;
  yCount: number;
  hCount: number;
  cbCount: number;
  weekendWorkCount: number;
  weekendOffCount: number;
  holidayWorkCount: number;  // 공휴일 근무 횟수
  totalWorkCount: number;    // 총 근무 횟수
  totalWorkHours: number;    // 총 근무 시간 (h)
  deskCount: number;
  subDeskCount: number;
  actingCount: number;
  hasViolation: boolean;
  violationCount: number;    // 위반 건수
}

// 근무 코드 한글 레이블
export const SHIFT_LABELS: Record<ShiftCode, string> = {
  D: '낮',
  E: '저녁',
  N: '야간',
  M: '상근',
  Y: '연차',
  H: '반차',
  YH: '연차반차',
  O: '오프',
  V: '경조',
  I: '공가',
  CB: '콜백',
  C: '당직',
  NE: '야간전담',
};

// 근무 코드별 배경색 (TailwindCSS 클래스)
export const SHIFT_BG_COLORS: Record<ShiftCode, string> = {
  D: 'bg-sky-200',
  E: 'bg-yellow-200',
  N: 'bg-purple-300',
  M: 'bg-gray-100',
  Y: 'bg-green-300',
  H: 'bg-lime-200',
  YH: 'bg-lime-400',
  O: 'bg-gray-300',
  V: 'bg-orange-200',
  I: 'bg-amber-100',
  CB: 'bg-orange-400',
  C: 'bg-red-300',
  NE: 'bg-blue-900',
};

// NE는 텍스트 흰색
export const SHIFT_TEXT_COLORS: Partial<Record<ShiftCode, string>> = {
  NE: 'text-white',
  N: 'text-white',
  C: 'text-white',
  CB: 'text-white',
};

// 직급 한글
export const RANK_LABELS: Record<NurseRank, string> = {
  HEAD: '수간호사',
  CHARGE: '책임',
  RN: '일반',
  GN: '신규',
};

// 근무형태 한글
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  THREE_SHIFT: '3교대',
  NIGHT_ONLY: '야간전담',
  HEAD_NURSE: '수간호사',
};
