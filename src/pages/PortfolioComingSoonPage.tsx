import { Link } from 'react-router-dom';
import { ArrowLeft, Gift, Trophy } from 'lucide-react';

// ============================================================================
// Portfolio sub-page — Coming Soon placeholder
// ============================================================================
// Backs /portfolio/referral and /portfolio/points until those features ship.

type ComingSoonVariant = 'referral' | 'points';

const CONFIG: Record<ComingSoonVariant, { title: string; description: string; Icon: typeof Gift }> = {
    referral: {
        title: 'Referral Program',
        description: 'Invite friends to BCH Intents and earn rewards on the swaps they make. Referral tracking is on the way.',
        Icon: Gift,
    },
    points: {
        title: 'Points',
        description: 'Earn points for swapping, providing liquidity and staying active. The points program is launching soon.',
        Icon: Trophy,
    },
};

export default function PortfolioComingSoonPage({ variant }: { variant: ComingSoonVariant }) {
    const { title, description, Icon } = CONFIG[variant];

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-[1000px] mt-6">
            <Link
                to="/portfolio"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
                <ArrowLeft className="h-4 w-4" /> Back to Portfolio
            </Link>

            <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl bg-black/40 border border-white/[0.06] backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/15 rounded-full blur-[100px]" />

                <div className="relative z-10 flex flex-col items-center">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
                        <Icon className="h-8 w-8 text-white" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
                        Coming Soon
                    </span>
                    <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                    <p className="text-muted-foreground mt-3 max-w-md">{description}</p>
                </div>
            </div>
        </div>
    );
}
