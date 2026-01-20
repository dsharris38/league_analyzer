import React, { useState } from 'react';
import { getVersion } from '../utils/dataDragon';
import { X } from 'lucide-react';

export default function RecentPerformanceCard({ stats, title = "Recent Performance" }) {
    const version = getVersion();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Helper Component for Rows
    const ChampionRow = ({ champ }) => (
        <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors group border-b border-transparent hover:border-cyan-500/20">
            <div className="flex items-center gap-3">
                <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${version || '15.1.1'}/img/champion/${champ.champion}.png`}
                    alt={champ.champion}
                    className="w-9 h-9 rounded-lg border border-slate-600 group-hover:border-cyan-400 transition-colors shadow-lg"
                    onError={(e) => { e.target.src = "https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/29.png" }}
                />
                <div className="flex flex-col">
                    <span className="font-bold text-slate-200 group-hover:text-white truncate max-w-[100px] text-sm">
                        {champ.champion}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{champ.games} Games</span>
                </div>
            </div>

            <div className="text-right">
                <div className={`font-bold text-sm font-mono ${champ.winrate >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                    {(champ.winrate * 100).toFixed(0)}%
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                    {champ.kda.toFixed(2)} KDA
                </div>
            </div>
        </div>
    );


    // Sort by games desc just in case, though analyzer usually does it
    const allChamps = stats ? [...stats].sort((a, b) => b.games - a.games) : [];
    const displayedChamps = allChamps.slice(0, 5);

    if (!allChamps || allChamps.length === 0) {
        return (
            <div className="glass-panel rounded-xl p-5 h-full flex items-center justify-center text-slate-500 text-xs italic">
                No data available for {title}.
            </div>
        );
    }
    // ...
    // Note: Line numbers below target the H3

    // Actually simpler to just replace header
    // Wait, replacing lines 5-63 ensures prop is destructured and title used.
    // I will replace top of function through the return of the H3.

    // ... logic above ...

    return (
        <>
            <div className="glass-panel rounded-xl p-5 h-full flex flex-col">
                <h3 className="text-cyan-400 text-xs font-bold uppercase mb-4 tracking-widest text-glow shrink-0">{title}</h3>

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
                                {title}
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
