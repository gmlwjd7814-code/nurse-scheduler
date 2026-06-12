'use client';

/**
 * 월별 통계 테이블 컴포넌트 v2
 * - 근무 횟수, 역할 횟수, 주말/공휴일 근무
 * - 총 근무시간 자동 계산
 * - 위반 건수 표시
 */

import React, { useState } from 'react';
import { NurseMonthlyStats, RANK_LABELS, WORK_TYPE_LABELS } from '@/types';
import { Badge } from '@/components/ui/badge';

interface StatsTableProps {
  stats: NurseMonthlyStats[];
  year: number;
  month: number;
}

type SortKey = keyof NurseMonthlyStats;

function getIntensity(value: number, max: number): string {
  if (value === 0) return 'text-gray-300';
  const r = value / Math.max(max, 1);
  if (r > 0.7) return 'text-blue-700 font-bold';
  if (r > 0.4) return 'text-blue-500';
  return 'text-gray-700';
}

export default function StatsTable({ stats, year, month }: StatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('nurseName');
  const [sortAsc, setSortAsc] = useState(true);

  if (stats.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-2">📊</p>
        <p>근무표를 먼저 생성하면 통계가 표시됩니다</p>
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...stats].sort((a, b) => {
    const va = a[sortKey] as any;
    const vb = b[sortKey] as any;
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortAsc ? va - vb : vb - va;
    }
    return sortAsc
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  const maxN = Math.max(...stats.map((s) => s.nCount), 1);
  const maxWW = Math.max(...stats.map((s) => s.weekendWorkCount), 1);
  const maxHW = Math.max(...stats.map((s) => s.holidayWorkCount), 1);
  const maxHours = Math.max(...stats.map((s) => s.totalWorkHours), 1);
  const maxDesk = Math.max(...stats.map((s) => s.deskCount), 1);
  const violationTotal = stats.reduce((s, r) => s + (r.violationCount || 0), 0);

  const ColHeader = ({
    label, k, className = ''
  }: { label: string; k: SortKey; className?: string }) => (
    <th
      onClick={() => handleSort(k)}
      className={`text-center px-2 py-2 font-semibold cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap ${className}`}
      title={`${label} 기준 정렬`}
    >
      {label}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div>
      {/* 요약 배너 */}
      {violationTotal > 0 && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>총 <strong>{violationTotal}건</strong>의 규칙 위반이 감지되었습니다</span>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-2">
        열 헤더를 클릭하면 정렬됩니다
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-700 sticky left-0 bg-gray-50 w-20">이름</th>
              <th className="text-center px-2 py-2 font-semibold text-gray-700 w-14">직급</th>

              {/* 근무 횟수 */}
              <ColHeader label="D" k="dCount" className="text-sky-700 bg-sky-50 w-9" />
              <ColHeader label="E" k="eCount" className="text-yellow-700 bg-yellow-50 w-9" />
              <ColHeader label="N" k="nCount" className="text-purple-700 bg-purple-50 w-9" />
              <ColHeader label="NE" k="neCount" className="text-blue-900 bg-blue-50 w-10" />
              <ColHeader label="O" k="oCount" className="text-gray-600 bg-gray-100 w-9" />
              <ColHeader label="Y" k="yCount" className="text-green-700 bg-green-50 w-9" />
              <ColHeader label="H" k="hCount" className="text-lime-700 w-9" />
              <ColHeader label="CB" k="cbCount" className="text-orange-700 w-9" />

              {/* 총계 */}
              <ColHeader label="총근무" k="totalWorkCount" className="border-l border-gray-200 text-gray-700 w-14" />
              <ColHeader label="총시간" k="totalWorkHours" className="text-gray-700 w-14" />

              {/* 주말/공휴일 */}
              <ColHeader label="주말근무" k="weekendWorkCount" className="border-l border-gray-200 text-gray-700 w-16" />
              <ColHeader label="주말오프" k="weekendOffCount" className="text-gray-700 w-16" />
              <ColHeader label="공휴일근무" k="holidayWorkCount" className="text-gray-700 w-18" />

              {/* 역할 */}
              <ColHeader label="Desk" k="deskCount" className="border-l border-gray-200 text-red-700 bg-red-50 w-12" />
              <ColHeader label="SubDesk" k="subDeskCount" className="text-blue-700 bg-blue-50 w-16" />
              <ColHeader label="Acting" k="actingCount" className="text-green-700 bg-green-50 w-14" />

              {/* 위반 */}
              <ColHeader label="위반" k="violationCount" className="border-l border-gray-200 text-gray-700 w-14" />
            </tr>
          </thead>

          <tbody>
            {sorted.map((s, i) => (
              <tr
                key={s.nurseId}
                className={`
                  border-b border-gray-100 hover:bg-blue-50/30 transition-colors
                  ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                  ${s.hasViolation ? 'border-l-2 border-l-red-400' : ''}
                `}
              >
                <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-inherit">{s.nurseName}</td>
                <td className="px-2 py-2 text-center">
                  <div className="text-xs text-gray-600">{RANK_LABELS[s.rank]}</div>
                  {s.workType !== 'THREE_SHIFT' && (
                    <div className="text-[10px] text-gray-400">{WORK_TYPE_LABELS[s.workType]}</div>
                  )}
                </td>

                {/* 근무 횟수 */}
                <td className="text-center px-1 py-2 text-sky-700 font-medium">{s.dCount || '-'}</td>
                <td className="text-center px-1 py-2 text-yellow-700 font-medium">{s.eCount || '-'}</td>
                <td className={`text-center px-1 py-2 font-medium ${getIntensity(s.nCount, maxN)}`}>
                  {s.nCount || '-'}
                </td>
                <td className="text-center px-1 py-2 text-blue-900 font-medium">{s.neCount || '-'}</td>
                <td className="text-center px-1 py-2 text-gray-600">{s.oCount || '-'}</td>
                <td className="text-center px-1 py-2 text-green-700">{s.yCount || '-'}</td>
                <td className="text-center px-1 py-2 text-gray-600">{s.hCount || '-'}</td>
                <td className="text-center px-1 py-2 text-orange-700">{s.cbCount || '-'}</td>

                {/* 총계 */}
                <td className="text-center px-2 py-2 border-l border-gray-200 font-medium text-gray-800">
                  {s.totalWorkCount}
                </td>
                <td className={`text-center px-2 py-2 font-medium ${getIntensity(s.totalWorkHours, maxHours)}`}>
                  {s.totalWorkHours > 0 ? `${s.totalWorkHours}h` : '-'}
                </td>

                {/* 주말/공휴일 */}
                <td className={`text-center px-2 py-2 border-l border-gray-200 ${getIntensity(s.weekendWorkCount, maxWW)}`}>
                  {s.weekendWorkCount || '-'}
                </td>
                <td className={`text-center px-2 py-2 ${s.weekendOffCount === 0 && s.workType === 'THREE_SHIFT' ? 'text-red-500 font-bold' : 'text-gray-700'}`}>
                  {s.weekendOffCount === 0 && s.workType === 'THREE_SHIFT' ? '⚠ 0' : (s.weekendOffCount || '-')}
                </td>
                <td className={`text-center px-2 py-2 ${getIntensity(s.holidayWorkCount, maxHW)}`}>
                  {s.holidayWorkCount || '-'}
                </td>

                {/* 역할 */}
                <td className={`text-center px-2 py-2 border-l border-gray-200 ${getIntensity(s.deskCount, maxDesk)}`}>
                  {s.deskCount || '-'}
                </td>
                <td className="text-center px-2 py-2 text-blue-600">{s.subDeskCount || '-'}</td>
                <td className="text-center px-2 py-2 text-green-600">{s.actingCount || '-'}</td>

                {/* 위반 */}
                <td className="text-center px-2 py-2 border-l border-gray-200">
                  {(s.violationCount ?? 0) > 0 ? (
                    <Badge variant="destructive" className="text-xs">{s.violationCount}건</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs text-green-700 bg-green-100">정상</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          {/* 합계 행 */}
          <tfoot>
            <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-sm">
              <td className="px-3 py-2 text-gray-700 sticky left-0 bg-gray-100" colSpan={2}>합계</td>
              <td className="text-center px-1 py-2 text-sky-700">{stats.reduce((a, r) => a + r.dCount, 0)}</td>
              <td className="text-center px-1 py-2 text-yellow-700">{stats.reduce((a, r) => a + r.eCount, 0)}</td>
              <td className="text-center px-1 py-2 text-purple-700">{stats.reduce((a, r) => a + r.nCount, 0)}</td>
              <td className="text-center px-1 py-2 text-blue-900">{stats.reduce((a, r) => a + r.neCount, 0)}</td>
              <td className="text-center px-1 py-2">{stats.reduce((a, r) => a + r.oCount, 0)}</td>
              <td className="text-center px-1 py-2">{stats.reduce((a, r) => a + r.yCount, 0)}</td>
              <td className="text-center px-1 py-2">{stats.reduce((a, r) => a + r.hCount, 0)}</td>
              <td className="text-center px-1 py-2">{stats.reduce((a, r) => a + r.cbCount, 0)}</td>
              <td className="text-center px-2 py-2 border-l border-gray-200">{stats.reduce((a, r) => a + r.totalWorkCount, 0)}</td>
              <td className="text-center px-2 py-2">{stats.reduce((a, r) => a + r.totalWorkHours, 0)}h</td>
              <td className="text-center px-2 py-2 border-l border-gray-200">{stats.reduce((a, r) => a + r.weekendWorkCount, 0)}</td>
              <td className="text-center px-2 py-2">{stats.reduce((a, r) => a + r.weekendOffCount, 0)}</td>
              <td className="text-center px-2 py-2">{stats.reduce((a, r) => a + r.holidayWorkCount, 0)}</td>
              <td className="text-center px-2 py-2 border-l border-gray-200 text-red-700">{stats.reduce((a, r) => a + r.deskCount, 0)}</td>
              <td className="text-center px-2 py-2 text-blue-700">{stats.reduce((a, r) => a + r.subDeskCount, 0)}</td>
              <td className="text-center px-2 py-2 text-green-700">{stats.reduce((a, r) => a + r.actingCount, 0)}</td>
              <td className="text-center px-2 py-2 border-l border-gray-200">
                {violationTotal > 0 && <Badge variant="destructive">{violationTotal}건</Badge>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* N 편차 분석 */}
      {stats.filter((s) => s.workType === 'THREE_SHIFT').length > 0 && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800">
          <strong>야간근무 편차 분석:</strong>{' '}
          {(() => {
            const ns = stats.filter((s) => s.workType === 'THREE_SHIFT').map((s) => s.nCount);
            const avg = ns.reduce((a, b) => a + b, 0) / ns.length;
            const std = Math.sqrt(ns.reduce((a, b) => a + (b - avg) ** 2, 0) / ns.length);
            return `평균 ${avg.toFixed(1)}회, 편차 ±${std.toFixed(1)}회 (최소 ${Math.min(...ns)}, 최대 ${Math.max(...ns)})`;
          })()}
        </div>
      )}
    </div>
  );
}
