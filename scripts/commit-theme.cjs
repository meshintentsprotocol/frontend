const { execSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

try {
  execSync('git add meshprotocol', { cwd: repoRoot, stdio: 'inherit' });
  execSync('git commit -m "feat(meshprotocol): adopt minimalist wireframe grid theme with crosshairs and brutalist footer"', { cwd: repoRoot, stdio: 'inherit' });
  console.log('Successfully committed meshprotocol.');
} catch (err) {
  console.error('Git error in root:', err.message);
}

try {
  execSync('git add scripts/gen-mesh-*.cjs scripts/commit-theme.cjs', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  execSync('git commit -m "chore(frontend): add scripts to generate meshprotocol wireframe theme"', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  console.log('Successfully committed frontend scripts.');
} catch (err) {
  console.error('Git error in frontend:', err.message);
}
