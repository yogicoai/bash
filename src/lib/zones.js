/**
 * 독립 앱(zone) 주소.
 *
 * dash는 이 앱들을 다시 만들지 않고 팝업(iframe)으로 띄운다.
 * Next는 기본적으로 X-Frame-Options를 걸지 않아 삽입이 가능하다.
 *
 * 로컬 dev 기본 포트 — 원래 mkboard·BlogData·cs-self-guide가 모두 3000이라
 * 동시에 못 띄웠다. 각 앱 package.json의 dev/start에 -p 를 붙여 나눠 놓았다.
 *   5200 onlineData · 5600 mktCl · 5810 mkboard · 5820 BlogData · 5830 cs-self-guide
 *
 * 배포하면 NEXT_PUBLIC_ZONE_* 로 실제 주소를 넣는다(빌드 시 인라인).
 */
const env = (key, fallback) => process.env[key] || fallback;

export const ZONES = {
  online: env('NEXT_PUBLIC_ZONE_ONLINE', 'http://localhost:5200'),
  ads: env('NEXT_PUBLIC_ZONE_ADS', 'http://localhost:5810'),
  blog: env('NEXT_PUBLIC_ZONE_BLOG', 'http://localhost:5820'),
  b2b: env('NEXT_PUBLIC_ZONE_B2B', 'http://localhost:5600'),
  cs: env('NEXT_PUBLIC_ZONE_CS', 'http://localhost:5830'),
};

/** 각 zone을 띄우는 명령 — 팝업이 비어 있을 때 안내에 쓴다 */
export const ZONE_COMMANDS = {
  'zone-online': 'cd Desktop/onlineData && npm run dev',
  'zone-ads': 'cd Desktop/mkboard && npm run dev',
  'zone-blog': 'cd Desktop/BlogData && npm run dev',
  'zone-b2b': 'cd Desktop/mktCl && npm run dev',
  'zone-cs': 'cd Desktop/cs/cs-self-guide && npm run dev',
};
