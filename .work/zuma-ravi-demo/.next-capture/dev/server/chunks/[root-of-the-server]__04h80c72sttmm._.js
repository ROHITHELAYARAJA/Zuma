module.exports = [
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/app/api/[...path]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>proxy,
    "GET",
    ()=>proxy,
    "OPTIONS",
    ()=>proxy,
    "PATCH",
    ()=>proxy,
    "POST",
    ()=>proxy,
    "PUT",
    ()=>proxy,
    "dynamic",
    ()=>dynamic,
    "maxDuration",
    ()=>maxDuration,
    "runtime",
    ()=>runtime
]);
const runtime = 'nodejs';
const dynamic = 'force-dynamic';
const maxDuration = 180;
async function proxy(request, context) {
    const { path } = await context.params;
    const target = new URL(process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8787');
    if (![
        'https:',
        'http:'
    ].includes(target.protocol) || target.username || target.password) {
        return Response.json({
            error: 'API_CONFIGURATION',
            message: 'The clinical API address is not configured correctly.'
        }, {
            status: 503
        });
    }
    const destination = new URL(`/api/${path.map(encodeURIComponent).join('/')}`, target.origin);
    destination.search = request.nextUrl.search;
    const headers = new Headers();
    for (const name of [
        'content-type',
        'cookie',
        'authorization',
        'origin',
        'accept'
    ]){
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }
    try {
        const length = Number(request.headers.get('content-length') ?? 0);
        if (length > 1048576) return Response.json({
            error: 'BODY_TOO_LARGE',
            message: 'Request exceeds 1 MB.'
        }, {
            status: 413
        });
        const body = [
            'GET',
            'HEAD'
        ].includes(request.method) ? undefined : await request.arrayBuffer();
        if (body && body.byteLength > 1048576) return Response.json({
            error: 'BODY_TOO_LARGE',
            message: 'Request exceeds 1 MB.'
        }, {
            status: 413
        });
        const upstream = await fetch(destination, {
            method: request.method,
            headers,
            body,
            cache: 'no-store',
            redirect: 'manual',
            signal: AbortSignal.any([
                request.signal,
                AbortSignal.timeout(170000)
            ])
        });
        const outgoing = new Headers();
        for (const name of [
            'content-type',
            'content-disposition',
            'retry-after'
        ]){
            const value = upstream.headers.get(name);
            if (value) outgoing.set(name, value);
        }
        for (const cookie of upstream.headers.getSetCookie())outgoing.append('set-cookie', cookie);
        outgoing.set('cache-control', 'no-store, no-transform');
        if (upstream.headers.get('content-type')?.includes('text/event-stream')) outgoing.set('x-accel-buffering', 'no');
        outgoing.set('x-content-type-options', 'nosniff');
        return new Response(upstream.body, {
            status: upstream.status,
            headers: outgoing
        });
    } catch  {
        return Response.json({
            error: 'API_UNAVAILABLE',
            message: 'The clinical API is offline. Start the project with npm run dev, or configure API_PROXY_TARGET to your Render backend. Open /setup for connection steps.'
        }, {
            status: 503,
            headers: {
                'cache-control': 'no-store'
            }
        });
    }
}
;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__04h80c72sttmm._.js.map