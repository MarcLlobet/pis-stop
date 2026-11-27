import { describe, expect, it } from 'vitest';

import { generateSecret } from './crypto';
import { buildInviteUrl } from './invite';
import { qrShape } from './qr';

describe('qrShape', () => {
  it('draws one square per dark module', () => {
    const { size, path } = qrShape('Pis Stop');
    expect(size).toBe(21);
    expect(path).toMatch(/^(M\d+ \d+h1v1h-1z)+$/);
    // The three finder patterns alone have 3 × 33 dark modules.
    expect(path.match(/M/g)?.length).toBeGreaterThan(99);
  });

  it('starts with the top-left finder pattern', () => {
    expect(qrShape('Pis Stop').path.startsWith('M0 0h1v1h-1zM1 0h1v1h-1z')).toBe(true);
  });

  it('fits a whole invite link', () => {
    const url = buildInviteUrl('https://marcllobet.github.io/pis-stop/', {
      secret: generateSecret(),
      organizer: 'DtOmq5V_9vWaljCkc9MafQ',
    });
    const { size } = qrShape(url);
    expect(size).toBeGreaterThan(21);
    expect(size).toBeLessThanOrEqual(57);
  });
});
