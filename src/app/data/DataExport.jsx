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
 * 설정 파일 받기 — 접속 토큰이 들어 있어 비밀번호를 확인한 뒤 서버가 만들어 준다.
 * 토큰은 클라이언트 번들에 들어가지 않는다.
 */
function ConfigDownload() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/mcp-config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
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
      setPassword('');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="toolbar">
        <input
          type="password"
          className="input"
          placeholder="설정파일 비밀번호"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setDone(false); }}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-download" disabled={busy || !password}>
          {busy ? '확인 중…' : '↓ 설정파일 받기'}
        </button>
      </div>
      {error && <div className="warn-banner">{error}</div>}
      {done && <div className="snap-count">받았습니다 — claude_desktop_config.json</div>}
    </form>
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
