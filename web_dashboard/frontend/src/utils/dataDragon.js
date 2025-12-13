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
        // Meraki uses HTTP, force HTTPS to avoid mixed content
        return itemDataMap[itemId].icon.replace("http://", "https://");
    }
    // Fallback ID-based CDragon link
    return `https://cdn.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/${itemId}.png`;
};

export const getSpellIconUrl = (spellId) => {
    // Summoner spells
    if (summonerSpellMap[spellId] && summonerSpellMap[spellId].icon) {
        return summonerSpellMap[spellId].icon;
    }
    // Fallback DDragon (Meraki summoners might not be loaded yet)
    return `https://ddragon.leagueoflegends.com/cdn/${currentVersion}/img/spell/SummonerFlash.png`; // Fallback placeholder logic
};

// ... (existing code)

// Fetch item data (From Meraki)
export const fetchItems = async () => {
    try {
        const response = await fetch(`${MERAKI_BASE_URL}/items.json`);
        const data = await response.json();
        // Meraki returns { "1001": { ... } } directly
        itemDataMap = data;
    } catch (e) {
        console.error("Failed to fetch items from Meraki", e);
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
