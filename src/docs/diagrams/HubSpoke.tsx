import { Figure } from './primitives';

interface Spoke { name: string; mech: string; status: string; x: number; y: number; color: string; dashed?: boolean }

// Positions are in the 720×300 viewBox. Colors: emerald = live beta, zinc = legacy/research.
const SPOKES: Spoke[] = [
    { name: 'Solana', mech: 'ZK-STARK (FRI) escrow', status: 'testnet beta', x: 20, y: 36, color: '#10b981' },
    { name: 'BSC / EVM', mech: 'ZK-STARK + IntentStarkHTLC', status: 'testnet beta', x: 20, y: 200, color: '#10b981' },
    { name: 'Monero', mech: 'Adaptor signatures', status: 'research', x: 510, y: 36, color: '#71717a', dashed: true },
    { name: 'Movement / Aptos', mech: 'Hash time-locked contract', status: 'legacy', x: 510, y: 200, color: '#71717a', dashed: true },
];

const W = 190;
const H = 64;
const HUB = { x: 360, y: 150, r: 64 };

export function HubSpoke() {
    return (
        <Figure
            title="BCH as the settlement hub"
            caption="Intents are anchored on BCH. External chains hold the other asset; a proof or a hash-lock ties the two legs together."
        >
            <svg viewBox="0 0 720 300" className="h-auto w-full" role="img" aria-label="Bitcoin Cash hub connected to Solana, BSC, Monero and Movement">
                {SPOKES.map(s => {
                    const left = s.x < HUB.x;
                    const ex = left ? s.x + W : s.x;
                    const ey = s.y + H / 2;
                    return (
                        <line
                            key={s.name + 'l'}
                            x1={ex} y1={ey} x2={HUB.x + (left ? -HUB.r : HUB.r) * 0.86} y2={HUB.y + (ey < HUB.y ? -HUB.r : HUB.r) * 0.5}
                            stroke={s.color} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray={s.dashed ? '4 4' : undefined}
                        />
                    );
                })}
                <circle cx={HUB.x} cy={HUB.y} r={HUB.r + 14} fill="#10b981" fillOpacity={0.05} />
                <circle cx={HUB.x} cy={HUB.y} r={HUB.r} fill="#0f1714" stroke="#10b981" strokeWidth={1.5} />
                <text x={HUB.x} y={HUB.y - 6} textAnchor="middle" fill="#f4f4f5" fontSize="15" fontWeight="600">Bitcoin Cash</text>
                <text x={HUB.x} y={HUB.y + 14} textAnchor="middle" fill="#6ee7b7" fontSize="11">settlement hub</text>
                {SPOKES.map(s => (
                    <g key={s.name}>
                        <rect x={s.x} y={s.y} width={W} height={H} rx={10} fill="#111114" stroke={s.color} strokeOpacity={0.5} strokeDasharray={s.dashed ? '4 4' : undefined} />
                        <text x={s.x + 14} y={s.y + 24} fill="#f4f4f5" fontSize="13" fontWeight="600">{s.name}</text>
                        <text x={s.x + W - 14} y={s.y + 24} textAnchor="end" fill={s.dashed ? '#71717a' : '#6ee7b7'} fontSize="10">{s.status}</text>
                        <text x={s.x + 14} y={s.y + 45} fill="#a1a1aa" fontSize="11">{s.mech}</text>
                    </g>
                ))}
            </svg>
        </Figure>
    );
}
