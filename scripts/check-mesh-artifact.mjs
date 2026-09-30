// Fails if the frontend's covenant artifacts differ from the server's or the
// contracts repo's copies (a mismatch means the UI would deploy pools the
// server cannot verify). Run from frontend/: npm run check:mesh-artifact
// MESH_ROOT overrides where the sibling repos are (default: the parent directory).
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.env.MESH_ROOT ?? '..');
const bytecode = f => JSON.parse(fs.readFileSync(f, 'utf8')).bytecode;
const hash = s => createHash('sha256').update(String(s)).digest('hex');

let failed = false;
for (const name of ['StrategyCovenantV2', 'MeshPoolV3']) {
  const mine = hash(bytecode(path.resolve(`src/lib/mesh/artifacts/${name}.json`)));
  for (const f of [`BCHMesh/meshserver/src/artifacts/${name}.json`, `contracts-bch-swap/artifacts/${name}.json`].map(p => path.join(root, p))) {
    if (!fs.existsSync(f)) { console.warn(`skip (not found): ${f}`); continue; }
    const ok = hash(bytecode(f)) === mine;
    failed ||= !ok;
    console.log(`${ok ? 'OK  ' : 'DIFF'} ${name} ${path.relative(process.cwd(), f)}`);
  }
  console.log(`${name} frontend bytecode sha256 ${mine}`);
}
process.exit(failed ? 1 : 0);
