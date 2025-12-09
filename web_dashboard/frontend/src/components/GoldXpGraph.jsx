import React from 'react';
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

export default function GoldXpGraph({ goldXpSeries, teamGoldDiff }) {
    if (!goldXpSeries || goldXpSeries.length === 0) {
        return <div className="text-slate-400 text-center p-4">No timeline data available</div>;
    }

    // Merge data for the chart
    // We assume both arrays are sorted by time and roughly aligned by minute
    const data = goldXpSeries.map((gx, i) => {
        const diff = teamGoldDiff && teamGoldDiff[i] ? teamGoldDiff[i].gold_diff : 0;
        return {
            ...gx,
            gold_diff: diff
        };
    });

    const formatGold = (value) => {
        if (Math.abs(value) >= 1000) {
            return `${(value / 1000).toFixed(1)}k`;
        }
        return value;
    };

    return (
        <div className="space-y-8">
            {/* Player Gold & XP Growth */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                <h3 className="text-white font-bold mb-4 font-serif">Player Growth (Gold & XP)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} />
                            <XAxis
                                dataKey="time_min"
                                stroke="#94a3b8"
                                strokeOpacity={0.5}
                                tickFormatter={(val) => `${Math.round(val)}m`}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="#94a3b8"
                                tickFormatter={formatGold}
                                label={{ value: 'Gold', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="#64748b"
                                label={{ value: 'XP', angle: 90, position: 'insideRight', fill: '#64748b' }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                formatter={(value, name) => [
                                    name === 'total_gold' ? formatGold(value) : value,
                                    name === 'total_gold' ? 'Total Gold' : 'XP'
                                ]}
                                labelFormatter={(label) => `${Math.round(label)} min`}
                            />
                            <Legend />
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="total_gold"
                                fill="#eab308"
                                stroke="#eab308"
                                fillOpacity={0.1}
                                name="Total Gold"
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="xp"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                                name="XP"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Team Gold Difference */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                <h3 className="text-white font-bold mb-4 font-serif">Team Gold Difference</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} />
                            <XAxis
                                dataKey="time_min"
                                stroke="#94a3b8"
                                strokeOpacity={0.5}
                                tickFormatter={(val) => `${Math.round(val)}m`}
                            />
                            <YAxis
                                stroke="#e2e8f0"
                                tickFormatter={formatGold}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                formatter={(value) => [formatGold(value), 'Gold Diff']}
                                labelFormatter={(label) => `${Math.round(label)} min`}
                            />
                            <ReferenceLine y={0} stroke="#94a3b8" strokeOpacity={0.3} />
                            <Area
                                type="monotone"
                                dataKey="gold_diff"
                                stroke="#f43f5e"
                                fill="#f43f5e"
                                fillOpacity={0.2}
                                name="Gold Diff"
                            />
                            <defs>
                                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={0.5} stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset={0.5} stopColor="#ef4444" stopOpacity={0.3} />
                                </linearGradient>
                            </defs>
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
