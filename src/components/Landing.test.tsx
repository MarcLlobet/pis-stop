// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Landing } from './Landing';

describe('Landing', () => {
  it('starts the demo', async () => {
    const onDemo = vi.fn();
    render(<Landing onDemo={onDemo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Prova la demo' }));
    expect(onDemo).toHaveBeenCalledOnce();
  });

  it('shows a notice only when there is one', () => {
    const { rerender } = render(<Landing onDemo={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<Landing onDemo={vi.fn()} notice="Compte" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Compte');
  });
});
