'use client';

/**
 * 통계 페이지
 * 월별 개인별 근무 횟수, 역할 배정, 위반 여부 등
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { statsApi } from '@/lib/api';
import { NurseMonthlyStats } from '@/types';
import StatsTable from '@/components/stats/StatsTable';
import { toast } from 'sonner';
import { scheduleApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';

export default function StatsPage() {
  const { wardId } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stats, setStats] = useState<NurseMonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!wardId) return;
    setLoading(true);
    try {
      const data = await statsApi.get(wardId, year, month);
      setStats(data);
    } catch {
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [wardId, year, month]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const goPrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // 엑셀로 통계 다운로드 (근무표 Excel에 포함됨)
  const handleExcelDownload = () => {
    const url = scheduleApi.excelUrl(wardId, year, month);
    window.open(url, '_blank');
  };

  const violationCount = stats.filter((s) => s.hasViolation).length;
  const weekendOffMissing = stats.filter(
    (s) => s.workType === 'THREE_SHIFT' && s.weekendOffCount === 0
  ).length;

  return (
    <AuthGuard>
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">월별 통계</h1>
          <div className="flex items-center gap-1">
            <button onClick={goPrevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">‹</button>
            <span className="font-semibold text-gray-800 min-w-[90px] text-center">
              {year}년 {month}월
            </span>
            <button onClick={goNextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">›</button>
          </div>
        </div>
        {stats.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleExcelDownload}>
            📊 Excel 다운로드
          </Button>
        )}
      </div>

      {/* 요약 카드 */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">집계 인원</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${violationCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {violationCount}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">규칙 위반 인원</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${weekendOffMissing > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {weekendOffMissing}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">주말 오프 미보장</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-gray-700">
                {stats.reduce((s, r) => s + r.nCount, 0)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">총 야간 근무 횟수</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 통계 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">개인별 근무 통계</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="text-center py-20 text-gray-400">로딩 중...</div>
          ) : (
            <div className="p-4">
              <StatsTable stats={stats} year={year} month={month} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </AuthGuard>
  );
}
