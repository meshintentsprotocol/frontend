/**
 * How a deposit spreads across pools or bins: Spot, Curve, Bid-Ask, each with a
 * small picture; strength appears only for Curve and Bid-Ask (server:
 * strategies/shapes.ts).
 */
import { ChoiceCards } from './ChoiceCards';
import { TierChips } from './TierChips';

export type Shape = 'spot' | 'curve' | 'bidask';
export type Strength = 'gentle' | 'standard' | 'aggressive';

const SHAPES: Array<{ value: Shape; title: string; line: string }> = [
  { value: 'spot', title: 'Spot', line: 'Even across the range. The default when unsure.' },
  { value: 'curve', title: 'Curve', line: 'Most next to the price. For calm or pegged pairs.' },
  { value: 'bidask', title: 'Bid-Ask', line: 'Most at the edges. For volatile pairs, or buying dips and selling rips.' },
];

/** Bar heights (0–1) for a shape's picture, 9 bars, the market in the middle. */
export function shapeHeights(shape: Shape, n = 9): number[] {
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, k) => {
    const d = Math.abs(k - mid) / mid;
    return shape === 'spot' ? 0.6 : shape === 'curve' ? 0.2 + 0.8 * (1 - d * d) : 0.2 + 0.8 * d * d;
  });
}

function ShapeArt({ shape }: { shape: Shape }) {
  const hs = shapeHeights(shape);
  return (
    <span className="flex h-10 items-end gap-[3px]" aria-hidden>
      {hs.map((h, k) => (
        <span key={k} className={k < 4 ? 'w-2 rounded-sm bg-emerald-400' : k > 4 ? 'w-2 rounded-sm bg-cyan-400' : 'w-2 rounded-sm bg-zinc-400'}
          style={{ height: `${Math.round(h * 100)}%` }} />
      ))}
    </span>
  );
}

export function ShapePicker({ shape, strength, onShape, onStrength, columns = 3 }: {
  shape: Shape;
  strength: Strength;
  onShape: (s: Shape) => void;
  onStrength: (s: Strength) => void;
  columns?: 1 | 3;
}) {
  return (
    <div className="space-y-3">
      <ChoiceCards
        label="Shape"
        value={shape}
        onChange={onShape}
        columns={columns}
        size="sm"
        options={SHAPES.map(s => ({ ...s, art: <ShapeArt shape={s.value} /> }))}
      />
      {shape !== 'spot' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-zinc-400">Strength</span>
          <TierChips
            label="Strength"
            mono={false}
            className="min-w-[260px] flex-1"
            value={strength}
            onChange={onStrength}
            options={[{ value: 'gentle', label: 'Gentle' }, { value: 'standard', label: 'Standard' }, { value: 'aggressive', label: 'Aggressive' }]}
          />
        </div>
      )}
    </div>
  );
}
