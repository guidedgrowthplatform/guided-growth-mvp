import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';

export async function POST(request: NextRequest) {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'DEEPGRAM_API_KEY not configured' },
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
        const contentType = audioFile.type || 'audio/webm';

        // Use node:https directly to avoid Turbopack fetch sandbox issues
        const deepgramResult = await new Promise<string>((resolve, reject) => {
            const options = {
                hostname: 'api.deepgram.com',
                path: '/v1/listen?model=nova-2&smart_format=true&language=en',
                method: 'POST',
                headers: {
                    Authorization: `Token ${apiKey}`,
                    'Content-Type': contentType,
                    'Content-Length': audioBuffer.length,
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
                        reject(new Error(`Deepgram API error ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (err: Error) => {
                reject(err);
            });

            req.write(audioBuffer);
            req.end();
        });

        const data = JSON.parse(deepgramResult);
        const transcript =
            data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        const confidence =
            data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

        return NextResponse.json({
            transcript,
            confidence,
            metadata: {
                duration: data.metadata?.duration || 0,
                model: 'nova-2',
            },
        });
    } catch (err) {
        console.error('Deepgram proxy error:', err);
        return NextResponse.json(
            { error: `Server error: ${err instanceof Error ? err.message : err}` },
            { status: 500 }
        );
    }
}
