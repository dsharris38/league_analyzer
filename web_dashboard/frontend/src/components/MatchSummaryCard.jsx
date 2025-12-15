import React from 'react';
import { getChampionIconUrl, getItemIconUrl, getSpellIconUrl, getRuneIconUrl, getItemData, getSummonerSpellData, getRuneData } from '../utils/dataDragon';
import Tooltip, { ItemTooltip, RuneTooltip, SummonerSpellTooltip } from './Tooltip';
import { Clock, Trophy, Skull, Microscope, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

const formatReason = (reason) => {
    if (!reason) return "Poor Performance";
    // catch "High Deaths (10) with low impact" -> "Feeding and Low Impact"
    if (reason.includes("High Deaths")) return "Feeding and Low Impact";
    if (reason.includes("Low Participation")) return "Low Map Presence";
    if (reason.includes("Low Damage")) return "Low Damage Output";
    // Generic Title Case
    return reason.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function MatchSummaryCard({ match, puuid, onExpand, onDeepDive, isReviewCandidate, reviewReason, onPlayerClick, isExpanded }) {
    const self = match.participants.find(p => p.is_self);
    const win = self.win;
    const durationMin = Math.floor(match.game_duration / 60);
    const durationSec = match.game_duration % 60;

    // Teams
    const team100 = match.participants.filter(p => p.team_id === 100);
    const team200 = match.participants.filter(p => p.team_id === 200);

    return (
        <div className="relative mb-2 group">
            {/* Review Candidate Badge (Consolidated High Blame Tag) */}
            {isReviewCandidate && !reviewReason?.includes("Low Participation") && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg z-10 flex items-center gap-1 border border-purple-400/50 shadow-purple-500/20 whitespace-nowrap">
                    <Trophy size={10} />
                    High Blame Loss - {formatReason(reviewReason)}
                </div>
            )}
            <div className={clsx(
                "flex flex-col md:flex-row items-stretch border shadow-lg transition-all hover:shadow-xl hover:border-white/20 h-auto md:min-h-28 relative backdrop-blur-md overflow-hidden",
                isExpanded ? "rounded-t-xl rounded-b-none border-b-0" : "rounded-xl mb-2",
                win
                    ? "bg-slate-900/40 border-l-4 border-l-blue-500 border-y-white/5 border-r-transparent shadow-blue-900/10"
                    : "bg-slate-900/40 border-l-4 border-l-red-500 border-y-white/5 border-r-transparent shadow-red-900/10",
                isReviewCandidate && "ring-1 ring-purple-500/30",
                match.tags?.includes("Weak Link") && "ring-1 ring-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            )}>
                {/* Game Info */}
                <div className="w-full md:w-28 p-2 flex flex-col justify-center text-xs text-slate-400 shrink-0 border-b md:border-b-0 md:border-r border-slate-700">
                    <div className={clsx("font-bold mb-0.5", win ? "text-blue-400" : "text-red-400")}>
                        {(() => {
                            const q = match.queue_id;
                            if (q === 420) return "Ranked Solo";
                            if (q === 440) return "Ranked Flex";
                            if (q === 400) return "Normal Draft";
                            if (q === 430) return "Blind Pick";
                            if (q === 450) return "ARAM";
                            if (q === 490) return "Quickplay";
                            if (q === 1700) return "Arena";
                            if (q === 1900) return "URF";
                            return match.game_mode === "CLASSIC" ? "Normal" : match.game_mode; // Fallback "Normal" over "CLASSIC"
                        })()}
                    </div>
                    <div className="mb-0.5">{new Date(match.game_creation).toLocaleDateString()}</div>
                    <div className="flex items-center gap-1 mb-1">
                        <div className={clsx("w-8 h-0.5 rounded", win ? "bg-blue-500" : "bg-red-500")}></div>
                    </div>
                    <div className={clsx("font-bold", win ? "text-blue-300" : "text-red-300")}>{win ? "Victory" : "Defeat"}</div>
                    <div>{durationMin}m {durationSec}s</div>

                    {/* Performance Tags */}
                    {match.tags && match.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            {match.tags.map(tag => {
                                const style = (() => {
                                    switch (tag) {
                                        case "Hyper Carry": return "bg-blue-500/20 text-blue-300";
                                        case "Stomp": return "bg-blue-500/20 text-blue-500 border border-blue-500/30";
                                        case "Solid Win": return "bg-slate-700/40 text-slate-300";
                                        case "Passenger": return "bg-slate-700/40 text-slate-500";
                                        case "Ace in Defeat": return "bg-red-500/20 text-red-300";
                                        case "Lane Gap": return "bg-red-500/10 text-red-500";
                                        case "Throw":
                                        case "Early Gap":
                                        case "Bad Death": return "bg-slate-800 text-red-400";
                                        case "Feeding": return "bg-slate-800 text-red-500";
                                        case "Team Gap": return "bg-slate-800 text-slate-400";
                                        case "Tough Loss": return "bg-slate-900 text-slate-500";
                                        case "Weak Link": return "bg-red-500/10 text-red-500";
                                        default: return "bg-slate-800 text-slate-400";
                                    }
                                })();
                                return (
                                    <span key={tag} className={clsx("text-[9px] px-1 rounded font-bold", style)}>
                                        {tag}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                </div>

                {/* Player Stats */}
                <div className="flex-1 flex flex-col md:flex-row items-center px-2 md:px-4 gap-2 md:gap-0">

                    {/* Champion & Spells - Fixed Width */}
                    <div className="flex gap-2 items-center w-full md:w-36 shrink min-w-0">
                        <div className="relative">
                            <img
                                src={getChampionIconUrl(self.champion_name)}
                                alt={self.champion_name}
                                className="w-12 h-12 md:w-14 md:h-14 rounded border-2 border-rose-vale/30"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-slate-900 text-[10px] rounded-full w-5 h-5 flex items-center justify-center border border-slate-600 text-white">
                                {self.champ_level || 18}
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <div className="flex gap-0.5">
                                <Tooltip content={<SummonerSpellTooltip spellData={getSummonerSpellData(self.summoner1Id)} />}>
                                    {getSpellIconUrl(self.summoner1Id) && <img src={getSpellIconUrl(self.summoner1Id)} className="w-5 h-5 rounded cursor-help text-transparent" alt="Summoner 1" loading="lazy" />}
                                </Tooltip>
                                <Tooltip content={<SummonerSpellTooltip spellData={getSummonerSpellData(self.summoner2Id)} />}>
                                    {getSpellIconUrl(self.summoner2Id) && <img src={getSpellIconUrl(self.summoner2Id)} className="w-5 h-5 rounded cursor-help text-transparent" alt="Summoner 2" loading="lazy" />}
                                </Tooltip>
                            </div>
                            <div className="flex gap-0.5">
                                <Tooltip content={<RuneTooltip runeData={getRuneData(self.perks.keystone)} />}>
                                    <img src={getRuneIconUrl(self.perks.keystone)} className="w-5 h-5 rounded-full bg-black cursor-help text-transparent" alt="Keystone" loading="lazy" />
                                </Tooltip>
                                <Tooltip content={<RuneTooltip runeData={getRuneData(self.perks.sub_style)} />}>
                                    <img src={getRuneIconUrl(self.perks.sub_style)} className="w-5 h-5 rounded-full bg-black p-0.5 cursor-help text-transparent" alt="Secondary" loading="lazy" />
                                </Tooltip>
                            </div>
                        </div>
                    </div>

                    {/* KDA - Fixed Width */}
                    <div className="flex flex-col items-center md:items-start w-full md:w-28 shrink min-w-0">
                        <div className="text-base font-bold text-white font-mono tracking-tight">
                            <span>{self.kills}</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-red-400">{self.deaths}</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span>{self.assists}</span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                            {self.kda}:1 KDA
                        </div>
                    </div>

                    {/* CS & Vision - Fixed Width */}
                    <div className="text-xs text-slate-400 text-center md:text-left w-full md:w-28 shrink min-w-0">
                        <div className="text-slate-300">CS {self.cs} ({self.cs_per_min})</div>
                        <div className="text-red-400">P/Kill {Math.round(((self.kills + self.assists) / Math.max(1, team100.includes(self) ? team100.reduce((a, b) => a + b.kills, 0) : team200.reduce((a, b) => a + b.kills, 0))) * 100)}%</div>
                        <div>Vis {self.vision_score}</div>
                    </div>



                    {/* Items - Flexible but constrained */}
                    <div className="flex gap-1 items-center justify-center md:justify-start flex-1 min-w-0">
                        {[self.item0, self.item1, self.item2, self.item3, self.item4, self.item5].map((item, i) => {
                            const itemData = getItemData(item);
                            return (
                                <Tooltip key={i} content={itemData ? <ItemTooltip itemData={itemData} /> : null}>
                                    <div className="w-7 h-7 bg-slate-800/80 rounded overflow-hidden border border-rose-vale/20 shrink-0 cursor-help relative md:w-8 md:h-8">
                                        {item > 0 && <img src={getItemIconUrl(item)} alt={itemData?.name || ''} className="w-full h-full object-cover text-transparent" loading="lazy" />}
                                    </div>
                                </Tooltip>
                            );
                        })}
                        <Tooltip content={getItemData(self.item6) ? <ItemTooltip itemData={getItemData(self.item6)} /> : null}>
                            <div className="w-7 h-7 bg-slate-800/80 rounded-full overflow-hidden border border-rose-vale/20 ml-1 shrink-0 cursor-help relative md:w-8 md:h-8">
                                {self.item6 > 0 && <img src={getItemIconUrl(self.item6)} alt="Trinket" className="w-full h-full object-cover text-transparent" loading="lazy" />}
                            </div>
                        </Tooltip>
                    </div>
                </div>

                {/* Participants List */}
                <div className="hidden lg:flex w-56 py-1 px-2 flex-row gap-1 text-[10px] border-l border-white/10 bg-black/20 items-center">
                    <div className="flex-1 flex flex-col justify-center gap-0.5 h-full">
                        {team100.map(p => (
                            <div key={p.puuid} className="flex items-center gap-1 w-full">
                                <img
                                    src={getChampionIconUrl(p.champion_name)}
                                    className="w-3 h-3 rounded-sm shrink-0 cursor-pointer hover:ring-1 hover:ring-cyan-400 transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPlayerClick && onPlayerClick(p.riot_id);
                                    }}
                                />
                                <span
                                    className={clsx(
                                        "truncate block w-20 cursor-pointer hover:underline hover:text-cyan-400 transition-colors",
                                        p.is_self ? "font-bold text-white hover:text-cyan-300" : "text-slate-500 hover:text-cyan-400"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPlayerClick && onPlayerClick(p.riot_id);
                                    }}
                                    title="View Profile"
                                >
                                    {p.riot_id.split('#')[0]}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-0.5 h-full">
                        {team200.map(p => (
                            <div key={p.puuid} className="flex items-center gap-1 w-full">
                                <img
                                    src={getChampionIconUrl(p.champion_name)}
                                    className="w-3 h-3 rounded-sm shrink-0 cursor-pointer hover:ring-1 hover:ring-cyan-400 transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPlayerClick && onPlayerClick(p.riot_id);
                                    }}
                                />
                                <span
                                    className={clsx(
                                        "truncate block w-20 cursor-pointer hover:underline hover:text-cyan-400 transition-colors",
                                        p.is_self ? "font-bold text-white hover:text-cyan-300" : "text-slate-500 hover:text-cyan-400"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPlayerClick && onPlayerClick(p.riot_id);
                                    }}
                                    title="View Profile"
                                >
                                    {p.riot_id.split('#')[0]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions (Deep Dive / Expand) */}
                {!isExpanded && (
                    <div className="flex flex-row md:flex-col w-full h-10 md:w-8 md:h-auto border-t md:border-t-0 md:border-l border-white/10 shrink-0 self-stretch z-10">
                        {/* Deep Dive Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeepDive(match.match_id);
                            }}
                            className={clsx(
                                "relative z-10 flex-1 w-full flex items-center justify-center transition-colors border-r md:border-r md:border-t md:border-b border-white/5 rounded-bl-xl md:rounded-bl-none md:rounded-tr-xl",
                                isReviewCandidate
                                    ? "!bg-violet-600 hover:!bg-violet-500 text-white ring-1 ring-inset ring-white/20 shadow-inner animate-pulse-slow"
                                    : "bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white"
                            )}
                            title={isReviewCandidate ? "High Blame - Analyze Now" : "Deep Dive Analysis"}
                        >
                            <Microscope size={20} />
                        </button>

                        {/* Expand Button */}
                        <button
                            onClick={onExpand}
                            className={clsx(
                                "relative z-10 flex-1 w-full flex items-center justify-center transition-colors text-slate-400 hover:text-white bg-slate-800/30 hover:bg-slate-700/50 md:border-r md:border-b border-white/5 rounded-br-xl"
                            )}
                        >
                            <ChevronDown size={20} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
