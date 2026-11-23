import { useEffect, useState } from 'react';

import type { CloudinaryConfig } from '../lib/cloudinary';
import { createCloudinaryClient } from '../lib/cloudinary';
import { deriveEventKeys } from '../lib/crypto';
import { createDemoRepository } from '../lib/demo';
import {
  createCloudinaryRepository,
  type EventRepository,
  type RepositoryDeps,
} from '../lib/repository';
import type { Bytes } from '../lib/types';

export interface ResolvedRepository {
  readonly repository: EventRepository;
  /** Stable id of the event, used to remember the profile per event. */
  readonly scope: string;
}

export type RepositorySource =
  | { readonly kind: 'demo' }
  | { readonly kind: 'event'; readonly secret: Bytes; readonly cloudinary: CloudinaryConfig };

/** Key derivation is async, so the repository arrives one tick later. */
export const useRepository = (
  source: RepositorySource,
  deps: RepositoryDeps,
): ResolvedRepository | null => {
  const [resolved, setResolved] = useState<ResolvedRepository | null>(null);

  useEffect(() => {
    if (source.kind === 'demo') {
      setResolved({ repository: createDemoRepository(deps), scope: 'demo' });
      return undefined;
    }
    const controller = new AbortController();
    void deriveEventKeys(source.secret).then((keys) => {
      if (!controller.signal.aborted) {
        const client = createCloudinaryClient(source.cloudinary);
        setResolved({
          repository: createCloudinaryRepository(client, keys, deps),
          scope: keys.tag,
        });
      }
    });
    return () => {
      controller.abort();
    };
  }, [source, deps]);

  return resolved;
};
