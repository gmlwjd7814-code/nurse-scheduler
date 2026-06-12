/**
 * Express 전역 에러 핸들러
 * 모든 라우트에서 발생하는 에러를 통합 처리합니다
 */

import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[오류] ${req.method} ${req.path}:`, err.message);

  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: '입력값 검증 오류',
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: '서버 내부 오류',
    message: process.env.NODE_ENV === 'development' ? err.message : '서버 오류가 발생했습니다',
  });
}

// 비동기 라우트 에러 처리 래퍼
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
