// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SNAPSHOT, type Snapshot } from '../lib/snapshot';
import { photoView, profileView } from '../test/fixtures';
import { Gallery } from './Gallery';

const snapshot: Snapshot = {
  ...EMPTY_SNAPSHOT,
  profiles: new Map([
    ['biel', profileView('biel', { name: 'Biel' })],
    ['anna', profileView('anna', { name: 'Anna' })],
  ]),
  photos: [
    photoView('1', { authorId: 'anna' }),
    photoView('2', { authorId: 'biel' }),
    photoView('3', { authorId: 'anna' }),
  ],
};

const photoButtons = () => within(screen.getByRole('list')).getAllByRole('button');

describe('Gallery', () => {
  it('lists every photo and the people, alphabetically', () => {
    render(<Gallery snapshot={snapshot} onOpen={vi.fn()} />);
    expect(photoButtons()).toHaveLength(3);
    const filters = within(screen.getByRole('group', { name: 'Filtra per persona' }));
    expect(filters.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Tothom',
      'AAnna',
      'BBiel',
    ]);
  });

  it('filters by author and clears the filter', async () => {
    render(<Gallery snapshot={snapshot} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Anna' }));
    expect(photoButtons()).toHaveLength(2);
    expect(screen.getByText('2 fotos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anna' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Tothom' }));
    expect(photoButtons()).toHaveLength(3);
  });

  it('opens a photo', async () => {
    const onOpen = vi.fn();
    render(<Gallery snapshot={snapshot} onOpen={onOpen} />);
    await userEvent.click(photoButtons()[1]!);
    expect(onOpen).toHaveBeenCalledWith(snapshot.photos[1]);
  });

  it('shows an empty state', () => {
    render(<Gallery snapshot={EMPTY_SNAPSHOT} onOpen={vi.fn()} />);
    expect(screen.getByText('Encara no hi ha fotos.')).toBeInTheDocument();
  });
});
