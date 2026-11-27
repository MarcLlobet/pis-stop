import { describe, expect, it } from 'vitest';

import { parseMeta } from './meta';
import type { Rating, Round, Scores, Stop } from './types';
import { currentRounds, GRACE_MS, results, scoresOf, validRatings } from './votes';

const T0 = Date.parse('2026-12-12T20:00:00.000Z');
const iso = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

const round = (id: string, stopId: string, status: Round['status'], offsetMs: number): Round => ({
  kind: 'round',
  id,
  stopId,
  authorId: 'host',
  status,
  at: iso(offsetMs),
});

const stars = (value: number): Scores => ({
  presentation: value,
  originality: value,
  taste: value,
  craft: value,
});

const rating = (
  id: string,
  authorId: string,
  stopId: string,
  scores: Scores,
  offsetMs: number,
): Rating => ({ kind: 'rating', id, authorId, stopId, scores, at: iso(offsetMs) });

const stop = (id: string, order: number): Stop => ({
  kind: 'stop',
  id,
  name: `Pis ${id}`,
  order,
  position: { lat: 41.4, lng: 2.17 },
});

describe('currentRounds', () => {
  it('keeps the latest open or close for each stop', () => {
    const rounds = [
      round('a', 's1', 'open', 0),
      round('b', 's1', 'closed', 1000),
      round('c', 's2', 'open', 500),
    ];
    const current = currentRounds({ rounds });
    expect(current.get('s1')?.status).toBe('closed');
    expect(current.get('s2')?.status).toBe('open');
  });

  it('does not depend on the order they arrive in', () => {
    const rounds = [round('b', 's1', 'closed', 1000), round('a', 's1', 'open', 0)];
    expect(currentRounds({ rounds }).get('s1')?.status).toBe('closed');
  });
});

describe('validRatings', () => {
  const open = [round('a', 's1', 'open', 0)];

  it('keeps only the latest rating of each voter for a stop', () => {
    const ratings = [
      rating('1', 'ana', 's1', stars(1), 1000),
      rating('2', 'ana', 's1', stars(5), 2000),
      rating('3', 'biel', 's1', stars(3), 1500),
    ];
    const valid = validRatings({ rounds: open, ratings });
    expect(valid.map(({ id }) => id).sort()).toEqual(['2', '3']);
  });

  it('ignores ratings for a stop that was never opened', () => {
    expect(validRatings({ rounds: [], ratings: [rating('1', 'ana', 's1', stars(5), 0)] })).toEqual(
      [],
    );
  });

  it('drops a rating made well after the voting closed, keeps one within the grace period', () => {
    const rounds = [...open, round('b', 's1', 'closed', 10_000)];
    const ratings = [
      rating('on-time', 'ana', 's1', stars(4), 9_000),
      rating('just-after', 'biel', 's1', stars(4), 10_000 + GRACE_MS),
      rating('late', 'cris', 's1', stars(5), 10_000 + GRACE_MS + 1),
    ];
    expect(
      validRatings({ rounds, ratings })
        .map(({ id }) => id)
        .sort(),
    ).toEqual(['just-after', 'on-time']);
  });

  it('finds what a person voted', () => {
    const ratings = [rating('1', 'ana', 's1', stars(2), 0)];
    expect(scoresOf({ rounds: open, ratings }, 'ana', 's1')).toEqual(stars(2));
    expect(scoresOf({ rounds: open, ratings }, 'biel', 's1')).toBeUndefined();
  });
});

describe('results', () => {
  const stops = [stop('s1', 1), stop('s2', 2), stop('s3', 3)];

  it('shows closed stops only, best first, with each category averaged', () => {
    const rounds = [
      round('a', 's1', 'open', 0),
      round('b', 's1', 'closed', 5000),
      round('c', 's2', 'open', 0),
      round('d', 's2', 'closed', 5000),
      round('e', 's3', 'open', 0),
    ];
    const ratings = [
      rating('1', 'ana', 's1', stars(2), 100),
      rating('2', 'biel', 's1', { ...stars(4), taste: 2 }, 100),
      rating('3', 'ana', 's2', stars(5), 100),
      rating('4', 'ana', 's3', stars(5), 100),
    ];
    const found = results({ rounds, ratings }, stops);

    expect(found.map(({ stop: { id } }) => id)).toEqual(['s2', 's1']);
    expect(found[1]?.votes).toBe(2);
    expect(found[1]?.byCategory).toEqual({ presentation: 3, originality: 3, taste: 2, craft: 3 });
    expect(found[1]?.total).toBe(2.75);
  });

  it('gives a stop nobody rated a zero rather than hiding it', () => {
    const found = results({ rounds: [round('a', 's1', 'closed', 0)], ratings: [] }, stops);
    expect(found).toHaveLength(1);
    expect(found[0]?.total).toBe(0);
  });
});

describe('parseMeta for the voting entries', () => {
  const base = { kind: 'rating', id: 'r1', stopId: 's1', authorId: 'ana', at: iso(0) };

  it('accepts a rating with four whole-number scores from 1 to 5', () => {
    expect(parseMeta({ ...base, scores: stars(3) })).toEqual({ ...base, scores: stars(3) });
  });

  it.each([
    ['a zero', { ...stars(3), taste: 0 }],
    ['a six', { ...stars(3), taste: 6 }],
    ['a half star', { ...stars(3), taste: 2.5 }],
    ['a text', { ...stars(3), taste: '5' }],
    ['a missing category', { presentation: 3, originality: 3, taste: 3 }],
    ['an extra category', { ...stars(3), bonus: 5 }],
  ])('rejects a rating with %s', (_, scores) => {
    expect(parseMeta({ ...base, scores })).toBeNull();
  });

  it('accepts a round and a host, and rejects a round with another status', () => {
    const open = {
      kind: 'round',
      id: 'x',
      stopId: 's1',
      authorId: 'ana',
      status: 'open',
      at: iso(0),
    };
    expect(parseMeta(open)).toEqual(open);
    expect(parseMeta({ ...open, status: 'paused' })).toBeNull();
    const host = { kind: 'host', profileId: 'ana', grantedAt: iso(0) };
    expect(parseMeta(host)).toEqual(host);
    expect(parseMeta({ kind: 'host', profileId: '', grantedAt: iso(0) })).toBeNull();
  });
});
