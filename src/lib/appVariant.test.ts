import { describe, expect, it } from 'vitest';
import { schemeForAppId } from './appVariant';

describe('schemeForAppId', () => {
  it('maps the QA bundle id to the qa scheme', () => {
    expect(schemeForAppId('app.guidedgrowth.staging')).toBe('guidedgrowthqa');
  });

  it('maps the prod id (and anything else) to the stable scheme', () => {
    expect(schemeForAppId('app.guidedgrowth.mvp')).toBe('guidedgrowth');
    expect(schemeForAppId('')).toBe('guidedgrowth');
  });
});
