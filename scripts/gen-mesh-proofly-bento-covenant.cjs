const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../meshprotocol');

function writeFile(relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('Updated: ' + relPath);
}

// ==========================================
// 1. MeshTriRouteSection.tsx
// ==========================================
writeFile('src/components/landing/MeshTriRouteSection.tsx', `
import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { Route, ShieldCheck, ArrowRight } from 'lucide-react';

export function MeshTriRouteSection() {
  const { t, language } = useMesh();
  const [activeRoute, setActiveRoute] = useState<1 | 2 | 3>(1);

  const isZh = language === 'zh';

  return (
    <section id="tri-route" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-24 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-3">
          <Route className="w-3.5 h-3.5" />
          <span>{t.triRoute.kicker}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3 max-w-3xl mx-auto">
          {t.triRoute.title}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto mb-12">
          {t.triRoute.subtitle}
        </p>

        {/* 3 Routes Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Priority 1 */}
          <div
            onClick={() => setActiveRoute(1)}
            className={\`rounded-2xl border p-7 transition-all cursor-pointer flex flex-col justify-between shadow-xs \${
              activeRoute === 1
                ? 'border-neutral-900 dark:border-white bg-white dark:bg-[#121215]'
                : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] opacity-75 hover:opacity-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }\`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono font-bold text-sm flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-5">
                01
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase text-neutral-500 block mb-1">
                Priority 1 • Zero Slippage
              </span>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 mb-2">
                {t.triRoute.route1Title}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t.triRoute.route1Desc}
              </p>
            </div>
          </div>

          {/* Priority 2 */}
          <div
            onClick={() => setActiveRoute(2)}
            className={\`rounded-2xl border p-7 transition-all cursor-pointer flex flex-col justify-between shadow-xs \${
              activeRoute === 2
                ? 'border-neutral-900 dark:border-white bg-white dark:bg-[#121215]'
                : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] opacity-75 hover:opacity-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }\`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono font-bold text-sm flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-5">
                02
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase text-neutral-500 block mb-1">
                Priority 2 • Residual Sweep
              </span>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 mb-2">
                {t.triRoute.route2Title}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t.triRoute.route2Desc}
              </p>
            </div>
          </div>

          {/* Priority 3 */}
          <div
            onClick={() => setActiveRoute(3)}
            className={\`rounded-2xl border p-7 transition-all cursor-pointer flex flex-col justify-between shadow-xs \${
              activeRoute === 3
                ? 'border-neutral-900 dark:border-white bg-white dark:bg-[#121215]'
                : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] opacity-75 hover:opacity-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }\`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono font-bold text-sm flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-5">
                03
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase text-neutral-500 block mb-1">
                Priority 3 • Guaranteed Fill
              </span>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 mb-2">
                {t.triRoute.route3Title}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t.triRoute.route3Desc}
              </p>
            </div>
          </div>
        </div>

        {/* Guarantee Banner */}
        <div className="mt-8 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-center gap-3 text-xs font-mono text-neutral-600 dark:text-neutral-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t.triRoute.atomicGuarantee}</span>
        </div>
      </div>
    </section>
  );
}
`);

// ==========================================
// 2. MeshArchitectureBento.tsx
// ==========================================
writeFile('src/components/landing/MeshArchitectureBento.tsx', `
import React from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { ShieldCheck, Cpu, Radio, Coins, Zap, CheckCircle2, XCircle } from 'lucide-react';

export function MeshArchitectureBento() {
  const { t } = useMesh();

  return (
    <section id="architecture" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-24 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-3">
          <Cpu className="w-3.5 h-3.5" />
          <span>{t.architecture.kicker}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3 max-w-3xl mx-auto">
          {t.architecture.title}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto mb-12">
          {t.architecture.subtitle}
        </p>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          {/* Card 1: Zero Pool Contagion (Large 2 Cols) */}
          <div className="lg:col-span-2 p-7 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">
                {t.architecture.card1Title}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                {t.architecture.card1Desc}
              </p>
            </div>

            {/* Comparison */}
            <div className="grid sm:grid-cols-2 gap-3 mt-6 pt-5 border-t border-neutral-100 dark:border-neutral-800">
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-1.5 text-neutral-500 font-mono text-xs font-semibold">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Pooled AMM (Uniswap/Raydium)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-snug">
                  Shared smart contract state. Vulnerable to reentrancy, oracle drainage, and sandwich bot frontrunning.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-1.5 text-neutral-900 dark:text-white font-mono text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>BCHMesh Protocol</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-snug">
                  Every position is its own discrete UTXO. 0% pool drainage risk. Only creator key can release capital.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Nostr P2P Gossip */}
          <div className="p-7 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-4">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 mb-2">
                {t.architecture.card2Title}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm leading-relaxed mb-4">
                {t.architecture.card2Desc}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-500">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">Nostr NIP-90: </span>
              Off-chain encrypted intent broadcast with zero public mempool exposure.
            </div>
          </div>

          {/* Card 3: Native CashTokens BCMR */}
          <div className="p-7 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-4">
                <Coins className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 mb-2">
                {t.architecture.card3Title}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm leading-relaxed mb-4">
                {t.architecture.card3Desc}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-500">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">CHIP-2022-02: </span>
              L1 native token introspection with zero EVM wrapped overhead.
            </div>
          </div>

          {/* Card 4: Sub-Penny Gas Execution (Large 2 Cols) */}
          <div className="lg:col-span-2 p-7 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100 mb-2">
                {t.architecture.card4Title}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                {t.architecture.card4Desc}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                1 Sat/Byte Flat Rate
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                Direct UTXO Settlement
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                Predictable Scalability
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
`);

