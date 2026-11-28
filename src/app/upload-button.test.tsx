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
      <UploadButton
        status={{ kind: 'idle' }}
        onFiles={onFiles}
        onDismiss={vi.fn()}
        onSave={vi.fn()}
      />,
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
        onSave={vi.fn()}
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
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Ups');
    await userEvent.click(screen.getByRole('button', { name: 'D’acord' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('after uploading, offers to keep the originals on the phone', async () => {
    const onSave = vi.fn();
    const onDismiss = vi.fn();
    const files = [new File(['a'], 'a.jpg', { type: 'image/jpeg' })];
    render(
      <UploadButton
        status={{ kind: 'done', files }}
        onFiles={vi.fn()}
        onDismiss={onDismiss}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Foto penjada');
    await userEvent.click(screen.getByRole('button', { name: 'Desa-la al mòbil' }));
    expect(onSave).toHaveBeenCalledWith(files);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('lets the offer go without saving', async () => {
    const onSave = vi.fn();
    const onDismiss = vi.fn();
    render(
      <UploadButton
        status={{ kind: 'done', files: [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')] }}
        onFiles={vi.fn()}
        onDismiss={onDismiss}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('2 fotos penjades');
    await userEvent.click(screen.getByRole('button', { name: 'Ara no' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
