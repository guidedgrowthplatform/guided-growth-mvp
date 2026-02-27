import { NextRequest, NextResponse } from 'next/server';

// Faster Whisper self-hosted server proxy
// Proxies audio to a Faster Whisper REST API server
export async function POST(request: NextRequest) {
    const serverUrl = process.env.FASTER_WHISPER_URL;

    if (!serverUrl) {
        return NextResponse.json(
            { error: 'FASTER_WHISPER_URL not configured. Deploy the Faster Whisper server first.' },
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

        // Forward to Faster Whisper server
        const forwardFormData = new FormData();
        const audioBuffer = await audioFile.arrayBuffer();
        const blob = new Blob([audioBuffer], { type: audioFile.type || 'audio/webm' });
        forwardFormData.append('file', blob, 'recording.webm');

        const res = await fetch(`${serverUrl}/v1/audio/transcriptions`, {
            method: 'POST',
            body: forwardFormData,
        });

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json(
                { error: `Faster Whisper server error ${res.status}: ${errText}` },
                { status: 502 }
            );
        }

        const data = await res.json();

        return NextResponse.json({
            transcript: data.text || data.transcript || '',
            metadata: {
                model: data.model || 'faster-whisper',
                provider: 'faster-whisper',
                language: data.language,
                duration: data.duration,
            },
        });
    } catch (err) {
        console.error('Faster Whisper proxy error:', err);
        return NextResponse.json(
            { error: `Server error: ${err instanceof Error ? err.message : err}` },
            { status: 500 }
        );
    }
}
