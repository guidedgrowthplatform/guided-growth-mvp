import { NextRequest, NextResponse } from 'next/server';
import { processCommand } from '@/lib/processCommand';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { transcript } = body;

        if (!transcript || typeof transcript !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid "transcript" field' },
                { status: 400 }
            );
        }

        const result = await processCommand(transcript);
        return NextResponse.json(result);
    } catch (err) {
        console.error('Command processor error:', err);
        return NextResponse.json(
            { error: `Server error: ${err instanceof Error ? err.message : err}` },
            { status: 500 }
        );
    }
}
