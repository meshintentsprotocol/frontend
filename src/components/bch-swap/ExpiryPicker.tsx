import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    EXPIRY_PRESETS, checkExpiry, describeDuration, formatExpiryAt, maxInUnit, type ExpiryUnit,
} from '@/lib/expiry';

export interface ExpiryPickerProps {
    /** Seconds the order stays open, or null while the custom entry is not valid. */
    value: number | null;
    onChange: (seconds: number | null) => void;
    /** Ticks once a second while shown, for the "expires at" line. */
    nowMs?: number;
}

const UNITS: ReadonlyArray<{ value: ExpiryUnit; label: string }> = [
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
];

/**
 * How long a limit order stays open: one tap on a preset, or a number and a unit.
 * Limits are the server's (5 minutes to 7 days); an entry outside them says so here
 * instead of failing when the order is placed.
 */
export function ExpiryPicker({ value, onChange, nowMs = Date.now() }: ExpiryPickerProps) {
    const presetMatch = EXPIRY_PRESETS.find(p => p.seconds === value);
    const [custom, setCustom] = useState(!presetMatch && value !== null);
    const [amount, setAmount] = useState('2');
    const [unit, setUnit] = useState<ExpiryUnit>('hours');

    const check = checkExpiry(amount, unit);

    // While custom is open the typed entry is the value.
    useEffect(() => {
        if (custom) onChange(check.ok ? check.seconds : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [custom, amount, unit]);

    const pick = (seconds: number) => { setCustom(false); onChange(seconds); };
    const chip = (active: boolean) => cn(
        'min-w-[2.5rem] rounded-md border px-2 py-1 text-xs font-semibold transition-colors',
        active
            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
            : 'border-white/[0.06] bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white',
    );

    return (
        <div className="space-y-2" data-expiry-picker>
            <div className="flex flex-wrap items-center justify-between gap-y-2">
                <span className="shrink-0 text-sm text-white/50">Expires in</span>
                <div className="flex flex-wrap justify-end gap-1" role="radiogroup" aria-label="Order expiry">
                    {EXPIRY_PRESETS.map(p => (
                        <button key={p.label} type="button" role="radio" aria-checked={!custom && value === p.seconds}
                            onClick={() => pick(p.seconds)} className={chip(!custom && value === p.seconds)}>
                            {p.label}
                        </button>
                    ))}
                    <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)} className={chip(custom)}>
                        Custom
                    </button>
                </div>
            </div>

            {custom && (
                <div className="flex items-center justify-end gap-2">
                    <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        max={maxInUnit(unit)}
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        aria-label="Expiry amount"
                        aria-invalid={!check.ok}
                        className={cn(
                            'h-8 w-20 rounded-md border bg-black/40 px-2 text-right text-sm tabular-nums text-white outline-none',
                            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                            check.ok ? 'border-white/10 focus:border-emerald-500/50' : 'border-red-500/50',
                        )}
                    />
                    <Select value={unit} onValueChange={v => setUnit(v as ExpiryUnit)}>
                        <SelectTrigger aria-label="Expiry unit" className="h-8 w-28 border-white/10 bg-black/40 text-sm text-white focus:ring-1 focus:ring-emerald-500/50 focus:ring-offset-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#0a0a0a] text-white">
                            {UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <p className={cn('text-right text-xs', value === null ? 'text-red-400' : 'text-white/40')} aria-live="polite">
                {value === null
                    ? (check.ok ? '' : `${check.error} (5 minutes to 7 days)`)
                    : `Open for ${describeDuration(value)} · until ${formatExpiryAt(Math.floor(nowMs / 1000) + value, nowMs)}`}
            </p>
        </div>
    );
}
