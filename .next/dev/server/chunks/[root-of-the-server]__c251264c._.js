module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/node:https [external] (node:https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:https", () => require("node:https"));

module.exports = mod;
}),
"[project]/src/app/api/deepgram/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$https__$5b$external$5d$__$28$node$3a$https$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:https [external] (node:https, cjs)");
;
;
async function POST(request) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'DEEPGRAM_API_KEY not configured'
        }, {
            status: 500
        });
    }
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');
        if (!audioFile) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'No audio file provided'
            }, {
                status: 400
            });
        }
        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        const contentType = audioFile.type || 'audio/webm';
        // Use node:https directly to avoid Turbopack fetch sandbox issues
        const deepgramResult = await new Promise((resolve, reject)=>{
            const options = {
                hostname: 'api.deepgram.com',
                path: '/v1/listen?model=nova-2&smart_format=true&language=en',
                method: 'POST',
                headers: {
                    Authorization: `Token ${apiKey}`,
                    'Content-Type': contentType,
                    'Content-Length': audioBuffer.length
                }
            };
            const req = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$https__$5b$external$5d$__$28$node$3a$https$2c$__cjs$29$__["default"].request(options, (res)=>{
                let data = '';
                res.on('data', (chunk)=>{
                    data += chunk;
                });
                res.on('end', ()=>{
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`Deepgram API error ${res.statusCode}: ${data}`));
                    }
                });
            });
            req.on('error', (err)=>{
                reject(err);
            });
            req.write(audioBuffer);
            req.end();
        });
        const data = JSON.parse(deepgramResult);
        const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            transcript,
            confidence,
            metadata: {
                duration: data.metadata?.duration || 0,
                model: 'nova-2'
            }
        });
    } catch (err) {
        console.error('Deepgram proxy error:', err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: `Server error: ${err instanceof Error ? err.message : err}`
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__c251264c._.js.map