/**
 * Owner "Manage" panel that adapts to the screen: an inline Panel on large
 * screens; below lg, one floating button per manage option that opens a
 * slide-up drawer on that option (the options stay switchable inside it).
 */
import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Panel } from '@/components/mesh/pools/shared';

export interface ManageOption<K extends string> { key: K; label: string; icon: LucideIcon; tone?: 'default' | 'danger' }

const SMALL = '(max-width: 1023px)';

/** True below the lg breakpoint, where the two-column page layouts collapse. */
export function useSmallScreen() {
  const [small, setSmall] = useState(() => window.matchMedia(SMALL).matches);
  useEffect(() => {
    const mql = window.matchMedia(SMALL);
    const onChange = () => setSmall(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return small;
}

export function ManageDock<K extends string>({ title, options, value, onChange, children }: {
  title: string; options: ReadonlyArray<ManageOption<K>>; value: K; onChange: (k: K) => void; children: React.ReactNode;
}) {
  const small = useSmallScreen();
  const [open, setOpen] = useState(false);

  const switcher = (
    <div className="grid gap-1 p-1 rounded-xl bg-black/40 border border-white/[0.06]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(({ key, label, icon: Icon }) => (
        <button key={key} type="button" onClick={() => onChange(key)}
          className={cn('flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold', value === key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}><Icon className="w-3.5 h-3.5" />{label}</button>
      ))}
    </div>
  );

  if (!small) return <Panel title={title}>{switcher}{children}</Panel>;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto flex w-full max-w-sm gap-1.5 p-1.5 rounded-2xl bg-[#0c0c10]/95 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.7)]">
          {options.map(({ key, label, icon: Icon, tone }) => (
            <button key={key} type="button" onClick={() => { onChange(key); setOpen(true); }}
              className={cn('flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-colors',
                tone === 'danger' ? 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25' : 'bg-emerald-500 text-black hover:bg-emerald-400')}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>
      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-base font-bold text-white">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">{options.map(o => o.label).join(' or ')}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4">{switcher}{children}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
