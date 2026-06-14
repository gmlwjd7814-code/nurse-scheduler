/**
 * 근무표 시스템 전체 타입 정의
 * 모든 타입을 중앙에서 관리합니다
 */

// ===== 근무 코드 정의 =====
export type ShiftCode =
  | 'D'   // 낮근무
  | 'E'   // 저녁근무
  | 'N'   // 야간근무
  | 'M'   // 상근근무
  | 'Y'   // 연차
  | 'H'   // 반차
  | 'YH'  // 연차반차
  | 'O'   // 오프
  | 'V'   // 경조휴가
  | 'I'   // 공가
  | 'CB'  // 콜백
  | 'C'   // 당직근무
  | 'NE'; // 야간전담근무

// ===== 직급 코드 =====
export type NurseRank =
  | 'HEAD'    // 수간호사
  | 'CHARGE'  // 책임간호사
  | 'RN'      // 일반간호사
  | 'GN';     // 신규간호사

// ===== 근무 형태 =====
export type WorkType =
  | 'THREE_SHIFT'  // 일반 3교대
  | 'NIGHT_ONLY'   // 야간전담
  | 'HEAD_NURSE';  // 수간호사

// ===== 업무 역량 =====
export type Capability = 'Desk' | 'SubDesk' | 'Acting';

// ===== 일일 역할 배정 =====
export type DailyRole = 'Desk' | 'SubDesk' | 'Acting' | null;

// ===== 간호사 정보 =====
export interface Nurse {
  id: number;
  name: string;
  rank: NurseRank;
  yearsOfService: number; // 입사연차
  workType: WorkType;
  capability: Capability; // 최고 역량 (Desk > SubDesk > Acting)
  isActive: boolean;
  wardId: number;
  preceptorId?: number | null;
  preceptorName?: string;
  monthlyOffOverride?: number | null; // null이면 ward 기본값 사용
  createdAt?: Date;
  updatedAt?: Date;
}

// ===== 병동 설정 =====
export interface WardSettings {
  id: number;
  wardId: number;
  wardName: string;
  // 평일 필요 인원
  weekdayDCount: number;
  weekdayECount: number;
  weekdayNCount: number;
  // 주말 필요 인원
  weekendDCount: number;
  weekendECount: number;
  weekendNCount: number;
  // 월별 오프 개수
  monthlyOffCount: number;
  // 야간전담 연속 근무 최대일
  maxConsecutiveNE: number;
  // 최대 연속 근무일 (기본 6)
  maxConsecutiveWork: number;
  // 수간호사 근무 토요일 주차 (1=홀수 토, 2=짝수 토)
  headNurseSatWeek: number;
  updatedAt: Date;
}

// ===== 희망 근무 신청 =====
export interface ShiftRequest {
  id: number;
  nurseId: number;
  year: number;
  month: number;
  day: number;
  requestedShift: 'O' | 'Y' | 'H' | 'YH'; // 신청 가능 근무 유형
  createdAt: Date;
}

// ===== 근무표 엔트리 (한 셀) =====
export interface ScheduleEntry {
  id: number;
  scheduleId: number;
  nurseId: number;
  day: number;        // 1~31
  shift: ShiftCode;
  role: DailyRole;    // 당일 역할
  isViolation: boolean;
  violationReason?: string;
}

// ===== 근무표 (한 달) =====
export interface Schedule {
  id: number;
  wardId: number;
  year: number;
  month: number;
  isPublished: boolean;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ===== 근무표 + 엔트리 합친 완전한 데이터 =====
export interface FullSchedule {
  schedule: Schedule;
  entries: ScheduleEntry[];
  nurses: Nurse[];
  violations: ScheduleViolation[];
}

// ===== 규칙 위반 =====
export interface ScheduleViolation {
  nurseId: number;
  nurseName: string;
  day: number;
  rule: string;          // 위반 규칙 코드
  description: string;   // 한글 설명
  severity: 'ERROR' | 'WARNING';
}

// ===== 월별 통계 =====
export interface NurseMonthlyStats {
  nurseId: number;
  nurseName: string;
  rank: NurseRank;
  workType: WorkType;
  dCount: number;       // D 근무 횟수
  eCount: number;       // E 근무 횟수
  nCount: number;       // N 근무 횟수
  neCount: number;      // NE 근무 횟수
  oCount: number;       // 오프 횟수
  yCount: number;       // 연차 횟수
  hCount: number;       // 반차 횟수
  cbCount: number;      // 콜백 횟수
  weekendWorkCount: number;   // 주말 근무 횟수
  weekendOffCount: number;    // 주말 오프 횟수
  holidayWorkCount: number;   // 공휴일 근무 횟수 (NEW)
  totalWorkCount: number;     // 총 근무 횟수 (NEW)
  totalWorkHours: number;     // 총 근무 시간 (NEW)
  deskCount: number;          // Desk 담당 횟수
  subDeskCount: number;       // SubDesk 담당 횟수
  actingCount: number;        // Acting 담당 횟수
  hasViolation: boolean;      // 규칙 위반 여부
  violationCount: number;     // 위반 건수 (NEW)
}

// ===== 근무 코드별 근무 시간 =====
export const SHIFT_HOURS: Partial<Record<ShiftCode, number>> = {
  D: 8,   // 낮근무 8시간
  E: 8,   // 저녁근무 8시간
  N: 10,  // 야간근무 10시간
  NE: 10, // 야간전담 10시간
  M: 8,   // 상근 8시간
  CB: 4,  // 콜백 4시간
  C: 8,   // 당직 8시간
};

// ===== 스케줄 생성 요청 =====
export interface GenerateScheduleRequest {
  wardId: number;
  year: number;
  month: number;
  useRequests: boolean; // 희망 오프 반영 여부
}

// ===== API 응답 형식 =====
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== 스케줄러 내부 상태 (알고리즘용) =====
export interface NurseScheduleState {
  nurseId: number;
  shifts: (ShiftCode | null)[];  // index 0 = 1일 (day-1)
  consecutiveN: number;          // 연속 야간 카운트
  consecutiveD: number;          // 연속 낮근무 카운트
  consecutiveWork: number;       // 연속 근무일 (NEW: 최대 6일)
  totalD: number;
  totalE: number;
  totalN: number;
  totalO: number;
  weekendWorkCount: number;      // 주말 근무 횟수 (NEW)
  holidayWorkCount: number;      // 공휴일 근무 횟수 (NEW)
  weekendOffDays: number[];      // 주말 오프 날짜 목록
  deskCount: number;
  subDeskCount: number;
  actingCount: number;
  totalDEShifts: number;         // D+E 총 횟수 (Desk 비율 계산용, NEW)
  nightAfterOffNeeded: number;
}

// ===== 날짜 유틸리티 =====
export interface DayInfo {
  day: number;           // 1~31
  dayOfWeek: number;     // 0=일, 1=월 ... 6=토
  isWeekend: boolean;    // 토,일
  isHoliday: boolean;    // 공휴일
  isSaturday: boolean;
  isSunday: boolean;
}
