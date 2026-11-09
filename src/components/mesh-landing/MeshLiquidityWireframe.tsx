/**
 * MeshLiquidityWireframe - Reusable 3D Perspective Wireframe Mesh Background
 * 
 * Features:
 * - 3D isometric perspective wireframe grid in electric blue & cyan (symbolizing discrete liquidity depth)
 * - Animated liquidity pulses flowing along gridlines between discrete price bins
 * - Pulsing UTXO covenant state nodes that illuminate periodically
 * - Dynamic interactive cursor gravity and lighting
 * - Configurable, highly performant 60fps canvas with DPI scaling & auto-pause off-screen
 * - Optional floating UTXO covenant status cards
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Zap, Shield, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MeshLiquidityWireframeProps {
  className?: string;
  interactive?: boolean;
  showFloatingBadges?: boolean;
  theme?: 'blue-liquidity' | 'cyan-emerald' | 'deep-azure';
  particleCount?: number;
  gridDensity?: number; // 12-24
}

interface Particle {
  lineIndex: number;
  isXLine: boolean;
  pos: number; // 0 to 1
  speed: number;
  size: number;
  color: string;
}

interface UtxoNode {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  pulsePhase: number;
  pulseSpeed: number;
  label: string;
  type: 'bin' | 'proceeds' | 'nft' | 'covenant';
  amount: string;
}

export function MeshLiquidityWireframe({
  className,
  interactive = true,
  showFloatingBadges = true,
  theme = 'cyan-emerald',
  particleCount = 28,
  gridDensity = 16,
}: MeshLiquidityWireframeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false });

  // Floating UTXO badges data
  const [activeUtxoIndex, setActiveUtxoIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUtxoIndex((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let isVisible = true;

    // Handle high DPI
    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Visibility observer to pause when scrolled out of view
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      mouseRef.current.targetX = e.clientX - rect.left;
      mouseRef.current.targetY = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.targetX = -1000;
      mouseRef.current.targetY = -1000;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Setup Grid Dimensions
    const cols = gridDensity;
    const rows = 14;

    // Initialize Liquidity particles
    const particles: Particle[] = [];
    const colors =
      theme === 'cyan-emerald'
        ? ['#38bdf8', '#0ea5e9', '#10b981', '#34d399', '#67e8f9']
        : ['#3b82f6', '#60a5fa', '#93c5fd', '#38bdf8', '#2563eb'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        lineIndex: Math.floor(Math.random() * (Math.random() > 0.5 ? cols : rows)),
        isXLine: Math.random() > 0.4,
        pos: Math.random(),
        speed: 0.0015 + Math.random() * 0.0035,
        size: 1.5 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // UTXO Nodes located at specific grid intersections
    const utxoNodes: UtxoNode[] = [
      { x: 0, y: 0, gridX: 3, gridY: 4, pulsePhase: 0, pulseSpeed: 0.03, label: 'UTXO-BIN-392', type: 'bin', amount: '24.5 BCH' },
      { x: 0, y: 0, gridX: 7, gridY: 6, pulsePhase: 2.1, pulseSpeed: 0.025, label: 'PROCEEDS-COV', type: 'proceeds', amount: '+0.88 BCH' },
      { x: 0, y: 0, gridX: 11, gridY: 5, pulsePhase: 4.2, pulseSpeed: 0.035, label: 'NFT-VAULT-82B', type: 'nft', amount: '100% Sovereign' },
      { x: 0, y: 0, gridX: 5, gridY: 9, pulsePhase: 1.4, pulseSpeed: 0.028, label: 'V4-TICK-480', type: 'covenant', amount: '0.00% Slip' },
      { x: 0, y: 0, gridX: 9, gridY: 10, pulsePhase: 3.5, pulseSpeed: 0.032, label: 'CYCLIC-RECYCLE', type: 'proceeds', amount: '1-Tx Closed' },
    ];

    let time = 0;

    // 3D Perspective Projection Function
    // Maps a 3D world coordinate (x: -1..1, y: -1..1, z: 0..1) to 2D screen coordinate
    const project = (gx: number, gy: number, gz: number, timeOffset: number) => {
      // Perspective vanishing point setup
      const horizonY = height * 0.22; // Horizon placed near upper-third
      const depth = gz + 0.35; // Avoid divide by zero

      // Isometric wave ripple
      const wave = Math.sin(gx * 3.5 + timeOffset * 1.2) * Math.cos(gy * 2.5 + timeOffset * 0.9) * 22;

      // Mouse interactive warp
      let mouseWarpX = 0;
      let mouseWarpY = 0;
      if (mouseRef.current.active) {
        const rawScreenX = (width * 0.5) + (gx * width * 0.58) / depth;
        const rawScreenY = horizonY + (gy * height * 0.78) / depth;
        const dist = Math.hypot(rawScreenX - mouseRef.current.x, rawScreenY - mouseRef.current.y);
        const maxDist = 260;
        if (dist < maxDist) {
          const force = (1 - dist / maxDist) * 36;
          mouseWarpY = -force;
          mouseWarpX = ((rawScreenX - mouseRef.current.x) / maxDist) * 18;
        }
      }

      const screenX = width * 0.5 + (gx * width * 0.58 + mouseWarpX) / depth;
      const screenY = horizonY + (gy * height * 0.78 + wave + mouseWarpY) / depth;

      return { x: screenX, y: screenY, depth };
    };

    // Render Loop
    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 0.016;

      // Smooth mouse lerping
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      // Pre-compute 2D screen coordinates for the 3D grid points
      const gridPoints: { x: number; y: number; depth: number }[][] = [];

      for (let r = 0; r <= rows; r++) {
        const rowArr = [];
        const gy = (r / rows) * 1.35; // y extends downwards from near horizon
        const gz = (r / rows) * 1.5; // z extends depth into distance

        for (let c = 0; c <= cols; c++) {
          const gx = ((c / cols) - 0.5) * 2.4; // x spans -1.2 to 1.2
          const pt = project(gx, gy, gz, time);
          rowArr.push(pt);
        }
        gridPoints.push(rowArr);
      }

      // 1. Draw Mesh Grid Lines (Horizontal / Depth Ticks)
      for (let r = 0; r <= rows; r++) {
        const rowPoints = gridPoints[r];
        if (!rowPoints || rowPoints.length === 0) continue;

        // Depth fading: further rows are dimmer
        const rowDepthFactor = r / rows;
        const alpha = Math.min(0.28, Math.max(0.04, rowDepthFactor * 0.32));

        ctx.beginPath();
        ctx.moveTo(rowPoints[0].x, rowPoints[0].y);
        for (let c = 1; c <= cols; c++) {
          ctx.lineTo(rowPoints[c].x, rowPoints[c].y);
        }

        // Electric Blue / Cyan gradient line
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(0.2, `rgba(56, 189, 248, ${alpha * 0.6})`);
        grad.addColorStop(0.5, `rgba(14, 165, 233, ${alpha * 1.2})`);
        grad.addColorStop(0.8, `rgba(16, 185, 129, ${alpha * 0.8})`);
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 2. Draw Longitudinal Perspective Rays (Vertical liquidity bins)
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(gridPoints[0][c].x, gridPoints[0][c].y);
        for (let r = 1; r <= rows; r++) {
          ctx.lineTo(gridPoints[r][c].x, gridPoints[r][c].y);
        }

        const centerRatio = 1 - Math.abs((c / cols) - 0.5) * 1.8;
        const rayAlpha = Math.max(0.03, centerRatio * 0.24);

        const vGrad = ctx.createLinearGradient(
          gridPoints[0][c].x,
          gridPoints[0][c].y,
          gridPoints[rows][c].x,
          gridPoints[rows][c].y
        );
        vGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        vGrad.addColorStop(0.3, `rgba(56, 189, 248, ${rayAlpha * 0.5})`);
        vGrad.addColorStop(1, `rgba(16, 185, 129, ${rayAlpha * 0.9})`);

        ctx.strokeStyle = vGrad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Draw Flowing Liquidity Packets (Trading Swaps moving along Grid)
      particles.forEach((p) => {
        p.pos += p.speed;
        if (p.pos > 1) {
          p.pos = 0;
          p.lineIndex = Math.floor(Math.random() * (p.isXLine ? rows : cols));
        }

        let sx = 0;
        let sy = 0;

        if (p.isXLine) {
          const r = Math.min(rows, Math.max(0, p.lineIndex));
          const cFloat = p.pos * cols;
          const c1 = Math.floor(cFloat);
          const c2 = Math.min(cols, c1 + 1);
          const frac = cFloat - c1;
          const pt1 = gridPoints[r][c1];
          const pt2 = gridPoints[r][c2];
          if (pt1 && pt2) {
            sx = pt1.x + (pt2.x - pt1.x) * frac;
            sy = pt1.y + (pt2.y - pt1.y) * frac;
          }
        } else {
          const c = Math.min(cols, Math.max(0, p.lineIndex));
          const rFloat = p.pos * rows;
          const r1 = Math.floor(rFloat);
          const r2 = Math.min(rows, r1 + 1);
          const frac = rFloat - r1;
          const pt1 = gridPoints[r1][c];
          const pt2 = gridPoints[r2][c];
          if (pt1 && pt2) {
            sx = pt1.x + (pt2.x - pt1.x) * frac;
            sy = pt1.y + (pt2.y - pt1.y) * frac;
          }
        }

        if (sx > 0 && sy > 0 && sx < width && sy < height) {
          // Draw particle with glow head
          ctx.beginPath();
          ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        }
      });

      // 4. Draw UTXO Covenant State Nodes & Lighting Rings
      utxoNodes.forEach((node) => {
        node.pulsePhase += node.pulseSpeed;
        const pt = gridPoints[node.gridY]?.[node.gridX];
        if (!pt) return;

        node.x = pt.x;
        node.y = pt.y;

        const pulse = (Math.sin(node.pulsePhase) + 1) * 0.5; // 0..1
        const ringRadius = 8 + pulse * 24;
        const ringAlpha = (1 - pulse) * 0.55;

        // Outer Shockwave Ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle =
          node.type === 'proceeds'
            ? `rgba(16, 185, 129, ${ringAlpha})`
            : node.type === 'nft'
            ? `rgba(168, 85, 247, ${ringAlpha})`
            : `rgba(56, 189, 248, ${ringAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner Solid Core Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle =
          node.type === 'proceeds' ? '#34d399' : node.type === 'nft' ? '#c084fc' : '#38bdf8';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Subtle Node Label floating above
        ctx.font = '600 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fillText(node.label, node.x, node.y - 12);
      });

      // 5. Interactive Cursor Liquidity Aura
      if (mouseRef.current.active && mouseRef.current.x > 0) {
        const mouseGlow = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          180
        );
        mouseGlow.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
        mouseGlow.addColorStop(0.5, 'rgba(16, 185, 129, 0.06)');
        mouseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = mouseGlow;
        ctx.beginPath();
        ctx.arc(mouseRef.current.x, mouseRef.current.y, 180, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      observer.disconnect();
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [interactive, theme, particleCount, gridDensity]);

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0 pointer-events-auto overflow-hidden select-none', className)}
    >
      {/* High-speed Hardware Accelerated Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Atmospheric Horizon Glow & Linear Grid Lighting */}
      <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[90vw] max-w-5xl h-[280px] bg-gradient-to-r from-blue-600/10 via-cyan-400/15 to-emerald-500/12 rounded-full blur-[140px] pointer-events-none" />

      {/* Center Vignette so Hero Title and Content has 100% Crisp Legibility */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 48%, rgba(5,5,5,0.72) 0%, rgba(5,5,5,0.5) 45%, rgba(5,5,5,0.92) 85%)'
      }} />

      {/* Floating Interactive Live UTXO Badges (Optional / Configurable) */}
      {showFloatingBadges && (
        <div className="hidden lg:block absolute inset-0 pointer-events-none max-w-7xl mx-auto px-6">
          {/* Badge 1: Top Left - V4 DLMM Active Bin */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="absolute top-[28%] left-8 pointer-events-auto"
          >
            <div className="group relative rounded-2xl p-3.5 bg-black/60 border border-cyan-500/30 backdrop-blur-xl shadow-2xl shadow-cyan-500/10 hover:border-cyan-400/60 transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                      DLMM Bin #482
                    </span>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-300">
                    Depth: <span className="text-white font-mono font-bold">14.8 BCH</span> · <span className="text-emerald-400 font-mono">0.0% Slip</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Badge 2: Top Right - Proceeds Separation */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8, duration: 0.7 }}
            className="absolute top-[24%] right-8 pointer-events-auto"
          >
            <div className="group relative rounded-2xl p-3.5 bg-black/60 border border-emerald-500/30 backdrop-blur-xl shadow-2xl shadow-emerald-500/10 hover:border-emerald-400/60 transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                      Proceeds Covenant
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-300">
                    Accrued: <span className="text-white font-mono font-bold">+0.942 BCH</span> · <span className="text-cyan-400 font-mono">Auto-Compounding</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Badge 3: Bottom Right - Sovereign CashToken NFT Custody */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.7 }}
            className="absolute bottom-[20%] right-12 pointer-events-auto"
          >
            <div className="group relative rounded-2xl p-3.5 bg-black/60 border border-white/10 backdrop-blur-xl shadow-2xl shadow-purple-500/10 hover:border-purple-400/50 transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-300">
                      82-Byte Position NFT
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-300">
                    Wallet Custody: <span className="text-white font-mono font-bold">P2SH32 Sovereign</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default MeshLiquidityWireframe;

