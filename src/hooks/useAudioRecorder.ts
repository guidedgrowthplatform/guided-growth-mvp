'use client';

import { useState, useRef, useCallback } from 'react';

interface AudioRecorderState {
    isRecording: boolean;
    audioBlob: Blob | null;
    audioUrl: string | null;
    error: string | null;
    duration: number;
}

export function useAudioRecorder() {
    const [state, setState] = useState<AudioRecorderState>({
        isRecording: false,
        audioBlob: null,
        audioUrl: null,
        error: null,
        duration: 0,
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm',
            });

            chunksRef.current = [];
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setState((prev) => ({
                    ...prev,
                    isRecording: false,
                    audioBlob: blob,
                    audioUrl: url,
                }));
                // Stop all tracks
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start(100); // Collect data every 100ms
            startTimeRef.current = Date.now();

            // Duration timer
            timerRef.current = setInterval(() => {
                setState((prev) => ({
                    ...prev,
                    duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
                }));
            }, 1000);

            setState({
                isRecording: true,
                audioBlob: null,
                audioUrl: null,
                error: null,
                duration: 0,
            });
        } catch (err) {
            setState((prev) => ({
                ...prev,
                error: `Microphone access denied: ${err}`,
            }));
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && state.isRecording) {
            mediaRecorderRef.current.stop();
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [state.isRecording]);

    const reset = useCallback(() => {
        if (state.audioUrl) {
            URL.revokeObjectURL(state.audioUrl);
        }
        setState({
            isRecording: false,
            audioBlob: null,
            audioUrl: null,
            error: null,
            duration: 0,
        });
    }, [state.audioUrl]);

    return {
        ...state,
        startRecording,
        stopRecording,
        reset,
    };
}
