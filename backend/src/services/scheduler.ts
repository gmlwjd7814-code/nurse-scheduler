/**
 * AI 근무표 자동 생성 서비스 — v2 (우선순위 기반 최적화)
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  우선순위 체계                                             │
 * │  1순위 (절대 위반 금지):                                   │
 * │    - 수간호사 규칙 (일/공휴일 OFF, 격주 토 OFF, D만 가능)   │
 * │    - 야간전담 규칙 (NE/O 패턴, D/E/N 금지)                 │
 * │    - E→D 금지                                             │
 * │    - N 4일 이상 금지 (최대 3일 연속)                        │
 * │    - 연속 근무 최대 6일                                    │
 * │    - 역할 역량 제한 (Desk/SubDesk/Acting)                  │
 * │    - 신규간호사 단독 야간 금지                              │
 * │    - 매일 Desk 가능 인력 최소 1명                           │
 * │    - 주임급(Charge+) 최소 1명                              │
 * │  2순위: 희망 오프/연차 반영                                 │
 * │  3순위: 야간근무 횟수 균등 분배                             │
 * │  4순위: 주말/공휴일 근무 균등 분배                          │
 * │  5순위: Desk/SubDesk/Acting 균등 분배                      │
 * │  6순위: 개인별 총 근무 수 균형                              │
 * └──────────────────────────────────────────────────────────┘
 */

import { query } from '../database/connection';
import {
  Nurse, ShiftCode, WardSettings, ShiftRequest,
  ScheduleEntry, ScheduleViolation, DayInfo, DailyRole,
} from '../types';

// ===== 내부 상태 타입 =====
interface NurseState {
  nurse: Nurse;
  shifts: (ShiftCode | null)[];
  roles: (DailyRole | null)[];
  consecutiveN: number;      // 현재 진행 중인 연속 N 카운터 (O 만나면 nRunSize로 이동)
  consecutiveD: number;
  consecutiveE: number;      // 연속 E 카운터 (E cascade 방지용)
  consecutiveWork: number;   // 연속 근무일 카운트 (OFF 계열 만나면 0으로 초기화)
  totalD: number;
  totalE: number;
  totalN: number;
  totalNE: number;
  totalO: number;
  totalY: number;
  totalWork: number;         // D+E+N+NE+M+CB+C 합산
  weekendWorkCount: number;
  holidayWorkCount: number;
  weekendOffDays: number[];
  deskCount: number;
  subDeskCount: number;
  actingCount: number;
  totalDEShifts: number;     // Desk 역할 배정 대상 근무 수 (D+E)
  nRunSize: number;          // 회복 중인 N 런 크기 (0 = 비회복 상태)
  oAfterN: number;           // N 런 종료 후 취한 O 일수 (nRunSize > 0 일 때만 유효)
}

// ===== 오프 계열 근무 (연속 근무 카운트 초기화 대상) =====
const OFF_SHIFTS = new Set<ShiftCode>(['O', 'Y', 'H', 'YH', 'V', 'I']);

function isWorkShift(shift: ShiftCode): boolean {
  return !OFF_SHIFTS.has(shift);
}

// ===== 날짜 유틸 =====
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getDayInfo(year: number, month: number, day: number): DayInfo {
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  return {
    day, dayOfWeek: dow,
    isWeekend: dow === 0 || dow === 6,
    isHoliday: false,
    isSaturday: dow === 6,
    isSunday: dow === 0,
  };
}

async function buildDayInfoList(year: number, month: number, daysInMonth: number): Promise<DayInfo[]> {
  const holidayResult = await query<{ day: number }>(
    'SELECT day FROM holidays WHERE year = $1 AND month = $2',
    [year, month]
  );
  const holidayDays = new Set(holidayResult.rows.map((r) => r.day));

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const info = getDayInfo(year, month, day);
    info.isHoliday = holidayDays.has(day);
    return info;
  });
}

// ===== 필요 인원 조회 =====
function getRequiredCount(shift: ShiftCode, dayInfo: DayInfo, settings: WardSettings): number {
  const isSpecial = dayInfo.isWeekend || dayInfo.isHoliday;
  if (shift === 'D') return isSpecial ? settings.weekendDCount : settings.weekdayDCount;
  if (shift === 'E') return isSpecial ? settings.weekendECount : settings.weekdayECount;
  if (shift === 'N') return isSpecial ? settings.weekendNCount : settings.weekdayNCount;
  return 0;
}

// ===== 수간호사 배정 =====
// headNurseSatWeek: 1 = 홀수 번째 토요일 근무(1,3,5번째 토→D, 2,4번째 토→O)
//                  2 = 짝수 번째 토요일 근무(2,4번째 토→D, 1,3,5번째 토→O)
function assignHeadNurse(state: NurseState, dayInfos: DayInfo[], headNurseSatWeek: number = 1): void {
  let saturdayCount = 0;
  for (const info of dayInfos) {
    const idx = info.day - 1;
    let shift: ShiftCode;

    if (info.isSunday || info.isHoliday) {
      shift = 'O';
    } else if (info.isSaturday) {
      saturdayCount++;
      // headNurseSatWeek=1: 홀수 토(1,3,5) → D, 짝수 토(2,4) → O
      // headNurseSatWeek=2: 짝수 토(2,4) → D, 홀수 토(1,3,5) → O
      const isWorkSat = headNurseSatWeek === 1
        ? saturdayCount % 2 === 1
        : saturdayCount % 2 === 0;
      shift = isWorkSat ? 'D' : 'O';
    } else {
      shift = 'D';
    }

    state.shifts[idx] = shift;
    applyShiftToState(state, shift, info);
  }
}

