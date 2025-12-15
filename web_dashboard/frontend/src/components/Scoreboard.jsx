import React from 'react';
import { getChampionIconUrl, getItemIconUrl, getSpellIconUrl, getRuneIconUrl, getItemData, getSummonerSpellData, getRuneData } from '../utils/dataDragon';
import Tooltip, { ItemTooltip, RuneTooltip, SummonerSpellTooltip } from './Tooltip';
import clsx from 'clsx';
import { Skull } from 'lucide-react';

function ParticipantRow({ participant, maxDamage, isSelf, teamId, onPlayerClick }) {
    const p = participant;

    return (
        <tr className={clsx(
            "border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group",
            isSelf && "bg-blue-500/10 shadow-[inset_3px_0_0_0_rgba(96,165,250,0.6)]"
        )}>
            {/* Champion & Name */}
            <td className="px-2 py-1 w-48">
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                        <img
                            src={getChampionIconUrl(p.champion_name)}
                            className={clsx(
                                "w-10 h-10 rounded-lg border cursor-pointer transition-all text-transparent",
                                isSelf ? "border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.3)]" : "border-slate-600 group-hover:border-slate-400"
                            )}
                            alt={p.champion_name}
                            loading="lazy"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPlayerClick && onPlayerClick(p.riot_id);
                            }}
                        />
                        <div className="absolute -bottom-1 -right-1 bg-slate-900 text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-slate-600 text-slate-200 shadow-sm font-bold">
                            {p.champ_level}
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex gap-1 mb-1">
                            <Tooltip content={<SummonerSpellTooltip spellData={getSummonerSpellData(p.summoner1Id)} />}>
                                <img src={getSpellIconUrl(p.summoner1Id)} className="w-4 h-4 rounded opacity-90 hover:opacity-100 cursor-help text-transparent" alt="Summoner 1" loading="lazy" />
                            </Tooltip>
                            <Tooltip content={<SummonerSpellTooltip spellData={getSummonerSpellData(p.summoner2Id)} />}>
                                <img src={getSpellIconUrl(p.summoner2Id)} className="w-4 h-4 rounded opacity-90 hover:opacity-100 cursor-help text-transparent" alt="Summoner 2" loading="lazy" />
                            </Tooltip>
                            <div className="w-[1px] h-4 bg-slate-700 mx-0.5"></div>
                            <Tooltip content={<RuneTooltip runeData={getRuneData(p.perks.keystone)} />}>
                                <div className="w-4 h-4 rounded-full bg-black/50 overflow-hidden cursor-help">
                                    <img src={getRuneIconUrl(p.perks.keystone)} className="w-full h-full scale-110 opacity-90 hover:opacity-100 text-transparent" alt="Keystone" loading="lazy" />
                                </div>
                            </Tooltip>
                        </div>
                        <span
                            className={clsx(
                                "truncate text-xs font-semibold cursor-pointer hover:underline transition-colors tracking-tight",
                                p.is_self ? "text-cyan-300" : "text-slate-200 hover:text-white"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onPlayerClick && onPlayerClick(p.riot_id);
                            }}
                            title={p.riot_id}
                        >
                            {p.riot_id.split('#')[0]}
                        </span>
                    </div>
                </div>
            </td>

            {/* KDA */}
            <td className="px-2 py-1 text-center w-24">
                <div className="flex flex-col items-center">
                    <div className="font-bold text-[13px] whitespace-nowrap tracking-wide">
                        <span className="text-slate-200">{p.kills}</span>
                        <span className="text-slate-600 mx-0.5">/</span>
                        <span className="text-red-400">{p.deaths}</span>
                        <span className="text-slate-600 mx-0.5">/</span>
                        <span className="text-slate-200">{p.assists}</span>
                    </div>
                    <div className={clsx("text-[10px] font-bold mt-0.5",
                        p.kda > 5 ? "text-orange-400 text-glow" :
                            p.kda > 3 ? "text-blue-300" : "text-slate-500"
                    )}>
                        {p.kda}:1
                    </div>
                </div>
            </td>

            {/* Damage - Fluid Width */}
            <td className="px-2 py-1">
                <div className="flex flex-col justify-center w-full gap-1">
                    <div className="flex items-end gap-2 text-[11px]">
                        <span className="text-slate-300 font-mono font-medium">{p.total_damage_dealt_to_champions.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                            style={{ width: `${(p.total_damage_dealt_to_champions / maxDamage) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </td>

            {/* Vis */}
            <td className="px-2 py-1 text-center text-[11px] w-14">
                <div className="text-slate-300 font-bold">{p.vision_score}</div>
                <div className="text-slate-600 text-[10px]">{p.wards_placed} / {p.wards_killed}</div>
            </td>

            {/* CS */}
            <td className="px-2 py-1 text-center text-[11px] w-14">
                <div className="text-slate-300 font-bold">{p.cs}</div>
                <div className="text-slate-500 text-[10px]">({p.cs_per_min})</div>
            </td>

            {/* Items */}
            <td className="px-2 py-1 w-72">
                <div className="flex flex-wrap gap-1 justify-end md:justify-start">
                    {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map((item, i) => {
                        const itemData = getItemData(item);
                        return (
                            <Tooltip key={i} content={itemData ? <ItemTooltip itemData={itemData} /> : null}>
                                <div className={clsx(
                                    "w-8 h-8 rounded border overflow-hidden cursor-help transition-colors",
                                    item > 0 ? "border-slate-700 bg-slate-900" : "border-slate-800 bg-slate-900/50"
                                )}>
                                    {item > 0 && <img src={getItemIconUrl(item)} className="w-full h-full text-transparent" alt={itemData?.name || 'Item'} />}
                                </div>
                            </Tooltip>
                        );
                    })}
                    <div className="w-[1px] h-8 bg-slate-800 mx-1"></div>
                    <Tooltip content={getItemData(p.item6) ? <ItemTooltip itemData={getItemData(p.item6)} /> : null}>
                        <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-900 overflow-hidden cursor-help">
                            {p.item6 > 0 && <img src={getItemIconUrl(p.item6)} className="w-full h-full text-transparent" alt="Trinket" />}
                        </div>
                    </Tooltip>
                </div>
            </td>
        </tr>
    );
}

function TeamTable({ teamId, participants, isWin, maxDamage, onPlayerClick }) {
    const totalKills = participants.reduce((acc, p) => acc + p.kills, 0);
    const totalGold = participants.reduce((acc, p) => acc + p.gold_earned, 0);

    const isBlue = teamId === 100;

    // Theme Colors
    const themeColor = isBlue ? "blue" : "red";
    const headerGradient = isBlue
        ? "bg-gradient-to-r from-blue-900/40 via-blue-900/10 to-transparent border-t-blue-500/30"
        : "bg-gradient-to-r from-red-900/40 via-red-900/10 to-transparent border-t-red-500/30";

    const labelColor = isBlue ? "text-blue-300" : "text-red-300";
    const subColor = isBlue ? "text-blue-400/60" : "text-red-400/60";

    return (
        <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg">
            {/* Header */}
            <div className={clsx("flex justify-between items-center px-4 py-2 border-t border-x border-white/5", headerGradient)}>
                <div className="flex items-center gap-3">
                    <span className={clsx("font-bold text-sm uppercase tracking-wider", isWin ? labelColor : "text-slate-400")}>
                        {isWin ? "Victory" : "Defeat"}
                    </span>
                    <span className={clsx("text-xs font-mono uppercase tracking-widest opacity-60", labelColor)}>
                        {isBlue ? "Blue Team" : "Red Team"}
                    </span>
                </div>
                <div className="flex gap-6 text-xs font-mono font-medium">
                    <div className="flex items-center gap-1.5">
                        <Skull size={12} className={labelColor} />
                        <span className="text-slate-300">{totalKills}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className={subColor}>GOLD</span>
                        <span className="text-slate-300">{(totalGold / 1000).toFixed(1)}k</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs table-fixed">
                    <thead className="bg-slate-950/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                            <th className="px-2 py-1 font-medium w-48">Champion</th>
                            <th className="px-2 py-1 font-medium text-center w-24">KDA</th>
                            <th className="px-2 py-1 font-medium">Damage</th>
                            <th className="px-2 py-1 font-medium text-center w-14">Vis</th>
                            <th className="px-2 py-1 font-medium text-center w-14">CS</th>
                            <th className="px-2 py-1 font-medium w-72">Items</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {participants.map(p => (
                            <ParticipantRow
                                key={p.puuid}
                                participant={p}
                                maxDamage={maxDamage}
                                isSelf={p.is_self}
                                teamId={teamId}
                                onPlayerClick={onPlayerClick}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function Scoreboard({ match, puuid, onPlayerClick }) {
    const team100 = match.participants.filter(p => p.team_id === 100);
    const team200 = match.participants.filter(p => p.team_id === 200);

    const maxDamage = Math.max(...match.participants.map(p => p.total_damage_dealt_to_champions));
    const win100 = team100.some(p => p.win);

    return (
        <div className="mt-4 grid grid-cols-1 gap-6">
            <TeamTable teamId={100} participants={team100} isWin={win100} maxDamage={maxDamage} onPlayerClick={onPlayerClick} />
            <TeamTable teamId={200} participants={team200} isWin={!win100} maxDamage={maxDamage} onPlayerClick={onPlayerClick} />
        </div>
    );
}
