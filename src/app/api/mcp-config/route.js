import { MCP_URL } from '@/lib/zones';

/**
 * MCP 설정 파일 발급 — 비밀번호를 확인한 뒤 서버가 만들어 준다.
 *
 * 토큰(MCP_TOKEN)은 절대 클라이언트 번들에 넣지 않는다.
 * 비밀번호가 맞을 때만 이 라우트가 토큰이 든 JSON을 돌려준다.
 */
function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length, 1);
  for (let i = 0; i < n; i++) diff |= x.charCodeAt(i % (x.length || 1)) ^ y.charCodeAt(i % (y.length || 1));
  return diff === 0;
}

export async function POST(req) {
  const pw = process.env.MCP_CONFIG_PASSWORD;
  const token = process.env.MCP_TOKEN;
  if (!pw || !token) {
    return Response.json({ success: false, error: 'MCP_CONFIG_PASSWORD / MCP_TOKEN 미설정' }, { status: 500 });
  }

  let password = '';
  try {
    ({ password = '' } = await req.json());
  } catch {
    return Response.json({ success: false, error: '잘못된 요청' }, { status: 400 });
  }

  if (!safeEqual(password, pw)) {
    return Response.json({ success: false, error: '비밀번호가 맞지 않습니다.' }, { status: 401 });
  }

  const config = {
    mcpServers: {
      'yogibo-sales': {
        command: 'cmd',
        args: ['/c', 'npx', '-y', 'mcp-remote', MCP_URL, '--header', `Authorization: Bearer ${token}`],
      },
    },
  };

  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="claude_desktop_config.json"',
      'cache-control': 'no-store',
    },
  });
}

export const dynamic = 'force-dynamic';
