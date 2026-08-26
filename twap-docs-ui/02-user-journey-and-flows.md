# 02 — TWAP User Journey & Interactive Flows

## 1. Primary Flow: Creating & Monitoring a TWAP Order

```mermaid
sequenceDiagram
    autonumber
    actor Trader as User / Trader
    participant Card as BCHSwapCard UI
    participant Hook as useTWAP Hook
    participant Server as MeshServer API
    participant History as TWAPOrderHistory UI
    participant Chain as Bitcoin Cash Network

    Trader->>Card: Select "TWAP" tab
    Trader->>Card: Enter Sell Amount (e.g. 50,000 pUSD)
    Trader->>Card: Choose 10 Slices, 1m Interval
    Card->>Hook: fetchQuote(50k, 10 slices, 60s)
    Hook->>Server: POST /api/v1/twap/quote
    Server-->>Hook: Return projection (5,000/slice, ~1.15% savings)
    Hook-->>Card: Display live breakdown & total duration (9 mins)
    
    Trader->>Card: Click "Place TWAP · 10 Slices"
    Card->>Hook: submitOrder(...)
    Hook->>Server: POST /api/v1/twap/submit
    Server-->>Hook: Return TwapOrderRecord (#7b8f9e12, status: RUNNING)
    Hook->>History: Auto-expand side panel & add order
    
    loop Every Interval (60s)
        Server->>Chain: Broadcast slice fill transaction
        Chain-->>Server: Tx Confirmation (txid: 64ed9f13...)
        History->>Server: Poll GET /api/v1/twap/address/:addr
        Server-->>History: Return updated progress (e.g. 4/10 slices)
        History-->>Trader: Animate progress bar & append fill to history table
    end

    Server-->>History: Order status updated to COMPLETED
    History-->>Trader: Display green completion badge
```

---

## 2. Secondary Flow: Order Cancellation

```mermaid
sequenceDiagram
    autonumber
    actor Trader as User / Trader
    participant History as TWAPOrderHistory UI
    participant Hook as useTWAP Hook
    participant Server as MeshServer API

    Trader->>History: Click "Cancel Order" on running order #7b8f9e12
    History->>Hook: cancelOrder(#7b8f9e12)
    Hook->>Server: POST /api/v1/twap/#7b8f9e12/cancel
    Server->>Server: Flag status = CANCELLED, halt future slice fills
    Server-->>Hook: Return updated order record (status: CANCELLED)
    Hook-->>History: Update badge to CANCELLED
    History-->>Trader: Toast: "TWAP order cancelled successfully"
```

---

## 3. Error Handling & Edge Cases

| Scenario | System Behavior | UI Feedback |
| :--- | :--- | :--- |
| **No Wallet Connected** | Submit button directs user to connect wallet | Button renders `Connect Wallet` CTA |
| **Insufficient Balance** | Calculates available balance against entered amount | Red warning banner: `Insufficient pUSD balance` |
| **Network Failure during Quote** | Falls back to baseline mathematical estimation | Subtle indicator: `Estimated fallback quote` |
| **Partial Order Cancellation** | Immediately cancels all remaining slices | Executed slices remain safely recorded in fill history |
| **Drained Pools Mid-Execution** | Scheduler pauses and re-attempts next cycle | Status badge displays `PAUSED - Re-attempting in 15s` |
