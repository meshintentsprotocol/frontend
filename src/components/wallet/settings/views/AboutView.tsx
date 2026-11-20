import { FileText, ShieldCheck } from 'lucide-react';
import { SettingsRow } from '../primitives';
import { BCHLogo } from '@/components/common/BCHLogo';

// ============================================================================
// About view — app identity and legal links
// ============================================================================

export const APP_NAME = 'BCH Intents Swap';
export const APP_VERSION = '0.1.0';

export function AboutView() {
    return (
        <div className="space-y-3">
            <div className="flex flex-col items-center text-center py-4">
                <div className="h-12 w-12 rounded-2xl bg-black/40 border border-white/[0.08] flex items-center justify-center overflow-hidden mb-2.5">
                    <BCHLogo className="w-7 h-7" />
                </div>
                <div className="text-sm font-semibold text-white tracking-tight">{APP_NAME}</div>
                <div className="text-[11px] text-white/40 mt-0.5">Intent-based cross-chain swaps on Bitcoin Cash</div>
                <div className="text-[10px] font-mono text-white/40 mt-2">Version {APP_VERSION}</div>
            </div>

            <div className="flex flex-col">
                <SettingsRow icon={FileText} label="Terms of service" href="/terms" />
                <SettingsRow icon={ShieldCheck} label="Privacy policy" href="/privacy" />
            </div>
        </div>
    );
}
