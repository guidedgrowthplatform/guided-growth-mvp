import { NextRequest, NextResponse } from 'next/server';

// Whisper.cpp API proxy — uses OpenAI Whisper API
export async function POST(request: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'OPENAI_API_KEY not configured for Whisper' },
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

        // Forward the audio to OpenAI Whisper API using native fetch + FormData
        const openaiFormData = new FormData();
        openaiFormData.append('file', audioFile, 'recording.webm');
        openaiFormData.append('model', 'whisper-1');
        openaiFormData.append('language', 'en');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: openaiFormData,
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Whisper API error:', response.status, errText);
            return NextResponse.json(
                { error: `Whisper API error ${response.status}: ${errText}` },
                { status: 502 }
            );
        }

        const data = await response.json();

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
