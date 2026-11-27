// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { generateSecret } from '../lib/crypto';
import { toBase64Url } from '../lib/encoding';
import { Landing } from './landing';

const organizer = 'DtOmq5V_9vWaljCkc9MafQ';
const LINK_LABEL = /enganxa l’enllaç/i;

describe('Landing', () => {
  it('joins the event of a pasted invite link', async () => {
    const onJoin = vi.fn();
    const secret = generateSecret();
    render(<Landing onJoin={onJoin} canScan={false} />);
    await userEvent.type(
      screen.getByRole('textbox', { name: LINK_LABEL }),
      `https://marcllobet.github.io/pis-stop/#k=${toBase64Url(secret)}&o=${organizer}`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Entra' }));
    expect(onJoin).toHaveBeenCalledWith({ secret, organizer });
  });

  it('explains when the link is not an invite', async () => {
    const onJoin = vi.fn();
    render(<Landing onJoin={onJoin} canScan={false} />);
    await userEvent.type(
      screen.getByRole('textbox', { name: LINK_LABEL }),
      'https://marcllobet.github.io/pis-stop/',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Entra' }));
    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.getByText(/no és una invitació/)).toBeInTheDocument();
  });

  it('offers the in-app scanner only where the browser can read QR codes', () => {
    const { rerender } = render(<Landing onJoin={vi.fn()} canScan={false} />);
    expect(screen.queryByRole('button', { name: 'Escaneja el QR' })).not.toBeInTheDocument();
    expect(screen.getByText(/càmera del mòbil/)).toBeInTheDocument();
    rerender(<Landing onJoin={vi.fn()} canScan />);
    expect(screen.getByRole('button', { name: 'Escaneja el QR' })).toBeInTheDocument();
  });

  it('has no demo unless the deployment is a demo', async () => {
    const onDemo = vi.fn();
    const { rerender } = render(<Landing onJoin={vi.fn()} canScan={false} />);
    expect(screen.queryByRole('button', { name: 'Prova la demo' })).not.toBeInTheDocument();
    rerender(<Landing onJoin={vi.fn()} canScan={false} onDemo={onDemo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Prova la demo' }));
    expect(onDemo).toHaveBeenCalledOnce();
  });

  it('shows a notice only when there is one', () => {
    const { rerender } = render(<Landing onJoin={vi.fn()} canScan={false} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<Landing onJoin={vi.fn()} canScan={false} notice="Compte" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Compte');
  });
});
