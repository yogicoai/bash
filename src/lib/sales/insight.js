import { formatAmount } from './metrics';
import { monthLastDay } from './normalize';

const rel = (val, base) => (base > 0 ? ((val - base) / base) * 100 : 0);

/**
 * 매장 종합 총평 — 숫자는 계산해서 넘기고 여기선 문장만 조립한다.
 * 원본 buildStoreInsight()와 동일한 판정 기준.
 */
export function buildStoreInsight({ store, k, avg, months, monthAmt, topProd, topColor, premiumMix }) {
  const strengths = [];
  const weaknesses = [];
  const actions = [];

  const aovR = rel(k.aov, avg.aov);
  if (aovR >= 8) strengths.push(`객단가가 전체 평균보다 ${aovR.toFixed(0)}% 높아 고가 제품·업셀이 잘 이뤄지고 있습니다`);
  else if (aovR <= -8) {
    weaknesses.push(`객단가가 평균보다 ${Math.abs(aovR).toFixed(0)}% 낮습니다`);
    actions.push('프리미엄 충전재·대형 사이즈 등 상위 라인 제안을 강화해 객단가를 끌어올리세요');
  }

  if (k.setRate >= avg.setRate * 1.1 && k.setRate > 0)
    strengths.push(`세트 구매율(${k.setRate.toFixed(1)}%)이 평균을 웃돌아 묶음 판매가 강점입니다`);
  else if (k.setRate <= avg.setRate * 0.9) {
    weaknesses.push(`세트 구매율(${k.setRate.toFixed(1)}%)이 평균(${avg.setRate.toFixed(1)}%) 대비 낮습니다`);
    actions.push('빈백+커버+충전재 세트 구성을 매대 전면에 배치하고 세트 할인 안내를 강화하세요');
  }

  if (k.coverRate <= avg.coverRate * 0.9 && avg.coverRate > 0) {
    weaknesses.push(`커버 동시구매율(${k.coverRate.toFixed(1)}%)이 낮습니다`);
    actions.push('본품 구매 시 커버 추가구매(여벌·세탁 대비)를 적극 권유하도록 응대 멘트를 통일하세요');
  } else if (k.coverRate >= avg.coverRate * 1.1 && k.coverRate > 0)
    strengths.push('커버 동시구매율이 평균보다 높아 액세서리 연계 판매가 우수합니다');

  const sofaR = rel(k.sofaRate, avg.sofaRate);
  if (sofaR >= 10) strengths.push('소파(본품) 비중이 평균보다 높아 핵심 제품 판매가 견조합니다');
  else if (sofaR <= -10) {
    weaknesses.push('소파 본품 비중이 평균보다 낮고 액세서리 위주로 팔립니다');
    actions.push('본품(소파·빈백) 체험존을 강화해 메인 제품 전환을 높이세요');
  }

  if (premiumMix >= 60) strengths.push(`프리미엄급 충전재 비중이 ${premiumMix.toFixed(0)}%로 고급화가 잘 정착돼 있습니다`);
  else if (premiumMix <= 35) {
    weaknesses.push(`프리미엄 충전재 비중이 ${premiumMix.toFixed(0)}%로 낮습니다`);
    actions.push('상담 시 프리미엄·EPP 충전재의 내구성·복원력 차이를 시연해 업그레이드를 유도하세요');
  }

  let trendTxt = '';
  if (months.length >= 2) {
    const d = rel(monthAmt[monthAmt.length - 1], monthAmt[monthAmt.length - 2]);
    if (d >= 8) trendTxt = `최근 매출 흐름도 상승세(직전월 대비 +${d.toFixed(0)}%)로 긍정적입니다.`;
    else if (d <= -8) {
      trendTxt = `다만 최근 매출이 직전월 대비 ${Math.abs(d).toFixed(0)}% 둔화돼 점검이 필요합니다.`;
      actions.push('최근 매출 둔화 원인(방문객·재고·프로모션)을 점검하고 단기 프로모션을 검토하세요');
    }
  }

  const parts = [
    `${store}은(는) 선택 기간 동안 총 ${k.totalAmount > 0 ? formatAmount(k.totalAmount) : '0원'} 매출, ${k.oc.toLocaleString()}건의 구매가 발생했습니다.`,
  ];
  if (strengths.length) parts.push(`강점으로는 ${strengths.slice(0, 2).join(', ')} 점이 돋보입니다.`);
  if (weaknesses.length) parts.push(`반면 개선점으로는 ${weaknesses.slice(0, 2).join(', ')} 부분이 있습니다.`);
  if (!strengths.length && !weaknesses.length) parts.push('전반적으로 전체 매장 평균과 유사한 균형 잡힌 실적을 보이고 있습니다.');
  if (trendTxt) parts.push(trendTxt);
  if (topProd.length)
    parts.push(`주력 제품은 ${topProd[0][0]}이며, 인기 커버 색상은 ${topColor.length ? topColor[0][0] : '-'}입니다.`);

  return {
    summary: parts.join(' '),
    strengths,
    weaknesses,
    actions: [...new Set(actions)].slice(0, 4),
  };
}