// ===== 야간전담 배정 =====
function assignNightExclusive(
  state: NurseState,
  dayInfos: DayInfo[],
  maxConsecutiveNE: number,
  nurseIndex: number = 0,
  totalNightOnlyNurses: number = 1,
): void {
  const daysInMonth = dayInfos.length;
  const targetNE = 15;
  let neCount = 0;

  // 간호사마다 시작 위상을 다르게 줘서 동일 패턴 방지
  const cycle = maxConsecutiveNE + 2; // NE런 + O 2일
  const initialPhase = Math.floor(nurseIndex * cycle / totalNightOnlyNurses);
  let consecNE = initialPhase < maxConsecutiveNE ? initialPhase : 0;
  let offNeeded = initialPhase >= maxConsecutiveNE ? cycle - initialPhase : 0;

  for (let i = 0; i < daysInMonth; i++) {
    const dayInfo = dayInfos[i];

    if (neCount >= targetNE) {
      // 월 목표 NE 달성 → 나머지는 O
      const shift: ShiftCode = daysInMonth === 31 && state.totalY === 0 && i === daysInMonth - 1 ? 'Y' : 'O';
      state.shifts[i] = shift;
      applyShiftToState(state, shift, dayInfo);
    } else if (offNeeded > 0) {
      // NE 런 종료 후 강제 O 기간
      state.shifts[i] = 'O';
      applyShiftToState(state, 'O', dayInfo);
      offNeeded--;
      if (offNeeded === 0) consecNE = 0;
    } else if (consecNE >= maxConsecutiveNE) {
      // 최대 연속 NE 도달 → O 2일 시작 (이 날이 1번째 O, offNeeded=1로 다음 날도 O)
      state.shifts[i] = 'O';
      applyShiftToState(state, 'O', dayInfo);
      offNeeded = 1;
      // consecNE는 offNeeded가 0이 될 때(다음 O 후) 초기화
    } else {
      state.shifts[i] = 'NE';
      applyShiftToState(state, 'NE', dayInfo);
      neCount++;
      consecNE++;
    }
  }
}

// ===== 희망 오프 적용 =====
function applyShiftRequests(state: NurseState, requests: ShiftRequest[], dayInfos: DayInfo[]): void {
  const nurseRequests = requests.filter((r) => r.nurseId === state.nurse.id);
  for (const req of nurseRequests) {
    const idx = req.day - 1;
    if (idx >= 0 && idx < state.shifts.length && state.shifts[idx] === null) {
      state.shifts[idx] = req.requestedShift as ShiftCode;
      applyShiftToState(state, req.requestedShift as ShiftCode, dayInfos[idx]);
    }
  }
}

// ===== 상태 업데이트 =====
function applyShiftToState(state: NurseState, shift: ShiftCode, dayInfo: DayInfo): void {
  if (isWorkShift(shift)) {
    state.consecutiveWork++;
    state.totalWork++;
    if (dayInfo.isWeekend) state.weekendWorkCount++;
    if (dayInfo.isHoliday) state.holidayWorkCount++;
  } else {
    state.consecutiveWork = 0;
    if (dayInfo.isWeekend) state.weekendOffDays.push(dayInfo.day);
  }

  if (!isWorkShift(shift)) {
    // 오프 계열 (O, Y, H, YH, V, I)
    switch (shift) {
      case 'O': state.totalO++; break;
      case 'Y': state.totalY++; break;
    }
    state.consecutiveD = 0;
    state.consecutiveE = 0;
    // N 회복 추적: N 런 종료 후 첫 번째 오프
    if (state.consecutiveN > 0) {
      state.nRunSize = state.consecutiveN;
      state.oAfterN = 1;
      state.consecutiveN = 0;
    } else if (state.nRunSize > 0) {
      state.oAfterN++;
      // O 2개 이상 → 회복 완료 (단일 N: 2번째 O에서 D/M 가능)
      if (state.oAfterN >= 2) {
        state.nRunSize = 0;
        state.oAfterN = 0;
      }
    }
  } else if (shift === 'N') {
    state.totalN++;
    state.consecutiveN++;
    state.consecutiveD = 0;
    state.consecutiveE = 0;
    // N 런 진행 중: 첫 번째 오프가 올 때 nRunSize 설정
  } else {
    // 비-N 근무 (D, E, M, NE, CB, C 등)
    switch (shift) {
      case 'D':  state.totalD++; state.totalDEShifts++; state.consecutiveD++; state.consecutiveE = 0; break;
      case 'E':  state.totalE++; state.totalDEShifts++; state.consecutiveD = 0; state.consecutiveE++; break;
      case 'NE': state.totalNE++; state.consecutiveD = 0; state.consecutiveE = 0; break;
      default:   state.consecutiveD = 0; state.consecutiveE = 0; break;
    }
    // 비-N 근무는 N 회복 상태 완전 초기화
    state.consecutiveN = 0;
    state.nRunSize = 0;
    state.oAfterN = 0;
  }
}

// ===== 1순위: 배정 가능 여부 (절대 규칙) =====
function canAssign(
  shift: ShiftCode,
  state: NurseState,
  dayIdx: number,
  dayInfo: DayInfo,
  settings: WardSettings,
  allStates: NurseState[],
): boolean {
  const prevShift = dayIdx > 0 ? state.shifts[dayIdx - 1] : null;

  // [절대] E→D 금지
  if (shift === 'D' && prevShift === 'E') return false;

  // [절대] 11시간 미만 금지: N 종료(07:00) 후 D/E/M 직접 배정 금지
  // N→D: 0h, N→E: 7h, N→M: 2h → 모두 11시간 미만
  if (prevShift === 'N' && (shift === 'D' || shift === 'E' || shift === 'M')) return false;

  // [절대] N 회복 규칙
  // nRunSize > 0: N 런 종료 후 회복 중
  if (state.nRunSize > 0 && isWorkShift(shift)) {
    const runSize = state.nRunSize;
    const oTaken = state.oAfterN;
    if (runSize >= 2) {
      // N 2개 이상: O 2개 필수 후 모든 근무 허용
      if (oTaken < 2) return false;
    } else {
      // 단일 N: O 1개 후 E만 허용, O 2개 이상 후 모든 근무 허용
      // (oTaken은 1에서 시작하므로 < 1 케이스는 없음)
      if (oTaken === 1 && shift !== 'E') return false;
      // oTaken >= 2: 모든 근무 허용 (nRunSize는 이미 0으로 초기화됨)
    }
  }

  // [절대] N 연속 최대 3일 (4일 이상 금지)
  if (shift === 'N' && state.consecutiveN >= 3) return false;

  // [절대] E 연속 최대 3일 (E cascade → D 부족 방지)
  if (shift === 'E' && state.consecutiveE >= 3) return false;

  // [절대] 연속 D 최대 4일
  if (shift === 'D' && state.consecutiveD >= 4) return false;

  // [절대] 연속 근무 최대
  if (isWorkShift(shift) && state.consecutiveWork >= settings.maxConsecutiveWork) return false;

  // [절대] 신규간호사(GN) N 단독 금지
  // — 같은 날 이미 N 확정된 시니어(non-GN) 간호사가 없으면 GN은 N 불가
  if (shift === 'N' && state.nurse.rank === 'GN') {
    const seniorsOnN = allStates.filter(
      (s) =>
        s.nurse.id !== state.nurse.id &&
        s.nurse.rank !== 'GN' &&
        s.nurse.workType === 'THREE_SHIFT' &&
        s.shifts[dayIdx] === 'N'
    );
    if (seniorsOnN.length === 0) return false;
  }

  return true;
}

