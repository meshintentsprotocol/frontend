import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// AnimatedTradeButton — Blazing wireframe CTA
// ─────────────────────────────────────────────

interface Props {
    className?: string;
    size?: "default" | "lg";
    onClick?: () => void;
}

export function AnimatedTradeButton({
    className,
    size = "default",
    onClick,
}: Props) {
    const isLg = size === "lg";
    const btnRef = useRef<HTMLAnchorElement>(null);
    const [hovering, setHovering] = useState(false);

    return (
        <a
            ref={btnRef as any}
            href="#"
            onClick={(e) => {
                e.preventDefault();
                if (onClick) onClick();
            }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className={cn("relative group block cursor-default select-none", className)}
        >
            {/* ── 1. Outer soft ambient glow ── */}
            <div
                className={cn(
                    "absolute -inset-2 rounded-xl blur-xl transition-all duration-700 pointer-events-none",
                    "bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-500/0",
                    hovering ? "opacity-100 scale-105" : "opacity-0 scale-100"
                )}
            />

            {/* ── 2. Inner card surface (Glass Solid style) ── */}
            <div
                className={cn(
                    "relative flex items-center justify-center gap-2 rounded-xl overflow-hidden transition-all duration-300",
                    "glass-solid border border-emerald-500/30 shadow-[inset_0_1px_10px_rgba(16,185,129,0.15)]",
                    hovering ? "bg-emerald-950/20 shadow-[inset_0_1px_20px_rgba(16,185,129,0.3)] border-emerald-400/50" : "bg-[#050505]/80",
                    isLg
                        ? "h-14 px-10 text-lg font-black font-mono tracking-wider"
                        : "h-10 px-6 text-sm font-black font-mono tracking-widest"
                )}
            >
                {/* Subtle mesh / noise texture */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.1] mix-blend-overlay pointer-events-none" />

                {/* Inner moving shimmer highlight */}
                <div
                    className={cn(
                        "absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none",
                        hovering && "opacity-100"
                    )}
                >
                    <div className="absolute -inset-full animate-shimmer bg-gradient-to-r from-transparent via-emerald-400/[0.15] to-transparent skew-x-12" />
                </div>

                {/* ── Lightning bolt icon ── */}
                <svg
                    width={isLg ? 20 : 14}
                    height={isLg ? 20 : 14}
                    viewBox="0 0 24 24"
                    fill="none"
                    className={cn(
                        "relative z-10 transition-all duration-300",
                        hovering
                            ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                            : "text-emerald-500"
                    )}
                >
                    <path
                        d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>

                {/* ── Text ── */}
                <span
                    className={cn(
                        "relative z-10 transition-all duration-300",
                        hovering
                            ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                            : "text-white/90"
                    )}
                >
                    {isLg ? "COMING SOON" : "COMING SOON"}
                </span>

                {/* Right arrow that slides in on hover */}
                <svg
                    width={isLg ? 18 : 14}
                    height={isLg ? 18 : 14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn(
                        "relative z-10 transition-all duration-300 text-emerald-400",
                        hovering
                            ? "translate-x-0 opacity-100 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                            : "-translate-x-2 opacity-0"
                    )}
                >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                </svg>
            </div>
        </a>
    );
}
