# 🌿 Carbon Platform — Frontend

> PCF(Product Carbon Footprint) 탄소 발자국 추적 SaaS 플랫폼의 프론트엔드 대시보드

---

## 📌 과제 개요

제조사·물류사 등 기업 고객이 원소재·전기·운송 데이터를 Excel로 업로드하면,  
**GHG Protocol 기반 Scope별 탄소 배출량을 자동 계산**하고 인터랙티브 대시보드로 시각화합니다.  
대상: 실무자, 경영자

---

## 🧠 도메인 이해 — PCF & GHG Scope

### GHG Protocol Scope 분류

| Scope | 정의 | UI 표현 |
|-------|------|---------|
| **Scope 1** | 직접 배출 (자체 연료 연소) | 빨간색 배지 · KPI 카드 |
| **Scope 2** | 간접 배출 (구매 전기) | 파란색 배지 · KPI 카드 |
| **Scope 3** | 가치사슬 배출 (원소재·운송) | 노란색 배지 · KPI 카드 |

### PCF 계산 결과 시각화

```
배출량(kgCO₂e) = 활동량 × 배출계수
```

- **KPI 카드 4개**: 총 배출량, Scope 1, Scope 2, Scope 3 한눈에 확인
- **월별 추이 차트**: 전기·원소재·운송 3개 라인 + Legend 비교
- **카테고리 파이차트**: Scope별 비중 시각화
- **상세 테이블**: 카테고리별 배출량 및 비중(%), 검색 필터, CSV 내보내기

---

## 🏗️ 시스템 설계

### 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|----------|
| Framework | Next.js (Pages Router) | SSR/SSG 지원, 파일 기반 라우팅 |
| Language | TypeScript | 타입 안전성, API 응답 인터페이스 정의 |
| Styling | Tailwind CSS | 빠른 UI 구현, 다크모드 처리 용이 |
| Charts | Recharts | React 친화적, LineChart·PieChart 커스터마이징 |
| HTTP | Axios | Cache-Control 헤더 설정으로 304 캐시 방지 |
| Package Manager | Yarn | 빠른 설치 속도, lock 파일 일관성 |

### 프로젝트 구조

```
src/
├── pages/
│   ├── _app.tsx          # 전역 설정
│   ├── _document.tsx     # HTML 문서 설정
│   ├── index.tsx         # 메인 대시보드 (단일 페이지)
│   └── api/              # Next.js API routes
└── styles/               # 전역 스타일
```

### 컴포넌트 구조 (index.tsx 내부)

```
Home
├── KpiCard               # 재사용 가능한 KPI 카드 컴포넌트
├── Skeleton              # 로딩 플레이스홀더 컴포넌트
├── EmptyState            # 데이터 없음 상태 컴포넌트
├── Header (다크모드 토글, ISO 14067 배지)
├── Tabs (대시보드 / 업로드 파일 / AI 어시스턴트)
├── Upload Zone (드래그&드롭 + 파일 선택)
├── Dashboard Tab
│   ├── KPI Cards x4 (총 배출량, Scope 1/2/3)
│   ├── AI Insight Card (자동 생성 + 새로 고침)
│   ├── LineChart (월별 배출량 추이 + Legend)
│   ├── PieChart (카테고리별 비중)
│   └── Category Table (정렬, 비중%)
├── Files Tab
│   ├── Upload List (파일별 선택·삭제·건수 표시)
│   └── Emission Table (검색 필터 + CSV 내보내기)
└── Chat Tab
    ├── Suggestion Buttons (빈 화면에 추천 질문)
    ├── Message List (user/assistant 말풍선)
    ├── Typing Indicator (bounce 애니메이션)
    ├── 대화 초기화 버튼
    └── Input + 전송 버튼 (Enter 지원)
```

### API 연동

```typescript
const api = axios.create({
  baseURL: "http://localhost:3002",
  headers: { "Cache-Control": "no-cache" }, // 304 캐시 방지
});
```

| 호출 | 엔드포인트 | 시점 |
|------|-----------|------|
| `GET /emissions/summary` | 집계 데이터 | 초기 로드, 업로드/삭제 후 |
| `GET /emissions?uploadId=` | 배출 레코드 | 파일 선택 시 |
| `GET /upload` | 파일 목록 | 초기 로드, 업로드/삭제 후 |
| `POST /upload/excel` | Excel 업로드 | 파일 선택/드롭 시 |
| `DELETE /upload/:id` | 파일 삭제 | 🗑 클릭 시 |
| `POST /ai/insight` | AI 인사이트 | summary 로드 후 자동 |
| `POST /ai/chat` | AI 챗봇 | 메시지 전송 시 |

---

## 🤖 AI 활용 방식

