'use client';

/**
 * 간호사 관리 페이지
 * 목록 조회, 등록, 수정, 비활성화
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { nurseApi } from '@/lib/api';
import {
  Nurse, NurseRank, WorkType, Capability,
  RANK_LABELS, WORK_TYPE_LABELS
} from '@/types';
import { toast } from 'sonner';

const WARD_ID = 1;

const RANK_OPTIONS: { value: NurseRank; label: string }[] = [
  { value: 'HEAD', label: '수간호사' },
  { value: 'CHARGE', label: '책임간호사' },
  { value: 'RN', label: '일반간호사' },
  { value: 'GN', label: '신규간호사' },
];

const WORK_TYPE_OPTIONS: { value: WorkType; label: string }[] = [
  { value: 'THREE_SHIFT', label: '일반 3교대' },
  { value: 'NIGHT_ONLY', label: '야간전담' },
  { value: 'HEAD_NURSE', label: '수간호사' },
];

const CAPABILITY_OPTIONS: { value: Capability; label: string; desc: string }[] = [
  { value: 'Desk', label: 'Desk', desc: 'Desk/SubDesk/Acting 모두 가능' },
  { value: 'SubDesk', label: 'SubDesk', desc: 'SubDesk/Acting 가능' },
  { value: 'Acting', label: 'Acting', desc: 'Acting만 가능' },
];

const WORK_TYPE_BADGE: Record<WorkType, string> = {
  HEAD_NURSE: 'bg-purple-100 text-purple-800',
  NIGHT_ONLY: 'bg-blue-100 text-blue-800',
  THREE_SHIFT: 'bg-gray-100 text-gray-700',
};

const CAPABILITY_BADGE: Record<Capability, string> = {
  Desk: 'bg-red-100 text-red-700',
  SubDesk: 'bg-blue-100 text-blue-700',
  Acting: 'bg-gray-100 text-gray-600',
};

type FormData = {
  name: string;
  rank: NurseRank;
  yearsOfService: number;
  workType: WorkType;
  capability: Capability;
  wardId: number;
  preceptorId: number | null;
};

const defaultForm: FormData = {
  name: '',
  rank: 'RN',
  yearsOfService: 0,
  workType: 'THREE_SHIFT',
  capability: 'Acting',
  wardId: WARD_ID,
  preceptorId: null,
};

export default function NursesPage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Nurse | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filterWorkType, setFilterWorkType] = useState<string>('ALL');

  const loadNurses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await nurseApi.list(WARD_ID);
      setNurses(data);
    } catch {
      toast.error('간호사 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNurses(); }, [loadNurses]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (nurse: Nurse) => {
    setEditTarget(nurse);
    setForm({
      name: nurse.name,
      rank: nurse.rank,
      yearsOfService: nurse.yearsOfService,
      workType: nurse.workType,
      capability: nurse.capability,
      wardId: nurse.wardId,
      preceptorId: nurse.preceptorId ?? null,
    });
    setDialogOpen(true);
  };

  // 프리셉터 후보: CHARGE/RN 중 3교대 (GN 본인 제외)
  const preceptorCandidates = nurses.filter(
    (n) => (n.rank === 'CHARGE' || n.rank === 'RN') && n.workType === 'THREE_SHIFT'
  );

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('이름을 입력해주세요');
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        await nurseApi.update(editTarget.id, form);
        toast.success('간호사 정보가 수정되었습니다');
      } else {
        await nurseApi.create(form);
        toast.success('간호사가 등록되었습니다');
      }
      setDialogOpen(false);
      await loadNurses();
    } catch (err: any) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (nurse: Nurse) => {
    if (!confirm(`${nurse.name} 간호사를 비활성화하시겠습니까?`)) return;
    try {
      await nurseApi.delete(nurse.id);
      toast.success('비활성화되었습니다');
      await loadNurses();
    } catch {
      toast.error('비활성화 실패');
    }
  };

  const filtered = filterWorkType === 'ALL'
    ? nurses
    : nurses.filter((n) => n.workType === filterWorkType);

  // 통계
  const counts = {
    total: nurses.length,
    head: nurses.filter((n) => n.workType === 'HEAD_NURSE').length,
    threeShift: nurses.filter((n) => n.workType === 'THREE_SHIFT').length,
    nightOnly: nurses.filter((n) => n.workType === 'NIGHT_ONLY').length,
    desk: nurses.filter((n) => n.capability === 'Desk').length,
    subDesk: nurses.filter((n) => n.capability === 'SubDesk').length,
    acting: nurses.filter((n) => n.capability === 'Acting').length,
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">간호사 관리</h1>
        <Button size="sm" onClick={openCreate}>+ 간호사 등록</Button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
        {[
          { label: '전체', value: counts.total, cls: 'text-blue-600' },
          { label: '수간호사', value: counts.head, cls: 'text-purple-600' },
          { label: '3교대', value: counts.threeShift, cls: 'text-sky-600' },
          { label: '야간전담', value: counts.nightOnly, cls: 'text-blue-900' },
          { label: 'Desk', value: counts.desk, cls: 'text-red-600' },
          { label: 'SubDesk', value: counts.subDesk, cls: 'text-blue-600' },
          { label: 'Acting', value: counts.acting, cls: 'text-gray-600' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <div className={`text-2xl font-bold ${item.cls}`}>{item.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {['ALL', 'HEAD_NURSE', 'THREE_SHIFT', 'NIGHT_ONLY'].map((wt) => (
          <button
            key={wt}
            onClick={() => setFilterWorkType(wt)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterWorkType === wt
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {wt === 'ALL' ? '전체' : WORK_TYPE_LABELS[wt as WorkType]}
          </button>
        ))}
      </div>

      {/* 간호사 테이블 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-20 text-gray-400">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">이름</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">직급</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">근무형태</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">역량</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">연차</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">프리셉터</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">상태</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((nurse, i) => (
                    <tr
                      key={nurse.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{nurse.name}</td>
                      <td className="px-4 py-3 text-gray-600">{RANK_LABELS[nurse.rank]}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${WORK_TYPE_BADGE[nurse.workType]}`} variant="secondary">
                          {WORK_TYPE_LABELS[nurse.workType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-xs ${CAPABILITY_BADGE[nurse.capability]}`} variant="secondary">
                          {nurse.capability}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{nurse.yearsOfService}년</td>
                      <td className="px-4 py-3 text-sm">
                        {nurse.rank === 'GN' ? (
                          nurse.preceptorName ? (
                            <span className="text-blue-700 font-medium">{nurse.preceptorName}</span>
                          ) : (
                            <span className="text-red-400 text-xs">미배정</span>
                          )
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {nurse.isActive ? (
                          <Badge variant="secondary" className="text-xs text-green-700 bg-green-100">활성</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs text-gray-400">비활성</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(nurse)} className="h-7 px-2 text-xs">
                            수정
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => handleDelete(nurse)}
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            비활성화
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400">간호사가 없습니다</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? '간호사 정보 수정' : '간호사 등록'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>이름 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="이름 입력"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>직급 *</Label>
                <Select value={form.rank} onValueChange={(v) => setForm((f) => ({ ...f, rank: v as NurseRank }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANK_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>입사연차</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.yearsOfService}
                  onChange={(e) => setForm((f) => ({ ...f, yearsOfService: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>근무 형태 *</Label>
              <Select value={form.workType} onValueChange={(v) => setForm((f) => ({ ...f, workType: v as WorkType }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>업무 역량 *</Label>
              <Select value={form.capability} onValueChange={(v) => setForm((f) => ({ ...f, capability: v as Capability }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPABILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{o.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 프리셉터 배정: 신규간호사(GN)에게만 표시 */}
            {form.rank === 'GN' && (
              <div>
                <Label>프리셉터 배정</Label>
                <p className="text-xs text-gray-400 mb-1">신규간호사와 같은 근무로 우선 배치됩니다</p>
                <Select
                  value={form.preceptorId ? String(form.preceptorId) : 'none'}
                  onValueChange={(v) => setForm((f) => ({ ...f, preceptorId: v === 'none' ? null : Number(v) }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="프리셉터 선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">배정 없음</SelectItem>
                    {preceptorCandidates.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} ({RANK_LABELS[p.rank]}, {p.yearsOfService}년차)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
