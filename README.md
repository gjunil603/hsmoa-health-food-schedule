# 건강식품 홈쇼핑 편성표

식품 > 건강식품 카테고리의 홈쇼핑 편성표를 모든 채널에서 모아 보는 모바일 친화형 웹 대시보드입니다.

**배포 주소:** https://hsmoa-health-food-schedule.onrender.com

## 기능

- 카테고리: 식품 > 건강식품 (3차 전체)
- 홈쇼핑사: 전 채널 (18개)
- 한글 달력으로 날짜 선택 (오늘 기준 3개월 전 ~ 7일 후)
- 채널 필터, LIVE 필터
- 편성표 엑셀(CSV) 다운로드 (화면에 보이는 목록 기준)
- **구글 시트 연동** (시트에 있으면 시트에서 표시, 없으면 API 조회 후 시트 저장)
- ↻ 새로고침 시 API 최신 조회 후 해당 날짜 시트 갱신
- (예정) 새벽 자동으로 오늘~7일 시트 동기화
- 상품 썸네일·가격·홈쇼핑 상품 링크
- 서버 캐시 30분 (같은 날짜 재조회 시 빠름, ↻ 버튼은 최신 데이터)
- 맨 위로 스크롤 버튼
- PWA 지원 (핸드폰 홈 화면에 추가 가능)

## 로컬 실행

```bash
cd C:\Users\AAA\Projects\hsmoa-health-food-schedule
npm install
node server.js
```

브라우저에서 http://localhost:3000 접속

## 구글 시트 설정 (Render Environment)

| Key | Value |
|-----|--------|
| `GOOGLE_SHEET_ID` | 스프레드시트 ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 서비스 계정 JSON 전체 |
| `SYNC_DELAY_MS` | (선택) 날짜 사이 대기 ms, 기본 `45000` |
| `SYNC_SECRET` | (선택) 동기화 API 보호용 비밀값 |

시트 탭 이름 기본값: `schedules` (없으면 자동 생성)

서비스 계정 이메일을 시트에 **편집자**로 공유해야 합니다.

### 동작 방식

1. 화면 조회 시 시트에 해당 날짜 데이터가 있으면 **시트에서 표시**
2. 없으면 홈쇼핑모아 API로 조회 후 **시트에 저장**
3. **시트 동기화** 버튼: 오늘만 또는 오늘~7일을 천천히 API → 시트 저장
4. ↻ 새로고침: API로 최신 조회 후 시트 갱신

### 매일 자동 동기화 (새벽, Render 무료)

Render 무료는 가만히 있으면 잠듭니다. **외부 크론**이 새벽에 URL을 한 번 호출하면 서버가 깨어나 오늘~7일 시트를 천천히 채웁니다.

#### 1) (권장) 비밀값 추가

Render → Environment에 추가:

| Key | Value |
|-----|--------|
| `SYNC_SECRET` | 아무 긴 비밀번호 (예: `my-secret-2026`) |

#### 2) cron-job.org 설정

1. [cron-job.org](https://cron-job.org) 가입 (무료)
2. **Create cronjob**
3. 설정 예:

| 항목 | 값 |
|------|-----|
| Title | `hsmoa sheet sync` |
| URL | `https://hsmoa-health-food-schedule.onrender.com/api/sheets/sync?days=7&secret=여기에_SYNC_SECRET` |
| Schedule | Every day |
| 시각 | **19:00 UTC** = 한국시간 **새벽 4:00** |
| Request method | GET |

`SYNC_SECRET`을 안 넣었다면 URL에서 `&secret=...` 부분을 빼면 됩니다.

#### 3) 소요 시간

- 날짜마다 약 45초 대기 + API 조회
- 오늘~7일(8일)이면 **대략 15~30분** 걸릴 수 있음
- 첫 호출은 서버 깨우는 시간(30초~1분)이 더 붙을 수 있음
- 동기화 중에는 서버가 **약 4분마다 자기 `/api/health`를 호출**해 Render 무료 슬립을 막습니다

#### 4) 확인

- 다음날 아침 구글 시트 `schedules`에 여러 날짜가 있는지 확인
- cron-job.org 실행 기록이 성공(2xx)인지 확인
- 앱에서 날짜를 바꿔 볼 때 상태 줄에 **시트**가 보이면 OK

오늘만 매일 갱신하려면:

```
https://hsmoa-health-food-schedule.onrender.com/api/sheets/sync?today=1&secret=여기에_SYNC_SECRET
```

## 배포 (Render)

GitHub에 `push`하면 Render가 자동으로 재배포합니다.

1. [render.com](https://render.com) 가입 → **Sign in with GitHub**
2. **New → Web Service** → `hsmoa-health-food-schedule` 저장소 연결
3. 설정:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
4. Environment에 구글 시트 변수 등록
5. 배포 완료 후 `https://your-app.onrender.com` 주소 사용

### 코드 수정 후 반영

```bash
git add .
git commit -m "변경 내용"
git push
```

## 핸드폰에서 쓰기

1. 배포된 HTTPS 주소를 브라우저에서 열기
2. **홈 화면에 추가**
   - Android (Chrome): 메뉴 → 홈 화면에 추가
   - iPhone (Safari): 공유 → 홈 화면에 추가
3. 아이콘·앱 이름: **건강식품 편성표**

## API

| 엔드포인트 | 설명 |
|------------|------|
| `GET /api/schedule?date=YYYY-MM-DD` | 편성표 (시트 우선, 없으면 API) |
| `GET /api/schedule?date=...&refresh=1` | API 최신 조회 후 시트 갱신 |
| `GET /api/sheets/status` | 시트·동기화 상태 |
| `GET /api/sheets/sync?today=1` | 오늘만 천천히 동기화 시작 |
| `GET /api/sheets/sync?days=7` | 오늘~N일 동기화 시작 |
| `GET /api/health` | 서버 상태 확인 |

데이터 출처: 홈쇼핑모아 trend API (비공식). API 구조가 바뀌면 동작이 멈출 수 있습니다.

## 프로젝트 구조

```
server.js          # API 프록시, 복호화, 캐시, 시트 연동
sheets.js          # 구글 시트 읽기/쓰기
public/
  index.html       # 화면
  app.js           # 달력, 필터, 목록, 동기화
  style.css        # 스타일
  manifest.json    # PWA 설정
  sw.js            # 서비스 워커
  icon-*.png       # 앱 아이콘
render.yaml        # Render 배포 설정
```

## 참고

- **Render 무료 플랜:** 15분 이상 미사용 시 잠들며, 첫 접속이 30초~1분 걸릴 수 있습니다.
- **LIVE 표시:** 데이터를 받을 때 기준으로 표시됩니다.
- 상업적 이용 시 [DataHub 공식 API](https://datahub.hsmoa.com/) 사용을 권장합니다.
