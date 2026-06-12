/**
 * PostgreSQL 데이터베이스 연결 설정
 * pg 라이브러리의 Pool을 사용하여 연결 풀을 관리합니다
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isProduction ? 3 : 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// 연결 오류 이벤트 처리
pool.on('error', (err) => {
  console.error('데이터베이스 연결 오류:', err);
});

// 연결 테스트 함수
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ 데이터베이스 연결 성공');
    return true;
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    return false;
  }
}

// 쿼리 실행 헬퍼 함수
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const result = await pool.query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount };
}

export default pool;
