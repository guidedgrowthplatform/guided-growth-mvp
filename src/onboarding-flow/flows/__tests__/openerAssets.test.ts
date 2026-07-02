/**
 * Locks the generated flow's voiceOut metadata to what the runtime can
 * actually play (Loop 1 / B3 B4 regression net):
 *
 *  - engine 'mp3' beats must name a clip that EXISTS in public/ (a renamed or
 *    missing file otherwise fails silently at runtime as a media error);
 *  - engine 'cartesia' beats must carry opener text (the live-TTS player has
 *    nothing to speak otherwise — the B3 silent-captions class);
 *  - engine values stay within what the renderer implements.
 *
 * Drive changes through designer-source.json + npm run flow:sync; if this test
 * fails after a regen, the builder emitted something the runtime cannot voice.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import generated from '../onboarding-beginner-v1.generated.json';

interface GeneratedNode {
  screenId?: string;
  voice?: { openerText?: string | null };
  meta?: {
    voiceOut?: {
      engine?: string;
      mp3Assets?: Array<{ file?: string }>;
    };
  };
}

const RUNTIME_ENGINES = new Set(['mp3', 'cartesia', 'vapi', 'none']);
const PUBLIC_DIR = resolve(__dirname, '../../../../public');

const nodes = (generated as { nodes: GeneratedNode[] }).nodes;

describe('generated flow voiceOut is runtime-playable', () => {
  it('has nodes', () => {
    expect(nodes.length).toBeGreaterThan(0);
  });

  it.each(nodes.map((n) => [n.screenId ?? '(unknown)', n] as const))(
    '%s voiceOut is playable',
    (_screenId, node) => {
      const vo = node.meta?.voiceOut;
      if (!vo?.engine) return;

      expect(RUNTIME_ENGINES.has(vo.engine)).toBe(true);

      if (vo.engine === 'mp3') {
        const file = vo.mp3Assets?.[0]?.file;
        expect(file, 'mp3 engine requires mp3Assets[0].file').toBeTruthy();
        expect(
          existsSync(resolve(PUBLIC_DIR, `.${file}`)),
          `clip missing on disk: public${file}`,
        ).toBe(true);
      }

      if (vo.engine === 'cartesia') {
        expect(
          node.voice?.openerText?.trim(),
          'cartesia engine requires opener text to speak',
        ).toBeTruthy();
      }
    },
  );
});
