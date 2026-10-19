import { proxy } from '@/lib/upstream';

// 예전 realtime(web.js) 경로 프록시 — /api/rt/api/orders → {OFFORDER_API}/api/orders (2026-10-19 offorder로 통합)
async function handler(req, { params }) {
  const { path } = await params;
  return proxy('rt', path, req);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

export const dynamic = 'force-dynamic';
