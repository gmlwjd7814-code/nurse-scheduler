/**
 * 공휴일 API 라우터
 * GET    /api/holidays?year=2026        - 연도별 공휴일 목록
 * POST   /api/holidays                  - 공휴일 추가
 * DELETE /api/holidays/:id              - 공휴일 삭제
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const result = await query(
      'SELECT id, year, month, day, name FROM holidays WHERE year = $1 ORDER BY month, day',
      [year]
    );
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { year, month, day, name } = req.body;
    if (!year || !month || !day || !name) {
      res.status(400).json({ success: false, error: 'year, month, day, name은 필수입니다' });
      return;
    }
    const existing = await query(
      'SELECT id FROM holidays WHERE year = $1 AND month = $2 AND day = $3',
      [year, month, day]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: '이미 등록된 날짜입니다' });
      return;
    }
    const result = await query(
      'INSERT INTO holidays (year, month, day, name) VALUES ($1, $2, $3, $4) RETURNING *',
      [year, month, day, name]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await query('DELETE FROM holidays WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '공휴일을 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, data: null });
  })
);

export default router;
