import React from 'react';
import { getChampionIconUrl, getItemIconUrl, getSpellIconUrl, getRuneIconUrl, getItemData, getSummonerSpellData, getRuneData } from '../utils/dataDragon';
import Tooltip, { ItemTooltip, RuneTooltip, SummonerSpellTooltip } from './Tooltip';
import clsx from 'clsx';

function TeamTable({ teamId, participants, isWin, maxDamage }) {
    const totalKills = participants.reduce((acc, p) => acc + p.kills, 0);
    const totalGold = participants.reduce((acc, p) => acc + p.gold_earned, 0);

    return (
        <div className="mb-4">
            {/* Header */}
            <div className={clsx(
                "flex justify-between items-center px-4 py-2 text-sm font-bold rounded-t-lg font-serif",
                isWin ? "bg-sage/20 text-sage border-b border-sage/20" : "bg-rose-vale/20 text-rose-vale border-b border-rose-vale/20"
            )}>
                <div className="flex gap-4">
                    <span>{isWin ? "Victory" : "Defeat"}</span>
                    <span className="text-cornsilk/60 font-normal font-sans">Team {teamId === 100 ? "Blue" : "Red"}</span>
                </div>
                <div className="flex gap-4 text-cornsilk/80 font-sans">
                    <span>{totalKills} Kills</span>
                    <span>{(totalGold / 1000).toFixed(1)}k Gold</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-dark-bg/40 border-x border-b border-rose-vale/20 rounded-b-lg overflow-x-auto backdrop-blur-sm">
                <table className="w-full text-left text-xs">
                    <thead className="text-cornsilk/50 border-b border-rose-vale/20">
                        <tr>
                            <th className="px-3 py-2 font-medium w-48 font-serif">Champion</th>
                            <th className="px-3 py-2 font-medium w-24 text-center font-serif">Score</th>
                            <th className="px-3 py-2 font-medium w-32 font-serif">Damage</th>
                            <th className="px-3 py-2 font-medium w-20 text-center font-serif">Wards</th>
                            <th className="px-3 py-2 font-medium w-20 text-center font-serif">CS</th>
                            <th className="px-3 py-2 font-medium w-52 font-serif">Items</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants.map(p => (
                            <tr key={p.puuid} className={clsx(
                                "border-b border-rose-vale/10 last:border-0 hover:bg-cornsilk/5 transition-colors",
                                p.is_self && "bg-rose-vale/10"
                            )}>
                                {/* Champion & Name */}
                                <td className="px-3 py-2 w-48">
                                    <div className="flex items-center gap-2">
                                        <div className="relative shrink-0">
                                            <img src={getChampionIconUrl(p.champion_name)} className="w-8 h-8 rounded border border-rose-vale/30" alt={p.champion_name} />
                                            <div className="absolute -bottom-1 -right-1 bg-dark-bg text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-rose-vale/30 text-cornsilk">
                                                18
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
                                                    <img src={getRuneIconUrl(p.perks.keystone)} className="w-3 h-3 rounded-full bg-black cursor-help" alt="Keystone" />
                                                </Tooltip>
                                            </div>
                                            <span className={clsx("truncate max-w-[100px]", p.is_self ? "text-cornsilk font-bold" : "text-cornsilk/60")}>
                                                {p.riot_id.split('#')[0]}
                                            </span>
                                        </div>
                                    </div>
                                </td>

                                {/* KDA */}
                                <td className="px-3 py-2 w-24">
                                    <div className="flex flex-col text-center w-16">
                                        <div className="text-cornsilk/90 font-medium">
                                            {p.kills}/{p.deaths}/{p.assists}
                                        </div>
                                        <div className="text-cornsilk/50">{p.kda}:1</div>
                                    </div>
                                </td>

                                {/* Damage */}
                                <td className="px-3 py-2 w-32">
                                    <div className="flex flex-col justify-center w-24 gap-1">
                                        <div className="flex items-center gap-1 text-cornsilk/60">
                                            <span className="w-8 text-right">{p.total_damage_dealt_to_champions.toLocaleString()}</span>
                                            <div className="flex-1 h-1.5 bg-dark-bg rounded-full overflow-hidden border border-rose-vale/20">
                                                <div
                                                    className="h-full bg-rose-vale rounded-full"
                                                    style={{ width: `${(p.total_damage_dealt_to_champions / maxDamage) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-cornsilk/40">
                                            <span className="w-8 text-right">{p.total_damage_taken.toLocaleString()}</span>
                                            <div className="flex-1 h-1.5 bg-dark-bg rounded-full overflow-hidden border border-rose-vale/10">
                                                <div
                                                    className="h-full bg-cornsilk/30 rounded-full"
                                                    style={{ width: `${(p.total_damage_taken / 50000) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* Wards */}
                                <td className="px-3 py-2 w-20 text-center text-cornsilk/60">
                                    <div>{p.vision_score}</div>
                                    <div className="text-[10px]">{p.wards_placed} / {p.wards_killed}</div>
                                </td>

                                {/* CS */}
                                <td className="px-3 py-2 w-20 text-center text-cornsilk/60">
                                    <div className="text-cornsilk/90">{p.cs}</div>
                                    <div className="text-[10px]">({p.cs_per_min})</div>
                                </td>

                                {/* Items */}
                                <td className="px-3 py-2 w-52">
                                    <div className="flex gap-0.5">
                                        {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map((item, i) => {
                                            const itemData = getItemData(item);
                                            return (
                                                <Tooltip key={i} content={itemData ? <ItemTooltip itemData={itemData} /> : null}>
                                                    <div className="w-6 h-6 bg-dark-bg rounded border border-rose-vale/30 overflow-hidden cursor-help">
                                                        {item > 0 && <img src={getItemIconUrl(item)} className="w-full h-full" alt={itemData?.name || 'Item'} />}
                                                    </div>
                                                </Tooltip>
                                            );
                                        })}
                                        <Tooltip content={getItemData(p.item6) ? <ItemTooltip itemData={getItemData(p.item6)} /> : null}>
                                            <div className="w-6 h-6 bg-dark-bg rounded-full border border-rose-vale/30 overflow-hidden ml-1 cursor-help">
                                                {p.item6 > 0 && <img src={getItemIconUrl(p.item6)} className="w-full h-full" alt="Trinket" />}
                                            </div>
                                        </Tooltip>
                                    </div>
                                </td>
                            </tr>
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
        <div>
            <TeamTable teamId={100} participants={team100} isWin={win100} maxDamage={maxDamage} />
            <TeamTable teamId={200} participants={team200} isWin={!win100} maxDamage={maxDamage} />
        </div>
    );
}
