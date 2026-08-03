import { proxy } from '@/lib/upstream';

// offorder(오프라인/index.js) 프록시 — /api/off/api/work-hours → {OFFORDER_API}/api/work-hours
async function handler(req, { params }) {
  const { path } = await params;
  return proxy('off', path, req);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

export const dynamic = 'force-dynamic';
