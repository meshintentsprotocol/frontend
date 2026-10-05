import { useState } from 'react';
import { Gavel, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    AUCTION_DURATION, AUCTION_DURATION_PRESETS, SLIPPAGE_BPS_PRESETS, formatAuctionDuration,
    getAppSettings, saveAppSettings,
} from '@/lib/appSettings';

// ============================================================================
// Trading view — defaults applied to new swaps
// ============================================================================

const PRESET_CLASS = 'flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors';
const PRESET_ACTIVE = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
const PRESET_IDLE = 'bg-white/[0.04] text-white/60 border-white/[0.06] hover:text-white hover:bg-white/[0.07]';

export function TradingView() {
    const [duration, setDuration] = useState(() => getAppSettings().defaultAuctionDuration);
    const [slippageBps, setSlippageBps] = useState(() => getAppSettings().defaultSlippageBps);

    // Saved on every change — there is no separate save step.
    const update = (seconds: number) => {
        setDuration(seconds);
        saveAppSettings({ defaultAuctionDuration: seconds });
    };
    const updateSlippage = (bps: number) => {
        setSlippageBps(bps);
        saveAppSettings({ defaultSlippageBps: bps });
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
                            className={cn(PRESET_CLASS, duration === preset ? PRESET_ACTIVE : PRESET_IDLE)}
                        >
                            {formatAuctionDuration(preset)}
                        </button>
                    ))}
                </div>
            </div>

            <p className="px-1 text-[10px] leading-relaxed text-white/40">
                How long the Dutch auction on a new market swap runs before it expires. You can still change it per swap.
            </p>

            <div className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-emerald-400" />
                        <span className="text-[13px] font-medium text-white/90">Default max slippage</span>
                    </div>
                    <span className="font-mono text-xs text-emerald-300 tabular-nums">
                        {(slippageBps / 100).toFixed(1)}%
                    </span>
                </div>

                <div className="flex gap-1.5">
                    {SLIPPAGE_BPS_PRESETS.map(preset => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => updateSlippage(preset)}
                            className={cn(PRESET_CLASS, slippageBps === preset ? PRESET_ACTIVE : PRESET_IDLE)}
                        >
                            {preset / 100}%
                        </button>
                    ))}
                </div>
            </div>

            <p className="px-1 text-[10px] leading-relaxed text-white/40">
                The worst price a TWAP slice may fill at, relative to its quote. Used to seed new TWAP orders; you can still change it per order.
            </p>
        </div>
    );
}
