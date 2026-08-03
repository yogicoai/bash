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
| 1 | 창고재고 | `deliveryOFF/창고재고.html` (20KB) | ✅ 완료 — 이후 화면의 패턴 기준 |
| 2 | 영업분석 · 매장별 판매분석 | (131KB + 134KB) | ✅ 완료 — 원본 2개가 20줄만 달라 화면 1개 + 설정 2벌로 통합 |
| 3 | Y리그 현황 · 누적랭킹 | (80KB + 29KB) | `onlineData/lib/jwasuLeague.js` 재사용 |
| 4 | 재고관리 | (44KB) | offorder 스냅샷 연동 |
| 5 | 주간보고 | (246KB) | 앞 단계 재사용으로 축소 |
| 6 | 나머지 앱 zone 연결 | onlineData · mkboard · BlogData · mktCl · cs | `next.config.js` rewrites |

**이관하지 않는 것** — 오프라인 주문서 2종은 Cafe24 상품·쿠폰 API에 물려 있어 그대로 두고 링크만 연결한다.

- https://yogibo.kr/off/order/index.html
- https://yogibo.kr/off/order/admin.html

## 화면 만드는 패턴 (Phase 1에서 확정)

```
src/app/<경로>/page.jsx        서버 컴포넌트 — searchParams 파싱 후 PageShell로 감싼다
src/app/<경로>/*.jsx           'use client' — 화면 로직
src/lib/api.js                 rtGet / offGet — 프록시로만 나간다
src/hooks/useAsync.js          { data, error, loading, reload }, skip 옵션 지원
src/components/PageShell.jsx   홈 복귀 + 제목 + 액션
src/components/DataState.jsx   로딩 / 에러 / 빈 상태
```

원천 API는 HTTP 200에 `{ success:false, message }`를 실어 보내는 경우가 있어서
`api.js`가 이를 에러로 승격시킨다. 401이면 로그인으로 보낸다.

## 판매 분석 두 화면

`영업분석`과 `매장별 판매분석`은 **같은 대시보드**다. 원본 HTML 2개(265KB)의 실제 차이는 20줄뿐이었고,
그 차이를 `src/lib/sales/config.js`의 `VARIANTS` 두 벌로 흡수했다.

| | `analysis` (영업분석) | `byStore` (매장별 판매분석) |
|---|---|---|
| EPP 충전재 | `프리미엄EPP`로 별도 분류 | `프리미엄`에 합산 |
| 커버 색상 제외 | 기본 목록 | `유니콘`·`도그` 추가 |

`VARIANTS`에 정규식이 들어 있어서 서버 컴포넌트에서 객체째로 넘기면 직렬화 경계를 넘지 못한다.
그래서 페이지는 `variantKey` 문자열만 넘기고 클라이언트에서 설정을 찾는다.

집계 규칙(원본 유지):
- 제외 제품 — 교환·차액·부직포백·배송비 등 정산성 항목
- 제외 매장 — `요기보매니저영업`
- 매장 목록은 해당 기간에 **매출이 발생한** 매장만 노출
- CVR = 구매건수 ÷ 방문수(`/api/jwasu/table`의 count 합)
- 매장 리포트의 월 추세는 최근 월이 부분월이면 직전 월도 같은 일자까지만 잘라 비교

## 창고재고 데이터 주의

`/api/warehouse-stock`은 매장명(`store_tokens`의 키)을 이카운트 창고명과 이름 규칙으로 매칭한다.
**2026-08-03 스냅샷 기준 28개 매장 중 10개만 매칭된다** — 나머지는 창고 스냅샷(`warehouse.stocks`)에
해당 창고가 없어서 "매핑된 창고를 찾을 수 없습니다"가 뜬다. 원본 HTML도 동일하게 동작한다.
화면 문제가 아니라 이카운트 적재 범위 문제다.

매칭되는 매장: 롯데대구 · 롯데동탄 · 롯데안산 · 스타필드고양 · 스타필드하남 ·
신세계센텀시티몰 · 현대미아 · 김포공항 롯데몰(= 롯데몰김포공항) · 신세계본점

## Phase 3 주의사항

`onlineData/lib/jwasuLeague.js`는 **원천 집계만** 한다. 실제 Y리그 화면은 프론트에서
노출 보정(특정 인원 화이트리스트 · 근무지 이동 분리)을 추가로 적용하기 때문에 숫자가 소폭 다르다.
이관할 때 `deliveryOFF/Y리그현황.html`에서 그 보정 규칙을 함께 옮겨야 기존 화면과 순위가 맞는다.
