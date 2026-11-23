// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SNAPSHOT, type Snapshot } from '../lib/snapshot';
import { photoView, profileView, stopEntry } from '../test/fixtures';
import { Lightbox } from './Lightbox';

const photo = photoView('a', { authorId: 'anna', stopId: 's1' });
const snapshot: Snapshot = {
  ...EMPTY_SNAPSHOT,
  stops: [stopEntry('s1', 1).meta],
  profiles: new Map([['anna', profileView('anna', { name: 'Anna' })]]),
  photos: [photo],
};

describe('Lightbox', () => {
  it('shows who took the photo and where, then the full image', async () => {
    const openPhoto = vi.fn(() => Promise.resolve('blob:full'));
    render(<Lightbox photo={photo} snapshot={snapshot} openPhoto={openPhoto} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Anna');
    expect(dialog).toHaveTextContent('Pis s1');
    expect(openPhoto).toHaveBeenCalledWith(photo);
    await vi.waitFor(() => {
      expect(dialog.querySelector('img[src="blob:full"]')).not.toBeNull();
    });
  });

  it('explains when the original cannot be opened', async () => {
    render(
      <Lightbox
        photo={photo}
        snapshot={snapshot}
        openPhoto={() => Promise.reject(new Error('x'))}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText('No s’ha pogut obrir la foto original')).toBeInTheDocument();
  });

  it('closes with the button and with Escape', async () => {
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
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
