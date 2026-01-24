// Data Dragon Helper (Powered by Meraki Analytics & Community Dragon)
// Handles version fetching and URL generation for assets
import config from '../config';

const DD_BASE_URL = "https://ddragon.leagueoflegends.com";
const MERAKI_BASE_URL = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US";
let currentVersion = "16.1.1"; // Default fallback (S16)

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
            // Force S16 if the API returns an older version (common early season issue)
            const latest = versions[0];
            const major = parseInt(latest.split('.')[0]);
            if (major >= 16) {
                currentVersion = latest;
            } else {
                console.warn(`Fetched version ${latest} is older than enforced 16.1.1, ignoring.`);
            }
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

    // 1. Preferred: Use standard Data Dragon from metadata (cached, no redirects)
    // Meraki data might not have image.full, so we check carefully.
    if (championDataMap[key] && championDataMap[key].image && championDataMap[key].image.full) {
        return `${DD_BASE_URL}/cdn/${currentVersion}/img/champion/${championDataMap[key].image.full}`;
    }

    // 2. Intelligent Construction (Heuristic)
    // If metadata is missing, we try to guess the DDragon ID from the name/key.
    // DDragon Keys are usually alphanumeric with no spaces (e.g. "DrMundo", "LeeSin").

    // Start with the key we found (which might be "Dr. Mundo" or "Lee Sin" if they came from Meraki keys)
    let ddragonId = key;

    // If we have an ID string in the map, use that
    if (championDataMap[key] && championDataMap[key].id && typeof championDataMap[key].id === 'string') {
        ddragonId = championDataMap[key].id;
    }

    // Sanitize: Remove all non-alphanumeric characters (matches DDragon convention)
    let cleanId = ddragonId.replace(/[^a-zA-Z0-9]/g, '');

    // Handle Specifc Edge Cases (DDragon Quirks)
    if (cleanId === "Wukong") cleanId = "MonkeyKing";
    if (cleanId === "RenataGlasc") cleanId = "Renata"; // DDragon uses just "Renata"
    if (cleanId === "FiddleSticks") cleanId = "Fiddlesticks"; // Case sensitivity safety

    // Capitalize first letter (just in case)
    if (cleanId.length > 0) {
        cleanId = cleanId.charAt(0).toUpperCase() + cleanId.slice(1);
    }

    // 3. Return Direct DDragon URL
    if (currentVersion) {
        return `${DD_BASE_URL}/cdn/${currentVersion}/img/champion/${cleanId}.png`;
    }

    // 4. Last Resort: CDragon (Slow Redirects)
    return `https://cdn.communitydragon.org/latest/champion/${cleanId}/square`;
};

export const getItemIconUrl = (itemId) => {
    if (!itemId || itemId === 0) return "";

    // 1. Preferred: Standard Data Dragon (Fastest, consistency)
    if (currentVersion) {
        return `${DD_BASE_URL}/cdn/${currentVersion}/img/item/${itemId}.png`;
    }

    // 2. Fallback: Meraki Data (if available)
    if (itemDataMap[itemId] && itemDataMap[itemId].icon) {
        return itemDataMap[itemId].icon.replace("http://", "https://");
    }

    // 3. Fallback: CDragon
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
let championSpellMap = {}; // Maps CleanName -> { Q: 'File.png', W: '...', ... }

export const getAbilityIconUrl = (championName, abilityKey) => {
    if (!championName || !abilityKey) return "";
    const cleanName = findChampionKey(championName);

    // 1. Preferred: Direct DDragon (Fastest)
    if (championSpellMap[cleanName] && championSpellMap[cleanName][abilityKey]) {
        return `${DD_BASE_URL}/cdn/${currentVersion}/img/spell/${championSpellMap[cleanName][abilityKey]}`;
    }

    // 2. Meraki Fallback
    const champ = championDataMap[cleanName];
    if (champ && champ.abilities && champ.abilities[abilityKey] && champ.abilities[abilityKey][0]) {
        // Meraki icon URLs are often absolute or CDragon ref
        return champ.abilities[abilityKey][0].icon;
    }

    // 3. Fallback CDragon construction (Slowest)
    return `https://cdn.communitydragon.org/latest/champion/${cleanName}/ability-icon/${abilityKey.toLowerCase()}`;
};

// Fetch official DDragon data to get consistent spell filenames
export const fetchChampionSpellFilenames = async () => {
    if (Object.keys(championSpellMap).length > 0) return;
    try {
        // We need championFull.json to get spell images for all champs efficiently
        const response = await fetch(`${DD_BASE_URL}/cdn/${currentVersion}/data/en_US/championFull.json`);
        const data = await response.json();

        Object.values(data.data).forEach(champ => {
            // Map spells [0,1,2,3] to [Q,W,E,R]
            const key = champ.id; // "MonkeyKing", "Renata" etc.
            championSpellMap[key] = {
                Q: champ.spells[0].image.full,
                W: champ.spells[1].image.full,
                E: champ.spells[2].image.full,
                R: champ.spells[3].image.full,
                P: champ.passive.image.full // Passive often useful too
            };
        });
    } catch (e) {
        console.error("Failed to fetch champion spell filenames", e);
    }
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
            patchItemStats(data); // Apply manual S16 fixes
        } catch (err) {
            console.warn("DDragon enrichment failed", err);
        }
        itemDataMap = data;
    }
};

