export interface ScreenPoint<T> {
  readonly item: T;
  /** Position in screen pixels at the current zoom level. */
  readonly x: number;
  readonly y: number;
}

export interface Cluster<T> {
  readonly items: readonly T[];
  /** Where the cluster started: its first point. */
  readonly x: number;
  readonly y: number;
}

/**
 * Greedy clustering in screen space: each point joins the first cluster whose
 * origin is within `radius` pixels, or starts a new one. Simple, stable for a
 * given input order and fast enough for the few hundred photos of an event.
 */
export const clusterPoints = <T>(
  points: readonly ScreenPoint<T>[],
  radius: number,
): readonly Cluster<T>[] =>
  points.reduce<readonly Cluster<T>[]>((clusters, point) => {
    const index = clusters.findIndex(
      (cluster) => Math.hypot(cluster.x - point.x, cluster.y - point.y) <= radius,
    );
    return index === -1
      ? [...clusters, { items: [point.item], x: point.x, y: point.y }]
      : clusters.map((cluster, i) =>
          i === index ? { ...cluster, items: [...cluster.items, point.item] } : cluster,
        );
  }, []);
