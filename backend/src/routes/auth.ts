/**
 * 인증 API 라우터
 * POST /api/auth/login  - 로그인 (username + password → JWT)
 * GET  /api/auth/me     - 현재 로그인 사용자 정보
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, JWT_SECRET, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// ===== 로그인 =====
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'username과 password를 입력해주세요' });
      return;
    }

    const result = await query(
      `SELECT id, name, username, password_hash FROM wards WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다' });
      return;
    }

    const ward = result.rows[0];

    if (!ward.password_hash) {
      res.status(401).json({ success: false, error: '비밀번호가 설정되지 않은 계정입니다. 관리자에게 문의하세요' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, ward.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다' });
      return;
    }

    const token = jwt.sign(
      { wardId: ward.id, wardName: ward.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        wardId: ward.id,
        wardName: ward.name,
      },
    });
  })
);

// ===== 현재 사용자 정보 =====
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        wardId: req.wardId,
        wardName: req.wardName,
      },
    });
  })
);

export default router;
