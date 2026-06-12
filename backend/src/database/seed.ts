/**
 * 샘플 데이터 삽입 스크립트
 * 30명의 간호사 샘플 데이터를 생성합니다
 * 실행: npx ts-node src/database/seed.ts
 */

import pool, { testConnection } from './connection';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// ===== 30명의 간호사 샘플 데이터 =====
// 구성: 수간호사 1명, 야간전담 4명, 일반 3교대 25명
const nursesData = [
  // ---- 수간호사 (1명) ----
  {
    name: '김정숙',
    rank: 'HEAD',
    yearsOfService: 20,
    workType: 'HEAD_NURSE',
    capability: 'Desk',
  },

  // ---- 책임간호사 - 일반 3교대 (5명) ----
  {
    name: '이민정',
    rank: 'CHARGE',
    yearsOfService: 12,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '박지현',
    rank: 'CHARGE',
    yearsOfService: 10,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '최수진',
    rank: 'CHARGE',
    yearsOfService: 11,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '정유나',
    rank: 'CHARGE',
    yearsOfService: 9,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '강혜원',
    rank: 'CHARGE',
    yearsOfService: 8,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },

  // ---- 일반간호사 - Desk 역량 (8명) ----
  {
    name: '윤서연',
    rank: 'RN',
    yearsOfService: 7,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '임채원',
    rank: 'RN',
    yearsOfService: 6,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '한지은',
    rank: 'RN',
    yearsOfService: 5,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '오미래',
    rank: 'RN',
    yearsOfService: 5,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '신보라',
    rank: 'RN',
    yearsOfService: 4,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '류하은',
    rank: 'RN',
    yearsOfService: 4,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '전나연',
    rank: 'RN',
    yearsOfService: 3,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },
  {
    name: '조아름',
    rank: 'RN',
    yearsOfService: 3,
    workType: 'THREE_SHIFT',
    capability: 'Desk',
  },

  // ---- 일반간호사 - SubDesk 역량 (8명) ----
  {
    name: '서현주',
    rank: 'RN',
    yearsOfService: 3,
    workType: 'THREE_SHIFT',
    capability: 'SubDesk',
  },
  {
    name: '배소영',
    rank: 'RN',
    yearsOfService: 2,
    workType: 'THREE_SHIFT',
    capability: 'SubDesk',
  },
  {
    name: '노지희',
    rank: 'RN',
    yearsOfService: 2,
    workType: 'THREE_SHIFT',
    capability: 'SubDesk',
  },
  {
    name: '남은지',
    rank: 'RN',
    yearsOfService: 2,
    workType: 'THREE_SHIFT',
    capability: 'SubDesk',
  },
  {
    name: '문수빈',
    rank: 'RN',
    yearsOfService: 2,
    workType: 'THREE_SHIFT',
    capability: 'SubDesk',
  },
  {
    name: '안다혜',
    rank: 'RN',
    yearsOfService: 1,
    workType: 'THREE_SHIFT',
    capability: 'SubDesk',
  },
  {
    name: '장예지',
    rank: 'RN',
    yearsOfService: 1,
    workType: 'THREE_SHIFT',
    capability: 'SubDesk',
  },
  {
    name: '황민경',
    rank: 'RN',
    yearsOfService: 1,
    workType: 'THREE_SHIFT',
    capability: 'SubDesk',
  },

  // ---- 신규간호사 - Acting 역량 (4명) ----
  {
    name: '권지아',
    rank: 'GN',
    yearsOfService: 0,
    workType: 'THREE_SHIFT',
    capability: 'Acting',
  },
  {
    name: '홍세연',
    rank: 'GN',
    yearsOfService: 0,
    workType: 'THREE_SHIFT',
    capability: 'Acting',
  },
  {
    name: '심다은',
    rank: 'GN',
    yearsOfService: 0,
    workType: 'THREE_SHIFT',
    capability: 'Acting',
  },
  {
    name: '방수경',
    rank: 'GN',
    yearsOfService: 0,
    workType: 'THREE_SHIFT',
    capability: 'Acting',
  },

  // ---- 야간전담 간호사 (4명) ----
  {
    name: '고은비',
    rank: 'RN',
    yearsOfService: 5,
    workType: 'NIGHT_ONLY',
    capability: 'SubDesk',
  },
  {
    name: '마지현',
    rank: 'RN',
    yearsOfService: 4,
    workType: 'NIGHT_ONLY',
    capability: 'SubDesk',
  },
  {
    name: '유선영',
    rank: 'RN',
    yearsOfService: 3,
    workType: 'NIGHT_ONLY',
    capability: 'Acting',
  },
  {
    name: '표혜진',
    rank: 'RN',
    yearsOfService: 2,
    workType: 'NIGHT_ONLY',
    capability: 'Acting',
  },
];

