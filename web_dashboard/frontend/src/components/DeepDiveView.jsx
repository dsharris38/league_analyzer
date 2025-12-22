import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Microscope, Map as MapIcon, FileText } from 'lucide-react';
import TimelineMap from './TimelineMap';
import clsx from 'clsx';

export default function DeepDiveView({ report, matchData, puuid, onClose, isLoading }) {
    const [activeTab, setActiveTab] = useState('report');

    if (!report && !isLoading) return null;

    return (

        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/80 backdrop-blur-md p-0 md:p-4 transition-all duration-300">
            <div className="bg-slate-900/90 border-t md:border border-white/10 rounded-t-2xl md:rounded-2xl w-full max-w-7xl h-[90vh] md:max-h-[85vh] flex flex-col shadow-2xl shadow-blue-500/5 backdrop-blur-xl">

                {/* Header */}
                <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-900/50 to-transparent rounded-t-2xl flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                            <Microscope size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-100 tracking-wide uppercase">Deep Dive Analysis</h2>
                            <p className="text-sm text-slate-400 font-medium">AI-Powered Game Review</p>
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
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-900/95">
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
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                                {/* Draft Analysis */}
                                                <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg flex flex-col">
                                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-blue-900/20 to-transparent">
                                                        <div className="w-1 h-5 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.6)]"></div>
                                                        <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">Draft & Win Con</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.draft_analysis || "No draft analysis."}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Pick Critique */}
                                                <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg flex flex-col">
                                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-purple-900/20 to-transparent">
                                                        <div className="w-1 h-5 bg-purple-500 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.6)]"></div>
                                                        <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">Pick Identity</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.pick_quality || "No pick critique."}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Story */}
                                                <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg flex flex-col">
                                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-violet-900/20 to-transparent">
                                                        <div className="w-1 h-5 bg-violet-500 rounded-full shadow-[0_0_12px_rgba(139,92,246,0.6)]"></div>
                                                        <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">The Turning Point</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.story}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 2: Execution (Builds & Mistakes) */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                                {/* Ideal Build */}
                                                <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg flex flex-col">
                                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-emerald-900/20 to-transparent">
                                                        <div className="w-1 h-5 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.6)]"></div>
                                                        <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">Objective Build</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.ideal_build || "No build data."}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Build Critique */}
                                                <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg flex flex-col">
                                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-yellow-900/20 to-transparent">
                                                        <div className="w-1 h-5 bg-yellow-500 rounded-full shadow-[0_0_12px_rgba(234,179,8,0.6)]"></div>
                                                        <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">Build Critique</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.build_vision}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Mistakes */}
                                                <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg flex flex-col">
                                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-red-900/20 to-transparent">
                                                        <div className="w-1 h-5 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.6)]"></div>
                                                        <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">Critical Errors</h3>
                                                    </div>
                                                    <div className="p-4 prose-coaching flex-1 overflow-auto">
                                                        <ReactMarkdown>{report.mistakes}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Verdict Card (Compact) */}
                                            <div className="rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-lg">
                                                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-emerald-900/20 to-transparent">
                                                    <div className="w-1 h-5 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.6)]"></div>
                                                    <h3 className="text-sm font-bold text-slate-200 tracking-wider uppercase">Final Verdict</h3>
                                                </div>
                                                <div className="p-4 prose-coaching">
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
        </div >
    );
}
