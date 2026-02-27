import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';

// Whisper.cpp API proxy
// Uses the OpenAI Whisper API as the whisper.cpp compatible endpoint
// In production, this would point to a self-hosted whisper.cpp server
export async function POST(request: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'OPENAI_API_KEY not configured for Whisper' },
            { status: 500 }
        );
    }

    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

        // Build multipart form data for OpenAI Whisper API
        const boundary = '----WhisperBoundary' + Date.now();
        const fileField = 'file';
        const modelField = 'whisper-1';

        const parts: Buffer[] = [];

        // File part
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${fileField}"; filename="audio.webm"\r\n` +
            `Content-Type: audio/webm\r\n\r\n`
        ));
        parts.push(audioBuffer);
        parts.push(Buffer.from('\r\n'));

        // Model part
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="model"\r\n\r\n` +
            `${modelField}\r\n`
        ));

        // Close
        parts.push(Buffer.from(`--${boundary}--\r\n`));

        const body = Buffer.concat(parts);

        const result = await new Promise<string>((resolve, reject) => {
            const options = {
                hostname: 'api.openai.com',
                path: '/v1/audio/transcriptions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length,
                },
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk: string) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`Whisper API error ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (err: Error) => {
                reject(err);
            });

            req.write(body);
            req.end();
        });

        const data = JSON.parse(result);

        return NextResponse.json({
            transcript: data.text || '',
            metadata: {
                model: 'whisper-1',
                provider: 'openai-whisper',
            },
        });
    } catch (err) {
        console.error('Whisper proxy error:', err);
        return NextResponse.json(
            { error: `Server error: ${err instanceof Error ? err.message : err}` },
            { status: 500 }
        );
    }
}
