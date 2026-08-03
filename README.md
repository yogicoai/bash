# 요기보 통합 대시보드 (dash)

흩어져 있던 사내 대시보드의 **단일 진입점**. Cafe24에 HTML을 FTP로 올리던 방식을 대체한다.

```
dash (이 앱)          유일한 프론트엔드 — 로그인 · 화면 · 프록시
onlineData/lib        데이터/집계 레이어 (모듈 59개, 오프라인 집계 포함)
web.js / offorder     원천 API (Express, cloudtype 배포)
```

## 실행

```bash
npm install
npm run dev        # http://localhost:5800
```

`.env.example`를 `.env.local`로 복사해서 값을 채운다.

| 변수 | 설명 |
|---|---|
| `DASH_PASSWORD` | 공용 로그인 비밀번호 |
| `DASH_SESSION_SECRET` | 세션 쿠키 서명 키 (랜덤 64자 hex) |
| `REALTIME_API` | realtime 서버 주소 |
| `OFFORDER_API` | offorder 서버 주소 |

## 원천 API

| 이름 | 배포 | 로컬 소스 |
|---|---|---|
| **realtime** | `port-0-realtime-…cloudtype.app` | `Desktop/DB 데이터/실시간 상품전송/실시간 순위/web.js` |
| **offorder** | `port-0-offorder-…cloudtype.app` | `Desktop/오프라인/index.js` |

**두 서버 모두 라우트에 인증이 없다.** 그래서 브라우저가 직접 부르지 못하게 하고,
모든 호출을 서버사이드 프록시로 통과시킨다.

```
/api/rt/api/warehouse-stock   →  {REALTIME_API}/api/warehouse-stock
/api/off/api/work-hours       →  {OFFORDER_API}/api/work-hours
```

- 업스트림 주소가 클라이언트 번들에 남지 않는다
- 접근 통제가 dash 로그인 하나로 묶인다
- 엑셀 다운로드처럼 JSON이 아닌 응답도 그대로 통과한다

## 이관 현황

`src/lib/links.js`가 홈 화면의 단일 진실 공급원이다. 화면을 하나 완성할 때마다
해당 항목의 `status`를 `planned` → `ready`로 바꾼다.

| Phase | 대상 | 원본 | 비고 |
|---|---|---|---|
| 0 | 셸 · 로그인 · 홈 · 프록시 | — | ✅ 완료 |
| 1 | 창고재고 | `deliveryOFF/창고재고.html` (20KB) | 파일럿 |
| 2 | 영업분석 · 매장별 판매분석 | (131KB + 134KB) | `onlineData/lib/offline.js` 재사용 |
| 3 | Y리그 현황 · 누적랭킹 | (80KB + 29KB) | `onlineData/lib/jwasuLeague.js` 재사용 |
| 4 | 재고관리 | (44KB) | offorder 스냅샷 연동 |
| 5 | 주간보고 | (246KB) | 앞 단계 재사용으로 축소 |
| 6 | 나머지 앱 zone 연결 | onlineData · mkboard · BlogData · mktCl · cs | `next.config.js` rewrites |

**이관하지 않는 것** — 오프라인 주문서 2종은 Cafe24 상품·쿠폰 API에 물려 있어 그대로 두고 링크만 연결한다.

- https://yogibo.kr/off/order/index.html
- https://yogibo.kr/off/order/admin.html

## Phase 3 주의사항

`onlineData/lib/jwasuLeague.js`는 **원천 집계만** 한다. 실제 Y리그 화면은 프론트에서
노출 보정(특정 인원 화이트리스트 · 근무지 이동 분리)을 추가로 적용하기 때문에 숫자가 소폭 다르다.
이관할 때 `deliveryOFF/Y리그현황.html`에서 그 보정 규칙을 함께 옮겨야 기존 화면과 순위가 맞는다.
