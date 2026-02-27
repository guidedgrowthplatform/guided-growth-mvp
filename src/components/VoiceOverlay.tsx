'use client';

import { VoiceMicButton } from '@/components/VoiceMicButton';
import { VoiceTranscript } from '@/components/VoiceTranscript';

/**
 * Client-side voice overlay that renders the floating mic button
 * and transcript panel on all pages via the root layout.
 */
export function VoiceOverlay() {
    return (
        <>
            <VoiceTranscript />
            <VoiceMicButton />
        </>
    );
}
