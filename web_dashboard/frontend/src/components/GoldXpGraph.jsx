
import React, { useState, useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import clsx from 'clsx';
import { getChampionIconUrl } from '../utils/dataDragon';

export default function GoldXpGraph({ goldXpSeries, teamGoldDiff, allGoldXpData, participants, puuid }) {
    // Default to showing only the user if no selection state exists yet
    const selfParticipant = participants?.find(p => p.puuid === puuid);
    const selfPid = selfParticipant?.participant_id;

    const [selectedPids, setSelectedPids] = useState(selfPid ? [selfPid] : []);
    const [hoveredPid, setHoveredPid] = useState(null);

    // Color palette for lines
    // Color palette for lines - Distinct colors for clarity while preserving team identity (Cool vs Warm)
    const TEAM_COLORS = {
        100: ['#22d3ee', '#3b82f6', '#6366f1', '#34d399', '#a855f7'], // Blue Team (Cyan, Blue, Indigo, Emerald, Purple)
        200: ['#ef4444', '#f97316', '#f59e0b', '#f43f5e', '#ec4899']  // Red Team (Red, Orange, Amber, Rose, Pink)
    };

    // Prepare chart data
    const chartData = useMemo(() => {
        if (!allGoldXpData || Object.keys(allGoldXpData).length === 0) {
            // Fallback to legacy single-user data if available
            if (goldXpSeries) {
                return goldXpSeries.map((gx, i) => {
                    const diff = teamGoldDiff && teamGoldDiff[i] ? teamGoldDiff[i].gold_diff : 0;
                    return {
                        time_min: gx.time_min,
                        gold_diff: diff,
                        [`gold_${selfPid}`]: gx.total_gold,
                        [`xp_${selfPid}`]: gx.xp
                    };
                });
            }
            return [];
        }

        // Merge all selected players' data by timestamp
        // We assume all series have similar timestamps (every minute)
        const timeMap = new Map();

        // Initialize with team gold diff if available
        if (teamGoldDiff) {
            teamGoldDiff.forEach(d => {
                const t = Math.round(d.time_min); // Round to avoid float mismatches
                if (!timeMap.has(t)) timeMap.set(t, { time_min: d.time_min, gold_diff: d.gold_diff });
            });
        }

        Object.entries(allGoldXpData).forEach(([pid, series]) => {
            series.forEach(point => {
                const t = Math.round(point.time_min);
                if (!timeMap.has(t)) {
                    timeMap.set(t, { time_min: point.time_min });
                }
                const entry = timeMap.get(t);
                entry[`gold_${pid}`] = point.total_gold;
                entry[`xp_${pid}`] = point.xp;
            });
        });

        return Array.from(timeMap.values()).sort((a, b) => a.time_min - b.time_min);
    }, [allGoldXpData, teamGoldDiff, goldXpSeries, selfPid]);

    if (!chartData || chartData.length === 0) {
        return <div className="text-slate-400 text-center p-4">No timeline data available</div>;
    }

    const formatGold = (value) => {
        if (Math.abs(value) >= 1000) {
            return `${(value / 1000).toFixed(1)}k`;
        }
        return value;
    };

    const togglePid = (pid) => {
        if (selectedPids.includes(pid)) {
            // Don't allow deselecting the last one? Or maybe allow it.
            if (selectedPids.length > 1) {
                setSelectedPids(selectedPids.filter(id => id !== pid));
            }
        } else {
            if (selectedPids.length < 10) { // Allow up to all 10 players
                setSelectedPids([...selectedPids, pid]);
            }
        }
    };

    const getPlayerColor = (pid) => {
        const p = participants?.find(part => part.participant_id === parseInt(pid));
        if (!p) return '#94a3b8';
        const teamColors = TEAM_COLORS[p.team_id] || TEAM_COLORS[100];
        // Use a consistent index based on participant ID within team to pick specific shade?
        // Or just fixed based on role? simplified for now:
        const index = (p.participant_id - 1) % 5;
        return teamColors[index];
    };

    return (
        <div className="space-y-6">
            {/* Player Selector */}
            {participants && (
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                    {participants.map(p => {
                        const isSelected = selectedPids.includes(p.participant_id);
                        const color = getPlayerColor(p.participant_id);
                        return (
                            <button
                                key={p.participant_id}
                                onClick={() => togglePid(p.participant_id)}
                                onMouseEnter={() => setHoveredPid(p.participant_id)}
                                onMouseLeave={() => setHoveredPid(null)}
                                className={clsx(
                                    "relative group transition-all duration-200 p-1 rounded-lg border-2",
                                    isSelected
                                        ? "scale-110 bg-slate-800"
                                        : "opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:scale-105 border-transparent hover:bg-slate-800"
                                )}
                                style={{ borderColor: isSelected ? color : 'transparent' }}
                                title={p.champion_name}
                            >
                                <img
                                    src={getChampionIconUrl(p.champion_name)}
                                    className="w-8 h-8 rounded"
                                    alt={p.champion_name}
                                />
                                {isSelected && (
                                    <div
                                        className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-slate-900"
                                        style={{ backgroundColor: color }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Player Gold & XP Growth */}
                <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg h-full flex flex-col">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-pink-900/20 to-transparent">
                        <div className="w-1 h-5 bg-pink-500 rounded-full shadow-[0_0_12px_rgba(236,72,153,0.6)]" />
                        <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">
                            Gold Growth <span className="text-slate-500 font-normal ml-2 text-xs normal-case">(Comparison)</span>
                        </h3>
                    </div>
                    <div className="p-4 flex-1">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} vertical={false} />
                                    <XAxis
                                        dataKey="time_min"
                                        stroke="#94a3b8"
                                        strokeOpacity={0.5}
                                        tickFormatter={(val) => `${Math.round(val)}m`}
                                        tick={{ fill: '#64748b', fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        tickFormatter={formatGold}
                                        stroke="#94a3b8"
                                        tick={{ fill: '#64748b', fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            color: '#f8fafc',
                                            borderRadius: '8px',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                            padding: '8px 12px',
                                            fontSize: '12px'
                                        }}
                                        itemStyle={{ padding: 0 }}
                                        formatter={(value) => formatGold(value)}
                                        labelFormatter={(label) => `${Math.round(label)} min`}
                                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                                    />
                                    <Legend />

                                    {/* Render lines for selected players */}
                                    {selectedPids.map(pid => {
                                        const p = participants?.find(part => part.participant_id === pid);
                                        const name = p ? p.champion_name : `Player ${pid}`;
                                        const color = getPlayerColor(pid);
                                        const isHovered = hoveredPid === pid;

                                        return (
                                            <Line
                                                key={pid}
                                                type="monotone"
                                                dataKey={`gold_${pid}`}
                                                stroke={color}
                                                strokeWidth={isHovered ? 4 : 2}
                                                dot={false}
                                                activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                                                name={name}
                                                opacity={hoveredPid && hoveredPid !== pid ? 0.3 : 1}
                                                style={{ transition: 'all 0.3s' }}
                                            />
                                        );
                                    })}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>


                {/* Team Gold Difference */}
                <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-violet-900/20 to-transparent">
                        <div className="w-1 h-5 bg-violet-500 rounded-full shadow-[0_0_12px_rgba(139,92,246,0.6)]" />
                        <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">
                            Team Gold Difference
                        </h3>
                    </div>
                    <div className="p-4 flex-1">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} vertical={false} />
                                    <XAxis
                                        dataKey="time_min"
                                        stroke="#94a3b8"
                                        strokeOpacity={0.5}
                                        tickFormatter={(val) => `${Math.round(val)}m`}
                                        tick={{ fill: '#64748b', fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        stroke="#e2e8f0"
                                        tickFormatter={formatGold}
                                        tick={{ fill: '#64748b', fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            color: '#f8fafc',
                                            borderRadius: '8px',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                            padding: '8px 12px',
                                            fontSize: '12px'
                                        }}
                                        formatter={(value) => [formatGold(value), 'Gold Diff']}
                                        labelFormatter={(label) => `${Math.round(label)} min`}
                                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                                    />
                                    <ReferenceLine y={0} stroke="#94a3b8" strokeOpacity={0.3} strokeDasharray="3 3" />
                                    <Area
                                        type="monotone"
                                        dataKey="gold_diff"
                                        stroke="url(#splitColorStroke)"
                                        fill="url(#splitColorFill)"
                                        fillOpacity={1}
                                        strokeWidth={2}
                                        name="Gold Diff"
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                                    />
                                    <defs>
                                        <linearGradient id="splitColorFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                                            <stop offset="50%" stopColor="#3b82f6" stopOpacity={0} />
                                            <stop offset="50%" stopColor="#ef4444" stopOpacity={0} />
                                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                                        </linearGradient>
                                        <linearGradient id="splitColorStroke" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#60a5fa" />
                                            <stop offset="45%" stopColor="#60a5fa" />
                                            <stop offset="55%" stopColor="#f87171" />
                                            <stop offset="100%" stopColor="#f87171" />
                                        </linearGradient>
                                    </defs>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
