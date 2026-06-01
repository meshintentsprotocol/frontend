import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Loader2, Check, Gavel, Moon, Sun, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AUCTION_DURATION, getDefaultAuctionDuration, saveAppSettings } from '@/lib/appSettings';
import { useTheme } from '@/context/theme-provider';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

// ============================================================================
// SettingsModal — app preferences popup
// ============================================================================
// Currently: the default Dutch-auction duration applied to new market swaps.

interface Props {
    open: boolean;
    onClose: () => void;
}

const PRESETS = [
    { label: '5m', value: 300 },
    { label: '15m', value: 900 },
    { label: '30m', value: 1800 },
    { label: '1h', value: 3600 },
];

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function SettingsModal({ open, onClose }: Props) {
    const [duration, setDuration] = useState(() => getDefaultAuctionDuration());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const isMobile = useIsMobile();
    const { theme: currentTheme, setTheme: setAppTheme } = useTheme();

    // Re-sync to the persisted value each time the popup opens.
    useEffect(() => {
        if (open) {
            setDuration(getDefaultAuctionDuration());
            setSaved(false);
        }
    }, [open]);

    if (!open) return null;

    const handleSave = () => {
        setSaving(true);
        saveAppSettings({ defaultAuctionDuration: duration });
        setSaved(true);
        toast.success('Settings saved');
        setSaving(false);
        setTimeout(onClose, 800);
    };

    const content = (
        <div className="space-y-4">
            {/* Header */}
            <div className="text-center space-y-2.5 mb-6">
                <div className="w-12 h-12 rounded-2xl mx-auto bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.3)]">
                    <Settings className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-lg font-black tracking-tight text-white">Settings</h2>
                <p className="text-xs text-white/50">Preferences applied across your swaps.</p>
            </div>

            {/* Default Dutch-auction duration */}
            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Gavel className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-white">Default auction duration</span>
                    </div>
                    <span className="font-mono text-sm text-emerald-300 tabular-nums">
                        {formatDuration(duration)}
                    </span>
                </div>

                <input
                    type="range"
                    min={AUCTION_DURATION.min}
                    max={AUCTION_DURATION.max}
                    step={AUCTION_DURATION.step}
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                />

                <div className="flex gap-1.5">
                    {PRESETS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setDuration(p.value)}
                            className={cn(
                                'flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                                duration === p.value
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-white/[0.04] text-white/60 border-white/[0.06] hover:text-white hover:bg-white/[0.07]',
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Theme Toggle */}
            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-white">Appearance</span>
                    </div>
                    
                    <div className="flex bg-[#111] border border-white/10 rounded-xl p-1">
                        <button
                            onClick={() => setAppTheme('light')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                                currentTheme === 'light'
                                    ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                                    : "text-white/50 hover:text-white/80"
                            )}
                        >
                            <Sun className="w-3.5 h-3.5" /> Light
                        </button>
                        <button
                            onClick={() => setAppTheme('dark')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                                currentTheme === 'dark'
                                    ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                                    : "text-white/50 hover:text-white/80"
                            )}
                        >
                            <Moon className="w-3.5 h-3.5" /> Dark
                        </button>
                    </div>
                </div>
            </div>

            {/* Language (Coming Soon) */}
            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 space-y-3 relative overflow-hidden group cursor-not-allowed">
                <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30">Coming Soon</span>
                </div>
                <div className="flex items-center justify-between opacity-40 grayscale pointer-events-none">
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-white">Language</span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-[#111] border border-white/10 rounded-xl px-3 py-2 text-white/70 text-xs font-bold">
                        English
                        <ChevronDown className="w-3 h-3 text-white/40" />
                    </div>
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-2 flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white transition-all duration-300 disabled:opacity-50"
            >
                {saving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : saved
                        ? <Check className="w-4 h-4" />
                        : null}
                {saved ? 'Saved' : 'Save Settings'}
            </button>
        </div>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
                <DrawerContent className="p-4 pb-8">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors z-50"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    {content}
                </DrawerContent>
            </Drawer>
        );
    }

    const modal = (
        <>
            <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md" onClick={onClose} />

            <div
                className="fixed z-[111] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-[24px] p-7 bg-[#0a0a0a]/95 border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>
                {content}
            </div>
        </>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
