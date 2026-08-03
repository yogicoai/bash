/**
 * 독립 앱(zone) 주소 — 배포본(Vercel)을 기본으로 쓴다.
 *
 * dash는 이 앱들을 다시 만들지 않고 팝업(iframe)으로 띄운다.
 * 배포 주소 6곳 모두 X-Frame-Options·CSP frame-ancestors가 없어 삽입이 가능하다.
 *
 * 로컬에서 개발 중인 앱을 보려면 NEXT_PUBLIC_ZONE_* 로 덮어쓴다(빌드 시 인라인).
 *   예) NEXT_PUBLIC_ZONE_ADS=http://localhost:5810
 * 로컬 dev 포트: 5200 onlineData · 5600 mktCl · 5810 mkboard · 5820 BlogData · 5830 cs-self-guide
 */
const env = (key, fallback) => process.env[key] || fallback;

export const ZONES = {
  online: env('NEXT_PUBLIC_ZONE_ONLINE', 'https://on-iota-three.vercel.app/'),
  ads: env('NEXT_PUBLIC_ZONE_ADS', 'https://mkt-sage.vercel.app/'),
  blog: env('NEXT_PUBLIC_ZONE_BLOG', 'https://blog-livid-sigma-32.vercel.app/'),
  b2b: env('NEXT_PUBLIC_ZONE_B2B', 'https://mktcr.vercel.app/send'),
  cs: env('NEXT_PUBLIC_ZONE_CS', 'https://cs-fawn-alpha.vercel.app/admin'),
  design: env('NEXT_PUBLIC_ZONE_DESIGN', 'https://design-t-omega.vercel.app/'),
  /** 일일매출 리포트 — 날짜 파라미터가 필요해 열 때 오늘 날짜를 붙인다 */
  onlineReport: env('NEXT_PUBLIC_ZONE_ONLINE_REPORT', 'https://on-iota-three.vercel.app/api/report'),
};

/** 한국 기준 오늘 (YYYY-MM-DD) — 리포트 날짜 파라미터용 */
export function todayKST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/** dated 항목의 실제 주소 — 누를 때 오늘 날짜를 붙여 만든다 */
export function resolveHref(item) {
  if (!item?.dated) return item?.href;
  const sep = item.href.includes('?') ? '&' : '?';
  return `${item.href}${sep}date=${todayKST()}`;
}

/** 로컬로 덮어썼을 때만 쓰이는 실행 안내 */
export const ZONE_COMMANDS = {
  'zone-online': 'cd Desktop/onlineData && npm run dev',
  'zone-ads': 'cd Desktop/mkboard && npm run dev',
  'zone-blog': 'cd Desktop/BlogData && npm run dev',
  'zone-b2b': 'cd Desktop/mktCl && npm run dev',
  'zone-cs': 'cd Desktop/cs/cs-self-guide && npm run dev',
};

/** 로컬 주소를 가리킬 때만 실행 안내를 띄운다 */
export const isLocal = (href) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(String(href || ''));
