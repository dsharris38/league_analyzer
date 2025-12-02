import { Trophy, Target, Crosshair, TrendingUp } from 'lucide-react';

export default function SummaryCards({ summary, analysis }) {
    const winrate = (summary.winrate * 100).toFixed(1);
    const kda = summary.avg_kda.toFixed(2);
    const cs = summary.avg_cs_per_min.toFixed(1);
    const kp = (summary.avg_kp * 100).toFixed(1);

    const cards = [
        { label: 'Winrate', value: `${winrate}%`, icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
        { label: 'KDA', value: kda, icon: Crosshair, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'CS / Min', value: cs, icon: Target, color: 'text-green-400', bg: 'bg-green-400/10' },
        { label: 'Kill Participation', value: `${kp}%`, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-400/10' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {cards.map((card) => (
                <div key={card.label} className="bg-slate-800 border border-slate-700 p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm font-medium">{card.label}</span>
                        <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                            <card.icon size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-white">{card.value}</div>
                </div>
            ))}
        </div>
    );
}
