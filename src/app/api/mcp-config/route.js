import { MCP_URL } from '@/lib/zones';

/**
 * MCP 설정 파일 발급 — dash 로그인을 통과한 사람에게 서버가 만들어 준다.
 *
 * 2026-10-22: 토큰 자리는 비워서 준다. 예전에는 공유 MCP_TOKEN 을 그대로 담아 줬는데
 * 그 값이 사내 게시글에 평문으로 올라간 일이 있어(점검 요청 3번) 토큰을 사람마다 따로 주기로 했다.
 * 받은 사람은 파일의 「발급받은_개인_토큰」 자리를 개인 메시지로 받은 토큰으로 바꿔 넣는다.
 *
 * 예전에는 여기서 비밀번호를 한 번 더 받았다. 그런데 이 경로는 이미 dash
 * 로그인 뒤에 있어(proxy 가 /api/* 를 막는다) 같은 사람에게 두 번 묻는
 * 꼴이었다. 문턱만 늘고 지키는 것은 없어서 걷어냈다.
 */
export async function GET() {
  const token = '발급받은_개인_토큰';

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
