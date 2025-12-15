import { Trophy, Target, Crosshair, TrendingUp, Hash, Eye, Sword } from 'lucide-react';

export default function SummaryCards({ summary, analysis }) {
    const winrate = (summary.winrate * 100).toFixed(1);
    const kda = summary.avg_kda.toFixed(2);
    const cs = summary.avg_cs_per_min.toFixed(1);
    const kp = (summary.avg_kp * 100).toFixed(1);
    const vis = (summary.avg_vis_score || 0).toFixed(1);
    const dpm = (summary.avg_dpm || 0).toFixed(0);

    const stats = [
        { label: 'KDA', value: kda, icon: Crosshair, color: 'text-blue-300', bg: 'bg-blue-500/10' },
        { label: 'Kill Participation', value: `${kp}%`, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Damage / Min', value: dpm, icon: Sword, color: 'text-orange-400', bg: 'bg-orange-500/10' },
        { label: 'Vision Score', value: vis, icon: Eye, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { label: 'CS / Min', value: cs, icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ];

    return (
        <div className="glass-panel p-5 rounded-xl border border-white/5">
            <h3 className="text-cyan-400 text-xs font-bold uppercase mb-4 tracking-widest text-glow flex items-center gap-2">
                Season Stats
            </h3>

            <div className="space-y-3">
                {stats.map((stat, idx) => (
                    <div key={stat.label} className="flex items-center gap-3 bg-black/20 p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-violet-500/20 group">
                        {/* Icon */}
                        <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/5`}>
                            <stat.icon size={18} />
                        </div>

                        {/* Label */}
                        <div className="flex-1 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                            {stat.label}
                        </div>

                        {/* Value */}
                        <div className="text-xl font-bold text-white tracking-tight text-glow font-mono">
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
