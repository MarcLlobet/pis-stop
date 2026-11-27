import type { Category, Rating, Round, Scores, Stop } from './types';

/** In the order they are asked and shown, with the label people see. */
export const CATEGORY_LABELS: readonly { readonly id: Category; readonly label: string }[] = [
  { id: 'presentation', label: 'Presentació' },
  { id: 'originality', label: 'Originalitat' },
  { id: 'taste', label: 'Sabor' },
  { id: 'craft', label: 'Elaboració' },
];

/**
 * Client clocks differ by a little: a vote sent just as the host closes the
 * round still counts if it was made within this many milliseconds.
 */
export const GRACE_MS = 60_000;

interface Voting {
  readonly rounds: readonly Round[];
  readonly ratings: readonly Rating[];
}

/** The latest open or close for each stop. */
export const currentRounds = ({ rounds }: Pick<Voting, 'rounds'>): ReadonlyMap<string, Round> =>
  new Map(
    [...rounds]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((round) => [round.stopId, round] as const),
  );

export const isOpen = (rounds: ReadonlyMap<string, Round>, stopId: string): boolean =>
  rounds.get(stopId)?.status === 'open';

/**
 * The ratings that count: one per voter and stop (their latest), only for
 * stops that were opened, and not made after the round closed.
 */
export const validRatings = ({ rounds, ratings }: Voting): readonly Rating[] => {
  const current = currentRounds({ rounds });
  const counted = [...ratings]
    .filter((rating) => {
      const round = current.get(rating.stopId);
      return (
        round !== undefined &&
        (round.status === 'open' || Date.parse(rating.at) <= Date.parse(round.at) + GRACE_MS)
      );
    })
    .sort((a, b) => a.at.localeCompare(b.at));
  return [
    ...new Map(
      counted.map((rating) => [`${rating.authorId}:${rating.stopId}`, rating] as const),
    ).values(),
  ];
};

/** What this person voted for a stop, if they did. */
export const scoresOf = (voting: Voting, authorId: string, stopId: string): Scores | undefined =>
  validRatings(voting).find((rating) => rating.authorId === authorId && rating.stopId === stopId)
    ?.scores;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export interface StopResult {
  readonly stop: Stop;
  readonly votes: number;
  readonly byCategory: Scores;
  /** Mean of the four category means. */
  readonly total: number;
}

/**
 * Results for the stops whose voting is closed (open ones stay hidden, so
 * nobody is swayed by the running total), best first.
 */
export const results = (voting: Voting, stops: readonly Stop[]): readonly StopResult[] => {
  const current = currentRounds(voting);
  const valid = validRatings(voting);
  return stops
    .filter((stop) => current.get(stop.id)?.status === 'closed')
    .map((stop): StopResult => {
      const own = valid.filter((rating) => rating.stopId === stop.id);
      const byCategory = {
        presentation: average(own.map(({ scores }) => scores.presentation)),
        originality: average(own.map(({ scores }) => scores.originality)),
        taste: average(own.map(({ scores }) => scores.taste)),
        craft: average(own.map(({ scores }) => scores.craft)),
      };
      return {
        stop,
        votes: own.length,
        byCategory,
        total: average(Object.values(byCategory)),
      };
    })
    .sort((a, b) => b.total - a.total || b.votes - a.votes);
};
