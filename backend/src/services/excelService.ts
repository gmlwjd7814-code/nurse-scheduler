/**
 * Excel 내보내기 서비스
 * exceljs를 사용하여 근무표를 Excel 파일로 생성합니다
 */

import ExcelJS from 'exceljs';
import { ScheduleEntry, Nurse, ShiftCode } from '../types';

// 근무 코드별 셀 색상 (배경색)
const SHIFT_COLORS: Record<ShiftCode, string> = {
  D: 'ADD8E6',   // 하늘색
  E: 'FFFF00',   // 노란색
  N: 'DDA0DD',   // 보라색 (Plum)
  M: 'FFFFFF',   // 흰색
  Y: '90EE90',   // 연두색 (Light Green)
  H: '98FB98',   // 연한 초록 (Pale Green)
  YH: '32CD32',  // 라임 그린
  O: 'D3D3D3',   // 회색
  V: 'FFA07A',   // 연어색
  I: 'F0E68C',   // 카키
  CB: 'FFA500',  // 주황색
  C: 'FF6347',   // 토마토
  NE: '000080',  // 진한 남색 (Navy)
};

// NE는 배경이 짙어서 글씨를 흰색으로
const SHIFT_FONT_COLORS: Partial<Record<ShiftCode, string>> = {
  NE: 'FFFFFF',
  N: '000000',
};

export async function generateExcel(
  nurses: Nurse[],
  entries: ScheduleEntry[],
  year: number,
  month: number,
  wardName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const daysInMonth = new Date(year, month, 0).getDate();

  // ===== 근무표 시트 =====
  const sheet = workbook.addWorksheet(`${year}년 ${month}월 근무표`, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // 헤더 행 설정
  const headerRow1 = sheet.getRow(1);
  sheet.mergeCells(1, 1, 1, daysInMonth + 2);
  headerRow1.getCell(1).value = `${wardName} ${year}년 ${month}월 근무표`;
  headerRow1.getCell(1).font = { bold: true, size: 14 };
  headerRow1.getCell(1).alignment = { horizontal: 'center' };

  const headerRow2 = sheet.getRow(2);
  headerRow2.getCell(1).value = '이름';
  headerRow2.getCell(2).value = '직급';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    const cell = headerRow2.getCell(d + 2);
    cell.value = `${d}\n${dayOfWeek}`;
    cell.alignment = { horizontal: 'center', wrapText: true };

    // 주말/일요일 헤더 색상
    if (date.getDay() === 0) {
      cell.font = { color: { argb: 'FFFF0000' } }; // 빨간색 (일요일)
    } else if (date.getDay() === 6) {
      cell.font = { color: { argb: 'FF0000FF' } }; // 파란색 (토요일)
    }
  }

  // 헤더 행 스타일
  headerRow2.font = { bold: true };
  headerRow2.height = 30;
  headerRow2.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
  });

  // rank 한글 변환
  const rankKr: Record<string, string> = {
    HEAD: '수간호사',
    CHARGE: '책임',
    RN: '일반',
    GN: '신규',
  };

  // 간호사별 근무 데이터 매핑
  const entryMap = new Map<string, ShiftCode>();
  const violationMap = new Map<string, boolean>();
  for (const entry of entries) {
    entryMap.set(`${entry.nurseId}-${entry.day}`, entry.shift);
    violationMap.set(`${entry.nurseId}-${entry.day}`, entry.isViolation);
  }

  // 데이터 행 삽입
  nurses.forEach((nurse, rowIdx) => {
    const row = sheet.getRow(rowIdx + 3);
    row.getCell(1).value = nurse.name;
    row.getCell(2).value = rankKr[nurse.rank] || nurse.rank;

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${nurse.id}-${d}`;
      const shift = entryMap.get(key) || '';
      const isViolation = violationMap.get(key) || false;
      const cell = row.getCell(d + 2);

      cell.value = shift;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (shift && SHIFT_COLORS[shift as ShiftCode]) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${SHIFT_COLORS[shift as ShiftCode]}` },
        };
      }

      // 폰트 색상 설정
      const fontColor = SHIFT_FONT_COLORS[shift as ShiftCode] || '000000';
      cell.font = { color: { argb: `FF${fontColor}` } };

      // 위반 시 빨간 테두리
      if (isViolation) {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FFFF0000' } },
          left: { style: 'medium', color: { argb: 'FFFF0000' } },
          bottom: { style: 'medium', color: { argb: 'FFFF0000' } },
          right: { style: 'medium', color: { argb: 'FFFF0000' } },
        };
      } else {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }

    // 이름/직급 셀 테두리
    row.getCell(1).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    row.getCell(2).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // 열 너비 설정
  sheet.getColumn(1).width = 10; // 이름
  sheet.getColumn(2).width = 7;  // 직급
  for (let d = 3; d <= daysInMonth + 2; d++) {
    sheet.getColumn(d).width = 5;
  }

  // ===== 범례 시트 =====
  const legendSheet = workbook.addWorksheet('범례');
  legendSheet.getCell('A1').value = '근무 코드 범례';
  legendSheet.getCell('A1').font = { bold: true, size: 13 };

  const legends: [ShiftCode, string][] = [
    ['D', '낮근무'],
    ['E', '저녁근무'],
    ['N', '야간근무'],
    ['M', '상근근무'],
    ['Y', '연차'],
    ['H', '반차'],
    ['YH', '연차반차'],
    ['O', '오프'],
    ['V', '경조휴가'],
    ['I', '공가'],
    ['CB', '콜백'],
    ['C', '당직근무'],
    ['NE', '야간전담근무'],
  ];

  legends.forEach(([code, desc], i) => {
    const row = legendSheet.getRow(i + 3);
    const codeCell = row.getCell(1);
    const descCell = row.getCell(2);
    codeCell.value = code;
    descCell.value = desc;
    codeCell.alignment = { horizontal: 'center' };

    if (SHIFT_COLORS[code]) {
      codeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${SHIFT_COLORS[code]}` },
      };
    }
    const fontColor = SHIFT_FONT_COLORS[code] || '000000';
    codeCell.font = { bold: true, color: { argb: `FF${fontColor}` } };
  });

  // Buffer로 변환
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
