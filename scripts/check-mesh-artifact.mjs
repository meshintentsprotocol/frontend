// Fails if the frontend's StrategyCovenantV2 artifact differs from the server's
// or the contracts repo's copy (a mismatch means the UI would deploy pools the
// server cannot verify). Run from frontend/: npm run check:mesh-artifact
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const here = path.resolve('src/lib/mesh/artifacts/StrategyCovenantV2.json');
const others = [
  '../BCHMesh/meshserver/src/artifacts/StrategyCovenantV2.json',
  '../contracts-bch-swap/artifacts/StrategyCovenantV2.json',
].map(p => path.resolve(p));

const bytecode = f => JSON.parse(fs.readFileSync(f, 'utf8')).bytecode;
const hash = s => createHash('sha256').update(String(s)).digest('hex');

const mine = hash(bytecode(here));
let failed = false;
for (const f of others) {
  if (!fs.existsSync(f)) { console.warn(`skip (not found): ${f}`); continue; }
  const theirs = hash(bytecode(f));
  const ok = theirs === mine;
  failed ||= !ok;
  console.log(`${ok ? 'OK  ' : 'DIFF'} ${path.relative(process.cwd(), f)} ${theirs.slice(0, 16)}`);
}
console.log(`frontend artifact bytecode sha256 ${mine}`);
process.exit(failed ? 1 : 0);
