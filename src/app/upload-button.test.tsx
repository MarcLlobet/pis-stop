// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UploadButton } from './upload-button';

const fileInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="file"]')!;

describe('UploadButton', () => {
  it('hands over a photo taken with the camera', async () => {
    const onFiles = vi.fn();
    const { container } = render(
      <UploadButton status={{ kind: 'idle' }} onFiles={onFiles} onDismiss={vi.fn()} />,
    );
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput(container), file);
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('shows progress while busy', () => {
    render(
      <UploadButton
        status={{ kind: 'uploading', done: 1, total: 3 }}
        onFiles={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Pujant 2 de 3…')).toBeInTheDocument();
  });

  it('shows errors that can be dismissed', async () => {
    const onDismiss = vi.fn();
    render(
      <UploadButton
        status={{ kind: 'error', message: 'Ups' }}
        onFiles={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Ups');
    await userEvent.click(screen.getByRole('button', { name: 'D’acord' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
