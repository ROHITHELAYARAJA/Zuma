import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = new URL(process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8787');
  if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) {
    return Response.json({ error: 'API_CONFIGURATION', message: 'The clinical API address is not configured correctly.' }, { status: 503 });
  }
  const destination = new URL(`/api/${path.map(encodeURIComponent).join('/')}`, target.origin);
  destination.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of ['content-type', 'cookie', 'authorization', 'origin', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 1048576) return Response.json({ error: 'BODY_TOO_LARGE', message: 'Request exceeds 1 MB.' }, { status: 413 });
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 1048576) return Response.json({ error: 'BODY_TOO_LARGE', message: 'Request exceeds 1 MB.' }, { status: 413 });
    const upstream = await fetch(destination, { method: request.method, headers, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(55000) });
    const outgoing = new Headers();
    for (const name of ['content-type', 'content-disposition', 'retry-after']) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) outgoing.append('set-cookie', cookie);
    outgoing.set('cache-control', 'no-store');
    outgoing.set('x-content-type-options', 'nosniff');
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    return Response.json({ error: 'API_UNAVAILABLE', message: 'The clinical API is offline. Start the project with npm run dev, or configure API_PROXY_TARGET to your Render backend. Open /setup for connection steps.' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };
