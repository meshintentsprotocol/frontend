/**
 * Notification-aware toast wrapper.
 *
 * Drop-in replacement for `import { toast } from 'sonner'`. Every call also records
 * the notification so the wallet's Notifications panel can show it — that panel was
 * previously missing almost everything, because only one file in the codebase used
 * this wrapper and 21 others called sonner directly.
 *
 * The signature deliberately mirrors sonner's, including `ReactNode` messages: some
 * callers pass JSX (e.g. SendModal's rich confirmation). Only string content can be
 * persisted, so non-string messages still toast but are recorded as a best-effort
 * label rather than being dropped or crashing.
 *
 * Levels the user muted in Settings are still recorded but not popped up; errors
 * always show.
 */
import type { ReactNode } from 'react';
import { toast as sonnerToast, ExternalToast } from 'sonner';
import { pushNotification, type StoredNotification } from '@/lib/notifications';
import { isToastMuted } from '@/lib/appSettings';

function asText(value: ReactNode): string | undefined {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
}

function record(type: StoredNotification['type'], message: ReactNode, opts?: ExternalToast) {
    // A JSX message has no meaningful string form; fall back to the description so
    // the panel still shows something useful instead of "[object Object]".
    const text = asText(message) ?? asText(opts?.description as ReactNode);
    if (!text) return;
    pushNotification(type, text, asText(message) ? asText(opts?.description as ReactNode) : undefined);
}

/** Returned in place of a toast id when the toast was muted; dismissing it is a no-op. */
const MUTED_TOAST_ID = 'muted';

export const notifyToast = {
    success(message: ReactNode, opts?: ExternalToast) {
        record('success', message, opts);
        if (isToastMuted('success')) return MUTED_TOAST_ID;
        return sonnerToast.success(message, opts);
    },
    error(message: ReactNode, opts?: ExternalToast) {
        record('error', message, opts);
        return sonnerToast.error(message, opts);
    },
    info(message: ReactNode, opts?: ExternalToast) {
        record('info', message, opts);
        if (isToastMuted('info')) return MUTED_TOAST_ID;
        return sonnerToast.info(message, opts);
    },
    warning(message: ReactNode, opts?: ExternalToast) {
        record('warning', message, opts);
        if (isToastMuted('warning')) return MUTED_TOAST_ID;
        return sonnerToast.warning(message, opts);
    },
    /** Passthrough for the bare `toast(...)` form and sonner-only helpers. */
    message(message: ReactNode, opts?: ExternalToast) {
        record('info', message, opts);
        if (isToastMuted('info')) return MUTED_TOAST_ID;
        return sonnerToast(message, opts);
    },
    dismiss: sonnerToast.dismiss,
    promise: sonnerToast.promise,
    loading: sonnerToast.loading,
    custom: sonnerToast.custom,
};