// Manual Patch for S16 items where API is stale/incomplete
function patchItemStats(data) {
    if (!data) return;

    // --- S16 TIER 3 BOOTS PATCHES ---
    // Source: In-game descriptions (verified via item_dump.txt)

    // --- S16 TIER 3 BOOTS PATCHES ---
    // Source: In-game descriptions (verified via item_dump.txt)

    // 3170: Swiftmarch
    // Desc: 65 Move Speed
    if (!data["3170"]) data["3170"] = { id: 3170 };
    data["3170"].name = "Swiftmarch";
    data["3170"].description = "<mainText><stats>+65 Move Speed</stats><br><br><passed>Unique Passive - Swift:</passed> Movement Speed is increased by 65.</mainText>";
    data["3170"].gold = { total: 1000, sell: 700, purchasable: true };
    data["3170"].tags = ["Boots", "Speed"];
    data["3170"].stats = {
        "flatMovementSpeedMod": 65
    };

    // 3171: Crimson Lucidity
    // Desc: 20 Ability Haste, 45 Move Speed
    if (!data["3171"]) data["3171"] = { id: 3171 };
    data["3171"].name = "Crimson Lucidity";
    data["3171"].description = "<mainText><stats>+20 Ability Haste<br>+45 Move Speed</stats><br><br><passed>Unique Passive - Cooldown:</passed> Reduces Summoner Spell cooldowns by 12%.</mainText>";
    data["3171"].gold = { total: 900, sell: 630, purchasable: true };
    data["3171"].tags = ["Boots", "CooldownReduction", "Speed"];
    data["3171"].stats = {
        "abilityHaste": 20,
        "flatMovementSpeedMod": 45
    };

    // 3172: Gunmetal Greaves
    // Desc: 40% Attack Speed, 45 Move Speed
    if (!data["3172"]) data["3172"] = { id: 3172 };
    data["3172"].name = "Gunmetal Greaves";
    data["3172"].description = "<mainText><stats>+40% Attack Speed<br>+45 Move Speed<br>+5% Life Steal</stats></mainText>";
    data["3172"].gold = { total: 1850, sell: 1295, purchasable: true }; // Estimated Tier 3
    data["3172"].tags = ["Boots", "AttackSpeed", "LifeSteal", "Speed"];
    data["3172"].stats = {
        "percentAttackSpeedMod": 0.40,
        "flatMovementSpeedMod": 45,
        "percentLifeStealMod": 0.05
    };

    // 3173: Chainlaced Crushers
    // Desc: 30 Magic Resist, 45 Move Speed, 30% Tenacity
    if (!data["3173"]) data["3173"] = { id: 3173 };
    data["3173"].name = "Chainlaced Crushers";
    data["3173"].description = "<mainText><stats>+30 Magic Resist<br>+45 Move Speed<br>+30% Tenacity</stats><br><br><passed>Unique Passive - Tenacity:</passed> Reduces the duration of stuns, slows, taunts, fears, silences, blinds, polymorphs, and immobilizes by 30%.</mainText>";
    data["3173"].gold = { total: 2050, sell: 1435, purchasable: true };
    data["3173"].tags = ["Boots", "SpellBlock", "Tenacity", "Speed"];
    data["3173"].stats = {
        "flatSpellBlockMod": 30,
        "flatMovementSpeedMod": 45,
        "tenacity": 0.30
    };

    // 3174: Armored Advance
    // Desc: 35 Armor, 45 Move Speed
    if (!data["3174"]) data["3174"] = { id: 3174 };
    data["3174"].name = "Armored Advance";
    data["3174"].description = "<mainText><stats>+35 Armor<br>+45 Move Speed</stats><br><br><passed>Unique Passive - Plated:</passed> Reduces incoming damage from basic attacks by 12%.</mainText>";
    data["3174"].gold = { total: 2000, sell: 1400, purchasable: true }; // Estimated
    data["3174"].tags = ["Boots", "Armor", "Speed"];
    data["3174"].stats = {
        "flatArmorMod": 35,
        "flatMovementSpeedMod": 45
    };

    // 3175: Spellslinger's Shoes
    // Desc: 18 Magic Pen, 8% Magic Pen, 45 Move Speed
    if (!data["3175"]) data["3175"] = { id: 3175 };
    data["3175"].name = "Spellslinger's Shoes";
    data["3175"].description = "<mainText><stats>+18 Magic Penetration<br>+8% Magic Penetration<br>+45 Move Speed</stats></mainText>";
    data["3175"].gold = { total: 1850, sell: 1295, purchasable: true };
    data["3175"].tags = ["Boots", "MagicPenetration", "Speed"];
    data["3175"].stats = {
        "magicPenetration": 18, // Flat
        "percentMagicPenetration": 0.08,
        "flatMovementSpeedMod": 45
    };

    // 3176: Forever Forward
    // Desc: 55 Move Speed (Plus passives)
    if (!data["3176"]) data["3176"] = { id: 3176 };
    data["3176"].name = "Forever Forward";
    data["3176"].description = "<mainText><stats>+55 Move Speed</stats><br><br><passed>Unique Passive - Focus:</passed> You ignore unit collision and movement speed is increased.</mainText>";
    data["3176"].gold = { total: 900, sell: 630, purchasable: true };
    data["3176"].tags = ["Boots", "Speed"];
    data["3176"].stats = {
        "flatMovementSpeedMod": 55
    };

    // --- S16 NEW ITEMS PATCHES ---
    // 2512: Fiendhunter Bolts
    if (!data["2512"]) data["2512"] = { id: 2512 };
    data["2512"].name = "Fiendhunter Bolts";
    data["2512"].description = "<mainText><stats>+40% Attack Speed<br>+25% Critical Strike Chance<br>+4% Move Speed</stats><br><br><passed>Unique Passive - Night Vigil:</passed> Grants 30 Ultimate Ability Haste.<br><passed>Unique Passive - Opening Barrage:</passed> After casting your Ultimate, your next 3 attacks gain Attack Speed and critically strike.</mainText>";
    data["2512"].gold = { total: 2650, sell: 1855, purchasable: true };
    data["2512"].tags = ["AttackSpeed", "CriticalStrike", "Speed"];
    data["2512"].stats = {
        "percentAttackSpeedMod": 0.40,
        "flatCritChanceMod": 0.25,
        "flatMovementSpeedMod": 4
    };

    // 2523: Hexoptics C44
    if (!data["2523"]) data["2523"] = { id: 2523 };
    data["2523"].name = "Hexoptics C44";
    data["2523"].description = "<mainText><stats>+50 Attack Damage<br>+25% Critical Strike Chance</stats><br><br><passed>Unique Passive - Magnification:</passed> Deal up to 10% increased damage based on distance.<br><passed>Unique Passive - Arcane Aim:</passed> Takedowns grant bonus Attack Range.</mainText>";
    data["2523"].gold = { total: 3000, sell: 2100, purchasable: true };
    data["2523"].tags = ["Damage", "CriticalStrike"];
    data["2523"].stats = {
        "flatPhysicalDamageMod": 50,
        "flatCritChanceMod": 0.25
    };

    // 2525: Protoplasm Harness
    if (!data["2525"]) data["2525"] = { id: 2525 };
    data["2525"].name = "Protoplasm Harness";
    data["2525"].description = "<mainText><stats>+600 Health<br>+15 Ability Haste</stats><br><br><passed>Unique Passive - Survival:</passed> Falling below 30% Health restores health over time and grants size and tenacity.</mainText>";
    data["2525"].gold = { total: 2500, sell: 1750, purchasable: true };
    data["2525"].tags = ["Health", "AbilityHaste"];
    data["2525"].stats = {
        "flatHPPoolMod": 600,
        "abilityHaste": 15
    };

    // 2510: Dusk and Dawn
    if (!data["2510"]) data["2510"] = { id: 2510 };
    data["2510"].name = "Dusk and Dawn";
    data["2510"].description = "<mainText><stats>+70 Ability Power<br>+300 Health<br>+20 Ability Haste<br>+25% Attack Speed</stats><br><br><passed>Unique Passive - Dawn's Edge:</passed> After casting a spell, your next attack strikes twice, dealing bonus magic damage and applying on-hit effects a second time.</mainText>";
    data["2510"].gold = { total: 3100, sell: 2170, purchasable: true };
    data["2510"].tags = ["SpellDamage", "Health", "AttackSpeed", "AbilityHaste"];
    data["2510"].stats = {
        "flatHPPoolMod": 300,
        "flatMagicDamageMod": 70,
        "abilityHaste": 20,
        "percentAttackSpeedMod": 0.25
    };

    // 2517: Endless Hunger
    if (!data["2517"]) data["2517"] = { id: 2517 };
    data["2517"].name = "Endless Hunger";
    data["2517"].description = "<mainText><stats>+60 Attack Damage<br>+5% Omnivamp<br>+20% Tenacity</stats><br><br><passed>Unique Passive - Famine:</passed> Gain Ability Haste equal to 10% of bonus Attack Damage.<br><passed>Unique Passive - Satiation:</passed> Takedowns grant 15% Omnivamp for 8 seconds.</mainText>";
    data["2517"].gold = { total: 3000, sell: 2100, purchasable: true };
    data["2517"].tags = ["Damage", "LifeSteal", "Tenacity"];
    data["2517"].stats = {
        "flatPhysicalDamageMod": 60,
        "percentLifeStealMod": 0.05, // Approximation for Omnivamp
        "tenacity": 0.20
    };

    // 2520: Bastionbreaker
    if (!data["2520"]) data["2520"] = { id: 2520 };
    data["2520"].name = "Bastionbreaker";
    data["2520"].description = "<mainText><stats>+55 Attack Damage<br>+22 Lethality<br>+15 Ability Haste</stats><br><br><passed>Unique Passive - Shaped Charge:</passed> Dealing ability damage deals bonus true damage.<br><passed>Unique Passive - Sabotage:</passed> Takedowns grant Sabotage. Your next attack against a Turret deals massive true damage.</mainText>";
    data["2520"].gold = { total: 3200, sell: 2240, purchasable: true };
    data["2520"].tags = ["Damage", "ArmorPenetration", "AbilityHaste"];
    data["2520"].stats = {
        "flatPhysicalDamageMod": 55,
        "abilityHaste": 15
        // Lethality is usually handled via hidden passive stats in Riot API
    };

    // 2522: Actualizer
    if (!data["2522"]) data["2522"] = { id: 2522 };
    data["2522"].name = "Actualizer";
    data["2522"].description = "<mainText><stats>+90 Ability Power<br>+300 Mana<br>+10 Ability Haste</stats><br><br><active>Active - Mana Made Real:</active> Empower your Mana for 8s. Spells cost double but deal 18% bonus damage/healing. Cooldowns refresh 30% faster.</mainText>";
    data["2522"].gold = { total: 3100, sell: 2170, purchasable: true };
    data["2522"].tags = ["SpellDamage", "Mana", "AbilityHaste"];
    data["2522"].stats = {
        "flatMagicDamageMod": 90,
        "flatMPPoolMod": 300,
        "abilityHaste": 10
    };

    // 2524: Bandlepipes
    if (!data["2524"]) data["2524"] = { id: 2524 };
    data["2524"].name = "Bandlepipes";
    data["2524"].description = "<mainText><stats>+200 Health<br>+20 Armor<br>+20 Magic Resist<br>+15 Ability Haste</stats><br><br><passed>Unique Passive - Fanfare:</passed> Immobilizing enemies grants an Aura. Allies gain Attack Speed, you gain Move Speed.</mainText>";
    data["2524"].gold = { total: 2300, sell: 1610, purchasable: true };
    data["2524"].tags = ["Health", "Armor", "SpellBlock", "AbilityHaste"];
    data["2524"].stats = {
        "flatHPPoolMod": 200,
        "flatArmorMod": 20,
        "flatSpellBlockMod": 20,
        "abilityHaste": 15
    };

    // 2526: Whispering Circlet
    if (!data["2526"]) data["2526"] = { id: 2526 };
    data["2526"].name = "Whispering Circlet";
    data["2526"].description = "<mainText><stats>+200 Health<br>+8% Heal & Shield Power<br>+300 Mana</stats><br><br><passed>Unique Passive - Manaflow:</passed> Hitting champions grants Max Mana. Transforms into Diadem of Songs at 360 Mana.</mainText>";
    data["2526"].gold = { total: 2250, sell: 1575, purchasable: true };
    data["2526"].tags = ["Health", "Mana", "AbilityHaste", "Active"];
    data["2526"].stats = {
        "flatHPPoolMod": 200,
        "flatMPPoolMod": 300
    };

    // 2530: Diadem of Songs
    if (!data["2530"]) data["2530"] = { id: 2530 };
    data["2530"].name = "Diadem of Songs";
    data["2530"].description = "<mainText><stats>+250 Health<br>+10% Heal & Shield Power<br>+1000 Mana</stats><br><br><passed>Unique Passive - Consonance:</passed> In combat, heal the lowest health ally based on your Mana.</mainText>";
    data["2530"].gold = { total: 2250, sell: 1575, purchasable: false }; // Transform item
    data["2530"].tags = ["Health", "Mana", "AbilityHaste"];
    data["2530"].stats = {
        "flatHPPoolMod": 250,
        "flatMPPoolMod": 1000
    };

    console.log("Applied S16 Boot Stat & Description Patches (All T3)");
}

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

                // CRITICAL: Ensure 'from' (build path) and 'tags' are preserved
                // Check Meraki first, but if missing/empty, use DDragon
                if ((!merakiData[itemId].from || merakiData[itemId].from.length === 0) && ddItem.from) {
                    merakiData[itemId].from = ddItem.from;
                }
                if ((!merakiData[itemId].tags || merakiData[itemId].tags.length === 0) && ddItem.tags) {
                    merakiData[itemId].tags = ddItem.tags;
                }
            }
        });
    } catch (e) {
        console.warn("Enrichment fetch failed", e);
    }
}

