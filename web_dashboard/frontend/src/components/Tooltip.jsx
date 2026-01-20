import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getItemIconUrl } from '../utils/dataDragon';

export default function Tooltip({ content, children, className = '' }) {
    const [isVisible, setIsVisible] = useState(false);
    const [style, setStyle] = useState({ wrapper: {}, inner: {} });
    const wrapperRef = useRef(null);
    const timeoutRef = useRef(null); // Ref for close delay

    const showTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(true);
    };

    const hideTooltip = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 150); // 150ms grace period to move mouse to tooltip
    };

    useEffect(() => {
        if (isVisible && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            let top, left, transform;

            // --- Horizontal Logic ---
            // If strictly on the Left Edge (< 200px), align Left
            if (centerX < 200) {
                left = rect.left;
                transform = 'translate(0, '; // Start of transform
            }
            // If strictly on the Right Edge (> width - 200px), align Right
            else if (centerX > windowWidth - 200) {
                left = rect.right;
                transform = 'translate(-100%, '; // Move back 100%
            }
            // Default: Center
            else {
                left = centerX;
                transform = 'translate(-50%, ';
            }

            // --- Vertical Logic ---
            // Determine available space
            const spaceAbove = rect.top; // Gap to top of screen
            const spaceBelow = windowHeight - rect.bottom; // Gap to bottom of screen

            let maxHeight;

            // Prefer larger space, but bias towards Bottom (natural reading order) if similar
            // Or stick to the "Top Half -> Below" logic but enforce limit
            if (centerY < windowHeight / 2) {
                // Show Below
                top = rect.bottom + 12;
                transform += '0)';
                maxHeight = spaceBelow - 24; // Leave 24px safety margin
            } else {
                // Show Above
                top = rect.top - 12;
                transform += '-100%)';
                maxHeight = spaceAbove - 24; // Leave 24px safety margin
            }

            // Arrow Logic (Optional: Hide arrow if not centered, or adjust it. 
            // For now simplest is to rely on the box and maybe hide arrow if cornered)

            setStyle({
                wrapper: {
                    top: `${top}px`,
                    left: `${left}px`,
                    transform: transform,
                    zIndex: 99999,
                },
                inner: {
                    maxHeight: `${maxHeight}px`
                }
            });
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
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    className="fixed transition-opacity duration-200"
                    style={style.wrapper}
                    onMouseEnter={showTooltip} // Keep open when hovering the tooltip itself
                    onMouseLeave={hideTooltip}
                >
                    <div
                        className="bg-slate-900 border border-slate-600 rounded-sm shadow-[0_0_10px_rgba(0,0,0,0.8)] p-0 min-w-[300px] max-w-[350px] overflow-y-auto overscroll-contain text-[#f0e6d2] pointer-events-auto box-border"
                        style={style.inner}
                    >
                        {/* Header Border Line */}
                        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#c8aa6e] to-transparent opacity-50 mb-1"></div>

                        <div className="p-3">
                            {content}
                        </div>

                        {/* Footer Border Line */}
                        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#c8aa6e] to-transparent opacity-50 mt-1"></div>
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

    // Meraki provides `simpleDescription` which is cleaner HTML but often lacks scaling numbers.
    // We prefer `description` for full detailed stats.
    const rawDescription = itemData.description || itemData.simpleDescription;

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

        // Protections: Always keep lines that explicitly say "Passive", "Active", or "Unique"
        if (cleanLine.match(/\b(Passive|Active|Unique)\b/i)) return true;
        // Protection: Keep long lines (stats are typically short, e.g. "+45 Move Speed" is ~16 chars)
        if (cleanLine.length > 40) return true;

        // SMART FILTERING (Check against actual keys present in header)

        // Basic Stats
        if (cleanLine.match(/Attack Damage|AD\b/i) && (stats.FlatPhysicalDamageMod || stats.flatPhysicalDamageMod || stats.attackDamage)) return false;
        if (cleanLine.match(/Ability Power|AP\b/i) && (stats.FlatMagicDamageMod || stats.flatMagicDamageMod || stats.abilityPower)) return false;
        if (cleanLine.match(/Armor/i) && !cleanLine.match(/Penetration/i) && (stats.FlatArmorMod || stats.flatArmorMod || stats.armor)) return false;
        if (cleanLine.match(/Magic Resist|MR\b/i) && (stats.FlatSpellBlockMod || stats.flatSpellBlockMod || stats.magicResistance)) return false;
        if (cleanLine.match(/Health(?! Regen)/i) && (stats.FlatHPPoolMod || stats.flatHPPoolMod || stats.health)) return false;
        if (cleanLine.match(/Mana(?! Regen)/i) && (stats.FlatMPPoolMod || stats.flatMPPoolMod || stats.mana)) return false;

        // Speed
        if ((cleanLine.match(/Move Speed|Movement Speed|MS\b/i)) && (stats.PercentMovementSpeedMod || stats.FlatMovementSpeedMod || stats.flatMovementSpeedMod || stats.movespeed)) return false;
        if (cleanLine.match(/Attack Speed|AS\b/i) && (stats.PercentAttackSpeedMod || stats.percentAttackSpeedMod || stats.attackSpeed)) return false;

        // Crit / Lifesteal
        if (cleanLine.match(/Critical Strike|Crit /i) && (stats.FlatCritChanceMod || stats.flatCritChanceMod || stats.criticalStrikeChance)) return false;
        if (cleanLine.match(/Life Steal/i) && (stats.PercentLifeStealMod || stats.percentLifeStealMod || stats.lifesteal)) return false;

        // Regen
        if (cleanLine.match(/Health Regen/i) && (stats.FlatHPRegenMod || stats.flatHPRegenMod || stats.healthRegen)) return false;
        if (cleanLine.match(/Mana Regen/i) && (stats.FlatMPRegenMod || stats.flatMPRegenMod || stats.manaRegen)) return false;
        if (cleanLine.match(/Omnivamp/i) && (stats.Omnivamp || stats.omnivamp)) return false;
        if (cleanLine.match(/Ability Haste|AH\b/i) && (stats.AbilityHaste || stats.abilityHaste)) return false;

        // --- PENETRATION HANDLING (Flat vs Percent) ---
        // Magic Penetration
        if (cleanLine.match(/Magic Penetration|Magic Pen/i)) {
            const isPercentLine = cleanLine.includes('%');
            // Header Keys: 'magicPenetration' (could be flat or percent in Riot API? Usually flat is 'flatMagicPenetration')
            // Heuristic: If stats has generic 'magicPenetration', we assume it covers the line unless distinct.
            // But usually Riot separates them. Meraki might use 'magicPenetration' for both?
            // Let's check specific known keys.

            // If header has ANY magic pen, and the values are essentially the same, filter it.
            // But here we have 7% vs 8%. 
            // If we have a stat key, we generally want to hide the text version.
            // BUT we must not hide Flat if Header is Percent.

            // If Header has 'magicPenetration' (7), and Line has '%' -> Filter (It's the percent stat)
            if (isPercentLine && (stats.magicPenetration || stats.percentMagicPenetration)) return false;

            // If Header has 'magicPenetration' (7), and Line is FLAT (18) -> Keep (Unique stat)
            // (Unless stats also has flatMagicPenetration)
            if (!isPercentLine && (stats.flatMagicPenetration)) return false;
        }

        // Lethality / Armor Pen
        if (cleanLine.match(/Lethality/i) && (stats.Lethality || stats.lethality)) return false;
        if (cleanLine.match(/Armor Penetration/i)) {
            const isPercentLine = cleanLine.includes('%');
            if (isPercentLine && (stats.armorPenetration || stats.percentArmorPenetration)) return false;
        }

        return true;
    });

    // 3. Reconstruct
    if (lines.length === 0) {
        return description.replace(/<stats>[\s\S]*?<\/stats>/i, '');
    } else {
        // Return the lines without <stats> wrapper so FormattedDescription doesn't nuke them
        const newStatsBlock = lines.join('<br>');
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

// ----------------------------------------------------------------------
// HTML Parsing & Formatting
// ----------------------------------------------------------------------

function FormattedDescription({ description }) {
    if (!description) return null;

    // 1. Clean up common HTML entities and container tags
    let text = description
        .replace(/<mainText>/gi, '')   // Remove container
        .replace(/<\/mainText>/gi, '') // Remove container
        .replace(/<stats>[\s\S]*?<\/stats>/gi, '') // Remove stats block entirely (we display stats separately)
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s*\((?:0s|NaN|null)\)/gi, '') // Remove broken cooldown/value placeholders
        .replace(/<br\s*\/?>/gi, '\n');

    // Split by newlines to handle blocks
    const lines = text.split('\n');

    return (
        <div className="space-y-2">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                return <div key={i}>{parseLine(trimmed)}</div>;
            })}
        </div>
    );
}

