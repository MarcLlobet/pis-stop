// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { safetyCode } from '../lib/identity';
import { EMPTY_SNAPSHOT, type Snapshot } from '../lib/snapshot';
import { photoView, profileView } from '../test/fixtures';
import { Lightbox } from './lightbox';

const authorId = 'DtOmq5V_9vWaljCkc9MafQ';
const photo = photoView('a', { authorId });
const snapshot: Snapshot = {
  ...EMPTY_SNAPSHOT,
  profiles: new Map([[authorId, profileView(authorId, { name: 'Anna' })]]),
  photos: [photo],
};

describe('Lightbox', () => {
  it('shows who took the photo, their safety code, then the full image', async () => {
    const openPhoto = vi.fn(() => Promise.resolve('blob:full'));
    render(<Lightbox photo={photo} snapshot={snapshot} openPhoto={openPhoto} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Anna');
    expect(dialog).toHaveTextContent(safetyCode(authorId));
    expect(openPhoto).toHaveBeenCalledWith(photo);
    expect(await screen.findByRole('img', { name: 'Foto de Anna' })).toHaveAttribute(
      'src',
      'blob:full',
    );
    expect(await screen.findByRole('link', { name: 'Descarrega la foto' })).toHaveAttribute(
      'href',
      'blob:full',
    );
  });

  it('offers no download link while the full image is not ready', () => {
    render(
      <Lightbox
        photo={photo}
        snapshot={snapshot}
        openPhoto={() => new Promise(() => undefined)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Descarrega la foto' })).not.toBeInTheDocument();
  });

  it('says so when the original fails verification', async () => {
    render(
      <Lightbox
        photo={photo}
        snapshot={snapshot}
        openPhoto={() => Promise.reject(new Error('integrity'))}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('verificació');
  });

  it('closes with its close button', async () => {
    const onClose = vi.fn();
    render(
      <Lightbox
        photo={photo}
        snapshot={snapshot}
        openPhoto={() => Promise.resolve('blob:x')}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    expect(onClose).toHaveBeenCalled();
  });
});
