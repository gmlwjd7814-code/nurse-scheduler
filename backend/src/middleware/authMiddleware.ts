/**
 * JWT 인증 미들웨어
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'nurse-scheduler-secret-key';

export interface AuthRequest extends Request {
  wardId?: number;
  wardName?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    res.status(401).json({ success: false, error: '로그인이 필요합니다' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { wardId: number; wardName: string };
    req.wardId = payload.wardId;
    req.wardName = payload.wardName;
    next();
  } catch {
    res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다' });
  }
}
