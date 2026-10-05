import { useState } from 'react';
import { Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    AUCTION_DURATION, AUCTION_DURATION_PRESETS, formatAuctionDuration,
    getDefaultAuctionDuration, saveAppSettings,
} from '@/lib/appSettings';

// ============================================================================
// Trading view — defaults applied to new swaps
// ============================================================================

export function TradingView() {
    const [duration, setDuration] = useState(() => getDefaultAuctionDuration());

    // Saved on every change — there is no separate save step.
    const update = (seconds: number) => {
        setDuration(seconds);
        saveAppSettings({ defaultAuctionDuration: seconds });
    };

    return (
        <div className="space-y-3">
            <div className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Gavel className="w-4 h-4 text-emerald-400" />
                        <span className="text-[13px] font-medium text-white/90">Default auction duration</span>
                    </div>
                    <span className="font-mono text-xs text-emerald-300 tabular-nums">
                        {formatAuctionDuration(duration)}
                    </span>
                </div>

                <input
                    type="range"
                    aria-label="Default auction duration"
                    min={AUCTION_DURATION.min}
                    max={AUCTION_DURATION.max}
                    step={AUCTION_DURATION.step}
                    value={duration}
                    onChange={e => update(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                />

                <div className="flex gap-1.5">
                    {AUCTION_DURATION_PRESETS.map(preset => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => update(preset)}
                            className={cn(
                                'flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors',
                                duration === preset
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-white/[0.04] text-white/60 border-white/[0.06] hover:text-white hover:bg-white/[0.07]',
                            )}
                        >
                            {formatAuctionDuration(preset)}
                        </button>
                    ))}
                </div>
            </div>

            <p className="px-1 text-[10px] leading-relaxed text-white/40">
                How long the Dutch auction on a new market swap runs before it expires. You can still change it per swap.
            </p>
        </div>
    );
}
