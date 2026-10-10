/**
 * What a lending backend has to offer the pages. Two exist: `demo` (in the browser, nothing real) and
 * `liquidium` (through the swap server). A third, for BCH collateral, will implement the same interface, and no
 * page changes.
 */
import type { AdvancedReceipt, CreateLoanRequest, LendQuote, LoanView, Market, Portfolio, QuoteRequest } from './types';

export class LendError extends Error {
    constructor(message: string, public status = 0) {
        super(message);
        this.name = 'LendError';
    }
}

export interface LendProvider {
    id: 'demo' | 'liquidium';
    listMarkets(): Promise<Market[]>;
    quote(req: QuoteRequest): Promise<LendQuote>;
    /** Creates the loan and returns it with the address to send the collateral to. */
    createLoan(req: CreateLoanRequest): Promise<LoanView>;
    getLoan(ref: string, fresh?: boolean): Promise<LoanView>;
    /** Loans for a loan ID or an address. */
    findLoans(query: string): Promise<LoanView[]>;
    /** Loans this browser knows about. */
    myLoans(addresses: string[]): Promise<LoanView[]>;
    forgetLoan(ref: string): void;

    /**
     * Only in demo: stand in for the transfers a real user makes from their wallet. A real loan is repaid and
     * topped up by sending to its addresses, so the real provider has none of these.
     */
    simulate?: {
        repay(ref: string, amount: bigint): Promise<LoanView>;
        depositMore(ref: string, amount: bigint): Promise<LoanView>;
    };

    /** Advanced mode: supply to earn and borrow against the whole account. Demo only for now. */
    advanced?: {
        portfolio(): Promise<Portfolio>;
        supply(asset: string, amount: bigint): Promise<AdvancedReceipt>;
        withdraw(asset: string, amount: bigint): Promise<AdvancedReceipt>;
        borrow(asset: string, amount: bigint): Promise<AdvancedReceipt>;
        repay(asset: string, amount: bigint): Promise<AdvancedReceipt>;
    };
}
