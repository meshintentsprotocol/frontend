import type { ReactNode } from 'react';
import { ProcessingDialog } from './ProcessingDialog';
import { SwapServerProvider } from './SwapServerProvider';

/**
 * What App mounts: the swap server's state for everything below it, and the one processing dialog, which any
 * page can open on a record.
 */
export function SwapServerRoot({ children }: { children: ReactNode }) {
    return (
        <SwapServerProvider>
            {children}
            <ProcessingDialog />
        </SwapServerProvider>
    );
}