/**
 * 핵심 지표 코멘트. 평균 대비 5% 이내는 "평균 수준"으로 보고 생략한다.
 * 월 추세는 최근 월이 부분월이면 직전 월도 같은 일자까지만 잘라 공정 비교한다.
 */
export function buildComments({ k, avg, months, rows, topProd, topColor }) {
  const comments = [];

  const cmp = (val, base, label, unit) => {
    if (base <= 0) return;
    const diff = val - base;
    if (Math.abs(diff) < base * 0.05) return;
    const pct = Math.abs((diff / base) * 100);
    const shown = unit === '원' ? Math.round(diff).toLocaleString() : diff.toFixed(1);
    comments.push({
      type: diff > 0 ? 'good' : 'warn',
      text: `${label}이(가) 전체 매장 평균(${base.toFixed(unit === '원' ? 0 : 1)}${unit}) 대비 ${diff > 0 ? '+' : ''}${shown}${unit} (${pct.toFixed(0)}% ${diff > 0 ? '높' : '낮'}음)`,
    });
  };

  cmp(k.aov, avg.aov, '객단가', '원');
  cmp(k.setRate, avg.setRate, '세트 구매율', '%');
  cmp(k.coverRate, avg.coverRate, '커버 동시구매율', '%');
  cmp(k.sofaRate, avg.sofaRate, '소파 비중', '%');

  if (months.length >= 2) {
    const lastM = months[months.length - 1];
    const prevM = months[months.length - 2];
    const lastDates = rows
      .filter((r) => r.month === lastM)
      .map((r) => Number(String(r.date || '').slice(8, 10)))
      .filter((n) => n > 0);
    const cutoffDay = lastDates.length ? Math.max(...lastDates) : 31;
    const isPartial = cutoffDay < Number(monthLastDay(lastM).slice(8, 10));

    const lastSum = rows.filter((r) => r.month === lastM).reduce((a, r) => a + r.amount, 0);
    const prevSum = rows
      .filter((r) => r.month === prevM && (!isPartial || Number(String(r.date || '').slice(8, 10)) <= cutoffDay))
      .reduce((a, r) => a + r.amount, 0);

    if (prevSum > 0) {
      const d = ((lastSum - prevSum) / prevSum) * 100;
      if (Math.abs(d) >= 5)
        comments.push({
          type: d > 0 ? 'good' : 'warn',
          text: `최근 월(${lastM.slice(5)}월) 매출이 직전 월(${prevM.slice(5)}월) 대비 ${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}% ${d > 0 ? '증가' : '감소'}했습니다${isPartial ? ` (양월 모두 1~${cutoffDay}일 기준)` : ''}`,
        });
    }
  }

  if (topProd.length)
    comments.push({ type: '', text: `가장 많이 팔린 제품은 ${topProd[0][0]} (${topProd[0][1].toLocaleString()}개)입니다` });
  if (topColor.length)
    comments.push({ type: '', text: `인기 커버 색상 1위는 ${topColor[0][0]} (${topColor[0][1].toLocaleString()}개)입니다` });
  if (comments.length === 0) comments.push({ type: '', text: '전반적으로 전체 매장 평균과 유사한 수준입니다' });

  return comments;
}
