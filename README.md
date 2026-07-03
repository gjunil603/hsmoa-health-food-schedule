# 건강식품 홈쇼핑 편성표

식품 > 건강식품 카테고리의 홈쇼핑 편성표를 모든 채널에서 모아 보는 모바일 친화형 웹 대시보드입니다.

**배포 주소:** https://hsmoa-health-food-schedule.onrender.com

## 기능

- 카테고리: 식품 > 건강식품 (3차 전체)
- 홈쇼핑사: 전 채널 (18개)
- 한글 달력으로 날짜 선택 (오늘 기준 3개월 전 ~ 7일 후)
- 채널 필터, LIVE 필터
- 상품 썸네일·가격·홈쇼핑 상품 링크
- 서버 캐시 30분 (같은 날짜 재조회 시 빠름, ↻ 버튼은 최신 데이터)
- 4시간마다 자동 새로고침
- PWA 지원 (핸드폰 홈 화면에 추가 가능)

## 로컬 실행

```bash
cd C:\Users\AAA\Projects\hsmoa-health-food-schedule
node server.js
```

브라우저에서 http://localhost:3000 접속

## 배포 (Render)

GitHub에 `push`하면 Render가 자동으로 재배포합니다.

1. [render.com](https://render.com) 가입 → **Sign in with GitHub**
2. **New → Web Service** → `hsmoa-health-food-schedule` 저장소 연결
3. 설정:
   - **Build Command:** (비워둠)
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
4. 배포 완료 후 `https://your-app.onrender.com` 주소 사용

`render.yaml`이 포함되어 있어 Render에서 설정을 자동 인식합니다.

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

아이콘을 변경한 뒤에는 기존 홈 화면 아이콘을 삭제하고 다시 추가해야 새 아이콘이 보일 수 있습니다.

## API

| 엔드포인트 | 설명 |
|------------|------|
| `GET /api/schedule?date=YYYY-MM-DD` | 해당 날짜 편성표 |
| `GET /api/schedule?date=...&refresh=1` | 캐시 무시, 최신 조회 |
| `GET /api/health` | 서버 상태 확인 |

데이터 출처: 홈쇼핑모아 trend API (비공식). API 구조가 바뀌면 동작이 멈출 수 있습니다.

## 프로젝트 구조

```
server.js          # API 프록시, 복호화, 캐시, 페이징
public/
  index.html       # 화면
  app.js           # 달력, 필터, 목록
  style.css        # 스타일
  manifest.json    # PWA 설정
  sw.js            # 서비스 워커
  icon-*.png       # 앱 아이콘
  favicon.png      # 브라우저 탭 아이콘
render.yaml        # Render 배포 설정
```

## 참고

- **Render 무료 플랜:** 15분 이상 미사용 시 잠들며, 첫 접속이 30초~1분 걸릴 수 있습니다.
- **LIVE 표시:** 데이터를 받을 때 기준으로 표시됩니다. 실시간 반영이 필요하면 ↻ 버튼을 사용하세요.
- 상업적 이용 시 [DataHub 공식 API](https://datahub.hsmoa.com/) 사용을 권장합니다.
