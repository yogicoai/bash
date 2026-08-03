import { proxy } from '@/lib/upstream';

// onlineData 프록시 — /api/on/api/compare/period → {ONLINEDATA_API}/api/compare/period
async function handler(req, { params }) {
  const { path } = await params;
  return proxy('on', path, req);
}

export const GET = handler;
export const dynamic = 'force-dynamic';
