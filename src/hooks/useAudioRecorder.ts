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
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    const startRecording = useCallback(async () => {
        try {
            // Clean up any previous recording
            if (mediaRecorderRef.current && isRecordingRef.current) {
                mediaRecorderRef.current.stop();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            streamRef.current = stream;

            // Try opus first, then plain webm, then whatever is available
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType });

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
                const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

                setState((prev) => ({
                    ...prev,
                    isRecording: false,
                    audioBlob: blob,
                    audioUrl: url,
                    duration: finalDuration,
                }));

                isRecordingRef.current = false;

                // Stop all tracks
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                    streamRef.current = null;
                }
            };

            // Start recording — timeslice 250ms for more reliable chunk collection
            mediaRecorder.start(250);
            startTimeRef.current = Date.now();
            isRecordingRef.current = true;

            // Duration timer
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setState((prev) => ({
                    ...prev,
                    duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
                }));
            }, 500); // Update every 500ms for smoother display

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
        // Use ref instead of state to avoid stale closure
        if (mediaRecorderRef.current && isRecordingRef.current) {
            // Request final data before stopping
            if (mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.requestData();
                mediaRecorderRef.current.stop();
            }

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, []);

    const reset = useCallback(() => {
        if (state.audioUrl) {
            URL.revokeObjectURL(state.audioUrl);
        }
        chunksRef.current = [];
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
