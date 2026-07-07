/** @vitest-environment jsdom */
/**
 * W3-B: the Home "Morning Check In" quick-action card must not render unless
 * the caller confirms morning check-in was actually configured server-side
 * (a refused submit_morning_checkin must leave no trace on Home). The Evening
 * card is unconditional and always renders.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickActionCards } from '../QuickActionCards';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('QuickActionCards morning-check-in visibility', () => {
  it('hides the Morning Check In card when showMorningCheckin is false', () => {
    act(() => {
      root.render(
        <QuickActionCards
          onCheckInPress={vi.fn()}
          onJournalPress={vi.fn()}
          showMorningCheckin={false}
        />,
      );
    });
    expect(container.textContent).not.toContain('Morning Check In');
    expect(container.textContent).not.toContain('How are you feeling?');
    // Evening card is unconditional.
    expect(container.textContent).toContain('Evening Check In');
  });

  it('shows the Morning Check In card when showMorningCheckin is true', () => {
    act(() => {
      root.render(
        <QuickActionCards
          onCheckInPress={vi.fn()}
          onJournalPress={vi.fn()}
          showMorningCheckin={true}
        />,
      );
    });
    expect(container.textContent).toContain('Morning Check In');
    expect(container.textContent).toContain('Evening Check In');
  });
});
