(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/testPhrases.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Test phrases for STT provider evaluation.
 * Covers short commands, longer sentences, and edge cases.
 */ __turbopack_context__.s([
    "TEST_PHRASES",
    ()=>TEST_PHRASES
]);
const TEST_PHRASES = [
    // Short commands (5)
    {
        id: 1,
        category: 'command',
        text: 'Log my mood as happy',
        description: 'Simple mood logging command'
    },
    {
        id: 2,
        category: 'command',
        text: 'Start meditation timer',
        description: 'Action command'
    },
    {
        id: 3,
        category: 'command',
        text: 'Add habit drink water',
        description: 'Habit creation command'
    },
    {
        id: 4,
        category: 'command',
        text: 'Mark exercise as done',
        description: 'Completion command'
    },
    {
        id: 5,
        category: 'command',
        text: 'Show my weekly report',
        description: 'Navigation command'
    },
    // Longer sentences (5)
    {
        id: 6,
        category: 'sentence',
        text: 'I completed thirty minutes of exercise today and I feel great about my progress',
        description: 'Longer reflection with numbers'
    },
    {
        id: 7,
        category: 'sentence',
        text: 'Today I woke up at six thirty and meditated for fifteen minutes before breakfast',
        description: 'Time references and sequence'
    },
    {
        id: 8,
        category: 'sentence',
        text: 'I want to track my sleep quality, water intake, and daily steps as new habits',
        description: 'List of items in natural speech'
    },
    {
        id: 9,
        category: 'sentence',
        text: 'My energy level is about seven out of ten and I slept around seven hours last night',
        description: 'Multiple numeric values'
    },
    {
        id: 10,
        category: 'sentence',
        text: 'Set a reminder to journal every evening at nine PM starting from tomorrow',
        description: 'Complex command with time and date'
    },
    // Edge cases (5)
    {
        id: 11,
        category: 'edge-case',
        text: 'Log caffeine intake two hundred milligrams',
        description: 'Technical measurement terms'
    },
    {
        id: 12,
        category: 'edge-case',
        text: 'Rate my productivity eight point five out of ten',
        description: 'Decimal numbers in speech'
    },
    {
        id: 13,
        category: 'edge-case',
        text: 'I did yoga, stretching, and breathwork — three activities total',
        description: 'Punctuation-heavy with em-dash'
    },
    {
        id: 14,
        category: 'edge-case',
        text: 'The word read can mean present or past tense depending on context',
        description: 'Homophone and ambiguous words'
    },
    {
        id: 15,
        category: 'edge-case',
        text: 'Schedule check-in for January twenty-third twenty twenty-seven',
        description: 'Hyphenated words and future dates'
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/hooks/useAudioRecorder.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAudioRecorder",
    ()=>useAudioRecorder
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
function useAudioRecorder() {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        isRecording: false,
        audioBlob: null,
        audioUrl: null,
        error: null,
        duration: 0
    });
    const mediaRecorderRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const chunksRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const startTimeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const timerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const startRecording = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAudioRecorder.useCallback[startRecording]": async ()=>{
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true
                });
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
                });
                chunksRef.current = [];
                mediaRecorderRef.current = mediaRecorder;
                mediaRecorder.ondataavailable = ({
                    "useAudioRecorder.useCallback[startRecording]": (event)=>{
                        if (event.data.size > 0) {
                            chunksRef.current.push(event.data);
                        }
                    }
                })["useAudioRecorder.useCallback[startRecording]"];
                mediaRecorder.onstop = ({
                    "useAudioRecorder.useCallback[startRecording]": ()=>{
                        const blob = new Blob(chunksRef.current, {
                            type: 'audio/webm'
                        });
                        const url = URL.createObjectURL(blob);
                        setState({
                            "useAudioRecorder.useCallback[startRecording]": (prev)=>({
                                    ...prev,
                                    isRecording: false,
                                    audioBlob: blob,
                                    audioUrl: url
                                })
                        }["useAudioRecorder.useCallback[startRecording]"]);
                        // Stop all tracks
                        stream.getTracks().forEach({
                            "useAudioRecorder.useCallback[startRecording]": (track)=>track.stop()
                        }["useAudioRecorder.useCallback[startRecording]"]);
                    }
                })["useAudioRecorder.useCallback[startRecording]"];
                mediaRecorder.start(100); // Collect data every 100ms
                startTimeRef.current = Date.now();
                // Duration timer
                timerRef.current = setInterval({
                    "useAudioRecorder.useCallback[startRecording]": ()=>{
                        setState({
                            "useAudioRecorder.useCallback[startRecording]": (prev)=>({
                                    ...prev,
                                    duration: Math.floor((Date.now() - startTimeRef.current) / 1000)
                                })
                        }["useAudioRecorder.useCallback[startRecording]"]);
                    }
                }["useAudioRecorder.useCallback[startRecording]"], 1000);
                setState({
                    isRecording: true,
                    audioBlob: null,
                    audioUrl: null,
                    error: null,
                    duration: 0
                });
            } catch (err) {
                setState({
                    "useAudioRecorder.useCallback[startRecording]": (prev)=>({
                            ...prev,
                            error: `Microphone access denied: ${err}`
                        })
                }["useAudioRecorder.useCallback[startRecording]"]);
            }
        }
    }["useAudioRecorder.useCallback[startRecording]"], []);
    const stopRecording = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAudioRecorder.useCallback[stopRecording]": ()=>{
            if (mediaRecorderRef.current && state.isRecording) {
                mediaRecorderRef.current.stop();
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        }
    }["useAudioRecorder.useCallback[stopRecording]"], [
        state.isRecording
    ]);
    const reset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAudioRecorder.useCallback[reset]": ()=>{
            if (state.audioUrl) {
                URL.revokeObjectURL(state.audioUrl);
            }
            setState({
                isRecording: false,
                audioBlob: null,
                audioUrl: null,
                error: null,
                duration: 0
            });
        }
    }["useAudioRecorder.useCallback[reset]"], [
        state.audioUrl
    ]);
    return {
        ...state,
        startRecording,
        stopRecording,
        reset
    };
}
_s(useAudioRecorder, "AiJNgg8rldQIo+vd/Lja0aVfphM=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/evaluate/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EvaluatePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$testPhrases$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/testPhrases.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useAudioRecorder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/hooks/useAudioRecorder.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
// ─── Accuracy calculation (word-level) ─────────────────────────
function calculateAccuracy(expected, actual) {
    if (!actual) return 0;
    const expectedWords = expected.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const actualWords = actual.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    let matches = 0;
    for (const word of expectedWords){
        if (actualWords.includes(word)) matches++;
    }
    return Math.round(matches / expectedWords.length * 100);
}
// ─── Web Speech API live transcription ─────────────────────────
function useWebSpeechLive() {
    _s();
    const [isListening, setIsListening] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    function createRecognition() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window;
        const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
        if (!SpeechRecognition) return null;
        const r = new SpeechRecognition();
        r.continuous = false;
        r.interimResults = false;
        r.lang = 'en-US';
        return r;
    }
    const transcribe = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useWebSpeechLive.useCallback[transcribe]": ()=>{
            return new Promise({
                "useWebSpeechLive.useCallback[transcribe]": (resolve)=>{
                    const recognition = createRecognition();
                    if (!recognition) {
                        resolve({
                            text: '',
                            latencyMs: 0,
                            error: 'Web Speech API not supported'
                        });
                        return;
                    }
                    recognitionRef.current = recognition;
                    const start = performance.now();
                    setIsListening(true);
                    recognition.onresult = ({
                        "useWebSpeechLive.useCallback[transcribe]": (event)=>{
                            const text = event.results[0][0].transcript;
                            setIsListening(false);
                            resolve({
                                text,
                                latencyMs: Math.round(performance.now() - start)
                            });
                        }
                    })["useWebSpeechLive.useCallback[transcribe]"];
                    recognition.onerror = ({
                        "useWebSpeechLive.useCallback[transcribe]": (event)=>{
                            setIsListening(false);
                            resolve({
                                text: '',
                                latencyMs: Math.round(performance.now() - start),
                                error: event.error
                            });
                        }
                    })["useWebSpeechLive.useCallback[transcribe]"];
                    recognition.onend = ({
                        "useWebSpeechLive.useCallback[transcribe]": ()=>{
                            setIsListening(false);
                        }
                    })["useWebSpeechLive.useCallback[transcribe]"];
                    recognition.start();
                }
            }["useWebSpeechLive.useCallback[transcribe]"]);
        }
    }["useWebSpeechLive.useCallback[transcribe]"], []);
    const cancel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useWebSpeechLive.useCallback[cancel]": ()=>{
            if (recognitionRef.current) {
                recognitionRef.current.abort();
                setIsListening(false);
            }
        }
    }["useWebSpeechLive.useCallback[cancel]"], []);
    return {
        transcribe,
        isListening,
        cancel
    };
}
_s(useWebSpeechLive, "2g4hkMvzuVja7v0ZuFrwkxw4wKo=");
function EvaluatePage() {
    _s1();
    const [results, setResults] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activePhrase, setActivePhrase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [activeProvider, setActiveProvider] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [isProcessing, setIsProcessing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const recorder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useAudioRecorder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAudioRecorder"])();
    const webSpeech = useWebSpeechLive();
    // Test with Web Speech API (live)
    const testWebSpeech = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "EvaluatePage.useCallback[testWebSpeech]": async (phrase)=>{
            setActivePhrase(phrase);
            setActiveProvider('Web Speech API');
            setIsProcessing(true);
            const result = await webSpeech.transcribe();
            const testResult = {
                phraseId: phrase.id,
                expected: phrase.text,
                provider: 'Web Speech API',
                transcript: result.text,
                latencyMs: result.latencyMs,
                accuracy: calculateAccuracy(phrase.text, result.text),
                error: result.error
            };
            setResults({
                "EvaluatePage.useCallback[testWebSpeech]": (prev)=>[
                        ...prev,
                        testResult
                    ]
            }["EvaluatePage.useCallback[testWebSpeech]"]);
            setIsProcessing(false);
            setActivePhrase(null);
        }
    }["EvaluatePage.useCallback[testWebSpeech]"], [
        webSpeech
    ]);
    // Test with Deepgram (record then send)
    const testDeepgram = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "EvaluatePage.useCallback[testDeepgram]": async (phrase, audioBlob)=>{
            setActivePhrase(phrase);
            setActiveProvider('Deepgram');
            setIsProcessing(true);
            const start = performance.now();
            try {
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');
                const res = await fetch('/api/deepgram', {
                    method: 'POST',
                    body: formData
                });
                const latencyMs = Math.round(performance.now() - start);
                const data = await res.json();
                if (!res.ok) {
                    setResults({
                        "EvaluatePage.useCallback[testDeepgram]": (prev)=>[
                                ...prev,
                                {
                                    phraseId: phrase.id,
                                    expected: phrase.text,
                                    provider: 'Deepgram',
                                    transcript: '',
                                    latencyMs,
                                    accuracy: 0,
                                    error: data.error
                                }
                            ]
                    }["EvaluatePage.useCallback[testDeepgram]"]);
                } else {
                    setResults({
                        "EvaluatePage.useCallback[testDeepgram]": (prev)=>[
                                ...prev,
                                {
                                    phraseId: phrase.id,
                                    expected: phrase.text,
                                    provider: 'Deepgram',
                                    transcript: data.transcript,
                                    latencyMs,
                                    accuracy: calculateAccuracy(phrase.text, data.transcript)
                                }
                            ]
                    }["EvaluatePage.useCallback[testDeepgram]"]);
                }
            } catch (err) {
                setResults({
                    "EvaluatePage.useCallback[testDeepgram]": (prev)=>[
                            ...prev,
                            {
                                phraseId: phrase.id,
                                expected: phrase.text,
                                provider: 'Deepgram',
                                transcript: '',
                                latencyMs: Math.round(performance.now() - start),
                                accuracy: 0,
                                error: `${err}`
                            }
                        ]
                }["EvaluatePage.useCallback[testDeepgram]"]);
            }
            setIsProcessing(false);
            setActivePhrase(null);
        }
    }["EvaluatePage.useCallback[testDeepgram]"], []);
    // Export results
    const exportResults = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "EvaluatePage.useCallback[exportResults]": ()=>{
            const blob = new Blob([
                JSON.stringify(results, null, 2)
            ], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'stt-evaluation-results.json';
            a.click();
            URL.revokeObjectURL(url);
        }
    }["EvaluatePage.useCallback[exportResults]"], [
        results
    ]);
    // Calculate summary stats
    const getProviderStats = (provider)=>{
        const providerResults = results.filter((r)=>r.provider === provider && !r.error);
        if (providerResults.length === 0) return null;
        return {
            count: providerResults.length,
            avgAccuracy: Math.round(providerResults.reduce((sum, r)=>sum + r.accuracy, 0) / providerResults.length),
            avgLatency: Math.round(providerResults.reduce((sum, r)=>sum + r.latencyMs, 0) / providerResults.length)
        };
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-8",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto max-w-6xl",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-8 text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-3xl font-bold text-white",
                            children: "STT Provider Evaluation"
                        }, void 0, false, {
                            fileName: "[project]/src/app/evaluate/page.tsx",
                            lineNumber: 219,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-2 text-slate-400",
                            children: "Compare Web Speech API vs Deepgram on accuracy and latency"
                        }, void 0, false, {
                            fileName: "[project]/src/app/evaluate/page.tsx",
                            lineNumber: 220,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/evaluate/page.tsx",
                    lineNumber: 218,
                    columnNumber: 17
                }, this),
                results.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-8 grid gap-4 sm:grid-cols-2",
                    children: [
                        'Web Speech API',
                        'Deepgram'
                    ].map((provider)=>{
                        const stats = getProviderStats(provider);
                        if (!stats) return null;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl bg-white/5 p-5 backdrop-blur-sm border border-white/10",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-sm font-medium text-white/70 uppercase tracking-wider",
                                    children: provider
                                }, void 0, false, {
                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                    lineNumber: 236,
                                    columnNumber: 37
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-3 grid grid-cols-3 gap-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-2xl font-bold text-white",
                                                    children: stats.count
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 241,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-slate-400",
                                                    children: "Tests"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 242,
                                                    columnNumber: 45
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                            lineNumber: 240,
                                            columnNumber: 41
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-2xl font-bold text-emerald-400",
                                                    children: [
                                                        stats.avgAccuracy,
                                                        "%"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 245,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-slate-400",
                                                    children: "Avg Accuracy"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 246,
                                                    columnNumber: 45
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                            lineNumber: 244,
                                            columnNumber: 41
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-2xl font-bold text-amber-400",
                                                    children: [
                                                        stats.avgLatency,
                                                        "ms"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 249,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-slate-400",
                                                    children: "Avg Latency"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 250,
                                                    columnNumber: 45
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                            lineNumber: 248,
                                            columnNumber: 41
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                    lineNumber: 239,
                                    columnNumber: 37
                                }, this)
                            ]
                        }, provider, true, {
                            fileName: "[project]/src/app/evaluate/page.tsx",
                            lineNumber: 232,
                            columnNumber: 33
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/src/app/evaluate/page.tsx",
                    lineNumber: 227,
                    columnNumber: 21
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-8",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between mb-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-lg font-semibold text-white",
                                    children: "Test Phrases"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                    lineNumber: 262,
                                    columnNumber: 25
                                }, this),
                                results.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: exportResults,
                                    className: "rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors cursor-pointer",
                                    children: "Export JSON"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                    lineNumber: 264,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/evaluate/page.tsx",
                            lineNumber: 261,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-3",
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$testPhrases$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TEST_PHRASES"].map((phrase)=>{
                                const phraseResults = results.filter((r)=>r.phraseId === phrase.id);
                                const isActive = activePhrase?.id === phrase.id;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: `rounded-xl border p-4 transition-all ${isActive ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-start justify-between gap-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-2 mb-1",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: `text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${phrase.category === 'command' ? 'bg-blue-500/20 text-blue-300' : phrase.category === 'sentence' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`,
                                                                    children: phrase.category
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                                    lineNumber: 290,
                                                                    columnNumber: 49
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-xs text-slate-500",
                                                                    children: [
                                                                        "#",
                                                                        phrase.id
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                                    lineNumber: 300,
                                                                    columnNumber: 49
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                                            lineNumber: 289,
                                                            columnNumber: 45
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-sm text-white font-medium",
                                                            children: [
                                                                "“",
                                                                phrase.text,
                                                                "”"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                                            lineNumber: 302,
                                                            columnNumber: 45
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-xs text-slate-500 mt-0.5",
                                                            children: phrase.description
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                                            lineNumber: 303,
                                                            columnNumber: 45
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 288,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex gap-2 flex-shrink-0",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            onClick: ()=>testWebSpeech(phrase),
                                                            disabled: isProcessing,
                                                            className: "rounded-lg bg-blue-600/80 px-3 py-1.5 text-xs text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer",
                                                            children: isActive && activeProvider === 'Web Speech API' ? '🎙️ Listening...' : '🌐 Web Speech'
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                                            lineNumber: 309,
                                                            columnNumber: 45
                                                        }, this),
                                                        recorder.audioBlob && !recorder.isRecording ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            onClick: ()=>testDeepgram(phrase, recorder.audioBlob),
                                                            disabled: isProcessing,
                                                            className: "rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer",
                                                            children: isActive && activeProvider === 'Deepgram' ? '⏳ Processing...' : '🔊 Deepgram'
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                                            lineNumber: 321,
                                                            columnNumber: 49
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            disabled: true,
                                                            className: "rounded-lg bg-emerald-600/30 px-3 py-1.5 text-xs text-white/40 cursor-not-allowed",
                                                            title: "Record audio first using the recorder below",
                                                            children: "🔊 Deepgram"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                                            lineNumber: 331,
                                                            columnNumber: 49
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 307,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                            lineNumber: 287,
                                            columnNumber: 37
                                        }, this),
                                        phraseResults.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-3 space-y-2",
                                            children: phraseResults.map((r, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "font-medium text-white/70 w-28 flex-shrink-0",
                                                            children: r.provider
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                                            lineNumber: 350,
                                                            columnNumber: 53
                                                        }, this),
                                                        r.error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-red-400",
                                                            children: r.error
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                                            lineNumber: 354,
                                                            columnNumber: 57
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "flex-1 text-white/80 truncate",
                                                                    children: [
                                                                        "“",
                                                                        r.transcript,
                                                                        "”"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                                    lineNumber: 357,
                                                                    columnNumber: 61
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: `font-mono font-bold ${r.accuracy >= 80 ? 'text-emerald-400' : r.accuracy >= 50 ? 'text-amber-400' : 'text-red-400'}`,
                                                                    children: [
                                                                        r.accuracy,
                                                                        "%"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                                    lineNumber: 360,
                                                                    columnNumber: 61
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-slate-500 font-mono w-16 text-right",
                                                                    children: [
                                                                        r.latencyMs,
                                                                        "ms"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                                    lineNumber: 370,
                                                                    columnNumber: 61
                                                                }, this)
                                                            ]
                                                        }, void 0, true)
                                                    ]
                                                }, i, true, {
                                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                                    lineNumber: 346,
                                                    columnNumber: 49
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/evaluate/page.tsx",
                                            lineNumber: 344,
                                            columnNumber: 41
                                        }, this)
                                    ]
                                }, phrase.id, true, {
                                    fileName: "[project]/src/app/evaluate/page.tsx",
                                    lineNumber: 279,
                                    columnNumber: 33
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/src/app/evaluate/page.tsx",
                            lineNumber: 273,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/evaluate/page.tsx",
                    lineNumber: 260,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "sticky bottom-4 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-sm font-medium text-white",
                                        children: [
                                            "Audio Recorder",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "ml-2 text-xs text-slate-400",
                                                children: "(Record once, test with Deepgram on any phrase)"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/evaluate/page.tsx",
                                                lineNumber: 391,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/evaluate/page.tsx",
                                        lineNumber: 389,
                                        columnNumber: 29
                                    }, this),
                                    recorder.isRecording && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-red-400 mt-1 animate-pulse",
                                        children: [
                                            "● Recording... ",
                                            recorder.duration,
                                            "s"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/evaluate/page.tsx",
                                        lineNumber: 396,
                                        columnNumber: 33
                                    }, this),
                                    recorder.audioBlob && !recorder.isRecording && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-emerald-400 mt-1",
                                        children: [
                                            "✓ Audio recorded (",
                                            Math.round(recorder.audioBlob.size / 1024),
                                            "KB) — click “Deepgram” on any phrase to test"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/evaluate/page.tsx",
                                        lineNumber: 401,
                                        columnNumber: 33
                                    }, this),
                                    recorder.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-red-400 mt-1",
                                        children: recorder.error
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/evaluate/page.tsx",
                                        lineNumber: 407,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/evaluate/page.tsx",
                                lineNumber: 388,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-2",
                                children: [
                                    !recorder.isRecording ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: recorder.startRecording,
                                        className: "rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition-colors cursor-pointer",
                                        children: "🎙️ Record"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/evaluate/page.tsx",
                                        lineNumber: 412,
                                        columnNumber: 33
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: recorder.stopRecording,
                                        className: "rounded-lg bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors cursor-pointer animate-pulse",
                                        children: "⏹️ Stop"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/evaluate/page.tsx",
                                        lineNumber: 419,
                                        columnNumber: 33
                                    }, this),
                                    recorder.audioBlob && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: recorder.reset,
                                        className: "rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 transition-colors cursor-pointer",
                                        children: "🗑️ Clear"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/evaluate/page.tsx",
                                        lineNumber: 427,
                                        columnNumber: 33
                                    }, this),
                                    recorder.audioUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("audio", {
                                        src: recorder.audioUrl,
                                        controls: true,
                                        className: "h-10"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/evaluate/page.tsx",
                                        lineNumber: 435,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/evaluate/page.tsx",
                                lineNumber: 410,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/evaluate/page.tsx",
                        lineNumber: 387,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/evaluate/page.tsx",
                    lineNumber: 386,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-6 rounded-xl bg-amber-900/20 border border-amber-500/20 p-4",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-amber-300",
                        children: [
                            "⚠️ ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "OpenAI Whisper"
                            }, void 0, false, {
                                fileName: "[project]/src/app/evaluate/page.tsx",
                                lineNumber: 444,
                                columnNumber: 28
                            }, this),
                            " is not tested in this evaluation — no API key provided. See the evaluation document for a research-based comparison."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/evaluate/page.tsx",
                        lineNumber: 443,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/evaluate/page.tsx",
                    lineNumber: 442,
                    columnNumber: 17
                }, this),
                webSpeech.isListening && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl bg-slate-900 border border-indigo-500/30 p-8 text-center shadow-2xl",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "animate-pulse text-4xl mb-4",
                                children: "🎙️"
                            }, void 0, false, {
                                fileName: "[project]/src/app/evaluate/page.tsx",
                                lineNumber: 453,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white font-semibold text-lg",
                                children: "Listening..."
                            }, void 0, false, {
                                fileName: "[project]/src/app/evaluate/page.tsx",
                                lineNumber: 454,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-slate-400 text-sm mt-2 max-w-xs",
                                children: "Read the phrase aloud. Recognition will stop automatically when you pause."
                            }, void 0, false, {
                                fileName: "[project]/src/app/evaluate/page.tsx",
                                lineNumber: 455,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: webSpeech.cancel,
                                className: "mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition-colors cursor-pointer",
                                children: "Cancel"
                            }, void 0, false, {
                                fileName: "[project]/src/app/evaluate/page.tsx",
                                lineNumber: 458,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/evaluate/page.tsx",
                        lineNumber: 452,
                        columnNumber: 25
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/evaluate/page.tsx",
                    lineNumber: 451,
                    columnNumber: 21
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/app/evaluate/page.tsx",
            lineNumber: 216,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/evaluate/page.tsx",
        lineNumber: 215,
        columnNumber: 9
    }, this);
}
_s1(EvaluatePage, "fl5YuLspp4OReQTWbBKTiy+fA6U=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useAudioRecorder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAudioRecorder"],
        useWebSpeechLive
    ];
});
_c = EvaluatePage;
var _c;
__turbopack_context__.k.register(_c, "EvaluatePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_968e2e03._.js.map