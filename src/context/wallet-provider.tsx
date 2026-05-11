import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AccountInfo, AptosWallet, NetworkInfo, UserResponseStatus } from '@aptos-labs/wallet-standard';
import { waitForWallet, connectWallet, disconnectWallet, getWalletNetwork, changeWalletNetwork } from '@/lib/wallet/adapter';
import { DEFAULT_NETWORK, MOVEMENT_CHAIN_IDS, NETWORK_MAP } from '@/lib/wallet/networks';
import { toast } from 'sonner';

interface WalletContextType {
    connected: boolean;
    connecting: boolean;
    account: AccountInfo | undefined;
    network: NetworkInfo | undefined;
    wallet: AptosWallet | undefined;
    walletName: string | undefined;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    changeNetwork: (chainId: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [account, setAccount] = useState<AccountInfo | undefined>();
    const [network, setNetwork] = useState<NetworkInfo | undefined>();
    const [wallet, setWallet] = useState<AptosWallet | undefined>();

    // Initialize wallet detection and auto-connect
    useEffect(() => {
        const detectAndConnect = async () => {
            // 1. Wait for wallets to be injected
            const detectedWallet = await waitForWallet(15, 200);
            if (detectedWallet) {
                setWallet(detectedWallet);
                console.log('Wallet detected:', detectedWallet.name);

                // 2. Check for persisted session
                const savedWalletName = localStorage.getItem('movement_wallet_name');
                if (savedWalletName && detectedWallet.name === savedWalletName) {
                    console.log('Restoring saved wallet session:', savedWalletName);

                    // Skip auto-connect for Nightly as it causes unwanted popups on load
                    if (detectedWallet.name === 'Nightly') {
                        console.log('Skipping auto-connect for Nightly to prevent popups on load');
                        return;
                    }

                    try {
                        setConnecting(true);
                        const response = await connectWallet(detectedWallet);
                        if (response.status === UserResponseStatus.APPROVED) {
                            setAccount(response.args);
                            setConnected(true);
                            const networkInfo = await getWalletNetwork(detectedWallet);
                            if (networkInfo) setNetwork(networkInfo);
                        }
                    } catch (e) {
                        console.error('Failed to auto-connect restored session', e);
                    } finally {
                        setConnecting(false);
                    }
                }

            } else {
                console.log('No wallet detected after retries');
            }
        };

        detectAndConnect();
    }, []);

    const connect = useCallback(async () => {
        let currentWallet = wallet;

        if (!currentWallet) {
            toast.info('Detecting wallet...');
            currentWallet = await waitForWallet(10, 200);
            if (currentWallet) {
                setWallet(currentWallet);
            } else {
                toast.error('No wallet detected. Please install Nightly wallet and refresh the page.');
                return;
            }
        }

        setConnecting(true);
        try {
            const response = await connectWallet(currentWallet);

            if (response.status === UserResponseStatus.APPROVED) {
                setAccount(response.args);
                setConnected(true);

                // Persist session
                localStorage.setItem('movement_wallet_name', currentWallet.name);

                const networkInfo = await getWalletNetwork(currentWallet);
                if (networkInfo) {
                    setNetwork(networkInfo);

                    // Check if on Movement network
                    if (!MOVEMENT_CHAIN_IDS.includes(networkInfo.chainId)) {
                        try {
                            const changeResponse = await changeWalletNetwork(currentWallet, {
                                chainId: DEFAULT_NETWORK.chainId,
                                name: DEFAULT_NETWORK.name as any,
                                url: DEFAULT_NETWORK.url,
                            });
                            if (changeResponse?.status === UserResponseStatus.APPROVED) {
                                const newNetwork = await getWalletNetwork(currentWallet);
                                if (newNetwork) setNetwork(newNetwork);
                                toast.success('Connected and switched to Movement network!');
                            } else {
                                toast.warning('Connected, but not on Movement network');
                            }
                        } catch (e) {
                            toast.warning('Connected, but could not switch network');
                        }
                    } else {
                        toast.success('Wallet connected!');
                    }
                } else {
                    toast.success('Wallet connected!');
                }
            } else {
                toast.error('Connection rejected');
            }
        } catch (error) {
            console.error('Connection failed:', error);
            toast.error('Failed to connect wallet');
        } finally {
            setConnecting(false);
        }
    }, [wallet]);

    const disconnect = useCallback(async () => {
        if (!wallet) return;

        try {
            await disconnectWallet(wallet);
            setAccount(undefined);
            setConnected(false);
            setNetwork(undefined);

            // Clear session
            localStorage.removeItem('movement_wallet_name');

            toast.success('Wallet disconnected');
        } catch (error) {
            console.error('Disconnect failed:', error);
        }
    }, [wallet]);

    const changeNetworkFn = useCallback(async (chainId: number) => {
        if (!wallet) return;

        const targetNetwork = NETWORK_MAP[chainId.toString()];
        if (!targetNetwork) {
            toast.error('Unknown network');
            return;
        }

        if (network?.chainId === chainId) {
            toast.info('Already on this network');
            return;
        }

        try {
            const response = await changeWalletNetwork(wallet, {
                chainId: targetNetwork.chainId,
                name: targetNetwork.name as any,
                url: targetNetwork.url,
            });

            if (response?.status === UserResponseStatus.APPROVED) {
                const newNetwork = await getWalletNetwork(wallet);
                if (newNetwork) setNetwork(newNetwork);
                toast.success(`Switched to ${targetNetwork.buttonName}`);
            } else {
                toast.error('Network change rejected');
            }
        } catch (error) {
            console.error('Network change failed:', error);
            toast.error('Failed to change network');
        }
    }, [wallet, network]);

    return (
        <WalletContext.Provider
            value={{
                connected,
                connecting,
                account,
                network,
                wallet,
                walletName: wallet?.name,
                connect,
                disconnect,
                changeNetwork: changeNetworkFn,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
};
