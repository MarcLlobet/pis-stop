import { describe, expect, it } from 'vitest';

import { escapeHtml } from './html';

describe('escapeHtml', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeHtml(`<img src="x" onerror='y'>&`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&apos;y&apos;&gt;&amp;',
    );
  });

  it('leaves plain text alone', () => {
    expect(escapeHtml('Pis de la Júlia')).toBe('Pis de la Júlia');
  });
});
