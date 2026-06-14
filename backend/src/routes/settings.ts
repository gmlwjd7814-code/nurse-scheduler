/**
 * 병동 설정 API 라우터
 * GET /api/settings/:wardId  - 병동 설정 조회
 * PUT /api/settings/:wardId  - 병동 설정 수정
 * GET /api/settings/wards    - 병동 목록 조회
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 컬럼 추가 마이그레이션 (모듈 로드 시 1회 실행, 라우트 핸들러가 완료를 기다림)
const migrationReady = query(
  `ALTER TABLE ward_settings ADD COLUMN IF NOT EXISTS head_nurse_sat_week SMALLINT DEFAULT 1`
).catch(() => {});

// ===== 병동 목록 조회 =====
router.get(
  '/wards',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query(
      'SELECT id, name, description FROM wards ORDER BY id'
    );
    res.json({ success: true, data: result.rows });
  })
);

// ===== 병동 설정 조회 =====
router.get(
  '/:wardId',
  asyncHandler(async (req: Request, res: Response) => {
    await migrationReady;
    const { wardId } = req.params;
    const result = await query(
      `SELECT
         id, ward_id as "wardId", ward_name as "wardName",
         weekday_d_count as "weekdayDCount",
         weekday_e_count as "weekdayECount",
         weekday_n_count as "weekdayNCount",
         weekend_d_count as "weekendDCount",
         weekend_e_count as "weekendECount",
         weekend_n_count as "weekendNCount",
         monthly_off_count as "monthlyOffCount",
         max_consecutive_ne as "maxConsecutiveNE",
         COALESCE(max_consecutive_work, 6) as "maxConsecutiveWork",
         COALESCE(head_nurse_sat_week, 1) as "headNurseSatWeek",
         updated_at as "updatedAt"
       FROM ward_settings
       WHERE ward_id = $1`,
      [wardId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '병동 설정이 없습니다' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  })
);

// ===== 병동 설정 수정 =====
router.put(
  '/:wardId',
  asyncHandler(async (req: Request, res: Response) => {
    await migrationReady;
    const { wardId } = req.params;
    const {
      weekdayDCount, weekdayECount, weekdayNCount,
      weekendDCount, weekendECount, weekendNCount,
      monthlyOffCount, maxConsecutiveNE, maxConsecutiveWork,
      wardName, headNurseSatWeek,
    } = req.body;

    const result = await query(
      `UPDATE ward_settings
       SET
         ward_name            = COALESCE($1,  ward_name),
         weekday_d_count      = COALESCE($2,  weekday_d_count),
         weekday_e_count      = COALESCE($3,  weekday_e_count),
         weekday_n_count      = COALESCE($4,  weekday_n_count),
         weekend_d_count      = COALESCE($5,  weekend_d_count),
         weekend_e_count      = COALESCE($6,  weekend_e_count),
         weekend_n_count      = COALESCE($7,  weekend_n_count),
         monthly_off_count    = COALESCE($8,  monthly_off_count),
         max_consecutive_ne   = COALESCE($9,  max_consecutive_ne),
         max_consecutive_work = COALESCE($10, COALESCE(max_consecutive_work, 6)),
         head_nurse_sat_week  = COALESCE($11, COALESCE(head_nurse_sat_week, 1)),
         updated_at           = NOW()
       WHERE ward_id = $12
       RETURNING
         id, ward_id as "wardId", ward_name as "wardName",
         weekday_d_count as "weekdayDCount",
         weekday_e_count as "weekdayECount",
         weekday_n_count as "weekdayNCount",
         weekend_d_count as "weekendDCount",
         weekend_e_count as "weekendECount",
         weekend_n_count as "weekendNCount",
         monthly_off_count as "monthlyOffCount",
         max_consecutive_ne as "maxConsecutiveNE",
         COALESCE(max_consecutive_work, 6) AS "maxConsecutiveWork",
         COALESCE(head_nurse_sat_week, 1) AS "headNurseSatWeek"`,
      [
        wardName ?? null,
        weekdayDCount, weekdayECount, weekdayNCount,
        weekendDCount, weekendECount, weekendNCount,
        monthlyOffCount, maxConsecutiveNE, maxConsecutiveWork,
        headNurseSatWeek ?? null, wardId,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '병동 설정이 없습니다' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  })
);

export default router;
