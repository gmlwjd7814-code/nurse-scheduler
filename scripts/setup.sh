#!/bin/bash
# ============================================================
# Nurse Scheduler AI — 초기 설정 스크립트
# 처음 프로젝트를 세팅할 때 한 번만 실행하면 됩니다
# 사용법: bash scripts/setup.sh
# ============================================================

set -e

echo ""
echo "🏥 Nurse Scheduler AI 설정 시작"
echo "================================"

# 1. Docker로 PostgreSQL 시작
echo ""
echo "1️⃣  PostgreSQL 컨테이너 시작..."
docker-compose up -d postgres

echo "⏳ PostgreSQL 준비 대기 중..."
sleep 5

# 2. 백엔드 의존성 설치
echo ""
echo "2️⃣  백엔드 의존성 설치..."
cd backend
npm install

# 3. 데이터베이스 초기화 (테이블 생성)
echo ""
echo "3️⃣  데이터베이스 스키마 생성..."
npx ts-node src/database/init.ts

# 4. 샘플 데이터 삽입 (30명의 간호사)
echo ""
echo "4️⃣  샘플 데이터 삽입 (30명 간호사)..."
npx ts-node src/database/seed.ts

cd ..

# 5. 프론트엔드 의존성 설치
echo ""
echo "5️⃣  프론트엔드 의존성 설치..."
cd frontend
npm install
cd ..

echo ""
echo "✅ 설정 완료!"
echo ""
echo "🚀 실행 방법:"
echo "  터미널 1: cd backend && npm run dev"
echo "  터미널 2: cd frontend && npm run dev"
echo ""
echo "  브라우저: http://localhost:3000"
echo ""
