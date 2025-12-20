import React from 'react';
import { getVersion } from '../utils/dataDragon';

export default function TeammatesCard({ teammates, onPlayerClick }) {
    const version = getVersion();
    const topTeammates = teammates?.slice(0, 5) || [];

    if (!teammates || teammates.length === 0) {
        return (
            <div className="glass-panel rounded-xl p-5 h-full flex items-center justify-center text-slate-500 text-xs italic">
                No recent duos found.
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-xl p-5 h-full flex flex-col">
            <h3 className="text-cyan-400 text-xs font-bold uppercase mb-4 tracking-widest text-glow shrink-0">Season Duos</h3>
            <div className="space-y-1 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {topTeammates.map((mate, i) => (
                    <div key={mate.puuid} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors group border-b border-transparent hover:border-cyan-500/20">
                        <div className="flex items-center gap-3">
                            <img
                                src={`https://ddragon.leagueoflegends.com/cdn/${version || '15.1.1'}/img/profileicon/${mate.icon}.png`}
                                alt="Icon"
                                className="w-9 h-9 rounded-lg border border-slate-600 group-hover:border-cyan-400 transition-colors shadow-lg cursor-pointer"
                                onError={(e) => { e.target.src = "https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/29.png" }}
                                onClick={() => onPlayerClick && onPlayerClick(mate.name)}
                            />
                            <div className="flex flex-col">
                                <span
                                    className="font-bold text-slate-200 group-hover:text-white truncate max-w-[100px] text-sm cursor-pointer hover:underline hover:text-cyan-400 transition-colors"
                                    onClick={() => onPlayerClick && onPlayerClick(mate.name)}
                                >
                                    {mate.name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{mate.games} Games</span>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className={`font-bold text-sm font-mono ${mate.winrate >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                                {(mate.winrate * 100).toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                                {mate.wins}W - {mate.games - mate.wins}L
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
