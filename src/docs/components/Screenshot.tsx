import { useState } from 'react';
import { ImagePlus, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export interface ScreenshotProps {
    src: string;
    alt?: string;
    caption?: string;
    /** Route shown in the fake browser bar, e.g. "/trade". */
    url?: string;
}

function BrowserBar({ url }: { url?: string }) {
    return (
        <div className="flex h-8 items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3">
            <span className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            </span>
            {url && (
                <span className="mx-auto max-w-[60%] truncate rounded-md bg-black/40 px-3 py-0.5 font-mono text-[11px] text-zinc-500">
                    bchintents.app{url}
                </span>
            )}
        </div>
    );
}

/** Shown until the image exists: tells the author exactly which file to add. */
function UploadSlot({ src, url }: { src: string; url?: string }) {
    const file = src.startsWith('/') ? `public${src}` : src;
    return (
        <div className="overflow-hidden rounded-xl border border-dashed border-white/[0.12] bg-[#0b0b0d]">
            <BrowserBar url={url} />
            <div className="flex aspect-[16/10] flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] px-6 text-center [background-size:20px_20px]">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-500">
                    <ImagePlus className="h-5 w-5" />
                </span>
                <p className="text-[13px] font-medium text-zinc-400">Screenshot slot</p>
                <code className="max-w-full break-all rounded-md border border-white/[0.06] bg-black/40 px-2 py-1 font-mono text-[11.5px] text-zinc-400">{file}</code>
                <p className="text-[11.5px] text-zinc-600">PNG, 1440 × 900 recommended{url ? ` · capture ${url}` : ''}</p>
            </div>
        </div>
    );
}

/** App screenshot in a browser frame. Click to zoom. Renders an upload slot until the file exists. */
export function Screenshot({ src, alt, caption, url }: ScreenshotProps) {
    const [open, setOpen] = useState(false);
    const [missing, setMissing] = useState(false);
    const label = alt || caption || 'Screenshot';

    return (
        <figure className="my-8">
            {missing ? (
                <UploadSlot src={src} url={url} />
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="group relative block w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0b0d] text-left shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] transition-colors hover:border-emerald-500/30"
                    aria-label={`Enlarge: ${label}`}
                >
                    <BrowserBar url={url} />
                    <img src={src} alt={label} loading="lazy" onError={() => setMissing(true)} className="block w-full" />
                    <span className="absolute right-3 top-11 flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/60 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                        <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                </button>
            )}
            {caption && <figcaption className="mt-3 text-center text-[13px] text-zinc-500">{caption}</figcaption>}
            {!missing && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="max-w-[min(1400px,95vw)] border-white/10 bg-[#0b0b0d] p-2">
                        <DialogTitle className="sr-only">{label}</DialogTitle>
                        <img src={src} alt={label} className="w-full rounded-lg" />
                    </DialogContent>
                </Dialog>
            )}
        </figure>
    );
}