// Helper to detect if an item is a Boot (for S16 7th slot logic)
export const isBoot = (itemId) => {
    if (!itemId || itemId === 0) return false;
    const data = itemDataMap[itemId];

    // 1. Check Tags
    if (data && data.tags && data.tags.includes("Boots")) return true;

    // 2. Dynamic Check: Builds from Boots of Speed (1001)
    if (data && data.from && data.from.includes("1001")) return true;

    // 3. Fallback for S16 custom items or missing tags
    const BOOT_IDS = [
        1001, // Boots
        3006, // Berserker's Greaves
        3009, // Boots of Swiftness
        3020, // Sorcerer's Shoes
        3047, // Plated Steelcaps
        3111, // Mercury's Treads
        3117, // Mobility Boots
        3158, // Ionian Boots of Lucidity
        3170, 3171, 3172, 3173, 3174, 3175, 3176 // S16 Tier 3 Boots
    ];
    return BOOT_IDS.includes(parseInt(itemId));
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
        // Use local backend proxy to ensure caching and avoid browser CORS/Rate-limit issues
        const response = await fetch(`${config.API_URL}/api/meraki/champions/`);
        if (!response.ok) throw new Error("Backend fetch failed");

        // Meraki returns { "Aatrox": { ... }, "Ahri": { ... } }
        championDataMap = await response.json();

        // Trigger spell filename fetch in background to upgrade icons
        fetchChampionSpellFilenames();

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
