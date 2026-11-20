/** Published metadata wins; category hashes are identifiers, not token names. */
export function cashTokenDisplay(category: string, name?: string | null, symbol?: string | null) {
    const rawName = name?.trim() ?? '';
    const rawSymbol = symbol?.trim() ?? '';
    const missingName = !rawName || /^(0x)?[0-9a-f]{64}$/i.test(rawName) || /^unknown( token)?$/i.test(rawName);
    const missingSymbol = !rawSymbol || /^unknown$/i.test(rawSymbol) || (missingName && category.toLowerCase().startsWith(rawSymbol.toLowerCase()));
    return {
        name: missingName ? 'Unnamed CashToken' : rawName,
        symbol: missingSymbol ? category.slice(0, 6) + '\u2026' + category.slice(-4) : rawSymbol,
    };
}
