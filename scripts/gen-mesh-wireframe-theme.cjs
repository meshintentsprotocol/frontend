const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../meshprotocol');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('Created: ' + relPath);
}

// 1. src/index.css
writeFile('src/index.css', `
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg-base: #f9f9fb;
    --bg-card: #ffffff;
    --bg-badge: #f4f4f5;
    --border-grid: #c0c2c4;
    --border-card: #e4e4e7;
    --text-primary: #09090b;
    --text-secondary: #52525b;
    --text-muted: #71717a;
    --btn-primary-bg: #09090b;
    --btn-primary-text: #ffffff;
    --btn-secondary-bg: #ffffff;
    --btn-secondary-border: #d4d4d8;
    --btn-secondary-text: #09090b;
    --crosshair-bg: #f4f4f5;
    --crosshair-stroke: #71717a;
  }

  .dark {
    --bg-base: #09090b;
    --bg-card: #121215;
    --bg-badge: #1c1c20;
    --border-grid: #27272a;
    --border-card: #27272a;
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #71717a;
    --btn-primary-bg: #fafafa;
    --btn-primary-text: #09090b;
    --btn-secondary-bg: #121215;
    --btn-secondary-border: #3f3f46;
    --btn-secondary-text: #fafafa;
    --crosshair-bg: #18181b;
    --crosshair-stroke: #a1a1aa;
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
    transition: background-color 0.2s ease, color 0.2s ease;
  }
}

.wireframe-border {
  border-color: var(--border-grid);
}

.wireframe-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-card);
}
`);

// 2. src/components/common/MeshWireframeBox.tsx
writeFile('src/components/common/MeshWireframeBox.tsx', `
import React from 'react';
import { cn } from '@/lib/utils';

export function CornerCrosshair({ className }: { className?: string }) {
  return (
    <svg
      className={cn(
        "rounded-full size-6 stroke-muted-foreground bg-[#F4F4F4] dark:bg-[#18181b] dark:stroke-neutral-400 absolute z-20 pointer-events-none transition-colors",
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 14h14" />
      <path d="M14 7v14" />
    </svg>
  );
}

interface WireframeSectionProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  id?: string;
}

export function WireframeSection({
  children,
  className,
  innerClassName,
  id,
}: WireframeSectionProps) {
  return (
    <section id={id} className={cn("border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 mb-4", className)}>
      <div className={cn("border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto p-4 sm:p-6 border-t", innerClassName)}>
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />
        {children}
      </div>
    </section>
  );
}
`);

console.log('Created wireframe foundation.');
