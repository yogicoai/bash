'use client';

import { useEffect, useState } from 'react';
import { EXAMPLES, STEPS } from '@/lib/mcpGuide';

/** MCP 서버가 떠 있는지 — 대상 서버가 CORS 헤더를 주지 않아 dash 서버가 대신 확인한다 */
function McpHealth() {
  const [state, setState] = useState('checking');
  useEffect(() => {
    fetch('/api/mcp-health', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setState(j.up ? 'up' : 'down'))
      .catch(() => setState('down'));
  }, []);
  const label = state === 'up' ? '서버 정상' : state === 'down' ? '응답 없음' : '확인 중…';
  return <span className={`health health-${state}`}>● {label}</span>;
}

/**
 * 설정 파일 받기 — dash 로그인을 통과했으면 바로 내려받는다.
 * 토큰은 서버에서만 읽어 파일에 담으므로 클라이언트 번들에 남지 않는다.
 */
function ConfigDownload() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function download() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/mcp-config', { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || '받을 수 없습니다.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'claude_desktop_config.json';
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn btn-download" onClick={download} disabled={busy}>
          {busy ? '만드는 중…' : '↓ 설정파일 받기'}
        </button>
      </div>
      {error && <div className="warn-banner">{error}</div>}
      {done && <div className="snap-count">받았습니다 — claude_desktop_config.json</div>}
    </>
  );
}


/**
 * Codex로 데이터 가져오기 — MCP 와 쓰임이 다르다.
 *   MCP   Claude 안에서 물어보면 그 자리에서 답한다 (대화)
 *   Codex 안내서를 주면 원하는 데이터를 직접 가져와 가공한다 (분석·파일)
 *
 * 안내서(EXPORT-API.md)는 onlineData 저장소의 docs/ 를 복사해 둔 것이다.
 * 원본이 바뀌면 이 파일도 같이 갱신해야 한다.
 */
const CODEX_PROMPT = `첨부한 안내서(EXPORT-API.md)를 참고해서 아래에서 데이터를 가져와 분석해줘.
주소: https://on-iota-three.vercel.app/api/export
열쇠(토큰): {{TOKEN}}

여기에 원하는 분석을 적으세요
예) 지난달 온라인·오프라인 매출이랑 광고비 다 가져와서 8월 프로모션안이랑 비교해줘`;

function CodexGuide() {
  const [token, setToken] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/codex-token', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setToken(j.token))
      .catch(() => {});
  }, []);

  const prompt = CODEX_PROMPT.replace('{{TOKEN}}', token || '(별도로 전달받은 토큰을 여기에)');

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div>
          <h2>Codex로 데이터 가져와 분석하기</h2>
          <p>
            안내서 파일 하나만 첨부하면 Codex가 매출·광고·목표·재고를 직접 가져와 가공합니다.
            엑셀로 정리하거나 여러 데이터를 엮어 비교할 때 씁니다.
          </p>
        </div>
      </div>

      <p className="summary">
        MCP는 <b>Claude에게 물어보면 그 자리에서 답하는</b> 방식이고,
        Codex는 <b>데이터를 직접 가져와 파일로 만들거나 깊게 분석하는</b> 방식입니다. 필요에 따라 골라 쓰면 됩니다.
      </p>

      <ol className="steps">
        <li>
          <b>안내서를 내려받습니다</b>
          <span>아래 버튼으로 EXPORT-API.md 를 받으세요.</span>
        </li>
        <li>
          <b>Codex에 그 파일을 첨부합니다</b>
          <span>내용을 읽을 필요는 없습니다 — Codex가 읽고 알아서 처리합니다.</span>
        </li>
        <li>
          <b>아래 문장을 붙여넣고, 원하는 분석을 이어서 적습니다</b>
          <span>기간은 &ldquo;지난달&rdquo;, &ldquo;최근 7일&rdquo;처럼 말하듯 적으면 됩니다.</span>
        </li>
      </ol>

      <div className="codex-prompt">
        <pre>{prompt}</pre>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => navigator.clipboard.writeText(prompt).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })}
        >
          {copied ? '복사됨 ✓' : '문장 복사'}
        </button>
      </div>

      <div className="toolbar">
        <a className="btn btn-download" href="/docs/EXPORT-API.md" download="EXPORT-API.md">
          ↓ 안내서 받기 (EXPORT-API.md)
        </a>
      </div>

      <p className="summary">
        가져올 수 있는 것 — <b>매출</b>(온라인 채널·상품별 / 오프라인 매장·사원·상품별) ·
        <b> 광고</b>(매체별 광고비·노출·클릭·전환) · <b>방문</b>(방문·가입·구매) ·
        <b> 목표</b>(온라인 월 목표 · 오프라인 매장별 목표) · <b>재고</b>(품목·색상별 수량).
        고객 개인정보는 포함되지 않습니다.
      </p>
      {!token && (
        <p className="summary dim">
          토큰이 이 화면에 설정돼 있지 않습니다 — 별도로 전달받은 값을 문장의 &ldquo;열쇠(토큰)&rdquo; 자리에 넣어 주세요.
        </p>
      )}
    </section>
  );
}

export default function McpGuide() {
  return (
    <>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h2>Claude로 데이터 물어보기</h2>
            <p>
              &ldquo;5월 프로모션 분석해줘&rdquo; 처럼 물어보면 회사 판매 데이터를 직접 조회해 분석해 줍니다.
              매출·프로모션·쿠폰·할인율·상품·목표·마케팅유입·재고까지 채팅으로 확인할 수 있습니다.
            </p>
          </div>
          <div className="card-actions"><McpHealth /></div>
        </div>

        <p className="summary">
          본인 <b>Claude 구독 안에서 동작</b>하므로 추가 요금이 없습니다.
          자사몰(Cafe24 API) · 스마트스토어(API) · 나머지 채널(이카운트 데이터) 기준으로 집계합니다.
        </p>
        <p className="summary">
          프로모션·쿠폰 등은{' '}
          <a className="accent" href="https://on-iota-three.vercel.app/" target="_blank" rel="noopener noreferrer">
            yogibo 판매분석 사이트
          </a>
          에서 등록·관리합니다. <b>사이트에 프로모션을 등록해두면 MCP가 그 데이터까지 반영해 더 정확하게 분석합니다.</b>
        </p>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h2>설치하기</h2>
            <p>Claude Desktop 앱에서 한 번만 설정하면 됩니다.</p>
          </div>
        </div>

        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="step-n">{s.n}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
                {s.link && (
                  <a className="accent" href={s.link} target="_blank" rel="noopener noreferrer">{s.link} ↗</a>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="cfg-box">
          <div className="cfg-head">
            <strong>설정파일 내려받기</strong>
            <span>접속 토큰이 들어 있습니다. 외부에 공유하지 마세요.</span>
          </div>
          <ConfigDownload />
        </div>
      </section>

      <CodexGuide />

      <section className="card">
        <div className="card-head">
          <div>
            <h2>이렇게 물어보세요</h2>
            <p>그대로 복사해서 Claude에 붙여넣어도 됩니다.</p>
          </div>
        </div>

        <div className="ex-grid">
          {EXAMPLES.map((cat) => (
            <div className="ex-cat" key={cat.id}>
              <h3>{cat.icon} {cat.title}</h3>
              {cat.groups.map((g) => (
                <div className="ex-group" key={g.label}>
                  <div className="ex-label">{g.label}</div>
                  <ul>{g.items.map((q) => <li key={q}>{q}</li>)}</ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
