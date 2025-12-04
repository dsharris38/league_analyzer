import React from 'react';
import { getChampionIconUrl, getItemIconUrl, getSpellIconUrl, getRuneIconUrl, getItemData, getSummonerSpellData, getRuneData } from '../utils/dataDragon';
import Tooltip, { ItemTooltip, RuneTooltip, SummonerSpellTooltip } from './Tooltip';
import { Clock, Trophy, Skull, Microscope } from 'lucide-react';
import clsx from 'clsx';

export default function MatchSummaryCard({ match, puuid, onExpand, onDeepDive, isReviewCandidate, reviewReason }) {
    const self = match.participants.find(p => p.is_self);
    const win = self.win;
    const durationMin = Math.floor(match.game_duration / 60);
    const durationSec = match.game_duration % 60;

    // Teams
    const team100 = match.participants.filter(p => p.team_id === 100);
    const team200 = match.participants.filter(p => p.team_id === 200);

    return (
        <div className={clsx(
            "flex flex-col md:flex-row items-stretch rounded-lg border-l-4 mb-2 shadow-sm transition-all hover:shadow-md h-auto md:h-28 relative group",
            win ? "bg-blue-900/20 border-blue-500" : "bg-red-900/20 border-red-500",
            isReviewCandidate && "ring-1 ring-purple-500/50"
        )}>
            {/* Review Candidate Badge */}
            {isReviewCandidate && (
                <div className="absolute -top-2.5 left-4 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg z-10 flex items-center gap-1">
                    <Trophy size={10} />
                    {reviewReason || "Review Recommended"}
                </div>
            )}

            {/* Game Info */}
            <div className="w-full md:w-28 p-2 flex flex-col justify-center text-xs text-slate-400 shrink-0 border-b md:border-b-0 md:border-r border-white/5">
                <div className={clsx("font-bold mb-0.5", win ? "text-blue-400" : "text-red-400")}>
                    {match.game_mode}
                </div>
                <div className="mb-0.5">{new Date(match.game_creation).toLocaleDateString()}</div>
                <div className="flex items-center gap-1 mb-1">
                    <div className={clsx("w-8 h-0.5 rounded", win ? "bg-blue-500" : "bg-red-500")}></div>
                </div>
                <div className="font-bold text-slate-300">{win ? "Victory" : "Defeat"}</div>
                <div>{durationMin}m {durationSec}s</div>

                {/* Performance Tags */}
                {match.tags && match.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {match.tags.map(tag => (
                            <span key={tag} className={clsx(
                                "text-[9px] px-1 rounded font-bold",
                                tag === "Hyper Carry" ? "bg-yellow-500/20 text-yellow-400" :
                                    tag === "Ace in Defeat" ? "bg-orange-500/20 text-orange-400" :
                                        tag === "Weak Link" ? "bg-red-500/20 text-red-400" :
                                            tag === "Stomp" ? "bg-green-500/20 text-green-400" :
                                                tag === "Passenger" ? "bg-slate-500/20 text-slate-400" :
                                                    "bg-slate-700/40 text-slate-400"
                            )}>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Player Stats */}
            <div className="flex-1 flex flex-col md:flex-row items-center px-2 md:px-4 gap-2 md:gap-0">

                {/* Champion & Spells - Fixed Width */}
                <div className="flex gap-2 items-center w-full md:w-40 shrink-0">
                    <div className="relative">
                        <img
                            src={getChampionIconUrl(self.champion_name)}
                            alt={self.champion_name}
                            className="w-12 h-12 md:w-14 md:h-14 rounded border-2 border-slate-700"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-slate-800 text-[10px] rounded-full w-5 h-5 flex items-center justify-center border border-slate-600">
                            18
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex gap-0.5">
                            <Tooltip content={<SummonerSpellTooltip spellData={getSummonerSpellData(self.summoner1Id)} />}>
                                <img src={getSpellIconUrl(self.summoner1Id)} className="w-5 h-5 rounded cursor-help" alt="Summoner 1" />
                            </Tooltip>
                            <Tooltip content={<SummonerSpellTooltip spellData={getSummonerSpellData(self.summoner2Id)} />}>
                                <img src={getSpellIconUrl(self.summoner2Id)} className="w-5 h-5 rounded cursor-help" alt="Summoner 2" />
                            </Tooltip>
                        </div>
                        <div className="flex gap-0.5">
                            <Tooltip content={<RuneTooltip runeData={getRuneData(self.perks.keystone)} />}>
                                <img src={getRuneIconUrl(self.perks.keystone)} className="w-5 h-5 rounded-full bg-black cursor-help" alt="Keystone" />
                            </Tooltip>
                            <Tooltip content={<RuneTooltip runeData={getRuneData(self.perks.sub_style)} />}>
                                <img src={getRuneIconUrl(self.perks.sub_style)} className="w-5 h-5 rounded-full bg-black p-0.5 cursor-help" alt="Secondary" />
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* KDA - Fixed Width */}
                <div className="flex flex-col items-center md:items-start w-full md:w-32 shrink-0">
                    <div className="text-base font-bold text-white">
                        <span>{self.kills}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-red-400">{self.deaths}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span>{self.assists}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                        {self.kda}:1 KDA
                    </div>
                </div>

                {/* CS & Vision - Fixed Width */}
                <div className="text-xs text-slate-400 text-center md:text-left w-full md:w-32 shrink-0">
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
                                <div className="w-7 h-7 bg-slate-800 rounded overflow-hidden border border-slate-700 shrink-0 cursor-help">
                                    {item > 0 && <img src={getItemIconUrl(item)} alt={itemData?.name || 'Item'} className="w-full h-full" />}
                                </div>
                            </Tooltip>
                        );
                    })}
                    <Tooltip content={getItemData(self.item6) ? <ItemTooltip itemData={getItemData(self.item6)} /> : null}>
                        <div className="w-7 h-7 bg-slate-800 rounded-full overflow-hidden border border-slate-700 ml-1 shrink-0 cursor-help">
                            {self.item6 > 0 && <img src={getItemIconUrl(self.item6)} alt="Trinket" className="w-full h-full" />}
                        </div>
                    </Tooltip>
                </div>
            </div>

            {/* Participants List */}
            <div className="hidden lg:flex w-56 py-1 px-2 flex-row gap-1 text-[10px] border-l border-white/5 bg-black/10 items-center">
                <div className="flex-1 flex flex-col justify-center gap-0.5 h-full">
                    {team100.map(p => (
                        <div key={p.puuid} className="flex items-center gap-1 w-full">
                            <img src={getChampionIconUrl(p.champion_name)} className="w-3 h-3 rounded-sm shrink-0" />
                            <span className={clsx("truncate block w-20", p.is_self ? "font-bold text-white" : "text-slate-400")}>
                                {p.riot_id.split('#')[0]}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex-1 flex flex-col justify-center gap-0.5 h-full">
                    {team200.map(p => (
                        <div key={p.puuid} className="flex items-center gap-1 w-full">
                            <img src={getChampionIconUrl(p.champion_name)} className="w-3 h-3 rounded-sm shrink-0" />
                            <span className={clsx("truncate block w-20", p.is_self ? "font-bold text-white" : "text-slate-400")}>
                                {p.riot_id.split('#')[0]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col border-l border-white/5">
                {/* Deep Dive Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeepDive(match.match_id);
                    }}
                    className={clsx(
                        "flex-1 w-8 flex items-center justify-center transition-colors border-b border-white/5",
                        isReviewCandidate ? "bg-purple-900/30 hover:bg-purple-800/50 text-purple-400" : "bg-slate-900/30 hover:bg-slate-800/50 text-slate-500"
                    )}
                    title="Deep Dive Analysis"
                >
                    <Microscope size={16} />
                </button>

                {/* Expand Button */}
                <button
                    onClick={onExpand}
                    className={clsx(
                        "flex-1 w-8 flex items-center justify-center transition-colors",
                        win ? "bg-blue-900/30 hover:bg-blue-800/50" : "bg-red-900/30 hover:bg-red-800/50"
                    )}
                >
                    <div className="rotate-90 text-lg font-bold text-slate-500">›</div>
                </button>
            </div>
        </div>
    );
}
