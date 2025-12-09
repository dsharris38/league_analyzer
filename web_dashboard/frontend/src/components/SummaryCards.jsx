import { Trophy, Target, Crosshair, TrendingUp } from 'lucide-react';

export default function SummaryCards({ summary, analysis }) {
    const winrate = (summary.winrate * 100).toFixed(1);
    const kda = summary.avg_kda.toFixed(2);
    const cs = summary.avg_cs_per_min.toFixed(1);
    const kp = (summary.avg_kp * 100).toFixed(1);

    const cards = [
        { label: 'Winrate', value: `${winrate}%`, icon: Trophy, color: 'text-cornsilk', bg: 'bg-cornsilk/20' },
        { label: 'KDA', value: kda, icon: Crosshair, color: 'text-cornsilk', bg: 'bg-cornsilk/20' },
        { label: 'CS / Min', value: cs, icon: Target, color: 'text-sage', bg: 'bg-sage/20' },
        { label: 'Kill Participation', value: `${kp}%`, icon: TrendingUp, color: 'text-rose-vale', bg: 'bg-rose-vale/20' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {cards.map((card) => (
                <div key={card.label} className="bg-dark-bg/60 border border-rose-vale/20 p-5 rounded-xl shadow-lg hover:border-cornsilk/40 transition-all duration-300 group backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-cornsilk/60 text-sm font-medium group-hover:text-cornsilk transition-colors">{card.label}</span>
                        <div className={`p-2 rounded-lg ${card.bg} ${card.color} group-hover:scale-110 transition-transform duration-300`}>
                            <card.icon size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-cornsilk tracking-tight font-serif">{card.value}</div>
                </div>
            ))}
        </div>
    );
}