// ==========================================
// 3. MeshCovenantVisualizer.tsx
// ==========================================
writeFile('src/components/landing/MeshCovenantVisualizer.tsx', `
import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { FileCode, Shield, Terminal } from 'lucide-react';

export function MeshCovenantVisualizer() {
  const { t } = useMesh();
  const [activePath, setActivePath] = useState<'dock' | 'fill'>('dock');

  const dockCode = \`// Spend Path 1: Sovereign Exit (dock)
contract StrategyCovenantV3(pubkey ownerKey, bytes20 tokenCategory, int priceNum, int priceDenom) {
    function dock(sig ownerSig) {
        // Only the creator's key can trigger sovereign refund
        require(checkSig(ownerSig, ownerKey));
        // 100% of remaining BCH and CashTokens returned to owner UTXO
    }
}\`;

  const fillCode = \`// Spend Path 2: Atomic Intent Settlement & Perpetual Recycling (fill)
contract StrategyCovenantV3(pubkey ownerKey, bytes20 tokenCategory, int priceNum, int priceDenom) {
    function fill(int inputBch, int outputTokens) {
        // Enforce deterministic price curve on-chain:
        require(inputBch * priceDenom >= outputTokens * priceNum);
        // Direct proceeds into counter-mirror covenant in same tx loop:
        require(tx.outputs[0].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);
    }
}\`;

  return (
    <section id="covenant" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-24 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-3">
          <FileCode className="w-3.5 h-3.5" />
          <span>{t.covenant.kicker}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3 max-w-3xl mx-auto">
          {t.covenant.title}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto mb-10">
          {t.covenant.subtitle}
        </p>

        {/* Code Visualizer Box */}
        <div className="max-w-4xl mx-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs p-6 sm:p-8 text-left space-y-5">
          {/* Spend Path Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActivePath('dock')}
              className={\`px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 \${
                activePath === 'dock'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
              }\`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t.covenant.dockPath}</span>
            </button>
            <button
              onClick={() => setActivePath('fill')}
              className={\`px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 \${
                activePath === 'fill'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
              }\`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{t.covenant.fillPath}</span>
            </button>
          </div>

          {/* Description */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-mono">
            <span className="font-semibold text-neutral-900 dark:text-white uppercase block mb-1">
              {activePath === 'dock' ? 'Sovereign Guarantee' : 'Mathematical Constraint'}
            </span>
            {activePath === 'dock' ? t.covenant.dockDesc : t.covenant.fillDesc}
          </div>

          {/* CashScript Code Block */}
          <div className="rounded-xl bg-neutral-950 text-neutral-200 border border-neutral-800 p-4 sm:p-5 overflow-x-auto text-xs font-mono">
            <pre>
              <code>{activePath === 'dock' ? dockCode : fillCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
`);

// ==========================================
// 4. MeshCanvas.tsx (Subtle minimalist grid particles)
// ==========================================
writeFile('src/components/common/MeshCanvas.tsx', `
import React, { useEffect, useRef } from 'react';
import { useMesh } from '@/context/MeshContext';

export function MeshCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useMesh();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const count = 35;
    const nodes: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 1,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const isDark = theme === 'dark';

      const dotColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
      const lineColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';

      // Update and draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0) n.x = width;
        if (n.x > width) n.x = 0;
        if (n.y < 0) n.y = height;
        if (n.y > height) n.y = 0;

        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n.x - n2.x;
          const dy = n.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-60"
    />
  );
}
`);

console.log('Finished updating bento, tri-route, covenant, and canvas.');
