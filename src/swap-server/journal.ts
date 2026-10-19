/**
 * The signing journal: transaction hashes of a transfer, written before each transaction is broadcast.
 *
 * The server is the source of truth for history, but there is one moment it cannot see: the wallet has sent the
 * burn and the page dies before the hash is reported. Without a record, "resume" would build and sign a second
 * burn. With it, the hash is reported on the next load and nothing is signed twice.
 *
 * It lives in localStorage and is only ever a few entries; an entry is dropped once the server has the hashes.
 */
export interface JournalRequestedInfo { nonce: number; from: string; at: number }
export interface JournalEntry {
    burn?: string;
    fee?: string;
    at: number;
    /** Phase 6: AppKit wallets broadcast themselves; the nonce is recorded before the wallet is asked */
    burnRequested?: JournalRequestedInfo;
    feeRequested?: JournalRequestedInfo;
}

export interface Journal {
    get(id: string): JournalEntry | undefined;
    set(id: string, patch: Partial<Omit<JournalEntry, 'at'>>): void;
    delete(id: string): void;
    all(): Record<string, JournalEntry>;
}

const KEY = 'swap_server_journal_v1';
const MAX_AGE_MS = 24 * 60 * 60_000;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage when there is one; otherwise memory, so a private window still completes a transfer it started. */
function defaultStore(): Store {
    try {
        if (typeof localStorage !== 'undefined') { localStorage.getItem(KEY); return localStorage; }
    } catch { /* blocked: fall through */ }
    const mem = new Map<string, string>();
    return { getItem: k => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); } };
}

export function createJournal(store: Store = defaultStore(), now: () => number = Date.now): Journal {
    const read = (): Record<string, JournalEntry> => {
        try {
            const all = JSON.parse(store.getItem(KEY) ?? '{}') as Record<string, JournalEntry>;
            const fresh: Record<string, JournalEntry> = {};
            for (const [id, e] of Object.entries(all)) if (e && typeof e.at === 'number' && now() - e.at < MAX_AGE_MS) fresh[id] = e;
            return fresh;
        } catch { return {}; }
    };
    const write = (all: Record<string, JournalEntry>) => { try { store.setItem(KEY, JSON.stringify(all)); } catch { /* full or blocked */ } };
    return {
        get: id => read()[id],
        set: (id, patch) => { const all = read(); all[id] = { ...all[id], ...patch, at: now() }; write(all); },
        delete: id => { const all = read(); if (id in all) { delete all[id]; write(all); } },
        all: read,
    };
}
