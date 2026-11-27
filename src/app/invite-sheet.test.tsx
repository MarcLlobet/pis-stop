// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InviteSheet } from './invite-sheet';

const INVITE_URL = 'https://marcllobet.github.io/pis-stop/#k=secret&o=organizer';

describe('InviteSheet', () => {
  it('shows the invite as a QR code, with a warning', () => {
    render(<InviteSheet eventName="Correpisos 2026" inviteUrl={INVITE_URL} onClose={vi.fn()} />);
    expect(
      screen.getByRole('img', { name: 'QR d’invitació a Correpisos 2026' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/només amb la colla/)).toBeInTheDocument();
  });

  it('copies the link', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<InviteSheet eventName={null} inviteUrl={INVITE_URL} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Copia l’enllaç' }));
    expect(writeText).toHaveBeenCalledWith(INVITE_URL);
    expect(await screen.findByRole('button', { name: 'Copiat!' })).toBeInTheDocument();
  });

  it('closes', async () => {
    const onClose = vi.fn();
    render(<InviteSheet eventName={null} inviteUrl={INVITE_URL} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    expect(onClose).toHaveBeenCalled();
  });
});
