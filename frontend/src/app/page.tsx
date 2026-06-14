'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { nurseApi, scheduleApi, statsApi } from '@/lib/api';
import { Nurse, NurseMonthlyStats } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';

export default function DashboardPage() {
  const { wardId, wardName } = useAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [stats, setStats] = useState<NurseMonthlyStats[]>([]);
  const [scheduleExists, setScheduleExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wardId) return;
    async function load() {
      try {
        const [nurseData, scheduleData] = await Promise.all([
          nurseApi.list(wardId),
          scheduleApi.get(wardId, year, month).catch(() => null),
        ]);
        setNurses(nurseData);
        setScheduleExists(!!scheduleData);
        if (scheduleData) {
          const statsData = await statsApi.get(wardId, year, month).catch(() => []);
          setStats(statsData);
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [wardId, year, month]);

  const violationCount = stats.filter((s) => s.hasViolation).length;

  return (
    <AuthGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">{year}년 {month}월{wardName ? ` — ${wardName}` : ''}</p>
        </div>
        <Link href="/schedule">
          <Button size="sm">{scheduleExists ? '근무표 보기 →' : '근무표 생성 →'}</Button>
        </Link>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-5">
          <div className="text-3xl font-bold text-blue-600">{nurses.length}</div>
          <div className="text-sm text-gray-500 mt-1">전체 간호사</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="text-3xl font-bold text-sky-600">
            {nurses.filter((n) => n.workType === 'THREE_SHIFT').length}
          </div>
          <div className="text-sm text-gray-500 mt-1">3교대 간호사</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="text-3xl font-bold text-blue-900">
            {nurses.filter((n) => n.workType === 'NIGHT_ONLY').length}
          </div>
          <div className="text-sm text-gray-500 mt-1">야간전담 간호사</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className={`text-3xl font-bold ${violationCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {scheduleExists ? violationCount : '—'}
          </div>
          <div className="text-sm text-gray-500 mt-1">규칙 위반</div>
        </CardContent></Card>
      </div>

      {/* 빠른 작업 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: '/schedule', icon: '📅', title: 'AI 근무표 자동 생성',
            desc: '6가지 우선순위 최적화 알고리즘으로 근무표를 자동 생성합니다', btn: '근무표 페이지 →', variant: 'default' as const },
          { href: '/requests', icon: '📝', title: '희망 오프 신청',
            desc: 'O, Y, H, YH 신청 가능. AI 자동 생성 시 우선 반영됩니다', btn: '신청하러 가기 →', variant: 'outline' as const },
          { href: '/stats', icon: '📊', title: '월별 통계',
            desc: 'D/E/N 횟수, 역할 배정 현황, 주말 근무, 위반 여부를 확인합니다', btn: '통계 보기 →', variant: 'outline' as const },
        ].map((item) => (
          <Card key={item.href} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{item.icon}</span> {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-3">{item.desc}</p>
              <Link href={item.href}>
                <Button size="sm" variant={item.variant} className="w-full">{item.btn}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 간호사 현황 */}
      <Card>
        <CardHeader><CardTitle className="text-base">간호사 현황</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-400 text-sm">로딩 중...</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {nurses.map((n) => (
                <div key={n.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{n.name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {n.workType === 'HEAD_NURSE' ? '수간호사' : n.workType === 'NIGHT_ONLY' ? '야간전담' : '3교대'}
                    </span>
                  </div>
                  <Badge variant="secondary" className={`text-xs ${
                    n.capability === 'Desk' ? 'bg-red-100 text-red-700' :
                    n.capability === 'SubDesk' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                  }`}>{n.capability}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 근무 코드 안내 */}
      <Card>
        <CardHeader><CardTitle className="text-base">근무 코드 안내</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {[
              { code: 'D', label: '낮근무', cls: 'bg-sky-200 text-sky-900' },
              { code: 'E', label: '저녁근무', cls: 'bg-yellow-200 text-yellow-900' },
              { code: 'N', label: '야간근무', cls: 'bg-purple-300 text-purple-900' },
              { code: 'NE', label: '야간전담', cls: 'bg-blue-900 text-white' },
              { code: 'O', label: '오프', cls: 'bg-gray-300 text-gray-800' },
              { code: 'Y', label: '연차', cls: 'bg-green-300 text-green-900' },
              { code: 'H', label: '반차', cls: 'bg-lime-200 text-lime-900' },
              { code: 'YH', label: '연차반차', cls: 'bg-lime-400 text-lime-900' },
              { code: 'V', label: '경조휴가', cls: 'bg-orange-200 text-orange-900' },
              { code: 'I', label: '공가', cls: 'bg-amber-100 text-amber-900' },
              { code: 'CB', label: '콜백', cls: 'bg-orange-400 text-white' },
              { code: 'C', label: '당직', cls: 'bg-red-300 text-red-900' },
            ].map((item) => (
              <div key={item.code} className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.cls}`}>{item.code}</span>
                <span className="text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </AuthGuard>
  );
}
