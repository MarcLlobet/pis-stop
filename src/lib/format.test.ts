import { describe, expect, it } from 'vitest';

import { formatTime, initialOf, pluralize } from './format';

describe('formatTime', () => {
  it('formats hours and minutes', () => {
    expect(formatTime('2026-12-12T13:05:00')).toMatch(/13.05/);
  });

  it('returns an empty string for invalid dates', () => {
    expect(formatTime('ahir')).toBe('');
  });
});

describe('pluralize', () => {
  it('picks the singular only for one', () => {
    expect(pluralize(1, 'foto', 'fotos')).toBe('1 foto');
    expect(pluralize(0, 'foto', 'fotos')).toBe('0 fotos');
    expect(pluralize(3, 'foto', 'fotos')).toBe('3 fotos');
  });
});

describe('initialOf', () => {
  it('returns the uppercase first letter or a placeholder', () => {
    expect(initialOf(' júlia')).toBe('J');
    expect(initialOf('   ')).toBe('?');
  });
});
