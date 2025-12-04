import React, { useState } from 'react';
import clsx from 'clsx';
import Scoreboard from './Scoreboard';
import BuildAnalysis from './BuildAnalysis';
import TimelineMap from './TimelineMap';
import GoldXpGraph from './GoldXpGraph';

export default function MatchDetailView({ match, puuid }) {
    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'build', label: 'Build' },
        { id: 'timeline', label: 'Timeline' },
    ];

    return (
        <div className="bg-slate-800 border-x border-b border-slate-700 rounded-b-lg -mt-3 mx-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Tabs */}
            <div className="flex border-b border-slate-700 bg-slate-900/50">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "px-6 py-3 text-sm font-medium transition-colors relative",
                            activeTab === tab.id ? "text-white" : "text-slate-400 hover:text-slate-200"
                        )}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-4">
                {activeTab === 'overview' && <Scoreboard match={match} puuid={puuid} />}
                {activeTab === 'build' && <BuildAnalysis match={match} puuid={puuid} />}
                {activeTab === 'timeline' && (
                    <div className="space-y-8">
                        <GoldXpGraph
                            goldXpSeries={match.gold_xp_series}
                            teamGoldDiff={match.team_gold_diff}
                        />
                        <TimelineMap match={match} puuid={puuid} showWards={false} />
                    </div>
                )}
            </div>
        </div>
    );
}
