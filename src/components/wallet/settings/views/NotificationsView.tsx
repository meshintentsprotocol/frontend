import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAppSettings, saveAppSettings } from '@/lib/appSettings';
import type { MutableToastLevel } from '@/lib/appSettings';
import { SettingsRow, SettingsSwitch } from '../primitives';

// ============================================================================
// Notifications view — which toast levels pop up on screen
// ============================================================================

const LEVELS: { level: MutableToastLevel; label: string; description: string; icon: LucideIcon }[] = [
    { level: 'success', label: 'Success', description: 'Fills, claims, completed sends', icon: CheckCircle2 },
    { level: 'info', label: 'Info', description: 'Progress and status updates', icon: Info },
    { level: 'warning', label: 'Warnings', description: 'Things that may need attention', icon: AlertTriangle },
];

export function NotificationsView() {
    const [muted, setMuted] = useState<MutableToastLevel[]>(() => getAppSettings().mutedToasts);

    const toggle = (level: MutableToastLevel, show: boolean) => {
        const next = show ? muted.filter(l => l !== level) : [...muted, level];
        setMuted(next);
        saveAppSettings({ mutedToasts: next });
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col">
                {LEVELS.map(({ level, label, description, icon }) => (
                    <SettingsRow
                        key={level}
                        icon={icon}
                        label={label}
                        description={description}
                        control={
                            <SettingsSwitch
                                ariaLabel={`Show ${label.toLowerCase()} pop-ups`}
                                checked={!muted.includes(level)}
                                onChange={show => toggle(level, show)}
                            />
                        }
                    />
                ))}
                <SettingsRow
                    icon={XCircle}
                    label="Errors"
                    description="Always shown"
                    control={<SettingsSwitch ariaLabel="Show error pop-ups" checked disabled onChange={() => {}} />}
                />
            </div>

            <p className="px-2 text-[10px] leading-relaxed text-white/40">
                Turning a level off only hides its pop-up. Everything is still listed under Notifications.
            </p>
        </div>
    );
}
