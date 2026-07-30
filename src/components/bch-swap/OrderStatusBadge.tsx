/**
 * Shared order-status badges. Presentation metadata lives in `@/lib/orderStatus`
 * so this module only exports components (keeps fast refresh working).
 */
import { Badge } from '@/components/ui/badge';
import type { BCHOrderStatus } from '@/types';
import { statusMeta } from '@/lib/orderStatus';
import { cn } from '@/lib/utils';

export function OrderStatusBadge({
    status, className, showIcon = true,
}: { status?: BCHOrderStatus; className?: string; showIcon?: boolean }) {
    if (!status) return null;
    const m = statusMeta(status);
    return (
        <Badge variant="outline" className={cn('gap-1', m.cls, className)} title={m.hint}>
            {showIcon && m.icon}
            {m.label}
        </Badge>
    );
}

/** Compact pill for dense surfaces (portfolio activity, wallet lists). */
export function OrderStatusPill({ status, className }: { status?: BCHOrderStatus; className?: string }) {
    if (!status) return null;
    const m = statusMeta(status);
    return (
        <span
            title={m.hint}
            className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', m.cls, className)}
        >
            {m.label}
        </span>
    );
}