async function seedDatabase(): Promise<void> {
  console.log('🌱 샘플 데이터 삽입 시작...');

  const connected = await testConnection();
  if (!connected) {
    console.error('데이터베이스에 연결할 수 없습니다.');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 기존 샘플 데이터 제거 (재실행 시 중복 방지)
    await client.query('DELETE FROM schedule_entries');
    await client.query('DELETE FROM schedules');
    await client.query('DELETE FROM shift_requests');
    await client.query('DELETE FROM nurses');
    await client.query('DELETE FROM holidays');
    console.log('🗑️  기존 데이터 제거 완료');

    // 간호사 데이터 삽입 (preceptor_id 없이 먼저 삽입)
    for (const nurse of nursesData) {
      await client.query(
        `INSERT INTO nurses (name, rank, years_of_service, work_type, capability, ward_id)
         VALUES ($1, $2, $3, $4, $5, 1)`,
        [nurse.name, nurse.rank, nurse.yearsOfService, nurse.workType, nurse.capability]
      );
    }
    console.log(`✅ ${nursesData.length}명의 간호사 데이터 삽입 완료`);

    // ===== 신규간호사 프리셉터 배정 =====
    // 프리셉터: 책임급 이상 중 경력자 배정
    const preceptorPairs: [string, string][] = [
      // [신규간호사 이름, 프리셉터 이름]
      ['권지아', '이민정'],   // 책임간호사 12년차
      ['홍세연', '박지현'],   // 책임간호사 10년차
      ['심다은', '최수진'],   // 책임간호사 11년차
      ['방수경', '정유나'],   // 책임간호사 9년차
    ];
    for (const [gnName, preceptorName] of preceptorPairs) {
      await client.query(
        `UPDATE nurses
         SET preceptor_id = (SELECT id FROM nurses WHERE name = $1 LIMIT 1)
         WHERE name = $2`,
        [preceptorName, gnName]
      );
    }
    console.log('✅ 신규간호사 프리셉터 배정 완료');

    // 샘플 희망 오프 신청 (2026년 6월)
    const nurseRows = await client.query(
      'SELECT id, name FROM nurses ORDER BY id LIMIT 10'
    );
    const sampleRequests = [
      { day: 7,  shift: 'O' },
      { day: 14, shift: 'Y' },
      { day: 21, shift: 'O' },
      { day: 28, shift: 'O' },
    ];
    for (let i = 0; i < Math.min(nurseRows.rows.length, 5); i++) {
      const nurse = nurseRows.rows[i];
      const req = sampleRequests[i % sampleRequests.length];
      await client.query(
        `INSERT INTO shift_requests (nurse_id, year, month, day, requested_shift)
         VALUES ($1, 2026, 6, $2, $3)
         ON CONFLICT (nurse_id, year, month, day) DO NOTHING`,
        [nurse.id, req.day, req.shift]
      );
    }
    console.log('✅ 샘플 희망 오프 신청 완료');

    // ===== 2026년 대한민국 공휴일 (대체공휴일 포함) =====
    const holidays2026 = [
      // 기본 공휴일
      { month: 1,  day: 1,  name: '신정' },
      { month: 1,  day: 28, name: '설날 연휴' },
      { month: 1,  day: 29, name: '설날' },
      { month: 1,  day: 30, name: '설날 연휴' },
      { month: 3,  day: 1,  name: '삼일절' },
      { month: 3,  day: 2,  name: '삼일절 대체공휴일' },   // 3/1 일→월
      { month: 5,  day: 5,  name: '어린이날' },
      { month: 5,  day: 25, name: '부처님오신날' },
      { month: 6,  day: 3,  name: '지방선거일' },           // 임시공휴일
      { month: 6,  day: 6,  name: '현충일' },
      { month: 6,  day: 8,  name: '현충일 대체공휴일' },    // 6/6 토→월
      { month: 7,  day: 17, name: '제헌절' },
      { month: 8,  day: 15, name: '광복절' },
      { month: 8,  day: 17, name: '광복절 대체공휴일' },    // 8/15 토→월
      { month: 9,  day: 24, name: '추석 연휴' },
      { month: 9,  day: 25, name: '추석' },
      { month: 9,  day: 26, name: '추석 연휴' },
      { month: 9,  day: 28, name: '추석 대체공휴일' },      // 9/26 토→월
      { month: 10, day: 3,  name: '개천절' },
      { month: 10, day: 5,  name: '개천절 대체공휴일' },    // 10/3 토→월
      { month: 10, day: 9,  name: '한글날' },
      { month: 12, day: 25, name: '크리스마스' },
    ];
    for (const h of holidays2026) {
      await client.query(
        `INSERT INTO holidays (year, month, day, name) VALUES (2026, $1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [h.month, h.day, h.name]
      );
    }
    console.log(`✅ 2026년 공휴일 ${holidays2026.length}개 삽입 완료`);

    await client.query('COMMIT');

    // 삽입된 간호사 통계 출력
    const stats = await client.query(`
      SELECT work_type, capability, COUNT(*) as count
      FROM nurses
      GROUP BY work_type, capability
      ORDER BY work_type, capability
    `);
    console.log('\n📊 간호사 현황:');
    for (const row of stats.rows) {
      const workTypeKr =
        row.work_type === 'HEAD_NURSE' ? '수간호사'
        : row.work_type === 'NIGHT_ONLY' ? '야간전담'
        : '일반 3교대';
      console.log(
        `  ${workTypeKr} | ${row.capability} | ${row.count}명`
      );
    }
    console.log('\n🎉 샘플 데이터 삽입 완료!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 데이터 삽입 실패:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
