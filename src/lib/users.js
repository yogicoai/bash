/**
 * 계정 관리 — DB 없이 환경변수로만.
 *
 * DASH_USERS 형식 (쉼표 또는 줄바꿈으로 구분):
 *   yogico:비밀번호, 홍길동:sha256:9f86d0818...
 *
 * 비밀번호는 평문 또는 `sha256:<hex>` 를 쓴다.
 * 해시값은 `npm run hash -- <비밀번호>` 로 만든다.
 *
 * 계정을 지우려면 DASH_USERS 에서 그 줄만 빼면 된다(= 즉시 철회).
 * DASH_USERS 가 비어 있으면 기존 DASH_PASSWORD 단일 비밀번호로 동작한다.
 */

const LEGACY_ID = 'yogibo';

/** "id:secret, id:secret" → [{ id, secret }] */
export function listUsers() {
  const raw = process.env.DASH_USERS;
  if (raw && raw.trim()) {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const i = entry.indexOf(':');
        if (i < 1) return null;
        return { id: entry.slice(0, i).trim(), secret: entry.slice(i + 1).trim() };
      })
      .filter((u) => u && u.id && u.secret);
  }

  // 폴백 — 예전 단일 비밀번호 설정을 그대로 쓸 수 있게
  const legacy = process.env.DASH_PASSWORD;
  return legacy ? [{ id: LEGACY_ID, secret: legacy }] : [];
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 길이 차이로 정보가 새지 않도록 상수시간 비교 */
function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length, 1);
  for (let i = 0; i < n; i++) diff |= x.charCodeAt(i % (x.length || 1)) ^ y.charCodeAt(i % (y.length || 1));
  return diff === 0;
}

/** 성공 시 { id }, 실패 시 null */
export async function verifyUser(id, password) {
  const users = listUsers();
  if (!users.length) return null;

  const wanted = String(id || '').trim();
  const user = users.find((u) => u.id === wanted);

  // 아이디가 없어도 비교 비용을 비슷하게 유지해 계정 존재 여부가 드러나지 않게 한다
  const target = user ? user.secret : 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

  let ok;
  if (target.startsWith('sha256:')) ok = safeEqual(await sha256Hex(String(password ?? '')), target.slice(7).toLowerCase());
  else ok = safeEqual(password, target);

  return user && ok ? { id: user.id } : null;
}

/** 로그인 화면에 아이디 입력을 보여줄지 — 단일 비밀번호 모드면 감춘다 */
export const isMultiUser = () => Boolean(process.env.DASH_USERS && process.env.DASH_USERS.trim());
