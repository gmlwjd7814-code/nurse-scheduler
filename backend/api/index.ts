import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import { errorHandler } from '../src/middleware/errorHandler';
import { query } from '../src/database/connection';
import { requireAuth } from '../src/middleware/authMiddleware';
import nursesRouter from '../src/routes/nurses';
import scheduleRouter from '../src/routes/schedule';
import settingsRouter from '../src/routes/settings';
import statsRouter from '../src/routes/stats';
import holidaysRouter from '../src/routes/holidays';
import authRouter from '../src/routes/auth';

dotenv.config();

// DB 자동 마이그레이션 (컬럼 추가 + 기본 자격증명 설정)
async function runMigrations() {
  // 기존 마이그레이션
  await query(`ALTER TABLE ward_settings ADD COLUMN IF NOT EXISTS head_nurse_sat_week SMALLINT DEFAULT 1`).catch(() => {});

  // wards 테이블에 인증 컬럼 추가
  await query(`ALTER TABLE wards ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE`).catch(() => {});
  await query(`ALTER TABLE wards ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`).catch(() => {});

  // username이 없는 기존 병동에 기본 자격증명 설정 (username = 'ward' + id, password = '1234')
  try {
    const wardsResult = await query(
      `SELECT id FROM wards WHERE username IS NULL`
    );
    for (const ward of wardsResult.rows) {
      const defaultUsername = `ward${ward.id}`;
      const defaultPasswordHash = bcrypt.hashSync('1234', 10);
      await query(
        `UPDATE wards SET username = $1, password_hash = $2 WHERE id = $3 AND username IS NULL`,
        [defaultUsername, defaultPasswordHash, ward.id]
      );
    }
    if (wardsResult.rows.length > 0) {
      console.log(`[마이그레이션] ${wardsResult.rows.length}개 병동 기본 자격증명 설정 완료`);
    }
  } catch (err) {
    console.error('[마이그레이션] 기본 자격증명 설정 실패:', err);
  }
}

runMigrations().catch(console.error);

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 인증이 필요없는 공개 라우트
app.use('/api/auth', authRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 이하 모든 라우트는 JWT 인증 필요
app.use(requireAuth);

app.use('/api/nurses', nursesRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/holidays', holidaysRouter);

app.use(errorHandler);

export default app;
