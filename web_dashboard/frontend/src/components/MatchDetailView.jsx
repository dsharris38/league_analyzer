import React, { useState } from 'react';
import clsx from 'clsx';
import Scoreboard from './Scoreboard';
import BuildAnalysis from './BuildAnalysis';
import TimelineMap from './TimelineMap';
import GoldXpGraph from './GoldXpGraph';

export default function MatchDetailView({ match, puuid, onClose, onPlayerClick }) {
    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'build', label: 'Build' },
        { id: 'timeline', label: 'Timeline' },
    ];

    const selfParams = match.participants.find(p => p.puuid === puuid);
    const isWin = selfParams?.win;

    return (
        <div className={clsx(
            "bg-slate-900/60 border-r border-b border-white/5 rounded-b-xl p-2 pt-4 animate-in slide-in-from-top-2 duration-200 mb-4 shadow-xl backdrop-blur-md relative z-0 -mt-2",
            isWin ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-red-500"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
                <div className="flex bg-slate-900/50 rounded-lg p-1 border border-white/5">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                                activeTab === tab.id
                                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="text-xs font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wider flex items-center gap-1"
                >
                    Collapse <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[300px]">
                {activeTab === 'overview' && <Scoreboard match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
                {activeTab === 'build' && <BuildAnalysis match={match} puuid={puuid} />}
                {activeTab === 'timeline' && (
                    <div className="space-y-6">
                        <GoldXpGraph
                            goldXpSeries={match.gold_xp_series}
                            teamGoldDiff={match.team_gold_diff}
                            allGoldXpData={match.all_gold_xp_series}
                            participants={match.participants}
                            puuid={puuid}
                        />
                        <TimelineMap match={match} puuid={puuid} showWards={false} />
                    </div>
                )}
            </div>
        </div>
    );
}
