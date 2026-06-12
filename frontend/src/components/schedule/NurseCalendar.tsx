'use client';

/**
 * FullCalendar 기반 개인별 근무 달력 뷰
 * - 간호사 선택 → 해당 간호사의 한 달 근무 달력 표시
 * - 각 근무는 색상이 입혀진 이벤트로 표시
 * - 이벤트 클릭 시 근무 수정 가능
 */

import React, { useCallback, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg } from '@fullcalendar/core';
import koLocale from '@fullcalendar/core/locales/ko';

import { Nurse, ScheduleEntry, ShiftCode, SHIFT_LABELS, RANK_LABELS } from '@/types';
import ShiftEditDialog from './ShiftEditDialog';
import { scheduleApi } from '@/lib/api';
import { toast } from 'sonner';

interface NurseCalendarProps {
  nurses: Nurse[];
  entries: ScheduleEntry[];
  year: number;
  month: number;
  onUpdate?: () => void;
}

// 근무 코드별 캘린더 이벤트 색상
const SHIFT_EVENT_COLORS: Record<string, { backgroundColor: string; borderColor: string; textColor: string }> = {
  D:  { backgroundColor: '#bae6fd', borderColor: '#38bdf8', textColor: '#0c4a6e' },
  E:  { backgroundColor: '#fef08a', borderColor: '#fbbf24', textColor: '#78350f' },
  N:  { backgroundColor: '#c084fc', borderColor: '#a855f7', textColor: '#ffffff' },
  NE: { backgroundColor: '#1e3a8a', borderColor: '#1d4ed8', textColor: '#ffffff' },
  O:  { backgroundColor: '#e5e7eb', borderColor: '#d1d5db', textColor: '#374151' },
  Y:  { backgroundColor: '#86efac', borderColor: '#22c55e', textColor: '#14532d' },
  H:  { backgroundColor: '#d9f99d', borderColor: '#84cc16', textColor: '#365314' },
  YH: { backgroundColor: '#bbf7d0', borderColor: '#4ade80', textColor: '#14532d' },
  V:  { backgroundColor: '#fed7aa', borderColor: '#fb923c', textColor: '#7c2d12' },
  I:  { backgroundColor: '#fde68a', borderColor: '#f59e0b', textColor: '#78350f' },
  CB: { backgroundColor: '#fb923c', borderColor: '#f97316', textColor: '#ffffff' },
  C:  { backgroundColor: '#f87171', borderColor: '#ef4444', textColor: '#ffffff' },
  M:  { backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#374151' },
};

interface EventMeta {
  entryId: number;
  shift: ShiftCode;
  day: number;
  nurseId: number;
}

export default function NurseCalendar({
  nurses,
  entries,
  year,
  month,
  onUpdate,
}: NurseCalendarProps) {
  const [selectedNurseId, setSelectedNurseId] = useState<number>(
    nurses[0]?.id ?? 0
  );

  const [editTarget, setEditTarget] = useState<{
    entryId: number;
    shift: ShiftCode;
    day: number;
    nurseName: string;
  } | null>(null);

  const selectedNurse = nurses.find((n) => n.id === selectedNurseId);

  // 선택된 간호사의 엔트리 → FullCalendar 이벤트 변환
  const events = useMemo(() => {
    if (!selectedNurseId) return [];

    return entries
      .filter((e) => e.nurseId === selectedNurseId)
      .map((e) => {
        const colors = SHIFT_EVENT_COLORS[e.shift] || SHIFT_EVENT_COLORS.O;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`;

        return {
          id: String(e.id),
          title: `${e.shift}${e.role ? ` · ${e.role}` : ''}${e.isViolation ? ' ⚠' : ''}`,
          date: dateStr,
          backgroundColor: colors.backgroundColor,
          borderColor: e.isViolation ? '#ef4444' : colors.borderColor,
          textColor: colors.textColor,
          extendedProps: {
            entryId: e.id,
            shift: e.shift,
            day: e.day,
            nurseId: e.nurseId,
            role: e.role,
            isViolation: e.isViolation,
            violationReason: e.violationReason,
          },
        };
      });
  }, [selectedNurseId, entries, year, month]);

  // 이벤트 클릭 → 편집 다이얼로그
  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const props = arg.event.extendedProps as EventMeta & { isViolation: boolean };
      if (!selectedNurse) return;
      setEditTarget({
        entryId: props.entryId,
        shift: props.shift,
        day: props.day,
        nurseName: selectedNurse.name,
      });
    },
    [selectedNurse],
  );

  const handleShiftChange = useCallback(
    async (newShift: ShiftCode) => {
      if (!editTarget) return;
      try {
        const result = await scheduleApi.updateEntry(editTarget.entryId, newShift);
        if (result.violations && result.violations.length > 0) {
          toast.warning(`변경 완료 — 위반: ${result.violations.join(', ')}`);
        } else {
          toast.success('근무가 수정되었습니다');
        }
        onUpdate?.();
      } catch (err: any) {
        toast.error(err.message || '수정 실패');
      } finally {
        setEditTarget(null);
      }
    },
    [editTarget, onUpdate],
  );

  // 선택 간호사 통계
  const nurseStats = useMemo(() => {
    const nurseEntries = entries.filter((e) => e.nurseId === selectedNurseId);
    const counts: Partial<Record<ShiftCode, number>> = {};
    for (const e of nurseEntries) {
      counts[e.shift] = (counts[e.shift] || 0) + 1;
    }
    return counts;
  }, [selectedNurseId, entries]);

  return (
    <div className="space-y-4">
      {/* 간호사 선택 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">간호사 선택</label>
          <select
            value={selectedNurseId}
            onChange={(e) => setSelectedNurseId(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {nurses.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({RANK_LABELS[n.rank]})
              </option>
            ))}
          </select>
        </div>

        {/* 선택 간호사 요약 배지 */}
        {selectedNurse && (
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(nurseStats)
              .filter(([, cnt]) => (cnt ?? 0) > 0)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([shift, cnt]) => {
                const c = SHIFT_EVENT_COLORS[shift] || SHIFT_EVENT_COLORS.O;
                return (
                  <span
                    key={shift}
                    style={{
                      backgroundColor: c.backgroundColor,
                      color: c.textColor,
                      border: `1px solid ${c.borderColor}`,
                    }}
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                  >
                    {shift} {cnt}
                  </span>
                );
              })}
          </div>
        )}
      </div>

      {/* FullCalendar */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <style>{`
          .fc-event { cursor: pointer; font-size: 12px; font-weight: 600; padding: 2px 4px; border-radius: 4px !important; }
          .fc-daygrid-event { margin: 1px 2px !important; }
          .fc-day-sat .fc-daygrid-day-number { color: #2563eb; }
          .fc-day-sun .fc-daygrid-day-number { color: #dc2626; }
          .fc-col-header-cell.fc-day-sat { background-color: #eff6ff; }
          .fc-col-header-cell.fc-day-sun { background-color: #fef2f2; }
          .fc-toolbar-title { font-size: 16px !important; font-weight: 700; }
          .fc-button { font-size: 12px !important; }
        `}</style>

        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={koLocale}
          initialDate={`${year}-${String(month).padStart(2, '0')}-01`}
          events={events}
          eventClick={handleEventClick}
          headerToolbar={{
            left: '',
            center: 'title',
            right: '',
          }}
          height="auto"
          fixedWeekCount={false}
          dayCellClassNames={(arg) => {
            const classes: string[] = [];
            const dow = arg.date.getDay();
            if (dow === 0) classes.push('fc-day-sun');
            if (dow === 6) classes.push('fc-day-sat');
            return classes;
          }}
        />
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
        {Object.entries(SHIFT_LABELS).map(([code, label]) => {
          const c = SHIFT_EVENT_COLORS[code];
          if (!c) return null;
          return (
            <span
              key={code}
              style={{ backgroundColor: c.backgroundColor, color: c.textColor, border: `1px solid ${c.borderColor}` }}
              className="px-2 py-0.5 rounded font-medium"
            >
              {code} = {label}
            </span>
          );
        })}
      </div>

      {/* 수정 다이얼로그 */}
      {editTarget && (
        <ShiftEditDialog
          nurseName={editTarget.nurseName}
          day={editTarget.day}
          month={month}
          currentShift={editTarget.shift}
          onConfirm={handleShiftChange}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
