import { MCP_HEALTH_URL } from '@/lib/zones';

/**
 * MCP 서버 헬스체크 — 브라우저에서 직접 부르면 CORS에 막히므로 서버에서 확인한다.
 * (cloudtype의 MCP 서버는 Access-Control-Allow-Origin을 주지 않는다)
 */
export async function GET() {
  try {
    const res = await fetch(MCP_HEALTH_URL, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return Response.json({ success: true, up: res.ok, status: res.status });
  } catch (e) {
    return Response.json({ success: true, up: false, error: e.message });
  }
}

export const dynamic = 'force-dynamic';
