# 건강식품 홈쇼핑 편성표

식품 > 건강식품 카테고리의 홈쇼핑 편성표를 모든 채널에서 모아 보는 모바일 친화형 웹 대시보드입니다.

**배포 주소:** https://hsmoa-health-food-schedule.onrender.com

## 기능

- 카테고리: 식품 > 건강식품 (3차 전체)
- 홈쇼핑사: 전 채널 (18개)
- 한글 달력으로 날짜 선택 (오늘 기준 3개월 전 ~ 7일 후)
- 채널 필터, LIVE 필터
- 편성표 엑셀(CSV) 다운로드 (당일 / 오늘~7일 선택, 7일은 구글 시트)
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

Render 무료는 가만히 있으면 잠듭니다. 깨우는 데 **30~60초 이상** 걸릴 수 있습니다.

**cron-job.org는 약 30초 안에 응답이 없으면 실패**합니다. 슬립 상태에서 TEST RUN을 누르면 `Failed (output too large)`가 나고, 실제로는 서버가 안 깨어난 것처럼 보일 수 있습니다. (브라우저로 사이트를 열면 그때야 깨기 시작하는 이유입니다.)

#### 권장: GitHub Actions (긴 대기 가능)

저장소에 `.github/workflows/nightly-sheet-sync.yml` 이 있습니다.

1. GitHub 저장소 → **Settings → Secrets and variables → Actions**
2. Secret 추가: `SYNC_SECRET` = Render에 넣은 값과 동일
3. **Actions** 탭 → **Nightly sheet sync** → **Run workflow** 로 수동 테스트
4. 매일 **한국시간 00:00**에 자동 실행 (깨우기 재시도 최대 ~3분 → 동기화 시작)

cron-job.org wake/sync 작업은 꺼 두셔도 됩니다.

#### (선택) Render 비밀값

| Key | Value |
|-----|--------|
| `SYNC_SECRET` | 아무 긴 비밀번호 (예: `hsmoa2026secret`) |

#### 소요 시간

- 날짜마다 약 45초 대기 + API 조회
- 오늘~7일(8일)이면 **대략 15~30분**
- 동기화 중에는 서버가 **약 2분마다** `/api/health`를 호출해 슬립을 막습니다

#### 확인

- 다음날 아침 구글 시트 `schedules`에 여러 날짜가 있는지 확인
- GitHub Actions 실행이 초록(성공)인지 확인
- 앱에서 날짜를 바꿔 볼 때 상태 줄에 **시트**가 보이면 OK

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
| `GET /api/sheets/export?days=7` | 시트에서 오늘~N일 편성표 JSON |
| `GET /api/wake` | 깨우기용 (응답 `ok` 2바이트) |
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
