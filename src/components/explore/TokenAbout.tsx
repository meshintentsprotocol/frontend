import { useState } from 'react';
import { ExternalLink, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TokenAboutProps {
    description: string;
    website: string | null;
    explorerLinks: string[];
}

function trimUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function TokenAbout({ description, website, explorerLinks }: TokenAboutProps) {
    const [expanded, setExpanded] = useState(false);

    const hasContent = description.length > 0 || website || explorerLinks.length > 0;
    if (!hasContent) return null;

    const TRUNCATE_AT = 280;
    const isTruncatable = description.length > TRUNCATE_AT;
    const displayText = isTruncatable && !expanded
        ? description.slice(0, TRUNCATE_AT).trimEnd() + '…'
        : description;

    return (
        <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-black/20 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">About</h3>

            {description.length > 0 && (
                <div>
                    <p className="text-sm text-white/70 leading-relaxed [overflow-wrap:anywhere]">{displayText}</p>
                    {isTruncatable && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="mt-1.5 flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                        >
                            {expanded ? (
                                <><ChevronUp className="h-3 w-3 shrink-0" /> Show less</>
                            ) : (
                                <><ChevronDown className="h-3 w-3 shrink-0" /> Show more</>
                            )}
                        </button>
                    )}
                </div>
            )}

            {(website || explorerLinks.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {website && (
                        <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                'flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03]',
                                'px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors'
                            )}
                        >
                            <Globe className="h-3 w-3 shrink-0" />
                            <span className="min-w-0 truncate" title={website}>{trimUrl(website)}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
                        </a>
                    )}
                    {explorerLinks.map(link => (
                        <a
                            key={link}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                'flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03]',
                                'px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors'
                            )}
                        >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="min-w-0 truncate" title={link}>{trimUrl(link)}</span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