// ===== O 배정 가능 여부 =====
function canAssignOff(state: NurseState, settings: WardSettings): boolean {
  if (state.nRunSize >= 2 && state.oAfterN < 2) return true;
  const maxOff = state.nurse.monthlyOffOverride ?? settings.monthlyOffCount;
  return state.totalO < maxOff;
}

// ===== 다음 배정 가능 근무 목록 =====
function getValidShifts(
  state: NurseState,
  dayIdx: number,
  dayInfo: DayInfo,
  settings: WardSettings,
  allStates: NurseState[],
): ShiftCode[] {
  const candidates: ShiftCode[] = ['D', 'E', 'N', 'O'];
  return candidates.filter((s) => {
    if (s === 'O' && !canAssignOff(state, settings)) return false;
    return canAssign(s, state, dayIdx, dayInfo, settings, allStates);
  });
}

// ===== 그리디 점수 계산 (높을수록 배정 선호) =====
function scoreShift(
  shift: ShiftCode,
  state: NurseState,
  dayIdx: number,
  dayInfo: DayInfo,
  currentCounts: Record<string, number>,
  settings: WardSettings,
  threeShiftStates: NurseState[],
  dayInfos: DayInfo[],
): number {
  let score = 0;
  const required = getRequiredCount(shift, dayInfo, settings);
  const current = currentCounts[shift] || 0;

  // [P1] 인원 부족 근무 우선 채움 (가장 높은 점수)
  if (current < required) {
    score += (required - current) * 200;
  }

  // [P3] 야간근무 균등 분배
  if (shift === 'N') {
    const allN = threeShiftStates.map((s) => s.totalN);
    const avgN = allN.reduce((a, b) => a + b, 0) / (allN.length || 1);
    score += Math.max(0, avgN - state.totalN) * 40; // N 적은 사람에게 더 높은 점수

    // N+2일 D 가용성 보호: N recovery 클러스터링 방지
    const d2 = dayIdx + 2;
    if (d2 < dayInfos.length) {
      const d2Info = dayInfos[d2];
      const reqD = getRequiredCount('D', d2Info, settings);
      let dCapable = 0;
      for (const s of threeShiftStates) {
        if (s === state) continue; // 이 간호사는 N→O→E only
        if (s.shifts[d2] !== null) { if (s.shifts[d2] === 'D') dCapable++; continue; }
        if (s.nRunSize > 0) continue;           // N recovery 중 → D 불가
        if (s.shifts[d2 - 1] === 'N') continue; // 전날 N → D 불가
        if (s.shifts[d2 - 1] === 'E') continue; // 전날 E → D 불가
        dCapable++;
      }
      if (dCapable < reqD) score -= 300; // D 가용 부족 예상 → N 배정 억제
    }
  }

  // D 연속 패널티: 3연속 이상 시 score 감소로 4연속 자연 억제
  if (shift === 'D' && state.consecutiveD >= 3) score -= 300;

  // [P4] 주말/공휴일 균등 분배
  if (dayInfo.isWeekend) {
    const allWW = threeShiftStates.map((s) => s.weekendWorkCount);
    const avgWW = allWW.reduce((a, b) => a + b, 0) / (allWW.length || 1);
    if (shift === 'O') {
      score += Math.max(0, state.weekendWorkCount - avgWW) * 30; // 주말 많이 일한 사람 O 선호
    } else if (isWorkShift(shift)) {
      score += Math.max(0, avgWW - state.weekendWorkCount) * 25; // 주말 적게 일한 사람 근무 선호
    }
  }
  if (dayInfo.isHoliday && isWorkShift(shift)) {
    const allHW = threeShiftStates.map((s) => s.holidayWorkCount);
    const avgHW = allHW.reduce((a, b) => a + b, 0) / (allHW.length || 1);
    score += Math.max(0, avgHW - state.holidayWorkCount) * 25;
  }

  // [P6] 총 근무 균형
  if (isWorkShift(shift)) {
    const allWork = threeShiftStates.map((s) => s.totalWork);
    const avgWork = allWork.reduce((a, b) => a + b, 0) / (allWork.length || 1);
    score += Math.max(0, avgWork - state.totalWork) * 10;
  }

  // 주말 오프 보장 (월 1회)
  if ((dayInfo.isWeekend) && state.weekendOffDays.length === 0 && shift === 'O') {
    score += 80;
  }

  // 프리셉터와 동일 근무 우선 (신규간호사)
  if (state.nurse.rank === 'GN' && state.nurse.preceptorId) {
    const preceptorState = threeShiftStates.find(
      (s) => s.nurse.id === state.nurse.preceptorId
    );
    if (preceptorState?.shifts[dayIdx] === shift) {
      score += 60;
    }
  }

  return score;
}

// ===== 역할 배정 (Desk / SubDesk / Acting) v2 =====
// Desk 역할 편중 방지: deskCount/totalDEShifts > 0.5 이면 Desk 후순위
function assignDailyRoles(allStates: NurseState[], dayInfos: DayInfo[]): void {
  for (const dayInfo of dayInfos) {
    const idx = dayInfo.day - 1;
    const workingNurses = allStates.filter(
      (s) => s.shifts[idx] === 'D' || s.shifts[idx] === 'E'
    );
    if (workingNurses.length === 0) continue;

    // Desk 배정 — Desk 역량 + 과도한 Desk 편중 방지
    const deskCandidates = workingNurses.filter(
      (s) => s.nurse.capability === 'Desk'
    ).sort((a, b) => {
      // 역할 편중 페널티: deskRatio가 높을수록 후순위
      const ratioA = a.totalDEShifts > 0 ? a.deskCount / a.totalDEShifts : 0;
      const ratioB = b.totalDEShifts > 0 ? b.deskCount / b.totalDEShifts : 0;
      return ratioA - ratioB; // 낮은 비율 우선
    });
    if (deskCandidates.length > 0) {
      const picked = deskCandidates[0];
      picked.roles[idx] = 'Desk';
      picked.deskCount++;
    }

    // SubDesk 배정
    const subDeskCandidates = workingNurses
      .filter(
        (s) =>
          (s.nurse.capability === 'Desk' || s.nurse.capability === 'SubDesk') &&
          s.roles[idx] !== 'Desk'
      )
      .sort((a, b) => a.subDeskCount - b.subDeskCount);
    if (subDeskCandidates.length > 0) {
      const picked = subDeskCandidates[0];
      picked.roles[idx] = 'SubDesk';
      picked.subDeskCount++;
    }

    // Acting 배정 (나머지)
    for (const s of workingNurses) {
      if (!s.roles[idx]) {
        s.roles[idx] = 'Acting';
        s.actingCount++;
      }
    }
  }
}

