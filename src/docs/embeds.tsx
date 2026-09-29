// ============================================================================
// Embed registry
// ============================================================================
// Named React embeds usable from markdown:
//
//   ```diagram intent-lifecycle
//   ```
//   ```chart dutch-decay
//   ```
//
// To add one: build the component under diagrams/ or charts/ and register it here.

import type { ComponentType } from 'react';
import { ProtocolStack } from './diagrams/ProtocolStack';
import { IntentLifecycle, PoolLifecycle, TriRoute } from './diagrams/Flows';
import { FillTransaction } from './diagrams/FillTransaction';
import { HubSpoke } from './diagrams/HubSpoke';
import { DutchDecayChart } from './charts/DutchDecayChart';
import { SurplusSplitChart } from './charts/SurplusSplitChart';
import { RebalanceCostChart } from './charts/RebalanceCostChart';

export const DIAGRAMS: Record<string, ComponentType> = {
    'protocol-stack': ProtocolStack,
    'intent-lifecycle': IntentLifecycle,
    'fill-transaction': FillTransaction,
    'tri-route': TriRoute,
    'pool-lifecycle': PoolLifecycle,
    'hub-spoke': HubSpoke,
};

export const CHARTS: Record<string, ComponentType> = {
    'dutch-decay': DutchDecayChart,
    'surplus-split': SurplusSplitChart,
    'rebalance-cost': RebalanceCostChart,
};
