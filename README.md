# 🏥 Nurse Scheduler AI — 간호사 근무표 자동 생성 시스템

병원 간호사 3교대 근무를 AI로 자동 생성하는 풀스택 웹 시스템입니다.

---

## 🌐 배포 URL

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | https://frontend-gmlwjd-s-projects.vercel.app |
| 백엔드 API | https://nurse-scheduler-backend-ecru.vercel.app |

---

## 📱 주요 기능

| 페이지 | 기능 |
|--------|------|
| 대시보드 | 전체 현황 요약 (간호사 수·위반 건수), 간호사 현황, 근무 코드 안내 |
| 근무표 | AI 자동 생성, 인터랙티브/근무표/달력 뷰, 셀 드래그 근무 교환, Excel·인쇄 |
| 희망 오프 신청 | O/Y/H/YH 신청, 날짜별 신청 현황 달력, AI 생성 시 우선 반영 |
| 간호사 관리 | 등록/수정/비활성화, 역량·근무형태 설정, 유형별 필터 |
| 통계 | 개인별 D/E/N 횟수·총시간·역할 횟수·위반 여부, Excel 다운로드 |
| 설정 | 평일·주말 필요 인원, 월 오프 수, 연속 근무 제한, 멤버별 오프 수 |

---

## 👩‍⚕️ 샘플 데이터 (30명)

| 구분 | 인원 |
|------|------|
| 수간호사 | 1명 |
| 책임간호사 (Desk) | 5명 |
| 일반간호사 Desk | 8명 |
| 일반간호사 SubDesk | 8명 |
| 신규간호사 Acting | 4명 |
| 야간전담 | 4명 |
| **합계** | **30명** |

---

## 🤖 AI 스케줄링 알고리즘

6가지 우선순위로 최적화:

1. **규칙 위반 0건** — 모든 필수 규칙 준수
2. **희망 오프 최대 반영** — 신청된 O/Y/H/YH 우선 배정
3. **근무 횟수 균형** — D/E/N 균등 분배
4. **야간근무 균등 분배**
5. **주말근무 균등 분배**
6. **Desk/SubDesk/Acting 균등 분배**

### 적용 규칙

| 규칙 | 내용 |
|------|------|
| 야간 연속 | N 최대 3일, 2일 연속 시 이후 O 2개 필수 |
| NOE 패턴 | N 1회인 경우 N→O→E 패턴 허용 |
| 낮근무 연속 | D 최대 4일 연속 |
| E→D 금지 | E 다음날 D 배정 불가 |
| 주말 오프 | 월 1회 이상 토/일 오프 보장 |
| 수간호사 | 일/공휴일 OFF, 격주 토 OFF, D만 배정 |
| 야간전담 | 월 15회 NE + 나머지 O (31일이면 Y 1개 추가) |

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), TypeScript, TailwindCSS, ShadCN UI |
| Backend | Node.js, Express, TypeScript, Vercel Serverless |
| Database | Supabase (PostgreSQL) — HTTP Adapter |
| Excel | ExcelJS |
| 배포 | Vercel (프론트엔드 + 백엔드) |
| 알고리즘 | Constraint-based Greedy + Rule Validation |

---

## 📁 프로젝트 구조

```
duty/
├── backend/
│   ├── api/
│   │   └── index.ts        # Vercel serverless 진입점
│   └── src/
│       ├── database/       # Supabase HTTP 어댑터
│       ├── services/       # 스케줄러 AI, Excel 생성
│       ├── routes/         # nurses, schedule, settings, stats
│       ├── types/          # TypeScript 타입
│       └── middleware/     # 에러 핸들러
├── frontend/
│   └── src/
│       ├── app/            # 페이지 (Next.js App Router)
│       ├── components/     # UI 컴포넌트
│       ├── lib/            # API 클라이언트
│       └── types/          # TypeScript 타입
└── docker-compose.yml      # 로컬 개발용 PostgreSQL
```

---

## 💻 로컬 개발 환경 설정

### 사전 준비
- Node.js 18+
- Docker Desktop (로컬 PostgreSQL용)

### 환경 변수 설정

**backend/.env**
```env
SUPABASE_PROJECT_REF=your_project_ref
SUPABASE_ACCESS_TOKEN=your_access_token
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

**frontend/.env.local**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 실행

```bash
# 백엔드 (포트 3001)
cd backend && npm install && npm run dev

# 프론트엔드 (포트 3000)
cd frontend && npm install && npm run dev
```

브라우저에서 **http://localhost:3000** 접속

---

## 🗄 데이터베이스

Supabase PostgreSQL을 HTTP Adapter로 연결합니다.
Supabase Management API의 레이트 리밋(60 req/min)을 고려해 INSERT는 배치 처리(500행/쿼리)로 최적화되어 있습니다.