### 사용한 AI 도구
- **Claude (Anthropic)** — UI 설계, 컴포넌트 구현, 버그 디버깅
- **OpenAI GPT-4o** — 런타임 AI 인사이트 생성 및 챗봇 응답

### AI 인사이트 자동 생성 흐름

```
데이터 업로드
    ↓
fetchSummary() → GET /emissions/summary
    ↓
fetchInsight(data) → POST /ai/insight
    ↓
브라우저 언어 감지 (navigator.language)
    ↓
AI 인사이트 카드에 표시
```

**설계 이유:**
- 업로드 직후 자동 생성 — 사용자가 별도 액션 없이 즉시 인사이트 확인
- `↻ 새로 고침` 버튼 — 필요 시 재생성 가능
- 브라우저 언어 자동 감지 — 한국어/영어 자동 전환

### AI 챗봇 설계

- 실시간 배출 데이터를 context로 주입하여 데이터 기반 답변
- 마지막 6개 메시지(3턴)만 전송 — 토큰 비용 절감
- 빈 화면에 추천 질문 버튼 3개 표시 — 비전문가 진입 장벽 낮춤
- `Enter` 키 전송, 대화 초기화 버튼 지원

---

## ⚖️ 설계 결정 및 Trade-off

### 1. 단일 페이지 vs 멀티 페이지

| | 단일 페이지 (채택) | 멀티 페이지 |
|---|---|---|
| 장점 | 상태 공유 용이, 빠른 탭 전환 | 라우팅 명확, URL 공유 가능 |
| 단점 | index.tsx 파일이 커짐 | 페이지 간 상태 전달 복잡 |
| **선택 이유** | 대시보드 특성상 탭 간 데이터 공유(summary, uploads)가 필요하여 단일 페이지로 구현 |

### 2. 재사용 컴포넌트 분리 (KpiCard, Skeleton, EmptyState)

반복되는 UI 패턴을 컴포넌트로 추출하여 일관성 유지.

**Trade-off:** 같은 파일 내 정의로 별도 파일 분리보다 import 관리는 단순하지만, 파일 크기가 커짐.  
**이유:** MVP 단계에서 컴포넌트 수가 적어 같은 파일 내 관리가 효율적.

### 3. CSV 내보내기 — 서버 vs 클라이언트

클라이언트 사이드에서 직접 Blob 생성 방식 채택.

```typescript
const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
```

**Trade-off:** 대용량 데이터에서 브라우저 메모리 부담.  
**이유:** 별도 API 엔드포인트 불필요, `\uFEFF` BOM으로 한글 깨짐 방지.

### 4. Cache-Control 헤더

```typescript
headers: { "Cache-Control": "no-cache" }
```

브라우저가 `304 Not Modified`를 반환하여 업로드 후 데이터가 갱신되지 않는 문제를 방지.

### 5. 파일 삭제 시 e.stopPropagation()

```typescript
const deleteUpload = async (e: React.MouseEvent, uploadId: number) => {
  e.stopPropagation(); // 파일 선택 이벤트 버블링 방지
};
```

삭제 버튼 클릭이 파일 선택 버튼 클릭으로 전파되는 것을 방지.

---

## 🚀 실행 방법

### 1. 의존성 설치

```bash
yarn install
```

### 2. 개발 서버 실행

```bash
yarn dev
```

앱: `http://localhost:3000`

> ⚠️ 백엔드 서버(`http://localhost:3002`)가 먼저 실행되어 있어야 합니다.

---

## 👤 사용자 플로우 (UX)

```
1. Excel 파일 드래그&드롭 또는 파일 선택 버튼 클릭
    ↓
2. 업로드 성공 → KPI 카드(Scope 1/2/3), 차트 자동 갱신
    ↓
3. AI 인사이트 자동 생성 (배출 현황 요약 + 감축 권고)
    ↓
4. [파일] 탭 → 파일별 데이터 조회 / 검색 / CSV 내보내기 / 삭제
    ↓
5. [AI] 탭 → 추천 질문 클릭 또는 직접 입력으로 탄소 관련 질문
```

**비전문가 대상 UX 고려사항:**
- Scope 1/2/3 배지를 색상으로 직관적 구분 (빨강/파랑/노랑)
- 중복 업로드 시 명확한 오류 메시지 표시
- 로딩 중 Skeleton UI로 레이아웃 유지
- 데이터 없을 때 EmptyState로 안내
- AI 챗봇 빈 화면에 추천 질문 버튼 제공

---

## 🔮 향후 개선 사항

- [ ] 라이트모드 완전 지원
- [ ] 페이지 분리 및 URL 라우팅
- [ ] 배출량 목표 설정 및 달성률 시각화
- [ ] PDF 리포트 내보내기
- [ ] 반응형 모바일 UI
- [ ] 날짜 범위 필터
