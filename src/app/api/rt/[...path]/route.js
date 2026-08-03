import { proxy } from '@/lib/upstream';

// realtime(web.js) 프록시 — /api/rt/api/orders → {REALTIME_API}/api/orders
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
