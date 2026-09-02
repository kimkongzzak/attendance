# 🐶🐩💞 오늘의 강아지 - 실시간 근태 현황 조회 및 강아지 포토 갤러리

날짜별 근태 현황을 실시간으로 조회하고, 강아지 포토 갤러리 및 임직원 근태 현황을 효율적으로 모니터링할 수 있는 모던 대시보드 웹 서비스입니다.

---

## 📌 주요 기능 (Key Features)

- 🐶 **오늘의 강아지 테마 & SVG Favicon (`🐶`)**
  - 귀여운 강아지 파비콘과 테마 헤더 적용

- 📸 **Supabase DB 연동 강아지 포토 갤러리 (Photo Gallery)**
  - **Supabase DB (`gallery_photos`)**와 실시간 연동되어 이미지 업로드, 삭제 및 순서 저장 관리
  - **전체보기 관리 모달 (`galleryManageModal`)**: 전체 등록 사진 4:3 프레임 조회, 순서 변경 (`▲`/`▼`), 삭제 (`🗑️`)
  - **내림차순 정렬 (`display_order.desc, id.desc`)**: 새로 추가된 이미지에 `display_order + 10` 자동 부여하여 갤러리 맨 앞에 자동 배치
  - **2.5MB 전송 자동 다이어트 (Auto-Compression Loop)**: 전송 전 캔버스 자동 다이어트로 Vercel Serverless Function 4.5MB 제한 완벽 준수
  - **경량화 새로고침**: API 통신 요청 없이 메모리 상에서 슬라이드 위치 및 정렬을 고속 리셋

- 👥 **팝업 모달 방식의 '우리 편 관리' (추가 / 삭제 / 복원)**
  - `덤으로 보는 카드 태깅 현황` 헤더의 `✏️ 우리 편 관리` 연필 버튼 클릭 시 팝업 모달창(`trackedEmpModal`)으로 직관적 조회 및 편집
  - `localStorage`를 통한 브라우저 영구 보관 및 초기 7인 복원 기능 제공

- 📊 **덤으로 보는 카드 태깅 현황 (임직원 근태 현황 요약)**
  - 상태(`🟢 출근` / `🔴 미태깅`), 사번, 카드번호, 첫태깅, 끝태깅, 태깅 횟수, 주요 위치를 한눈에 파악
  - 요약 행 클릭 시 해당 직원의 상세 태깅 내역만 하단 표에 즉시 필터링

- 📋 **태깅 상세 내역 표**
  - 순번, 이름, 사번, 카드번호, 태깅 일시, 장치명(`devNm`) 정보 제공
  - 실시간 통합 검색 기능 (이름, 사번, 카드ID, 장치명)

- 🔒 **아이콘 전용 관리자 인증 버튼 (`🔒` / `🔓`)**
  - 텍스트 없이 깔끔한 자물쇠 아이콘 상태 토글 버튼 (인증 시 2시간 조회 유지)

- ☀️🌙 **라이트 모드 & 다크 모드 지원**
  - 심플하고 현대적인 모던 라이트 테마 기본 적용 및 원클릭 다크모드 전환

---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
- **Languages / Frameworks**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS, Custom CSS Variables (Light/Dark Theme)
- **Icons & Graphics**: FontAwesome 6.4.0, SVG Emoji Favicon (`🐶`)

### Backend & Database
- **Runtime**: Node.js (v20+)
- **Framework**: Express.js
- **Database**: Supabase PostgreSQL (`gallery_photos` 테이블 PostgREST 연동)
- **HTTP Client**: Axios
- **Deployment Platform**: Vercel Serverless Functions (`api/photos.js`, `api/attendance.js`)

---

## 💡 기술 스택 선정 이유 (Tech Stack Rationale)

1. **백엔드 & 서버리스 API: Node.js + Express (`server.js` & `api/`)**
   - **CORS 및 보안 헤더 프록시**: 외부 근태 API 호출 시 발생할 수 있는 브라우저 CORS 제한 및 보안 헤더(`code`, `key`) 노출 문제를 완벽 차단.
   - **Vercel Serverless 1:1 라우팅**: `api/photos.js`, `api/attendance.js` 등 서버리스 람다 구조로 간편하게 배포 관리.

2. **데이터베이스: Supabase PostgreSQL (`gallery_photos`)**
   - **실시간 포토 갤러리 동기화**: `display_order.desc` 정렬을 통해 사진 순서를 DB에 영구 저장 및 관리.

3. **프론트엔드: Vanilla JavaScript (ES6+)**
   - **Zero Build Overhead**: 무거운 프레임워크 없이 순수 JS로 구현하여 페이지 진입 및 데이터 렌더링 속도가 극도로 빠름.
   - **2.5MB 전송 자동 다이어트 (Auto-Compression)**: 고용량 이미지 업로드 시 브라우저 Canvas에서 800px 및 JPEG Quality 하향으로 용량을 100KB대로 감량.

4. **스타일링: Tailwind CSS + Responsive Mobile Layout**
   - **반응형 1줄 레이아웃**: 모바일 화면에서도 헤더 버튼 및 뱃지가 줄바꿈 없이 깔끔하게 1줄로 유지되도록 설계.

---

## 📂 프로젝트 구조 (Project Structure)

```
attendance/
├── api/
│   ├── attendance.js       # Vercel 서버리스 근태 API 프록시
│   ├── holidays.js         # 공휴일 API 서버리스 프록시
│   ├── img-proxy.js        # 식단 이미지 고속 서버리스 프록시
│   ├── meal.js             # 식단 API 서버리스 프록시
│   └── photos.js           # Supabase DB 포토 갤러리 CRUD 서버리스 API
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

Vercel 배포 시 **Project Settings ➔ Environment Variables**에 아래 환경 변수를 등록하여 관리합니다:

| 환경 변수 명 | 설명 |
| :--- | :--- |
| `ATTENDANCE_API_CODE` | API 요청 헤더 `code` |
| `ATTENDANCE_API_KEY` | API 요청 헤더 `key` |
| `SUPABASE_URL` | Supabase 프로젝트 URL (`https://<project-id>.supabase.co`) |
| `SUPABASE_KEY` | Supabase API key (`anon` 또는 `service_role` 키) |
| `ADMIN_KEY` | 관리자 화면 해제 비밀번호 (`[🔒]` 버튼) |

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
