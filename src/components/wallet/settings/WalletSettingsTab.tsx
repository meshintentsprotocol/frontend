import { useState } from 'react';
import {
    BookOpen, Contrast, EyeOff, Gavel, Info, KeyRound, Languages, Lock, LogOut,
    Moon, PlugZap, ScrollText, Sun, Timer, Wallet,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useTheme } from '@/context/theme-provider';
import { hasStoredWallet } from '@/lib/crypto';
import {
    AUTO_LOCK_MINUTES_OPTIONS, formatAuctionDuration, getAppSettings, saveAppSettings,
} from '@/lib/appSettings';
import { SegmentedControl, SettingsRow, SettingsSection, SettingsSelect, SettingsSubpage } from './primitives';
import { AddressesView } from './views/AddressesView';
import { RecoveryPhraseView } from './views/RecoveryPhraseView';
import { TradingView } from './views/TradingView';
import { AboutView, APP_VERSION } from './views/AboutView';

// ============================================================================
// Wallet Settings Tab — preferences, wallet, security and support, with
// second-level views for anything that needs more than one row
// ============================================================================

type SettingsView = 'root' | 'trading' | 'addresses' | 'recovery' | 'about';

const VIEW_TITLES: Record<Exclude<SettingsView, 'root'>, string> = {
    trading: 'Trading defaults',
    addresses: 'Addresses',
    recovery: 'Recovery phrase',
    about: 'About',
};

const AUTO_LOCK_OPTIONS = AUTO_LOCK_MINUTES_OPTIONS.map(minutes => ({
    value: minutes,
    label: minutes < 60 ? `${minutes} min` : `${minutes / 60} hour`,
}));

interface WalletSettingsTabProps {
    balanceVisible: boolean;
    onBalanceVisibleChange: (visible: boolean) => void;
    /** Opens the wallet-popup's change-password modal (wired by WalletPopup). */
    onChangePassword: () => void;
    /** Opens the connect-external-wallet modal (wired by WalletPopup). */
    onConnectExternal: () => void;
    /** Ends the wallet session (wired by WalletPopup). */
    onLock: () => void;
}

export function WalletSettingsTab({
    balanceVisible, onBalanceVisibleChange, onChangePassword, onConnectExternal, onLock,
}: WalletSettingsTabProps) {
    const [view, setView] = useState<SettingsView>('root');
    const [autoLockMinutes, setAutoLockMinutes] = useState(() => getAppSettings().autoLockMinutes);
    const wdk = useWDK();
    const extBCH = useExternalBCHWallet();
    const { theme, setTheme } = useTheme();
    const hasEncrypted = hasStoredWallet();

    if (view !== 'root') {
        return (
            <SettingsSubpage title={VIEW_TITLES[view]} onBack={() => setView('root')}>
                {view === 'trading' && <TradingView />}
                {view === 'addresses' && <AddressesView onConnectExternal={onConnectExternal} />}
                {view === 'recovery' && <RecoveryPhraseView />}
                {view === 'about' && <AboutView />}
            </SettingsSubpage>
        );
    }

    const updateAutoLock = (minutes: number) => {
        setAutoLockMinutes(minutes);
        saveAppSettings({ autoLockMinutes: minutes });
    };

    const externalCount = extBCH.wallets.length;

    return (
        <div className="flex flex-col min-h-full pt-3">
            <div className="flex-1 space-y-4">
                <SettingsSection title="Preferences">
                    <SettingsRow
                        icon={Contrast}
                        label="Theme"
                        control={
                            <SegmentedControl
                                ariaLabel="Theme"
                                value={theme}
                                onChange={setTheme}
                                options={[
                                    { value: 'system', label: 'Auto' },
                                    { value: 'light', label: 'Light', icon: Sun },
                                    { value: 'dark', label: 'Dark', icon: Moon },
                                ]}
                            />
                        }
                    />
                    <SettingsRow
                        icon={Languages}
                        label="Language"
                        description="More languages coming soon"
                        control={
                            <SettingsSelect
                                ariaLabel="Language"
                                disabled
                                value="en"
                                onChange={() => {}}
                                options={[{ value: 'en', label: 'English' }]}
                            />
                        }
                    />
                    <SettingsRow
                        icon={EyeOff}
                        label="Hide balances"
                        control={
                            <Switch
                                aria-label="Hide balances"
                                checked={!balanceVisible}
                                onCheckedChange={hidden => onBalanceVisibleChange(!hidden)}
                                className="h-5 w-9 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/15 [&>span]:h-4 [&>span]:w-4 [&>span]:bg-white data-[state=checked]:[&>span]:translate-x-4"
                            />
                        }
                    />
                    <SettingsRow
                        icon={Gavel}
                        label="Trading defaults"
                        value={formatAuctionDuration(getAppSettings().defaultAuctionDuration)}
                        onClick={() => setView('trading')}
                    />
                </SettingsSection>

                {wdk.isInitialized && (
                    <SettingsSection title="Wallet">
                        <SettingsRow icon={Wallet} label="Addresses" onClick={() => setView('addresses')} />
                        <SettingsRow
                            icon={PlugZap}
                            label="Connect external wallet"
                            value={externalCount > 0 ? `${externalCount} connected` : undefined}
                            onClick={onConnectExternal}
                        />
                    </SettingsSection>
                )}

                {wdk.isInitialized && (
                    <SettingsSection title="Privacy and security">
                        <SettingsRow
                            icon={Timer}
                            label="Auto-lock"
                            description="Locks after this long without activity"
                            control={
                                <SettingsSelect
                                    ariaLabel="Auto-lock"
                                    value={autoLockMinutes}
                                    onChange={updateAutoLock}
                                    options={AUTO_LOCK_OPTIONS}
                                />
                            }
                        />
                        {wdk.seedPhrase && (
                            <SettingsRow icon={ScrollText} label="Recovery phrase" onClick={() => setView('recovery')} />
                        )}
                        {hasEncrypted && (
                            <SettingsRow icon={KeyRound} label="Change password" onClick={onChangePassword} />
                        )}
                    </SettingsSection>
                )}

                <SettingsSection title="Support">
                    <SettingsRow icon={BookOpen} label="Documentation" href="https://docs.intentsprotocol.xyz/" />
                    <SettingsRow icon={Info} label="About" onClick={() => setView('about')} />
                </SettingsSection>

                <p className="px-2 text-[10px] text-white/30">Version {APP_VERSION}</p>
            </div>

            {wdk.isInitialized && (
                <div className="sticky bottom-0 -mx-3 mt-4 px-3 pt-4 pb-1 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent">
                    <button
                        type="button"
                        onClick={onLock}
                        className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-semibold bg-white/[0.06] border border-white/[0.08] text-white/90 hover:bg-white/[0.1] transition-colors"
                    >
                        {hasEncrypted ? <Lock className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        {hasEncrypted ? 'Lock wallet' : 'Disconnect wallet'}
                    </button>
                </div>
            )}
        </div>
    );
}
