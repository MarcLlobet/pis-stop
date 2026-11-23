import { ChevronDown, ChevronUp, Route } from '@untitledui/icons';
import { useState } from 'react';
import { Button as AriaButton, ToggleButton as AriaToggleButton } from 'react-aria-components';

import { cx } from '@/utils/cx';

import { formatDistance } from '../lib/format';
import { chosenOption, lineColor, modeColor, segmentStyle, walkingMinutes } from '../lib/transit';
import type { Leg, LegOption, Segment, Stop, TravelMode } from '../lib/types';
import { TRAVEL_ICONS } from './travel-icons';

interface ItineraryPanelProps {
  readonly stops: readonly Stop[];
  readonly legs: readonly Leg[];
  readonly choices: ReadonlyMap<number, number>;
  readonly onChoose: (leg: number, option: number) => void;
}

const MODE_LABELS: Readonly<Record<TravelMode, string>> = {
  metro: 'Metro',
  train: 'Tren',
  tram: 'Tramvia',
  bus: 'Bus',
  walk: 'A peu',
  bike: 'Bici',
};

const ModeIcon = ({
  mode,
  className,
}: {
  readonly mode: TravelMode;
  readonly className: string;
}) => {
  const Icon = TRAVEL_ICONS[mode];
  return <Icon className={className} aria-hidden="true" />;
};

const LineBadge = ({ line, color }: { readonly line: string; readonly color: string }) => (
  <span
    className="inline-flex h-5 min-w-7 items-center justify-center rounded px-1 text-xs font-bold text-white"
    // Colours come from the validated itinerary or a fixed table, never free text.
    style={{ backgroundColor: color }}
  >
    {line.toUpperCase()}
  </span>
);

/** One row of the Google-style timeline: walk, ride or bike. */
const SegmentRow = ({ segment }: { readonly segment: Segment }) => {
  const { ride } = segment;
  if (ride === null) {
    const mode = segment.mode === 'bike' ? 'bike' : 'walk';
    return (
      <li className="flex items-center gap-3 py-1.5 pl-1 text-sm text-tertiary">
        <ModeIcon mode={mode} className="size-4 shrink-0 text-fg-quaternary" />
        <span>
          {mode === 'walk' ? 'Camina' : 'En bici'} {segment.minutes} min
          {segment.meters > 0 && ` · ${formatDistance(segment.meters)}`}
        </span>
      </li>
    );
  }
  const color = segmentStyle(segment).color;
  return (
    <li className="flex gap-3 py-1.5">
      {/* The coloured bar is the line, as in Google Maps. */}
      <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
        <p className="flex flex-wrap items-center gap-1.5 font-medium text-primary">
          <ModeIcon mode={ride.vehicle} className="size-4 text-fg-quaternary" />
          <LineBadge line={ride.line} color={color} />
          {ride.from.name}
        </p>
        <p className="text-tertiary">
          {[
            ride.headsign === '' ? null : `Direcció ${ride.headsign}`,
            ride.stops > 0 ? `${String(ride.stops)} parades` : null,
            `${String(segment.minutes)} min`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="font-medium text-primary">Baixa a {ride.to.name}</p>
      </div>
    </li>
  );
};

/** Fallback for options typed by hand (no planned segments). */
const StepsSummary = ({ option }: { readonly option: LegOption }) =>
  option.steps.length === 0 ? null : (
    <ul className="flex flex-col gap-1.5 text-sm text-secondary">
      {option.steps.map((step) => (
        <li key={`${step.line}-${step.from}`} className="flex items-center gap-1.5">
          <LineBadge line={step.line} color={lineColor(step.line) ?? modeColor(option.mode)} />
          {step.from} → {step.to}
        </li>
      ))}
    </ul>
  );

const LegCard = ({
  leg,
  index,
  from,
  to,
  choice,
  onChoose,
}: {
  readonly leg: Leg;
  readonly index: number;
  readonly from: Stop;
  readonly to: Stop;
  readonly choice: number | undefined;
  readonly onChoose: (leg: number, option: number) => void;
}) => {
  const option = chosenOption(leg, choice);
  const selected = option === undefined ? -1 : leg.options.indexOf(option);
  return (
    <li className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-primary">
        {from.order}. {from.name} → {to.name}
      </p>
      <div role="group" aria-label="Com hi vas" className="flex flex-wrap gap-2">
        {leg.options.map((candidate, optionIndex) => (
          <AriaToggleButton
            key={`${candidate.mode}-${String(optionIndex)}`}
            isSelected={optionIndex === selected}
            onChange={() => {
              onChoose(index, optionIndex);
            }}
            className={({ isSelected }) =>
              cx(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 transition duration-100 ease-linear ring-inset outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                isSelected
                  ? 'bg-brand-solid text-white ring-transparent'
                  : 'bg-primary text-secondary ring-primary hover:bg-primary_hover',
              )
            }
          >
            <ModeIcon mode={candidate.mode} className="size-4" />
            {candidate.minutes} min
            <span className="sr-only">{MODE_LABELS[candidate.mode]}</span>
          </AriaToggleButton>
        ))}
      </div>
      {option !== undefined && (
        <>
          {option.mode !== 'walk' && walkingMinutes(option) > 0 && (
            <p className="text-xs text-tertiary">{walkingMinutes(option)} min a peu en total</p>
          )}
          {option.segments.length > 0 ? (
            <ol className="flex flex-col">
              {option.segments.map((segment, part) => (
                <SegmentRow key={`${segment.mode}-${String(part)}`} segment={segment} />
              ))}
            </ol>
          ) : (
            <StepsSummary option={option} />
          )}
        </>
      )}
    </li>
  );
};

/**
 * The itinerary, at the bottom of the map, in the spirit of Google Maps
 * directions: for each leg, the options (metro, on foot, by bike) and a
 * step-by-step timeline of the chosen one. The map draws the chosen option.
 */
export const ItineraryPanel = ({ stops, legs, choices, onChoose }: ItineraryPanelProps) => {
  const [open, setOpen] = useState(false);
  const rows = legs.flatMap((leg, index) => {
    const from = stops[index];
    const to = stops[index + 1];
    return from !== undefined && to !== undefined ? [{ leg, index, from, to }] : [];
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Itinerari"
      className="absolute inset-x-3 bottom-24 z-10 flex max-h-[60%] flex-col overflow-hidden rounded-2xl bg-primary shadow-xl ring-1 ring-secondary sm:right-auto sm:w-96"
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
        <ol className="flex flex-col gap-6 overflow-y-auto border-t border-secondary px-4 py-4">
          {rows.map(({ leg, index, from, to }) => (
            <LegCard
              key={from.id}
              leg={leg}
              index={index}
              from={from}
              to={to}
              choice={choices.get(index)}
              onChoose={onChoose}
            />
          ))}
        </ol>
      )}
    </section>
  );
};
