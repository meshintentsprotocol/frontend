/**
 * Position coverage calculations (MeshDocs/meshv3v4flow/09 §3.2):
 * - In range: market price is between min and max price
 * - Out of range: market price is outside min and max price
 * - Idle: funds sitting on an inactive side or flagged by server idle analysis
 * - Closed: position has 0 balance or is explicitly closed
 */

export type CoverageStatus = 'in-range' | 'out-of-range' | 'idle' | 'closed';

export interface CoverageInput {
  status?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  marketPrice?: number | null;
  hasBch?: boolean;
  hasTokens?: boolean;
  isIdle?: boolean;
  totalValueSats?: bigint;
}

/**
 * Determine coverage status for a position.
 */
export function calculateCoverage(input: CoverageInput): CoverageStatus {
  if (input.status === 'closed' || (input.totalValueSats !== undefined && input.totalValueSats <= 0n)) {
    return 'closed';
  }

  if (input.isIdle) {
    return 'idle';
  }

  const { minPrice, maxPrice, marketPrice } = input;

  if (minPrice && maxPrice && marketPrice && minPrice > 0 && maxPrice > 0 && marketPrice > 0) {
    const lo = Math.min(minPrice, maxPrice);
    const hi = Math.max(minPrice, maxPrice);

    if (marketPrice >= lo && marketPrice <= hi) {
      return 'in-range';
    } else {
      return 'out-of-range';
    }
  }

  // If one side has exhausted its assets
  if (input.hasBch !== undefined && input.hasTokens !== undefined) {
    if (!input.hasBch && !input.hasTokens) {
      return 'closed';
    }
  }

  return 'in-range';
}

/** Human-readable status label and color classes. */
export function coverageBadge(status: CoverageStatus): { label: string; tone: 'emerald' | 'amber' | 'zinc' } {
  switch (status) {
    case 'in-range':
      return { label: 'In range', tone: 'emerald' };
    case 'out-of-range':
      return { label: 'Out of range', tone: 'amber' };
    case 'idle':
      return { label: 'Idle funds', tone: 'amber' };
    case 'closed':
      return { label: 'Closed', tone: 'zinc' };
  }
}

