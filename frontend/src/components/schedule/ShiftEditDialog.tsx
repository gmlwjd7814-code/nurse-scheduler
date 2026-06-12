'use client';

/**
 * 근무 수정 다이얼로그
 * 셀 클릭 시 표시되며 근무 코드를 선택할 수 있습니다
 */

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShiftCode, SHIFT_BG_COLORS, SHIFT_TEXT_COLORS, SHIFT_LABELS } from '@/types';

interface ShiftEditDialogProps {
  nurseName: string;
  day: number;
  month: number;
  currentShift: ShiftCode;
  onConfirm: (shift: ShiftCode) => void;
  onClose: () => void;
}

const ALL_SHIFTS: ShiftCode[] = [
  'D', 'E', 'N', 'M', 'Y', 'H', 'YH', 'O', 'V', 'I', 'CB', 'C', 'NE'
];

export default function ShiftEditDialog({
  nurseName, day, month, currentShift, onConfirm, onClose
}: ShiftEditDialogProps) {
  const [selected, setSelected] = useState<ShiftCode>(currentShift);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {nurseName} — {month}월 {day}일 근무 수정
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-gray-500 mb-3">변경할 근무를 선택하세요</p>

          {/* 근무 선택 그리드 */}
          <div className="grid grid-cols-4 gap-2">
            {ALL_SHIFTS.map((shift) => {
              const bg = SHIFT_BG_COLORS[shift];
              const textCls = SHIFT_TEXT_COLORS[shift] || 'text-gray-900';
              const isSelected = selected === shift;

              return (
                <button
                  key={shift}
                  onClick={() => setSelected(shift)}
                  className={`
                    py-2 rounded-md text-sm font-semibold transition-all
                    ${bg} ${textCls}
                    ${isSelected ? 'ring-2 ring-offset-1 ring-blue-500 scale-105' : 'opacity-70 hover:opacity-100'}
                  `}
                >
                  <div>{shift}</div>
                  <div className="text-[10px] font-normal mt-0.5">{SHIFT_LABELS[shift]}</div>
                </button>
              );
            })}
          </div>

          {selected !== currentShift && (
            <p className="mt-3 text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded-md">
              {currentShift} → <strong>{selected}</strong> 으로 변경됩니다.
              저장 시 규칙 위반 여부를 자동으로 확인합니다.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={() => onConfirm(selected)}
            disabled={selected === currentShift}
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
