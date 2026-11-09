/**
 * Reachability probes for the services and outside dependencies the frontend uses.
 *
 * Plain ES module, no imports: the admin Services page loads it through Vite and the
 * stack script (devrel-agent-context/deployscritps/stack) loads it in Node, so both
 * report the same thing. Types: ./probe.d.ts. Registry: ./endpoints.json.
 */

/** Read `a.b.c` out of a JSON value. */
export function getPath(obj, path) {
  if (!path) return obj;
  let cur = obj;
  for (const k of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i;
export const isLocalUrl = url => LOCAL.test(url || '');

/**
 * Where each endpoint points, given the frontend's env (import.meta.env, or a parsed
 * .env file). Mirrors the `A || B || default` chains in src/lib/config.ts.
 */
export function resolveEndpoints(registry, env) {
  return registry.endpoints.map(ep => {
    if (ep.fixed) return { ...ep, url: ep.fixed, source: 'built in' };
    const own = (env[ep.var] ?? '').trim();
    if (own) return { ...ep, url: ep.template ? ep.template.replace('{value}', own) : own, source: ep.var };
    for (const v of ep.fallbackVars ?? []) {
      const val = (env[v] ?? '').trim();
      if (val) return { ...ep, url: val, source: `${v} (fallback)` };
    }
    if (ep.fallback) return { ...ep, url: ep.fallback, source: 'code default' };
    return { ...ep, url: '', source: 'not set' };
  });
}

/** The URL a probe actually requests. */
export function probeUrl(ep) {
  if (!ep.url) return '';
  if (ep.probe === 'evm-rpc' || ep.probe === 'sol-rpc') return ep.url;
  if (!ep.path) return ep.url;
  try {
    const u = new URL(ep.url);
    const base = ep.fromOrigin ? u.origin : u.origin + u.pathname.replace(/\/+$/, '');
    return base + ep.path;
  } catch {
    return ep.url.replace(/\/+$/, '') + ep.path;
  }
}

function checkValue(check, body) {
  if (!check) return { ok: true };
  const v = getPath(body, check.path);
  const shown = v === undefined || v === null ? '—'
    : Array.isArray(v) ? v.join(', ')
    : typeof v === 'object' ? 'enabled' : String(v);
  let ok;
  if ('equals' in check) ok = v === check.equals;
  else if ('includes' in check) ok = Array.isArray(v) ? v.includes(check.includes) : String(v ?? '').includes(check.includes);
  else if (check.present) ok = v !== undefined && v !== null && v !== false && v !== '';
  else ok = true;
  const want = 'equals' in check ? check.equals : 'includes' in check ? check.includes : 'present';
  return { ok, shown, want };
}

async function timed(fetchImpl, url, init, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    return { res, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

/** One request: the parsed answer, an opaque answer (browser, no CORS), or a failure. Never throws. */
async function call(fetchImpl, url, init, timeoutMs, allowOpaque) {
  try {
    const { res, ms } = await timed(fetchImpl, url, init, timeoutMs);
    let body;
    try { body = await res.json(); } catch { body = undefined; }
    return { ok: res.ok, status: res.status, body, ms };
  } catch (err) {
    const aborted = !!err && (err.name === 'AbortError' || /abort/i.test(String(err.message)));
    // A browser blocks reading a cross-origin answer without CORS headers. Ask again
    // opaquely: if that resolves, something is listening, we just can't read it.
    if (!aborted && allowOpaque) {
      try {
        const o = await timed(fetchImpl, url, { method: 'GET', mode: 'no-cors' }, timeoutMs);
        return { opaque: true, ms: o.ms };
      } catch { /* fall through */ }
    }
    return { failed: true, aborted };
  }
}

/** The same request within one round is made once (opts.cache is set by probeAll). */
function shared(opts, key, make) {
  if (!opts.cache) return make();
  if (!opts.cache.has(key)) opts.cache.set(key, make());
  return opts.cache.get(key);
}

const RPC_BODY = {
  'evm-rpc': { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] },
  'sol-rpc': { jsonrpc: '2.0', id: 1, method: 'getHealth' },
};

/**
 * Probe one endpoint. Status:
 *   live      answered, and reports what it should (network, mainnet enabled, ready)
 *   mismatch  answered, but reports something else (e.g. a chipnet server behind a mainnet setting)
 *   degraded  answered, but its readiness check failed (scanner or solver stopped)
 *   reachable answered, but the body could not be read (browser CORS) or is not JSON
 *   down      no answer, an error status, or timed out
 *   unset     nothing configured (fine when the endpoint is optional)
 */
export async function probeEndpoint(ep, opts = {}) {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  // Some health checks read chain balances (Solana ZK server: ~8 s); they carry their own timeout.
  const timeoutMs = Math.max(opts.timeoutMs ?? 6000, ep.timeoutMs ?? 0);
  const url = probeUrl(ep);
  const base = { id: ep.id, url: ep.url, probeUrl: url, source: ep.source, checkedAt: Date.now() };
  if (!url) return { ...base, status: 'unset', detail: ep.unsetNote ?? 'Not configured' };

  const rpc = RPC_BODY[ep.probe];
  // A browser may answer from its HTTP cache; a probe must reach the server.
  const fresh = opts.browser ? { cache: 'no-store' } : {};
  const init = rpc
    ? { ...fresh, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rpc) }
    : { ...fresh, method: 'GET', headers: { accept: 'application/json' } };

  const r = await shared(opts, `${init.method}|${url}`, () => call(fetchImpl, url, init, timeoutMs, !!opts.browser && !rpc));
  if (r.opaque) {
    return { ...base, status: 'reachable', latencyMs: r.ms, detail: 'Something answers, but the browser cannot read it (no CORS headers): it may be an error page. The terminal report shows the status.' };
  }
  if (r.failed) return { ...base, status: 'down', error: r.aborted ? `No answer within ${Math.round(timeoutMs / 1000)} s` : 'Connection failed' };

  const res = { status: r.status, ok: r.ok };
  const body = r.body;
  const out = { ...base, httpStatus: r.status, latencyMs: r.ms };

  if (ep.probe === 'http') {
    // An outside API: any answer short of a server error means it is up (auth errors included).
    return res.status < 500
      ? { ...out, status: 'live', detail: `HTTP ${res.status}` }
      : { ...out, status: 'down', error: `HTTP ${res.status}` };
  }
  if (rpc) {
    if (!res.ok || !body || body.error) return { ...out, status: 'down', error: body?.error?.message ?? `HTTP ${res.status}` };
    if (ep.probe === 'evm-rpc') {
      const id = typeof body.result === 'string' ? parseInt(body.result, 16) : NaN;
      return { ...out, status: 'live', reported: Number.isFinite(id) ? `chain ${id}` : 'answers' };
    }
    return { ...out, status: 'live', reported: String(body.result ?? 'ok') };
  }

  // health
  if (!res.ok) return { ...out, status: 'down', error: `HTTP ${res.status}` };
  if (body === undefined) return { ...out, status: 'reachable', detail: 'Answers, but not with JSON' };
  const c = checkValue(ep.check, body);
  const detailNote = ep.detailPath ? getPath(body, ep.detailPath) : undefined;
  if (!c.ok) {
    return {
      ...out, status: 'mismatch', reported: c.shown,
      detail: typeof detailNote === 'string' ? detailNote : `Expected ${c.want}, server reports ${c.shown}`,
    };
  }
  const result = { ...out, status: 'live', reported: c.shown };
  if (ep.readyPath) {
    const readyUrl = probeUrl({ ...ep, path: ep.readyPath });
    const ready = await shared(opts, `GET|${readyUrl}`, () => call(fetchImpl, readyUrl, { ...fresh, method: 'GET' }, timeoutMs, false));
    // readiness is extra detail: only a clear 503 changes the verdict
    if (ready.status === 503) {
      const reasons = Array.isArray(ready.body?.reasons) ? ready.body.reasons : [];
      return { ...result, status: 'degraded', detail: `Not ready: ${reasons.join('; ') || 'scanner or solver stopped'}` };
    }
  }
  return result;
}

/**
 * Probe every endpoint. Each URL is requested once per round, and every endpoint
 * on it reads that one answer: several settings point at the same server, and a
 * slow health check asked twice at once can time out both times.
 */
export async function probeAll(registry, env, opts = {}) {
  const eps = resolveEndpoints(registry, env);
  const round = { ...opts, cache: new Map() };
  const results = await Promise.all(eps.map(ep => probeEndpoint(ep, round)));
  const pageIsLocal = opts.pageOrigin ? isLocalUrl(opts.pageOrigin) : true;
  return eps.map((ep, i) => {
    const r = results[i];
    // A deployed app pointing at localhost works for nobody but its developer.
    const localWarning = !pageIsLocal && isLocalUrl(ep.url) ? 'Points at localhost from a deployed page' : undefined;
    return { endpoint: ep, result: { ...r, warning: localWarning } };
  });
}

/** Counts per status; `problems` are required endpoints that are not live. */
export function summarize(rows) {
  const s = { total: rows.length, live: 0, degraded: 0, mismatch: 0, reachable: 0, down: 0, unset: 0, problems: 0 };
  for (const { endpoint, result } of rows) {
    s[result.status] = (s[result.status] ?? 0) + 1;
    const fine = result.status === 'live' || (result.status === 'unset' && endpoint.optional);
    if (!fine || result.warning) s.problems += 1;
  }
  return s;
}
