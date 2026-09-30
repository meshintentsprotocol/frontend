import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Layers, BookOpen, TrendingUp, PlusCircle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MeshPageItem {
  name: string;
  path: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const MESH_PAGES: MeshPageItem[] = [
  {
    name: 'Positions',
    path: '/mesh?tab=positions',
    description: 'My active covenants & shared liquidity',
    icon: Layers,
  },
  {
    name: 'Top Pools',
    path: '/mesh?tab=pools',
    description: 'Deep liquidity depth & market pools',
    icon: TrendingUp,
  },
  {
    name: 'Leaderboard',
    path: '/mesh?tab=leaderboard',
    description: 'Top LP makers ranked by volume & APY',
    icon: Trophy,
  },
  {
    name: 'New Position',
    path: '/mesh?tab=create',
    description: 'Strategies and custom V3 pools',
    icon: PlusCircle,
  },
  {
    name: 'Order Book',
    path: '/orderbook',
    description: 'Live UTXO liquidity ladder & depth',
    icon: BookOpen,
  },
  {
    name: 'Overview',
    path: '/mesh-landing',
    description: 'Protocol intro & covenant curves',
    icon: Sparkles,
  },
];

interface MeshNavDropdownProps {
  className?: string;
}

export function MeshNavDropdown({ className }: MeshNavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentUrl = location.pathname + location.search;
  // Check if current route is one of the mesh pages
  const isMeshActive = location.pathname.startsWith('/mesh') || location.pathname === '/orderbook';

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
        to="/mesh"
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center text-[15px] font-semibold transition-all duration-300 py-2 relative group outline-none',
          isMeshActive
            ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
            : 'text-zinc-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
        )}
      >
        <span>Pool</span>

        {/* Bottom active/hover indicator line */}
        <span
          className={cn(
            'absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left shadow-[0_0_8px_rgba(52,211,153,0.8)]',
            isMeshActive && 'scale-x-100'
          )}
        />
      </Link>

      {/* Simple Clean Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 pt-2 z-50 w-64 pointer-events-auto"
          >
            {/* Invisible bridge */}
            <div className="absolute -top-2 left-0 right-0 h-2" />

            <div className="rounded-2xl border border-white/10 bg-[#0C0C0E]/95 backdrop-blur-xl shadow-2xl p-1.5 flex flex-col gap-0.5">
              {MESH_PAGES.map((item) => {
                const Icon = item.icon;
                const isActive =
                  currentUrl === item.path ||
                  (item.path === '/mesh?tab=positions' && location.pathname === '/mesh' && !location.search) ||
                  (item.path === location.pathname);

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
                      <div
                        className={cn(
                          'text-sm font-semibold tracking-tight transition-colors',
                          isActive ? 'text-emerald-400' : 'text-zinc-200 group-hover/item:text-white'
                        )}
                      >
                        {item.name}
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
