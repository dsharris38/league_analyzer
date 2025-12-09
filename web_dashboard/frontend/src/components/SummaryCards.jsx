import { Trophy, Target, Crosshair, TrendingUp } from 'lucide-react';

export default function SummaryCards({ summary, analysis }) {
    const winrate = (summary.winrate * 100).toFixed(1);
    const kda = summary.avg_kda.toFixed(2);
    const cs = summary.avg_cs_per_min.toFixed(1);
    const kp = (summary.avg_kp * 100).toFixed(1);

    const cards = [
        { label: 'Winrate', value: `${winrate}%`, icon: Trophy, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'KDA', value: kda, icon: Crosshair, color: 'text-blue-300', bg: 'bg-blue-500/10' },
        { label: 'CS / Min', value: cs, icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Kill Participation', value: `${kp}%`, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {cards.map((card) => (
                <div key={card.label} className="bg-slate-800/60 border border-slate-700/50 p-5 rounded-xl shadow-lg hover:border-blue-400/40 transition-all duration-300 group backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm font-medium group-hover:text-slate-200 transition-colors">{card.label}</span>
                        <div className={`p-2 rounded-lg ${card.bg} ${card.color} group-hover:scale-110 transition-transform duration-300`}>
                            <card.icon size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight">{card.value}</div>
                </div>
            ))}
        </div>
    );
}
