import { NextRequest, NextResponse } from 'next/server';

// Faster Whisper self-hosted server proxy
export async function POST(request: NextRequest) {
    const serverUrl = process.env.FASTER_WHISPER_URL;

    if (!serverUrl) {
        return NextResponse.json(
            { error: 'FASTER_WHISPER_URL not configured. Deploy the Faster Whisper server first.' },
            { status: 500 }
        );
    }

    try {
        const incomingFormData = await request.formData();
        const audioFile = incomingFormData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        // Forward audio to Faster Whisper server using native fetch + FormData
        const forwardFormData = new FormData();
        forwardFormData.append('file', audioFile, 'recording.webm');

        const res = await fetch(`${serverUrl}/v1/audio/transcriptions`, {
            method: 'POST',
            body: forwardFormData,
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Faster Whisper error:', res.status, errText);
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
                processing_time: data.processing_time,
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
