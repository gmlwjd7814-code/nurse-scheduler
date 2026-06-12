'use client';

/**
 * 설정 페이지
 * 병동 필요 인원, 월 오프 개수, 야간전담 연속 설정
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { settingsApi, nurseApi, holidayApi, Holiday } from '@/lib/api';
import { WardSettings, Nurse, RANK_LABELS } from '@/types';
import { toast } from 'sonner';

const WARD_ID = 1;
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export default function SettingsPage() {
  const [settings, setSettings] = useState<WardSettings | null>(null);
  const [form, setForm] = useState<Partial<WardSettings>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [offOverrides, setOffOverrides] = useState<Record<number, number | null>>({});
  const [savingOff, setSavingOff] = useState(false);

  // 공휴일 관리 상태
  const currentYear = new Date().getFullYear();
  const [holidayYear, setHolidayYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [addingHoliday, setAddingHoliday] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsApi.get(WARD_ID),
      nurseApi.list(WARD_ID),
    ]).then(([settingsData, nurseData]) => {
      setSettings(settingsData);
      setForm(settingsData);
      setNurses(nurseData);
      const overrides: Record<number, number | null> = {};
      nurseData.forEach((n) => { overrides[n.id] = n.monthlyOffOverride ?? null; });
      setOffOverrides(overrides);
    }).catch(() => {
      toast.error('설정 로드 실패');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    holidayApi.list(holidayYear)
      .then(setHolidays)
      .catch(() => toast.error('공휴일 로드 실패'));
  }, [holidayYear]);

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name.trim()) {
      toast.error('날짜와 이름을 입력해주세요');
      return;
    }
    const [year, month, day] = newHoliday.date.split('-').map(Number);
    setAddingHoliday(true);
    try {
      const created = await holidayApi.create({ year, month, day, name: newHoliday.name.trim() });
      setHolidays((prev) => [...prev, created].sort((a, b) => a.month - b.month || a.day - b.day));
      setNewHoliday({ date: '', name: '' });
      toast.success(`${month}월 ${day}일 "${newHoliday.name}" 추가됨`);
    } catch (err: any) {
      toast.error(err.message || '추가 실패');
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: number, label: string) => {
    try {
      await holidayApi.delete(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success(`"${label}" 삭제됨`);
    } catch (err: any) {
      toast.error(err.message || '삭제 실패');
    }
  };

  const handleChange = (key: keyof WardSettings, value: number) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.update(WARD_ID, form);
      toast.success('설정이 저장되었습니다');
    } catch (err: any) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOffOverrides = async () => {
    setSavingOff(true);
    try {
      await Promise.all(
        nurses.map((n) =>
          nurseApi.update(n.id, { monthlyOffOverride: offOverrides[n.id] ?? null })
        )
      );
      toast.success('멤버별 오프 수가 저장되었습니다');
    } catch (err: any) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSavingOff(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">로딩 중...</div>;
  if (!settings) return <div className="text-center py-20 text-red-400">설정을 불러올 수 없습니다</div>;

  const NumberInput = ({
    label, fieldKey, min = 0, max = 20, desc
  }: {
    label: string;
    fieldKey: keyof WardSettings;
    min?: number;
    max?: number;
    desc?: string;
  }) => (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {desc && <p className="text-xs text-gray-400 mb-1">{desc}</p>}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => handleChange(fieldKey, Math.max(min, ((form[fieldKey] as number) || 0) - 1))}
          className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
        >−</button>
        <Input
          type="number"
          min={min}
          max={max}
          value={(form[fieldKey] as number) ?? 0}
          onChange={(e) => handleChange(fieldKey, Number(e.target.value))}
          className="w-20 text-center"
        />
        <button
          onClick={() => handleChange(fieldKey, Math.min(max, ((form[fieldKey] as number) || 0) + 1))}
          className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
        >+</button>
        <span className="text-sm text-gray-500">명</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">병동 설정</h1>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>

      {/* 병동 정보 */}
      <Card>
        <CardHeader><CardTitle className="text-base">병동 정보</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">병동명:</span>
            <span>{settings.wardName}</span>
          </div>
        </CardContent>
      </Card>

      {/* 평일 필요 인원 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">평일 필요 인원</CardTitle>
          <p className="text-sm text-gray-500">월~금 각 근무별 최소 배정 인원</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <NumberInput label="D (낮근무)" fieldKey="weekdayDCount" />
            <NumberInput label="E (저녁근무)" fieldKey="weekdayECount" />
            <NumberInput label="N (야간근무)" fieldKey="weekdayNCount" />
          </div>
        </CardContent>
      </Card>

      {/* 주말/공휴일 필요 인원 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">주말/공휴일 필요 인원</CardTitle>
          <p className="text-sm text-gray-500">토/일/공휴일 각 근무별 최소 배정 인원</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <NumberInput label="D (낮근무)" fieldKey="weekendDCount" />
            <NumberInput label="E (저녁근무)" fieldKey="weekendECount" />
            <NumberInput label="N (야간근무)" fieldKey="weekendNCount" />
          </div>
        </CardContent>
      </Card>

      {/* 오프 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">월별 오프 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">월 오프 개수</Label>
            <p className="text-xs text-gray-400 mb-1">
              간호사 1인당 한 달에 부여할 오프 최대 개수 (8~11개 권장)
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => handleChange('monthlyOffCount', Math.max(6, (form.monthlyOffCount || 9) - 1))}
                className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
              >−</button>
              <Input
                type="number"
                min={6}
                max={15}
                value={form.monthlyOffCount ?? 9}
                onChange={(e) => handleChange('monthlyOffCount', Number(e.target.value))}
                className="w-20 text-center"
              />
              <button
                onClick={() => handleChange('monthlyOffCount', Math.min(15, (form.monthlyOffCount || 9) + 1))}
                className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
              >+</button>
              <span className="text-sm text-gray-500">개</span>
            </div>
            <div className="flex gap-1 mt-2">
              {[8, 9, 10, 11].map((n) => (
                <button
                  key={n}
                  onClick={() => handleChange('monthlyOffCount', n)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    form.monthlyOffCount === n
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {n}개
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 연속 근무 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">연속 근무 제한</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-sm font-medium">최대 연속 근무일 (3교대)</Label>
            <p className="text-xs text-gray-400 mb-1">
              일반 3교대 간호사의 연속 근무 최대 일수 (법정 기준 6일)
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => handleChange('maxConsecutiveWork', Math.max(4, (form.maxConsecutiveWork || 6) - 1))}
                className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
              >−</button>
              <Input
                type="number"
                min={4}
                max={7}
                value={form.maxConsecutiveWork ?? 6}
                onChange={(e) => handleChange('maxConsecutiveWork', Number(e.target.value))}
                className="w-20 text-center"
              />
              <button
                onClick={() => handleChange('maxConsecutiveWork', Math.min(7, (form.maxConsecutiveWork || 6) + 1))}
                className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
              >+</button>
              <span className="text-sm text-gray-500">일</span>
            </div>
            <div className="flex gap-1 mt-2">
              {[4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => handleChange('maxConsecutiveWork', n)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    form.maxConsecutiveWork === n
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {n}일{n === 6 ? ' (기본)' : ''}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">최대 연속 NE 근무일 (야간전담)</Label>
            <p className="text-xs text-gray-400 mb-1">
              야간전담 간호사의 연속 근무 최대 일수 (3~7일 권장)
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => handleChange('maxConsecutiveNE', Math.max(2, (form.maxConsecutiveNE || 5) - 1))}
                className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
              >−</button>
              <Input
                type="number"
                min={2}
                max={10}
                value={form.maxConsecutiveNE ?? 5}
                onChange={(e) => handleChange('maxConsecutiveNE', Number(e.target.value))}
                className="w-20 text-center"
              />
              <button
                onClick={() => handleChange('maxConsecutiveNE', Math.min(10, (form.maxConsecutiveNE || 5) + 1))}
                className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
              >+</button>
              <span className="text-sm text-gray-500">일</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 멤버별 오프 수 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">멤버별 오프 수 설정</CardTitle>
          <p className="text-sm text-gray-500">
            비워두면 위 기본값({form.monthlyOffCount ?? '?'}개) 적용 · 숫자 입력 시 해당 멤버만 개별 적용
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4 max-h-96 overflow-y-auto pr-1">
            {nurses.map((n) => {
              const val = offOverrides[n.id];
              return (
                <div key={n.id} className="flex items-center gap-3 py-1 border-b border-gray-100 last:border-0">
                  <div className="w-36 shrink-0">
                    <span className="font-medium text-sm text-gray-900">{n.name}</span>
                    <span className="ml-1.5 text-xs text-gray-400">{RANK_LABELS[n.rank]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setOffOverrides((p) => ({ ...p, [n.id]: Math.max(0, (p[n.id] ?? form.monthlyOffCount ?? 9) - 1) }))}
                      className="w-7 h-7 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 text-sm"
                    >−</button>
                    <Input
                      type="number"
                      min={0}
                      max={31}
                      placeholder={String(form.monthlyOffCount ?? 9)}
                      value={val ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Number(e.target.value);
                        setOffOverrides((p) => ({ ...p, [n.id]: v }));
                      }}
                      className="w-16 text-center text-sm h-7"
                    />
                    <button
                      onClick={() => setOffOverrides((p) => ({ ...p, [n.id]: Math.min(31, (p[n.id] ?? form.monthlyOffCount ?? 9) + 1) }))}
                      className="w-7 h-7 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 text-sm"
                    >+</button>
                    <span className="text-xs text-gray-400">개</span>
                    {val !== null && (
                      <button
                        onClick={() => setOffOverrides((p) => ({ ...p, [n.id]: null }))}
                        className="ml-1 text-xs text-gray-400 hover:text-red-400"
                      >기본값으로</button>
                    )}
                  </div>
                  {val === null && (
                    <span className="text-xs text-gray-300">기본값 ({form.monthlyOffCount ?? '?'}개)</span>
                  )}
                </div>
              );
            })}
          </div>
          <Button size="sm" onClick={handleSaveOffOverrides} disabled={savingOff}>
            {savingOff ? '저장 중...' : '멤버별 오프 수 저장'}
          </Button>
        </CardContent>
      </Card>

      {/* 공휴일 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">공휴일 관리</CardTitle>
          <p className="text-sm text-gray-500">근무표 생성 시 공휴일로 처리할 날짜를 관리합니다</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 연도 선택 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHolidayYear((y) => y - 1)}
              className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
            >‹</button>
            <span className="font-semibold text-gray-900 w-16 text-center">{holidayYear}년</span>
            <button
              onClick={() => setHolidayYear((y) => y + 1)}
              className="w-8 h-8 rounded border border-gray-200 hover:bg-gray-100 font-bold text-gray-600"
            >›</button>
          </div>

          {/* 공휴일 목록 */}
          {holidays.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">등록된 공휴일이 없습니다</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {(() => {
                const byMonth: Record<number, Holiday[]> = {};
                holidays.forEach((h) => {
                  if (!byMonth[h.month]) byMonth[h.month] = [];
                  byMonth[h.month].push(h);
                });
                return Object.entries(byMonth).map(([m, hs]) => (
                  <div key={m}>
                    <p className="text-xs font-semibold text-gray-400 mt-2 mb-1">{MONTH_NAMES[Number(m) - 1]}</p>
                    {hs.map((h) => (
                      <div key={h.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700 w-12">
                            {h.month}/{h.day}
                          </span>
                          <span className="text-sm text-gray-900">{h.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteHoliday(h.id, h.name)}
                          className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1.5 py-0.5 rounded hover:bg-red-50"
                        >삭제</button>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}

          {/* 공휴일 추가 폼 */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              type="date"
              value={newHoliday.date}
              min={`${holidayYear}-01-01`}
              max={`${holidayYear}-12-31`}
              onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))}
              className="h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Input
              placeholder="공휴일 이름"
              value={newHoliday.name}
              onChange={(e) => setNewHoliday((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddHoliday(); }}
              className="h-9 text-sm flex-1"
            />
            <Button size="sm" onClick={handleAddHoliday} disabled={addingHoliday} className="shrink-0">
              {addingHoliday ? '추가 중...' : '+ 추가'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 규칙 안내 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base text-blue-800">고정 적용 규칙 안내</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-blue-700 list-disc list-inside">
            <li>연속 근무 최대 6일 (위 설정에서 조정 가능)</li>
            <li>야간근무(N) 연속 최대 3일 (2일 연속 시 이후 O 2개 필수)</li>
            <li>낮근무(D) 연속 최대 4일</li>
            <li>E 다음날 D 배정 금지</li>
            <li>월 1회 이상 주말(토/일) 오프 보장</li>
            <li>수간호사: 일요일/공휴일 OFF, 격주 토요일 OFF, D 근무만 가능</li>
            <li>야간전담: 월 15회 NE + 나머지 O (31일이면 1회 Y 추가)</li>
            <li>역할(Desk/SubDesk/Acting) 균등 분배</li>
            <li>신규간호사(GN) 단독 야간근무 금지, 프리셉터 동일 근무 우선 배치</li>
            <li>N 1회인 경우 N→O→E 패턴 허용 (NOE 규칙)</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="px-8">
          {saving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}
