import React, { useEffect, useState } from 'react';
import { getItemIconUrl, getRuneIconUrl, getItemData, getRuneData, fetchChampionData, getAbilityIconUrl, getAbilityData, getAllRunes, subscribeToData, getStatModData } from '../utils/dataDragon';
import Tooltip, { TooltipContent, ItemTooltip, AbilityTooltip, RuneTooltip, StatModTooltip } from './Tooltip';
import clsx from 'clsx';

export default function BuildAnalysis({ match, puuid }) {
    const self = match?.participants?.find(p => p.is_self);

    // Safety check: if self is not found, don't render
    if (!self) return null;

    const itemBuild = match.item_build || [];
    const skillOrder = match.skill_order || [];
    const [championDataLoaded, setChampionDataLoaded] = useState(false);

    // Subscribe to DataDragon updates (fixes slow ability/item icon loading)
    useEffect(() => {
        return subscribeToData(() => setChampionDataLoaded(prev => !prev));
    }, []);

    // Sort items by time
    const sortedItems = [...itemBuild].sort((a, b) => a.timestamp - b.timestamp);

    // Filter for purchases only
    const purchases = sortedItems.filter(i => i.type === "ITEM_PURCHASED");

    // Skill mapping
    const skillMap = { 1: 'Q', 2: 'W', 3: 'E', 4: 'R' };
    const skillColors = { 'Q': 'bg-blue-500', 'W': 'bg-green-500', 'E': 'bg-orange-500', 'R': 'bg-red-500' };

    // Build skill order grid data
    const skillLevels = { 1: [], 2: [], 3: [], 4: [] }; // Q, W, E, R
    skillOrder.forEach((skill, index) => {
        if (skill && skill.skillSlot) {
            skillLevels[skill.skillSlot].push(index + 1); // Level is index + 1
        }
    });

    // Fetch champion data for ability icons
    useEffect(() => {
        if (self?.champion_name) {
            fetchChampionData(self.champion_name).then(() => {
                setChampionDataLoaded(true);
            });
        }
    }, [self?.champion_name]);

    // Calculate Skill Priority (Max Order)
    const getSkillPriority = () => {
        const priority = [];
        const counts = { Q: 0, W: 0, E: 0, R: 0 };
        // We track when a skill hits level 5 (or 3 for R)
        const maxed = new Set();

        sortedItems.forEach(() => { }); // Dummy to keep ref if needed, but we use skillOrder

        // Iterate levels 1-18 to find max order
        for (let i = 1; i <= 18; i++) {
            if (i > skillOrder.length) break;
            const skillIdx = skillOrder[i - 1]?.skillSlot;
            if (!skillIdx) continue;
            const key = skillMap[skillIdx];
            counts[key]++;

            if (key === 'R') {
                if (counts[key] === 3 && !maxed.has(key)) { priority.push(key); maxed.add(key); }
            } else {
                if (counts[key] === 5 && !maxed.has(key)) { priority.push(key); maxed.add(key); }
            }
        }
        // Fill remaining
        ['R', 'Q', 'W', 'E'].forEach(k => { if (!maxed.has(k)) priority.push(k); });

        return priority;
    };
    const skillPriority = getSkillPriority();

    return (
        <div className="flex flex-col gap-4">
            {/* 1. Item Build Path */}
            <div className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-5 rounded-xl border border-white/10 backdrop-blur-md shadow-xl flex flex-col relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <h3 className="text-xs font-bold text-blue-300 uppercase mb-4 tracking-widest flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>
                    Item Build Path
                </h3>

                <div className="flex flex-col gap-3">
                    {purchases.length === 0 && <span className="text-slate-500 text-xs italic">No item data available</span>}
                    {(() => {
                        const groups = [];
                        let currentGroup = [];
                        purchases.forEach((item, i) => {
                            if (i === 0) { currentGroup.push(item); }
                            else {
                                const prevItem = purchases[i - 1];
                                if (item.timestamp - prevItem.timestamp <= 45000) { currentGroup.push(item); }
                                else { groups.push(currentGroup); currentGroup = [item]; }
                            }
                        });
                        if (currentGroup.length > 0) groups.push(currentGroup);

                        return (
                            <div className="flex flex-wrap gap-x-8 gap-y-4">
                                {groups.map((group, groupIdx) => (
                                    <div key={groupIdx} className="flex relative pl-3 border-l border-slate-700/50 pb-1 last:border-0 last:pb-0">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 bg-slate-800 rounded-full border border-slate-600"></div>
                                        <div className="flex flex-col gap-1 w-full relative -top-1.5">
                                            <div className="text-[10px] font-mono text-slate-500 mb-1">
                                                {Math.floor(group[0].timestamp / 60000)}m
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {group.map((item, itemIdx) => {
                                                    const itemData = getItemData(item.itemId);
                                                    return (
                                                        <Tooltip key={itemIdx} content={itemData ? <ItemTooltip itemData={itemData} /> : null}>
                                                            <div className="w-9 h-9 bg-slate-950 rounded border border-slate-700 overflow-hidden relative group/icon cursor-help hover:border-blue-400 transition-colors shadow-lg">
                                                                <img src={getItemIconUrl(item.itemId)} className="w-full h-full" alt={itemData?.name || 'Item'} />
                                                            </div>
                                                        </Tooltip>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* 2. Runes (League Client Grid Layout) */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-white/5 backdrop-blur-md shadow-lg flex flex-col hover:border-white/10 transition-colors">

                {(() => {
                    const allRunes = getAllRunes();
                    const primaryStyleId = self.perks?.styles?.[0]?.style;
                    const secondaryStyleId = self.perks?.styles?.[1]?.style;
                    const primaryTree = allRunes.find(t => t.id === primaryStyleId);
                    const secondaryTree = allRunes.find(t => t.id === secondaryStyleId);
                    const selectedRunes1 = self.perks?.styles?.[0]?.selections?.map(s => s.perk) || [];
                    const selectedRunes2 = self.perks?.styles?.[1]?.selections?.map(s => s.perk) || [];

                    if (!primaryTree) return null;

                    const shardRows = [
                        [5008, 5005, 5007], // Offense
                        [5008, 5010, 5001], // Flex
                        [5011, 5013, 5002]  // Defense
                    ];
                    const userShards = [self.perks?.statPerks?.offense, self.perks?.statPerks?.flex, self.perks?.statPerks?.defense];

                    const renderRune = (runeId, isSelected, size = "normal", isKeystone = false) => {
                        return (
                            <Tooltip key={runeId} content={<RuneTooltip runeData={getRuneData(runeId)} />}>
                                <div className={clsx(
                                    "transition-all duration-300 relative rounded-full cursor-help flex items-center justify-center",
                                    isSelected ? "opacity-100 z-10" : "opacity-20 grayscale hover:opacity-100 hover:grayscale-0"
                                )}>
                                    <img
                                        src={getRuneIconUrl(runeId)}
                                        className={clsx(
                                            "rounded-full bg-slate-950 transition-all border",
                                            isKeystone ? "w-12 h-12 p-0.5" : (size === "small" ? "w-8 h-8 p-0.5" : "w-10 h-10 p-1"),
                                            isSelected
                                                ? "border-slate-400 shadow-md scale-105"
                                                : "border-transparent bg-transparent scale-90"
                                        )}
                                        alt=""
                                    />
                                </div>
                            </Tooltip>
                        );
                    };

                    const getStatIcon = (id) => {
                        const map = { 3: 'StatModsMagicResIcon.png', 5001: 'StatModsHealthScalingIcon.png', 5002: 'StatModsArmorIcon.png', 5003: 'StatModsMagicResIcon.png', 5005: 'StatModsAttackSpeedIcon.png', 5007: 'StatModsCDRScalingIcon.png', 5008: 'StatModsAdaptiveForceIcon.png', 5010: 'StatModsMovementSpeedIcon.png', 5011: 'StatModsHealthPlusIcon.png', 5013: 'StatModsTenacityIcon.png' };
                        return map[id] ? `https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/${map[id]}` : null;
                    };

                    return (
                        <div className="flex flex-col md:flex-row gap-8 min-h-[300px]">
                            {/* LEFT: PRIMARY TREE */}
                            <div className="flex-[1.2] flex flex-col">
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center opacity-80 shadow-inner">
                                        <img src={getRuneIconUrl(primaryTree.id)} className="w-5 h-5" alt="" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-200 tracking-wide font-sans">{primaryTree.name}</span>
                                </div>

                                <div className="flex flex-col justify-between flex-1 py-2 gap-4">
                                    {/* Keystone & Slots */}
                                    {primaryTree.slots.map((slot, rowIdx) => (
                                        <div key={rowIdx} className="flex items-center justify-center gap-6">
                                            {slot.runes.map(rune => {
                                                const isSelected = selectedRunes1.includes(rune.id);
                                                return renderRune(rune.id, isSelected, "normal", rowIdx === 0);
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* DIVIDER */}
                            <div className="w-px bg-white/5 hidden md:block my-2"></div>

                            {/* RIGHT: SECONDARY & STATS */}
                            <div className="flex-1 flex flex-col">
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                                    <div className="w-6 h-6 flex items-center justify-center opacity-60">
                                        {secondaryTree && <img src={getRuneIconUrl(secondaryTree.id)} className="w-full h-full" alt="" />}
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 font-sans tracking-wide uppercase">{secondaryTree?.name || 'Secondary'}</span>
                                </div>

                                <div className="flex flex-col justify-between flex-1 gap-6">
                                    {/* Secondary Tree Rows (Skipping Keystone) */}
                                    {secondaryTree && secondaryTree.slots.slice(1).map((slot, rowIdx) => (
                                        <div key={rowIdx} className="flex items-center justify-start gap-5 pl-2">
                                            {slot.runes.map(rune => {
                                                const isSelected = selectedRunes2.includes(rune.id);
                                                // FIXED: Use normal size for secondary runes too
                                                return renderRune(rune.id, isSelected, "normal", false);
                                            })}
                                        </div>
                                    ))}

                                    {/* Shards Grid */}
                                    <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-3 pl-2">
                                        {shardRows.map((row, rowIdx) => {
                                            const selectedShardId = userShards[rowIdx];
                                            return (
                                                <div key={rowIdx} className="flex items-center gap-5">
                                                    {row.map((shardId, i) => {
                                                        const showId = (selectedShardId && !row.includes(selectedShardId) && i === 2) ? selectedShardId : shardId;
                                                        const isSelected = showId === selectedShardId;
                                                        const icon = getStatIcon(showId);

                                                        if (!icon) return <div key={i} className="w-10 h-10" />; // spacer

                                                        return (
                                                            <Tooltip key={i} content={<StatModTooltip statData={getStatModData(showId)} />}>
                                                                <div className={clsx(
                                                                    "w-10 h-10 rounded-full border flex items-center justify-center transition-all p-1",
                                                                    isSelected
                                                                        ? "bg-slate-700 border-slate-400 opacity-100 scale-105 shadow-sm"
                                                                        : "bg-transparent border-slate-800 opacity-20 grayscale border-transparent hover:opacity-100 hover:grayscale-0"
                                                                )}>
                                                                    <img src={icon} className="w-6 h-6" alt="" />
                                                                </div>
                                                            </Tooltip>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* 3. Skill Order (Polished Redesign) */}
            <div className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-5 rounded-xl border border-white/10 backdrop-blur-md shadow-xl flex flex-col relative overflow-hidden group">
                <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-2">
                    <h3 className="text-xs font-bold text-orange-300 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full shadow-[0_0_8px_rgba(251,146,60,0.8)]"></div>
                        Skill Order
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-500">Priority:</span>
                        <div className="flex gap-1">
                            {skillPriority.map((key, i) => (
                                <div key={i} className="flex items-center gap-1">
                                    <span className={clsx("font-bold", skillColors[key].replace('bg-', 'text-'))}>{key}</span>
                                    {i < skillPriority.length - 1 && <span className="text-slate-600">&gt;</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    {['Q', 'W', 'E', 'R'].map((key) => {
                        const skillSlot = Object.keys(skillMap).find(idx => skillMap[idx] === key);
                        if (!skillSlot) return null;

                        const levels = skillLevels[skillSlot] || [];
                        const abilityIconUrl = getAbilityIconUrl(self?.champion_name, key);
                        const abilityData = getAbilityData(self?.champion_name, key);
                        const isMaxFirst = skillPriority[0] === key;

                        return (
                            <div key={key} className={clsx("flex items-center gap-4 p-2 rounded-lg transition-colors", isMaxFirst ? "bg-orange-500/5 border border-orange-500/10" : "hover:bg-white/5 border border-transparent")}>
                                {/* Large Icon */}
                                <Tooltip content={abilityData ? <AbilityTooltip abilityData={abilityData} /> : `Ability ${key}`}>
                                    <div className="w-10 h-10 rounded-md border border-slate-600 overflow-hidden cursor-help shrink-0 bg-slate-950 shadow-lg relative group/icon">
                                        {abilityIconUrl ? (
                                            <img src={abilityIconUrl} className="w-full h-full group-hover/icon:scale-110 transition-transform" alt={key} />
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center font-bold text-white text-lg ${skillColors[key]}`}>{key}</div>
                                        )}
                                        <div className="absolute bottom-0 right-0 bg-slate-900/90 px-1 text-[9px] font-bold text-white border-tl-sm">{key}</div>
                                    </div>
                                </Tooltip>

                                {/* Timeline Grid */}
                                <div className="flex-1 flex gap-1 h-8">
                                    {Array.from({ length: 18 }).map((_, i) => {
                                        const level = i + 1;
                                        const isLeveled = levels.includes(level);
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group/level">
                                                <div className={clsx(
                                                    "w-full h-full rounded-sm flex items-center justify-center text-[10px] font-bold transition-all relative overflow-hidden",
                                                    isLeveled
                                                        ? `${skillColors[key]} text-white shadow shadow-${skillColors[key].replace('bg-', '')}/50`
                                                        : "bg-slate-800/20 text-slate-700 border border-slate-800"
                                                )}>
                                                    {isLeveled && <span className="z-10">{level}</span>}
                                                    {isLeveled && <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Level formatting ruler at bottom */}
                <div className="flex gap-4 pl-[56px] pr-2 mt-1">
                    <div className="flex-1 flex gap-1">
                        {Array.from({ length: 18 }).map((_, i) => (
                            <div key={i} className="flex-1 text-center text-[8px] text-slate-600 font-mono">{i + 1}</div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
