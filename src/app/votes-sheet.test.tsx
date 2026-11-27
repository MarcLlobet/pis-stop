// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SNAPSHOT, type Snapshot } from '../lib/snapshot';
import type { Rating, Round, Scores, Stop } from '../lib/types';
import { VotesSheet } from './votes-sheet';

const stop = (id: string, order: number): Stop => ({
  kind: 'stop',
  id,
  name: `Pis ${id}`,
  order,
  position: { lat: 41.4, lng: 2.17 },
});

const round = (id: string, stopId: string, status: Round['status'], at: string): Round => ({
  kind: 'round',
  id,
  stopId,
  authorId: 'host',
  status,
  at,
});

const stars = (value: number): Scores => ({
  presentation: value,
  originality: value,
  taste: value,
  craft: value,
});

const rating = (id: string, authorId: string, stopId: string, value: number): Rating => ({
  kind: 'rating',
  id,
  authorId,
  stopId,
  scores: stars(value),
  at: '2026-12-12T20:01:00.000Z',
});

const snapshotWith = (extra: Partial<Snapshot>): Snapshot => ({
  ...EMPTY_SNAPSHOT,
  stops: [stop('s1', 1), stop('s2', 2)],
  ...extra,
});

const open = (id: string, stopId: string) => round(id, stopId, 'open', '2026-12-12T20:00:00.000Z');

const renderSheet = (snapshot: Snapshot, meId = 'ana') => {
  const onRound = vi.fn(() => Promise.resolve());
  const onRate = vi.fn(() => Promise.resolve());
  render(
    <VotesSheet
      snapshot={snapshot}
      meId={meId}
      onClose={vi.fn()}
      onRound={onRound}
      onRate={onRate}
    />,
  );
  return { onRound, onRate };
};

describe('VotesSheet', () => {
  it('says nothing is open yet, and hides the host controls from everyone else', () => {
    renderSheet(snapshotWith({}));
    expect(screen.getByText(/Encara no hi ha cap votació oberta/)).toBeInTheDocument();
    expect(screen.queryByText(/Amfitrió/)).not.toBeInTheDocument();
  });

  it('lets a host open and close the voting on each stop', async () => {
    const { onRound } = renderSheet(
      snapshotWith({ hosts: new Set(['ana']), rounds: [open('r1', 's2')] }),
    );
    const list = screen.getByText(/Amfitrió/).closest('section');
    await userEvent.click(within(list!).getByRole('button', { name: 'Obre' }));
    expect(onRound).toHaveBeenCalledWith('s1', 'open');
    await userEvent.click(within(list!).getByRole('button', { name: 'Tanca' }));
    expect(onRound).toHaveBeenCalledWith('s2', 'closed');
  });

  it('asks for four star ratings and only sends once all are chosen', async () => {
    const { onRate } = renderSheet(snapshotWith({ rounds: [open('r1', 's1')] }));
    const send = screen.getByRole('button', { name: 'Envia el vot' });
    expect(send).toBeDisabled();

    const choose = async (category: string, count: number) => {
      const group = screen.getByRole('radiogroup', { name: category });
      await userEvent.click(
        within(group).getByRole('radio', {
          name: `${String(count)} ${count === 1 ? 'estrella' : 'estrelles'}`,
        }),
      );
    };
    await choose('Presentació', 5);
    await choose('Originalitat', 4);
    await choose('Sabor', 3);
    expect(send).toBeDisabled();
    await choose('Elaboració', 1);
    expect(send).toBeEnabled();

    await userEvent.click(send);
    expect(onRate).toHaveBeenCalledWith('s1', {
      presentation: 5,
      originality: 4,
      taste: 3,
      craft: 1,
    });
  });

  it('shows the vote already sent, which can be changed while the voting is open', () => {
    renderSheet(
      snapshotWith({ rounds: [open('r1', 's1')], ratings: [rating('v1', 'ana', 's1', 4)] }),
    );
    expect(screen.getByText('Vot enviat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Canvia el vot' })).toBeDisabled();
  });

  it('ranks closed stops and keeps open ones out of the results', () => {
    renderSheet(
      snapshotWith({
        rounds: [
          open('a', 's1'),
          round('b', 's1', 'closed', '2026-12-12T20:10:00.000Z'),
          open('c', 's2'),
        ],
        ratings: [rating('v1', 'ana', 's1', 4), rating('v2', 'biel', 's2', 5)],
      }),
    );
    const results = screen.getByText('Resultats').closest('section')!;
    expect(within(results).getByText('Pis s1')).toBeInTheDocument();
    // The total, plus each of the four categories.
    expect(within(results).getAllByText('4,0')).toHaveLength(5);
    // s2 is still open: a card to vote on, with no running total in the results.
    expect(within(results).queryByText('Pis s2')).not.toBeInTheDocument();
    expect(screen.queryAllByText('5,0')).toHaveLength(0);
  });
});
