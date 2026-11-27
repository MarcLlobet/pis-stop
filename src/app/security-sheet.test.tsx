// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { profileView } from '../test/fixtures';
import { SecuritySheet } from './security-sheet';

const me = profileView('p1', { name: 'Anna' });

describe('SecuritySheet', () => {
  it('expands and collapses topics without closing the sheet', async () => {
    const onClose = vi.fn();
    render(<SecuritySheet me={me} onClose={onClose} />);

    await userEvent.click(screen.getByText('Com es xifren les fotos'));
    expect(screen.getByText(/AES-256-GCM/)).toBeVisible();

    await userEvent.click(screen.getByText('Les signatures'));
    expect(screen.getByText(/clau de signatura/)).toBeVisible();

    // Collapsing the first topic again, same as expanding one.
    await userEvent.click(screen.getByText('Com es xifren les fotos'));
    expect(screen.queryByText(/AES-256-GCM/)).not.toBeInTheDocument();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes with its close button', async () => {
    const onClose = vi.fn();
    render(<SecuritySheet me={me} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    expect(onClose).toHaveBeenCalled();
  });
});
