// Data Dragon Helper
// Handles version fetching and URL generation for assets

const DD_BASE_URL = "https://ddragon.leagueoflegends.com";
let currentVersion = "14.23.1"; // Default fallback

// Data caches
let runeMap = {};
let runeDataMap = {};
let itemDataMap = {};
let championDataMap = {};
let summonerSpellMap = {};

export const fetchLatestVersion = async () => {
    try {
        const response = await fetch(`${DD_BASE_URL}/api/versions.json`);
        const versions = await response.json();
        if (versions && versions.length > 0) {
            currentVersion = versions[0];
            return currentVersion;
        }
    } catch (e) {
        console.error("Failed to fetch Data Dragon version", e);
    }
    return currentVersion;
};

export const getVersion = () => currentVersion;

export const getChampionIconUrl = (championName) => {
    if (!championName) return "";
    return `${DD_BASE_URL}/cdn/${currentVersion}/img/champion/${championName}.png`;
};

export const getItemIconUrl = (itemId) => {
    if (!itemId || itemId === 0) return "";
    return `${DD_BASE_URL}/cdn/${currentVersion}/img/item/${itemId}.png`;
};

export const getSpellIconUrl = (spellId) => {
    const spellMap = {
        1: "SummonerBoost",
        3: "SummonerExhaust",
        4: "SummonerFlash",
        6: "SummonerHaste",
        7: "SummonerHeal",
        11: "SummonerSmite",
        12: "SummonerTeleport",
        13: "SummonerMana",
        14: "SummonerDot", // Ignite
        21: "SummonerBarrier",
        30: "SummonerPoroRecall",
        31: "SummonerPoroThrow",
        32: "SummonerSnowball",
        39: "SummonerSnowURFSnowball_Mark",
        54: "Summoner_UltBookPlaceholder",
    };
    const spellName = spellMap[spellId];
    if (!spellName) return "";
    return `${DD_BASE_URL}/cdn/${currentVersion}/img/spell/${spellName}.png`;
};

// Get ability icon URL
export const getAbilityIconUrl = (championName, abilityKey) => {
    if (!championName || !abilityKey) return "";
    const championData = championDataMap[championName];
    if (!championData) return "";

    const abilityMap = {
        'Q': championData.spells[0]?.image?.full,
        'W': championData.spells[1]?.image?.full,
        'E': championData.spells[2]?.image?.full,
        'R': championData.spells[3]?.image?.full
    };

    const imageName = abilityMap[abilityKey];
    if (!imageName) return "";

    return `${DD_BASE_URL}/cdn/${currentVersion}/img/spell/${imageName}`;
};

// Get ability data with description
export const getAbilityData = (championName, abilityKey) => {
    if (!championName || !abilityKey) return null;
    const championData = championDataMap[championName];
    if (!championData) return null;

    const abilityIndex = { 'Q': 0, 'W': 1, 'E': 2, 'R': 3 }[abilityKey];
    if (abilityIndex === undefined) return null;

    const spell = championData.spells[abilityIndex];
    if (!spell) return null;

    return {
        name: spell.name,
        description: spell.description,
        cooldown: spell.cooldownBurn,
        cost: spell.costBurn
    };
};

// Fetch runes with descriptions
let runeTreeData = [];

export const fetchRunes = async () => {
    try {
        const response = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/runesReforged.json`);
        const data = await response.json();
        runeTreeData = data;

        // Build maps for icons and data
        data.forEach(tree => {
            runeMap[tree.id] = tree.icon;
            runeDataMap[tree.id] = {
                name: tree.name,
                description: tree.name,
                icon: tree.icon
            };

            tree.slots.forEach(slot => {
                slot.runes.forEach(rune => {
                    runeMap[rune.id] = rune.icon;
                    runeDataMap[rune.id] = {
                        name: rune.name,
                        description: rune.longDesc || rune.shortDesc,
                        icon: rune.icon
                    };
                });
            });
        });
    } catch (e) {
        console.error("Failed to fetch runes", e);
    }
};

export const getAllRunes = () => runeTreeData;

export const getRuneIconUrl = (runeId) => {
    if (!runeId || !runeMap[runeId]) return "";
    // Fix: Add /cdn/ prefix to the path
    return `${DD_BASE_URL}/cdn/img/${runeMap[runeId]}`;
};

export const getRuneData = (runeId) => {
    return runeDataMap[runeId] || null;
};

// Fetch item data
export const fetchItems = async () => {
    try {
        const response = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/item.json`);
        const data = await response.json();
        itemDataMap = data.data;
    } catch (e) {
        console.error("Failed to fetch items", e);
    }
};

export const getItemData = (itemId) => {
    if (!itemId || itemId === 0) return null;
    return itemDataMap[itemId] || null;
};

// Fetch summoner spells
export const fetchSummonerSpells = async () => {
    try {
        const response = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/summoner.json`);
        const data = await response.json();

        // Build a map from spell ID to spell data
        Object.values(data.data).forEach(spell => {
            summonerSpellMap[spell.key] = spell;
        });
    } catch (e) {
        console.error("Failed to fetch summoner spells", e);
    }
};

export const getSummonerSpellData = (spellId) => {
    return summonerSpellMap[spellId] || null;
};

// Fetch champion data (for abilities)
export const fetchChampionData = async (championName) => {
    if (!championName) return;
    if (championDataMap[championName]) return; // Already cached

    try {
        const response = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/champion/${championName}.json`);
        const data = await response.json();
        championDataMap[championName] = data.data[championName];
    } catch (e) {
        console.error(`Failed to fetch champion data for ${championName}`, e);
    }
};

export const getChampionData = (championName) => {
    return championDataMap[championName] || null;
};

// Initialize
(async () => {
    await fetchLatestVersion();
    await fetchRunes();
    await fetchItems();
    await fetchSummonerSpells();
})();
