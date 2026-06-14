import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { errorHandler } from '../src/middleware/errorHandler';
import { query } from '../src/database/connection';
import nursesRouter from '../src/routes/nurses';
import scheduleRouter from '../src/routes/schedule';
import settingsRouter from '../src/routes/settings';
import statsRouter from '../src/routes/stats';
import holidaysRouter from '../src/routes/holidays';

dotenv.config();

// DB 자동 마이그레이션 (컬럼 추가)
query(`ALTER TABLE ward_settings ADD COLUMN IF NOT EXISTS head_nurse_sat_week SMALLINT DEFAULT 1`).catch(() => {});

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/nurses', nursesRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/holidays', holidaysRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

export default app;
