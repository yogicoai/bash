import { upstreamBase } from '@/lib/upstream';

/**
 * 좌수 — 오늘 / 이번 달, 매장별·사람별.
 *
 * 원장(jwasu/table)은 이번 달 등록이 한 줄씩 다 들어와 1.7MB 가 넘는다.
 * 화면이 그걸 통째로 받아 접을 이유가 없어서 서버에서 접어 내려준다.
 * 목표(targetCount)는 원장에 없으므로 jwasu/dashboard 에서 함께 가져온다.
 *
 * 원장에 revenue 필드가 있지만 값이 채워지지 않아(전부 0) 쓰지 않는다.
 * 매출은 api/orders 가 원천이다.
 */

const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

async function rt(path, params) {
  const url = new URL(`${upstreamBase('rt')}/${path}`);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export async function GET(req) {
  const today = todayKST();
  const month = new URL(req.url).searchParams.get('month') || today.slice(0, 7);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

  let ledger;
  let dashboard;
  try {
    [ledger, dashboard] = await Promise.all([
      rt('api/jwasu/table', { month }),
      rt('api/jwasu/dashboard', {
        searchType: 'month', month,
        date: `${month}-${lastDay}`, startDate: `${month}-01`, endDate: `${month}-${lastDay}`,
      }).catch(() => null),
    ]);
  } catch (err) {
    return Response.json({ success: false, error: String(err.message || err) }, { status: 502 });
  }

  const stores = new Map();
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, { today: 0, month: 0, target: 0, people: new Map() });
    return stores.get(name);
  };
  const person = (st, name, role) => {
    const key = `${name}|${role}`;
    if (!st.people.has(key)) st.people.set(key, { name, role, today: 0, month: 0, target: 0 });
    return st.people.get(key);
  };

  // 등록 원장 — 이번 달 줄만 세고, 오늘 줄은 따로 센다
  const byDate = new Map();
  for (const r of ledger?.report || []) {
    const date = String(r.date || '').slice(0, 10);
    if (!date.startsWith(month)) continue;
    const n = Number(r.count || 0);
    byDate.set(date, (byDate.get(date) || 0) + n);

    const st = store(r.storeName || '미지정');
    const p = person(st, r.managerName || '(이름 없음)', r.role || '');
    st.month += n;
    p.month += n;
    if (date === today) {
      st.today += n;
      p.today += n;
    }
  }

  // 목표는 사람마다 있고, 매장 목표는 그 합이다
  for (const r of dashboard?.data || []) {
    if (!r.storeName) continue;
    const st = store(r.storeName);
    const p = person(st, r.managerName || '(이름 없음)', r.role || '');
    const t = Number(r.targetCount || 0);
    p.target = t;
    st.target += t;
  }

  return Response.json(
    {
      success: true,
      month,
      today,
      daily: [...byDate.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      stores: Object.fromEntries(
        [...stores.entries()].map(([name, v]) => [
          name,
          {
            today: v.today,
            month: v.month,
            target: v.target,
            people: [...v.people.values()].sort((a, b) => b.month - a.month),
          },
        ]),
      ),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';
