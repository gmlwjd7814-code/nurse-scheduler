-- ============================================================
-- v2 마이그레이션: 새 규칙 지원을 위한 스키마 업데이트
-- 최초 설치 시는 schema.sql에 이미 포함됩니다.
-- 기존 DB 업그레이드 시 이 파일을 실행하세요.
-- ============================================================

-- 1. 간호사 테이블에 프리셉터 컬럼 추가
ALTER TABLE nurses
  ADD COLUMN IF NOT EXISTS preceptor_id INTEGER REFERENCES nurses(id) ON DELETE SET NULL;

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_nurses_preceptor ON nurses(preceptor_id);

-- 3. 병동 설정에 최대 연속 근무일 추가 (기본값 6)
ALTER TABLE ward_settings
  ADD COLUMN IF NOT EXISTS max_consecutive_work INTEGER NOT NULL DEFAULT 6;

-- 4. 신규 샘플 데이터: 신규간호사에게 프리셉터 배정
-- (seed.ts에서 자동 처리되므로 여기서는 참고용)
-- UPDATE nurses SET preceptor_id = (SELECT id FROM nurses WHERE name='이민정' LIMIT 1)
--   WHERE name IN ('권지아','홍세연');
