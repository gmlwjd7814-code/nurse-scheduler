/**
 * Nurse Scheduler AI - Express 메인 서버
 * 포트: 3001 (기본값)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { testConnection } from './database/connection';
import { errorHandler } from './middleware/errorHandler';

import nursesRouter from './routes/nurses';
import scheduleRouter from './routes/schedule';
import settingsRouter from './routes/settings';
import statsRouter from './routes/stats';

// 환경변수 로드
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ===== 미들웨어 설정 =====
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== 요청 로깅 (개발 환경) =====
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ===== API 라우터 등록 =====
app.use('/api/nurses', nursesRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stats', statsRouter);

// 헬스체크
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== 전역 에러 핸들러 =====
app.use(errorHandler);

// ===== 서버 시작 =====
async function startServer(): Promise<void> {
  console.log('🏥 Nurse Scheduler AI 서버 시작 중...\n');

  // DB 연결 확인
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ 데이터베이스 연결 실패. 서버를 종료합니다.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n✅ 서버 실행 중: http://localhost:${PORT}`);
    console.log(`📋 API 목록:`);
    console.log(`   GET  /api/nurses`);
    console.log(`   POST /api/schedule/generate`);
    console.log(`   GET  /api/schedule/:wardId/:year/:month`);
    console.log(`   PUT  /api/schedule/entry/:id`);
    console.log(`   GET  /api/settings/:wardId`);
    console.log(`   GET  /api/stats/:wardId/:year/:month`);
    console.log(`   GET  /api/health`);
    console.log('\n💡 프론트엔드: http://localhost:3000\n');
  });
}

startServer();
