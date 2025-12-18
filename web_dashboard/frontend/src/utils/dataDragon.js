// Data Dragon Helper (Powered by Meraki Analytics & Community Dragon)
// Handles version fetching and URL generation for assets
import config from '../config';

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

// Helper: Normalize name for lookup (handles "MonkeyKing" vs "Wukong", "Kai'Sa" vs "Kaisa", etc.)
export const findChampionKey = (name) => {
    if (!name) return null;

    // 1. Direct match
    if (championDataMap[name]) return name;

    // 2. Normalize input: remove spaces, ' . and lowercase
    const cleanInput = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 3. Search Loop (Cache this if slow, but 160 items is fast enough)
    // Common mappings:
    const manualMap = {
        "fiddlesticks": "Fiddlesticks", // sometimes casing diff
        "monkeyking": "MonkeyKing", // Riot uses MonkeyKing, others might too
        "wukong": "MonkeyKing"      // alias
    };

    // Check manual aliases first
    if (manualMap[cleanInput]) {
        const mapped = manualMap[cleanInput];
        if (championDataMap[mapped]) return mapped;
    }

    // Scan keys
    for (const key of Object.keys(championDataMap)) {
        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanKey === cleanInput) return key;
    }

    // 4. Fallback for things like "Nunu&Willump" vs "Nunu"
    if (cleanInput.includes("nunu")) {
        if (championDataMap["Nunu"]) return "Nunu";
        if (championDataMap["NunuWillump"]) return "NunuWillump"; // correct DDragon key
    }
    if (cleanInput === "renata") return "Renata"; // vs RenataGlasc

    // Return original if nothing found (likely will fail lookup but consistent)
    return name;
};

export const getChampionIconUrl = (championName) => {
    if (!championName) return "";

    const key = findChampionKey(championName);

    // 1. Try to find ID from map (Reliable for CDragon)
    // championDataMap keys are Names (e.g. "Aatrox"), values have .key (ID, e.g. "266")
    if (championDataMap[key] && championDataMap[key].key) {
        return `https://cdn.communitydragon.org/latest/champion/${championDataMap[key].key}/square`;
    }

    // 2. Fallback: Use name directly (CDragon handles most casings)
    // We try to capitalize first letter just in case it came in lower, but preserve the rest (CamelCase)
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    return `https://cdn.communitydragon.org/latest/champion/${name}/square`;
};

export const getItemIconUrl = (itemId) => {
    if (!itemId || itemId === 0) return "";
    // If we have data, use the specific icon link (which handles different versions/paths)
    if (itemDataMap[itemId] && itemDataMap[itemId].icon) {
        // Meraki uses HTTP, force HTTPS to avoid mixed content
        return itemDataMap[itemId].icon.replace("http://", "https://");
    }
    // Fallback ID-based CDragon link
    return `https://cdn.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/${itemId}.png`;
};

export const getSpellIconUrl = (spellId) => {
    // Summoner spells
    const spell = summonerSpellMap[spellId];
    if (spell) {
        if (spell.icon) return spell.icon;
        if (spell.image && spell.image.full) {
            return `${DD_BASE_URL}/cdn/${currentVersion}/img/spell/${spell.image.full}`;
        }
    }
    return "";
};

// Get ability icon URL
export const getAbilityIconUrl = (championName, abilityKey) => {
    if (!championName || !abilityKey) return "";
    const cleanName = findChampionKey(championName);
    const champ = championDataMap[cleanName];
    if (champ && champ.abilities && champ.abilities[abilityKey] && champ.abilities[abilityKey][0]) {
        return champ.abilities[abilityKey][0].icon;
    }
    // Fallback CDragon construction
    return `https://cdn.communitydragon.org/latest/champion/${cleanName}/ability-icon/${abilityKey.toLowerCase()}`;
};

