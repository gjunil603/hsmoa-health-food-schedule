# 건강식품 홈쇼핑 편성표

식품 > 건강식품 카테고리의 홈쇼핑 편성표를 모든 채널에서 모아 보는 모바일 친화형 웹 대시보드입니다.

## 로컬 실행

```bash
cd C:\Users\AAA\Projects\hsmoa-health-food-schedule
node server.js
```

브라우저에서 `http://localhost:3000` 접속

## 핸드폰에서 밖에서 보기

맞습니다. **집 PC에서만 돌리면 외부(데이터/Wi‑Fi 밖)에서는 접속할 수 없습니다.** 인터넷에 배포해야 합니다.

### 추천: Render (무료 티어)

1. [render.com](https://render.com) 가입
2. **New → Web Service**
3. GitHub에 이 프로젝트를 올린 뒤 연결 (또는 Render CLI로 배포)
4. 설정:
   - **Build Command**: (비워둠)
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. 배포 후 `https://your-app.onrender.com` 주소를 핸드폰 북마크에 저장

### 다른 선택지

- **Railway** – 간단 배포, 무료 크레딧
- **Fly.io** – 소규모 앱에 적합
- **집 PC 터널** – ngrok/Cloudflare Tunnel로 임시 외부 접속 (테스트용)

## 기능

- 카테고리: 식품 > 건강식품 (3차 전체)
- 홈쇼핑사: 전 채널
- 날짜 변경 (오늘 기준 3개월 전 ~ 7일 후, 원본 API 제한)
- 4시간마다 자동 새로고침
- 방송 중(LIVE) 표시

## 주의

홈쇼핑모아 웹 API를 활용합니다. API 변경 시 동작이 멈출 수 있으며, 상업적 이용 시 [DataHub 공식 API](https://datahub.hsmoa.com/) 사용을 권장합니다.
