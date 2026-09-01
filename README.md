# 🤑💸 출퇴출퇴 - 일별 근태 현황 조회 및 관리 서비스

날짜별 근태 현황을 실시간으로 조회하고, 관리 대상 임직원들의 출퇴근 태깅 기록을 효율적으로 모니터링할 수 있는 모던 대시보드 웹 서비스입니다.

---

## 📌 주요 기능 (Key Features)

- 📅 **인터랙티브 달력 (Interactive Calendar)**
  - 월 단위 탐색 및 날짜 클릭 시 해당 일자의 근태 데이터 실시간 로딩
  - "오늘로 이동" 및 로딩 오버레이 지원

- 🔄 **안전한 API 프록시 & CORS 해결 (Server & Serverless Proxy)**
  - 외부 API 연동 시 발생할 수 있는 브라우저 CORS 문제 해결
  - API 요청 헤더 인증 키를 서버/서버리스 환경 변수(`ATTENDANCE_API_CODE`, `ATTENDANCE_API_KEY`)로 안전하게 은닉

- 👥 **동적 관리 대상 임직원 설정 (추가 / 삭제 / 복원)**
  - 사용자가 자유롭게 사번, 성명, 카드번호(4자리)를 추가 및 삭제
  - `localStorage`를 통한 브라우저 영구 보관 및 초기 복원 기능 제공

- 📊 **DB 테이블 구조의 임직원 근태 현황 요약**
  - 전체 임직원의 근태 상태(`🟢 출근` / `🔴 미태깅`), 최초 출근 시간, 최종 태깅 시간, 태깅 횟수, 주요 위치를 한눈에 파악
  - 요약 행 클릭 시 해당 임직원의 상세 태깅 내역만 하단 표에 즉시 필터링

- 📋 **실시간 태깅 상세 내역 표**
  - 순번, 성명, 사번, 카드번호, 태깅 일시, 장치명(`devNm`) 정보 제공
  - 실시간 통합 검색 기능 (이름, 사번, 카드ID, 장치명)

- ☀️🌙 **라이트 모드 & 다크 모드 지원**
  - 심플하고 현대적인 모던 라이트 테마 기본 적용 및 원클릭 다크모드 전환

- 💻 **원본 API JSON 뷰어**
  - API에서 수신된 원본 JSON 페이로드를 즉시 확인하고 클립보드에 복사 기능 제공

---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
- **Languages / Frameworks**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS, Custom CSS Variables (Light/Dark Theme)
- **Icons & Graphics**: FontAwesome 6.4.0, SVG Emoji Favicon (`🤑`)

### Backend & Infrastructure
- **Runtime**: Node.js (v20+)
- **Framework**: Express.js
- **HTTP Client**: Axios
- **Deployment Platform**: Vercel Serverless Functions (`api/attendance.js`)

---

## 📂 프로젝트 구조 (Project Structure)

```
attendance/
├── api/
│   └── attendance.js       # Vercel 서버리스 API 프록시 핸들러
├── public/
│   ├── index.html          # 메인 대시보드 HTML 레이아웃
│   ├── app.js              # 프론트엔드 상태 관리, 이벤트 & API 연동 로직
│   └── style.css           # 커스텀 테마(Light/Dark) 및 애니메이션 스타일
├── .env.example            # 환경 변수 가이드 파일
├── .gitignore              # Git 무시 파일 목록
├── package.json            # Node dependencies 및 실행 스크립트
├── server.js               # 로컬 Express 프록시 서버
├── vercel.json             # Vercel 라우팅 및 서버리스 설정
└── README.md               # 기술 스펙 및 프로젝트 문서
```

---

## 🔐 환경 변수 설정 (Environment Variables)

Vercel 배포 시 **Project Settings ➔ Environment Variables**에 아래 환경 변수를 등록하여 API 요청 헤더를 관리할 수 있습니다:

| 환경 변수 명 | 설명 |
| :--- | :--- |
| `ATTENDANCE_API_CODE` | API 요청 헤더 `code` |
| `ATTENDANCE_API_KEY` | API 요청 헤더 `key` |
| `PORT` | 로컬 서버 포트 (선택 사항) |

---

## 🚀 시작하기 (Getting Started)

### 1. 리포지토리 클론 및 패키지 설치
```bash
git clone https://github.com/kimkongzzak/attendance.git
cd attendance
npm install
```

### 2. 로컬 개발 서버 실행
```bash
npm start
```
서버 실행 후 브라우저에서 `http://localhost:3000` 으로 접속합니다.

---

## 📜 라이선스 (License)

Copyright © 2026 Daily Attendance Service. All rights reserved.

---

## 💡 기술 스택 선정 이유 (Tech Stack Rationale)

1. **백엔드: Node.js + Express (`server.js` & `api/attendance.js`)**
   - **CORS 및 보안 헤더 연동 (Proxy Server)**: 외부 근태 API 호출 시 발생할 수 있는 브라우저 CORS 정책 제한이나 보안 헤더(`code`, `key`) 노출 문제를 해결하기 위해 서버 측 프록시 환경을 구축하였습니다.
   - **Vercel 서버리스 호환**: Express 라우팅 구조를 Vercel Serverless Function (`api/attendance.js`)과 1:1 매핑하여 별도의 서버 인프라 관리 없이 클릭 한 번으로 배포할 수 있습니다.

2. **프론트엔드: Vanilla JavaScript (ES6+)**
   - **Zero Build Overhead**: 무거운 프레임워크나 빌드 과정(Webpack, Vite) 없이 순수 JS로 구현하여 페이지 진입 및 데이터 렌더링 속도가 극도로 빠릅니다.
   - **직관적인 동적 상태 관리**: 날짜 선택, 관리대상 임직원 동적 추가/삭제, 검색어 필터링, 테마 전환 등 대시보드 상태를 브라우저 메모리상에서 즉각적으로 연산하여 반응합니다.

3. **스타일링: Tailwind CSS + CSS Custom Variables (Theme)**
   - **유연한 대시보드 레이아웃**: Tailwind의 Grid 시스템(`grid-cols-12`)을 활용해 좌측 관리 패널(25%)과 우측 대시보드 표 영역(75%)을 최적의 비율로 배치하였습니다.
   - **스무스한 테마 전환**: CSS 변수(`--bg-primary`, `--bg-card`, `--text-main`)를 활용해 DOM 재렌더링 없이 라이트/다크 테마 전환이 매끄럽게 동작합니다.

4. **데이터 저장소: Browser `localStorage`**
   - **별도 DB 구축 없는 유저 데이터 보관**: 사용자가 추가/삭제한 임직원 목록과 선택한 테마 설정이 브라우저 `localStorage`에 자동 저장되어 페이지를 새로고침하거나 재방문해도 영구 유지됩니다.

