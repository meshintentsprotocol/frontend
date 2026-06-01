import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TokensTable } from '@/components/explore/TokensTable';
import { TransactionsTable } from '@/components/explore/TransactionsTable';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ChainFilter = 'All' | 'Movement' | 'Solana' | 'Bitcoin Cash' | 'EVM' | 'Monero';

const CHAIN_OPTIONS: Array<{ value: ChainFilter; label: string; icon?: string; bg?: string }> = [
    { value: 'All', label: 'All Chains' },
    { value: 'Bitcoin Cash', label: 'Bitcoin Cash', icon: '/logos/bitcoin-cash-bch-logo.svg' },
    { value: 'EVM', label: 'EVM (BSC / Sepolia)', icon: '/logos/ethereum-eth-logo.svg', bg: 'bg-yellow-500/10' },
    { value: 'Solana', label: 'Solana', icon: '/logos/solana.svg' },
    { value: 'Movement', label: 'Movement', icon: '/logos/movement.svg' },
    { value: 'Monero', label: 'Monero', icon: '/logos/monero.svg', bg: 'bg-orange-500/10' },
];

// Stack of overlapping chain logos for "All Chains"
function AllChainsIcon() {
    const stack = CHAIN_OPTIONS.filter(c => c.icon).slice(0, 5);
    return (
        <div className="flex -space-x-1.5">
            {stack.map(c => (
                <div
                    key={c.value}
                    className="h-4 w-4 rounded-full border border-[#121212] bg-white/5 p-[1px] flex items-center justify-center overflow-hidden"
                >
                    <img src={c.icon} alt={c.label} className="h-full w-full object-contain" />
                </div>
            ))}
        </div>
    );
}

function ChainIcon({ option }: { option: typeof CHAIN_OPTIONS[number] }) {
    if (option.value === 'All') return <AllChainsIcon />;
    if (!option.icon) return null;
    return (
        <div className={`h-4 w-4 rounded-full ${option.bg || 'bg-white/5'} p-[2px] flex items-center justify-center overflow-hidden flex-shrink-0`}>
            <img src={option.icon} alt={option.label} className="h-full w-full object-contain" />
        </div>
    );
}

export function ExplorePage() {
    const [activeChain, setActiveChain] = useState<ChainFilter>('All');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

    return (
        <div className="container mx-auto px-4 md:px-6 py-4 max-w-6xl">
            <Tabs defaultValue="tokens" className="w-full">
                {/* ─── Compact header — title + tabs on left, controls on right ─── */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">Explore</h1>
                        <TabsList className="bg-white/[0.03] border border-white/[0.06] h-9 p-1 rounded-xl inline-flex shrink-0">
                            <TabsTrigger
                                value="tokens"
                                className="data-[state=active]:bg-white/[0.06] data-[state=active]:text-primary rounded-lg px-4 text-xs font-semibold h-7"
                            >
                                Tokens
                            </TabsTrigger>
                            <TabsTrigger
                                value="transactions"
                                className="data-[state=active]:bg-white/[0.06] data-[state=active]:text-primary rounded-lg px-4 text-xs font-semibold h-7"
                            >
                                Transactions
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Select value={activeChain} onValueChange={(val) => setActiveChain(val as ChainFilter)}>
                            <SelectTrigger className="flex-1 sm:flex-none sm:w-[180px] h-9 bg-white/[0.03] border-white/[0.08] text-xs focus:ring-primary/20">
                                <SelectValue placeholder="Select Chain">
                                    {(() => {
                                        const opt = CHAIN_OPTIONS.find(c => c.value === activeChain) || CHAIN_OPTIONS[0];
                                        return (
                                            <div className="flex items-center gap-2">
                                                <ChainIcon option={opt} />
                                                <span className="truncate">{opt.label}</span>
                                            </div>
                                        );
                                    })()}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-[#121212] border-white/10 text-foreground">
                                {CHAIN_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                        <div className="flex items-center gap-2">
                                            <ChainIcon option={opt} />
                                            <span>{opt.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleRefresh}
                            className="h-9 w-9 shrink-0 bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
                            title="Refresh data"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* ─── Content ─── */}
                <TabsContent value="tokens" className="m-0 border-none p-0 outline-none">
                    <TokensTable activeChain={activeChain} refreshTrigger={refreshTrigger} />
                </TabsContent>

                <TabsContent value="transactions" className="m-0 border-none p-0 outline-none">
                    <TransactionsTable activeChain={activeChain} refreshTrigger={refreshTrigger} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
