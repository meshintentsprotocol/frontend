/**
 * Loan events, sent through the app's own toasts and notification panel (lib/notify-toast), so they show up
 * where every other event in the app does. One sentence per change of stage; nothing while a stage only ticks.
 */
import { notifyToast } from '@/lib/notify-toast';
import { fmtPct, toNumber, fmt } from './math';
import type { LoanView } from './types';

const tag = (loan: LoanView) => (loan.provider === 'demo' ? `Demo loan ${loan.ref}` : `Loan ${loan.ref}`);
const borrowed = (loan: LoanView) => `${fmt(toNumber(loan.borrow.amount, loan.borrow.decimals))} ${loan.borrow.asset}`;
const collateral = (loan: LoanView) => `${fmt(toNumber(loan.collateral.amount, loan.collateral.decimals), 8)} ${loan.collateral.asset}`;

export function notifyLoanCreated(loan: LoanView) {
    notifyToast.success(`${tag(loan)} created`, { description: `Send ${collateral(loan)} as collateral to receive ${borrowed(loan)}.` });
}

/** Call with the loan as it was and as it is now. Says something only when the stage changed. */
export function notifyLoanChange(prev: LoanView, next: LoanView) {
    if (prev.phase === next.phase) {
        // The one thing worth saying inside a stage: the loan drifted close to liquidation.
        const warnAt = next.liquidationThresholdBps - 600;
        if (next.phase === 'active' && prev.ltvBps < warnAt && next.ltvBps >= warnAt) {
            notifyToast.warning(`${tag(next)} is at ${fmtPct(next.ltvBps)} LTV`, { description: `It can be liquidated at ${fmtPct(next.liquidationThresholdBps, 0)}. Repay part of it or add collateral.` });
        }
        return;
    }
    switch (next.phase) {
        case 'confirming':
            notifyToast.info(`${tag(next)}: deposit seen`, { description: `Waiting for ${next.status.requiredConfirmations ?? 4} confirmations before ${borrowed(next)} is sent.` });
            break;
        case 'active':
            if (prev.phase === 'repaying') notifyToast.success(`${tag(next)}: repayment received`, { description: 'The debt is lower. The rest stays open.' });
            else notifyToast.success(`${tag(next)} is active`, { description: `${borrowed(next)} is on its way to your address.` });
            break;
        case 'repaying':
            notifyToast.info(`${tag(next)}: repayment seen`, { description: 'Waiting for it to confirm.' });
            break;
        case 'closed':
            notifyToast.success(`${tag(next)} is repaid`, { description: `${collateral(next)} is being returned to your address.` });
            break;
        case 'expired':
            notifyToast.warning(`${tag(next)} expired`, { description: 'No collateral arrived in time. Nothing was borrowed.' });
            break;
        case 'failed':
            notifyToast.error(`${tag(next)} failed`, { description: 'Open the loan for details.' });
            break;
        case 'liquidated':
            notifyToast.error(`${tag(next)} was liquidated`, { description: 'Part of the collateral was sold to cover the debt.' });
            break;
        default:
            break;
    }
}
