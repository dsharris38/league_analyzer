import React from 'react';
import { getVersion } from '../utils/dataDragon';

export default function RecentPerformanceCard({ recentStats }) {
    const version = getVersion();
    // take top 5 sorted by games
    const topChamps = recentStats?.slice(0, 5) || [];

    if (!recentStats || recentStats.length === 0) {
        return (
            <div className="glass-panel rounded-xl p-5 h-full flex items-center justify-center text-slate-500 text-xs italic">
                No matches in past 7 days.
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-xl p-5 h-full flex flex-col">
            <h3 className="text-cyan-400 text-xs font-bold uppercase mb-4 tracking-widest text-glow shrink-0">7 Day Performance</h3>
            <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {topChamps.map((champ) => (
                    <div key={champ.champion} className="flex items-center gap-3 bg-black/20 p-2 rounded hover:bg-white/5 transition-colors border border-transparent hover:border-cyan-500/20 group">
                        <img
                            src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.champion === "FiddleSticks" ? "Fiddlesticks" : champ.champion}.png`}
                            alt={champ.champion}
                            className="w-8 h-8 rounded border border-slate-700 group-hover:border-cyan-400/50 transition-colors"
                        />
                        <div className="flex-1 min-w-0 font-bold text-slate-300 group-hover:text-white text-xs truncate">
                            {champ.champion}
                        </div>

                        {/* Custom Bar Graph */}
                        <div className="flex h-5 w-24 rounded overflow-hidden bg-black/40 text-[9px] font-bold leading-5 text-center border border-white/5">
                            {champ.wins > 0 && (
                                <div
                                    className="bg-cyan-600 text-white h-full shadow-[0_0_5px_rgba(8,145,178,0.5)]"
                                    style={{ width: `${(champ.wins / champ.games) * 100}%` }}
                                >
                                    {champ.wins}W
                                </div>
                            )}
                            {champ.losses > 0 && (
                                <div
                                    className="bg-rose-900/80 text-white h-full"
                                    style={{ width: `${(champ.losses / champ.games) * 100}%` }}
                                >
                                    {champ.losses}L
                                </div>
                            )}
                        </div>

                        <div className={`text-xs font-bold w-10 text-right ${champ.winrate >= 0.5 ? 'text-green-400' : 'text-slate-400'}`}>
                            {(champ.winrate * 100).toFixed(0)}%
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
