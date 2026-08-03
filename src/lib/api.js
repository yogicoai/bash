'use client';

/**
 * 클라이언트 → dash 프록시 호출 헬퍼.
 *
 * 원천 서버 주소는 절대 여기 들어오지 않는다. 항상 /api/rt/* · /api/off/* 로만 나간다.
 * (실제 업스트림 지정은 서버사이드 src/lib/upstream.js)
 */

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function buildUrl(prefix, path, params) {
  const clean = String(path).replace(/^\/+/, '');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const search = qs.toString();
  return `/api/${prefix}/${clean}${search ? `?${search}` : ''}`;
}

async function get(prefix, path, params) {
  let res;
  try {
    res = await fetch(buildUrl(prefix, path, params), { cache: 'no-store' });
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다.', 0);
  }

  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new ApiError('세션이 만료되었습니다.', 401);
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new ApiError(`응답을 해석할 수 없습니다. (${res.status})`, res.status);

  // 원천 API는 HTTP 200에 { success:false, message } 를 실어 보내는 경우가 있다.
  // 원천 API는 HTTP 200에 실패를 실어 보내기도 한다 (realtime/offorder는 success, onlineData는 ok)
  if (json.success === false || json.ok === false)
    throw new ApiError(json.message || json.error || '요청이 실패했습니다.', res.status);
  if (!res.ok) throw new ApiError(json.message || json.error || `요청이 실패했습니다. (${res.status})`, res.status);

  return json;
}

/** realtime(web.js) 호출 — 예: rtGet('api/warehouse-stock', { store }) */
export const rtGet = (path, params) => get('rt', path, params);

/** offorder(오프라인/index.js) 호출 */
export const offGet = (path, params) => get('off', path, params);

/** 온라인 판매분석(onlineData) 호출 */
export const onGet = (path, params) => get('on', path, params);

/** 파일 다운로드 등 프록시 URL이 직접 필요할 때 */
export const rtUrl = (path, params) => buildUrl('rt', path, params);
export const offUrl = (path, params) => buildUrl('off', path, params);
