import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getItemIconUrl } from '../utils/dataDragon';

export default function Tooltip({ content, children, className = '' }) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (isVisible && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();

            // Calculate position to keep tooltip on screen
            let top = rect.top;
            let left = rect.left + rect.width / 2;

            setPosition({ top, left });
        }
    }, [isVisible]);

    if (!content) {
        return <>{children}</>;
    }

    return (
        <>
            <div
                ref={wrapperRef}
                className={`inline-block ${className}`}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    className="fixed pointer-events-none"
                    style={{
                        top: `${position.top}px`,
                        left: `${position.left}px`,
                        transform: 'translate(-50%, calc(-100% - 12px))',
                        zIndex: 99999
                    }}
                >
                    <div className="bg-slate-900 border border-slate-600 rounded-sm shadow-[0_0_10px_rgba(0,0,0,0.8)] p-0 min-w-[300px] max-w-[350px] text-[#f0e6d2]">
                        {/* Header Border Line */}
                        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#c8aa6e] to-transparent opacity-50 mb-1"></div>

                        <div className="p-3">
                            {content}
                        </div>

                        {/* Footer Border Line */}
                        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#c8aa6e] to-transparent opacity-50 mt-1"></div>
                    </div>

                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
                        <div className="border-[6px] border-transparent border-t-[#785a28]"></div>
                        <div className="border-[6px] border-transparent border-t-[#010a13] -mt-[13px]"></div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

// Helper component for formatted tooltip content (Legacy support)
export function TooltipContent({ title, description, stats }) {
    const cleanDescription = description?.replace(/<[^>]*>/g, '') || '';

    return (
        <div className="space-y-2">
            {title && <div className="font-bold text-cornsilk">{title}</div>}
            {cleanDescription && (
                <div className="text-[#a09b8c] text-xs leading-relaxed">
                    {cleanDescription}
                </div>
            )}
            {stats && (
                <div className="text-[#a09b8c] text-xs border-t border-[#1e2328] pt-2">
                    {stats}
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// Specific Tooltip Components
// ----------------------------------------------------------------------

export function ItemTooltip({ itemData }) {
    if (!itemData) return null;

    // Meraki (shop.prices.total) vs Riot (gold.total)
    const price = itemData.shop?.prices?.total ?? itemData.gold?.total ?? 0;
    const stats = itemData.stats || {};

    // Meraki provides ID directly. Riot provides image.full.
    // If we have an ID, we can get the icon URL.
    const itemId = itemData.id || itemData.image?.full?.replace(/\.png$/, '');
    const iconUrl = itemId ? getItemIconUrl(itemId) : '';

    // Meraki provides `simpleDescription` which is cleaner HTML.
    const rawDescription = itemData.simpleDescription || itemData.description;

    return (
        <div className="space-y-3 font-sans">
            {/* Header with Icon */}
            <div className="flex gap-3">
                {/* Icon */}
                {iconUrl && (
                    <div className="w-12 h-12 border border-[#785a28] shrink-0">
                        <img src={iconUrl} alt={itemData.name} className="w-full h-full" />
                    </div>
                )}

                {/* Title & Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="text-[#f0e6d2] font-bold text-lg tracking-wide leading-tight">{itemData.name}</div>
                        {price > 0 && (
                            <div className="flex items-center gap-1 text-[#c8aa6e] text-sm font-bold shrink-0">
                                <span className="text-[#ffd700]">⬢</span>
                                <span>{price}</span>
                            </div>
                        )}
                    </div>
                    <div className="text-[#a09b8c] text-sm mt-0.5">
                        {itemData.plaintext || (itemData.tags && itemData.tags.join(', '))}
                    </div>
                </div>
            </div>

            {/* Stats */}
            {Object.keys(stats).length > 0 && (
                <div className="space-y-1 border-t border-[#1e2328] pt-2">
                    {Object.entries(stats)
                        .filter(([_, value]) => !isStatZero(value))
                        .map(([key, value]) => {
                            const { color, name } = getStatDisplay(key);
                            const formattedValue = formatStatValue(key, value);
                            return (
                                <div key={key} className="text-sm flex items-center gap-2">
                                    <span className={`${color} font-medium`}>{formattedValue}</span>
                                    <span className="text-[#a09b8c]">{name}</span>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* Description */}
            {rawDescription && (
                <div className="text-sm leading-relaxed text-[#a09b8c] border-t border-[#1e2328] pt-2 mt-2">
                    <FormattedDescription description={filterStatsFromDescription(rawDescription, stats)} />
                </div>
            )}
        </div>
    );
}

function filterStatsFromDescription(description, stats) {
    if (!description) return '';

    // 1. Extract stats block
    const statsMatch = description.match(/<stats>([\s\S]*?)<\/stats>/i);
    if (!statsMatch) return description;

    const statsContent = statsMatch[1];
    let lines = statsContent.split(/<br\s*\/?>/i);

    // 2. Filter lines
    lines = lines.filter(line => {
        const cleanLine = line.replace(/<[^>]+>/g, '').trim();
        if (!cleanLine) return false;

        // Check if this line matches any known stat we are already displaying
        // Normalize checking against Meraki camelCase keys too
        if (cleanLine.includes('Attack Damage') && (stats.FlatPhysicalDamageMod || stats.flatPhysicalDamageMod)) return false;
        if (cleanLine.includes('Critical Strike Chance') && (stats.FlatCritChanceMod || stats.flatCritChanceMod)) return false;
        if (cleanLine.includes('Ability Power') && (stats.FlatMagicDamageMod || stats.flatMagicDamageMod)) return false;
        if (cleanLine.match(/Health(?! Regen)/) && (stats.FlatHPPoolMod || stats.flatHPPoolMod)) return false;
        if (cleanLine.match(/Mana(?! Regen)/) && (stats.FlatMPPoolMod || stats.flatMPPoolMod)) return false;
        if (cleanLine.includes('Armor') && (stats.FlatArmorMod || stats.flatArmorMod)) return false;
        if (cleanLine.includes('Magic Resist') && (stats.FlatSpellBlockMod || stats.flatSpellBlockMod)) return false;
        if (cleanLine.includes('Attack Speed') && (stats.PercentAttackSpeedMod || stats.percentAttackSpeedMod)) return false;
        if ((cleanLine.includes('Move Speed') || cleanLine.includes('Movement Speed')) && (stats.PercentMovementSpeedMod || stats.FlatMovementSpeedMod || stats.flatMovementSpeedMod)) return false;
        if (cleanLine.includes('Health Regen') && (stats.FlatHPRegenMod || stats.flatHPRegenMod)) return false;
        if (cleanLine.includes('Mana Regen') && (stats.FlatMPRegenMod || stats.flatMPRegenMod)) return false;
        if (cleanLine.includes('Life Steal') && (stats.PercentLifeStealMod || stats.percentLifeStealMod)) return false;
        if (cleanLine.includes('Ability Haste') && (stats.AbilityHaste || stats.abilityHaste)) return false;
        if (cleanLine.includes('Omnivamp') && (stats.Omnivamp || stats.omnivamp)) return false;
        if (cleanLine.includes('Lethality') && (stats.Lethality || stats.lethality)) return false;

        return true; // Keep unique stats (e.g. Crit Damage, Tenacity)
    });

    // 3. Reconstruct
    if (lines.length === 0) {
        return description.replace(/<stats>[\s\S]*?<\/stats>/i, '');
    } else {
        const newStatsBlock = `<stats>${lines.join('<br>')}</stats>`;
        return description.replace(/<stats>[\s\S]*?<\/stats>/i, newStatsBlock);
    }
}

export function RuneTooltip({ runeData }) {
    if (!runeData) return null;

    return (
        <div className="space-y-3 font-sans">
            {/* Header */}
            <div className="flex items-center gap-3">
                {runeData.icon && (
                    <img
                        src={`https://ddragon.leagueoflegends.com/cdn/img/${runeData.icon}`}
                        alt={runeData.name}
                        className="w-10 h-10"
                    />
                )}
                <div className="text-[#f0e6d2] font-bold text-lg tracking-wide">{runeData.name}</div>
            </div>

            {/* Description */}
            <div className="text-sm leading-relaxed text-[#a09b8c] border-t border-[#1e2328] pt-2">
                <FormattedDescription description={runeData.description} />
            </div>
        </div>
    );
}

export function StatModTooltip({ statData }) {
    if (!statData) return null;

    return (
        <div className="space-y-3 font-sans">
            {/* Header */}
            <div className="text-cornsilk font-bold text-lg tracking-wide">{statData.name}</div>

            {/* Description */}
            <div className="text-sm leading-relaxed text-[#a09b8c] border-t border-[#1e2328] pt-2">
                {statData.description}
            </div>
        </div>
    );
}

export function SummonerSpellTooltip({ spellData }) {
    if (!spellData) return null;

    return (
        <div className="space-y-3 font-sans">
            {/* Header */}
            <div className="space-y-1">
                <div className="text-[#f0e6d2] font-bold text-lg tracking-wide">{spellData.name}</div>
                <div className="text-[#a09b8c] text-sm">
                    Summoner Level {spellData.summonerLevel || 1}
                </div>
            </div>

            {/* Cooldown */}
            {spellData.cooldownBurn && (
                <div className="text-[#a09b8c] text-sm">
                    Cooldown: <span className="text-white">{spellData.cooldownBurn}s</span>
                </div>
            )}

            {/* Description */}
            <div className="text-sm leading-relaxed text-[#a09b8c] border-t border-[#1e2328] pt-2">
                <FormattedDescription description={spellData.description} />
            </div>
        </div>
    );
}

export function AbilityTooltip({ abilityData }) {
    if (!abilityData) return null;

    return (
        <div className="space-y-3 font-sans">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="text-[#f0e6d2] font-bold text-lg tracking-wide">{abilityData.name}</div>
                {abilityData.hotkey && (
                    <div className="text-[#5c5b57] font-bold text-sm bg-[#1e2328] px-2 py-0.5 rounded">
                        {abilityData.hotkey}
                    </div>
                )}
            </div>

            {/* Cost & Cooldown */}
            <div className="flex gap-4 text-sm text-[#a09b8c]">
                {abilityData.cost && abilityData.cost !== '0' && (
                    <div>
                        Cost: <span className="text-white">{abilityData.cost === 'No Cost' ? 'None' : abilityData.cost}</span>
                    </div>
                )}
                {abilityData.cooldown && (
                    <div>
                        Cooldown: <span className="text-white">{abilityData.cooldown}s</span>
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="text-sm leading-relaxed text-[#a09b8c] border-t border-[#1e2328] pt-2">
                <FormattedDescription description={abilityData.description} />
            </div>
        </div>
    );
}

export function PassiveTooltip({ passiveData }) {
    if (!passiveData) return null;

    return (
        <div className="space-y-3 font-sans">
            <div className="text-[#f0e6d2] font-bold text-lg tracking-wide">{passiveData.name}</div>
            <div className="text-[#c8aa6e] text-xs uppercase tracking-wider font-bold">Passive</div>

            <div className="text-sm leading-relaxed text-[#a09b8c] border-t border-[#1e2328] pt-2">
                <FormattedDescription description={passiveData.description} />
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// HTML Parsing & Formatting
// ----------------------------------------------------------------------

function FormattedDescription({ description }) {
    if (!description) return null;

    // 1. Clean up common HTML entities and tags
    let text = description
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/<br\s*\/?>/gi, '\n');

    // 2. Handle specific tags like <active>, <passive>, <consumable>
    // We'll replace them with styled spans or just clean text with headers

    // Split by newlines to handle blocks
    const lines = text.split('\n');

    return (
        <div className="space-y-2">
            {lines.map((line, i) => {
                if (!line.trim()) return null;
                return <div key={i}>{parseLine(line)}</div>;
            })}
        </div>
    );
}

function parseLine(line) {
    // Check for special start tags
    if (line.toLowerCase().includes('<active>')) {
        return (
            <span>
                <span className="text-[#f0e6d2] font-bold uppercase text-xs tracking-wider">Active - </span>
                {colorizeText(line.replace(/<[^>]+>/g, ''))}
            </span>
        );
    }
    if (line.toLowerCase().includes('<passive>')) {
        return (
            <span>
                <span className="text-[#f0e6d2] font-bold uppercase text-xs tracking-wider">Passive - </span>
                {colorizeText(line.replace(/<[^>]+>/g, ''))}
            </span>
        );
    }

    // Regular line parsing
    // Remove remaining tags but keep content
    const cleanLine = line.replace(/<[^>]+>/g, '');
    return colorizeText(cleanLine);
}

function colorizeText(text) {
    const segments = [];
    let remaining = text;
    let key = 0;

    const patterns = [
        // Named effects (bold white)
        { regex: /\b([A-Z][a-z]+(?:'s)?)\s*:/g, className: 'text-[#f0e6d2] font-bold' },

        // Damage Types
        { regex: /(\d+(?:\/\d+)*)\s*\(\+\d+%?\s*(?:bonus\s+)?AD\)\s*(physical damage)/gi, className: 'text-[#ff8c00]' }, // Orange
        { regex: /(\d+(?:\/\d+)*)\s*\(\+\d+%?\s*AP\)\s*(magic damage)/gi, className: 'text-[#00bfff]' }, // Cyan
        { regex: /(\d+(?:\/\d+)*)\s*(physical damage)/gi, className: 'text-[#ff8c00]' },
        { regex: /(\d+(?:\/\d+)*)\s*(magic damage)/gi, className: 'text-[#00bfff]' },
        { regex: /(true damage)/gi, className: 'text-[#ffffff]' }, // White for true damage

        // Scalings & Ranges (Meraki uses " : " for level scaling)
        { regex: /\(\+(\d+%?)\s*AP\)/gi, className: 'text-[#ae5bf0]' }, // Purple
        { regex: /\(\+(\d+%?)\s*(?:bonus\s+)?AD\)/gi, className: 'text-[#ff8c00]' }, // Orange
        { regex: /(\d+(?:(?:\s*:\s*|\/)\d+)+)/g, className: 'text-[#f0e6d2] font-semibold' }, // "10 : 20" or "10/20" white-ish

        // Stats
        { regex: /\b(\d+%?)\s*(Health|HP)\b/gi, className: 'text-[#1dc451]' }, // Green
        { regex: /\b(\d+%?)\s*Armor\b/gi, className: 'text-[#f5d94e]' }, // Yellow
        { regex: /\b(Magic Resist|MR)\b/gi, className: 'text-[#87cefa]' }, // Light Blue
        { regex: /\b(\d+%?)\s*Mana\b/gi, className: 'text-[#1a78ff]' }, // Blue

        // Keywords
        { regex: /\b(Stasis|Invulnerable|Untargetable|Vulnerable|Slow(?:s|ed)?|Stun(?:s|ned)?|Root(?:s|ed)?)\b/gi, className: 'text-[#f0e6d2] font-bold' },
    ];

    while (remaining) {
        let earliestMatch = null;
        let earliestPattern = null;

        for (const pattern of patterns) {
            const match = new RegExp(pattern.regex).exec(remaining);
            if (match && (!earliestMatch || match.index < earliestMatch.index)) {
                earliestMatch = match;
                earliestPattern = pattern;
            }
        }

        if (!earliestMatch) {
            segments.push(<span key={key++} className="text-[#a09b8c]">{remaining}</span>);
            break;
        }

        if (earliestMatch.index > 0) {
            segments.push(
                <span key={key++} className="text-[#a09b8c]">
                    {remaining.substring(0, earliestMatch.index)}
                </span>
            );
        }

        segments.push(
            <span key={key++} className={earliestPattern.className}>
                {earliestMatch[0]}
            </span>
        );

        remaining = remaining.substring(earliestMatch.index + earliestMatch[0].length);
    }

    return segments;
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function getStatDisplay(key) {
    const statMap = {
        // Health
        'FlatHPPoolMod': { color: 'text-[#1dc451]', name: 'Health' },
        'flatHPPoolMod': { color: 'text-[#1dc451]', name: 'Health' },
        'health': { color: 'text-[#1dc451]', name: 'Health' },

        // Mana
        'FlatMPPoolMod': { color: 'text-[#1a78ff]', name: 'Mana' },
        'flatMPPoolMod': { color: 'text-[#1a78ff]', name: 'Mana' },
        'mana': { color: 'text-[#1a78ff]', name: 'Mana' },

        // Armor
        'FlatArmorMod': { color: 'text-[#f5d94e]', name: 'Armor' },
        'flatArmorMod': { color: 'text-[#f5d94e]', name: 'Armor' },
        'armor': { color: 'text-[#f5d94e]', name: 'Armor' },

        // MR
        'FlatSpellBlockMod': { color: 'text-[#87cefa]', name: 'Magic Resist' },
        'flatSpellBlockMod': { color: 'text-[#87cefa]', name: 'Magic Resist' },
        'magicResistance': { color: 'text-[#87cefa]', name: 'Magic Resist' },
        'magicResist': { color: 'text-[#87cefa]', name: 'Magic Resist' },

        // AD
        'FlatPhysicalDamageMod': { color: 'text-[#ff8c00]', name: 'Attack Damage' },
        'flatPhysicalDamageMod': { color: 'text-[#ff8c00]', name: 'Attack Damage' },
        'attackDamage': { color: 'text-[#ff8c00]', name: 'Attack Damage' },

        // AP
        'FlatMagicDamageMod': { color: 'text-[#ae5bf0]', name: 'Ability Power' },
        'flatMagicDamageMod': { color: 'text-[#ae5bf0]', name: 'Ability Power' },
        'abilityPower': { color: 'text-[#ae5bf0]', name: 'Ability Power' },

        // AS
        'PercentAttackSpeedMod': { color: 'text-[#f5d94e]', name: 'Attack Speed' },
        'percentAttackSpeedMod': { color: 'text-[#f5d94e]', name: 'Attack Speed' },
        'attackSpeed': { color: 'text-[#f5d94e]', name: 'Attack Speed' },

        // MS
        'PercentMovementSpeedMod': { color: 'text-[#f0e6d2]', name: 'Move Speed' },
        'percentMovementSpeedMod': { color: 'text-[#f0e6d2]', name: 'Move Speed' },
        'movespeed': { color: 'text-[#f0e6d2]', name: 'Move Speed' },
        'movementSpeed': { color: 'text-[#f0e6d2]', name: 'Move Speed' },

        // Crit
        'FlatCritChanceMod': { color: 'text-[#ff4500]', name: 'Crit Chance' },
        'flatCritChanceMod': { color: 'text-[#ff4500]', name: 'Crit Chance' },
        'criticalStrikeChance': { color: 'text-[#ff4500]', name: 'Crit Chance' },

        // Life Steal
        'PercentLifeStealMod': { color: 'text-[#ff4500]', name: 'Life Steal' },
        'percentLifeStealMod': { color: 'text-[#ff4500]', name: 'Life Steal' },
        'lifesteal': { color: 'text-[#ff4500]', name: 'Life Steal' },

        // Regen
        'FlatHPRegenMod': { color: 'text-[#1dc451]', name: 'Base Health Regen' },
        'flatHPRegenMod': { color: 'text-[#1dc451]', name: 'Base Health Regen' },
        'healthRegen': { color: 'text-[#1dc451]', name: 'Health Regen' },

        'FlatMPRegenMod': { color: 'text-[#1a78ff]', name: 'Base Mana Regen' },
        'flatMPRegenMod': { color: 'text-[#1a78ff]', name: 'Base Mana Regen' },
        'manaRegen': { color: 'text-[#1a78ff]', name: 'Mana Regen' },

        // New / Other
        'abilityHaste': { color: 'text-[#f0e6d2]', name: 'Ability Haste' },
        'omnivamp': { color: 'text-[#ff4500]', name: 'Omnivamp' },
        'lethality': { color: 'text-[#ff4500]', name: 'Lethality' },
        'tenacity': { color: 'text-[#f0e6d2]', name: 'Tenacity' },
        'magicPenetration': { color: 'text-[#87cefa]', name: 'Magic Penetration' },
        'armorPenetration': { color: 'text-[#ff8c00]', name: 'Armor Penetration' },
        'cooldownReduction': { color: 'text-[#f0e6d2]', name: 'Cooldown Reduction' },
        'goldPer10': { color: 'text-[#e6ac00]', name: 'Gold Per 10' },
        'healAndShieldPower': { color: 'text-[#1dc451]', name: 'Heal & Shield Power' }
    };

    return statMap[key] || { color: 'text-[#f0e6d2]', name: formatStatName(key) };
}

function formatStatValue(key, value) {
    let valFlat = 0;
    let valPercent = 0;

    // Handle Meraki object structure { flat: 45, percent: 0 }
    if (typeof value === 'object' && value !== null) {
        valFlat = value.flat || 0;
        valPercent = value.percent || 0;
    } else {
        valFlat = value;
    }

    // Special Handling: Move Speed
    if (key.toLowerCase().includes('speed') && !key.toLowerCase().includes('attack')) {
        if (Math.abs(valFlat) > 0.01) return `+${valFlat}`;
        if (valPercent > 0) return `+${(valPercent * 100).toFixed(0)}%`;
        if (Math.abs(valFlat) < 0.01 && Math.abs(valPercent) < 0.01) return `+0`;
    }

    // Special Handling: Attack Speed
    if (key.toLowerCase().includes('attack') && key.toLowerCase().includes('speed')) {
        if (valPercent > 0) return `+${(valPercent * 100).toFixed(0)}%`;
        if (valFlat > 0 && valFlat < 10) return `+${(valFlat * 100).toFixed(0)}%`;
    }

    // Default Percent Heuristics
    if (valPercent !== 0) {
        return `+${(valPercent * 100).toFixed(0)}%`;
    }

    // Fallback for flat values that might be percent
    const isPercentKey = key.toLowerCase().includes('percent') ||
        key.toLowerCase().includes('crit') ||
        key.toLowerCase().includes('steal') ||
        key.toLowerCase().includes('tenacity') ||
        key.toLowerCase().includes('omnivamp') ||
        (key.toLowerCase().includes('penetration') && valFlat < 5);

    if (isPercentKey) {
        if (Math.abs(valFlat) <= 2.0) {
            return `+${(valFlat * 100).toFixed(0)}%`;
        }
        return `+${valFlat}%`;
    }

    return valFlat > 0 ? `+${valFlat}` : `${valFlat}`;
}

function formatStatName(key) {
    // Camel/Flat/Percent removal
    const raw = key.replace(/([A-Z])/g, ' $1').trim()
        .replace(/^flat\s+/i, '')
        .replace(/^percent\s+/i, '');

    // Title Case
    return raw.replace(/\b\w/g, c => c.toUpperCase());
}

// Check if stat is effectively zero
export function isStatZero(value) {
    if (typeof value === 'object' && value !== null) {
        return (value.flat || 0) === 0 && (value.percent || 0) === 0;
    }
    return value === 0;
}
