import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Link2, XCircle } from 'lucide-react';

export type PositionState = 'ACTIVE' | 'OUT_OF_RANGE' | 'DRAINED' | 'CLOSED' | 'LINKED';

export interface MeshPositionStateBadgeProps {
  state: PositionState;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function derivePositionState(position: {
  isSpent?: boolean;
  reserveBch?: string | number;
  reserveTokens?: string | number;
  priceMin?: number;
  priceMax?: number;
  currentPrice?: number;
  bundleId?: string;
  pairRole?: 'FORWARD' | 'REVERSE' | 'STANDALONE';
}): PositionState {
  if (position.isSpent) {
    return 'CLOSED';
  }

  const reserveBchNum = Number(position.reserveBch || 0);
  const reserveTokensNum = Number(position.reserveTokens || 0);
  if (reserveBchNum === 0 && reserveTokensNum === 0) {
    return 'DRAINED';
  }

  if (position.currentPrice && position.priceMin && position.priceMax) {
    if (position.currentPrice < position.priceMin || position.currentPrice > position.priceMax) {
      return 'OUT_OF_RANGE';
    }
  }

  return 'ACTIVE';
}

const STATE_CONFIG: Record<
  PositionState,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  ACTIVE: {
    label: 'Active',
    icon: Activity,
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/20',
  },
  OUT_OF_RANGE: {
    label: 'Out of Range',
    icon: AlertTriangle,
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/20',
  },
  DRAINED: {
    label: 'Drained',
    icon: AlertTriangle,
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/20',
  },
  CLOSED: {
    label: 'Closed',
    icon: XCircle,
    bgClass: 'bg-zinc-500/10',
    textClass: 'text-zinc-400',
    borderClass: 'border-zinc-500/20',
  },
  LINKED: {
    label: 'Paired Mesh',
    icon: Link2,
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/20',
  },
};

export const MeshPositionStateBadge: React.FC<MeshPositionStateBadgeProps> = ({
  state,
  size = 'sm',
  showIcon = true,
  className = '',
}) => {
  const config = STATE_CONFIG[state] || STATE_CONFIG.ACTIVE;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses} ${className}`}
    >
      {showIcon && <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />}
      <span>{config.label}</span>
    </span>
  );
};
