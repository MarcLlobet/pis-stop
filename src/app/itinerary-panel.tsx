import { ChevronDown, ChevronUp, Route } from '@untitledui/icons';
import { useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';

import { lineColor, modeColor } from '../lib/transit';
import type { Leg, LegOption, Stop } from '../lib/types';
import { TRAVEL_ICONS } from './travel-icons';

interface ItineraryPanelProps {
  readonly stops: readonly Stop[];
  readonly legs: readonly Leg[];
}

const MODE_LABELS: Readonly<Record<LegOption['mode'], string>> = {
  metro: 'Metro',
  train: 'Tren',
  tram: 'Tramvia',
  bus: 'Bus',
  walk: 'A peu',
  bike: 'Bici',
};

const LineBadge = ({ line }: { readonly line: string }) => (
  <span
    className="inline-flex h-5 min-w-7 items-center justify-center rounded px-1 text-xs font-bold text-white"
    // Line colours come from a fixed table, never from user data.
    style={{ backgroundColor: lineColor(line) ?? modeColor('metro') }}
  >
    {line.toUpperCase()}
  </span>
);

const OptionRow = ({ option }: { readonly option: LegOption }) => {
  const Icon = TRAVEL_ICONS[option.mode];
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
      <Icon className="size-4 shrink-0 text-fg-quaternary" aria-label={MODE_LABELS[option.mode]} />
      {option.steps.length === 0 ? (
        <span>{MODE_LABELS[option.mode]}</span>
      ) : (
        option.steps.map((step) => (
          <span key={`${step.line}-${step.from}`} className="inline-flex items-center gap-1.5">
            <LineBadge line={step.line} />
            {step.from} – {step.to}
          </span>
        ))
      )}
      <span className="ml-auto font-semibold text-primary tabular-nums">{option.minutes} min</span>
    </li>
  );
};

/**
 * The itinerary, below the map: how to get from each flat to the next, with
 * every option (metro lines, on foot, by bike). Collapsed by default so the
 * map stays visible.
 */
export const ItineraryPanel = ({ stops, legs }: ItineraryPanelProps) => {
  const [open, setOpen] = useState(false);
  const rows = legs.flatMap((leg, index) => {
    const from = stops[index];
    const to = stops[index + 1];
    return from !== undefined && to !== undefined ? [{ leg, from, to }] : [];
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Itinerari"
      className="absolute inset-x-3 bottom-24 z-10 flex max-h-[55%] flex-col overflow-hidden rounded-2xl bg-primary shadow-xl ring-1 ring-secondary sm:right-auto sm:w-96"
    >
      <AriaButton
        onPress={() => {
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        className="flex items-center gap-2 px-4 py-3 text-left outline-focus-ring focus-visible:outline-2"
      >
        <Route className="size-5 text-fg-brand-primary" aria-hidden="true" />
        <span className="flex-1 text-md font-semibold text-primary">Itinerari</span>
        <span className="text-sm text-tertiary">{rows.length} trams</span>
        {open ? (
          <ChevronDown className="size-5 text-fg-quaternary" aria-hidden="true" />
        ) : (
          <ChevronUp className="size-5 text-fg-quaternary" aria-hidden="true" />
        )}
      </AriaButton>
      {open && (
        <ol className="flex flex-col gap-4 overflow-y-auto border-t border-secondary px-4 py-3">
          {rows.map(({ leg, from, to }) => (
            <li key={from.id} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-primary">
                {from.order}. {from.name} → {to.name}
              </p>
              <ul className="flex flex-col gap-1.5">
                {leg.options.map((option) => (
                  <OptionRow key={`${option.mode}-${String(option.minutes)}`} option={option} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
