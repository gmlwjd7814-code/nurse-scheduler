'use client';

/**
 * 희망 오프 신청 폼 컴포넌트
 * 간호사가 특정 날짜에 O/Y/H/YH를 신청할 수 있습니다
 * 수간호사(관리자)가 일괄 입력 및 조회 가능
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Nurse, ShiftRequest } from '@/types';
import { scheduleApi } from '@/lib/api';
import { toast } from 'sonner';

interface RequestFormProps {
  nurses: Nurse[];
  wardId: number;
  year: number;
  month: number;
}

const REQUEST_SHIFTS = [
  { code: 'O', label: '오프 (O)', color: 'bg-gray-300' },
  { code: 'Y', label: '연차 (Y)', color: 'bg-green-300' },
  { code: 'H', label: '반차 (H)', color: 'bg-lime-200' },
  { code: 'YH', label: '연차반차 (YH)', color: 'bg-lime-400' },
] as const;

type RequestShift = 'O' | 'Y' | 'H' | 'YH';

export default function RequestForm({ nurses, wardId, year, month }: RequestFormProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [selectedNurse, setSelectedNurse] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<RequestShift>('O');
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // 기존 신청 목록 로드
  const loadRequests = useCallback(async () => {
    try {
      const data = await scheduleApi.getRequests(wardId, year, month);
      setRequests(data);
    } catch {
      // 목록 로드 실패는 조용히 처리
    }
  }, [wardId, year, month]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // 희망 오프 신청
  const handleSubmit = async () => {
    if (!selectedNurse || !selectedDay) {
      toast.error('간호사와 날짜를 선택해주세요');
      return;
    }

    setLoading(true);
    try {
      await scheduleApi.submitRequest({
        nurseId: Number(selectedNurse),
        year,
        month,
        day: Number(selectedDay),
        requestedShift: selectedShift,
      });

      const nurseName = nurses.find((n) => n.id === Number(selectedNurse))?.name || '';
      toast.success(`${nurseName} — ${month}월 ${selectedDay}일 ${selectedShift} 신청 완료`);
      setSelectedDay('');
      await loadRequests();
    } catch (err: any) {
      toast.error(err.message || '신청 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 희망 오프 취소
  const handleDelete = async (id: number) => {
    try {
      await scheduleApi.deleteRequest(id);
      toast.success('희망 오프 신청이 취소되었습니다');
      await loadRequests();
    } catch {
      toast.error('취소 중 오류가 발생했습니다');
    }
  };

  // 날짜 요일 표시
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
  const getDayLabel = (d: number) => {
    const dow = new Date(year, month - 1, d).getDay();
    return `${d}일 (${DAY_NAMES[dow]})`;
  };

  // 신청 현황: 간호사별 날짜 집계
  const nurseRequestMap = new Map<number, ShiftRequest[]>();
  for (const req of requests) {
    if (!nurseRequestMap.has(req.nurseId)) nurseRequestMap.set(req.nurseId, []);
    nurseRequestMap.get(req.nurseId)!.push(req);
  }

  const SHIFT_COLORS: Record<RequestShift, string> = {
    O: 'bg-gray-300 text-gray-800',
    Y: 'bg-green-300 text-green-900',
    H: 'bg-lime-200 text-lime-900',
    YH: 'bg-lime-400 text-lime-900',
  };

  return (
    <div className="space-y-6">
      {/* ===== 신청 입력 폼 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">희망 오프 신청</CardTitle>
          <p className="text-sm text-gray-500">
            AI 자동 생성 시 희망 오프를 우선 반영합니다
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* 간호사 선택 */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">간호사</label>
              <Select value={selectedNurse} onValueChange={(v) => setSelectedNurse(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="간호사 선택" />
                </SelectTrigger>
                <SelectContent>
                  {nurses
                    .filter((n) => n.workType !== 'HEAD_NURSE')
                    .map((n) => (
                      <SelectItem key={n.id} value={String(n.id)}>
                        {n.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* 날짜 선택 */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">날짜</label>
              <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="날짜 선택" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {getDayLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 근무 유형 선택 */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">희망 근무</label>
              <Select
                value={selectedShift}
                onValueChange={(v) => setSelectedShift(v as RequestShift)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_SHIFTS.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      <span className={`mr-2 px-1.5 py-0.5 rounded text-xs font-bold ${s.color}`}>
                        {s.code}
                      </span>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 신청 버튼 */}
            <div className="flex items-end">
              <Button
                onClick={handleSubmit}
                disabled={loading || !selectedNurse || !selectedDay}
                className="w-full"
              >
                {loading ? '신청 중...' : '신청하기'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== 신청 현황 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>신청 현황</span>
            <Badge variant="secondary">{requests.length}건</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              신청된 희망 오프가 없습니다
            </p>
          ) : (
            <div className="space-y-3">
              {nurses
                .filter((n) => nurseRequestMap.has(n.id))
                .map((nurse) => {
                  const nurseReqs = nurseRequestMap.get(nurse.id)!;
                  return (
                    <div key={nurse.id} className="flex items-start gap-3">
                      <span className="w-20 text-sm font-medium text-gray-700 shrink-0 pt-0.5">
                        {nurse.name}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {nurseReqs
                          .sort((a, b) => a.day - b.day)
                          .map((req) => (
                            <div
                              key={req.id}
                              className={`
                                flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                                ${SHIFT_COLORS[req.requestedShift as RequestShift]}
                              `}
                            >
                              <span>{req.day}일</span>
                              <span className="font-bold">{req.requestedShift}</span>
                              <button
                                onClick={() => handleDelete(req.id)}
                                className="ml-1 text-gray-500 hover:text-red-600 text-xs"
                                title="취소"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 신청 현황 달력 형태 ===== */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">날짜별 신청 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                <div key={d} className="text-center font-medium text-gray-500 py-1">{d}</div>
              ))}
              {/* 첫 날 앞 빈칸 */}
              {Array.from({
                length: new Date(year, month - 1, 1).getDay()
              }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map((d) => {
                const dayRequests = requests.filter((r) => r.day === d);
                const dow = new Date(year, month - 1, d).getDay();
                return (
                  <div
                    key={d}
                    className={`
                      min-h-[52px] border rounded p-1
                      ${dow === 0 ? 'border-red-200 bg-red-50/50' : ''}
                      ${dow === 6 ? 'border-blue-200 bg-blue-50/50' : ''}
                      ${dow !== 0 && dow !== 6 ? 'border-gray-200' : ''}
                    `}
                  >
                    <div className={`font-medium mb-0.5 ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                      {d}
                    </div>
                    {dayRequests.map((req) => (
                      <div
                        key={req.id}
                        className={`text-[9px] px-1 rounded mb-0.5 font-medium truncate ${SHIFT_COLORS[req.requestedShift as RequestShift]}`}
                      >
                        {req.nurseName || `ID:${req.nurseId}`}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
