// Data Dragon Helper (Powered by Meraki Analytics & Community Dragon)
// Handles version fetching and URL generation for assets

const DD_BASE_URL = "https://ddragon.leagueoflegends.com";
const MERAKI_BASE_URL = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US";
let currentVersion = "15.1.1"; // Default fallback

// Data caches
let runeMap = {};
let runeDataMap = {};
let itemDataMap = {};
let championDataMap = {}; // Now stores ALL champions from Meraki
let summonerSpellMap = {};

// Keep version fetch for Runes/legacy needs
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

// --- Meraki/Community Dragon Asset Helpers ---

export const getChampionIconUrl = (championName) => {
    if (!championName) return "";
    // Ensure name is properly capitalized for CDragon
    const name = championName.charAt(0).toUpperCase() + championName.slice(1);
    // Use Community Dragon directly for reliable icons
    return `https://cdn.communitydragon.org/latest/champion/${name}/square`;
};

export const getItemIconUrl = (itemId) => {
    if (!itemId || itemId === 0) return "";
    // If we have data, use the specific icon link (which handles different versions/paths)
    if (itemDataMap[itemId] && itemDataMap[itemId].icon) {
        return itemDataMap[itemId].icon.replace("http://", "https://");
    }
    // Fallback to official DDragon (most reliable)
    return `https://ddragon.leagueoflegends.com/cdn/${currentVersion}/img/item/${itemId}.png`;
};

export const getSpellIconUrl = (spellId) => {
    // Summoner spells
    if (summonerSpellMap[spellId] && summonerSpellMap[spellId].icon) {
        return summonerSpellMap[spellId].icon;
    }
    // Fallback DDragon (Meraki summoners might not be loaded yet)
    return `https://ddragon.leagueoflegends.com/cdn/${currentVersion}/img/spell/SummonerFlash.png`; // Fallback placeholder logic
};

// Get ability icon URL
export const getAbilityIconUrl = (championName, abilityKey) => {
    if (!championName || !abilityKey) return "";
    const champ = championDataMap[championName];
    if (champ && champ.abilities && champ.abilities[abilityKey] && champ.abilities[abilityKey][0]) {
        return champ.abilities[abilityKey][0].icon;
    }
    // Fallback CDragon construction
    return `https://cdn.communitydragon.org/latest/champion/${championName}/ability-icon/${abilityKey.toLowerCase()}`;
};

// Get ability data with description
export const getAbilityData = (championName, abilityKey) => {
    if (!championName || !abilityKey) return null;
    const champ = championDataMap[championName];
    if (!champ || !champ.abilities) return null;

    // Handle 'P' vs 'Passive' naming if needed, but Meraki uses 'P', 'Q', 'W', 'E', 'R'
    const abilityList = champ.abilities[abilityKey];
    if (!abilityList || abilityList.length === 0) return null;

    const spell = abilityList[0]; // Take first form

    return {
        name: spell.name,
        description: spell.effects ? spell.effects.map(e => e.description).join("\n\n") : spell.description, // Meraki splits effects
        cooldown: spell.cooldown ? spell.cooldown.modifiers[0].values.join(" / ") : "N/A",
        cost: spell.cost ? spell.cost.modifiers[0].values.join(" / ") : "N/A"
    };
};

// Fetch runes (Keep DDragon for now as it's reliable for IDs)
let runeTreeData = [];

export const fetchRunes = async () => {
    try {
        const response = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/runesReforged.json`);
        const data = await response.json();
        runeTreeData = data;

        data.forEach(tree => {
            runeMap[tree.id] = tree.icon;
            runeDataMap[tree.id] = { name: tree.name, description: tree.name, icon: tree.icon };
            tree.slots.forEach(slot => {
                slot.runes.forEach(rune => {
                    runeMap[rune.id] = rune.icon;
                    runeDataMap[rune.id] = { name: rune.name, description: rune.longDesc || rune.shortDesc, icon: rune.icon };
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
    return `${DD_BASE_URL}/cdn/img/${runeMap[runeId]}`;
};

export const getRuneData = (runeId) => {
    return runeDataMap[runeId] || null;
};

// Fetch item data (From Meraki)
export const fetchItems = async () => {
    try {
        // Use official DDragon for reliability
        const response = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/item.json`);
        const data = await response.json();
        // DDragon returns data in a 'data' property
        itemDataMap = data.data;
    } catch (e) {
        console.error("Failed to fetch items from DDragon", e);
    }
};

export const getItemData = (itemId) => {
    if (!itemId || itemId === 0) return null;
    return itemDataMap[itemId] || null;
};

// Fetch summoner spells (DDragon for now)
export const fetchSummonerSpells = async () => {
    try {
        const response = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/summoner.json`);
        const data = await response.json();
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

// Fetch champion data (From Meraki - ALL champions)
export const fetchChampionData = async (championName) => {
    // If we already have data (meaning we fetched the big JSON), just return.
    // NOTE: We ignore `championName` param because we fetch ALL at once.
    if (Object.keys(championDataMap).length > 0) return;

    try {
        const response = await fetch(`${MERAKI_BASE_URL}/champions.json`);
        // Meraki returns { "Aatrox": { ... }, "Ahri": { ... } }
        championDataMap = await response.json();
    } catch (e) {
        console.error("Failed to fetch champions from Meraki", e);
    }
};

export const getChampionData = (championName) => {
    return championDataMap[championName] || null;
};

// Initialize
let initPromise = null;

export const initDataDragon = () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        await fetchLatestVersion(); // Still needed for Runes/Summoners
        await Promise.all([
            fetchRunes(),
            fetchItems(),
            fetchChampionData(), // Fetches ALL champions
            fetchSummonerSpells()
        ]);
        console.log("Data initialized (Meraki + CDragon)", {
            version: currentVersion,
            items: Object.keys(itemDataMap).length,
            champs: Object.keys(championDataMap).length
        });
    })();

    return initPromise;
};

// Auto-init
initDataDragon();