// ===== Phase 2: 최적화 헬퍼 =====

/**
 * 단일 간호사 시퀀스 유효성 검사 (절대 규칙만)
 * 최적화 phase에서 swap 전후를 검증할 때 사용
 *
 * N 회복 규칙:
 *   단일 N → O 1개 후 E만 허용 / O 2개 후 모든 근무 허용
 *   N 2연속 → O 2개 필수 후 모든 근무 허용
 *   N 3연속 → O 2개 필수 후 모든 근무 허용
 * 11시간 규칙:
 *   N→D(0h), N→E(7h), N→M(2h) 직접 배정 금지
 */
export function validateNurseSeq(
  shifts: (ShiftCode | null)[],
  settings: WardSettings,
): boolean {
  let consecN = 0;   // 진행 중인 연속 N 카운터
  let consecD = 0;
  let consecE = 0;
  let consecWork = 0;
  let nRunSize = 0;  // 회복 중인 N 런 크기 (0 = 비회복)
  let oAfterN = 0;   // N 런 종료 후 취한 O 수

  for (let i = 0; i < shifts.length; i++) {
    const s = shifts[i];
    if (!s) continue;
    const prev = i > 0 ? shifts[i - 1] : null;

    // [절대] E→D 금지
    if (s === 'D' && prev === 'E') return false;

    // [절대] 11시간 미만: N→D/E/M 직접 금지
    if (prev === 'N' && (s === 'D' || s === 'E' || s === 'M')) return false;

    // [절대] E 연속 최대 3일
    if (s === 'E' && consecE >= 3) return false;

    // [절대] N 회복 규칙 위반 체크
    if (nRunSize > 0 && isWorkShift(s)) {
      if (nRunSize >= 2) {
        if (oAfterN < 2) return false;
      } else {
        // 단일 N: O 1개 후 E만 허용
        if (oAfterN === 1 && s !== 'E') return false;
        // oAfterN >= 2 → 모든 근무 허용 (이미 nRunSize=0으로 초기화됨)
      }
    }

    // 상태 업데이트
    if (s === 'N') {
      consecN++;
      if (consecN > 3) return false;
      consecE = 0;
    } else if (!isWorkShift(s)) {
      // 오프 (O, Y, H 등)
      consecE = 0;
      if (consecN > 0 && nRunSize === 0) {
        nRunSize = consecN;
        oAfterN = 1;
        consecN = 0;
      } else if (nRunSize > 0) {
        oAfterN++;
        if (oAfterN >= 2) { nRunSize = 0; oAfterN = 0; }
      }
    } else {
      // 비-N 근무 (D, E, M 등): N 상태 완전 초기화
      consecN = 0;
      nRunSize = 0;
      oAfterN = 0;
      if (s === 'E') consecE++;
      else consecE = 0;
    }

    // D 연속 추적
    if (s === 'D') { consecD++; if (consecD > 4) return false; }
    else consecD = 0;

    // 연속 근무 추적
    if (isWorkShift(s)) { consecWork++; if (consecWork > settings.maxConsecutiveWork) return false; }
    else consecWork = 0;
  }

  return true;
}

/**
 * 같은 날, 두 간호사 간 근무↔오프 교환 시도
 * giver: 근무를 넘겨주는 간호사, taker: 오프를 넘겨주는 간호사
 * 성공 시 상태를 직접 수정하고 true 반환; 실패 시 원상 복구 후 false
 */
function trySwapShifts(
  giver: NurseState,
  taker: NurseState,
  dayIdx: number,
  dayInfo: DayInfo,
  allThreeShift: NurseState[],
  settings: WardSettings,
  reqOffSet: Set<string>,
): boolean {
  const giverShift = giver.shifts[dayIdx];
  const takerShift = taker.shifts[dayIdx];

  if (!giverShift || !takerShift) return false;
  if (!isWorkShift(giverShift)) return false;   // giver는 근무여야 함
  if (isWorkShift(takerShift)) return false;     // taker는 오프여야 함

  // 희망 오프 날짜는 교환 불가
  if (reqOffSet.has(`${taker.nurse.id}-${dayInfo.day}`)) return false;

  // 시니어(CHARGE) D/E 포기 시 시니어 부재 방지
  if ((giver.nurse.rank === 'CHARGE') && (giverShift === 'D' || giverShift === 'E')) {
    const otherSeniorOnDE = allThreeShift.some(
      (s) => s !== giver &&
             (s.nurse.rank === 'CHARGE') &&
             (s.shifts[dayIdx] === 'D' || s.shifts[dayIdx] === 'E')
    );
    if (!otherSeniorOnDE) return false;
  }

  // GN 단독 야간 금지: taker가 GN이고 N을 받으면 시니어 확인
  if (giverShift === 'N' && taker.nurse.rank === 'GN') {
    const seniorsOnN = allThreeShift.filter(
      (s) =>
        s.nurse.id !== giver.nurse.id &&
        s.nurse.id !== taker.nurse.id &&
        s.nurse.rank !== 'GN' &&
        s.shifts[dayIdx] === 'N',
    );
    if (seniorsOnN.length === 0) return false;
  }

  // 교환 시도
  const origGiver = giver.shifts[dayIdx];
  const origTaker = taker.shifts[dayIdx];
  giver.shifts[dayIdx] = takerShift;
  taker.shifts[dayIdx] = giverShift;

  const giverMaxOff = giver.nurse.monthlyOffOverride ?? settings.monthlyOffCount;
  if (
    giver.totalO < giverMaxOff &&
    validateNurseSeq(giver.shifts, settings) &&
    validateNurseSeq(taker.shifts, settings)
  ) {
    // 카운터 업데이트 (giver: 근무→오프, taker: 오프→근무)
    const work = giverShift;
    if (work === 'N') { giver.totalN--; taker.totalN++; }
    else if (work === 'D') { giver.totalD--; giver.totalDEShifts--; taker.totalD++; taker.totalDEShifts++; }
    else if (work === 'E') { giver.totalE--; giver.totalDEShifts--; taker.totalE++; taker.totalDEShifts++; }
    giver.totalWork--;
    giver.totalO++;
    taker.totalWork++;
    taker.totalO = Math.max(0, taker.totalO - 1);

    if (dayInfo.isWeekend) {
      giver.weekendWorkCount--;
      if (!giver.weekendOffDays.includes(dayInfo.day)) giver.weekendOffDays.push(dayInfo.day);
      taker.weekendWorkCount++;
      taker.weekendOffDays = taker.weekendOffDays.filter((d) => d !== dayInfo.day);
    }
    if (dayInfo.isHoliday) { giver.holidayWorkCount--; taker.holidayWorkCount++; }

    return true;
  }

  // 원상 복구
  giver.shifts[dayIdx] = origGiver;
  taker.shifts[dayIdx] = origTaker;
  return false;
}

