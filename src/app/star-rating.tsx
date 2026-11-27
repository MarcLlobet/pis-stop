import { Star01 } from '@untitledui/icons';
import { RadioButton, RadioField, RadioGroup } from 'react-aria-components';

import { cx } from '@/utils/cx';

interface StarRatingProps {
  readonly label: string;
  /** 0 until the person has chosen. */
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly isDisabled?: boolean;
}

const STARS = [1, 2, 3, 4, 5] as const;

/** One to five stars, as a radio group: keyboard and screen-reader friendly. */
export const StarRating = ({ label, value, onChange, isDisabled = false }: StarRatingProps) => (
  <RadioGroup
    aria-label={label}
    orientation="horizontal"
    value={value === 0 ? null : String(value)}
    onChange={(next) => {
      onChange(Number(next));
    }}
    isDisabled={isDisabled}
    className="flex items-center justify-between gap-3"
  >
    <span className="text-sm font-medium text-secondary" aria-hidden="true">
      {label}
    </span>
    <div className="flex gap-0.5">
      {STARS.map((star) => (
        <RadioField
          key={star}
          value={String(star)}
          aria-label={`${String(star)} ${star === 1 ? 'estrella' : 'estrelles'}`}
        >
          <RadioButton className="block cursor-pointer rounded-md p-1 outline-focus-ring focus-visible:outline-2">
            <Star01
              className={cx(
                'size-7 transition-colors',
                star <= value ? 'fill-current text-fg-warning-primary' : 'text-fg-quaternary',
              )}
              aria-hidden="true"
            />
          </RadioButton>
        </RadioField>
      ))}
    </div>
  </RadioGroup>
);
