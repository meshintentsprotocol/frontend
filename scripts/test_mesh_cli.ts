import {
  derivePkh,
  buildStrategyContract,
  getElectrumProvider,
  toHex,
  toBytes,
  contractLockingHex
} from '../src/lib/meshContracts';
import { binToHex } from '@bitauth/libauth';

async function testMeshCli() {
  console.log('🧪 Starting BCHMesh CLI Contract & Variable Integration Test...\n');

  // Test pubkey (compressed secp256k1 pubkey on Chipnet)
  const testPkHex = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  const pkh = derivePkh(testPkHex);
  const pkhHex = binToHex(pkh);
  console.log(`✅ Derived PKH: ${pkhHex} (length: ${pkh.length} bytes / ${pkhHex.length} hex chars)`);

  const provider = getElectrumProvider('chipnet');

  // ── 1. Test Fixed Rate StrategyCovenant ──────────────────────────────────────
  console.log('\n--- Testing Fixed Rate StrategyCovenant ---');
  const straightContract = buildStrategyContract(
    {
      strategyType: 'straight',
      ownerPkHex: testPkHex,
      tokenCategoryIn: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
      tokenCategoryOut: '0x',
      priceNum: 300n,
      priceDen: 1n,
      feeBps: 30n,
      reserveSats: 100000n,
      network: 'chipnet',
    },
    provider
  );
  console.log(`✅ StrategyCovenant instantiated successfully!`);
  console.log(`   Address: ${straightContract.address}`);
  console.log(`   Locking bytecode length: ${straightContract.bytecode.length / 2} bytes`);
  console.log(`   Unlock functions available: ${Object.keys(straightContract.unlock).join(', ')}`);

  // ── 2. Test OracleStrategyCovenant ──────────────────────────────────────────
  console.log('\n--- Testing OracleStrategyCovenant ---');
  const oracleContract = buildStrategyContract(
    {
      strategyType: 'oracle',
      ownerPkHex: testPkHex,
      oraclePkHex: '02' + '00'.repeat(32),
      pairId: 1n,
      spreadBps: 50n,
      feeBps: 30n,
      tokenCategoryIn: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
      tokenCategoryOut: '0x',
      priceNum: 300n,
      priceDen: 1n,
      reserveSats: 100000n,
      network: 'chipnet',
    },
    provider
  );
  console.log(`✅ OracleStrategyCovenant instantiated successfully!`);
  console.log(`   Address: ${oracleContract.address}`);
  console.log(`   Unlock functions available: ${Object.keys(oracleContract.unlock).join(', ')}`);

  // ── 3. Test DutchDecayStrategyCovenant ──────────────────────────────────────
  console.log('\n--- Testing DutchDecayStrategyCovenant ---');
  const dutchContract = buildStrategyContract(
    {
      strategyType: 'dutch',
      ownerPkHex: testPkHex,
      tokenCategoryIn: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
      tokenCategoryOut: '0x',
      priceNum: 350n,
      floorPriceNum: 250n,
      priceDen: 1n,
      startTime: Math.floor(Date.now() / 1000),
      duration: 3600,
      feeBps: 30n,
      reserveSats: 100000n,
      network: 'chipnet',
    },
    provider
  );
  console.log(`✅ DutchDecayStrategyCovenant instantiated successfully!`);
  console.log(`   Address: ${dutchContract.address}`);
  console.log(`   Unlock functions available: ${Object.keys(dutchContract.unlock).join(', ')}`);

  console.log('\n🎉 ALL MESH CONTRACT TYPES & VARIABLE BINDINGS VALIDATED SUCCESSFULLY!');
}

testMeshCli().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