function parseLine(line) {
    // Check for special start tags
    // Passives often look like: <passive>Life Draining</passive>
    // Or just text.

    // Explicit Active/Passive tags
    if (line.toLowerCase().includes('<active>')) {
        const content = line.replace(/<\/?active>/gi, '').replace(/<[^>]+>/g, '').trim();
        // Heuristic: Headers are usually short. Descriptions are long sentences.
        if (content.length < 50) {
            return (
                <span>
                    <span className="text-[#f0e6d2] font-bold uppercase text-xs tracking-wider">Active - </span>
                    <span className="text-[#f0e6d2] font-bold">{content}</span>
                </span>
            );
        }
        return colorizeText(content);
    }
    if (line.toLowerCase().includes('<passive>')) {
        const content = line.replace(/<\/?passive>/gi, '').replace(/<[^>]+>/g, '').trim();
        // Heuristic: Headers are usually short. Descriptions are long sentences.
        if (content.length < 50) {
            return (
                <span>
                    <span className="text-[#f0e6d2] font-bold uppercase text-xs tracking-wider">Passive - </span>
                    <span className="text-[#f0e6d2] font-bold">{content}</span>
                </span>
            );
        }
        return colorizeText(content);
    }

    // Fallback: If line starts with a capitalized word followed by colon? (Riot sometimes uses plain text for passives)
    // E.g. "Life Draining: Return 2.5%..."
    // colorizeText handles "Name:" pattern already with bold white.

    // Remove remaining generic tags but keep content
    const cleanLine = line.replace(/<[^>]+>/g, '');
    return colorizeText(cleanLine);
}

