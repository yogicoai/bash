/**
 * 매니저 마스터(/api/jwasu/admin/managers) 정규화.
 *
 * 현황과 누적랭킹이 조회 방식이 미묘하게 다르다 — 원본을 그대로 보존한다.
 *   현황(strict) : 매장이 일치하는 매니저만. 이름만으로 타 매장 동명이인을 끌어오지 않는다.
 *   누적(loose)  : 매장 매칭 실패 시 이름 단독 매칭으로 폴백.
 */

const strip = (s) => String(s || '').replace(/\s+/g, '');

/** managers 배열 → 조회용 맵 (`${store}_${name}` + `_name_${name}`) */
export function buildManagerMap(managers) {
  const map = {};
  for (const mgr of managers || []) {
    const name = String(mgr.managerName || '').trim();
    if (!name) continue;
    const info = {
      managerName: name,
      storeName: mgr.storeName || '',
      role: mgr.role || '매니저',
      consignment: mgr.consignment || 'N',
      isActive: mgr.isActive !== false,
    };
    // 같은 매장·이름 중복 등록 시 활성 매니저 우선 — 비활성 중복이 활성을 덮어쓰지 않도록
    const key = `${mgr.storeName}_${name}`;
    const prev = map[key];
    if (!prev || (prev.isActive === false && info.isActive)) map[key] = info;

    const nk = `_name_${name}`;
    if (!map[nk] || (map[nk].isActive === false && info.isActive)) map[nk] = info;
  }
  return map;
}

/** 현황용 — 매장이 일치하는 매니저만 반환 */
export function getManagerStrict(mgrMap, name, storeName) {
  if (!mgrMap || !name) return null;
  if (storeName && mgrMap[`${storeName}_${name}`]) return mgrMap[`${storeName}_${name}`];

  if (storeName) {
    const sN = strip(storeName);
    const nN = strip(name);
    for (const k in mgrMap) {
      if (k.startsWith('_name_')) continue;
      const m = mgrMap[k];
      if (strip(m.storeName) === sN && strip(m.managerName) === nN) return m;
    }
    return null; // 매장이 일치하는 매니저가 없으면 이름 단독 매칭을 하지 않는다
  }
  return mgrMap[`_name_${name}`] || null;
}

/** 누적랭킹용 — 매장 매칭 실패 시 이름 단독 폴백 */
export function getManagerLoose(mgrMap, name, storeName) {
  if (!mgrMap || !name) return null;
  return mgrMap[`${storeName}_${name}`] || mgrMap[`_name_${name}`] || null;
}

/** 해당 매장에 활성 매니저가 하나라도 있는가 (스토어 종목 필터) */
export function isStoreActive(mgrMap, storeName) {
  if (!mgrMap || !storeName) return false;
  const mgrs = Object.values(mgrMap).filter((m) => m.storeName === storeName);
  return mgrs.length > 0 && mgrs.some((m) => m.isActive === true);
}
