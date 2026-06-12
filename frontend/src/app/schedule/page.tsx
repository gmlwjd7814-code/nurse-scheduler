'use client';

/**
 * 근무표 페이지 v2
 * - AI 자동 생성 (CSP + 최적화)
 * - AG Grid 엑셀 형태 근무표
 * - FullCalendar 개인별 달력 뷰
 * - 드래그&드롭 근무 교환
 * - Excel 다운로드 / PDF 출력
 */

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { scheduleApi, nurseApi, settingsApi } from '@/lib/api';
import { FullSchedule, Nurse, ScheduleViolation, WardSettings } from '@/types';
import { toast } from 'sonner';

// AG Grid / FullCalendar: SSR 방지
const ScheduleGrid = dynamic(
  () => import('@/components/schedule/ScheduleGrid'),
  { ssr: false, loading: () => <div className="text-center py-10 text-gray-400">그리드 로딩 중...</div> }
);
const NurseCalendar = dynamic(
  () => import('@/components/schedule/NurseCalendar'),
  { ssr: false, loading: () => <div className="text-center py-10 text-gray-400">달력 로딩 중...</div> }
);
const ScheduleTable = dynamic(
  () => import('@/components/schedule/ScheduleTable'),
  { ssr: false, loading: () => <div className="text-center py-10 text-gray-400">표 로딩 중...</div> }
);

const WARD_ID = 1;

