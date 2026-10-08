---
title: Funding prepared orders
description: An order prepared by an agent is a covenant address waiting for funds. How the maker funds it from the app or by hand, and what the funding page checks.
status: draft
updated: 2026-10-07
sources: bch-intents-mcp/src/tools/orders.ts, bch-intents-mcp/src/handoff.ts, frontend/src/pages/FundOrderPage.tsx, frontend/src/lib/fundOrder.ts, BCHMesh/meshserver/src/intents/createIntent.ts
---

The MCP server never funds an order. `create_swap_order` and `create_twap_order` stop one step short: they return a covenant and how to fund it. The maker takes the last step with their own wallet.

```mermaid title="Who does what. Nothing is locked before step 3."
sequenceDiagram
    participant U as You
    participant A as Agent
    participant M as MCP server
    participant W as Your wallet
    participant C as Chain
    U->>A: "Swap 0.001 BCH for PUSD"
    A->>M: get_quote
    A->>U: You would receive 0.29. Go ahead?
    U->>A: Yes
    A->>M: create_swap_order
    M-->>A: covenant address + fundingUrl
    A->>U: Fund it here: …/fund?intent=…
    U->>W: Open the link, approve
    W->>C: funding transaction
    C-->>U: a solver fills; you receive PUSD
```

## What a prepared order is

```json title="create_swap_order result"
{
  "network": "chipnet",
  "orderId": "intent_1791381284264_5s3bcvy",
  "orderType": "market",
  "status": "awaiting_funding",
  "maker": "bchtest:qz86d8…dy5272e",
  "sell": { "amount": "100000", "token": "BCH", "symbol": "BCH", "display": "0.001 BCH" },
  "minReceive": { "amount": "28", "token": "dfe50223…7b56039b", "symbol": "PUSDTEST", "display": "0.28 PUSDTEST" },
  "startReceive": { "amount": "29", "token": "dfe50223…7b56039b", "symbol": "PUSDTEST", "display": "0.29 PUSDTEST" },
  "minBelowQuoteBps": 344,
  "covenantAddress": "bchtest:p0073l…qvp0yda",
  "expiresAt": "2026-10-07T14:54:44.000Z",
  "refundEligibleAt": "2026-10-07T16:54:44.000Z",
  "funding": [{ "to": "bchtest:p0073l…qvp0yda", "satoshis": "100000" }],
  "fundingUrl": "https://<app>/fund?intent=intent_1791381284264_5s3bcvy&network=chipnet",
  "nextSteps": ["Nothing has moved yet: the order exists only as a covenant address waiting for funds.", "…"]
}
```

| Field | Meaning |
| --- | --- |
| `covenantAddress` | The address whose script encodes this order: maker, tokens, amounts and deadline |
| `funding` | The outputs of the funding transaction, exactly as the Mesh Server returned them. One per order; one per slice for a TWAP |
| `fundingUrl` | The page in this app where the maker funds it. Present when the server knows the app's URL |
| `minBelowQuoteBps` | How far the minimum sits below the live quote, in basis points |
| `refundEligibleAt` | From when unfilled funds can return to the maker |

`status` stays `awaiting_funding` until the funding transaction is seen. See the [Status reference](intents/status).

## Fund from the app

`fundingUrl` opens `/fund?intent=<id>` (or `/fund?twap=<orderId>`). The page:

1. Loads the order from the Mesh Server and shows it again: what is sold, the least received, the type, the expiry, and the address that gets paid.
2. Checks the funding list against the order. Every output must pay one of the order's covenants exactly its sold amount, in the sold token. If anything differs it refuses to fund and says what is wrong.
3. Asks to switch network when the order is on the other one.
4. Warns when the payout address is not the connected wallet. The bought asset and any refund go to the payout address, not to the wallet that funds.
5. Has the connected wallet sign one transaction. A TWAP funds all its slices in that one transaction.

After that it follows the order: `awaiting_funding` → `active` → `filled`, or `refunded` if nothing fills it in time.

> [!TIP]
> The link works for any unfunded order on the Mesh Server, whoever prepared it. `GET /api/v1/intent/:id` and `GET /api/v1/twap/:orderId` return `funding` while an order waits for its funds.

## Fund by hand

For integrations that sign elsewhere. Send every entry of `funding` as one output, all in **one** transaction:

| Order sells | Output |
| --- | --- |
| BCH | `satoshis` to `to` (the covenant address) |
| A CashToken | `token.amount` of `token.category` plus `satoshis` (a 1000-sat carrier) to `to` (the covenant's token address) |

> [!DANGER] Exact amounts, exact address
> - An output with less than the order sells makes the order `underfunded`: it never fills and the funds only return after the deadline.
> - Covenant addresses are P2SH32. Build the output from the address as given. Some wallet libraries mis-route P2SH32 cashaddrs to a different script; with those, pay the locking bytecode directly.
> - Do not fund an order twice. The server binds one funding output to an order; a second output to the same covenant is not tracked as part of it.

## Follow it

| Tool | Use |
| --- | --- |
| `get_order` | Status, fill or refund transaction, explorer link |
| `get_twap_order` | Every slice of a TWAP |
| `list_orders` | All orders of a maker address |
| `request_refund` | After the deadline, ask for the refund now instead of waiting for the next sweep |

An order that is never funded costs nothing. It expires on its own as `expired_unfunded`.
