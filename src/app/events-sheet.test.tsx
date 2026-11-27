// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EventsSheet, type EventSwitcher } from './events-sheet';

const switcher = (overrides: Partial<EventSwitcher> = {}): EventSwitcher => ({
  events: [
    { tag: 'ps_a', name: 'Correpisos 2026' },
    { tag: 'ps_b', name: 'Calçotada' },
    { tag: 'ps_c', name: null },
  ],
  current: 'ps_a',
  canScan: false,
  onSwitch: vi.fn(),
  onJoin: vi.fn(),
  ...overrides,
});

describe('EventsSheet', () => {
  it('marks the open event and switches to another one', async () => {
    const onSwitch = vi.fn();
    render(<EventsSheet switcher={switcher({ onSwitch })} onLeave={vi.fn()} onClose={vi.fn()} />);
    const list = screen.getByRole('list', { name: 'Events d’aquest mòbil' });
    expect(list.querySelector('[aria-current="true"]')).toHaveTextContent('Correpisos 2026');
    expect(screen.queryByRole('button', { name: 'Correpisos 2026' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Calçotada' }));
    expect(onSwitch).toHaveBeenCalledWith('ps_b');
    expect(screen.getByRole('button', { name: 'Event sense nom' })).toBeInTheDocument();
  });

  it('offers to join another event and to leave this one', async () => {
    const onLeave = vi.fn();
    render(<EventsSheet switcher={switcher()} onLeave={onLeave} onClose={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /enganxa l’enllaç/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Surt d’aquest event' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
