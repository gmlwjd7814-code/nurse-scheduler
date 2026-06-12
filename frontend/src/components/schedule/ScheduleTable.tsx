'use client';

/**
 * 근무표 메인 테이블 컴포넌트
 * - 엑셀 형태 (행: 간호사, 열: 날짜)
 * - 드래그&드롭으로 근무 수정
 * - 클릭으로 근무 직접 수정
 * - 규칙 위반 자동 감지 및 표시
 */

import React, { useState, useCallback } from 'react';
import {
  Nurse, ScheduleEntry, ShiftCode, DailyRole,
  RANK_LABELS, WORK_TYPE_LABELS
} from '@/types';
import ScheduleCell from './ScheduleCell';
import ShiftEditDialog from './ShiftEditDialog';
import { scheduleApi } from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface ScheduleTableProps {
  nurses: Nurse[];
  entries: ScheduleEntry[];
  year: number;
  month: number;
  onUpdate?: () => void; // 수정 후 새로고침 콜백
}

// 날짜의 요일 반환 (0=일, 6=토)
function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

// 대한민국 공휴일 (대체공휴일 포함)
const KR_HOLIDAYS: Set<string> = new Set([
  // 2025
  '2025-01-01', // 신정
  '2025-01-28', '2025-01-29', '2025-01-30', // 설날 연휴
  '2025-03-01', // 삼일절
  '2025-03-03', // 삼일절 대체 (3/1 토→월)
  '2025-05-05', // 어린이날·부처님오신날 겹침
  '2025-05-06', // 어린이날 대체 (5/5 월→화)
  '2025-06-06', // 현충일
  '2025-08-15', // 광복절
  '2025-10-03', // 개천절
  '2025-10-05', '2025-10-06', '2025-10-07', // 추석 연휴
  '2025-10-08', // 추석 대체 (10/5 일→수)
  '2025-10-09', // 한글날
  '2025-12-25', // 크리스마스
  // 2026
  '2026-01-01', // 신정
  '2026-01-28', '2026-01-29', '2026-01-30', // 설날 연휴
  '2026-03-01', // 삼일절
  '2026-03-02', // 삼일절 대체 (3/1 일→월)
  '2026-05-05', // 어린이날
  '2026-05-25', // 부처님오신날
  '2026-06-03', // 지방선거일 (임시공휴일)
  '2026-06-06', // 현충일
  '2026-06-08', // 현충일 대체 (6/6 토→월)
  '2026-08-15', // 광복절
  '2026-08-17', // 광복절 대체 (8/15 토→월)
  '2026-09-24', '2026-09-25', '2026-09-26', // 추석 연휴
  '2026-09-28', // 추석 대체 (9/26 토→월)
  '2026-10-03', // 개천절
  '2026-10-05', // 개천절 대체 (10/3 토→월)
  '2026-10-09', // 한글날
  '2026-12-25', // 크리스마스
  // 2027
  '2027-01-01', // 신정
  '2027-02-16', '2027-02-17', '2027-02-18', // 설날 연휴
  '2027-03-01', // 삼일절
  '2027-05-05', // 어린이날
  '2027-05-13', // 부처님오신날
  '2027-06-06', // 현충일
  '2027-06-07', // 현충일 대체 (6/6 일→월)
  '2027-08-15', // 광복절
  '2027-08-16', // 광복절 대체 (8/15 일→월)
  '2027-10-03', // 개천절
  '2027-10-04', '2027-10-05', '2027-10-06', // 추석 연휴
  '2027-10-09', // 한글날
  '2027-10-11', // 한글날 대체 (10/9 토→월)
  '2027-12-25', // 크리스마스
]);

function isHoliday(year: number, month: number, day: number): boolean {
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return KR_HOLIDAYS.has(key);
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 간호사별 엔트리 맵 생성
function buildEntryMap(entries: ScheduleEntry[]): Map<string, ScheduleEntry> {
  const map = new Map<string, ScheduleEntry>();
  for (const entry of entries) {
    map.set(`${entry.nurseId}-${entry.day}`, entry);
  }
  return map;
}

// 합계 열 정의
const SUMMARY_COLS: { key: string; label: string; shifts: ShiftCode[]; bgClass: string; textClass: string }[] = [
  { key: 'O',    label: 'O',    shifts: ['O'],                           bgClass: 'bg-gray-300',   textClass: 'text-gray-900' },
  { key: 'N',    label: 'N+NE', shifts: ['N', 'NE'],                    bgClass: 'bg-purple-300', textClass: 'text-gray-900' },
  { key: 'D',    label: 'D',    shifts: ['D'],                           bgClass: 'bg-sky-300',    textClass: 'text-gray-900' },
  { key: 'E',    label: 'E',    shifts: ['E'],                           bgClass: 'bg-yellow-300', textClass: 'text-gray-900' },
  { key: 'WORK', label: '근무',  shifts: ['D','E','N','NE','CB','C','M'], bgClass: 'bg-green-300',  textClass: 'text-gray-900 font-bold' },
];

// 간호사별 합계 계산
function buildNurseSummary(nurseId: number, entries: ScheduleEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (e.nurseId !== nurseId) continue;
    counts[e.shift] = (counts[e.shift] ?? 0) + 1;
  }
  return counts;
}

