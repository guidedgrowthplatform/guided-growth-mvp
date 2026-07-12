import { describe, expect, it } from 'vitest';
import { isReauthError } from '../calendar';
import { ApiError } from '../client';

describe('isReauthError', () => {
  it('true only for a 401 reauth_required ApiError', () => {
    expect(isReauthError(new ApiError('reauth_required', 401, { error: 'reauth_required' }))).toBe(
      true,
    );
  });

  it('false for other errors', () => {
    expect(isReauthError(new ApiError('other', 401, { error: 'other' }))).toBe(false);
    expect(isReauthError(new ApiError('disabled', 409, { error: 'disabled' }))).toBe(false);
    expect(isReauthError(new ApiError('boom', 502, { error: 'google_error' }))).toBe(false);
    expect(isReauthError(new Error('nope'))).toBe(false);
    expect(isReauthError(undefined)).toBe(false);
  });
});
