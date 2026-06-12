-- ============================================================
-- 간호사 근무표 시스템 데이터베이스 스키마
-- PostgreSQL 기준
-- ============================================================

-- 기존 테이블 제거 (개발 환경에서만 사용)
DROP TABLE IF EXISTS schedule_entries CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS shift_requests CASCADE;
DROP TABLE IF EXISTS ward_settings CASCADE;
DROP TABLE IF EXISTS nurses CASCADE;
DROP TABLE IF EXISTS wards CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;

-- ============================================================
-- 병동(ward) 테이블
-- ============================================================
CREATE TABLE wards (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,       -- 병동 이름 (예: 내과 병동, 외과 병동)
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 공휴일 테이블
-- ============================================================
CREATE TABLE holidays (
  id    SERIAL PRIMARY KEY,
  year  INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day   INTEGER NOT NULL,
  name  VARCHAR(100) NOT NULL,           -- 공휴일 이름
  UNIQUE (year, month, day)
);

-- ============================================================
-- 간호사(nurse) 테이블
-- ============================================================
CREATE TABLE nurses (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(50) NOT NULL,
  rank             VARCHAR(20) NOT NULL
                   CHECK (rank IN ('HEAD', 'CHARGE', 'RN', 'GN')),
  years_of_service INTEGER NOT NULL DEFAULT 0,  -- 입사연차
  work_type        VARCHAR(20) NOT NULL
                   CHECK (work_type IN ('THREE_SHIFT', 'NIGHT_ONLY', 'HEAD_NURSE')),
  capability       VARCHAR(20) NOT NULL
                   CHECK (capability IN ('Desk', 'SubDesk', 'Acting')),
                   -- Desk: 최고 역량 (Desk, SubDesk, Acting 모두 가능)
                   -- SubDesk: SubDesk, Acting 가능
                   -- Acting: Acting만 가능
  preceptor_id     INTEGER REFERENCES nurses(id) ON DELETE SET NULL,
                   -- 프리셉터 (신규간호사의 담당 선배 간호사)
  ward_id          INTEGER NOT NULL REFERENCES wards(id),
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 병동 설정(ward_settings) 테이블
-- 병동별 필요 인원 및 운영 설정
-- ============================================================
CREATE TABLE ward_settings (
  id                   SERIAL PRIMARY KEY,
  ward_id              INTEGER NOT NULL REFERENCES wards(id) UNIQUE,
  ward_name            VARCHAR(100) NOT NULL,
  -- 평일 필요 인원
  weekday_d_count      INTEGER NOT NULL DEFAULT 5,
  weekday_e_count      INTEGER NOT NULL DEFAULT 3,
  weekday_n_count      INTEGER NOT NULL DEFAULT 2,
  -- 주말 필요 인원
  weekend_d_count      INTEGER NOT NULL DEFAULT 4,
  weekend_e_count      INTEGER NOT NULL DEFAULT 2,
  weekend_n_count      INTEGER NOT NULL DEFAULT 2,
  -- 월별 오프 개수 (관리자 설정)
  monthly_off_count    INTEGER NOT NULL DEFAULT 9,
  -- 야간전담 연속 근무 최대일 수
  max_consecutive_ne   INTEGER NOT NULL DEFAULT 5,
  -- 최대 연속 근무일 (기본 6일, 1순위 절대 규칙)
  max_consecutive_work INTEGER NOT NULL DEFAULT 6,
  updated_at           TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 희망 근무 신청(shift_requests) 테이블

-- ============================================================
CREATE TABLE shift_requests (
  id              SERIAL PRIMARY KEY,
  nurse_id        INTEGER NOT NULL REFERENCES nurses(id),
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  day             INTEGER NOT NULL,
  requested_shift VARCHAR(5) NOT NULL
                  CHECK (requested_shift IN ('O', 'Y', 'H', 'YH')),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (nurse_id, year, month, day)  -- 같은 날 중복 신청 불가
);

-- ============================================================
-- 근무표(schedules) 테이블
-- 월별 근무표 메타 정보
-- ============================================================
CREATE TABLE schedules (
  id            SERIAL PRIMARY KEY,
  ward_id       INTEGER NOT NULL REFERENCES wards(id),
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL,
  is_published  BOOLEAN DEFAULT FALSE,   -- 게시 여부
  generated_at  TIMESTAMP,               -- AI 자동 생성 시각
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (ward_id, year, month)          -- 병동당 월별 1개만 존재
);

-- ============================================================
-- 근무표 엔트리(schedule_entries) 테이블
-- 각 간호사의 날짜별 근무 배정
-- ============================================================
CREATE TABLE schedule_entries (
  id               SERIAL PRIMARY KEY,
  schedule_id      INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  nurse_id         INTEGER NOT NULL REFERENCES nurses(id),
  day              INTEGER NOT NULL,          -- 1~31
  shift            VARCHAR(5) NOT NULL
                   CHECK (shift IN ('D','E','N','M','Y','H','YH','O','V','I','CB','C','NE')),
  role             VARCHAR(10)
                   CHECK (role IN ('Desk', 'SubDesk', 'Acting') OR role IS NULL),
  is_violation     BOOLEAN DEFAULT FALSE,     -- 규칙 위반 여부
  violation_reason TEXT,                      -- 위반 사유
  updated_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE (schedule_id, nurse_id, day)         -- 같은 날 중복 배정 불가
);

-- ============================================================
-- 인덱스 생성 (조회 성능 최적화)
-- ============================================================
CREATE INDEX idx_nurses_ward_id ON nurses(ward_id);
CREATE INDEX idx_nurses_work_type ON nurses(work_type);
CREATE INDEX idx_nurses_preceptor ON nurses(preceptor_id);
CREATE INDEX idx_shift_requests_nurse_month ON shift_requests(nurse_id, year, month);
CREATE INDEX idx_schedule_entries_schedule ON schedule_entries(schedule_id);
CREATE INDEX idx_schedule_entries_nurse ON schedule_entries(nurse_id);
CREATE INDEX idx_schedules_ward_month ON schedules(ward_id, year, month);
CREATE INDEX idx_holidays_year_month ON holidays(year, month);

-- ============================================================
-- 기본 병동 데이터 삽입
-- ============================================================
INSERT INTO wards (name, description) VALUES
  ('내과 병동', '내과 전문 병동');

-- ============================================================
-- 기본 병동 설정 삽입
-- ============================================================
INSERT INTO ward_settings (
  ward_id, ward_name,
  weekday_d_count, weekday_e_count, weekday_n_count,
  weekend_d_count, weekend_e_count, weekend_n_count,
  monthly_off_count, max_consecutive_ne
) VALUES (
  1, '내과 병동',
  6, 4, 3,   -- 평일: D 6명, E 4명, N 3명
  5, 3, 3,   -- 주말: D 5명, E 3명, N 3명
  9,         -- 월 오프 9개
  5          -- 야간전담 연속 최대 5일
);

-- ============================================================
-- 2026년 공휴일 데이터 (한국)
-- ============================================================
INSERT INTO holidays (year, month, day, name) VALUES
  (2026, 1, 1, '신정'),
  (2026, 1, 28, '설날 연휴'),
  (2026, 1, 29, '설날'),
  (2026, 1, 30, '설날 연휴'),
  (2026, 3, 1, '삼일절'),
  (2026, 5, 5, '어린이날'),
  (2026, 5, 25, '부처님오신날'),
  (2026, 6, 6, '현충일'),
  (2026, 8, 15, '광복절'),
  (2026, 9, 24, '추석 연휴'),
  (2026, 9, 25, '추석'),
  (2026, 9, 26, '추석 연휴'),
  (2026, 10, 3, '개천절'),
  (2026, 10, 9, '한글날'),
  (2026, 12, 25, '크리스마스');