function colorizeText(text) {
    const segments = [];
    let remaining = text;
    let key = 0;

    const patterns = [
        // Named effects (bold white) - Matches "Effect Name:"
        { regex: /\b([A-Z][A-Za-z0-9\s']+(?:'s)?)\s*:/, className: 'text-[#f0e6d2] font-bold' },

        // Attention / Values (Riot uses <attention> or <scaleX>)
        // We stripped tags, but the values like "3%" remain.
        // Match numbers and percentages
        { regex: /(\d+(?:\.\d+)?%?)/, className: 'text-[#f0e6d2]' },

        // Damage Types
        { regex: /(physical damage)/gi, className: 'text-[#ff8c00]' }, // Orange
        { regex: /(magic damage)/gi, className: 'text-[#00bfff]' }, // Cyan
        { regex: /(true damage)/gi, className: 'text-[#ffffff]' }, // White for true damage

        // Stats
        { regex: /\b(Health|HP)\b/gi, className: 'text-[#1dc451]' }, // Green
        { regex: /\b(Armor)\b/gi, className: 'text-[#f5d94e]' }, // Yellow
        { regex: /\b(Magic Resist|MR)\b/gi, className: 'text-[#87cefa]' }, // Light Blue
        { regex: /\b(Mana)\b/gi, className: 'text-[#1a78ff]' }, // Blue
        { regex: /\b(Attack Damage|AD)\b/gi, className: 'text-[#ff8c00]' },
        { regex: /\b(Ability Power|AP)\b/gi, className: 'text-[#ae5bf0]' },
        { regex: /\b(Life Steal)\b/gi, className: 'text-[#ff4500]' },

        // Keywords
        { regex: /\b(Stasis|Invulnerable|Untargetable|Vulnerable|Slow(?:s|ed)?|Stun(?:s|ned)?|Root(?:s|ed)?)\b/gi, className: 'text-[#f0e6d2] font-bold' },
    ];

    while (remaining) {
        let earliestMatch = null;
        let earliestPattern = null;

        for (const pattern of patterns) {
            // Re-create regex to not have global flag for simple search or use string match
            // Actually, we need index.
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags + (pattern.regex.flags.includes('g') ? '' : ''));
            const match = regex.exec(remaining);

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
                {earliestMatch[0] || earliestMatch[1]}
            </span>
        );

        remaining = remaining.substring(earliestMatch.index + (earliestMatch[0] || earliestMatch[1]).length);
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
        'magicPenetration': { color: 'text-[#00bfff]', name: 'Magic Penetration' },
        'flatMagicPenetration': { color: 'text-[#00bfff]', name: 'Magic Penetration' },
        'percentMagicPenetration': { color: 'text-[#00bfff]', name: 'Magic Penetration' },
        'magicPenetrationPercent': { color: 'text-[#00bfff]', name: 'Magic Penetration' },
        'armorPenetration': { color: 'text-[#ff8c00]', name: 'Armor Penetration' },
        'percentArmorPenetration': { color: 'text-[#ff8c00]', name: 'Armor Penetration' },
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
        if (valPercent > 0) {
            // Heuristic: If > 1.0, assume it's pre-scaled (e.g. 4 => 4%)
            if (valPercent > 1.0) return `+${valPercent}%`;
            return `+${(valPercent * 100).toFixed(0)}%`;
        }
        if (Math.abs(valFlat) < 0.01 && Math.abs(valPercent) < 0.01) return `+0`;
    }

    // Special Handling: Attack Speed
    if (key.toLowerCase().includes('attack') && key.toLowerCase().includes('speed')) {
        if (valPercent > 0) return `+${(valPercent * 100).toFixed(0)}%`;
        if (valFlat > 0 && valFlat < 10) return `+${(valFlat * 100).toFixed(0)}%`;
    }

    // Default Percent Heuristics
    if (valPercent !== 0) {
        if (Math.abs(valPercent) > 1.0) {
            return `+${valPercent}%`;
        }
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
