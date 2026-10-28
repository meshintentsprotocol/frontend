import { describe, it, expect } from 'vitest';
import { ELECTRUM_HOSTS, SerialElectrumProvider } from '../bchElectrum';

type Log = { inFlight: number; maxInFlight: number; clients: number };

/** A stand-in Electrum client: counts overlapping requests and can fail like a dropped or dead socket. */
function fakeClient(log: Log, fail: { next?: string | 'hang' | 'reject-empty' } = {}) {
  log.clients += 1;
  let connected = false;
  return {
    async connect() {
      if (fail.next === 'reject-empty') { fail.next = undefined; throw undefined; }
      if (connected) throw new Error('Cannot initiate a new socket connection when an existing connection exists');
      connected = true;
    },
    async disconnect() { connected = false; return true; },
    async request(method: string) {
      if (!connected) throw new Error(`Unable to send request to a disconnected server 'fake'.`);
      if (fail.next === 'hang') { fail.next = undefined; return new Promise(() => undefined); }
      log.inFlight += 1;
      log.maxInFlight = Math.max(log.maxInFlight, log.inFlight);
      await new Promise(r => setTimeout(r, 5));
      log.inFlight -= 1;
      if (fail.next) { const m = fail.next; fail.next = undefined; return new Error(m); }
      return method === 'blockchain.headers.subscribe' ? { height: 1 } : [];
    },
  };
}

const ADDR = 'bchtest:qq87j7t88y7p90eyazehfvmjwu76hmny2uh4nvhgk4';
const newLog = (): Log => ({ inFlight: 0, maxInFlight: 0, clients: 0 });

describe('shared Electrum provider', () => {
  it('uses a chipnet server that answers', () => {
    expect(ELECTRUM_HOSTS.chipnet).toBe('chipnet.imaginary.cash');
  });

  it('runs overlapping requests one at a time', async () => {
    const log = newLog();
    const p = new SerialElectrumProvider('chipnet', { newClient: () => fakeClient(log) });
    await Promise.all([p.getUtxos(ADDR), p.getUtxos(ADDR), p.getBlockHeight(), p.getUtxos(ADDR)]);
    expect(log.maxInFlight).toBe(1);
  });

  it('starts over with a fresh client after a connection error and retries once', async () => {
    const log = newLog();
    const fail = { next: 'Unable to send request to a disconnected server' };
    const p = new SerialElectrumProvider('chipnet', { newClient: () => fakeClient(log, fail) });
    await expect(p.getBlockHeight()).resolves.toBe(1);
    expect(log.clients).toBe(2);
  });

  it('treats a connect that rejects with nothing as a dropped connection', async () => {
    const log = newLog();
    const fail: { next?: string } = { next: 'reject-empty' };
    const p = new SerialElectrumProvider('chipnet', { newClient: () => fakeClient(log, fail) });
    await expect(p.getBlockHeight()).resolves.toBe(1);
  });

  it('gives up on a request that never answers, then keeps working', async () => {
    const log = newLog();
    const fail: { next?: string } = { next: 'hang' };
    const p = new SerialElectrumProvider('chipnet', { newClient: () => fakeClient(log, fail), timeoutMs: 50 });
    // the first try hangs, the retry on a fresh client answers
    await expect(p.getBlockHeight()).resolves.toBe(1);
    expect(log.clients).toBe(2);
  });

  it('does not retry a broadcast or a request error that is not about the connection', async () => {
    const log = newLog();
    const p = new SerialElectrumProvider('chipnet', { newClient: () => fakeClient(log, { next: 'socket closed' }) });
    await expect(p.sendRawTransaction('00')).rejects.toThrow(/socket closed/);
    const bad = { next: 'the transaction was rejected by network rules' };
    const q = new SerialElectrumProvider('chipnet', { newClient: () => fakeClient(log, bad) });
    await expect(q.getBlockHeight()).rejects.toThrow(/network rules/);
    // the queue keeps working after a failure
    await expect(q.getBlockHeight()).resolves.toBe(1);
  });
});
