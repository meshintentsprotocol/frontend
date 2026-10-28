/**
 * Simple or Advanced create mode: a per-viewer preference, kept in
 * localStorage (guarded: storage can be unavailable) and defaulting to
 * Advanced, the three-step flow.
 */
import { useCallback, useState } from 'react';

export type CreateMode = 'advanced' | 'simple';
const KEY = 'mesh:create:mode';

function read(): CreateMode {
  try {
    return localStorage.getItem(KEY) === 'simple' ? 'simple' : 'advanced';
  } catch {
    return 'advanced';
  }
}

export function useCreateMode(): [CreateMode, (m: CreateMode) => void] {
  const [mode, setMode] = useState<CreateMode>(read);
  const set = useCallback((m: CreateMode) => {
    setMode(m);
    try { localStorage.setItem(KEY, m); } catch { /* preference only */ }
  }, []);
  return [mode, set];
}
