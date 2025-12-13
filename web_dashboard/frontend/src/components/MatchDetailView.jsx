import React, { useState } from 'react';
import clsx from 'clsx';
import Scoreboard from './Scoreboard';
import BuildAnalysis from './BuildAnalysis';
import TimelineMap from './TimelineMap';
import GoldXpGraph from './GoldXpGraph';

export default function MatchDetailView({ match, puuid, onClose }) {
    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'build', label: 'Build' },
        { id: 'timeline', label: 'Timeline' },
    ];

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-xl p-4 md:p-10 flex flex-col animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex border-b border-slate-700 bg-slate-800/50 rounded-t-lg overflow-hidden">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                "px-6 py-3 text-sm font-bold transition-colors relative",
                                activeTab === tab.id ? "text-white bg-white/5" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                            )}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                            )}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-white/10"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Content Container - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div className="max-w-7xl mx-auto w-full">
                    {activeTab === 'overview' && <Scoreboard match={match} puuid={puuid} />}
                    {activeTab === 'build' && <BuildAnalysis match={match} puuid={puuid} />}
                    {activeTab === 'timeline' && (
                        <div className="space-y-8 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                            <GoldXpGraph
                                goldXpSeries={match.gold_xp_series}
                                teamGoldDiff={match.team_gold_diff}
                            />
                            <TimelineMap match={match} puuid={puuid} showWards={false} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
