/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { morningCheckinV1 } from './flows/checkin-flows';
import { useCheckinFlow } from './useCheckinFlow';

let container: HTMLDivElement;
let root: Root;
let captured: ReturnType<typeof useCheckinFlow>;

function Probe() {
  captured = useCheckinFlow('morning-checkin-v1');
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(createElement(Probe)));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useCheckinFlow', () => {
  it('loads the morning flow, clean and tagged', () => {
    expect(captured.flow).toBe(morningCheckinV1);
    expect(captured.tag).toBe('morning-checkin-v1@v1');
    expect(captured.problems).toEqual([]);
  });
});