/**
 * Phase 2 최적화: 야간 / 주말 / 공휴일 근무 균등 분배
 * 탐욕적 교환(greedy swap) 방식으로 편차를 최소화
 */
function runOptimization(
  threeShiftStates: NurseState[],
  dayInfos: DayInfo[],
  settings: WardSettings,
  requests: ShiftRequest[],
): void {
  const reqOffSet = new Set(requests.map((r) => `${r.nurseId}-${r.day}`));

  // 최대 5번 반복 (각 패스에서 개선이 없으면 조기 종료)
  for (let pass = 0; pass < 5; pass++) {
    let improved = false;

    // ── 야간근무 균등 분배 ──────────────────────────────
    {
      const avgN = threeShiftStates.reduce((s, t) => s + t.totalN, 0) / threeShiftStates.length;
      const sorted = [...threeShiftStates].sort((a, b) => b.totalN - a.totalN);

      outer: for (let hi = 0; hi < sorted.length; hi++) {
        const giver = sorted[hi];
        if (giver.totalN <= Math.ceil(avgN)) break;

        for (let lo = sorted.length - 1; lo > hi; lo--) {
          const taker = sorted[lo];
          if (taker.totalN >= Math.floor(avgN)) continue;

          for (let d = 0; d < dayInfos.length; d++) {
            if (giver.shifts[d] !== 'N') continue;
            if (isWorkShift(taker.shifts[d] as ShiftCode)) continue;

            if (trySwapShifts(giver, taker, d, dayInfos[d], threeShiftStates, settings, reqOffSet)) {
              improved = true;
              if (giver.totalN <= Math.ceil(avgN)) continue outer;
              break;
            }
          }
        }
      }
    }

    // ── 주말근무 균등 분배 ──────────────────────────────
    {
      const weekendDays = dayInfos.filter((d) => d.isWeekend);
      const avgWW = threeShiftStates.reduce((s, t) => s + t.weekendWorkCount, 0) / threeShiftStates.length;
      const sorted = [...threeShiftStates].sort((a, b) => b.weekendWorkCount - a.weekendWorkCount);

      outer: for (let hi = 0; hi < sorted.length; hi++) {
        const giver = sorted[hi];
        if (giver.weekendWorkCount <= Math.ceil(avgWW)) break;

        for (let lo = sorted.length - 1; lo > hi; lo--) {
          const taker = sorted[lo];
          if (taker.weekendWorkCount >= Math.floor(avgWW)) continue;

          for (const wDay of weekendDays) {
            const d = wDay.day - 1;
            if (!isWorkShift(giver.shifts[d] as ShiftCode)) continue;
            if (isWorkShift(taker.shifts[d] as ShiftCode)) continue;

            if (trySwapShifts(giver, taker, d, wDay, threeShiftStates, settings, reqOffSet)) {
              improved = true;
              if (giver.weekendWorkCount <= Math.ceil(avgWW)) continue outer;
              break;
            }
          }
        }
      }
    }

    // ── 공휴일 근무 균등 분배 ──────────────────────────
    {
      const holidayDays = dayInfos.filter((d) => d.isHoliday);
      if (holidayDays.length > 0) {
        const avgHW = threeShiftStates.reduce((s, t) => s + t.holidayWorkCount, 0) / threeShiftStates.length;
        const sorted = [...threeShiftStates].sort((a, b) => b.holidayWorkCount - a.holidayWorkCount);

        outer: for (let hi = 0; hi < sorted.length; hi++) {
          const giver = sorted[hi];
          if (giver.holidayWorkCount <= Math.ceil(avgHW)) break;

          for (let lo = sorted.length - 1; lo > hi; lo--) {
            const taker = sorted[lo];
            if (taker.holidayWorkCount >= Math.floor(avgHW)) continue;

            for (const hDay of holidayDays) {
              const d = hDay.day - 1;
              if (!isWorkShift(giver.shifts[d] as ShiftCode)) continue;
              if (isWorkShift(taker.shifts[d] as ShiftCode)) continue;

              if (trySwapShifts(giver, taker, d, hDay, threeShiftStates, settings, reqOffSet)) {
                improved = true;
                if (giver.holidayWorkCount <= Math.ceil(avgHW)) continue outer;
                break;
              }
            }
          }
        }
      }
    }

    if (!improved) break; // 더 이상 개선 없음
  }
}

