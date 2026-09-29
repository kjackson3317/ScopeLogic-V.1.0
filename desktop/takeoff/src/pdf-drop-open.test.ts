import { describe, expect, it } from 'vitest';

describe('PDF drop open contract', () => {
  it('routes dropped PDF files through the existing file input open path', async () => {
    const source = await import('./pdf-drop-open?raw');
    expect(source.default).toContain("input.dispatchEvent(new Event('change'" );
    expect(source.default).toContain("file.type === 'application/pdf'");
    expect(source.default).toContain("dropEffect = 'copy'");
  });
});
