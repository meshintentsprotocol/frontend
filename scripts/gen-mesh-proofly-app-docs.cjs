const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../meshprotocol');

function writeFile(relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('Updated: ' + relPath);
}

// 1. MeshAppComingSoon.tsx
const appContent = `import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { Sparkles, ArrowRight, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function MeshAppComingSoon() {
  const { language, setActiveTab } = useMesh();
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [activeAppTab, setActiveAppTab] = useState<'positions' | 'deploy' | 'solvers'>('positions');

  const isZh = language === 'zh';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setSubmitted(true);
  };

  return (
    <section className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative min-h-[80vh]">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-12 sm:py-16 px-6 sm:px-10 lg:px-12">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isZh ? '流动性做市终端' : 'Mesh Protocol Terminal'}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {isZh ? '自主做市与意图撮合中心' : 'Autonomous Market Making Terminal'}
            </h1>
          </div>

          <button
            onClick={() => { setActiveTab('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer shadow-xs"
          >
            {isZh ? '返回官网首页' : '← Back to Overview'}
          </button>
        </div>

        {/* Preview Frame */}
        <div className="my-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs relative overflow-hidden p-6 sm:p-8">
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              {[
                { id: 'positions', label: isZh ? '活跃契约仓位' : 'Active LP Positions (3)' },
                { id: 'deploy', label: isZh ? '部署新策略' : 'Deploy New Vault' },
                { id: 'solvers', label: isZh ? 'Nostr 意图流' : 'Nostr Intent Stream' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAppTab(tab.id as any)}
                  className={\`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer \${
                    activeAppTab === tab.id
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }\`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Mocked Strategy Pools Table */}
            <div className="space-y-3">
              {[
                {
                  pair: 'BCH / FLEX',
                  utxo: 'tx:78a1...4b02:0',
                  bchLocked: '25.0 BCH',
                  tokensLocked: '35,500 FLEX',
                  apr: '34.8%',
                  feesEarned: '$124.50',
                },
                {
                  pair: 'BCH / LAW',
                  utxo: 'tx:91c2...1e88:1',
                  bchLocked: '10.0 BCH',
                  tokensLocked: '8,500 LAW',
                  apr: '28.2%',
                  feesEarned: '$62.10',
                },
                {
                  pair: 'BCH / USDC',
                  utxo: 'tx:43d9...901a:0',
                  bchLocked: '40.0 BCH',
                  tokensLocked: '13,140 USDC',
                  apr: '19.4%',
                  feesEarned: '$210.80',
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-neutral-800 dark:text-neutral-200">
                      M
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{row.pair}</div>
                      <div className="text-[10px] text-neutral-500">{row.utxo}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase">{isZh ? 'BCH 质押' : 'BCH Locked'}</div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{row.bchLocked}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase">{isZh ? '代币数量' : 'Tokens'}</div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{row.tokensLocked}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase">{isZh ? '预估年化' : 'Est. APY'}</div>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">{row.apr}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase">{isZh ? '已赚取费用' : 'Fees 24h'}</div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{row.feesEarned}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Frosted Floating Overlay */}
          <div className="absolute inset-0 bg-[#f9f9fb]/80 dark:bg-[#09090b]/80 backdrop-blur-[5px] flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="max-w-md space-y-4 p-8 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121215] shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center mx-auto text-neutral-800 dark:text-neutral-200">
                <Sparkles className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  {isZh ? '独立应用终端打磨中' : 'Terminal App Finalizing'}
                </h3>
                <p className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm leading-relaxed">
                  {isZh
                    ? 'Mesh 协议智能契约已完全审计并在主网运行！您现在就可以通过 Trading dApp 体验原生做市与意图撮合。'
                    : 'The underlying CashScript covenants and Nostr solvers are live today. Launch via the trading dApp now, or get notified upon launch.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <a
                  href="https://trade.bchintents.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto h-10 px-5 rounded-xl font-medium text-xs bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center gap-1.5 shadow-xs transition-all"
                >
                  <span>{isZh ? '前往在线交易 dApp (立即体验)' : 'Launch Web dApp (Live Now)'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={() => { setActiveTab('docs'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="w-full sm:w-auto h-10 px-4 rounded-xl font-medium text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 flex items-center justify-center transition-all cursor-pointer"
                >
                  <span>{isZh ? '查阅技术文档' : 'Read Docs'}</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="pt-2 flex gap-2">
                <input
                  type="email"
                  placeholder={isZh ? '输入邮箱订阅通知...' : 'Enter email for updates...'}
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs cursor-pointer shrink-0"
                >
                  {submitted ? <CheckCircle2 className="w-4 h-4" /> : (isZh ? '订阅' : 'Notify Me')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}`;

writeFile('src/components/app/MeshAppComingSoon.tsx', appContent);

