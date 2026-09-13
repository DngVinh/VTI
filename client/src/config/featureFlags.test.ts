import { describe, expect, it } from 'vitest';
import { parseEnabledFlag } from './featureFlags';

describe('feature flags', () => {
  it('only enables a browser feature for the exact string true', () => {
    expect(parseEnabledFlag('true')).toBe(true);
    expect(parseEnabledFlag('TRUE')).toBe(false);
    expect(parseEnabledFlag('1')).toBe(false);
    expect(parseEnabledFlag(undefined)).toBe(false);
  });
});

