import React, { useState } from 'react';
import { getVersion } from '../utils/dataDragon';
import { X } from 'lucide-react';

export default function RecentPerformanceCard({ stats }) {
    const version = getVersion();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Sort by games desc just in case, though analyzer usually does it
    const allChamps = stats ? [...stats].sort((a, b) => b.games - a.games) : [];
    const displayedChamps = allChamps.slice(0, 5);

    if (!allChamps || allChamps.length === 0) {
        return (
            <div className="glass-panel rounded-xl p-5 h-full flex items-center justify-center text-slate-500 text-xs italic">
                No season data available.
            </div>
        );
    }

    const ChampionRow = ({ champ }) => {
        const winrate = (champ.winrate * 100).toFixed(0);
        const kda = champ.avg_kda.toFixed(2);
        const isWinning = champ.winrate >= 0.5;

        return (
            <div className="flex items-center gap-3 bg-black/20 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-violet-500/20 group">
                {/* Icon */}
                <div className="relative shrink-0">
                    <img
                        src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.champion === "FiddleSticks" ? "Fiddlesticks" : champ.champion}.png`}
                        alt={champ.champion}
                        className="w-10 h-10 rounded-lg border border-slate-700 group-hover:border-violet-400/50 transition-colors object-cover shadow-sm bg-slate-900"
                    />
                </div>

                {/* Name & Games */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-sm font-bold text-slate-200 group-hover:text-white truncate">
                        {champ.champion}
                    </div>
                    <div className="text-[10px] text-slate-500 group-hover:text-violet-300 transition-colors uppercase tracking-wider font-semibold">
                        {champ.games} Match{champ.games !== 1 ? 'es' : ''}
                    </div>
                </div>

                {/* Stats (Winrate & KDA) */}
                <div className="text-right shrink-0 flex flex-col items-end">
                    <div className={`text-sm font-black font-mono ${isWinning ? 'text-emerald-400' : 'text-slate-400'} text-glow`}>
                        {winrate}% WR
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                        <span className="text-slate-400">{kda}</span> KDA
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="glass-panel rounded-xl p-5 h-full flex flex-col">
                <h3 className="text-cyan-400 text-xs font-bold uppercase mb-4 tracking-widest text-glow shrink-0">Season Performance</h3>

                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {displayedChamps.map((champ) => (
                        <ChampionRow key={champ.champion} champ={champ} />
                    ))}
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full pt-3 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest flex items-center justify-center gap-1 group"
                >
                    View All <span className="group-hover:translate-x-1 transition-transform">&gt;</span>
                </button>
            </div>

            {/* FULL LIST MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 rounded-t-2xl">
                            <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-400 tracking-tight">
                                Season Performance
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-full text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body (Grid) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {allChamps.map((champ) => (
                                    <ChampionRow key={champ.champion} champ={champ} />
                                ))}
                            </div>
                        </div>

                        {/* Footer Stats */}
                        <div className="p-4 border-t border-white/5 bg-black/20 text-center text-xs text-slate-500 rounded-b-2xl font-mono">
                            Total Games: <span className="text-violet-400 font-bold">{allChamps.reduce((acc, c) => acc + c.games, 0)}</span> •
                            Champions Played: <span className="text-cyan-400 font-bold">{allChamps.length}</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
