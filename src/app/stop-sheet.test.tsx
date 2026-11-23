// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SNAPSHOT } from '../lib/snapshot';
import { photoView, stopEntry } from '../test/fixtures';
import { StopSheet } from './stop-sheet';

const stop = stopEntry('s1', 2).meta;

describe('StopSheet', () => {
  it('shows only the photos of its stop', () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      photos: [photoView('a', { stopId: 's1' }), photoView('b', { stopId: 's2' })],
    };
    render(<StopSheet stop={stop} snapshot={snapshot} onOpen={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Pis s1' })).toBeInTheDocument();
    expect(screen.getByText('Parada 2')).toBeInTheDocument();
    expect(screen.getByText('1 foto')).toBeInTheDocument();
  });

  it('has its own empty state and closes', async () => {
    const onClose = vi.fn();
    render(<StopSheet stop={stop} snapshot={EMPTY_SNAPSHOT} onOpen={vi.fn()} onClose={onClose} />);
    expect(screen.getByText('Encara ningú ha penjat res aquí.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    expect(onClose).toHaveBeenCalled();
  });
});
