import React, { useEffect, useState } from 'react';
import { getItemIconUrl, getRuneIconUrl, getItemData, getRuneData, fetchChampionData, getAbilityIconUrl, getAbilityData, getAllRunes } from '../utils/dataDragon';
import Tooltip, { TooltipContent, ItemTooltip, AbilityTooltip, RuneTooltip, StatModTooltip } from './Tooltip';
import clsx from 'clsx';

export default function BuildAnalysis({ match, puuid }) {
    const self = match?.participants?.find(p => p.is_self);

    // Safety check: if self is not found, don't render
    if (!self) return null;

    const itemBuild = match.item_build || [];
    const skillOrder = match.skill_order || [];
    const [championDataLoaded, setChampionDataLoaded] = useState(false);

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

    return (
        <div className="space-y-8">
            {/* Item Build Path */}
            <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 font-serif">Item Build Path</h3>
                <div className="flex flex-wrap gap-4 items-center bg-slate-900/40 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                    {purchases.length === 0 && <span className="text-slate-500 text-sm">No item data available</span>}
                    {(() => {
                        // Group items by time (45s window)
                        const groups = [];
                        let currentGroup = [];

                        purchases.forEach((item, i) => {
                            if (i === 0) {
                                currentGroup.push(item);
                            } else {
                                const prevItem = purchases[i - 1];
                                if (item.timestamp - prevItem.timestamp <= 45000) {
                                    currentGroup.push(item);
                                } else {
                                    groups.push(currentGroup);
                                    currentGroup = [item];
                                }
                            }
                        });
                        if (currentGroup.length > 0) groups.push(currentGroup);

                        return groups.map((group, groupIdx) => (
                            <div key={groupIdx} className="flex items-center">
                                <div className="flex gap-2 bg-slate-900 p-2 rounded border border-slate-700/50">
                                    {group.map((item, itemIdx) => {
                                        const itemData = getItemData(item.itemId);
                                        return (
                                            <div key={itemIdx} className="flex flex-col items-center gap-1">
                                                <Tooltip content={itemData ? <ItemTooltip itemData={itemData} /> : null}>
                                                    <div className="w-10 h-10 bg-slate-900 rounded border border-slate-700 overflow-hidden relative group cursor-help">
                                                        <img src={getItemIconUrl(item.itemId)} className="w-full h-full" alt={itemData?.name || 'Item'} />
                                                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white">
                                                            {Math.floor(item.timestamp / 60000)}m
                                                        </div>
                                                    </div>
                                                </Tooltip>
                                            </div>
                                        );
                                    })}
                                    <div className="text-[10px] text-slate-500 self-end mb-0.5 ml-1">
                                        {Math.floor(group[0].timestamp / 60000)}m
                                    </div>
                                </div>
                                {groupIdx < groups.length - 1 && (
                                    <div className="text-slate-600 mx-2">›</div>
                                )}
                            </div>
                        ));
                    })()}
                </div>
            </div>

            {/* Skill Order - Grid Layout */}
            <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 font-serif">Skill Order</h3>
                <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                    <div className="space-y-1">
                        {[1, 2, 3, 4].map(skillSlot => {
                            const key = skillMap[skillSlot];
                            const levels = skillLevels[skillSlot] || [];
                            const abilityIconUrl = getAbilityIconUrl(self?.champion_name, key);
                            const abilityData = getAbilityData(self?.champion_name, key);

                            return (
                                <div key={skillSlot} className="flex items-center gap-2">
                                    {/* Ability Icon */}
                                    <Tooltip content={abilityData ? <AbilityTooltip abilityData={abilityData} /> : `Ability ${key}`}>
                                        <div className="w-10 h-10 rounded border-2 border-slate-700 overflow-hidden cursor-help shrink-0 bg-slate-900">
                                            {abilityIconUrl ? (
                                                <img src={abilityIconUrl} className="w-full h-full" alt={key} />
                                            ) : (
                                                <div className={clsx(
                                                    "w-full h-full flex items-center justify-center font-bold text-white text-lg",
                                                    skillColors[key]
                                                )}>
                                                    {key}
                                                </div>
                                            )}
                                        </div>
                                    </Tooltip>

                                    {/* Level Grid */}
                                    <div className="flex gap-0.5 flex-1">
                                        {Array.from({ length: 18 }).map((_, i) => {
                                            const level = i + 1;
                                            const isLeveled = levels.includes(level);

                                            return (
                                                <Tooltip key={i} content={isLeveled ? `Level ${level}: ${key}` : null}>
                                                    <div className={clsx(
                                                        "w-7 h-7 flex items-center justify-center text-xs font-bold rounded border cursor-help",
                                                        isLeveled
                                                            ? `${skillColors[key]} text-white border-white/30 shadow-sm`
                                                            : "bg-slate-900/60 text-slate-600 border-slate-700/30"
                                                    )}>
                                                        {isLeveled ? level : ''}
                                                    </div>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Runes - Full Tree Layout */}
            <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 font-serif">Runes</h3>
                <div className="bg-slate-900/40 p-6 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex flex-col md:flex-row gap-8 md:gap-12 justify-center">

                        {/* Primary Runes */}
                        <div className="flex flex-col items-center">
                            <h4 className="text-slate-200 font-bold mb-4 text-lg tracking-wide font-serif">Primary Runes</h4>
                            {(() => {
                                const allRunes = getAllRunes();
                                const primaryStyleId = self.perks?.styles?.[0]?.style;
                                const primaryTree = allRunes.find(t => t.id === primaryStyleId);
                                const selectedRunes = self.perks?.styles?.[0]?.selections?.map(s => s.perk) || [];

                                if (!primaryTree) return <div className="text-slate-500">Loading runes...</div>;

                                return (
                                    <div className="space-y-4">
                                        {primaryTree.slots.map((slot, slotIdx) => (
                                            <div key={slotIdx} className="flex gap-4 justify-center">
                                                {slot.runes.map(rune => {
                                                    const isSelected = selectedRunes.includes(rune.id);

                                                    return (
                                                        <div key={rune.id} className="relative group">
                                                            <Tooltip content={<RuneTooltip runeData={getRuneData(rune.id)} />}>
                                                                <div className={clsx(
                                                                    "rounded-full cursor-help transition-all duration-300 w-10 h-10 md:w-12 md:h-12",
                                                                    isSelected
                                                                        ? "opacity-100 grayscale-0 ring-2 ring-blue-500 bg-slate-900 scale-110"
                                                                        : "opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
                                                                )}>
                                                                    <img
                                                                        src={getRuneIconUrl(rune.id)}
                                                                        alt={rune.name}
                                                                        className="w-full h-full p-1"
                                                                    />
                                                                </div>
                                                            </Tooltip>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Secondary Runes */}
                        <div className="flex flex-col items-center">
                            <h4 className="text-slate-200 font-bold mb-4 text-lg tracking-wide font-serif">Secondary</h4>
                            {(() => {
                                const allRunes = getAllRunes();
                                const secondaryStyleId = self.perks?.styles?.[1]?.style;
                                const secondaryTree = allRunes.find(t => t.id === secondaryStyleId);
                                const selectedRunes = self.perks?.styles?.[1]?.selections?.map(s => s.perk) || [];

                                if (!secondaryTree) return null;

                                return (
                                    <div className="space-y-4 mt-2">
                                        {/* Render all slots (1-3) for secondary tree */}
                                        {secondaryTree.slots.slice(1).map((slot, slotIdx) => (
                                            <div key={slotIdx} className="flex gap-4 justify-center">
                                                {slot.runes.map(rune => {
                                                    const isSelected = selectedRunes.includes(rune.id);

                                                    return (
                                                        <div key={rune.id} className="relative group">
                                                            <Tooltip content={<RuneTooltip runeData={getRuneData(rune.id)} />}>
                                                                <div className={clsx(
                                                                    "w-10 h-10 md:w-12 md:h-12 rounded-full cursor-help transition-all duration-300",
                                                                    isSelected
                                                                        ? "opacity-100 grayscale-0 ring-2 ring-blue-500 bg-slate-900 scale-110"
                                                                        : "opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
                                                                )}>
                                                                    <img
                                                                        src={getRuneIconUrl(rune.id)}
                                                                        alt={rune.name}
                                                                        className="w-full h-full p-1"
                                                                    />
                                                                </div>
                                                            </Tooltip>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Stat Mods */}
                        <div className="flex flex-col items-center">
                            <h4 className="text-slate-200 font-bold mb-4 text-lg tracking-wide font-serif">Stat Mods</h4>
                            <div className="space-y-3 mt-2">
                                {(() => {
                                    const statRows = [
                                        [5008, 5005, 5007], // Offense: Adaptive, Attack Speed, Haste
                                        [5008, 5010, 5001], // Flex: Adaptive, Move Speed, Health Scaling
                                        [5011, 5013, 5001]  // Defense: Health, Tenacity, Health Scaling
                                    ];

                                    const selectedStats = [
                                        self.perks?.statPerks?.offense,
                                        self.perks?.statPerks?.flex,
                                        self.perks?.statPerks?.defense
                                    ];

                                    return statRows.map((row, rowIdx) => (
                                        <div key={rowIdx} className="flex gap-3 justify-center">
                                            {row.map((statId, colIdx) => {
                                                const isSelected = selectedStats[rowIdx] === statId;

                                                // Map stat IDs to icon filenames
                                                const getStatIcon = (id) => {
                                                    const map = {
                                                        5001: 'StatModsHealthScalingIcon.png',
                                                        5002: 'StatModsArmorIcon.png',
                                                        5003: 'StatModsMagicResIcon.png',
                                                        5005: 'StatModsAttackSpeedIcon.png',
                                                        5007: 'StatModsCDRScalingIcon.png',
                                                        5008: 'StatModsAdaptiveForceIcon.png',
                                                        5010: 'StatModsMovementSpeedIcon.png',
                                                        5011: 'StatModsHealthPlusIcon.png',
                                                        5013: 'StatModsTenacityIcon.png'
                                                    };
                                                    return map[id] ? `https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/${map[id]}` : '';
                                                };

                                                const statDescriptions = {
                                                    5001: { name: 'Health Scaling', description: '+10-180 Health (based on level)' },
                                                    5002: { name: 'Armor', description: '+6 Armor' },
                                                    5003: { name: 'Magic Resist', description: '+8 Magic Resist' },
                                                    5005: { name: 'Attack Speed', description: '+10% Attack Speed' },
                                                    5007: { name: 'Ability Haste', description: '+8 Ability Haste' },
                                                    5008: { name: 'Adaptive Force', description: '+9 Adaptive Force' },
                                                    5010: { name: 'Movement Speed', description: '+2% Movement Speed' },
                                                    5011: { name: 'Health', description: '+65 Health' },
                                                    5013: { name: 'Tenacity', description: '+10% Tenacity and Slow Resist' }
                                                };

                                                const statData = statDescriptions[statId] || { name: 'Stat Mod', description: 'Unknown Stat Mod' };

                                                return (
                                                    <Tooltip key={colIdx} content={<StatModTooltip statData={statData} />}>
                                                        <div className={clsx(
                                                            "w-10 h-10 md:w-12 md:h-12 rounded-full border border-slate-700/50 flex items-center justify-center transition-all duration-300",
                                                            isSelected
                                                                ? "bg-slate-900 border-blue-500 opacity-100"
                                                                : "bg-transparent border-transparent opacity-30 grayscale"
                                                        )}>
                                                            <img
                                                                src={getStatIcon(statId)}
                                                                alt={statData.name}
                                                                className="w-full h-full p-2"
                                                            />
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
