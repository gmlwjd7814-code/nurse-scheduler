/**
 * 통계 API 라우터 v2
 * - 개인별 근무 횟수, 역할 횟수, 주말/공휴일 근무
 * - 총 근무시간 자동 계산 (D/E=8h, N/NE=10h, CB=4h)
 * - 위반 건수 포함
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';
import { ShiftCode, SHIFT_HOURS } from '../types';

const router = Router();

// 근무 시간 계산
function calcHours(shiftCounts: Record<ShiftCode, number>): number {
  let hours = 0;
  for (const [shift, count] of Object.entries(shiftCounts)) {
    hours += (SHIFT_HOURS[shift as ShiftCode] ?? 0) * count;
  }
  return hours;
}

// ===== 월별 통계 조회 =====
router.get(
  '/:wardId/:year/:month',
  asyncHandler(async (req: Request, res: Response) => {
    const { wardId, year, month } = req.params;

    const scheduleResult = await query(
      'SELECT id FROM schedules WHERE ward_id = $1 AND year = $2 AND month = $3',
      [wardId, year, month]
    );

    if (scheduleResult.rows.length === 0) {
      res.json({ success: true, data: [], message: '근무표가 없습니다' });
      return;
    }

    const scheduleId = scheduleResult.rows[0].id;

    // 기본 근무 횟수 집계
    const result = await query(
      `SELECT
         n.id AS "nurseId",
         n.name AS "nurseName",
         n.rank,
         n.work_type AS "workType",
         COUNT(CASE WHEN se.shift = 'D'  THEN 1 END)::int AS "dCount",
         COUNT(CASE WHEN se.shift = 'E'  THEN 1 END)::int AS "eCount",
         COUNT(CASE WHEN se.shift = 'N'  THEN 1 END)::int AS "nCount",
         COUNT(CASE WHEN se.shift = 'NE' THEN 1 END)::int AS "neCount",
         COUNT(CASE WHEN se.shift = 'O'  THEN 1 END)::int AS "oCount",
         COUNT(CASE WHEN se.shift = 'Y'  THEN 1 END)::int AS "yCount",
         COUNT(CASE WHEN se.shift = 'H'  THEN 1 END)::int AS "hCount",
         COUNT(CASE WHEN se.shift = 'CB' THEN 1 END)::int AS "cbCount",
         COUNT(CASE WHEN se.shift = 'M'  THEN 1 END)::int AS "mCount",
         COUNT(CASE WHEN se.shift = 'C'  THEN 1 END)::int AS "cCount",
         COUNT(CASE WHEN se.role = 'Desk'    THEN 1 END)::int AS "deskCount",
         COUNT(CASE WHEN se.role = 'SubDesk' THEN 1 END)::int AS "subDeskCount",
         COUNT(CASE WHEN se.role = 'Acting'  THEN 1 END)::int AS "actingCount",
         COALESCE(SUM(CASE WHEN se.is_violation THEN 1 ELSE 0 END), 0)::int AS "violationCount",
         BOOL_OR(se.is_violation) AS "hasViolation"
       FROM nurses n
       LEFT JOIN schedule_entries se ON se.nurse_id = n.id AND se.schedule_id = $1
       WHERE n.ward_id = $2 AND n.is_active = true
       GROUP BY n.id, n.name, n.rank, n.work_type
       ORDER BY
         CASE n.work_type WHEN 'HEAD_NURSE' THEN 1 WHEN 'NIGHT_ONLY' THEN 2 ELSE 3 END,
         CASE n.rank WHEN 'HEAD' THEN 1 WHEN 'CHARGE' THEN 2 WHEN 'RN' THEN 3 ELSE 4 END,
         n.years_of_service DESC`,
      [scheduleId, wardId]
    );

    // 주말 / 공휴일 근무 통계 (날짜 기반 별도 집계)
    const datePrefix = `${year}-${String(month).padStart(2, '0')}`;
    const weekendResult = await query(
      `SELECT
         se.nurse_id AS "nurseId",
         COUNT(CASE WHEN se.shift NOT IN ('O','Y','H','YH','V','I') THEN 1 END)::int AS "weekendWorkCount",
         COUNT(CASE WHEN se.shift IN ('O','Y','H','YH') THEN 1 END)::int AS "weekendOffCount"
       FROM schedule_entries se
       WHERE se.schedule_id = $1
         AND EXTRACT(DOW FROM ($2::text || '-' || LPAD(se.day::text,2,'0'))::date) IN (0,6)
       GROUP BY se.nurse_id`,
      [scheduleId, datePrefix]
    );

    // 공휴일 근무 집계
    const holidayResult = await query(
      `SELECT
         se.nurse_id AS "nurseId",
         COUNT(CASE WHEN se.shift NOT IN ('O','Y','H','YH','V','I') THEN 1 END)::int AS "holidayWorkCount"
       FROM schedule_entries se
       JOIN holidays h ON h.year = $2 AND h.month = $3 AND h.day = se.day
       WHERE se.schedule_id = $1
       GROUP BY se.nurse_id`,
      [scheduleId, year, month]
    );

    // 맵 변환
    const weekendMap = new Map<number, { weekendWorkCount: number; weekendOffCount: number }>();
    for (const r of weekendResult.rows) {
      weekendMap.set(Number(r.nurseId), {
        weekendWorkCount: r.weekendWorkCount,
        weekendOffCount: r.weekendOffCount,
      });
    }
    const holidayMap = new Map<number, number>();
    for (const r of holidayResult.rows) {
      holidayMap.set(Number(r.nurseId), r.holidayWorkCount);
    }

    // 결합 및 근무시간 계산
    const stats = result.rows.map((row) => {
      const nurseId = Number(row.nurseId);
      const we = weekendMap.get(nurseId) ?? { weekendWorkCount: 0, weekendOffCount: 0 };
      const holidayWork = holidayMap.get(nurseId) ?? 0;

      const d = row.dCount, e = row.eCount, n = row.nCount, ne = row.neCount;
      const cb = row.cbCount, m = row.mCount, c = row.cCount;
      const totalWorkCount = d + e + n + ne + cb + m + c;
      const totalWorkHours =
        d * 8 + e * 8 + n * 10 + ne * 10 + cb * 4 + m * 8 + c * 8;

      return {
        nurseId: row.nurseId,
        nurseName: row.nurseName,
        rank: row.rank,
        workType: row.workType,
        dCount: d,
        eCount: e,
        nCount: n,
        neCount: ne,
        oCount: row.oCount,
        yCount: row.yCount,
        hCount: row.hCount,
        cbCount: cb,
        weekendWorkCount: we.weekendWorkCount,
        weekendOffCount: we.weekendOffCount,
        holidayWorkCount: holidayWork,
        totalWorkCount,
        totalWorkHours,
        deskCount: row.deskCount,
        subDeskCount: row.subDeskCount,
        actingCount: row.actingCount,
        hasViolation: row.hasViolation ?? false,
        violationCount: row.violationCount,
      };
    });

    res.json({ success: true, data: stats });
  })
);

export default router;
