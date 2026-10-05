import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// ============================================================================
// Settings primitives — the building blocks every settings view is made of
// ============================================================================

/** A titled group of rows. */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h3 className="px-2 mb-1 text-[11px] font-medium text-white/40">{title}</h3>
            <div className="flex flex-col">{children}</div>
        </section>
    );
}

interface SettingsRowProps {
    icon: LucideIcon;
    label: string;
    /** Secondary line under the label. */
    description?: string;
    /** Current value shown before the chevron on navigating rows. */
    value?: string;
    /** Draws the value as a warning that wants the user's attention. */
    valueTone?: 'default' | 'warning';
    /** Inline control (toggle, select, segmented control). Makes the row static. */
    control?: ReactNode;
    /** Navigates to a sub-view or runs an action; renders a chevron. */
    onClick?: () => void;
    /** External link; renders an arrow and opens in a new tab. */
    href?: string;
}

const ROW_CLASS = 'flex items-center gap-3 min-h-[44px] w-full px-2 py-1.5 rounded-lg text-left';
const ROW_INTERACTIVE = 'hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none transition-colors';

export function SettingsRow({ icon: Icon, label, description, value, valueTone = 'default', control, onClick, href }: SettingsRowProps) {
    const body = (
        <>
            <Icon className="h-4 w-4 shrink-0 text-white/55" />
            <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium text-white/90 truncate">{label}</span>
                {description && (
                    <span className="block text-[10px] leading-snug text-white/40">{description}</span>
                )}
            </span>
        </>
    );

    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={cn(ROW_CLASS, ROW_INTERACTIVE)}>
                {body}
                <ArrowUpRight className="h-4 w-4 shrink-0 text-white/30" />
            </a>
        );
    }

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={cn(ROW_CLASS, ROW_INTERACTIVE)}>
                {body}
                {value && (
                    <span className={cn('shrink-0 text-[11px]', valueTone === 'warning' ? 'font-semibold text-amber-300' : 'text-white/40')}>
                        {value}
                    </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
            </button>
        );
    }

    return (
        <div className={ROW_CLASS}>
            {body}
            {control && <div className="shrink-0">{control}</div>}
        </div>
    );
}

/** Frame for a second-level view: back arrow, centred title, then the content. */
export function SettingsSubpage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
    return (
        <div className="pt-2 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="relative flex items-center justify-center h-9 mb-3">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Back to settings"
                    className="absolute left-0 h-8 w-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="text-sm font-semibold text-white tracking-tight">{title}</h2>
            </div>
            {children}
        </div>
    );
}

interface SegmentedOption<T extends string> {
    value: T;
    /** Accessible name; also shown as text when there is no icon. */
    label: string;
    icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
    options: SegmentedOption<T>[];
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: SegmentedControlProps<T>) {
    return (
        <div role="radiogroup" aria-label={ariaLabel} className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
            {options.map(({ value: v, label, icon: Icon }) => (
                <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={value === v}
                    aria-label={label}
                    title={label}
                    onClick={() => onChange(v)}
                    className={cn(
                        'h-6 min-w-[32px] px-2.5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors',
                        value === v
                            ? 'bg-white/[0.12] text-white'
                            : 'text-white/45 hover:text-white/80',
                    )}
                >
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : label}
                </button>
            ))}
        </div>
    );
}

interface SettingsSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    ariaLabel: string;
    disabled?: boolean;
}

/** Compact on/off toggle sized for a settings row. */
export function SettingsSwitch({ checked, onChange, ariaLabel, disabled }: SettingsSwitchProps) {
    return (
        <Switch
            aria-label={ariaLabel}
            checked={checked}
            disabled={disabled}
            onCheckedChange={onChange}
            className="h-5 w-9 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/15 [&>span]:h-4 [&>span]:w-4 [&>span]:bg-white data-[state=checked]:[&>span]:translate-x-4"
        />
    );
}

interface SettingsSelectProps<T extends string | number> {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
    disabled?: boolean;
}

/**
 * Pill dropdown. A native <select> on purpose: a portalled menu would count as
 * a click outside the wallet popup and close it.
 */
export function SettingsSelect<T extends string | number>({ options, value, onChange, ariaLabel, disabled }: SettingsSelectProps<T>) {
    return (
        <div className={cn('relative', disabled && 'opacity-50')}>
            <select
                aria-label={ariaLabel}
                disabled={disabled}
                value={String(value)}
                onChange={e => {
                    const next = options.find(o => String(o.value) === e.target.value);
                    if (next) onChange(next.value);
                }}
                className="appearance-none h-7 pl-3 pr-7 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] font-semibold text-white/90 hover:bg-white/[0.09] focus:outline-none focus-visible:border-emerald-500/40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
                {options.map(o => (
                    <option key={String(o.value)} value={String(o.value)} className="bg-[#111] text-white">
                        {o.label}
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/50" />
        </div>
    );
}
