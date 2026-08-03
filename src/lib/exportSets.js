/**
 * 데이터 내려받기 — dash가 화면에 쓰는 원장을 그대로 CSV/JSON으로 뽑는다.
 *
 * onlineData/lib/dataExport.js 와 같은 취지 — 받아서 각자 엑셀·BI로 가공하라는 용도.
 * ✅ 개인정보 없음: 매출은 상품/매장 단위, 재고는 품목 단위 (고객명·연락처·주소 미포함).
 *    판매사원명은 실적 집계용으로만 들어간다.
 *
 * 화면과 같은 프록시(/api/rt, /api/off)를 타므로 별도 인증이 필요 없다.
 */

/** 기간이 필요한 데이터셋인지 */
export const needsPeriod = (id) => DATASETS.find((d) => d.id === id)?.period ?? false;

export const DATASETS = [
  {
    id: 'offline-sales',
    name: '오프라인 매출 원장',
    desc: '매장·판매사원·상품 단위 판매 라인 (기간 필요)',
    period: true,
    source: 'realtime · /api/orders',
    columns: ['orderNo', 'date', 'month', 'week', 'store', 'manager', 'productName', 'color', 'category', 'beadType', 'qty', 'amount', 'orderHasSet', 'orderHasCover'],
  },
  {
    id: 'jwasu',
    name: 'Y리그 좌수 실적',
    desc: '매장·매니저별 목표 대비 좌수 (기간 필요)',
    period: true,
    source: 'realtime · /api/jwasu/dashboard',
    columns: ['storeName', 'managerName', 'role', 'count', 'targetCount', 'rate', 'joinDate'],
  },
  {
    id: 'jwasu-daily',
    name: 'Y리그 일자별 좌수',
    desc: '일자·매장·매니저별 좌수 원자료 (기간 필요)',
    period: true,
    source: 'realtime · /api/jwasu/table',
    columns: ['date', 'storeName', 'managerName', 'role', 'count', 'revenue'],
  },
  {
    id: 'stock-center',
    name: '물류센터 재고',
    desc: '물류센터 품목별 현재 재고 (기간 불필요)',
    period: false,
    source: 'realtime · /api/stock/전체',
    columns: ['category', 'code', 'name', 'spec', 'qty'],
  },
  {
    id: 'stock-store',
    name: '매장 창고재고',
    desc: '선택 매장의 창고 재고 (매장 선택 필요)',
    period: false,
    needsStore: true,
    source: 'realtime · /api/warehouse-stock',
    columns: ['group', 'code', 'name', 'spec', 'storeQty', 'demoQty'],
  },
];

/** 응답 → 행 배열 (데이터셋마다 감싸는 키가 다르다) */
export function rowsOf(id, json) {
  if (id === 'offline-sales') return json?.orders || [];
  if (id === 'jwasu') return json?.data || [];
  if (id === 'jwasu-daily') return json?.report || [];
  if (id === 'stock-center') return Array.isArray(json) ? json : [];
  if (id === 'stock-store') return json?.items || [];
  return [];
}

const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** BOM을 붙여 엑셀에서 한글이 깨지지 않게 한다 */
export function toCsv(rows, columns) {
  const cols = columns?.length ? columns : [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(','));
  return '﻿' + lines.join('\n');
}

export function download(filename, text, mime) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
