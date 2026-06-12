'use client';

/**
 * 희망 오프 신청 페이지 (메인 메뉴로 분리)
 * 간호사별 O/Y/H/YH 신청 및 관리
 */

import React, { useEffect, useState } from 'react';
import { nurseApi } from '@/lib/api';
import { Nurse } from '@/types';
import RequestForm from '@/components/schedule/RequestForm';
import { Badge } from '@/components/ui/badge';

const WARD_ID = 1;

export default function RequestsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    nurseApi.list(WARD_ID).then(setNurses).catch(console.error).finally(() => setLoading(false));
  }, []);

  const goPrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">희망 오프 신청</h1>
          <div className="flex items-center gap-1">
            <button onClick={goPrevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">‹</button>
            <span className="font-semibold text-gray-800 min-w-[90px] text-center">
              {year}년 {month}월
            </span>
            <button onClick={goNextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">›</button>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          신청된 오프는 AI 근무표 생성 시 최우선으로 반영됩니다
        </div>
      </div>

      {/* 신청 가능 근무 안내 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { code: 'O', label: '오프', cls: 'bg-gray-300 text-gray-800' },
          { code: 'Y', label: '연차', cls: 'bg-green-300 text-green-900' },
          { code: 'H', label: '반차', cls: 'bg-lime-200 text-lime-900' },
          { code: 'YH', label: '연차반차', cls: 'bg-lime-400 text-lime-900' },
        ].map((s) => (
          <span key={s.code} className={`px-3 py-1 rounded-full text-sm font-medium ${s.cls}`}>
            {s.code} — {s.label}
          </span>
        ))}
        <span className="text-xs text-gray-400 self-center ml-2">신청 가능 근무 유형</span>
      </div>

      {/* 신청 폼 */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">로딩 중...</div>
      ) : (
        <RequestForm
          nurses={nurses}
          wardId={WARD_ID}
          year={year}
          month={month}
        />
      )}
    </div>
  );
}
