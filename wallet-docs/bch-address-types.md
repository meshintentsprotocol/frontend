# BCH Addresses vs CashToken Addresses (Token-Aware Addresses)

When building on Bitcoin Cash, especially with CashTokens, it is extremely important to understand the difference between standard BCH addresses and Token-Aware addresses.

## 1. Standard BCH Addresses (`bitcoincash:`)
A standard Bitcoin Cash address looks like this:
`bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a`

This address format (CashAddr) was introduced in 2018 to differentiate BCH addresses from BTC addresses.
- **Purpose**: It is designed to receive standard Bitcoin Cash (BCH) UTXOs.
- **Risk**: If you send CashTokens (like PUSD) to a standard `bitcoincash:` address, the wallet software on the receiving end *might not support CashTokens*. If the wallet is unaware of CashTokens, it might accidentally spend the token UTXO as regular BCH to pay for transaction fees, **burning the tokens forever**.

## 2. Token-Aware Addresses (`bitcoincash:z...`)
To prevent the accidental burning of CashTokens by legacy wallets, the BCH network introduced a new address prefix specifically for tokens, commonly referred to as "z-addresses" because the payload often starts with a `z` or `p`.

A Token-Aware address looks like this:
`bitcoincash:zpm2qsznhks23z7629mms6s4cwef74vcwv8qcx78rc`

- **Purpose**: This format signals to the sender that the receiving wallet has been upgraded and safely supports CashTokens.
- **Format**: It uses the same CashAddr encoding but changes the version byte. This mathematically alters the resulting string so that it usually begins with a `z`.
- **Interchangeability**: The underlying public key hash (the actual cryptographic destination) is **exactly the same** for both addresses. The prefix is purely a safety mechanism for the wallet software.

## Which one should our dApp use?
Because BCH Intents heavily relies on CashTokens (like ParyonUSD), **we must always use and display Token-Aware addresses** when dealing with external wallets.

If an external wallet (like Cashonize or Paytaca) connects, we should derive their Token-Aware address if they provide a standard address, ensuring any tokens sent from our dApp to their wallet won't be accidentally burned by an older wallet client.

### Address Conversion Example (Using `mainnet-js` or `libauth`)
```typescript
import { encodeCashAddress, decodeCashAddress, CashAddressType } from '@bitauth/libauth';

// Convert standard to token-aware
const decoded = decodeCashAddress(standardAddress);
if (typeof decoded === 'object') {
    const tokenAware = encodeCashAddress('bitcoincash', CashAddressType.p2pkhWithTokens, decoded.payload);
}
```
