'use client';

import React from 'react';
import { ShiftCode, DailyRole } from '@/types';

interface ScheduleCellProps {
  shift: ShiftCode | null;
  role?: DailyRole;
  isViolation?: boolean;
  violationReason?: string;
  onClick?: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  isWeekend?: boolean;
  isHoliday?: boolean;
}


export default function ScheduleCell({
  shift,
  role,
  isViolation = false,
  violationReason,
  onClick,
  isDragging = false,
  isDropTarget = false,
  isWeekend = false,
  isHoliday = false,
}: ScheduleCellProps) {
  const isOff = shift === 'O';
  const bg = (isWeekend || isHoliday) ? 'bg-pink-200' : 'bg-white';
  const textColor = isOff ? 'text-red-500 font-bold' : 'text-gray-800';

  return (
    <div
      onClick={onClick}
      title={isViolation ? `⚠️ ${violationReason}` : shift || ''}
      className={`
        relative w-full h-11 flex items-center justify-center
        text-sm font-semibold cursor-pointer select-none rounded
        transition-all duration-150
        ${bg} ${textColor}
        ${isViolation ? 'ring-2 ring-red-500 ring-inset' : ''}
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isDropTarget ? 'ring-2 ring-blue-400 scale-105' : ''}
        ${onClick ? 'hover:bg-pink-300' : ''}
      `}
    >
      {shift || ''}

      {/* 위반 표시 */}
      {isViolation && (
        <span className="absolute bottom-0.5 left-0.5 text-[8px] text-red-600">⚠</span>
      )}
    </div>
  );
}
