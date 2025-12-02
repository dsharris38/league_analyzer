import React, { useState, useMemo } from 'react';
import { getChampionIconUrl, getVersion, getItemIconUrl } from '../utils/dataDragon';
import clsx from 'clsx';

export default function TimelineMap({ match, puuid }) {
    const [currentTime, setCurrentTime] = useState(0); // Minutes
    const duration = Math.ceil((match.game_duration || 1800) / 60);
    const version = getVersion();

    // Map constants
    const mapSize = 14820;
    const getMapStyle = (x, y) => ({
        left: `${(x / mapSize) * 100}%`,
        bottom: `${(y / mapSize) * 100}%`,
    });

    const getDeathTimer = (gameTimeMin) => 0.5 + (gameTimeMin * 0.05);

    // Ultimate Team Check: Index-based fallback
    const isBlueTeam = (p) => {
        if (p.teamId == 100) return true;
        if (p.teamId == 200) return false;
        if (p.participantId >= 1 && p.participantId <= 5) return true;
        if (p.participantId >= 6 && p.participantId <= 10) return false;
        const index = match.participants.indexOf(p);
        return index >= 0 && index < 5;
    };

    // ... (Gold Graph Data Calculation omitted for brevity, it's unchanged)

    // ... (Rest of the file)





    // Gold Graph Data Calculation
    const goldGraphData = useMemo(() => {
        const dataPoints = [];
        const points = 60; // More resolution for smoother graph
        const interval = duration / points;

        for (let i = 0; i <= points; i++) {
            const t = i * interval;
            let blueGold = 0;
            let redGold = 0;

            const progress = t / duration;
            match.participants.forEach(p => {
                const estimatedGold = 500 + (p.gold_earned - 500) * progress;
                if (isBlueTeam(p)) blueGold += estimatedGold;
                else redGold += estimatedGold;
            });

            let killGoldBlue = 0;
            let killGoldRed = 0;
            (match.kill_events || []).forEach(e => {
                if ((e.timestamp / 60000) <= t) {
                    const killer = match.participants.find(p => p.champion_name === e.killer?.championName);
                    if (killer) {
                        if (isBlueTeam(killer)) killGoldBlue += 300;
                        else killGoldRed += 300;
                    }
                }
            });

            const totalKillGoldBlue = (match.kill_events || []).filter(e => {
                const k = match.participants.find(p => p.champion_name === e.killer?.championName);
                return k && isBlueTeam(k);
            }).length * 300;

            const totalKillGoldRed = (match.kill_events || []).filter(e => {
                const k = match.participants.find(p => p.champion_name === e.killer?.championName);
                return k && !isBlueTeam(k);
            }).length * 300;

            blueGold = blueGold - (totalKillGoldBlue * progress) + killGoldBlue;
            redGold = redGold - (totalKillGoldRed * progress) + killGoldRed;

            dataPoints.push({ t, diff: blueGold - redGold });
        }
        return dataPoints;
    }, [match, duration]);

    // Calculate Max Leads for Markers and Scaling
    const { maxBlue, maxRed, maxAbsLead } = useMemo(() => {
        let maxBlue = { t: 0, diff: 0 };
        let maxRed = { t: 0, diff: 0 };
        let maxAbs = 10000; // Minimum scale of 10k

        goldGraphData.forEach(d => {
            if (d.diff > maxBlue.diff) maxBlue = d;
            if (d.diff < maxRed.diff) maxRed = d;
            if (Math.abs(d.diff) > maxAbs) maxAbs = Math.abs(d.diff);
        });

        return { maxBlue, maxRed, maxAbsLead: maxAbs };
    }, [goldGraphData]);

    // Generate Gradient Stops for Graph
    const gradientStops = useMemo(() => {
        const stops = [];
        goldGraphData.forEach((d, i) => {
            if (i === 0) return;
            const prev = goldGraphData[i - 1];
            // If sign changed, we crossed zero
            if ((prev.diff > 0 && d.diff < 0) || (prev.diff < 0 && d.diff > 0)) {
                // Linear interpolation to find exact time of crossing
                const ratio = Math.abs(prev.diff) / (Math.abs(prev.diff) + Math.abs(d.diff));
                const crossingT = prev.t + (d.t - prev.t) * ratio;
                const offset = (crossingT / duration) * 100;
                stops.push({ offset, color: prev.diff > 0 ? '#3b82f6' : '#ef4444' }); // End previous color
                stops.push({ offset, color: d.diff > 0 ? '#3b82f6' : '#ef4444' }); // Start new color
            }
        });
        // Add start/end
        if (goldGraphData.length > 0) {
            const startColor = goldGraphData[0].diff >= 0 ? '#3b82f6' : '#ef4444';
            const endColor = goldGraphData[goldGraphData.length - 1].diff >= 0 ? '#3b82f6' : '#ef4444';
            return [
                { offset: 0, color: startColor },
                ...stops,
                { offset: 100, color: endColor }
            ];
        }
        return [];
    }, [goldGraphData, duration]);


    // Pre-calculate Champion Paths
    const championPaths = useMemo(() => {
        const paths = {};
        const allPositions = match.all_positions || {};

        match.participants.forEach(p => {
            const pid = p.participantId;
            paths[p.puuid] = [];

            // Add movement frames from backend
            if (allPositions[pid]) {
                allPositions[pid].forEach(pos => {
                    paths[p.puuid].push({ t: pos.t, x: pos.x, y: pos.y, type: 'move' });
                });
            } else {
                // Fallback if no movement data
                const blue = isBlueTeam(p);
                const fountain = blue ? { x: 500, y: 500 } : { x: 14300, y: 14300 };
                paths[p.puuid].push({ t: 0, x: fountain.x, y: fountain.y, type: 'spawn' });
            }
        });

        const events = (match.kill_events || []).sort((a, b) => a.timestamp - b.timestamp);

        events.forEach(e => {
            const timeMin = e.timestamp / 60000;
            const killer = match.participants.find(p => p.champion_name === e.killer?.championName);
            const victim = match.participants.find(p => p.champion_name === e.victim?.championName);

            if (killer) {
                paths[killer.puuid].push({ t: timeMin, x: e.position.x, y: e.position.y, type: 'kill' });
            }
            if (victim) {
                paths[victim.puuid].push({ t: timeMin, x: e.position.x, y: e.position.y, type: 'death' });
                const respawnTime = timeMin + getDeathTimer(timeMin);
                const blue = isBlueTeam(victim);
                const fountain = blue ? { x: 500, y: 500 } : { x: 14300, y: 14300 };
                paths[victim.puuid].push({ t: respawnTime, x: fountain.x, y: fountain.y, type: 'respawn' });
            }
        });

        Object.keys(paths).forEach(id => {
            paths[id].sort((a, b) => a.t - b.t);
        });

        return paths;
    }, [match]);

    // Calculate Current State
    const championStates = useMemo(() => {
        const states = {};

        match.participants.forEach(p => {
            const path = championPaths[p.puuid];
            let currentState = {
                x: path[0].x,
                y: path[0].y,
                isDead: false,
                isKilling: false,
                targetPos: null,
                championName: p.champion_name,
                teamId: p.teamId,
                participantId: p.participantId,
                puuid: p.puuid,
                isBlue: isBlueTeam(p)
            };

            let prev = path[0];
            let next = null;

            for (let i = 0; i < path.length; i++) {
                if (path[i].t <= currentTime) {
                    prev = path[i];
                } else {
                    next = path[i];
                    break;
                }
            }

            if (prev.type === 'death') {
                if (next && next.type === 'respawn' && currentTime < next.t) {
                    currentState.isDead = true;
                    currentState.x = prev.x;
                    currentState.y = prev.y;
                } else if (!next) {
                    currentState.isDead = true;
                    currentState.x = prev.x;
                    currentState.y = prev.y;
                }
            } else {
                if (next) {
                    const progress = (currentTime - prev.t) / (next.t - prev.t);
                    currentState.x = prev.x + (next.x - prev.x) * progress;
                    currentState.y = prev.y + (next.y - prev.y) * progress;
                    currentState.targetPos = { x: next.x, y: next.y };
                } else {
                    currentState.x = prev.x;
                    currentState.y = prev.y;
                }
            }

            if (prev.type === 'kill' && (currentTime - prev.t) < (5 / 60)) {
                currentState.isKilling = true;
            }

            states[p.puuid] = currentState;
        });

        return states;
    }, [championPaths, currentTime, match.participants]);

    // Tower Constants (Approximate Positions)
    const TOWERS = {
        100: [ // Blue Team
            { lane: 'TOP_LANE', type: 'OUTER_TURRET', x: 981, y: 10441 },
            { lane: 'TOP_LANE', type: 'INNER_TURRET', x: 1512, y: 6699 },
            { lane: 'TOP_LANE', type: 'BASE_TURRET', x: 1169, y: 4287 },
            { lane: 'MID_LANE', type: 'OUTER_TURRET', x: 5846, y: 6396 },
            { lane: 'MID_LANE', type: 'INNER_TURRET', x: 5048, y: 4812 },
            { lane: 'MID_LANE', type: 'BASE_TURRET', x: 3651, y: 3696 },
            { lane: 'BOT_LANE', type: 'OUTER_TURRET', x: 10504, y: 1029 },
            { lane: 'BOT_LANE', type: 'INNER_TURRET', x: 6919, y: 1483 },
            { lane: 'BOT_LANE', type: 'BASE_TURRET', x: 4281, y: 1253 },
            { lane: 'MID_LANE', type: 'NEXUS_TURRET', x: 1748, y: 2270 }, // Nexus 1
            { lane: 'MID_LANE', type: 'NEXUS_TURRET', x: 2177, y: 1807 }, // Nexus 2
        ],
        200: [ // Red Team
            { lane: 'TOP_LANE', type: 'OUTER_TURRET', x: 4318, y: 13875 },
            { lane: 'TOP_LANE', type: 'INNER_TURRET', x: 7943, y: 13411 },
            { lane: 'TOP_LANE', type: 'BASE_TURRET', x: 10481, y: 13650 },
            { lane: 'MID_LANE', type: 'OUTER_TURRET', x: 8955, y: 8510 },
            { lane: 'MID_LANE', type: 'INNER_TURRET', x: 9767, y: 10113 },
            { lane: 'MID_LANE', type: 'BASE_TURRET', x: 11134, y: 11207 },
            { lane: 'BOT_LANE', type: 'OUTER_TURRET', x: 13866, y: 4505 },
            { lane: 'BOT_LANE', type: 'INNER_TURRET', x: 13327, y: 8226 },
            { lane: 'BOT_LANE', type: 'BASE_TURRET', x: 13624, y: 10572 },
            { lane: 'MID_LANE', type: 'NEXUS_TURRET', x: 12611, y: 13084 }, // Nexus 1
            { lane: 'MID_LANE', type: 'NEXUS_TURRET', x: 13052, y: 12612 }, // Nexus 2
        ]
    };

    // Active Towers Calculation
    const activeTowers = useMemo(() => {
        const towers = [];

        // Helper to check if a specific tower is dead
        const isTowerDead = (teamId, lane, type, x, y) => {
            return (match.building_events || []).some(e => {
                if (e.timestamp / 60000 > currentTime) return false;
                if (e.type !== "BUILDING_KILL") return false;
                if (e.buildingType !== "TOWER_BUILDING") return false;

                // Match team
                // In Riot API BUILDING_KILL: teamId is the team of the BUILDING that died.
                // So if teamId is 200, a Red tower died.

                // If we have position in event, match by position (most reliable)
                if (e.position && Math.abs(e.position.x - x) < 200 && Math.abs(e.position.y - y) < 200) {
                    return true;
                }

                // Fallback: match by lane/type/teamId
                // e.teamId is the VICTIM team (the building's team).
                if (e.teamId === teamId && e.laneType === lane && e.towerType === type) {
                    return true;
                }

                return false;
            });
        };

        [100, 200].forEach(teamId => {
            TOWERS[teamId].forEach(t => {
                if (!isTowerDead(teamId, t.lane, t.type, t.x, t.y)) {
                    towers.push({ ...t, teamId });
                }
            });
        });

        return towers;
    }, [match.building_events, currentTime]);

    // Active Wards Calculation
    const activeWards = useMemo(() => {
        const wards = [];
        (match.ward_events || []).forEach(e => {
            const timeMin = e.timestamp / 60000;
            if (timeMin > currentTime) return;

            // Ward Lifetimes (approximate)
            let lifetime = 0;
            if (e.wardType === "YELLOW_TRINKET") lifetime = 1.5; // ~90s
            else if (e.wardType === "SIGHT_WARD") lifetime = 2.5; // ~150s
            else if (e.wardType === "CONTROL_WARD") lifetime = 1000; // Indefinite (until killed)
            else if (e.wardType === "BLUE_TRINKET") lifetime = 1000; // Indefinite

            // Check if expired
            if (currentTime > timeMin + lifetime) return;

            if (e.type === "WARD_PLACED" && e.position) {
                // Determine team color
                const creator = match.participants.find(p => p.participantId === e.creatorId);
                const isBlue = creator ? isBlueTeam(creator) : true; // Default to blue if unknown

                wards.push({
                    x: e.position.x,
                    y: e.position.y,
                    type: e.wardType,
                    creatorId: e.creatorId,
                    isBlue: isBlue
                });
            }
        });
        return wards;
    }, [match.ward_events, currentTime, match.participants]);

    // Scoreboard Data
    const currentStats = useMemo(() => {
        const stats = {};
        match.participants.forEach(p => {
            stats[p.puuid] = {
                kills: 0, deaths: 0, assists: 0,
                cs: 0, gold: 500, items: []
            };
        });

        (match.kill_events || []).forEach(e => {
            if (e.timestamp / 60000 <= currentTime) {
                const victim = match.participants.find(p => p.champion_name === e.victim?.championName);
                if (victim) stats[victim.puuid].deaths++;

                const killer = match.participants.find(p => p.champion_name === e.killer?.championName);
                if (killer) stats[killer.puuid].kills++;

                (e.assistingParticipantIds || []).forEach(id => {
                    const assister = match.participants.find(p => p.participantId === id);
                    if (assister) stats[assister.puuid].assists++;
                });
            }
        });

        match.participants.forEach(p => {
            const progress = Math.min(1, currentTime / duration);
            stats[p.puuid].cs = Math.floor(p.total_minions_killed * progress);
            stats[p.puuid].gold = Math.floor(p.gold_earned * progress);

            // Calculate Live Items
            if (p.item_build && p.item_build.length > 0) {
                const currentItems = [];
                // Sort events by timestamp just in case
                const events = [...p.item_build].sort((a, b) => a.timestamp - b.timestamp);

                events.forEach(e => {
                    if (e.timestamp / 60000 > currentTime) return;

                    if (e.type === "ITEM_PURCHASED") {
                        if (currentItems.length < 7) { // 6 items + trinket technically, but let's just push
                            currentItems.push(e.itemId);
                        }
                    } else if (e.type === "ITEM_SOLD") {
                        const idx = currentItems.indexOf(e.itemId);
                        if (idx > -1) currentItems.splice(idx, 1);
                    } else if (e.type === "ITEM_UNDO") {
                        // Undo can be complex. 
                        // If we bought item X, undo removes X.
                        // If we sold item Y, undo adds Y back.
                        if (e.afterId === 0 && e.beforeId > 0) {
                            // This looks like an undo of a purchase (item removed)
                            const idx = currentItems.indexOf(e.beforeId);
                            if (idx > -1) currentItems.splice(idx, 1);
                        } else if (e.afterId > 0 && e.beforeId === 0) {
                            // This looks like an undo of a sell (item added back)
                            currentItems.push(e.afterId);
                        }
                    } else if (e.type === "ITEM_DESTROYED") {
                        // Consumable used (potion, ward, biscuit, etc.)
                        const idx = currentItems.indexOf(e.itemId);
                        if (idx > -1) currentItems.splice(idx, 1);
                    }
                });
                // Ensure we only show up to 6 items (excluding trinket logic for now for simplicity, or just show first 6)
                stats[p.puuid].items = currentItems.slice(0, 6);
            } else {
                // Fallback to final items
                stats[p.puuid].items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter(id => id > 0);
            }
        });

        return stats;
    }, [match, currentTime, duration]);

    // Removed duplicate declarations here
    const team100Gold = match.participants.filter(p => isBlueTeam(p)).reduce((sum, p) => sum + currentStats[p.puuid].gold, 0);
    const team200Gold = match.participants.filter(p => !isBlueTeam(p)).reduce((sum, p) => sum + currentStats[p.puuid].gold, 0);
    const goldAdvantage = team100Gold - team200Gold;

    const feedEvents = useMemo(() => {
        const kills = (match.kill_events || []).map(e => ({ ...e, eventType: 'kill' }));
        const wards = (match.ward_events || []).filter(e => e.type === 'WARD_PLACED').map(e => ({ ...e, eventType: 'ward' }));
        const buildings = (match.building_events || []).map(e => ({ ...e, eventType: 'building' }));

        const all = [...kills, ...wards, ...buildings].sort((a, b) => a.timestamp - b.timestamp);
        return all.filter(e => e.timestamp / 60000 <= currentTime);
    }, [match, currentTime]);

    const getTeamColor = (championName) => {
        const p = match.participants.find(p => p.champion_name === championName);
        if (!p) return "text-slate-400";
        return isBlueTeam(p) ? "text-blue-400" : "text-red-400";
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Left Column: Map + Timeline */}
                <div className="flex-1 flex flex-col gap-4 w-full max-w-[750px]">
                    {/* ... Map and Timeline content ... */}
                    <div className="bg-slate-900 rounded-lg border border-slate-700 relative overflow-hidden flex items-center justify-center p-4">
                        {/* Map Container */}
                        <div className="relative w-full aspect-square">
                            <img
                                src="/map_background.jpg"
                                className="w-full h-full object-cover opacity-80"
                                alt="Summoner's Rift"
                            />

                            {/* Champions */}
                            {Object.values(championStates).map((state, i) => (
                                <React.Fragment key={i}>
                                    {state.targetPos && !state.isDead && (
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                            <line
                                                x1={`${(state.x / mapSize) * 100}%`}
                                                y1={`${100 - (state.y / mapSize) * 100}%`}
                                                x2={`${(state.targetPos.x / mapSize) * 100}%`}
                                                y2={`${100 - (state.targetPos.y / mapSize) * 100}%`}
                                                stroke={state.isBlue ? "rgba(59, 130, 246, 0.4)" : "rgba(239, 68, 68, 0.4)"}
                                                strokeWidth="1"
                                                strokeDasharray="4 2"
                                            />
                                        </svg>
                                    )}

                                    <div
                                        className={clsx(
                                            "absolute w-8 h-8 -ml-4 -mb-4 transition-all duration-300 z-10",
                                            state.isDead ? "grayscale opacity-60" :
                                                state.isKilling ? "scale-125 z-20 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" : ""
                                        )}
                                        style={getMapStyle(state.x, state.y)}
                                    >
                                        <div className={clsx(
                                            "w-full h-full overflow-hidden border-2 rounded-sm",
                                            state.isDead ? "border-slate-500" :
                                                state.isKilling ? "border-yellow-400" :
                                                    state.isBlue ? "border-blue-500" : "border-red-500"
                                        )}>
                                            <img
                                                src={getChampionIconUrl(state.championName)}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {state.isKilling && (
                                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xl filter drop-shadow-md">
                                                ⚔️
                                            </div>
                                        )}
                                        {state.isDead && (
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-300 bg-black/50 px-1 rounded">
                                                DEAD
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            ))}

                            {/* Towers */}
                            {activeTowers.map((tower, i) => (
                                <div
                                    key={`tower-${i}`}
                                    className={clsx(
                                        "absolute w-6 h-6 -ml-3 -mb-3 z-0",
                                        tower.teamId === 100 ? "text-blue-600" : "text-red-600"
                                    )}
                                    style={getMapStyle(tower.x, tower.y)}
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-md">
                                        <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20H5.5L12 5.5z" />
                                        <rect x="10" y="10" width="4" height="10" />
                                    </svg>
                                </div>
                            ))}

                            {/* Wards */}
                            {activeWards.map((ward, i) => {
                                const radiusPercent = (ward.type === "CONTROL_WARD" || ward.type === "BLUE_TRINKET") ? 6.07 : 7.42;
                                return (
                                    <React.Fragment key={`ward-${i}`}>
                                        {/* Vision Radius */}
                                        <div
                                            className={clsx(
                                                "absolute rounded-full pointer-events-none z-0",
                                                ward.isBlue ? "bg-blue-400/10 border border-blue-400/20" : "bg-red-400/10 border border-red-400/20"
                                            )}
                                            style={{
                                                ...getMapStyle(ward.x, ward.y),
                                                width: `${radiusPercent}%`,
                                                height: `${radiusPercent}%`,
                                                transform: 'translate(-50%, 50%)' // Center on point (bottom-left origin for map style)
                                            }}
                                        />
                                        {/* Ward Icon */}
                                        <div
                                            className={clsx(
                                                "absolute w-3 h-3 -ml-1.5 -mb-1.5 z-10 opacity-90",
                                                ward.type === "CONTROL_WARD" ? "text-red-500" :
                                                    ward.isBlue ? "text-blue-300" : "text-red-300"
                                            )}
                                            style={getMapStyle(ward.x, ward.y)}
                                        >
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-md">
                                                <circle cx="12" cy="12" r="10" />
                                                {ward.type === "CONTROL_WARD" && <circle cx="12" cy="12" r="4" fill="black" opacity="0.5" />}
                                            </svg>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timeline & Gold Graph */}
                    <div className="bg-slate-900/90 backdrop-blur p-4 rounded-lg border border-slate-700">
                        {/* Gold Graph */}
                        <div className="h-20 w-full mb-4 relative flex items-end px-2">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id={`goldGradient-${puuid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                        {gradientStops.map((stop, i) => (
                                            <stop key={i} offset={`${stop.offset}%`} stopColor={stop.color} />
                                        ))}
                                    </linearGradient>
                                </defs>
                                {/* Zero Line */}
                                <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />

                                {/* Graph Line */}
                                <polyline
                                    points={goldGraphData.map((d, i) => {
                                        const x = (d.t / duration) * 100;
                                        const y = 50 - (d.diff / maxAbsLead) * 40; // 50% is center
                                        return `${x},${Math.max(5, Math.min(95, y))}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke={`url(#goldGradient-${puuid})`}
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                />

                                {/* Current Time Dot on Graph */}
                                {(() => {
                                    const currentData = goldGraphData.find(d => d.t >= currentTime) || goldGraphData[goldGraphData.length - 1];
                                    if (currentData) {
                                        const x = (currentTime / duration) * 100;
                                        const y = 50 - (currentData.diff / maxAbsLead) * 40;
                                        return (
                                            <circle
                                                cx={x}
                                                cy={Math.max(5, Math.min(95, y))}
                                                r="2"
                                                fill={currentData.diff > 0 ? "#3b82f6" : "#ef4444"}
                                                stroke="white"
                                                strokeWidth="1"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        );
                                    }
                                })()}
                            </svg>
                        </div>

                        {/* Slider Controls */}
                        <div className="flex justify-between text-xs text-slate-400 mb-2 relative">
                            <span>0:00</span>
                            <div className="flex flex-col items-center">
                                <span className="text-white font-bold text-lg">{Math.floor(currentTime)}:{(Math.floor((currentTime % 1) * 60)).toString().padStart(2, '0')}</span>
                                <span className={clsx("text-xs font-bold", goldAdvantage > 0 ? "text-blue-400" : "text-red-400")}>
                                    {goldAdvantage > 0 ? "Blue" : "Red"} +{(Math.abs(goldAdvantage) / 1000).toFixed(1)}k
                                </span>
                            </div>
                            <span>{duration}:00</span>
                        </div>
                        <div className="relative h-6 flex items-center">
                            {/* Max Lead Markers */}
                            {maxBlue.diff > 0 && (
                                <div
                                    className="absolute -top-6 -translate-x-1/2 flex flex-col items-center group"
                                    style={{ left: `${(maxBlue.t / duration) * 100}%` }}
                                >
                                    <span className="text-[10px] text-blue-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 px-1 rounded border border-blue-900">
                                        +{(maxBlue.diff / 1000).toFixed(1)}k
                                    </span>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full border border-slate-900" />
                                </div>
                            )}
                            {maxRed.diff < 0 && (
                                <div
                                    className="absolute -top-6 -translate-x-1/2 flex flex-col items-center group"
                                    style={{ left: `${(maxRed.t / duration) * 100}%` }}
                                >
                                    <span className="text-[10px] text-red-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 px-1 rounded border border-red-900">
                                        +{(Math.abs(maxRed.diff) / 1000).toFixed(1)}k
                                    </span>
                                    <div className="w-2 h-2 bg-red-500 rounded-full border border-slate-900" />
                                </div>
                            )}

                            <input
                                type="range"
                                min="0"
                                max={duration}
                                step="0.25"
                                value={currentTime}
                                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer relative z-10"
                                style={{
                                    backgroundImage: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #334155 ${(currentTime / duration) * 100}%, #334155 100%)`
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Event Feed - Fixed Height */}
                <div
                    className="w-full lg:w-80 bg-slate-900 rounded-lg border border-slate-700 flex flex-col shrink-0"
                    style={{ height: '780px' }}
                >
                    <div className="p-3 border-b border-slate-700 font-bold text-slate-300">
                        Event Log
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {feedEvents.length === 0 && <div className="text-center text-slate-500 py-4">No events yet</div>}
                        {feedEvents.slice().reverse().map((e, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded border border-slate-700/50 text-xs">
                                <span className="text-slate-500 font-mono w-8">{Math.floor(e.timestamp / 60000)}m</span>

                                {e.eventType === 'kill' && (
                                    <>
                                        <div className="flex items-center gap-1">
                                            <img src={getChampionIconUrl(e.killer?.championName)} className="w-4 h-4 rounded-full" />
                                            <span className={clsx("font-bold", getTeamColor(e.killer?.championName))}>
                                                {e.killer?.championName}
                                            </span>
                                        </div>
                                        <span className="text-slate-600">killed</span>
                                        <div className="flex items-center gap-1">
                                            <img src={getChampionIconUrl(e.victim?.championName)} className="w-4 h-4 rounded-full" />
                                            <span className={clsx("font-bold", getTeamColor(e.victim?.championName))}>
                                                {e.victim?.championName}
                                            </span>
                                        </div>
                                    </>
                                )}

                                {e.eventType === 'ward' && (
                                    <div className="flex items-center gap-1 text-slate-400">
                                        <span>👁️</span>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1">
                                                <span className={clsx("font-bold", getTeamColor(match.participants.find(p => p.participantId === e.creatorId)?.champion_name))}>
                                                    {match.participants.find(p => p.participantId === e.creatorId)?.champion_name || "Unknown"}
                                                </span>
                                                <span>placed</span>
                                            </div>
                                            <span className="text-[10px] text-slate-500">
                                                {e.wardType === "CONTROL_WARD" ? "Control Ward" :
                                                    e.wardType === "BLUE_TRINKET" ? "Farsight Alteration" : "Stealth Ward"}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {e.eventType === 'building' && (
                                    <div className="flex items-center gap-1 text-slate-400">
                                        <span>💥</span>
                                        <span>Turret destroyed</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scoreboard */}
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                    <h3 className="text-sm font-bold text-slate-300 uppercase">Scoreboard (Estimated)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="text-slate-500 bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                <th className="px-4 py-3">Champion</th>
                                <th className="px-4 py-3 text-center">KDA</th>
                                <th className="px-4 py-3 text-center">CS</th>
                                <th className="px-4 py-3 text-center">Gold</th>
                                <th className="px-4 py-3">Items (Final)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {match.participants.map(p => {
                                const stats = currentStats[p.puuid];
                                const isDead = championStates[p.puuid]?.isDead;
                                const isBlue = isBlueTeam(p);

                                return (
                                    <tr key={p.puuid} className={clsx(
                                        "transition-colors",
                                        isDead ? "bg-red-900/20 grayscale opacity-70" : "hover:bg-slate-800/30"
                                    )}>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-3">
                                                <div className={clsx(
                                                    "w-8 h-8 rounded-sm border",
                                                    isDead ? "border-slate-600" :
                                                        isBlue ? "border-blue-500" : "border-red-500"
                                                )}>
                                                    <img src={getChampionIconUrl(p.champion_name)} className="w-full h-full" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={clsx("font-bold", isBlue ? "text-blue-400" : "text-red-400")}>
                                                        {p.champion_name}
                                                    </span>
                                                    <span className="text-slate-500 text-[10px]">{p.riot_id.split('#')[0]}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-center font-mono text-slate-300">
                                            {stats.kills}/{stats.deaths}/{stats.assists}
                                        </td>
                                        <td className="px-4 py-2 text-center text-slate-400">
                                            {stats.cs}
                                        </td>
                                        <td className="px-4 py-2 text-center text-yellow-600">
                                            {(stats.gold / 1000).toFixed(1)}k
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex gap-1">
                                                {stats.items.map((itemId, i) => (
                                                    itemId > 0 ? (
                                                        <img key={i} src={getItemIconUrl(itemId)} className="w-6 h-6 rounded border border-slate-700" />
                                                    ) : (
                                                        <div key={i} className="w-6 h-6 rounded border border-slate-800 bg-slate-900/50" />
                                                    )
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
