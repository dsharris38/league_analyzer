import React from 'react';


export default function RankCard({ rankInfo, pastRanks }) {
    // Debug logging for Rank issue
    console.log("RankCard received rankInfo:", rankInfo);

    const solo = rankInfo?.find(r => r.queueType === "RANKED_SOLO_5x5" || r.queueType.includes("SOLO"));
    const flex = rankInfo?.find(r => r.queueType === "RANKED_FLEX_SR" || r.queueType.includes("FLEX"));

    return (
        <div className="glass-panel rounded-xl p-5 h-full relative overflow-hidden group flex flex-col">
            {/* Holographic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <h3 className="text-cyan-400 text-xs font-bold uppercase mb-4 tracking-widest text-glow relative z-10 shrink-0">Current Rank</h3>

            <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="flex items-center gap-5 mb-6">
                    <div className="relative shrink-0">
                        <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getTierColor(solo?.tier)} p-[2px] shadow-[0_0_15px_rgba(139,92,246,0.3)] animate-pulse-slow`}>
                            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center relative overflow-hidden">
                                {/* Inner glow */}
                                <div className="absolute inset-0 bg-white/10 rounded-full"></div>
                                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 z-10">
                                    {solo ? solo.tier[0] : "U"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <div className={`text-3xl font-black tracking-tight ${getTierColorText(solo?.tier)} text-glow`}>
                            {solo ? `${solo.tier} ${solo.rank}` : "Unranked"}
                        </div>
                        <div className="text-sm text-slate-300 font-mono mb-1">
                            {solo ? `${solo.leaguePoints} LP` : ""}
                        </div>
                        {solo && (
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                {solo.wins}W / {solo.losses}L <span className={solo.wins / (solo.wins + solo.losses) > 0.5 ? "text-green-400" : "text-red-400"}>({(solo.wins / (solo.wins + solo.losses) * 100).toFixed(0)}%)</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-white/5 pt-4">
                    <div className="flex justify-between items-center bg-black/20 p-2 rounded mb-3 border border-white/5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Flex Queue</span>
                        <span className="text-xs text-slate-200 font-bold font-mono">
                            {flex ? `${flex.tier} ${flex.rank}` : "Unranked"}
                        </span>
                    </div>

                    {/* Past Seasons List */}
                    <div className="space-y-1">
                        <h4 className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">History</h4>
                        {pastRanks && pastRanks.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {pastRanks.slice(0, 4).map((s, i) => (
                                    <div key={i} className="flex items-center justify-between text-[10px] text-slate-400 bg-white/5 px-2 py-1 rounded border border-transparent hover:border-violet-500/30 transition-colors">
                                        <span className="font-medium">{s.season}</span>
                                        <span className={`font-bold ${getTierColorText(s.tier.split(" ")[0])}`}>{s.tier}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-[10px] text-slate-600 italic">No past season data.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function getTierColor(tier) {
    if (!tier) return "from-slate-600 to-slate-800";
    switch (tier.toUpperCase()) {
        case 'IRON': return "from-stone-600 to-stone-800";
        case 'BRONZE': return "from-amber-700 to-amber-900";
        case 'SILVER': return "from-slate-400 to-slate-600";
        case 'GOLD': return "from-yellow-400 to-yellow-600";
        case 'PLATINUM': return "from-cyan-400 to-cyan-600";
        case 'EMERALD': return "from-emerald-400 to-emerald-600";
        case 'DIAMOND': return "from-blue-400 to-blue-600";
        case 'MASTER': return "from-purple-400 to-purple-600";
        case 'GRANDMASTER': return "from-red-400 to-red-600";
        case 'CHALLENGER': return "from-yellow-300 to-blue-500";
        default: return "from-slate-600 to-slate-800";
    }
}

function getTierColorText(tier) {
    if (!tier) return "text-slate-500";
    switch (tier.toUpperCase()) {
        case 'GOLD': return "text-yellow-500";
        case 'PLATINUM': return "text-cyan-400";
        case 'EMERALD': return "text-emerald-400";
        case 'DIAMOND': return "text-blue-400";
        case 'MASTER': return "text-purple-400";
        default: return "text-slate-400";
    }
}