export default function SchedulePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [fullSchedule, setFullSchedule] = useState<FullSchedule | null>(null);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [violations, setViolations] = useState<ScheduleViolation[]>([]);
  const [settings, setSettings] = useState<WardSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('table');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleData, nurseData, settingsData] = await Promise.all([
        scheduleApi.get(WARD_ID, year, month).catch(() => null),
        nurseApi.list(WARD_ID),
        settingsApi.get(WARD_ID),
      ]);
      setNurses(nurseData);
      setSettings(settingsData);
      setFullSchedule(scheduleData);
    } catch (err: any) {
      toast.error(err.message || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await scheduleApi.generate(WARD_ID, year, month, true);
      toast.success(`근무표 생성 완료 — 위반 ${result.violationCount}건 (${result.elapsed}ms)`);
      setViolations(result.violations);
      await loadData();
      setActiveTab('table');
    } catch (err: any) {
      toast.error(err.message || '근무표 생성 실패');
    } finally {
      setGenerating(false);
    }
  };

  const goPrevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const violationErrors = violations.filter((v) => v.severity === 'ERROR');
  const violationWarnings = violations.filter((v) => v.severity === 'WARNING');

  return (
    <div className="space-y-4 print:space-y-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">근무표</h1>
          <div className="flex items-center gap-1">
            <button onClick={goPrevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-lg">‹</button>
            <span className="font-semibold text-gray-800 min-w-[90px] text-center">
              {year}년 {month}월
            </span>
            <button onClick={goNextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-lg">›</button>
          </div>
          {settings && (
            <Badge variant="secondary" className="text-xs">오프 {settings.monthlyOffCount}개/월</Badge>
          )}
          {violations.length > 0 && (
            <Badge variant="destructive" className="text-xs">위반 {violationErrors.length}건</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {generating ? '⏳ 생성 중...' : 'AI 자동 생성'}
          </Button>
          {fullSchedule && (
            <>
              <Button
                size="sm" variant="outline"
                onClick={() => window.open(scheduleApi.excelUrl(WARD_ID, year, month), '_blank')}
              >
                Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                인쇄
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 본문 */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-2">⏳</div>
          <p>로딩 중...</p>
        </div>
      ) : !fullSchedule ? (
        <Card>
          <CardContent className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              {year}년 {month}월 근무표가 없습니다
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              AI 자동 생성 버튼을 클릭하면 CSP + 최적화로 근무표를 생성합니다
            </p>
            <Button onClick={handleGenerate} disabled={generating} className="bg-blue-600 hover:bg-blue-700">
              {generating ? '⏳ 생성 중...' : 'AI 자동 생성 시작'}
            </Button>

            {/* 알고리즘 설명 */}
            <div className="mt-8 max-w-lg mx-auto text-left bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold mb-2">생성 알고리즘 (2단계)</p>
              <p><strong>Phase 1</strong> — Constraint Satisfaction: 절대 규칙 위반이 없는 초기 해 탐색</p>
              <p><strong>Phase 2</strong> — Optimization: 야간·주말·공휴일 근무 균등 분배를 위한 Local Search 최적화 (최대 5회 패스)</p>
              <p className="text-blue-600 text-xs mt-2">우선순위: 1.절대규칙 → 2.희망오프 → 3.야간균등 → 4.주말균등 → 5.역할균형 → 6.총근무균형</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="print:hidden">
            <TabsTrigger value="grid">인터랙티브 뷰</TabsTrigger>
            <TabsTrigger value="table">근무표</TabsTrigger>
            <TabsTrigger value="calendar">달력 뷰</TabsTrigger>
            <TabsTrigger value="violations">
              위반 사항
              {violationErrors.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{violationErrors.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── AG Grid 근무표 탭 ─────────────────────── */}
          <TabsContent value="grid">
            <Card>
              <CardHeader className="pb-2 print:py-1">
                <CardTitle className="text-sm text-gray-600 font-normal print:text-base print:font-bold">
                  내과 병동 {year}년 {month}월 근무표
                  {fullSchedule.schedule.generatedAt && (
                    <span className="ml-2 text-xs text-gray-400">
                      (생성: {new Date(fullSchedule.schedule.generatedAt).toLocaleString('ko-KR')})
                    </span>
                  )}
                  <span className="ml-2 text-xs text-blue-500">· 셀 드래그로 근무 교환 가능</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto print:overflow-visible print:p-0">
                <ScheduleGrid
                  nurses={fullSchedule.nurses}
                  entries={fullSchedule.entries}
                  year={year}
                  month={month}
                  onUpdate={loadData}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ScheduleTable 표 뷰 탭 ──────────────── */}
          <TabsContent value="table">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600 font-normal">
                  내과 병동 {year}년 {month}월 근무표
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleTable
                  nurses={fullSchedule.nurses}
                  entries={fullSchedule.entries}
                  year={year}
                  month={month}
                  onUpdate={loadData}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── FullCalendar 달력 탭 ─────────────────── */}
          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">개인별 달력 뷰</CardTitle>
              </CardHeader>
              <CardContent>
                <NurseCalendar
                  nurses={fullSchedule.nurses}
                  entries={fullSchedule.entries}
                  year={year}
                  month={month}
                  onUpdate={loadData}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 위반 사항 탭 ─────────────────────────── */}
          <TabsContent value="violations">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">규칙 위반 현황</CardTitle>
              </CardHeader>
              <CardContent>
                {violations.length === 0 ? (
                  <div className="text-center py-10 text-green-600">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="font-medium">위반 사항이 없습니다!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {violationErrors.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-red-700 mb-2 text-sm flex items-center gap-1">
                          <span>⚠️</span> 오류 ({violationErrors.length}건)
                        </h3>
                        <div className="space-y-1">
                          {violationErrors.map((v, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                              <span className="text-red-500 shrink-0 text-sm">⚠</span>
                              <div>
                                <span className="font-medium text-sm text-red-800">
                                  {v.nurseName}{v.day > 0 ? ` — ${v.day}일` : ''}
                                </span>
                                <p className="text-xs text-red-600">{v.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {violationWarnings.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-orange-700 mb-2 text-sm flex items-center gap-1">
                          <span>⚡</span> 경고 ({violationWarnings.length}건)
                        </h3>
                        <div className="space-y-1">
                          {violationWarnings.map((v, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-md">
                              <span className="text-orange-500 shrink-0 text-sm">⚡</span>
                              <div>
                                <span className="font-medium text-sm text-orange-800">{v.nurseName}</span>
                                <p className="text-xs text-orange-600">{v.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 위반 분포 요약 */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                      <p className="font-semibold mb-1">위반 유형별 집계</p>
                      {Object.entries(
                        violations.reduce((acc, v) => {
                          acc[v.rule] = (acc[v.rule] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([rule, count]) => (
                        <div key={rule} className="flex justify-between py-0.5">
                          <span>{rule}</span>
                          <span className="font-medium text-red-600">{count}건</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
