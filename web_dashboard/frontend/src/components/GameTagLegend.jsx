import React from 'react';
import { X, Trophy, Skull, Activity, TrendingDown, Target, Zap, Anchor } from 'lucide-react';
import clsx from 'clsx';

export default function GameTagLegend({ onClose }) {
    const victoryTags = [
        { label: "Hyper Carry", color: "text-blue-300", bg: "bg-blue-500/20", desc: "High KDA (>4.0), High KP (>55%), & High Damage (>25%). You were the reason for the win." },
        { label: "Stomp", color: "text-blue-500", bg: "bg-blue-500/20", border: "border-blue-500/30", desc: "Game ended quickly (<25m) with a massive gold lead (>5k)." },
        { label: "Solid Win", color: "text-slate-300", bg: "bg-slate-700/40", desc: "A standard victory with positive contribution." },
        { label: "Passenger", color: "text-slate-500", bg: "bg-slate-700/40", desc: "Low KDA (<2.0) & Low KP (<40%). You got carried by the team." },
    ];

    const defeatTags = [
        { label: "Ace in Defeat", color: "text-red-300", bg: "bg-red-500/20", desc: "High participation (>50%) & solid KDA (>2.5) despite the loss. You did your part." },
        { label: "Lane Gap", color: "text-red-500", bg: "bg-red-500/10", desc: "Opponent had significantly more gold (>15%) and KDA, creating a snowball." },
        { label: "Throw", color: "text-red-400", bg: "bg-slate-800", desc: "Team had a massive lead (>2.5k) but lost the game." },
        { label: "Early Gap", color: "text-red-400", bg: "bg-slate-800", desc: "Fell behind by >1500 gold in the first 15 minutes." },
        { label: "Bad Death", color: "text-red-400", bg: "bg-slate-800", desc: "Died right before a key objective (Dragon/Baron), costing the team." },
        { label: "Feeding", color: "text-red-500", bg: "bg-slate-800", desc: "Extremely high deaths (8+) with low impact (KDA < 1.5)." },
        { label: "Team Gap", color: "text-slate-400", bg: "bg-slate-800", desc: "You played decently, but the team lost heavily elsewhere." },
        { label: "Tough Loss", color: "text-slate-500", bg: "bg-slate-900", desc: "A generic loss where things just didn't go well." },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-slate-900/90 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-500/20 text-violet-300">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Analysis Tags Legend</h2>
                            <p className="text-sm text-slate-400">Definitions for AI-generated match labels</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-8">

                    {/* Victory Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-blue-400 font-bold uppercase tracking-wider text-xs">
                            <Trophy size={14} /> Victory Factors
                        </div>
                        <div className="space-y-3">
                            {victoryTags.map(tag => (
                                <div key={tag.label} className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={clsx(
                                            "text-[10px] px-1.5 py-0.5 rounded font-bold",
                                            tag.color, tag.bg, tag.border && `border ${tag.border}`
                                        )}>
                                            {tag.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {tag.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Defeat Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-red-400 font-bold uppercase tracking-wider text-xs">
                            <Skull size={14} /> Defeat Factors
                        </div>
                        <div className="space-y-3">
                            {defeatTags.map(tag => (
                                <div key={tag.label} className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={clsx(
                                            "text-[10px] px-1.5 py-0.5 rounded font-bold",
                                            tag.color, tag.bg, tag.border && `border ${tag.border}`
                                        )}>
                                            {tag.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {tag.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-white/5 text-center text-xs text-slate-500">
                    Tags are assigned by the Nexus Neural Link based on statistical thresholds relative to your rank.
                </div>
            </div>
        </div>
    );
}
