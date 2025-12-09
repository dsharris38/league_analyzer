import React from 'react';
import { getChampionIconUrl, getItemIconUrl, getSpellIconUrl, getRuneIconUrl, getItemData, getSummonerSpellData, getRuneData } from '../utils/dataDragon';
import Tooltip, { ItemTooltip, RuneTooltip, SummonerSpellTooltip } from './Tooltip';
import clsx from 'clsx';

function ParticipantRow({ participant, maxDamage, isSelf, teamId }) {
    const p = participant;
    // const isBlueTeam = teamId === 100; // Unused for now but conceptually helpful

    return (
        <tr className={clsx(
            "border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors",
            isSelf && "bg-blue-500/10"
        )}>
            {/* Champion & Name */}
            <td className="px-3 py-2 w-48">
                <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                        <img src={getChampionIconUrl(p.champion_name)} className="w-8 h-8 rounded border border-slate-600" alt={p.champion_name} />
                        <div className="absolute -bottom-1 -right-1 bg-slate-900 text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-slate-600 text-slate-200">
                            {p.champ_level}
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex gap-0.5 mb-0.5">
                            <Tooltip content={<SummonerSpellTooltip spellData={getSummonerSpellData(p.summoner1Id)} />}>
                                <img src={getSpellIconUrl(p.summoner1Id)} className="w-3 h-3 rounded cursor-help" alt="Summoner 1" />
                            </Tooltip>
                            <Tooltip content={<SummonerSpellTooltip spellData={getSummonerSpellData(p.summoner2Id)} />}>
                                <img src={getSpellIconUrl(p.summoner2Id)} className="w-3 h-3 rounded cursor-help" alt="Summoner 2" />
                            </Tooltip>
                            <Tooltip content={<RuneTooltip runeData={getRuneData(p.perks.keystone)} />}>
                                <div className="w-3 h-3 rounded-full bg-black overflow-hidden cursor-help">
                                    <img src={getRuneIconUrl(p.perks.keystone)} className="w-full h-full scale-110" alt="Keystone" />
                                </div>
                            </Tooltip>
                        </div>
                        <span className={clsx("truncate max-w-[100px] text-xs", p.is_self ? "text-white font-bold" : "text-slate-400")}>
                            {p.riot_id.split('#')[0]}
                        </span>
                    </div>
                </div>
            </td>

            {/* KDA */}
            <td className="px-3 py-2 w-24">
                <div className="flex flex-col text-center w-16">
                    <div className="text-slate-200 font-medium text-xs">
                        {p.kills}/{p.deaths}/{p.assists}
                    </div>
                    <div className="text-slate-500 text-[10px]">{p.kda}:1</div>
                </div>
            </td>

            {/* Damage */}
            <td className="px-3 py-2 w-32">
                <div className="flex flex-col justify-center w-24 gap-1">
                    <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                        <span className="w-8 text-right">{p.total_damage_dealt_to_champions.toLocaleString()}</span>
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-red-400/80 rounded-full"
                                style={{ width: `${(p.total_damage_dealt_to_champions / maxDamage) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </td>

            {/* Wards */}
            <td className="px-3 py-2 w-20 text-center text-slate-400 text-xs">
                <div>{p.vision_score}</div>
                <div className="text-[10px] text-slate-600">{p.wards_placed} / {p.wards_killed}</div>
            </td>

            {/* CS */}
            <td className="px-3 py-2 w-20 text-center text-slate-400 text-xs">
                <div className="text-slate-300">{p.cs}</div>
                <div className="text-[10px] text-slate-600">({p.cs_per_min})</div>
            </td>

            {/* Items */}
            <td className="px-3 py-2 w-52">
                <div className="flex gap-0.5">
                    {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map((item, i) => {
                        const itemData = getItemData(item);
                        return (
                            <Tooltip key={i} content={itemData ? <ItemTooltip itemData={itemData} /> : null}>
                                <div className="w-6 h-6 bg-slate-800 rounded border border-slate-700 overflow-hidden cursor-help">
                                    {item > 0 && <img src={getItemIconUrl(item)} className="w-full h-full" alt={itemData?.name || 'Item'} />}
                                </div>
                            </Tooltip>
                        );
                    })}
                    <Tooltip content={getItemData(p.item6) ? <ItemTooltip itemData={getItemData(p.item6)} /> : null}>
                        <div className="w-6 h-6 bg-slate-800 rounded-full border border-slate-700 overflow-hidden ml-1 cursor-help">
                            {p.item6 > 0 && <img src={getItemIconUrl(p.item6)} className="w-full h-full" alt="Trinket" />}
                        </div>
                    </Tooltip>
                </div>
            </td>
        </tr>
    );
}

function TeamTable({ teamId, participants, isWin, maxDamage }) {
    const totalKills = participants.reduce((acc, p) => acc + p.kills, 0);
    const totalGold = participants.reduce((acc, p) => acc + p.gold_earned, 0);

    const isBlue = teamId === 100;
    const headerBg = isBlue ? "bg-blue-900/40" : "bg-red-900/40";
    const headerBorder = isBlue ? "border-blue-500/30" : "border-red-500/30";
    const headerText = isBlue ? "text-blue-400" : "text-red-400";

    return (
        <div className="mb-4">
            {/* Header */}
            <div className={clsx(
                "flex justify-between items-center px-4 py-2 text-sm font-bold rounded-t-lg border-t border-x",
                headerBg, headerBorder, headerText
            )}>
                <div className="flex gap-4">
                    <span className={isWin ? "text-blue-300" : "text-red-300"}>{isWin ? "Victory" : "Defeat"}</span>
                    <span className="text-slate-400 font-normal">Team {isBlue ? "Blue" : "Red"}</span>
                </div>
                <div className="flex gap-4 text-slate-400 font-sans">
                    <span>{totalKills} Kills</span>
                    <span>{(totalGold / 1000).toFixed(1)}k Gold</span>
                </div>
            </div>

            {/* Table */}
            <div className={clsx("bg-slate-900/50 border-x border-b rounded-b-lg overflow-x-auto", headerBorder)}>
                <table className="w-full text-left text-xs">
                    <thead className="text-slate-500 border-b border-slate-700/50">
                        <tr>
                            <th className="px-3 py-2 font-medium w-48">Champion</th>
                            <th className="px-3 py-2 font-medium w-24 text-center">Score</th>
                            <th className="px-3 py-2 font-medium w-32">Damage</th>
                            <th className="px-3 py-2 font-medium w-20 text-center">Wards</th>
                            <th className="px-3 py-2 font-medium w-20 text-center">CS</th>
                            <th className="px-3 py-2 font-medium w-52">Items</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants.map(p => (
                            <ParticipantRow
                                key={p.puuid}
                                participant={p}
                                maxDamage={maxDamage}
                                isSelf={p.is_self}
                                teamId={teamId}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function Scoreboard({ match, puuid }) {
    const team100 = match.participants.filter(p => p.team_id === 100);
    const team200 = match.participants.filter(p => p.team_id === 200);

    const maxDamage = Math.max(...match.participants.map(p => p.total_damage_dealt_to_champions));
    const win100 = team100.some(p => p.win);

    return (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <TeamTable teamId={100} participants={team100} isWin={win100} maxDamage={maxDamage} />
            <TeamTable teamId={200} participants={team200} isWin={!win100} maxDamage={maxDamage} />
        </div>
    );
}
