/**
 * 데이터베이스 초기화 스크립트
 * schema.sql을 읽어서 테이블을 생성합니다
 * 실행: npx ts-node src/database/init.ts
 */

import fs from 'fs';
import path from 'path';
import pool, { testConnection } from './connection';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function initDatabase(): Promise<void> {
  console.log('🚀 데이터베이스 초기화 시작...');

  // 연결 확인
  const connected = await testConnection();
  if (!connected) {
    console.error('데이터베이스에 연결할 수 없습니다.');
    process.exit(1);
  }

  try {
    // schema.sql 파일 읽기
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📋 스키마 파일 실행 중...');
    await pool.query(schemaSql);
    console.log('✅ 테이블 생성 완료');

    console.log('\n✅ 데이터베이스 초기화 완료!');
    console.log('다음 단계: npx ts-node src/database/seed.ts 실행하여 샘플 데이터를 삽입하세요.');
  } catch (error) {
    console.error('❌ 초기화 실패:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

initDatabase();
