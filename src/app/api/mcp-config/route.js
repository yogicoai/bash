import { MCP_URL } from '@/lib/zones';

/**
 * MCP 설정 파일 발급 — dash 로그인을 통과한 사람에게 서버가 만들어 준다.
 *
 * 토큰(MCP_TOKEN)은 클라이언트 번들에 넣지 않는다. 이 라우트가 서버에서
 * 읽어 파일에만 담는다.
 *
 * 예전에는 여기서 비밀번호를 한 번 더 받았다. 그런데 이 경로는 이미 dash
 * 로그인 뒤에 있어(proxy 가 /api/* 를 막는다) 같은 사람에게 두 번 묻는
 * 꼴이었다. 문턱만 늘고 지키는 것은 없어서 걷어냈다.
 */
export async function GET() {
  const token = process.env.MCP_TOKEN;
  if (!token) {
    return Response.json({ success: false, error: 'MCP_TOKEN 미설정' }, { status: 500 });
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
