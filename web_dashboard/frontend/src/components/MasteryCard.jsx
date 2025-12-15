import React, { useState } from 'react';
import { getVersion, getChampionNameById } from '../utils/dataDragon';
import { X } from 'lucide-react';

export default function MasteryCard({ masteryData }) {
    const version = getVersion();
    const topMastery = masteryData?.slice(0, 5) || [];
    const [isModalOpen, setIsModalOpen] = useState(false);

    if (!masteryData || masteryData.length === 0) {
        return <div className="p-4 text-slate-500 text-sm">No mastery data available.</div>;
    }

    // Helper to format large numbers
    const formatPoints = (points) => {
        if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
        if (points >= 1000) return `${(points / 1000).toFixed(0)}k`;
        return points;
    };

    const ChampionRow = ({ champ }) => {
        const champName = getChampionNameById(champ.championId);
        return (
            <div className="flex items-center gap-3 bg-black/20 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-violet-500/20 group">
                {/* Portrait (Square) */}
                <div className="relative shrink-0">
                    <img
                        src={`https://ddragon.leagueoflegends.com/cdn/${version || '14.23.1'}/img/champion/${champName}.png`}
                        alt={champName}
                        className="w-10 h-10 rounded-lg border border-slate-700 group-hover:border-violet-400/50 transition-colors object-cover shadow-sm bg-slate-900"
                        onError={(e) => {
                            // Fallback to older community dragon path or default icon if name lookup fails
                            e.target.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champ.championId}.png`;
                            e.target.onerror = (e2) => { e2.target.src = "https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/29.png"; }
                        }}
                    />
                    {/* Level Badge (Overlapping corner) */}
                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-yellow-600 to-yellow-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-400/30 shadow-md transform group-hover:scale-110 transition-transform">
                        {champ.championLevel}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-sm font-bold text-slate-200 group-hover:text-white truncate">
                        {champName !== "Unknown" ? champName : `Champ ${champ.championId}`}
                    </div>
                    <div className="text-[10px] text-slate-500 group-hover:text-violet-300 transition-colors uppercase tracking-wider font-semibold">
                        Level {champ.championLevel}
                    </div>
                </div>

                {/* Points (Popping Numbers) */}
                <div className="text-right shrink-0">
                    <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-200 to-white text-glow font-mono">
                        {formatPoints(champ.championPoints)}
                    </div>
                    <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">PTS</div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="glass-panel rounded-xl p-5 h-full flex flex-col">
                <h3 className="text-cyan-400 text-xs font-bold uppercase mb-4 tracking-widest text-glow shrink-0">Mastery</h3>

                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {topMastery.map((champ) => (
                        <ChampionRow key={champ.championId} champ={champ} />
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
                                Champion Mastery
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-full text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body (Grid) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {masteryData.map((champ) => (
                                    <ChampionRow key={champ.championId} champ={champ} />
                                ))}
                            </div>
                        </div>

                        {/* Footer Stats */}
                        <div className="p-4 border-t border-white/5 bg-black/20 text-center text-xs text-slate-500 rounded-b-2xl font-mono">
                            Total Mastery Score: <span className="text-violet-400 font-bold">{masteryData.reduce((acc, c) => acc + c.championLevel, 0)}</span> •
                            Total Points: <span className="text-cyan-400 font-bold">{formatPoints(masteryData.reduce((acc, c) => acc + c.championPoints, 0))}</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
