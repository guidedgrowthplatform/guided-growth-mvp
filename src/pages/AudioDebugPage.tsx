import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { AUDIO_DEBUG_SUPABASE_STORAGE_BASE, AUDIO_DEBUG_WEB_ORIGIN } from '@/lib/config/voice';

/**
 * Debug page to test audio on Android.
 * Access via: /status (temporarily) or add route.
 * Tests different audio approaches to find what works.
 */
export function AudioDebugPage() {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);
  };

  // Test 1: Local MP3 file
  const testLocalMp3 = () => {
    addLog('Test 1: Local MP3...');
    const audio = new Audio('/voice/splash_welcome.mp3');
    audio.oncanplaythrough = () => addLog('  canplaythrough OK');
    audio.onerror = (e) => addLog(`  ERROR: ${e}`);
    audio.onended = () => addLog('  ended OK');
    audio
      .play()
      .then(() => addLog('  play() OK'))
      .catch((e) => addLog(`  play() FAIL: ${e}`));
  };

  // Test 2: Remote MP3 (Vercel static)
  const testRemoteMp3 = () => {
    addLog('Test 2: Remote Vercel MP3...');
    const audio = new Audio(`${AUDIO_DEBUG_WEB_ORIGIN}/voice/splash_welcome.mp3`);
    audio.oncanplaythrough = () => addLog('  canplaythrough OK');
    audio.onerror = (e) => addLog(`  ERROR: ${e}`);
    audio.onended = () => addLog('  ended OK');
    audio
      .play()
      .then(() => addLog('  play() OK'))
      .catch((e) => addLog(`  play() FAIL: ${e}`));
  };

  // Test 3: Supabase Storage MP3
  const testSupabaseMp3 = () => {
    addLog('Test 3: Supabase Storage MP3...');
    const audio = new Audio(`${AUDIO_DEBUG_SUPABASE_STORAGE_BASE}/splash_welcome.mp3`);
    audio.oncanplaythrough = () => addLog('  canplaythrough OK');
    audio.onerror = (e) => addLog(`  ERROR: ${e}`);
    audio.onended = () => addLog('  ended OK');
    audio
      .play()
      .then(() => addLog('  play() OK'))
      .catch((e) => addLog(`  play() FAIL: ${e}`));
  };

  // Test 4: speechSynthesis
  const testSpeechSynthesis = () => {
    addLog('Test 4: speechSynthesis...');
    addLog(`  available: ${'speechSynthesis' in window}`);
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('Hello, testing audio on Android.');
      u.onend = () => addLog('  speech ended OK');
      u.onerror = (e) => addLog(`  ERROR: ${e.error}`);
      window.speechSynthesis.speak(u);
      addLog('  speak() called');
    }
  };

  // Test 5: Cartesia TTS via GET URL
  const testCartesiaGet = async () => {
    addLog('Test 5: Cartesia TTS GET...');
    try {
      const { supabase } = await import('@/lib/supabase');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      addLog(`  auth token: ${token ? 'YES' : 'NO'}`);

      const base = Capacitor.isNativePlatform() ? import.meta.env.VITE_API_URL || '' : '';
      const url = `${base}/api/cartesia-tts?text=Hello%20testing&token=${token}`;
      addLog(`  URL: ${url.slice(0, 80)}...`);

      const audio = new Audio(url);
      audio.oncanplaythrough = () => addLog('  canplaythrough OK');
      audio.onerror = (e) => addLog(`  ERROR: ${e}`);
      audio.onended = () => addLog('  ended OK');
      audio.load();
      audio
        .play()
        .then(() => addLog('  play() OK'))
        .catch((e) => addLog(`  play() FAIL: ${e}`));
    } catch (e) {
      addLog(`  FAIL: ${e}`);
    }
  };

  // Test 6: fetch + blob (what speakCartesia used to do)
  const testFetchBlob = async () => {
    addLog('Test 6: fetch + blob...');
    try {
      const { supabase } = await import('@/lib/supabase');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const base = Capacitor.isNativePlatform() ? import.meta.env.VITE_API_URL || '' : '';

      const res = await fetch(`${base}/api/cartesia-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: 'Hello testing fetch blob' }),
      });
      addLog(`  fetch status: ${res.status}`);

      if (res.ok) {
        const blob = await res.blob();
        addLog(`  blob size: ${blob.size}, type: ${blob.type}`);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          addLog('  ended OK');
        };
        audio.onerror = (e) => addLog(`  play ERROR: ${e}`);
        audio
          .play()
          .then(() => addLog('  play() OK'))
          .catch((e) => addLog(`  play() FAIL: ${e}`));
      }
    } catch (e) {
      addLog(`  FAIL: ${e}`);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12 }}>
      <h2>Audio Debug — {Capacitor.isNativePlatform() ? 'NATIVE' : 'WEB'}</h2>
      <p>Platform: {Capacitor.getPlatform()}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <button onClick={testLocalMp3} style={{ padding: '8px 12px' }}>
          1. Local MP3
        </button>
        <button onClick={testRemoteMp3} style={{ padding: '8px 12px' }}>
          2. Remote MP3
        </button>
        <button onClick={testSupabaseMp3} style={{ padding: '8px 12px' }}>
          3. Supabase MP3
        </button>
        <button onClick={testSpeechSynthesis} style={{ padding: '8px 12px' }}>
          4. speechSynthesis
        </button>
        <button onClick={testCartesiaGet} style={{ padding: '8px 12px' }}>
          5. Cartesia GET
        </button>
        <button onClick={testFetchBlob} style={{ padding: '8px 12px' }}>
          6. fetch+blob
        </button>
        <button onClick={() => setLog([])} style={{ padding: '8px 12px' }}>
          Clear
        </button>
      </div>

      <div
        style={{
          background: '#111',
          color: '#0f0',
          padding: 12,
          borderRadius: 8,
          maxHeight: 400,
          overflow: 'auto',
        }}
      >
        {log.length === 0 ? (
          <p>Tap a button to test...</p>
        ) : (
          log.map((l, i) => <div key={i}>{l}</div>)
        )}
      </div>
    </div>
  );
}
