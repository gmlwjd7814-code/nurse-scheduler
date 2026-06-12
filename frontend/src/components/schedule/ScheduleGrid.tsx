'use client';

/**
 * AG Grid 기반 근무표 그리드
 * - 엑셀 형태 (행: 간호사, 열: 날짜)
 * - 셀 Drag & Drop 으로 근무 교환
 * - 클릭으로 근무 수정 (ShiftEditDialog)
 * - 규칙 위반 셀 강조 표시
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  ColDef,
  ICellRendererParams,
  GridApi,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import {
  Nurse, ScheduleEntry, ShiftCode, DailyRole,
  RANK_LABELS, WORK_TYPE_LABELS,
} from '@/types';
import ShiftEditDialog from './ShiftEditDialog';
import { scheduleApi } from '@/lib/api';
import { toast } from 'sonner';

// AG Grid 모듈 등록 (앱 전체에서 1회)
ModuleRegistry.registerModules([AllCommunityModule]);

// ─── 타입 ─────────────────────────────────────────────────
interface CellData {
  entryId: number;
  shift: ShiftCode;
  role: DailyRole;
  isViolation: boolean;
  violationReason?: string;
  day: number;
  nurseId: number;
}

interface ScheduleRow {
  nurseId: number;
  nurseName: string;
  rank: string;
  workType: string;
  [key: string]: CellData | string | number; // d1 ~ d31
}

interface ScheduleGridProps {
  nurses: Nurse[];
  entries: ScheduleEntry[];
  year: number;
  month: number;
  onUpdate?: () => void;
}

// ─── 색상 매핑 ────────────────────────────────────────────
const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  D:  { bg: '#bae6fd', text: '#0c4a6e', border: '#7dd3fc' },
  E:  { bg: '#fef08a', text: '#713f12', border: '#fde047' },
  N:  { bg: '#c084fc', text: '#ffffff', border: '#a855f7' },
  NE: { bg: '#1e3a8a', text: '#ffffff', border: '#1d4ed8' },
  O:  { bg: '#e5e7eb', text: '#374151', border: '#d1d5db' },
  Y:  { bg: '#86efac', text: '#14532d', border: '#4ade80' },
  H:  { bg: '#d9f99d', text: '#365314', border: '#a3e635' },
  YH: { bg: '#bbf7d0', text: '#14532d', border: '#4ade80' },
  V:  { bg: '#fed7aa', text: '#7c2d12', border: '#fb923c' },
  I:  { bg: '#fde68a', text: '#713f12', border: '#fbbf24' },
  CB: { bg: '#fb923c', text: '#ffffff', border: '#f97316' },
  C:  { bg: '#f87171', text: '#ffffff', border: '#ef4444' },
  M:  { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
};

const ROLE_COLORS: Record<string, string> = {
  Desk: '#ef4444',
  SubDesk: '#3b82f6',
  Acting: '#22c55e',
};

// ─── 드래그 상태 (모듈 레벨 싱글톤) ─────────────────────
const dragSource = { current: null as CellData | null };

// ─── 셀 렌더러 ────────────────────────────────────────────
function ShiftCellRenderer({ value, context }: ICellRendererParams<ScheduleRow, CellData>) {
  if (!value) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: '#f9fafb' }} />
    );
  }

  const { shift, role, isViolation, entryId, day, nurseId } = value;
  const color = SHIFT_COLORS[shift] || SHIFT_COLORS.O;

  const handleDragStart = (e: React.DragEvent) => {
    dragSource.current = value;
    e.dataTransfer.effectAllowed = 'move';
    // 투명 드래그 이미지 (기본 ghost 제거)
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:absolute;top:-999px;width:36px;height:28px;background:' + color.bg + ';border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;';
    ghost.textContent = shift;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 18, 14);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!dragSource.current || dragSource.current.entryId === entryId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const src = dragSource.current;
    if (!src || src.entryId === entryId) return;
    dragSource.current = null;

    // 두 셀 모두 업데이트 (교환)
    try {
      await Promise.all([
        scheduleApi.updateEntry(src.entryId, shift),   // 드래그 소스에 드롭 대상 shift
        scheduleApi.updateEntry(entryId, src.shift),   // 드롭 대상에 소스 shift
      ]);
      toast.success(`근무 교환: ${src.shift} ↔ ${shift}`);
      context?.onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || '근무 교환 실패');
    }
  };

  const handleClick = () => {
    context?.onCellClick?.(entryId, shift, day, nurseId);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.bg,
        color: color.text,
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        border: isViolation ? '2px solid #ef4444' : `1px solid ${color.border}`,
        position: 'relative',
        boxSizing: 'border-box',
      }}
      title={isViolation ? `⚠ ${value.violationReason}` : `${shift}${role ? ` (${role})` : ''}`}
    >
      {shift}
      {role && (
        <span
          style={{
            position: 'absolute',
            bottom: 1,
            right: 2,
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: ROLE_COLORS[role] || '#9ca3af',
          }}
        />
      )}
      {isViolation && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: 1,
            fontSize: 8,
            color: '#ef4444',
            fontWeight: 800,
          }}
        >
          !
        </span>
      )}
    </div>
  );
}

// ─── 간호사 이름 셀 렌더러 ─────────────────────────────────
function NurseLabelRenderer({ data }: ICellRendererParams<ScheduleRow>) {
  if (!data) return null;
  const wt = data.workType as string;
  const badge =
    wt === 'HEAD_NURSE' ? { bg: '#f3e8ff', text: '#7c3aed', label: '수간' }
    : wt === 'NIGHT_ONLY' ? { bg: '#dbeafe', text: '#1d4ed8', label: 'NE전담' }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '2px 6px' }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', lineHeight: 1.2 }}>{data.nurseName}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
        <span style={{ fontSize: 10, color: '#6b7280' }}>
          {RANK_LABELS[data.rank as keyof typeof RANK_LABELS] || data.rank}
        </span>
        {badge && (
          <span style={{
            fontSize: 9, padding: '0 3px', borderRadius: 3,
            backgroundColor: badge.bg, color: badge.text,
          }}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 날짜 헤더 스타일 ──────────────────────────────────────
const HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-01-28', '2026-01-29', '2026-01-30',
  '2026-03-01', '2026-05-05', '2026-05-25', '2026-06-06',
  '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-09', '2026-12-25',
]);
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function dayMeta(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isHoliday = HOLIDAYS_2026.has(key);
  const isSun = dow === 0;
  const isSat = dow === 6;
  return { dow, isHoliday, isSun, isSat, name: DAY_KO[dow] };
}

// ─── 데이터 빌더 ─────────────────────────────────────────
function buildRows(nurses: Nurse[], entries: ScheduleEntry[]): ScheduleRow[] {
  const map = new Map<string, ScheduleEntry>();
  for (const e of entries) map.set(`${e.nurseId}-${e.day}`, e);

  return nurses.map((n) => {
    const row: ScheduleRow = {
      nurseId: n.id,
      nurseName: n.name,
      rank: n.rank,
      workType: n.workType,
    };
    for (let d = 1; d <= 31; d++) {
      const e = map.get(`${n.id}-${d}`);
      if (e) {
        (row as any)[`d${d}`] = {
          entryId: e.id,
          shift: e.shift,
          role: e.role,
          isViolation: e.isViolation,
          violationReason: e.violationReason,
          day: d,
          nurseId: n.id,
        } satisfies CellData;
      }
    }
    return row;
  });
}

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function ScheduleGrid({
  nurses,
  entries,
  year,
  month,
  onUpdate,
}: ScheduleGridProps) {
  const gridRef = useRef<GridApi | null>(null);
  const daysInMonth = new Date(year, month, 0).getDate();

  const [editTarget, setEditTarget] = useState<{
    entryId: number;
    shift: ShiftCode;
    day: number;
    nurseName: string;
  } | null>(null);

  // ─── 컨텍스트 (셀 렌더러에서 콜백 접근) ──────────────
  const context = useMemo(
    () => ({
      onCellClick: (entryId: number, shift: ShiftCode, day: number, nurseId: number) => {
        const nurse = nurses.find((n) => n.id === nurseId);
        if (!nurse) return;
        setEditTarget({ entryId, shift, day, nurseName: nurse.name });
      },
      onUpdate,
    }),
    [nurses, onUpdate],
  );

  // ─── 근무 변경 저장 ───────────────────────────────────
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

  // ─── 컬럼 정의 ───────────────────────────────────────
  const columnDefs = useMemo<ColDef<ScheduleRow>[]>(() => {
    const cols: ColDef<ScheduleRow>[] = [
      {
        field: 'nurseName',
        headerName: '간호사',
        pinned: 'left',
        width: 100,
        cellRenderer: NurseLabelRenderer,
        sortable: false,
        resizable: false,
        rowDrag: true,
        suppressMovable: true,
        headerClass: 'ag-nurse-header',
        cellStyle: { padding: 0, border: 'none' },
      },
    ];

    for (let d = 1; d <= daysInMonth; d++) {
      const { isSun, isSat, isHoliday, name } = dayMeta(year, month, d);
      const isRed = isSun || isHoliday;
      const isBlue = isSat && !isHoliday;

      cols.push({
        field: `d${d}`,
        headerName: `${d}\n${name}`,
        width: 40,
        minWidth: 38,
        maxWidth: 50,
        sortable: false,
        resizable: false,
        suppressMovable: true,
        cellRenderer: ShiftCellRenderer,
        cellStyle: { padding: '2px 1px', border: 'none', overflow: 'visible' },
        headerClass: isRed ? 'ag-day-red' : isBlue ? 'ag-day-blue' : 'ag-day-normal',
        headerComponentParams: { day: d, dow: name, isRed, isBlue },
      });
    }

    return cols;
  }, [year, month, daysInMonth]);

  // ─── 행 데이터 ────────────────────────────────────────
  const rowData = useMemo(() => buildRows(nurses, entries), [nurses, entries]);

  // ─── 위반 셀 수 ──────────────────────────────────────
  const violationCount = entries.filter((e) => e.isViolation).length;

  return (
    <div>
      {/* 위반 배너 */}
      {violationCount > 0 && (
        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <span>⚠️</span>
          <span className="font-medium">규칙 위반 {violationCount}건 — 빨간 테두리 셀 확인</span>
        </div>
      )}

      {/* 범례 */}
      <div className="mb-2 flex flex-wrap gap-1 text-xs">
        {Object.entries(SHIFT_COLORS).map(([code, c]) => (
          <span
            key={code}
            style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
            className="px-1.5 py-0.5 rounded font-semibold"
          >
            {code}
          </span>
        ))}
        <span className="ml-2 text-gray-400 self-center">| 셀을 드래그하면 근무를 교환합니다</span>
      </div>

      {/* AG Grid */}
      <div
        className="ag-theme-quartz"
        style={{ width: '100%', height: `${Math.max(300, nurses.length * 40 + 56)}px` }}
      >
        <style>{`
          .ag-nurse-header .ag-header-cell-label { font-weight: 700; }
          .ag-day-red .ag-header-cell-label { color: #dc2626; }
          .ag-day-blue .ag-header-cell-label { color: #2563eb; }
          .ag-day-normal .ag-header-cell-label { color: #374151; }
          .ag-header-cell-label { font-size: 11px; white-space: pre-line; line-height: 1.1; text-align: center; flex-direction: column; }
          .ag-cell { overflow: visible !important; }
          .ag-row:hover { background-color: #f0f9ff !important; }
        `}</style>

        <AgGridReact<ScheduleRow>
          ref={(r) => { if (r) gridRef.current = r.api; }}
          rowData={rowData}
          columnDefs={columnDefs}
          context={context}
          rowDragManaged
          rowDragMultiRow={false}
          animateRows
          rowHeight={38}
          headerHeight={44}
          suppressCellFocus
          suppressRowClickSelection
          defaultColDef={{
            resizable: false,
            sortable: false,
          }}
          getRowId={(p) => String(p.data.nurseId)}
        />
      </div>

      {/* 역할 범례 */}
      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <span key={role} className="flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
            {role}
          </span>
        ))}
        <span className="flex items-center gap-1 text-red-500">
          <span className="font-bold">!</span> 규칙 위반
        </span>
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
