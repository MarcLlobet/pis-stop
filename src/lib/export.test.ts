import { describe, expect, it, vi } from 'vitest';

import { image, party } from '../test/scenario';
import { toHex } from './encoding';
import { collectPhotos, EXPORT_DEPS, exportFileName } from './export';
import { createCloudinaryRepository } from './repository';

describe('exportFileName', () => {
  it('sorts by time and says who took it', () => {
    expect(exportFileName(0, '2026-12-12T21:04:33.120Z', 'Júlia Puig')).toBe(
      '001-2026-12-12_21-04-33-julia-puig.jpg',
    );
    expect(exportFileName(41, '2026-12-12T21:04:33.120Z', '🙂')).toBe(
      '042-2026-12-12_21-04-33-algu.jpg',
    );
  });
});

describe('collectPhotos', () => {
  it('takes every verified photo home, decrypted, oldest first', async () => {
    const { pausPhone, pau } = await party();
    const repository = createCloudinaryRepository(pausPhone.client, pau.session.keys, EXPORT_DEPS);
    const onProgress = vi.fn();

    const { exported, failed } = await collectPhotos(
      repository,
      await repository.load(),
      onProgress,
    );

    expect(failed).toEqual([]);
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(exported.map(({ author }) => author).sort()).toEqual(['Júlia', 'Pau']);
    const originals = ['FULL-PIXELS-OF-JULIA', 'FULL-PIXELS-OF-PAU'].map((marker) =>
      toHex(image(marker).bytes),
    );
    expect(exported.map(({ bytes }) => toHex(bytes)).sort()).toEqual([...originals].sort());
    expect(exported.every(({ fileName }) => /^\d{3}-.+\.jpg$/.test(fileName))).toBe(true);
  });

  it('reports a photo the server altered and still exports the rest', async () => {
    const { cloud, pausPhone, pau, juliasPhoto } = await party();
    cloud.tamper(juliasPhoto.fullUrl, (bytes) =>
      bytes.map((byte, index) => (index === 20 ? byte ^ 1 : byte)),
    );
    const repository = createCloudinaryRepository(pausPhone.client, pau.session.keys, EXPORT_DEPS);
    const { exported, failed } = await collectPhotos(repository, await repository.load());
    expect(failed.map(({ id }) => id)).toEqual([juliasPhoto.id]);
    expect(exported.map(({ author }) => author)).toEqual(['Pau']);
  });
});
