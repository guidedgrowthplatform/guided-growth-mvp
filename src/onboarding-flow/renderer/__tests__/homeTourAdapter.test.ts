/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { getAdapter } from '../componentRegistry';

describe('home-tour adapter registration', () => {
  it('is registered for componentType home-tour', () => {
    expect(getAdapter('home-tour')).toBeDefined();
  });
});
