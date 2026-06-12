# 🏥 Nurse Scheduler AI — 간호사 근무표 자동 생성 시스템

병원 간호사 3교대 근무를 AI로 자동 생성하는 웹 시스템입니다.

---

## 🚀 시작하기 (최초 1회)

### 사전 준비
- Node.js 18+
- Docker Desktop (PostgreSQL용)

### 1단계: PostgreSQL 시작
```bash
cd /Users/shindh/Desktop/바이브폴더/duty
docker-compose up -d postgres
```

### 2단계: 백엔드 설정
```bash
cd backend
npm install
npx ts-node src/database/init.ts   # 테이블 생성
npx ts-node src/database/seed.ts   # 30명 샘플 데이터 삽입
```

### 3단계: 프론트엔드 설정
```bash
cd ../frontend
npm install
```

---

## ▶️ 실행

터미널 2개를 열어 각각 실행:

```bash
# 터미널 1 - 백엔드 (포트 3001)
cd backend && npm run dev

# 터미널 2 - 프론트엔드 (포트 3000)
cd frontend && npm run dev
```

브라우저에서 **http://localhost:3000** 접속

---

## 📱 주요 기능

| 페이지 | 기능 |
|--------|------|
| 대시보드 | 전체 현황 요약, 빠른 메뉴 |
| 근무표 | AI 자동 생성, 셀 클릭 수정, Excel/PDF 출력 |
| 희망 오프 신청 | O/Y/H/YH 신청, 달력 형태 현황 |
| 간호사 관리 | 등록/수정/비활성화, 역량·근무형태 설정 |
| 통계 | 개인별 D/E/N 횟수, 역할 횟수, 위반 여부 |
| 설정 | 필요 인원 수, 월 오프 개수, 야간전담 설정 |

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

- **Frontend**: Next.js 15, TypeScript, TailwindCSS, ShadCN UI
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 16
- **Excel**: ExcelJS
- **알고리즘**: Constraint-based Greedy + Rule Validation

---

## 📁 프로젝트 구조

```
duty/
├── backend/
│   └── src/
│       ├── database/   # 스키마, 초기화, 샘플 데이터
│       ├── services/   # 스케줄러 AI, Excel 생성
│       ├── routes/     # nurses, schedule, settings, stats
│       ├── types/      # TypeScript 타입
│       └── index.ts    # Express 서버
├── frontend/
│   └── src/
│       ├── app/        # 페이지 (Next.js App Router)
│       ├── components/ # UI 컴포넌트
│       ├── lib/        # API 클라이언트
│       └── types/      # TypeScript 타입
└── docker-compose.yml  # PostgreSQL
```
