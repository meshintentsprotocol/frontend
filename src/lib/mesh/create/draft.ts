/**
 * Unsent form values, kept per strategy and pair in sessionStorage so a
 * refresh or Back doesn't lose typing. Cleared after a successful signature.
 * Storage can be unavailable (private mode, blocked site data): every call is
 * guarded and the flow works without it.
 */

const PREFIX = 'mesh:create:draft:';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function draftKey(strategy: string, token?: string, extra?: string): string {
  return `${PREFIX}${strategy}:${token ?? '-'}${extra ? `:${extra}` : ''}`;
}

export function loadDraft(key: string): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as { at: number; values: Record<string, string> };
    if (!d || typeof d !== 'object' || typeof d.at !== 'number' || Date.now() - d.at > MAX_AGE_MS) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.values ?? {})) if (typeof v === 'string') out[k] = v;
    return out;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, values: Record<string, string>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), values }));
  } catch {
    /* storage unavailable: the draft is only a convenience */
  }
}

export function clearDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
