// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InstallHint } from './install-hint';

const base = { eventName: 'Correpisos 2026', platform: 'other', installed: false } as const;

describe('InstallHint', () => {
  it('installs without leaving the screen: the browser tells us when it is done', async () => {
    const install = vi.fn();
    const onContinue = vi.fn();
    render(<InstallHint {...base} install={install} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: 'Instal·la l’app' }));
    expect(install).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('points to the new icon once installed, and lets you carry on in the browser', async () => {
    const onContinue = vi.fn();
    render(<InstallHint {...base} installed install={null} onContinue={onContinue} />);
    expect(screen.getByRole('heading', { name: 'Ja la tens instal·lada' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Continua aquí/ }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('warns iPhone users that the app needs the QR from inside', () => {
    render(<InstallHint {...base} platform="ios" install={null} onContinue={vi.fn()} />);
    expect(screen.getByText(/escanejant-lo des de dins/)).toBeInTheDocument();
  });
});
