/**
 * Admin console state: the admin key (kept in this browser only), the polling
 * cadence every query follows, and the server's network.
 *
 * The key is stored in localStorage under ADMIN_KEY_STORAGE. VITE_MESH_ADMIN_KEY
 * still works as a fallback for local builds, but it is bundled into the
 * browser, so the key dialog is the intended way in.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { BCH_MESH_SERVER_URL } from '@/lib/config';
import { createAdminApi, type AdminApi } from './api';

const ADMIN_KEY_STORAGE = 'mesh-admin-key';
const POLL_STORAGE = 'mesh-admin-poll-ms';
export const POLL_OPTIONS = [
  { ms: 5_000, label: '5s' },
  { ms: 10_000, label: '10s' },
  { ms: 30_000, label: '30s' },
  { ms: 60_000, label: '1m' },
] as const;

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

interface AdminState {
  api: AdminApi;
  serverUrl: string;
  adminKey: string;
  keySource: 'stored' | 'env' | 'none';
  setAdminKey: (key: string | null) => void;
  pollMs: number;
  setPollMs: (ms: number) => void;
  paused: boolean;
  setPaused: (p: boolean) => void;
  /** refetchInterval for react-query: false while paused */
  interval: (factor?: number) => number | false;
  keyDialogOpen: boolean;
  openKeyDialog: (open?: boolean) => void;
}

const Ctx = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const envKey = (import.meta.env.VITE_MESH_ADMIN_KEY as string | undefined) ?? '';
  const [stored, setStored] = useState<string | null>(() => read(ADMIN_KEY_STORAGE));
  const [pollMs, setPollState] = useState<number>(() => Number(read(POLL_STORAGE)) || 10_000);
  const [paused, setPaused] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);

  const adminKey = stored ?? envKey;
  const api = useMemo(() => createAdminApi(BCH_MESH_SERVER_URL, () => adminKey), [adminKey]);

  const setAdminKey = useCallback((key: string | null) => { write(ADMIN_KEY_STORAGE, key); setStored(key); }, []);
  const setPollMs = useCallback((ms: number) => { write(POLL_STORAGE, String(ms)); setPollState(ms); }, []);
  const interval = useCallback((factor = 1) => (paused ? false : pollMs * factor), [paused, pollMs]);

  const value: AdminState = {
    api, serverUrl: BCH_MESH_SERVER_URL, adminKey,
    keySource: stored ? 'stored' : envKey ? 'env' : 'none',
    setAdminKey, pollMs, setPollMs, paused, setPaused, interval,
    keyDialogOpen, openKeyDialog: (open = true) => setKeyDialogOpen(open),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdmin outside AdminProvider');
  return v;
}
