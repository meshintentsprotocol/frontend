import { useState } from 'react';
import {
    BellRing, BookOpen, Contrast, EyeOff, Info, KeyRound, Languages,
    Moon, PanelRight, PanelsLeftRight, ScrollText, SlidersHorizontal, Sun, Timer, Wallet,
} from 'lucide-react';
import { useWDK } from '@/context/WDKProvider';
import { useTheme } from '@/context/theme-provider';
import { hasStoredWallet } from '@/lib/crypto';
import {
    AUTO_LOCK_MINUTES_OPTIONS, MUTABLE_TOAST_LEVELS, formatAuctionDuration, getAppSettings,
    isWalletBackedUp, saveAppSettings, useAppSettings,
} from '@/lib/appSettings';
import { walletUi } from '@/lib/walletUi';
import { useExternalWallets } from '@/lib/wallets/registry';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
    SegmentedControl, SettingsRow, SettingsSection, SettingsSelect, SettingsSubpage, SettingsSwitch,
} from './primitives';
import { NotificationsView } from './views/NotificationsView';
import { AddressesView } from './views/AddressesView';
import { RecoveryPhraseView } from './views/RecoveryPhraseView';
import { TradingView } from './views/TradingView';
import { AboutView, APP_VERSION } from './views/AboutView';

// ============================================================================
// Wallet Settings Tab — preferences, wallet, security and support, with
// second-level views for anything that needs more than one row
// ============================================================================

type SettingsView = 'root' | 'trading' | 'notifications' | 'addresses' | 'recovery' | 'about';

const VIEW_TITLES: Record<Exclude<SettingsView, 'root'>, string> = {
    trading: 'Trading defaults',
    notifications: 'Notifications',
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
}

export function WalletSettingsTab({
    balanceVisible, onBalanceVisibleChange, onChangePassword,
}: WalletSettingsTabProps) {
    const [view, setView] = useState<SettingsView>('root');
    const [autoLockMinutes, setAutoLockMinutes] = useState(() => getAppSettings().autoLockMinutes);
    const wdk = useWDK();
    const { theme, setTheme } = useTheme();
    // Every hook runs before the sub-view return below: a hook after it changes the hook count
    // when a sub-view opens, React throws, and the whole wallet goes blank.
    const settings = useAppSettings();
    const externalWallets = useExternalWallets();
    const hasEncrypted = hasStoredWallet();

    if (view !== 'root') {
        return (
            <SettingsSubpage title={VIEW_TITLES[view]} onBack={() => setView('root')}>
                <ErrorBoundary label={VIEW_TITLES[view]} onReset={() => setView('root')}>
                    {view === 'trading' && <TradingView />}
                    {view === 'notifications' && <NotificationsView />}
                    {view === 'addresses' && <AddressesView onConnectExternal={() => walletUi.openConnect()} />}
                    {view === 'recovery' && <RecoveryPhraseView />}
                    {view === 'about' && <AboutView />}
                </ErrorBoundary>
            </SettingsSubpage>
        );
    }

    const updateAutoLock = (minutes: number) => {
        setAutoLockMinutes(minutes);
        saveAppSettings({ autoLockMinutes: minutes });
    };

    // Errors can't be muted, so they always count as on.
    const toastLevels = MUTABLE_TOAST_LEVELS.length + 1;
    const mutedCount = settings.mutedToasts.length;
    const backedUp = isWalletBackedUp(wdk.evmAddress);

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
                            <SettingsSwitch
                                ariaLabel="Hide balances"
                                checked={!balanceVisible}
                                onChange={hidden => onBalanceVisibleChange(!hidden)}
                            />
                        }
                    />
                    <SettingsRow
                        icon={SlidersHorizontal}
                        label="Trading defaults"
                        value={`${formatAuctionDuration(settings.defaultAuctionDuration)} · ${settings.defaultSlippageBps / 100}%`}
                        onClick={() => setView('trading')}
                    />
                    <SettingsRow
                        icon={BellRing}
                        label="Notifications"
                        value={mutedCount === 0 ? 'All on' : `${toastLevels - mutedCount} of ${toastLevels} on`}
                        onClick={() => setView('notifications')}
                    />
                </SettingsSection>

                <SettingsSection title="Layout">
                    <SettingsRow
                        icon={PanelRight}
                        label="Dock wallet to the side"
                        description="Keeps the wallet open on the right edge. Off: it opens as a popup."
                        control={
                            <SettingsSwitch
                                ariaLabel="Dock wallet to the side"
                                checked={settings.dockWallet}
                                onChange={dockWallet => saveAppSettings({ dockWallet })}
                            />
                        }
                    />
                    <SettingsRow
                        icon={PanelsLeftRight}
                        label="Dock orders beside the swap"
                        description="Shows Orders & History next to the swap card. Off: the history icon opens it as a popup."
                        control={
                            <SettingsSwitch
                                ariaLabel="Dock orders beside the swap"
                                checked={settings.dockOrders}
                                onChange={dockOrders => saveAppSettings({ dockOrders })}
                            />
                        }
                    />
                </SettingsSection>

                {(wdk.isInitialized || externalWallets.length > 0) && (
                    <SettingsSection title="Wallet">
                        <SettingsRow icon={Wallet} label="Addresses" onClick={() => setView('addresses')} />
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
                            <SettingsRow
                                icon={ScrollText}
                                label="Recovery phrase"
                                value={backedUp ? undefined : 'Not backed up'}
                                valueTone="warning"
                                onClick={() => setView('recovery')}
                            />
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

        </div>
    );
}