// Get ability data with description
export const getAbilityData = (championName, abilityKey) => {
    if (!championName || !abilityKey) return null;
    const cleanName = findChampionKey(championName);
    const champ = championDataMap[cleanName];
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

// Stat Mod Definitions (Shards)
const shardData = {
    5001: { name: "Health Scaling", description: "+10-180 Health (based on level)" },
    5002: { name: "Armor", description: "+6 Armor" },
    5003: { name: "Magic Resist", description: "+8 Magic Resist" },
    5005: { name: "Attack Speed", description: "+10% Attack Speed" },
    5007: { name: "Ability Haste", description: "+8 Ability Haste" },
    5008: { name: "Adaptive Force", description: "+9 Adaptive Force" },
    5010: { name: "Movement Speed", description: "+2% Movement Speed" },
    5011: { name: "Health", description: "+65 Health" },
    5013: { name: "Tenacity and Slow Resist", description: "+10% Tenacity and Slow Resist" }
};

export const getStatModData = (id) => {
    return shardData[id] || { name: "Unknown Value", description: "Stat Modifier" };
};

// Fetch item data (From Meraki)

// Fetch item data (From Local Backend Cache -> Meraki)
export const fetchItems = async () => {
    let data = null;
    try {
        // Use local backend proxy to ensure caching and avoid browser CORS/Rate-limit issues
        const response = await fetch(`${config.API_URL}/api/meraki/items/?v=${Date.now()}`);
        if (!response.ok) throw new Error("Backend fetch failed");
        data = await response.json();
    } catch (e) {
        console.warn("Failed to fetch items from local backend, falling back to CDN", e);
        try {
            const merakiResponse = await fetch(`${MERAKI_BASE_URL}/items.json`);
            data = await merakiResponse.json();
        } catch (cdnErr) {
            console.error("Critical: Failed to fetch items from any source", cdnErr);
            return;
        }
    }

    // Always attempt to enrich with DDragon data to fix missing descriptions (e.g. Seraph's Embrace)
    // Meraki sometimes relies on simpleDescription which strips scaling numbers.
    if (data) {
        try {
            await enrichWithDDragon(data);
        } catch (err) {
            console.warn("DDragon enrichment failed", err);
        }
        itemDataMap = data;
    }
};

// Helper: Merge DDragon descriptions into Meraki data where missing
async function enrichWithDDragon(merakiData) {
    try {
        const ddResponse = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/item.json`);
        const ddJson = await ddResponse.json();
        const ddItems = ddJson.data || {};

        Object.keys(merakiData).forEach(itemId => {
            const ddItem = ddItems[itemId];
            if (ddItem) {
                // If Meraki lacks a full description (only simpleDescription), use Riot's
                if (!merakiData[itemId].description && ddItem.description) {
                    merakiData[itemId].description = ddItem.description;
                }
                // Ensure Name is Riot-official if missing
                if (!merakiData[itemId].name && ddItem.name) {
                    merakiData[itemId].name = ddItem.name;
                }
                // Fallback for gold if missing
                if (!merakiData[itemId].gold && ddItem.gold) {
                    merakiData[itemId].gold = ddItem.gold;
                }
            }
        });
    } catch (e) {
        console.warn("Enrichment fetch failed", e);
    }
}

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
        // Use local backend proxy to ensure caching and avoid browser CORS/Rate-limit issues
        const response = await fetch(`${config.API_URL}/api/meraki/champions/`);
        if (!response.ok) throw new Error("Backend fetch failed");

        // Meraki returns { "Aatrox": { ... }, "Ahri": { ... } }
        championDataMap = await response.json();
    } catch (e) {
        console.warn("Failed to fetch champions from local backend, falling back to CDN", e);
        try {
            const response = await fetch(`${MERAKI_BASE_URL}/champions.json`);
            championDataMap = await response.json();
        } catch (e2) {
            console.error("Failed to fetch champions from Meraki CDN", e2);
        }
    }
};

export const getChampionData = (championName) => {
    return championDataMap[championName] || null;
};

export const getChampionNameById = (id) => {
    if (!id) return "Unknown";
    // Search the map values
    for (const [name, data] of Object.entries(championDataMap)) {
        if (data.id == id || data.key == id) return name;
    }
    return "Unknown";
};

// Listeners for data updates
const listeners = [];

export const subscribeToData = (callback) => {
    listeners.push(callback);
    // If we're already initialized, call immediately
    if (initPromise) {
        initPromise.then(() => callback());
    }
    return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
    };
};

const notifyListeners = () => {
    listeners.forEach(cb => cb());
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
        notifyListeners();
    })();

    return initPromise;
};

// Auto-init
initDataDragon();
