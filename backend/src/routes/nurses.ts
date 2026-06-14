/**
 * 간호사 관리 API 라우터
 * GET    /api/nurses          - 간호사 목록 조회
 * GET    /api/nurses/:id      - 간호사 상세 조회
 * POST   /api/nurses          - 간호사 등록
 * PUT    /api/nurses/:id      - 간호사 정보 수정
 * DELETE /api/nurses/:id      - 간호사 비활성화
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ===== 간호사 목록 조회 =====
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { wardId, workType, isActive } = req.query;

    let sql = `
      SELECT
        n.id, n.name, n.rank,
        n.years_of_service AS "yearsOfService",
        n.work_type AS "workType",
        n.capability,
        n.is_active AS "isActive",
        n.ward_id AS "wardId",
        w.name AS "wardName",
        n.preceptor_id AS "preceptorId",
        p.name AS "preceptorName",
        n.monthly_off_override AS "monthlyOffOverride",
        n.created_at AS "createdAt"
      FROM nurses n
      JOIN wards w ON w.id = n.ward_id
      LEFT JOIN nurses p ON p.id = n.preceptor_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (wardId) {
      sql += ` AND n.ward_id = $${paramIdx++}`;
      params.push(Number(wardId));
    }
    if (workType) {
      sql += ` AND n.work_type = $${paramIdx++}`;
      params.push(workType);
    }
    if (isActive !== undefined) {
      sql += ` AND n.is_active = $${paramIdx++}`;
      params.push(isActive === 'true');
    }

    sql += ` ORDER BY
      CASE n.work_type
        WHEN 'HEAD_NURSE' THEN 1
        WHEN 'NIGHT_ONLY' THEN 2
        ELSE 3
      END,
      CASE n.rank
        WHEN 'HEAD' THEN 1
        WHEN 'CHARGE' THEN 2
        WHEN 'RN' THEN 3
        ELSE 4
      END,
      n.years_of_service DESC,
      n.name`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  })
);

// ===== 간호사 상세 조회 =====
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await query(
      `SELECT n.id, n.name, n.rank,
              n.years_of_service as "yearsOfService",
              n.work_type as "workType",
              n.capability,
              n.is_active as "isActive",
              n.ward_id as "wardId",
              w.name as "wardName"
       FROM nurses n
       JOIN wards w ON w.id = n.ward_id
       WHERE n.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '간호사를 찾을 수 없습니다' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  })
);

// ===== 간호사 등록 =====
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, rank, yearsOfService, workType, capability, wardId } = req.body;

    if (!name || !rank || !workType || !capability || !wardId) {
      res.status(400).json({
        success: false,
        error: '필수 항목 누락: name, rank, workType, capability, wardId',
      });
      return;
    }

    const { preceptorId } = req.body;
    const result = await query(
      `INSERT INTO nurses (name, rank, years_of_service, work_type, capability, ward_id, preceptor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, rank,
                 years_of_service AS "yearsOfService",
                 work_type AS "workType",
                 capability,
                 is_active AS "isActive",
                 ward_id AS "wardId",
                 preceptor_id AS "preceptorId"`,
      [name, rank, yearsOfService || 0, workType, capability, wardId, preceptorId || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

// ===== 간호사 정보 수정 =====
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, rank, yearsOfService, workType, capability, wardId, isActive, preceptorId, monthlyOffOverride } = req.body;

    const result = await query(
      `UPDATE nurses
       SET name                 = COALESCE($1, name),
           rank                 = COALESCE($2, rank),
           years_of_service     = COALESCE($3, years_of_service),
           work_type            = COALESCE($4, work_type),
           capability           = COALESCE($5, capability),
           ward_id              = COALESCE($6, ward_id),
           is_active            = COALESCE($7, is_active),
           preceptor_id         = $8,
           monthly_off_override = $9,
           updated_at           = NOW()
       WHERE id = $10
       RETURNING id, name, rank,
                 years_of_service AS "yearsOfService",
                 work_type AS "workType",
                 capability,
                 is_active AS "isActive",
                 ward_id AS "wardId",
                 preceptor_id AS "preceptorId",
                 monthly_off_override AS "monthlyOffOverride"`,
      [name, rank, yearsOfService, workType, capability, wardId, isActive, preceptorId ?? null, monthlyOffOverride ?? null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '간호사를 찾을 수 없습니다' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  })
);

// ===== 간호사 비활성화 (soft delete) =====
router.patch(
  '/:id/deactivate',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await query(
      `UPDATE nurses SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    res.json({ success: true, message: '간호사가 비활성화되었습니다' });
  })
);

// ===== 간호사 영구 삭제 (hard delete) =====
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await query(`DELETE FROM shift_requests WHERE nurse_id = $1`, [id]);
    await query(`DELETE FROM schedule_entries WHERE nurse_id = $1`, [id]);
    await query(`UPDATE nurses SET preceptor_id = NULL WHERE preceptor_id = $1`, [id]);
    const result = await query(`DELETE FROM nurses WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '간호사를 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, message: '간호사가 삭제되었습니다' });
  })
);

export default router;
