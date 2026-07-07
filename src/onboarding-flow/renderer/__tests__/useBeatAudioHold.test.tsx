/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B58: useBeatAudioHold claims a beat's audio for a whole lifetime (not one
 * clip's settle) and releases exactly once, on deactivation or unmount.
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { beatAudioOwnerOf, claimBeatAudio, resetBeatAudioOwnerForTests } from '../beatAudioOwner';
import { useBeatAudioHold } from '../useBeatAudioHold';

function Probe({ beatId, active }: { beatId: string | null; active: boolean }) {
  useBeatAudioHold(beatId, 'narration-driver', active);
  return null;
}

let container: HTMLDivElement;
let root: Root;

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
}

beforeEach(() => {
  resetBeatAudioOwnerForTests();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  resetBeatAudioOwnerForTests();
});

describe('useBeatAudioHold', () => {
  it('claims the beat while active', async () => {
    await render(<Probe beatId="ONBOARD-BEGINNER-04" active />);
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-04')).toBe('narration-driver');
  });

  it('holds the claim across re-renders (no release between them)', async () => {
    await render(<Probe beatId="ONBOARD-BEGINNER-04" active />);
    await render(<Probe beatId="ONBOARD-BEGINNER-04" active />);
    await render(<Probe beatId="ONBOARD-BEGINNER-04" active />);
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-04')).toBe('narration-driver');
  });

  it('releases when active flips false', async () => {
    await render(<Probe beatId="ONBOARD-BEGINNER-04" active />);
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-04')).toBe('narration-driver');

    await render(<Probe beatId="ONBOARD-BEGINNER-04" active={false} />);
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-04')).toBeNull();
    // Freed for the next owner.
    expect(claimBeatAudio('ONBOARD-BEGINNER-04', 'opener-mp3')).toBe(true);
  });

  it('releases on unmount', async () => {
    await render(<Probe beatId="ONBOARD-BEGINNER-04" active />);
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-04')).toBe('narration-driver');

    await act(async () => {
      root.unmount();
    });
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-04')).toBeNull();
  });

  it('does nothing when beatId is null', async () => {
    await render(<Probe beatId={null} active />);
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-04')).toBeNull();
  });
});
