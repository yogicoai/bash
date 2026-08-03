'use client';

/**
 * 판매 대시보드용 SVG 차트.
 * 원본 HTML은 SVG를 문자열로 조립했는데, 여기선 같은 좌표 계산을 React 엘리먼트로 옮겼다.
 * 외부 차트 라이브러리를 쓰지 않는 것도 원본과 동일 — 번들이 늘지 않는다.
 */

const AXIS = 'chart-axis';
const GRID = 'chart-grid';
const VAL = 'chart-value';

function Empty({ icon = '📊', text }) {
  return (
    <div className="chart-empty">
      <div className="chart-empty-ic">{icon}</div>
      {text}
    </div>
  );
}

/** 세로 막대 — 월별 추이 · 요일별 패턴 · KPI 단일지표 · 충전재(단월) */
export function BarChart({ data, height = 340, yFormat = (v) => Math.round(v).toLocaleString(), valueFormat, onBarClick, emptyText = '데이터가 없습니다' }) {
  if (!data?.length) return <Empty text={emptyText} />;

  const W = 920, H = height, padL = 64, padR = 24, padT = 26, padB = 46;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = innerW / data.length;
  const barW = Math.min(64, slot * 0.58);
  const fmt = valueFormat || yFormat;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <g key={t}>
            <line className={GRID} x1={padL} x2={W - padR} y1={y} y2={y} />
            <text className={AXIS} x={padL - 10} y={y + 4} textAnchor="end">{yFormat(max * t)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = padL + slot * i + slot / 2;
        const h = (d.value / max) * innerH;
        const y = padT + innerH - h;
        const clickable = !!onBarClick;
        return (
          <g key={d.label + i} onClick={clickable ? () => onBarClick(d, i) : undefined} style={clickable ? { cursor: 'pointer' } : undefined}>
            {clickable && <rect x={cx - slot / 2} y={padT} width={slot} height={innerH} fill="transparent" />}
            <rect x={cx - barW / 2} y={y} width={barW} height={Math.max(h, 0)} rx={6} fill={d.color || '#4f46e5'}>
              {d.title && <title>{d.title}</title>}
            </rect>
            <text className={VAL} x={cx} y={y - 8} textAnchor="middle" pointerEvents="none">{fmt(d.value)}</text>
            {d.subLabel && (
              <text className={AXIS} x={cx} y={y - 24} textAnchor="middle" fontSize="11" pointerEvents="none">{d.subLabel}</text>
            )}
            <text
              className={AXIS}
              x={cx}
              y={H - padB + 22}
              textAnchor="middle"
              fontWeight={d.emphasis ? 700 : 500}
              fill={d.labelColor || undefined}
              pointerEvents="none"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 다계열 라인 — 충전재 비중(%) · 통합 KPI 추이 */
export function LineChart({
  xLabels,
  series,
  height = 400,
  yTicks = [0, 25, 50, 75, 100],
  yFormat = (v) => `${v}%`,
  normalizePerSeries = false,
  area = false,
  onPointClick,
  emptyText = '데이터가 없습니다',
}) {
  if (!xLabels?.length || !series?.length) return <Empty icon="📈" text={emptyText} />;

  const W = 920, H = height, padL = 58, padR = 24, padT = 24, padB = 46;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xs = xLabels.map((_, i) => padL + (xLabels.length > 1 ? (i * innerW) / (xLabels.length - 1) : innerW / 2));

  const maxOf = (s) => Math.max(1, ...s.values);
  const yOf = (s, v) => (normalizePerSeries ? padT + innerH * (1 - v / maxOf(s)) : padT + innerH - (v / 100) * innerH);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
      {yTicks.map((g) => {
        const y = normalizePerSeries ? padT + innerH * (1 - g / 100) : padT + innerH - (g / 100) * innerH;
        return (
          <g key={g}>
            <line className={GRID} x1={padL} x2={W - padR} y1={y} y2={y} />
            {!normalizePerSeries && (
              <text className={AXIS} x={padL - 10} y={y + 4} textAnchor="end">{yFormat(g)}</text>
            )}
          </g>
        );
      })}
      {xLabels.map((m, i) => (
        <text key={m} className={AXIS} x={xs[i]} y={H - padB + 22} textAnchor="middle">{m}</text>
      ))}

      {series.map((s) => {
        const pts = s.values.map((v, i) => [xs[i], yOf(s, v), v]);
        const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');
        const areaD = `M${pts[0][0]},${padT + innerH} ${pts.map((p) => `L${p[0]},${p[1]}`).join(' ')} L${pts[pts.length - 1][0]},${padT + innerH} Z`;
        return (
          <g key={s.key}>
            {area && <path d={areaD} fill={s.color} fillOpacity="0.09" />}
            <path d={line} stroke={s.color} strokeWidth="2.8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <g key={i}>
                {onPointClick && (
                  <circle cx={p[0]} cy={p[1]} r={9} fill={s.color} fillOpacity={0} style={{ cursor: 'pointer' }} onClick={() => onPointClick(s, xLabels[i], i)}>
                    <title>{`${s.label} · ${xLabels[i]} · 클릭하여 제품 보기`}</title>
                  </circle>
                )}
                <circle cx={p[0]} cy={p[1]} r={5} fill="var(--panel)" stroke={s.color} strokeWidth="2.5" pointerEvents="none" />
                <text className={VAL} x={p[0]} y={p[1] - 12} textAnchor="middle" pointerEvents="none">{s.fmt(p[2])}</text>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** 가로 랭킹 막대 — 제품 TOP · 커버 색상 TOP */
export function RankBarChart({ items, nameWidth = 290, rowH = 30, gradient = true, showSwatch = false, onItemClick, emptyText = '데이터가 없습니다', emptyIcon = '📊' }) {
  if (!items?.length) return <Empty icon={emptyIcon} text={emptyText} />;

  const W = 920, padL = nameWidth, padR = showSwatch ? 120 : 70, padT = 10;
  const H = padT + items.length * rowH + 14;
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
      {gradient && (
        <defs>
          <linearGradient id="rankGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
      )}
      {items.map((it, i) => {
        const cy = padT + i * rowH + rowH / 2;
        const bw = Math.max((it.value / max) * (W - padL - padR), 3);
        const rank = i + 1;
        const label = it.name.length > (showSwatch ? 22 : 28) ? it.name.slice(0, showSwatch ? 22 : 28) + '…' : it.name;
        return (
          <g key={it.name + i}>
            <text x={18} y={cy + 4} fill={rank <= 3 ? '#fbbf24' : '#64748b'} fontWeight="800" fontSize="12">#{rank}</text>
            {showSwatch && <circle cx={46} cy={cy} r={8} fill={it.color} stroke="rgba(15,23,42,.15)" strokeWidth="1" />}
            <text className={AXIS} x={padL - 12} y={cy + 4} textAnchor="end" fontWeight="600" fill="var(--text)">{label}</text>
            <rect
              x={padL}
              y={cy - 10}
              width={bw}
              height={20}
              rx={5}
              fill={gradient ? 'url(#rankGrad)' : it.color}
              style={onItemClick ? { cursor: 'pointer' } : undefined}
              onClick={onItemClick ? () => onItemClick(it) : undefined}
            >
              {onItemClick && <title>{`${it.name} · 클릭하여 제품 보기`}</title>}
            </rect>
            <text className={VAL} x={padL + bw + 10} y={cy + 4} pointerEvents="none">
              {it.value.toLocaleString()}
              {it.share != null && <tspan fill="#64748b" fontWeight="600"> ({it.share.toFixed(1)}%)</tspan>}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 100% 가로 비중 바 — 카테고리 분포 */
export function ShareBar({ items, onSegClick }) {
  if (!items?.length) return <Empty icon="🗂️" text="데이터가 없습니다" />;
  const W = 920, H = 120, padL = 20, padR = 20, padT = 30;
  const barW = W - padL - padR;
  const grand = items.reduce((a, i) => a + i.value, 0);
  let x = padL;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
      {items.map((it) => {
        const w = grand > 0 ? (it.value / grand) * barW : 0;
        if (w <= 0) return null;
        const cur = x;
        x += w + 2;
        const pct = grand > 0 ? (it.value / grand) * 100 : 0;
        return (
          <g key={it.name}>
            <rect
              x={cur}
              y={padT}
              width={w}
              height={44}
              rx={w > 40 ? 6 : 2}
              fill={it.color}
              style={onSegClick ? { cursor: 'pointer' } : undefined}
              onClick={onSegClick ? () => onSegClick(it) : undefined}
            >
              <title>{`${it.name} · 클릭하여 제품 보기`}</title>
            </rect>
            {w > 60 && (
              <>
                <text x={cur + w / 2} y={padT + 20} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" pointerEvents="none">{it.name}</text>
                <text x={cur + w / 2} y={padT + 37} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600" pointerEvents="none">
                  {pct.toFixed(1)}% · {it.value.toLocaleString()}개
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** 월별 누적 막대 — 카테고리 월별 추이 */
export function StackedBarChart({ xLabels, keys, grid, colorOf, onSegClick, height = 360 }) {
  if (!xLabels?.length || !keys?.length) return <Empty icon="🗂️" text="데이터가 없습니다" />;

  const W = 920, H = height, padL = 58, padR = 24, padT = 22, padB = 46;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const totals = xLabels.map((m) => keys.reduce((a, k) => a + (grid[m]?.[k] || 0), 0));
  const max = Math.max(1, ...totals);
  const slot = innerW / xLabels.length;
  const barW = Math.min(56, slot * 0.55);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <g key={t}>
            <line className={GRID} x1={padL} x2={W - padR} y1={y} y2={y} />
            <text className={AXIS} x={padL - 10} y={y + 4} textAnchor="end">{Math.round(max * t).toLocaleString()}</text>
          </g>
        );
      })}
      {xLabels.map((m, i) => {
        const cx = padL + slot * i + slot / 2;
        let yStack = padT + innerH;
        return (
          <g key={m}>
            {keys.map((k) => {
              const v = grid[m]?.[k] || 0;
              const h = (v / max) * innerH;
              if (h <= 0) return null;
              yStack -= h;
              return (
                <rect
                  key={k}
                  x={cx - barW / 2}
                  y={yStack}
                  width={barW}
                  height={h}
                  fill={colorOf(k)}
                  style={onSegClick ? { cursor: 'pointer' } : undefined}
                  onClick={onSegClick ? () => onSegClick(k, m) : undefined}
                >
                  <title>{`${k} · ${m} · 클릭`}</title>
                </rect>
              );
            })}
            <text className={VAL} x={cx} y={padT + innerH - (totals[i] / max) * innerH - 8} textAnchor="middle">
              {totals[i].toLocaleString()}
            </text>
            <text className={AXIS} x={cx} y={H - padB + 22} textAnchor="middle">{m}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** KPI 미니 카드용 스파크라인 */
export function Sparkline({ values, color, id }) {
  if (!values?.length) return null;
  const W = 300, H = 90, padX = 8, padTop = 14, padBot = 20;
  const innerW = W - padX * 2, innerH = H - padTop - padBot;
  const max = Math.max(1, ...values);
  const xs = values.map((_, i) => padX + (values.length > 1 ? (i * innerW) / (values.length - 1) : innerW / 2));
  const pts = values.map((v, i) => [xs[i], padTop + innerH * (1 - (max > 0 ? v / max : 0))]);
  const areaD = `M${pts[0][0]},${padTop + innerH} ${pts.map((p) => `L${p[0]},${p[1]}`).join(' ')} L${pts[pts.length - 1][0]},${padTop + innerH} Z`;
  const lineD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');

  return (
    <svg className="kpi-mini-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`mini-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#mini-${id})`} />
      <path d={lineD} stroke={color} strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const isLast = i === pts.length - 1;
        return <circle key={i} cx={p[0]} cy={p[1]} r={isLast ? 3.5 : 2} fill={isLast ? color : 'var(--panel)'} stroke={color} strokeWidth={isLast ? 0 : 1.5} />;
      })}
    </svg>
  );
}

/** 매장 리포트용 작은 월별 막대 */
export function MiniBars({ labels, values, color = '#4f46e5', height = 120, format = (v) => `${Math.round(v / 10000)}만` }) {
  if (!labels?.length) return <div className="chart-empty" style={{ minHeight: 120 }}>데이터 없음</div>;
  const W = 700, H = height, padL = 10, padR = 10, padT = 20, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(1, ...values);
  const slot = innerW / Math.max(1, labels.length);
  const barW = Math.min(46, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      {labels.map((m, i) => {
        const cx = padL + slot * i + slot / 2;
        const h = (values[i] / max) * innerH;
        const y = padT + innerH - h;
        return (
          <g key={m}>
            <rect x={cx - barW / 2} y={y} width={barW} height={h} rx={5} fill={color} />
            <text x={cx} y={y - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--text)">{format(values[i])}</text>
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">{m}</text>
          </g>
        );
      })}
    </svg>
  );
}