// 근무형태 배지 색상
const WORK_TYPE_BADGE: Record<string, string> = {
  HEAD_NURSE: 'bg-purple-100 text-purple-800',
  NIGHT_ONLY: 'bg-blue-100 text-blue-800',
  THREE_SHIFT: 'bg-gray-100 text-gray-700',
};

export default function ScheduleTable({
  nurses,
  entries,
  year,
  month,
  onUpdate,
}: ScheduleTableProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // 클릭한 셀 (수정 다이얼로그)
  const [editTarget, setEditTarget] = useState<{
    entryId: number;
    nurseId: number;
    nurseName: string;
    day: number;
    currentShift: ShiftCode;
  } | null>(null);

  const entryMap = buildEntryMap(entries);

  // 셀 클릭 시 수정 다이얼로그 열기
  const handleCellClick = useCallback(
    (nurse: Nurse, day: number) => {
      const entry = entryMap.get(`${nurse.id}-${day}`);
      if (!entry) return;

      setEditTarget({
        entryId: entry.id,
        nurseId: nurse.id,
        nurseName: nurse.name,
        day,
        currentShift: entry.shift,
      });
    },
    [entryMap]
  );

  // 근무 변경 저장
  const handleShiftChange = useCallback(
    async (entryId: number, newShift: ShiftCode) => {
      try {
        const result = await scheduleApi.updateEntry(entryId, newShift);
        if (result.violations && result.violations.length > 0) {
          toast.warning(`근무 변경 완료 (위반 감지: ${result.violations.join(', ')})`);
        } else {
          toast.success('근무가 수정되었습니다');
        }
        onUpdate?.();
      } catch (err: any) {
        toast.error(err.message || '수정 중 오류가 발생했습니다');
      } finally {
        setEditTarget(null);
      }
    },
    [onUpdate]
  );

  // 위반 셀 수 계산
  const violationCount = entries.filter((e) => e.isViolation).length;

  return (
    <div className="w-full">
      {/* 위반 요약 배너 */}
      {violationCount > 0 && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <span className="text-base">⚠️</span>
          <span className="font-medium">규칙 위반 {violationCount}건 감지됨</span>
          <span className="text-red-500">— 빨간 테두리 셀을 확인하세요</span>
        </div>
      )}

      {/* 근무표 테이블 */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="border-collapse text-xs" style={{ minWidth: `${daysInMonth * 48 + 160 + SUMMARY_COLS.length * 48}px` }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* 이름 열 */}
              <th className="sticky left-0 z-10 bg-slate-300 border-r border-gray-200 px-2 py-1.5 text-left font-semibold text-slate-800 w-36">
                이름
              </th>
              {/* 날짜 열 */}
              {days.map((d) => {
                const dow = getDayOfWeek(year, month, d);
                const holiday = isHoliday(year, month, d);
                const isSat = dow === 6;
                const isSun = dow === 0;
                return (
                  <th
                    key={d}
                    className={`
                      border-r border-gray-200 text-center font-medium py-2 px-0.5 w-12
                      ${isSun || holiday ? 'text-red-700 bg-pink-200' : ''}
                      ${isSat ? 'text-pink-700 bg-pink-200' : ''}
                      ${!isSun && !isSat && !holiday ? 'text-gray-900 bg-slate-200' : ''}
                    `}
                  >
                    <div className="text-sm font-bold">{d}</div>
                    <div className="text-xs font-semibold">{DAY_NAMES[dow]}</div>
                  </th>
                );
              })}
              {/* 합계 열 헤더 */}
              {SUMMARY_COLS.map((col) => (
                <th
                  key={col.key}
                  className={`border-l-2 border-l-gray-300 border-r border-gray-200 text-center font-semibold py-1 px-0.5 w-12 text-sm ${col.bgClass} ${col.textClass}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nurses.map((nurse, rowIdx) => {
              const summary = buildNurseSummary(nurse.id, entries);
              return (
                <tr
                  key={nurse.id}
                  className={`border-b border-gray-100 hover:bg-gray-50/50 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                >
                  {/* 간호사 이름 + 정보 */}
                  <td className="sticky left-0 z-10 border-r border-gray-200 px-2 py-1 bg-slate-200 w-36">
                    <div className="font-semibold text-gray-950 truncate text-sm">{nurse.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-gray-700">{RANK_LABELS[nurse.rank]}</span>
                      {nurse.workType !== 'THREE_SHIFT' && (
                        <span className={`text-[9px] px-1 rounded ${WORK_TYPE_BADGE[nurse.workType]}`}>
                          {WORK_TYPE_LABELS[nurse.workType]}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 날짜별 근무 셀 */}
                  {days.map((d) => {
                    const entry = entryMap.get(`${nurse.id}-${d}`);
                    const dow = getDayOfWeek(year, month, d);
                    const weekend = dow === 0 || dow === 6;
                    const holiday = isHoliday(year, month, d);

                    return (
                      <td
                        key={d}
                        className="border-r border-gray-100 p-0.5"
                      >
                        <ScheduleCell
                          shift={entry?.shift || null}
                          role={entry?.role}
                          isViolation={entry?.isViolation || false}
                          violationReason={entry?.violationReason}
                          isWeekend={weekend}
                          isHoliday={holiday}
                          onClick={entry ? () => handleCellClick(nurse, d) : undefined}
                        />
                      </td>
                    );
                  })}

                  {/* 합계 열 */}
                  {SUMMARY_COLS.map((col) => {
                    const count = col.shifts.reduce((acc, s) => acc + (summary[s] ?? 0), 0);
                    return (
                      <td
                        key={col.key}
                        className={`border-l-2 border-l-gray-300 border-r border-gray-100 text-center font-semibold py-1 text-sm ${col.bgClass} ${col.textClass}`}
                      >
                        {count > 0 ? count : <span className="text-gray-400">-</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {([
              { key: 'D',   label: 'D',      shifts: ['D'],         bg: 'bg-sky-200',    text: 'text-sky-800',    border: 'border-t-2 border-t-gray-400' },
              { key: 'E',   label: 'E',      shifts: ['E'],         bg: 'bg-yellow-200', text: 'text-yellow-800', border: 'border-t border-yellow-300' },
              { key: 'N',   label: 'N+NE',   shifts: ['N', 'NE'],   bg: 'bg-purple-200', text: 'text-purple-800', border: 'border-t border-purple-300' },
              { key: 'O',   label: 'O+I+Y',  shifts: ['O', 'I', 'Y'], bg: 'bg-gray-300', text: 'text-gray-700',  border: 'border-t border-gray-400' },
            ] as { key: string; label: string; shifts: ShiftCode[]; bg: string; text: string; border: string }[]).map((row) => (
              <tr key={row.key} className={`${row.bg} ${row.border}`}>
                <td className={`sticky left-0 z-10 border-r border-gray-200 px-2 py-1 font-bold text-center text-xs ${row.bg} ${row.text}`}>
                  {row.label}
                </td>
                {days.map((d) => {
                  const dow = getDayOfWeek(year, month, d);
                  const isWknd = dow === 0 || dow === 6 || isHoliday(year, month, d);
                  const count = entries.filter((e) => e.day === d && (row.shifts as string[]).includes(e.shift)).length;
                  return (
                    <td key={d} style={isWknd ? {backgroundColor: '#fbcfe8'} : undefined} className={`border-r border-gray-100 text-center font-semibold py-1 text-xs ${row.text} ${isWknd ? '' : row.bg}`}>
                      {count > 0 ? count : <span className="text-gray-300">·</span>}
                    </td>
                  );
                })}
                {SUMMARY_COLS.map((col) => (
                  <td key={col.key} className="border-l-2 border-l-gray-300 border-r border-gray-100" />
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      {/* 역할 배지 범례 */}
      {/* 수정 다이얼로그 */}
      {editTarget && (
        <ShiftEditDialog
          nurseName={editTarget.nurseName}
          day={editTarget.day}
          month={month}
          currentShift={editTarget.currentShift}
          onConfirm={(newShift) => handleShiftChange(editTarget.entryId, newShift)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
