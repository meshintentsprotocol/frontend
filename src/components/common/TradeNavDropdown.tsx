import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TradePageItem {
  name: string;
  path: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const TRADE_PAGES: TradePageItem[] = [
  {
    name: 'Swap',
    path: '/trade',
    description: 'Instant BCH atomic swaps via intents',
    icon: ArrowLeftRight,
  },
  {
    name: 'Limit',
    path: '/trade?type=limit',
    description: 'Set a target price, fill when ready',
    icon: TrendingUp,
  },
  {
    name: 'TWAP',
    path: '/twap',
    description: 'Time-weighted average price execution',
    icon: Clock,
  },
];

interface TradeNavDropdownProps {
  className?: string;
}

export function TradeNavDropdown({ className }: TradeNavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isTradeActive = location.pathname === '/trade' || location.pathname === '/twap';

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button matching the other nav items exactly */}
      <Link
        to="/trade"
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center text-[15px] font-semibold transition-all duration-300 py-2 relative group outline-none',
          isTradeActive
            ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
            : 'text-zinc-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
        )}
      >
        <span>Trade</span>

        {/* Bottom active/hover indicator line */}
        <span
          className={cn(
            'absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left shadow-[0_0_8px_rgba(52,211,153,0.8)]',
            isTradeActive && 'scale-x-100'
          )}
        />
      </Link>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 pt-2 z-50 w-60 pointer-events-auto"
          >
            {/* Invisible bridge */}
            <div className="absolute -top-2 left-0 right-0 h-2" />

            <div className="rounded-2xl border border-white/10 bg-[#0C0C0E]/95 backdrop-blur-xl shadow-2xl p-1.5 flex flex-col gap-0.5">
              {TRADE_PAGES.map((item) => {
                const Icon = item.icon;
                const isSwap = item.name === 'Swap' && location.pathname === '/trade' && !location.search.includes('type=limit') && !location.search.includes('type=twap');
                const isLimit = item.name === 'Limit' && location.pathname === '/trade' && (location.search.includes('limit'));
                const isTwap = item.name === 'TWAP' && (location.pathname === '/twap' || location.search.includes('twap'));
                const isActive = isSwap || isLimit || isTwap;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group/item',
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'hover:bg-white/[0.04] text-zinc-300 hover:text-white'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                        isActive
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-[#141418] border-white/5 text-zinc-400 group-hover/item:text-emerald-400 group-hover/item:border-emerald-500/20'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-semibold tracking-tight transition-colors',
                            isActive ? 'text-emerald-400' : 'text-zinc-200 group-hover/item:text-white'
                          )}
                        >
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-1 group-hover/item:text-zinc-400 transition-colors">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
