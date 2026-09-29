import { describe, expect, it } from 'vitest';

describe('workspace rail resize contract', () => {
  it('keeps the resize implementation source available to the desktop bundle', async () => {
    const source = await import('./workspace-rail-resize?raw');
    expect(source.default).toContain('--takeoff-left-rail-width');
    expect(source.default).toContain('--takeoff-right-rail-width');
    expect(source.default).toContain('localStorage');
  });
});
