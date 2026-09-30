/**
 * MeshPoolV3 encoding parity with the contracts repo (and so with the server):
 * constructor args, addresses, mirror destinations, invalid params, pricing.
 */
import { describe, it, expect } from 'vitest';
import { MockNetworkProvider } from 'cashscript';
import { binToHex } from '@bitauth/libauth';
import vectors from '../../__fixtures__/meshPoolV3.vectors.json';
import {
  buildV3Contract, mirrorOf, parseV3Params, proceedsDestination, v3ArtifactHash, v3Args, v3ContractFor,
  validateV3Params, slotPriceFromTokenPerBch, slotPriceFromRate, v3OutputFor, v3ToJson, type V3Params,
} from '../v3Pool';

const provider = new MockNetworkProvider();
const fromVector = (v: any): V3Params => parseV3Params({
  ...v, reserve: v.reserve === 'BCH' ? '0x' : v.reserve,
  slots: v.slots.map((s: any) => ({ ...s, cat: s.cat === 'BCH' ? '0x' : s.cat })),
});
const PUSD = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';

describe('MeshPoolV3 parity with the contracts repo', () => {
  it('uses the same artifact', () => {
    expect(v3ArtifactHash()).toBe((vectors as any).artifact.bytecodeSha256);
  });

  for (const v of (vectors as any).vectors) {
    it(`${v.name}: args, address, mirrors`, () => {
      const p = fromVector(v.params);
      expect(validateV3Params(p)).toBeNull();
      expect(v3Args(p).map(a => a.slice(2))).toEqual(v.args);
      const c = buildV3Contract(p, provider);
      const net = c.address.startsWith('bchtest:') ? v.chipnet : v.mainnet;
      expect(c.address).toBe(net.address);
      expect(c.tokenAddress).toBe(net.tokenAddress);
      for (const m of v.mirrors ?? []) {
        expect(binToHex(proceedsDestination(p, m.slot, provider).lockingBytecode)).toBe(m.lockingBytecodeHex);
      }
    });
  }

  for (const v of (vectors as any).invalid) {
    it(`rejects: ${v.name}`, () => {
      let err: string | null;
      try { err = validateV3Params(fromVector(v.params)); } catch (e: any) { err = e.message; }
      expect(err).toBeTruthy();
    });
  }

  it('v3ContractFor refuses params that do not produce the expected address', () => {
    const p = fromVector((vectors as any).vectors[0].params);
    const c = buildV3Contract(p, provider);
    expect(v3ContractFor(v3ToJson(p), c.address, provider).contract.address).toBe(c.address);
    expect(() => v3ContractFor({ ...v3ToJson(p), feeBps: 31 }, c.address, provider)).toThrow(/do not match/);
  });

  it('mirror of a single-slot mirror pool is the original', () => {
    const v = (vectors as any).vectors.find((x: any) => x.name === 'mode2-mirror-single');
    const p = fromVector(v.params);
    expect(mirrorOf(mirrorOf(p))).toEqual(p);
  });
});

describe('pricing', () => {
  it('"1 BCH = 500 pUSD" (2 decimals) → a bid of 2000 sats per unit, an ask of 1/2000 units per sat', () => {
    expect(slotPriceFromTokenPerBch('500', 2, true)).toEqual({ num: 2000n, den: 1n });
    expect(slotPriceFromTokenPerBch('500', 2, false)).toEqual({ num: 1n, den: 2000n });
  });

  it('token↔token rate: 1 pUSD = 100 mUSD (same decimals) → the pUSD reserve gives 1/100 per mUSD unit', () => {
    expect(slotPriceFromRate('100', 2, 2)).toEqual({ num: 1n, den: 100n });
  });

  it('covenant floor per slot', () => {
    const p = parseV3Params({ ownerPkh: 'ab'.repeat(20), reserve: '0x', feeBps: 30, mode: 0, slots: [{ cat: PUSD, num: 2000, den: 1 }] });
    expect(v3OutputFor(p, PUSD, 10n)).toBe(19_940n);
    expect(v3OutputFor(p, '0x', 10n)).toBe(0n);
  });
});
