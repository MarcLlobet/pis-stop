// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Onboarding } from './Onboarding';

beforeEach(() => {
  // jsdom does not implement object URLs.
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
});

const fill = async () => {
  await userEvent.type(screen.getByLabelText('Nom'), '  Júlia ');
  await userEvent.type(screen.getByLabelText('Correu'), 'julia@example.com');
};

describe('Onboarding', () => {
  it('shows the event name', () => {
    render(<Onboarding eventName="Correpisos 2026" onSubmit={vi.fn()} />);
    expect(screen.getByText('Correpisos 2026')).toBeInTheDocument();
  });

  it('keeps the submit button disabled until there is a name', async () => {
    render(<Onboarding eventName={null} onSubmit={vi.fn()} />);
    const submit = screen.getByRole('button', { name: 'Som-hi' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Nom'), 'Biel');
    expect(submit).toBeEnabled();
  });

  it('submits trimmed values and the chosen avatar', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const { container } = render(<Onboarding eventName={null} onSubmit={onSubmit} />);
    const avatar = new File(['x'], 'me.png', { type: 'image/png' });
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    await userEvent.upload(fileInput, avatar);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Som-hi' }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Júlia', email: 'julia@example.com', avatar });
    expect(screen.getByText('Canvia la foto')).toBeInTheDocument();
  });

  it('shows an error when saving fails and lets you retry', async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('Sense connexió')));
    render(<Onboarding eventName={null} onSubmit={onSubmit} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Som-hi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sense connexió');
    expect(screen.getByRole('button', { name: 'Som-hi' })).toBeEnabled();
  });
});
