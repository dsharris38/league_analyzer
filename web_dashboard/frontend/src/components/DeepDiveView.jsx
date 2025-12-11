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
                                            {/* Draft & Pick Analysis (New) */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
                                                    <div className="p-4 border-b border-slate-700/50 bg-blue-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                                                        <h3 className="text-lg font-bold text-white">Draft & Win Condition</h3>
                                                    </div>
                                                    <div className="p-6 prose-coaching">
                                                        <ReactMarkdown>{report.draft_analysis || "No draft analysis available."}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
                                                    <div className="p-4 border-b border-slate-700/50 bg-purple-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                                                        <h3 className="text-lg font-bold text-white">Pick & Identity</h3>
                                                    </div>
                                                    <div className="p-6 prose-coaching">
                                                        <ReactMarkdown>{report.pick_quality || "No pick critique available."}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Story Card */}
                                            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
                                                <div className="p-4 border-b border-slate-700/50 bg-violet-500/10 flex items-center gap-2">
                                                    <div className="w-1 h-6 bg-violet-500 rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-white">The Story of the Game</h3>
                                                </div>
                                                <div className="p-6 prose-coaching">
                                                    <ReactMarkdown>{report.story}</ReactMarkdown>
                                                </div>
                                            </div>

                                            {/* Smart Itemization (New) */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
                                                    <div className="p-4 border-b border-slate-700/50 bg-emerald-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                                                        <h3 className="text-lg font-bold text-white">Objective Best Build</h3>
                                                    </div>
                                                    <div className="p-6 prose-coaching">
                                                        <ReactMarkdown>{report.ideal_build || "No ideal build generated."}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
                                                    <div className="p-4 border-b border-slate-700/50 bg-yellow-500/10 flex items-center gap-2">
                                                        <div className="w-1 h-6 bg-yellow-500 rounded-full"></div>
                                                        <h3 className="text-lg font-bold text-white">Your Build Critique</h3>
                                                    </div>
                                                    <div className="p-6 prose-coaching">
                                                        <ReactMarkdown>{report.build_vision}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Critical Mistakes (Full Width) */}
                                            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
                                                <div className="p-4 border-b border-slate-700/50 bg-red-500/10 flex items-center gap-2">
                                                    <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-white">Critical Mistakes</h3>
                                                </div>
                                                <div className="p-6 prose-coaching">
                                                    <ReactMarkdown>{report.mistakes}</ReactMarkdown>
                                                </div>
                                            </div>

                                            {/* Verdict Card */}
                                            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
                                                <div className="p-4 border-b border-slate-700/50 bg-emerald-500/10 flex items-center gap-2">
                                                    <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-white">Final Verdict</h3>
                                                </div>
                                                <div className="p-6 prose-coaching">
                                                    <ReactMarkdown>{report.verdict}</ReactMarkdown>
                                                </div>
                                            </div>
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
        </div>
    );
}