// ===== 규칙 위반 검증 (validateSchedule) =====
export function validateSchedule(
  allStates: NurseState[],
  dayInfos: DayInfo[],
  settings: WardSettings,
): ScheduleViolation[] {
  const violations: ScheduleViolation[] = [];
  const daysInMonth = dayInfos.length;

  for (const state of allStates) {
    const { nurse, shifts } = state;
    let consecN = 0;
    let consecD = 0;
    let consecWork = 0;
    let nRunSize = 0;   // 회복 중인 N 런 크기 (0 = 비회복)
    let oAfterN = 0;    // N 런 종료 후 취한 O 수
    let consecNE = 0;   // 야간전담 NE 연속 카운터
    let reqOforNE = 0;  // NE 런 종료 후 필요한 O 개수
    const hasWeekendOff = state.weekendOffDays.length > 0;

    for (let i = 0; i < daysInMonth; i++) {
      const shift = shifts[i];
      const di = dayInfos[i];
      const prev = i > 0 ? shifts[i - 1] : null;

      if (!shift) continue;

      // 연속 근무 추적
      if (isWorkShift(shift)) { consecWork++; } else { consecWork = 0; }

      // [1순위] E→D 금지
      if (prev === 'E' && shift === 'D') {
        violations.push({
          nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
          rule: 'E_BEFORE_D',
          description: `${i}일 E근무 다음날(${i + 1}일) D 배정 불가`,
          severity: 'ERROR',
        });
      }

      // [1순위] 11시간 미만 금지: N→D/E/M 직접 배정 금지
      if (prev === 'N' && (shift === 'D' || shift === 'E' || shift === 'M') &&
          nurse.workType !== 'NIGHT_ONLY') {
        violations.push({
          nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
          rule: 'N_DIRECT_TO_WORK',
          description: `N근무 직후(${i}일→${i + 1}일) ${shift} 배정 불가 (11시간 미만 휴식)`,
          severity: 'ERROR',
        });
      }

      // [1순위] D 연속 최대 4일 (수간호사는 상근 특성상 제외)
      if (shift === 'D') { consecD++; }
      else { consecD = 0; }
      if (consecD > 4 && nurse.workType !== 'HEAD_NURSE') {
        violations.push({
          nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
          rule: 'MAX_CONSECUTIVE_D',
          description: `D근무 ${consecD}일 연속 (최대 4일)`,
          severity: 'ERROR',
        });
      }

      // [1순위] N 회복 규칙 위반 체크 (consecN 갱신 전에 먼저)
      if (nRunSize > 0 && isWorkShift(shift) && nurse.workType !== 'NIGHT_ONLY') {
        let violation = false;
        let desc = '';
        if (nRunSize >= 2) {
          if (oAfterN < 2) {
            violation = true;
            desc = `N ${nRunSize}연속 후 O ${oAfterN}개만 취함 (최소 2개 필요), 현재: ${shift}`;
          }
        } else {
          // 단일 N: O 1개 후 E만 허용
          if (oAfterN === 1 && shift !== 'E') {
            violation = true;
            desc = `N 1회 후 O 1개만 취하면 E만 가능 (현재: ${shift})`;
          }
        }
        if (violation) {
          violations.push({
            nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
            rule: 'N_AFTER_O_REQUIRED',
            description: desc,
            severity: 'ERROR',
          });
        }
      }

      // N 회복 상태 업데이트
      if (shift === 'N' && nurse.workType !== 'NIGHT_ONLY') {
        consecN++;
      } else if (!isWorkShift(shift)) {
        if (consecN > 0 && nRunSize === 0) {
          nRunSize = consecN;
          oAfterN = 1;
          consecN = 0;
        } else if (nRunSize > 0) {
          oAfterN++;
          if (oAfterN >= 2) { nRunSize = 0; oAfterN = 0; }
        }
      } else if (shift !== 'N') {
        // 비-N 근무: N 회복 완전 초기화
        consecN = 0;
        nRunSize = 0;
        oAfterN = 0;
      }

      // [1순위] N 연속 최대 3일
      if (consecN > 3) {
        violations.push({
          nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
          rule: 'MAX_CONSECUTIVE_N',
          description: `N근무 ${consecN}일 연속 (최대 3일, 4일 이상 절대 금지)`,
          severity: 'ERROR',
        });
      }

      // [1순위] 연속 근무 최대 6일 (수간호사는 상근 특성상 제외)
      if (consecWork > settings.maxConsecutiveWork && nurse.workType !== 'HEAD_NURSE') {
        violations.push({
          nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
          rule: 'MAX_CONSECUTIVE_WORK',
          description: `연속 근무 ${consecWork}일 (최대 ${settings.maxConsecutiveWork}일)`,
          severity: 'ERROR',
        });
      }

      // [1순위] 수간호사 E/N 금지
      if (nurse.workType === 'HEAD_NURSE' && (shift === 'E' || shift === 'N')) {
        violations.push({
          nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
          rule: 'HEAD_NURSE_SHIFT',
          description: `수간호사 ${shift} 근무 배정 불가`,
          severity: 'ERROR',
        });
      }

      // [1순위] 야간전담 D/E/N 금지
      if (nurse.workType === 'NIGHT_ONLY' && ['D', 'E', 'N'].includes(shift)) {
        violations.push({
          nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
          rule: 'NIGHT_ONLY_SHIFT',
          description: `야간전담 간호사 ${shift} 배정 불가`,
          severity: 'ERROR',
        });
      }

      // [1순위] 야간전담 NE 연속 최대 + 이후 O 2개 필수
      if (nurse.workType === 'NIGHT_ONLY') {
        // reqOforNE 체크 먼저 (NE 추가 전)
        if (reqOforNE > 0) {
          if (isWorkShift(shift)) {
            violations.push({
              nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
              rule: 'NE_AFTER_O_REQUIRED',
              description: `NE ${settings.maxConsecutiveNE}연속 후 O ${reqOforNE}개 필요 (현재: ${shift})`,
              severity: 'ERROR',
            });
          } else {
            reqOforNE--;
            if (reqOforNE === 0) consecNE = 0;
          }
        }
        // NE 카운터 갱신
        if (shift === 'NE') {
          consecNE++;
          if (consecNE >= settings.maxConsecutiveNE) reqOforNE = 2;
        } else {
          // O/Y/H 등 휴식: reqOforNE 회복 중이면 유지, 완전히 쉰 경우 reset
          if (reqOforNE === 0) consecNE = 0;
        }
        if (consecNE > settings.maxConsecutiveNE) {
          violations.push({
            nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
            rule: 'MAX_CONSECUTIVE_NE',
            description: `NE근무 ${consecNE}일 연속 (최대 ${settings.maxConsecutiveNE}일)`,
            severity: 'ERROR',
          });
        }
      }

      // [1순위] 신규간호사 단독 야간 금지
      if (shift === 'N' && nurse.rank === 'GN') {
        const seniorsOnN = allStates.filter(
          (s) =>
            s.nurse.id !== nurse.id &&
            s.nurse.rank !== 'GN' &&
            s.nurse.workType === 'THREE_SHIFT' &&
            s.shifts[i] === 'N'
        );
        if (seniorsOnN.length === 0) {
          violations.push({
            nurseId: nurse.id, nurseName: nurse.name, day: i + 1,
            rule: 'GN_SOLO_NIGHT',
            description: '신규간호사 단독 야간근무 금지 (시니어 간호사 부재)',
            severity: 'ERROR',
          });
        }
      }
    }

    // 주말 오프 보장
    if (!hasWeekendOff && nurse.workType === 'THREE_SHIFT') {
      violations.push({
        nurseId: nurse.id, nurseName: nurse.name, day: 0,
        rule: 'WEEKEND_OFF_GUARANTEE',
        description: '월 1회 이상 주말 오프 미보장',
        severity: 'WARNING',
      });
    }
  }

  // ===== 일별 인원 / 역량 검증 =====
  for (const di of dayInfos) {
    const idx = di.day - 1;

    const threeShift = allStates.filter((s) => s.nurse.workType === 'THREE_SHIFT');
    const dShift = threeShift.filter((s) => s.shifts[idx] === 'D');
    const eShift = threeShift.filter((s) => s.shifts[idx] === 'E');
    const nShift = threeShift.filter((s) => s.shifts[idx] === 'N');

    // 필요 인원 미달
    const chk = (arr: NurseState[], required: number, code: string) => {
      if (arr.length < required) {
        violations.push({
          nurseId: 0, nurseName: '(전체)', day: di.day,
          rule: `INSUFFICIENT_${code}_STAFF`,
          description: `${di.day}일 ${code}근무 인원 부족 (필요 ${required}명, 배정 ${arr.length}명)`,
          severity: 'ERROR',
        });
      }
    };
    chk(dShift, getRequiredCount('D', di, settings), 'D');
    chk(eShift, getRequiredCount('E', di, settings), 'E');
    chk(nShift, getRequiredCount('N', di, settings), 'N');

    // [1순위] 매일 Desk 가능 인력 최소 1명 (D/E 근무 중)
    const deShift = [...dShift, ...eShift];
    const hasDeskCapable = deShift.some((s) => s.nurse.capability === 'Desk');
    if (!hasDeskCapable && deShift.length > 0) {
      violations.push({
        nurseId: 0, nurseName: '(전체)', day: di.day,
        rule: 'NO_DESK_CAPABLE',
        description: `${di.day}일 Desk 가능 인력 부재 (최소 1명 필요)`,
        severity: 'ERROR',
      });
    }

  }

  return violations;
}

