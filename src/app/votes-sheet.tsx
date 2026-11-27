import { Check, Star01 } from '@untitledui/icons';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/base/buttons/button';
import { CloseButton } from '@/components/base/buttons/close-button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { cx } from '@/utils/cx';

import type { Snapshot } from '../lib/snapshot';
import type { Round, Scores, Stop } from '../lib/types';
import {
  CATEGORY_LABELS,
  currentRounds,
  isOpen,
  results,
  scoresOf,
  type StopResult,
} from '../lib/votes';
import { FloatingPanel } from './floating-panel';
import { StarRating } from './star-rating';

interface VotesSheetProps {
  readonly snapshot: Snapshot;
  readonly meId: string;
  readonly onClose: () => void;
  readonly onRound: (stopId: string, status: Round['status']) => Promise<void>;
  readonly onRate: (stopId: string, scores: Scores) => Promise<void>;
}

const EMPTY_SCORES: Record<string, number> = {};

const isComplete = (draft: Readonly<Record<string, number>>): draft is Scores =>
  CATEGORY_LABELS.every(({ id }) => (draft[id] ?? 0) > 0);

const formatScore = (value: number): string => value.toFixed(1).replace('.', ',');

const VoteCard = ({
  stop,
  saved,
  onRate,
}: {
  readonly stop: Stop;
  readonly saved: Scores | undefined;
  readonly onRate: (scores: Scores) => Promise<void>;
}) => {
  const [draft, setDraft] = useState<Readonly<Record<string, number>>>(saved ?? EMPTY_SCORES);
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const unchanged =
    saved !== undefined && CATEGORY_LABELS.every(({ id }) => draft[id] === saved[id]);

  const send = async () => {
    if (!isComplete(draft)) {
      return;
    }
    setStatus('sending');
    try {
      await onRate(draft);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-secondary">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-md font-semibold text-primary">{stop.name}</h3>
        {unchanged && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success-primary">
            <Check className="size-4" aria-hidden="true" />
            Vot enviat
          </span>
        )}
      </div>
      {CATEGORY_LABELS.map(({ id, label }) => (
        <StarRating
          key={id}
          label={label}
          value={draft[id] ?? 0}
          onChange={(value) => {
            setDraft((current) => ({ ...current, [id]: value }));
          }}
        />
      ))}
      {status === 'error' && (
        <p role="alert" className="text-sm text-error-primary">
          No s’ha pogut enviar. Torna-ho a provar.
        </p>
      )}
      <Button
        size="lg"
        isDisabled={!isComplete(draft) || unchanged}
        isLoading={status === 'sending'}
        onPress={() => {
          void send();
        }}
      >
        {saved === undefined ? 'Envia el vot' : 'Canvia el vot'}
      </Button>
    </li>
  );
};

const HostRow = ({
  stop,
  round,
  onRound,
}: {
  readonly stop: Stop;
  readonly round: Round | undefined;
  readonly onRound: (status: Round['status']) => Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const opened = round?.status === 'open';
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-primary">{stop.name}</p>
        <p className="text-xs text-tertiary">
          {round === undefined ? 'Sense votació' : opened ? 'Votació oberta' : 'Votació tancada'}
        </p>
      </div>
      <Button
        size="sm"
        color={opened ? 'secondary' : 'primary'}
        isLoading={busy}
        onPress={() => {
          setBusy(true);
          void onRound(opened ? 'closed' : 'open').finally(() => {
            setBusy(false);
          });
        }}
      >
        {opened ? 'Tanca' : round === undefined ? 'Obre' : 'Torna a obrir'}
      </Button>
    </li>
  );
};

const ResultRow = ({ result, place }: { readonly result: StopResult; readonly place: number }) => (
  <li className="flex flex-col gap-2 rounded-xl p-4 ring-1 ring-secondary">
    <div className="flex items-center gap-3">
      <span
        className={cx(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          place === 1 ? 'bg-brand-solid text-white' : 'bg-secondary text-secondary',
        )}
      >
        {place}
      </span>
      <h3 className="min-w-0 flex-1 truncate text-md font-semibold text-primary">
        {result.stop.name}
      </h3>
      <span className="flex shrink-0 items-center gap-1 text-md font-semibold text-primary">
        <Star01 className="size-4 fill-current text-fg-warning-primary" aria-hidden="true" />
        {result.votes === 0 ? '–' : formatScore(result.total)}
      </span>
    </div>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-tertiary">
      {CATEGORY_LABELS.map(({ id, label }) => (
        <div key={id} className="flex justify-between">
          <dt>{label}</dt>
          <dd className="font-semibold text-secondary">
            {result.votes === 0 ? '–' : formatScore(result.byCategory[id])}
          </dd>
        </div>
      ))}
    </dl>
    <p className="text-xs text-tertiary">
      {result.votes === 1 ? '1 vot' : `${String(result.votes)} vots`}
    </p>
  </li>
);

const Section = ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-sm font-semibold text-secondary">{title}</h3>
    {children}
  </section>
);

/**
 * Voting, in one place: the host's open/close controls (only if the
 * organizer named them), a card to vote on every open stop, and the ranking
 * of the closed ones. Open stops show no running total, so nobody is swayed.
 */
export const VotesSheet = ({ snapshot, meId, onClose, onRound, onRate }: VotesSheetProps) => {
  const voting = snapshot;
  const rounds = currentRounds(voting);
  const isHost = snapshot.hosts.has(meId);
  const open = snapshot.stops.filter(({ id }) => isOpen(rounds, id));
  const ranking = results(voting, snapshot.stops);
  const own = (stopId: string) => scoresOf(voting, meId, stopId);

  return (
    <FloatingPanel label="Votacions" onClose={onClose} className="bg-primary">
      <header className="flex items-start justify-between gap-4 p-4 pb-0 sm:p-6 sm:pb-0">
        <div className="flex flex-col gap-2">
          <FeaturedIcon icon={Star01} color="warning" theme="light" size="lg" />
          <h2 className="text-lg font-semibold text-primary">Votacions</h2>
        </div>
        <CloseButton label="Tanca" onPress={onClose} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
        {open.length > 0 ? (
          <Section title="Vota ara">
            <ul className="flex flex-col gap-3">
              {open.map((stop) => (
                <VoteCard
                  key={`${stop.id}:${rounds.get(stop.id)?.id ?? ''}`}
                  stop={stop}
                  saved={own(stop.id)}
                  onRate={(scores) => onRate(stop.id, scores)}
                />
              ))}
            </ul>
          </Section>
        ) : (
          ranking.length === 0 && (
            <p className="text-sm text-tertiary">
              Encara no hi ha cap votació oberta. Quan l’amfitrió n’obri una, et sortirà aquí.
            </p>
          )
        )}

        {ranking.length > 0 && (
          <Section title="Resultats">
            <ol className="flex flex-col gap-3">
              {ranking.map((result, index) => (
                <ResultRow key={result.stop.id} result={result} place={index + 1} />
              ))}
            </ol>
          </Section>
        )}

        {isHost && (
          <Section title="Amfitrió: obre i tanca les votacions">
            <ul className="flex flex-col divide-y divide-secondary">
              {snapshot.stops.map((stop) => (
                <HostRow
                  key={stop.id}
                  stop={stop}
                  round={rounds.get(stop.id)}
                  onRound={(status) => onRound(stop.id, status)}
                />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </FloatingPanel>
  );
};
