import React from 'react';


export default function RankCard({ rankInfo, pastRanks }) {
    // Debug logging for Rank issue
    console.log("RankCard received rankInfo:", rankInfo);

    const solo = rankInfo?.find(r => r.queueType === "RANKED_SOLO_5x5" || r.queueType.includes("SOLO"));
    const flex = rankInfo?.find(r => r.queueType === "RANKED_FLEX_SR" || r.queueType.includes("FLEX"));

    return (
        <div className="glass-panel rounded-xl p-5 h-full relative overflow-hidden group flex flex-col justify-between">
            {/* Holographic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <h3 className="text-cyan-400 text-xs font-bold uppercase tracking-widest text-glow relative z-10 shrink-0 mb-2">Current Rank</h3>

            {/* Main Rank Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center">

                {/* Icon Container */}
                <div className="relative group/icon p-4">
                    {/* Glow effect */}
                    <div className={`absolute inset-0 bg-gradient-to-b ${getTierColor(solo?.tier)} opacity-20 blur-2xl rounded-full group-hover/icon:opacity-40 transition-opacity duration-500`}></div>

                    {solo ? (
                        <img
                            src={getTierIcon(solo.tier)}
                            alt={solo.tier}
                            className="w-28 h-28 object-contain drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] relative z-10 transform group-hover/icon:scale-110 transition-transform duration-500 ease-out"
                        />
                    ) : (
                        <div className="w-24 h-24 flex items-center justify-center relative z-10">
                            <span className="text-3xl font-black text-slate-700">U</span>
                        </div>
                    )}
                </div>

                {/* Text Details */}
                <div className="flex flex-col items-center text-center mt-2 space-y-1">
                    <div className={`text-2xl font-black tracking-tight ${getTierColorText(solo?.tier)} text-glow`}>
                        {solo ? `${solo.tier} ${solo.rank}` : "Unranked"}
                    </div>

                    {solo && (
                        <>
                            <div className="flex items-center gap-3 text-sm font-mono text-slate-300">
                                <span className="font-bold text-white">{solo.leaguePoints} LP</span>
                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                <span className={`${solo.wins / (solo.wins + solo.losses) > 0.5 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {(solo.wins / (solo.wins + solo.losses) * 100).toFixed(0)}% WR
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full mt-1 font-mono">
                                {solo.wins}W <span className="text-slate-700">/</span> {solo.losses}L
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Flex Queue Footer */}
            <div className="w-full border-t border-white/5 pt-3 mt-2">
                <div className="flex justify-between items-center text-xs px-1">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Flex Rank</span>
                    <span className={`font-bold font-mono ${getTierColorText(flex?.tier)}`}>
                        {flex ? `${flex.tier} ${flex.rank}` : "Unranked"}
                    </span>
                </div>
            </div>
        </div>
    );
}

function getTierIcon(tier) {
    if (!tier) return "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/unranked.png";
    // Convert "GOLD IV" -> "gold"
    const t = tier.split(" ")[0].toLowerCase();

    // Handle specific high-elo naming conventions if CDragon differs (usually it matches)
    // iron, bronze, silver, gold, platinum, emerald, diamond, master, grandmaster, challenger
    return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${t}.png`;
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
