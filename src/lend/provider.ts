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

export interface ParyonStep {
    step: number;
    name: string;
    txHex: string;
    txid: string;
    wcPayload: any;
}

export interface ParyonPrepareBorrowResult {
    loanTokenId: string;
    steps: ParyonStep[];
}

export interface ParyonPrepareManageResult {
    loanTokenId: string;
    txHex: string;
    txid: string;
    wcPayload: any;
}

export interface ParyonPrepareRateResult {
    loanTokenId: string;
    txHex: string;
    txid: string;
    wcPayload: any;
}

export interface LendProvider {
    id: 'demo' | 'liquidium' | 'paryon';
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

    /** Advanced mode: supply to earn and borrow against the whole account. */
    advanced?: {
        portfolio(profileId?: string): Promise<Portfolio>;
        supply(asset: string, amount: bigint): Promise<AdvancedReceipt>;
        withdraw(asset: string, amount: bigint): Promise<AdvancedReceipt>;
        borrow(asset: string, amount: bigint): Promise<AdvancedReceipt>;
        repay(asset: string, amount: bigint): Promise<AdvancedReceipt>;

        // Profile & Account Management
        getProfileId?(address: string): Promise<string | null>;
        prepareCreateProfile?(account: string): Promise<{ message: string; expiryTimestamp: string; actionType: string; account: string }>;
        createProfile?(params: { account: string; chain: 'BTC' | 'ETH'; signature: string; expiryTimestamp: string }): Promise<{ profileId: string; account: string }>;
        supplyTarget?(params: { profileId: string; poolId: string; action: 'deposit' | 'repay'; chain: string }): Promise<{ targetAddress: string; poolId: string; action: string; chain: string }>;
        prepareBorrow?(params: { profileId: string; poolId: string; amount: string; chain: string; receiver: string; signerWalletAddress: string }): Promise<{ message: string; expiryTimestamp: string; data: any }>;
        submitBorrow?(params: { profileId: string; poolId: string; amount: string; chain: string; receiver: string; signerWalletAddress: string; expiryTimestamp: string; signature: string; signingChain: 'BTC' | 'ETH' }): Promise<AdvancedReceipt>;
        prepareWithdraw?(params: { profileId: string; poolId: string; amount: string; chain: string; receiver: string; signerWalletAddress: string }): Promise<{ message: string; expiryTimestamp: string; data: any }>;
        submitWithdraw?(params: { profileId: string; poolId: string; amount: string; chain: string; receiver: string; signerWalletAddress: string; expiryTimestamp: string; signature: string; signingChain: 'BTC' | 'ETH' }): Promise<AdvancedReceipt>;
        submitInflow?(txid: string, operation: 'deposit' | 'repayment', chain?: string): Promise<void>;
    };

    /** Native BCH Paryon borrow & loan management */
    paryon?: {
        prepareBorrow(params: { userAddress: string; userTokenAddress: string; borrowCents: string; collateralSats?: string; startingRate?: number; frontendFeeAddress?: string }): Promise<ParyonPrepareBorrowResult>;
        prepareManage(params: { userAddress: string; userTokenAddress: string; loanTokenId: string; actionType: 'repay' | 'close' | 'addCollateral' | 'withdrawCollateral'; repayCents?: string; collateralDeltaSats?: string }): Promise<ParyonPrepareManageResult>;
        prepareRate(params: { userAddress: string; userTokenAddress: string; loanTokenId: string; nextRate: number }): Promise<ParyonPrepareRateResult>;
        submit(params: { kind: 'borrow' | 'manage' | 'rate'; loanTokenId?: string; userAddress?: string; signedTxs: string[] }): Promise<{ success: boolean; txids: string[] }>;
        broadcast(txHex: string): Promise<{ txid: string }>;
    };
}