// ===== 메인 스케줄 생성 함수 =====
export async function generateSchedule(
  wardId: number,
  year: number,
  month: number,
  useRequests: boolean = true,
): Promise<{
  entries: Omit<ScheduleEntry, 'id' | 'scheduleId'>[];
  violations: ScheduleViolation[];
}> {
  const daysInMonth = getDaysInMonth(year, month);

  // ===== 데이터 로드 =====
  const [nursesResult, settingsResult, requestsResult] = await Promise.all([
    query<Nurse>(
      `SELECT n.id, n.name, n.rank,
              n.years_of_service AS "yearsOfService",
              n.work_type AS "workType",
              n.capability,
              n.is_active AS "isActive",
              n.ward_id AS "wardId",
              n.preceptor_id AS "preceptorId",
              p.name AS "preceptorName",
              n.monthly_off_override AS "monthlyOffOverride"
       FROM nurses n
       LEFT JOIN nurses p ON p.id = n.preceptor_id
       WHERE n.ward_id = $1 AND n.is_active = true
       ORDER BY
         CASE n.work_type WHEN 'HEAD_NURSE' THEN 1 WHEN 'NIGHT_ONLY' THEN 2 ELSE 3 END,
         CASE n.rank WHEN 'HEAD' THEN 1 WHEN 'CHARGE' THEN 2 WHEN 'RN' THEN 3 ELSE 4 END,
         n.years_of_service DESC`,
      [wardId]
    ),
    query<WardSettings>(
      `SELECT id, ward_id AS "wardId", ward_name AS "wardName",
              weekday_d_count AS "weekdayDCount", weekday_e_count AS "weekdayECount",
              weekday_n_count AS "weekdayNCount", weekend_d_count AS "weekendDCount",
              weekend_e_count AS "weekendECount", weekend_n_count AS "weekendNCount",
              monthly_off_count AS "monthlyOffCount",
              max_consecutive_ne AS "maxConsecutiveNE",
              COALESCE(max_consecutive_work, 6) AS "maxConsecutiveWork"
       FROM ward_settings WHERE ward_id = $1`,
      [wardId]
    ),
    useRequests
      ? query<ShiftRequest>(
          `SELECT id, nurse_id AS "nurseId", year, month, day,
                  requested_shift AS "requestedShift"
           FROM shift_requests
           WHERE year = $1 AND month = $2
             AND nurse_id IN (SELECT id FROM nurses WHERE ward_id = $3)`,
          [year, month, wardId]
        )
      : Promise.resolve({ rows: [] as ShiftRequest[], rowCount: 0 }),
  ]);

  const nurses = nursesResult.rows;
  const settings = settingsResult.rows[0];
  const requests = requestsResult.rows;

  if (!settings) throw new Error('병동 설정이 없습니다');
  if (!nurses.length) throw new Error('배정할 간호사가 없습니다');

  // maxConsecutiveWork 기본값
  if (!(settings as any).maxConsecutiveWork) (settings as any).maxConsecutiveWork = 6;

  const dayInfos = await buildDayInfoList(year, month, daysInMonth);

  // ===== 상태 초기화 =====
  const allStates: NurseState[] = nurses.map((nurse) => ({
    nurse,
    shifts: new Array(daysInMonth).fill(null),
    roles: new Array(daysInMonth).fill(null),
    consecutiveN: 0, consecutiveD: 0, consecutiveE: 0, consecutiveWork: 0,
    totalD: 0, totalE: 0, totalN: 0, totalNE: 0, totalO: 0, totalY: 0,
    totalWork: 0, weekendWorkCount: 0, holidayWorkCount: 0,
    weekendOffDays: [], deskCount: 0, subDeskCount: 0, actingCount: 0,
    totalDEShifts: 0, nRunSize: 0, oAfterN: 0,
  }));

  const headStates = allStates.filter((s) => s.nurse.workType === 'HEAD_NURSE');
  const nightOnlyStates = allStates.filter((s) => s.nurse.workType === 'NIGHT_ONLY');
  const threeShiftStates = allStates.filter((s) => s.nurse.workType === 'THREE_SHIFT');

  // ===== Step 1: 수간호사 =====
  const satWeek = (settings as any).headNurseSatWeek ?? 1;
  for (const s of headStates) assignHeadNurse(s, dayInfos, satWeek);

  // ===== Step 2: 야간전담 =====
  nightOnlyStates.forEach((s, i) =>
    assignNightExclusive(s, dayInfos, settings.maxConsecutiveNE, i, nightOnlyStates.length)
  );

  // ===== Step 3: 희망 오프 (2순위) =====
  if (useRequests) {
    for (const s of threeShiftStates) applyShiftRequests(s, requests, dayInfos);
  }

  // ===== Step 4: 일반 3교대 그리디 배정 =====
  for (const dayInfo of dayInfos) {
    const idx = dayInfo.day - 1;

    // 현재 날 배정 현황
    const counts: Record<string, number> = { D: 0, E: 0, N: 0, O: 0 };
    for (const s of threeShiftStates) {
      const sh = s.shifts[idx];
      if (sh && counts[sh] !== undefined) counts[sh]++;
    }

    // N≥2 후 O 필수 간호사 먼저 처리
    const mustOff = threeShiftStates.filter((s) => s.shifts[idx] === null && s.nRunSize >= 2 && s.oAfterN < 2);
    for (const s of mustOff) {
      s.shifts[idx] = 'O';
      applyShiftToState(s, 'O', dayInfo);
      counts['O']++;
    }

    // 인원 부족 근무 순서로 채우기: D → [시니어 선확보] → N → E
    const assignShift = (targetShift: ShiftCode) => {
      const required = getRequiredCount(targetShift, dayInfo, settings);
      let deficit = required - (counts[targetShift] || 0);
      if (deficit <= 0) return;
      const eligible = threeShiftStates
        .filter((s) => {
          if (s.shifts[idx] !== null) return false;
          if (!canAssign(targetShift, s, idx, dayInfo, settings, threeShiftStates)) return false;
          return true;
        })
        .map((s) => ({
          state: s,
          score: scoreShift(targetShift, s, idx, dayInfo, counts, settings, threeShiftStates, dayInfos),
        }))
        .sort((a, b) => b.score - a.score);
      for (let i = 0; i < Math.min(deficit, eligible.length); i++) {
        const { state } = eligible[i];
        state.shifts[idx] = targetShift;
        applyShiftToState(state, targetShift, dayInfo);
        counts[targetShift] = (counts[targetShift] || 0) + 1;
      }
    };

    assignShift('D');

    assignShift('N');
    assignShift('E');

    // [보완] Desk 가능 인력이 없으면 설정 인원 범위 안에서만 Desk 보유자 D/E 배정
    {
      const deAssigned = threeShiftStates.filter(
        (s) => s.shifts[idx] === 'D' || s.shifts[idx] === 'E'
      );
      const hasDeskCapable = deAssigned.some((s) => s.nurse.capability === 'Desk');
      if (!hasDeskCapable) {
        const reqD = getRequiredCount('D', dayInfo, settings);
        const reqE = getRequiredCount('E', dayInfo, settings);
        const deskUnassigned = threeShiftStates.filter(
          (s) => s.shifts[idx] === null && s.nurse.capability === 'Desk'
        );
        for (const picked of deskUnassigned) {
          // D 자리가 남아있으면 D, 아니면 E 자리가 남아있으면 E
          if (counts['D'] < reqD && canAssign('D', picked, idx, dayInfo, settings, threeShiftStates)) {
            picked.shifts[idx] = 'D';
            applyShiftToState(picked, 'D', dayInfo);
            counts['D'] = (counts['D'] || 0) + 1;
            break;
          } else if (counts['E'] < reqE && canAssign('E', picked, idx, dayInfo, settings, threeShiftStates)) {
            picked.shifts[idx] = 'E';
            applyShiftToState(picked, 'E', dayInfo);
            counts['E'] = (counts['E'] || 0) + 1;
            break;
          }
        }
      }
    }

    // 나머지 미배정 간호사 → O (설정 인원이 다 찼으면 무조건 O)
    for (const s of threeShiftStates) {
      if (s.shifts[idx] !== null) continue;

      // 주말이고 주말 오프가 없으면 O
      if (dayInfo.isWeekend && s.weekendOffDays.length === 0) {
        s.shifts[idx] = 'O';
        applyShiftToState(s, 'O', dayInfo);
        continue;
      }

      if (canAssignOff(s, settings)) {
        s.shifts[idx] = 'O';
        applyShiftToState(s, 'O', dayInfo);
      } else {
        // 오프 할당량 초과 → 설정된 필요 인원 범위 안에서만 근무 배정
        // (D/E 모두 설정 인원이 채워졌으면 O 유지 — 초과 근무 배정 방지)
        const curD = threeShiftStates.filter((st) => st.shifts[idx] === 'D').length;
        const curE = threeShiftStates.filter((st) => st.shifts[idx] === 'E').length;
        const reqD = getRequiredCount('D', dayInfo, settings);
        const reqE = getRequiredCount('E', dayInfo, settings);

        let fs: ShiftCode = 'O';
        if (curD < reqD && canAssign('D', s, idx, dayInfo, settings, threeShiftStates)) {
          fs = 'D';
        } else if (curE < reqE && canAssign('E', s, idx, dayInfo, settings, threeShiftStates)) {
          fs = 'E';
        }
        s.shifts[idx] = fs;
        applyShiftToState(s, fs, dayInfo);
      }
    }
  }

  // ===== Step 4.5: 최적화 (야간/주말/공휴일 균등 분배) =====
  runOptimization(threeShiftStates, dayInfos, settings, useRequests ? requests : []);

  // ===== Step 4.6: D 인원 부족일 보정 (E→D 금지로 인한 공백 복구) =====
  for (let i = 0; i < dayInfos.length; i++) {
    const dayInfo = dayInfos[i];
    const required = getRequiredCount('D', dayInfo, settings);
    const dCount = threeShiftStates.filter((s) => s.shifts[i] === 'D').length;
    let deficit = required - dCount;
    if (deficit <= 0) continue;

    // O인 THREE_SHIFT 간호사 중 D로 전환 가능한 후보 탐색
    // (Step 4.6은 Phase2 이후라 consecutiveD 카운터가 stale → validateNurseSeq로만 판단)
    const candidates = threeShiftStates
      .filter((s) => {
        if (s.shifts[i] !== 'O') return false;
        const prev = i > 0 ? s.shifts[i - 1] : null;
        if (prev === 'E') return false; // E→D 금지
        const newShifts = [...s.shifts] as (ShiftCode | null)[];
        newShifts[i] = 'D';
        return validateNurseSeq(newShifts, settings);
      });

    for (let j = 0; j < Math.min(deficit, candidates.length); j++) {
      const s = candidates[j];
      s.shifts[i] = 'D';
      // 카운터 보정
      s.totalD++;
      s.totalWork++;
      if (s.totalO > 0) s.totalO--;
      if (dayInfo.isWeekend) s.weekendWorkCount++;
      if (dayInfo.isHoliday) s.holidayWorkCount++;
    }
  }

  // ===== Step 5: 역할 배정 (Desk/SubDesk/Acting) =====
  assignDailyRoles(allStates, dayInfos);

  // ===== Step 6: 위반 검증 =====
  const violations = validateSchedule(allStates, dayInfos, settings);

  // ===== 결과 변환 =====
  const entries: Omit<ScheduleEntry, 'id' | 'scheduleId'>[] = [];
  for (const state of allStates) {
    for (let i = 0; i < daysInMonth; i++) {
      const shift = state.shifts[i];
      if (!shift) continue;

      const entryViolations = violations.filter(
        (v) => v.nurseId === state.nurse.id && v.day === i + 1
      );
      entries.push({
        nurseId: state.nurse.id,
        day: i + 1,
        shift,
        role: state.roles[i] as DailyRole,
        isViolation: entryViolations.length > 0,
        violationReason: entryViolations.map((v) => v.description).join('; '),
      });
    }
  }

  return { entries, violations };
}
