/**
 * A dialog on wide screens and a bottom sheet on phones, with one API.
 * Closing is blocked while `busy` (a transaction is being signed or sent).
 */
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function ResponsiveDialog({ open, onOpenChange, title, description, children, busy, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  className?: string;
}) {
  const mobile = useIsMobile();
  const change = (o: boolean) => { if (!busy || o) onOpenChange(o); };
  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={change} dismissible={!busy}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading text-lg text-white">{title}</DrawerTitle>
            {description && <DrawerDescription className="text-xs text-zinc-400">{description}</DrawerDescription>}
          </DrawerHeader>
          <div className={cn('overflow-y-auto px-4 pb-6', className)}>{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className={cn('max-w-lg rounded-3xl border border-neutral-800 bg-[#0a0a0d] text-white', className)}
        onInteractOutside={e => { if (busy) e.preventDefault(); }} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">{title}</DialogTitle>
          {description && <DialogDescription className="text-xs text-neutral-400">{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
