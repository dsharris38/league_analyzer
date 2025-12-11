import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Microscope, Map as MapIcon, FileText } from 'lucide-react';
import TimelineMap from './TimelineMap';
import clsx from 'clsx';

export default function DeepDiveView({ report, matchData, puuid, onClose, isLoading }) {
    const [activeTab, setActiveTab] = useState('report');

    if (!report && !isLoading) return null;

    return (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl shadow-blue-500/10">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400">
                            <Microscope size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Deep Dive Analysis</h2>
                            <p className="text-sm text-slate-400">AI-Powered Game Review</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    {!isLoading && matchData && (
                        <div className="flex bg-slate-800/80 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => setActiveTab('report')}
                                className={clsx(
                                    "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                                    activeTab === 'report' ? "bg-violet-600/20 text-violet-300 shadow-sm" : "text-slate-400 hover:text-white"
                                )}
                            >
                                <FileText size={16} />
                                Analysis
                            </button>
                            <button
                                onClick={() => setActiveTab('map')}
                                className={clsx(
                                    "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                                    activeTab === 'map' ? "bg-violet-600/20 text-violet-300 shadow-sm" : "text-slate-400 hover:text-white"
                                )}
                            >
                                <MapIcon size={16} />
                                Timeline & Map
                            </button>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900/95">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
                            <p className="text-slate-400 animate-pulse">Analyzing match timeline...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'report' && (
                                <div className="space-y-6">
                                    {/* Story Card */}
                                    {typeof report === 'object' && report.story ? (
                                        <>
                                            {/* Row 1: Context (Draft, Pick, Story) */}
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                {/* Draft Analysis */}
                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col">
                                                    <div className="p-3 border-b border-slate-700/50 bg-blue-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Draft & Win Con</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.draft_analysis || "No draft analysis."}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Pick Critique */}
                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col">
                                                    <div className="p-3 border-b border-slate-700/50 bg-purple-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Pick Identity</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.pick_quality || "No pick critique."}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Story */}
                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col">
                                                    <div className="p-3 border-b border-slate-700/50 bg-violet-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-5 bg-violet-500 rounded-full"></div>
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">The Turning Point</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.story}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 2: Execution (Builds & Mistakes) */}
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                {/* Ideal Build */}
                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col">
                                                    <div className="p-3 border-b border-slate-700/50 bg-emerald-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Objective Build</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.ideal_build || "No build data."}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Build Critique */}
                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col">
                                                    <div className="p-3 border-b border-slate-700/50 bg-yellow-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-5 bg-yellow-500 rounded-full"></div>
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Build Critique</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.build_vision}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Mistakes */}
                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col">
                                                    <div className="p-3 border-b border-slate-700/50 bg-red-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-5 bg-red-500 rounded-full"></div>
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Critical Errors</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.mistakes}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Verdict Card (Compact) */}
                                            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
                                                <div className="p-3 border-b border-slate-700/50 bg-emerald-500/10 flex items-center gap-2">
                                                    <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                                                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Final Verdict</h3>
                                                </div>
                                                <div className="p-4 prose-coaching">
                                                    <ReactMarkdown>{report.verdict}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </>
                                        </>
                            ) : (
                            // Fallback for old string reports or errors
                            <div className="prose-coaching">
                                <ReactMarkdown>{typeof report === 'string' ? report : report.story || "No analysis available."}</ReactMarkdown>
                            </div>
                                    )}
                        </div>
                            )}
                    {activeTab === 'map' && matchData && (
                        <div className="h-full">
                            <TimelineMap match={matchData} puuid={puuid} showWards={true} />
                        </div>
                    )}
                </>
                    )}
            </div>
        </div>
        </div >
    );
}
