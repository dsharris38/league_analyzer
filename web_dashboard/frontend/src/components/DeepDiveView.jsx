import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Microscope, Map as MapIcon, FileText } from 'lucide-react';
import TimelineMap from './TimelineMap';
import clsx from 'clsx';

export default function DeepDiveView({ report, matchData, puuid, onClose, isLoading }) {
    const [activeTab, setActiveTab] = useState('report');

    if (!report && !isLoading) return null;

    return (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/90 backdrop-blur-sm p-4">
            <div className="bg-dark-bg border border-rose-vale/20 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl shadow-rose-vale/10">

                {/* Header */}
                <div className="p-6 border-b border-rose-vale/20 flex justify-between items-center bg-dark-bg/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-vale/20 rounded-lg text-cornsilk">
                            <Microscope size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-cornsilk font-serif">Deep Dive Analysis</h2>
                            <p className="text-sm text-cornsilk/60">AI-Powered Game Review</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    {!isLoading && matchData && (
                        <div className="flex bg-dark-bg/80 rounded-lg p-1 border border-rose-vale/20">
                            <button
                                onClick={() => setActiveTab('report')}
                                className={clsx(
                                    "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                                    activeTab === 'report' ? "bg-rose-vale/20 text-cornsilk shadow-sm" : "text-cornsilk/60 hover:text-cornsilk"
                                )}
                            >
                                <FileText size={16} />
                                Analysis
                            </button>
                            <button
                                onClick={() => setActiveTab('map')}
                                className={clsx(
                                    "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                                    activeTab === 'map' ? "bg-rose-vale/20 text-cornsilk shadow-sm" : "text-cornsilk/60 hover:text-cornsilk"
                                )}
                            >
                                <MapIcon size={16} />
                                Timeline & Map
                            </button>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-rose-vale/10 rounded-lg transition-colors text-cornsilk/60 hover:text-cornsilk"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-dark-bg/95">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="w-12 h-12 border-4 border-rose-vale/30 border-t-rose-vale rounded-full animate-spin"></div>
                            <p className="text-cornsilk/60 animate-pulse">Analyzing match timeline...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'report' && (
                                <div className="space-y-6">
                                    {/* Story Card */}
                                    {typeof report === 'object' && report.story ? (
                                        <>
                                            <div className="bg-dark-bg/60 border border-rose-vale/20 rounded-xl overflow-hidden backdrop-blur-sm">
                                                <div className="p-4 border-b border-rose-vale/20 bg-sage/10 flex items-center gap-2">
                                                    <div className="w-1 h-6 bg-sage rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-cornsilk font-serif">The Story of the Game</h3>
                                                </div>
                                                <div className="p-6 prose prose-invert max-w-none prose-p:text-cornsilk/80 prose-headings:text-cornsilk prose-strong:text-cornsilk">
                                                    <ReactMarkdown>{report.story}</ReactMarkdown>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {/* Mistakes Card */}
                                                <div className="bg-dark-bg/60 border border-rose-vale/20 rounded-xl overflow-hidden backdrop-blur-sm">
                                                    <div className="p-4 border-b border-rose-vale/20 bg-rose-vale/10 flex items-center gap-2">
                                                        <div className="w-1 h-6 bg-rose-vale rounded-full"></div>
                                                        <h3 className="text-lg font-bold text-cornsilk font-serif">Critical Mistakes</h3>
                                                    </div>
                                                    <div className="p-6 prose prose-invert max-w-none prose-p:text-cornsilk/80 prose-headings:text-cornsilk prose-strong:text-cornsilk">
                                                        <ReactMarkdown>{report.mistakes}</ReactMarkdown>
                                                    </div>
                                                </div>

                                                {/* Build & Vision Card */}
                                                <div className="bg-dark-bg/60 border border-rose-vale/20 rounded-xl overflow-hidden backdrop-blur-sm">
                                                    <div className="p-4 border-b border-rose-vale/20 bg-cornsilk/10 flex items-center gap-2">
                                                        <div className="w-1 h-6 bg-cornsilk rounded-full"></div>
                                                        <h3 className="text-lg font-bold text-cornsilk font-serif">Build & Vision</h3>
                                                    </div>
                                                    <div className="p-6 prose prose-invert max-w-none prose-p:text-cornsilk/80 prose-headings:text-cornsilk prose-strong:text-cornsilk">
                                                        <ReactMarkdown>{report.build_vision}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Verdict Card */}
                                            <div className="bg-dark-bg/60 border border-rose-vale/20 rounded-xl overflow-hidden backdrop-blur-sm">
                                                <div className="p-4 border-b border-rose-vale/20 bg-sage/10 flex items-center gap-2">
                                                    <div className="w-1 h-6 bg-sage rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-cornsilk font-serif">Final Verdict</h3>
                                                </div>
                                                <div className="p-6 prose prose-invert max-w-none prose-p:text-cornsilk/80 prose-headings:text-cornsilk prose-strong:text-cornsilk">
                                                    <ReactMarkdown>{report.verdict}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        // Fallback for old string reports or errors
                                        <div className="prose prose-invert max-w-none prose-headings:text-purple-300 prose-strong:text-white prose-p:text-slate-300">
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
