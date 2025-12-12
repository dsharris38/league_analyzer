import React from 'react';
import { getVersion } from '../utils/dataDragon';

export default function MasteryCard({ masteryData }) {
    const version = getVersion();
    const topMastery = masteryData?.slice(0, 5) || [];

    if (!masteryData || masteryData.length === 0) {
        return <div className="p-4 text-slate-500 text-sm">No mastery data available.</div>;
    }

    return (
        <div className="glass-panel rounded-xl p-5 h-full">
            <h3 className="text-cyan-400 text-xs font-bold uppercase mb-4 tracking-widest text-glow">Mastery</h3>
            <div className="grid grid-cols-5 gap-2">
                {topMastery.map((champ) => (
                    <div key={champ.championId} className="flex flex-col items-center group relative">
                        <div className="relative w-11 h-11 mb-2">
                            {/* Neon ring on hover */}
                            <div className="absolute inset-0 rounded-full border border-slate-600 group-hover:border-violet-500 group-hover:shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-all duration-300"></div>
                            <img
                                src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champ.championId}.png`}
                                alt="Champion"
                                className="w-full h-full rounded-full p-0.5 object-cover"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-black text-[9px] px-1 rounded border border-slate-700 font-bold text-yellow-500 group-hover:border-yellow-500/50 transition-colors">
                                {champ.championLevel}
                            </div>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono group-hover:text-white transition-colors">
                            {(champ.championPoints / 1000).toFixed(0)}k
                        </div>
                    </div>
                ))}
            </div>

            <button className="w-full mt-auto pt-4 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest flex items-center justify-center gap-1 group">
                Show All <span className="group-hover:translate-x-1 transition-transform">&gt;</span>
            </button>
        </div>
    );
}
