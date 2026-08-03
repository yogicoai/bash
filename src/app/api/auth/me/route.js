import { cookies } from 'next/headers';
import { COOKIE_NAME, verify } from '@/lib/session';

/** 현재 로그인한 사람 — 사이드바 표시용 */
export async function GET() {
  const jar = await cookies();
  const session = await verify(jar.get(COOKIE_NAME)?.value);
  return Response.json({ success: true, id: session?.u || null });
}