// 2. MeshDocs.tsx
const docsContent = `import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { BookOpen, FileCode, Cpu, Layers } from 'lucide-react';

export function MeshDocs() {
  const { language, setActiveTab } = useMesh();
  const [activeDocSection, setActiveDocSection] = useState<'overview' | 'covenants' | 'recycling' | 'sdk'>('overview');

  const isZh = language === 'zh';

  const docNav = [
    { id: 'overview', title: isZh ? '1. 协议概览' : '1. Overview & Whitepaper', icon: BookOpen },
    { id: 'covenants', title: isZh ? '2. CashScript 契约规范' : '2. CashScript Covenants', icon: FileCode },
    { id: 'recycling', title: isZh ? '3. 永续自循环机制' : '3. Perpetual Recycling Loop', icon: Layers },
    { id: 'sdk', title: isZh ? '4. SDK 与集成指南' : '4. Developer SDK', icon: Cpu },
  ];

  return (
    <section className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative min-h-[85vh]">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-12 sm:py-16 px-6 sm:px-10 lg:px-12">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Top Breadcrumb & Return */}
        <div className="flex items-center justify-between pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
            <span>Mesh Protocol</span>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100 font-semibold">{isZh ? '开发文档' : 'Documentation'}</span>
          </div>

          <button
            onClick={() => { setActiveTab('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="px-3.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer shadow-xs"
          >
            {isZh ? '返回首页' : '← Back'}
          </button>
        </div>

        {/* 2-Column Documentation Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-8">
          {/* Left Doc Sidebar */}
          <div className="md:col-span-4 lg:col-span-3 space-y-1">
            {docNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeDocSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveDocSection(item.id as any)}
                  className={\`w-full p-3 rounded-xl text-left text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer \${
                    isActive
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }\`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </button>
              );
            })}
          </div>

          {/* Right Main Article */}
          <div className="md:col-span-8 lg:col-span-9 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] p-6 sm:p-10 shadow-xs space-y-6 text-left">
            {activeDocSection === 'overview' && (
              <article className="space-y-4">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {isZh ? 'Mesh Protocol 核心技术设计' : 'Mesh Protocol Architecture & Ethos'}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {isZh
                    ? 'Mesh Protocol 是首个原生构建于比特币现金（Bitcoin Cash）之上的自循环流动性网格。与 EVM 生态中将所有 LP 资金汇聚在一个庞大智能合约池（Pooled AMM）不同，Mesh Protocol 利用 UTXO 本身的离散性，将每个做市仓位打包为独立的 CashScript 契约 UTXO。'
                    : 'Mesh Protocol is the first self-recycling liquidity mesh built natively on Bitcoin Cash. Unlike pooled AMMs on EVM chains which aggregate all liquidity into a single global state, Mesh Protocol treats each LP position as an isolated, deterministic CashScript covenant UTXO.'}
                </p>
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                  <div className="font-semibold text-neutral-900 dark:text-white">Key Invariants:</div>
                  <div>• 0% Reentrancy & Shared State Contagion</div>
                  <div>• Sub-Penny Introspection Fees (1 sat/byte)</div>
                  <div>• Atomic Bid/Ask Mirroring via TX Introspection</div>
                </div>
              </article>
            )}

            {activeDocSection === 'covenants' && (
              <article className="space-y-4">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {isZh ? 'MeshPoolV3 契约规范' : 'MeshPoolV3 CashScript Specification'}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {isZh
                    ? '契约提供两个确定性花费路径：dock（主权取回）和 fill（原子成交与镜像生成）。'
                    : 'The contract exposes two strictly bounded spend functions: dock (sovereign withdrawal) and fill (atomic match and mirror instantiation).'}
                </p>
                <div className="p-4 rounded-xl bg-neutral-950 text-neutral-200 text-xs font-mono overflow-x-auto border border-neutral-800 whitespace-pre">
contract MeshPoolV3(pubkey ownerKey, bytes20 tokenCategory, int priceNum, int priceDenom) &#123;
    function dock(sig ownerSig) &#123;
        require(checkSig(ownerSig, ownerKey));
    &#125;
    function fill(int inputBch, int outputTokens) &#123;
        require(inputBch * priceDenom &gt;= outputTokens * priceNum);
        require(tx.outputs[0].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);
    &#125;
&#125;
                </div>
              </article>
            )}

            {activeDocSection === 'recycling' && (
              <article className="space-y-4">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {isZh ? '永续自循环机制 (Perpetual Recycling)' : 'Perpetual Recycling Mathematical Invariant'}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {isZh
                    ? '当买单成交时，收益不会流向中心化托管地址，而是强制将收到的 CashTokens 重建为反向镜像卖单，形成闭环回路。'
                    : 'Proceeds of a fill are mathematically bound to instantiate a counter-mirror ask covenant in the exact same transaction, keeping funds circulating 24/7 without off-chain custody.'}
                </p>
              </article>
            )}

            {activeDocSection === 'sdk' && (
              <article className="space-y-4">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {isZh ? 'TypeScript SDK 快速起步' : 'TypeScript SDK Quickstart'}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {isZh
                    ? '使用官方 SDK 快速实例化契约、监听链上 UTXO 并提交撮合交易：'
                    : 'Initialize covenants, track active pool UTXOs, and broadcast fills via the official TypeScript SDK:'}
                </p>
                <div className="p-4 rounded-xl bg-neutral-950 text-neutral-200 text-xs font-mono overflow-x-auto border border-neutral-800 whitespace-pre">
import &#123; MeshPoolClient &#125; from '@bchmesh/sdk';

const client = new MeshPoolClient(&#123; network: 'chipnet' &#125;);
const pool = await client.createPool(&#123;
  pair: 'BCH/USDC',
  initialBch: 10.0,
  spreadBps: 220,
&#125;);
console.log('Deployed covenant at:', pool.address);
                </div>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}`;

writeFile('src/components/docs/MeshDocs.tsx', docsContent);
console.log('Done writing App and Docs.');
