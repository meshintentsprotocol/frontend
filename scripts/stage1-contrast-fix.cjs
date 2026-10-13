const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../meshprotocol');

function writeFile(relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('✓ Successfully wrote ' + relPath);
}

// -----------------------------------------------------------------------------
// 1. High-Contrast index.css
// -----------------------------------------------------------------------------
const indexCss = `
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg-base: #f8fafc;
    --bg-surface: #ffffff;
    --bg-card: #ffffff;
    --bg-subtle: #f1f5f9;
    --bg-input: #ffffff;
    --border-grid: #cbd5e1;
    --border-card: #e2e8f0;
    --border-subtle: #f1f5f9;
    --text-primary: #0f172a;
    --text-secondary: #334155;
    --text-muted: #64748b;
    --btn-primary-bg: #0f172a;
    --btn-primary-text: #ffffff;
    --btn-secondary-bg: #ffffff;
    --btn-secondary-border: #cbd5e1;
    --btn-secondary-text: #0f172a;
    --crosshair-bg: #e2e8f0;
    --crosshair-stroke: #475569;
  }

  .dark {
    --bg-base: #0b0c10;
    --bg-surface: #111318;
    --bg-card: #151821;
    --bg-subtle: #1c202c;
    --bg-input: #0e1017;
    --border-grid: #232734;
    --border-card: #282d3d;
    --border-subtle: #1c202c;
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #8492a6;
    --btn-primary-bg: #f8fafc;
    --btn-primary-text: #0b0c10;
    --btn-secondary-bg: #151821;
    --btn-secondary-border: #333a4d;
    --btn-secondary-text: #f8fafc;
    --crosshair-bg: #1e2230;
    --crosshair-stroke: #94a3b8;
  }

  * {
    border-color: var(--border-card);
    scrollbar-width: thin;
  }

  html {
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  body {
    background-color: var(--bg-base);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    transition: background-color 0.15s ease, color 0.15s ease;
  }
}

/* High-contrast custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
.dark ::-webkit-scrollbar-thumb {
  background: #2a3042;
}

.wireframe-border {
  border-color: var(--border-grid);
}

.wireframe-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-card);
}
`;

writeFile('src/index.css', indexCss);

// -----------------------------------------------------------------------------
// 2. MeshCanvas.tsx (Subtle & Non-Intrusive)
// -----------------------------------------------------------------------------
const meshCanvas = `
import React, { useEffect, useRef } from 'react';
import { useMesh } from '@/context/MeshContext';

export function MeshCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme, activeTab } = useMesh();

  // If in 'app' mode, disable canvas background entirely for maximum visual clarity
  const isApp = activeTab === 'app';

  useEffect(() => {
    if (isApp) return;

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

    const count = 22; // lower count to eliminate visual noise
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
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 1.2 + 0.8,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const isDark = theme === 'dark';

      const dotColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
      const lineColor = isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.025)';

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

          if (dist < 110) {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 0.8;
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
  }, [theme, isApp]);

  if (isApp) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-40"
    />
  );
}
`;

writeFile('src/components/common/MeshCanvas.tsx', meshCanvas);

console.log('✓ Stage 1 complete: index.css and MeshCanvas updated for high contrast.');
