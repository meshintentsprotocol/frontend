/** Pieces shared by the swap-server admin pages: status badges, money formatting, the hourly chart, alerts, the event list. */
import { Link } from 'react-router-dom';
import { AlertTriangle, XCircle, CheckCircle2, Info, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pill, TimeAgo, EmptyBlock, type Tone } from '../kit';
import type { Alert, HourBucket, Section, Severity, SwapEvent } from './swapApi';

export const swapUrl = {
  home: '/admin/swap',
  events: '/admin/swap/events',
  settings: '/admin/swap/settings',
  transfers: '/admin/swap/cctp',
  transfer: (id: string) => `/admin/swap/cctp/${encodeURIComponent(id)}`,
  chains: '/admin/swap/cctp/chains',
  swaps: '/admin/swap/solana',
  swap: (id: string) => `/admin/swap/solana/${encodeURIComponent(id)}`,
  tokens: '/admin/swap/solana/tokens',
};

// ── money ────────────────────────────────────────────────────────────────────

/** USDC base units (6 dp) → "1,234.56". */
export function usdc(base: string | undefined | null, maxFrac = 2): string {
  if (base === undefined || base === null || base === '') return '—';
  const n = Number(BigInt(base)) / 1e6;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: n !== 0 && Math.abs(n) < 1 ? 6 : maxFrac });
}
export function usd(n: number | undefined | null, compact = false): string {
  if (n === undefined || n === null) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : 2 });
}
export const pct = (r: number | null | undefined) => (r === null || r === undefined ? '—' : `${(r * 100).toFixed(r === 1 || r === 0 ? 0 : 1)}%`);
export const secs = (s: number | null | undefined) => (s === null || s === undefined ? '—' : s < 60 ? `${s.toFixed(s < 10 ? 1 : 0)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);
/** Trim a decimal string for tables: "0.085903389" → "0.085903". */
export function trimAmount(v: string | undefined, sig = 6): string {
  if (v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString(undefined, { maximumSignificantDigits: sig });
}

// ── status ───────────────────────────────────────────────────────────────────

const TRANSFER_STATUS: Record<string, { tone: Tone; label: string }> = {
  CREATED: { tone: 'zinc', label: 'Awaiting burn' },
  BURN_SUBMITTED: { tone: 'sky', label: 'Burn sent' },
  BURN_CONFIRMED: { tone: 'sky', label: 'Awaiting attestation' },
  ATTESTED: { tone: 'violet', label: 'Attested' },
  MINT_SUBMITTED: { tone: 'violet', label: 'Mint sent' },
  COMPLETED: { tone: 'emerald', label: 'Completed' },
  COMPLETED_EXTERNAL: { tone: 'emerald', label: 'Minted by user' },
  FAILED: { tone: 'rose', label: 'Failed' },
  EXPIRED: { tone: 'zinc', label: 'Expired' },
};
const SWAP_STATUS: Record<string, { tone: Tone; label: string }> = {
  CREATED: { tone: 'zinc', label: 'Awaiting signature' },
  SUBMITTED: { tone: 'sky', label: 'Submitted' },
  COMPLETED: { tone: 'emerald', label: 'Completed' },
  FAILED: { tone: 'rose', label: 'Failed' },
  EXPIRED: { tone: 'zinc', label: 'Expired' },
};
export const transferStatusLabel = (s: string) => TRANSFER_STATUS[s]?.label ?? s;
export const swapStatusLabel = (s: string) => SWAP_STATUS[s]?.label ?? s;

export function TransferStatusBadge({ status }: { status: string }) {
  const m = TRANSFER_STATUS[status] ?? { tone: 'zinc' as Tone, label: status };
  return <Pill tone={m.tone} dot>{m.label}</Pill>;
}
export function SwapStatusBadge({ status }: { status: string }) {
  const m = SWAP_STATUS[status] ?? { tone: 'zinc' as Tone, label: status };
  return <Pill tone={m.tone} dot>{m.label}</Pill>;
}

/** "Base Sepolia → Arc Testnet", from chain keys and the overview's chain names. */
export function RouteLabel({ src, dst, names, className }: { src: string; dst: string; names?: Record<string, string>; className?: string }) {
  const n = (k: string) => names?.[k] ?? k;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-zinc-200 whitespace-nowrap', className)}>
      {n(src)}<ArrowRight className="w-3 h-3 text-zinc-500" aria-hidden />{dst ? n(dst) : <span className="text-zinc-500">unknown</span>}
    </span>
  );
}

// ── chart: 24 hourly bars, completed stacked over failed, created as the outline ─

export function HourlyBars({ hourly, height = 96 }: { hourly: HourBucket[]; height?: number }) {
  const max = Math.max(1, ...hourly.map(h => Math.max(h.created, h.completed + h.failed)));
  const total = hourly.reduce((a, h) => a + h.created, 0);
  if (!total && !hourly.some(h => h.completed || h.failed)) return <div className="text-xs text-zinc-600 py-6 text-center">No activity in the last 24 hours</div>;
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }} role="img" aria-label={`Hourly activity, last 24 hours: ${total} created`}>
        {hourly.map(h => {
          const label = `${new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${h.created} created, ${h.completed} completed, ${h.failed} failed`;
          return (
            <div key={h.t} title={label} className="relative flex-1 h-full flex flex-col justify-end min-w-[4px]">
              <div className="absolute bottom-0 inset-x-0 rounded-sm border border-white/[0.09] bg-white/[0.02]" style={{ height: `${(h.created / max) * 100}%` }} />
              {h.failed > 0 && <div className="relative bg-rose-400/80 rounded-t-sm" style={{ height: `${(h.failed / max) * 100}%` }} />}
              {h.completed > 0 && <div className={cn('relative bg-emerald-400/80', h.failed ? '' : 'rounded-t-sm')} style={{ height: `${(h.completed / max) * 100}%` }} />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
        <span>24h ago</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm border border-white/20" aria-hidden />created</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400/80" aria-hidden />completed</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-400/80" aria-hidden />failed</span>
        </span>
        <span>now</span>
      </div>
    </div>
  );
}

// ── alerts ───────────────────────────────────────────────────────────────────

const SECTION_LABEL: Record<Section, string> = { cctp: 'Cross-chain', solana: 'Solana', system: 'Server' };

export function AlertList({ alerts, section }: { alerts: Alert[]; section?: Section }) {
  const list = section ? alerts.filter(a => a.section === section) : alerts;
  if (!list.length) {
    return <div className="flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 className="w-4 h-4" aria-hidden />Nothing needs attention.</div>;
  }
  return (
    <ul className="space-y-1.5">
      {list.map((a, i) => (
        <li key={i} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
          a.severity === 'error' ? 'border-rose-500/25 bg-rose-500/[0.06] text-rose-100' : 'border-amber-500/25 bg-amber-500/[0.06] text-amber-100')}>
          {a.severity === 'error' ? <XCircle className="w-3.5 h-3.5 mt-px shrink-0 text-rose-400" aria-hidden /> : <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0 text-amber-400" aria-hidden />}
          <span className="min-w-0 break-words">{!section && <span className="font-semibold">{SECTION_LABEL[a.section]}: </span>}{a.text}</span>
        </li>
      ))}
    </ul>
  );
}

// ── events ───────────────────────────────────────────────────────────────────

const SEV: Record<Severity, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: 'text-sky-400' },
  success: { icon: CheckCircle2, cls: 'text-emerald-400' },
  warn: { icon: AlertTriangle, cls: 'text-amber-400' },
  error: { icon: XCircle, cls: 'text-rose-400' },
};

function subjectUrl(e: SwapEvent): string | undefined {
  if (e.subject?.kind === 'transfer') return swapUrl.transfer(e.subject.id);
  if (e.subject?.kind === 'swap') return swapUrl.swap(e.subject.id);
  if (e.subject?.kind === 'chain') return swapUrl.chains;
  if (e.subject?.kind === 'settings') return swapUrl.settings;
  if (e.subject?.kind === 'token') return swapUrl.tokens;
  return undefined;
}

export function SwapEventList({ events, empty = 'No events yet', showSection = true }: { events: SwapEvent[]; empty?: string; showSection?: boolean }) {
  if (!events.length) return <EmptyBlock title={empty} />;
  return (
    <ul className="divide-y divide-white/[0.04]">
      {events.map(e => {
        const Icon = SEV[e.severity].icon;
        const to = subjectUrl(e);
        return (
          <li key={e.seq} className="flex items-start gap-2.5 py-2">
            <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', SEV[e.severity].cls)} aria-label={e.severity} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-200 break-words">
                {to ? <Link to={to} className="hover:text-emerald-300 hover:underline underline-offset-2">{e.summary}</Link> : e.summary}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
                {showSection && <span className="uppercase tracking-wider">{SECTION_LABEL[e.section]}</span>}
                <span className="font-mono">{e.type}</span>
              </div>
            </div>
            <TimeAgo at={e.at} unit="ms" className="shrink-0" />
          </li>
        );
      })}
    </ul>
  );
}

/** A labelled on/off switch row used on the settings and control cards. */
export function SwitchRow({ label, description, checked, onChange, disabled, danger }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-xs font-medium text-zinc-200">{label}</div>
        {description && <div className="mt-0.5 text-[11px] text-zinc-500 leading-relaxed">{description}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn('relative shrink-0 w-9 h-5 rounded-full border transition-colors duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
          checked ? (danger ? 'bg-amber-500/30 border-amber-400/40' : 'bg-emerald-500/30 border-emerald-400/40') : 'bg-white/[0.04] border-white/10')}>
        <span className={cn('absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform duration-150', checked ? 'translate-x-4 bg-white' : 'bg-zinc-500')} />
      </button>
    </div>
  );
}
