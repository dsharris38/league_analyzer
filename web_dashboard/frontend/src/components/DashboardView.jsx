import { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import SummaryCards from './SummaryCards';
import MatchSummaryCard from './MatchSummaryCard';
import MatchDetailView from './MatchDetailView';
import DeepDiveView from './DeepDiveView';
import RankCard from './RankCard';
import MasteryCard from './MasteryCard';
import TeammatesCard from './TeammatesCard';
import RecentPerformanceCard from './RecentPerformanceCard';
import { ArrowLeft, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Filter, Search, X, HelpCircle } from 'lucide-react';
import config from '../config';
import { getVersion, initDataDragon } from '../utils/dataDragon';
import heroBg from '../assets/hero_bg.jpg';
import GameTagLegend from './GameTagLegend';

export default function DashboardView({ data, filename, onBack, onUpdate, onPlayerClick }) {
    const { analysis, coaching_report_markdown } = data;
    const version = getVersion();
    const [dataReady, setDataReady] = useState(false);
    const [showLegend, setShowLegend] = useState(false);

    useEffect(() => {
        initDataDragon().then(() => setDataReady(true));
    }, []);

    if (!analysis) {
        return <div className="p-8 text-center text-slate-400 text-lg">Analysis data is missing or corrupt.</div>;
    }

    const { summary, per_champion, detailed_matches, review_candidates } = analysis;
    const [expandedMatchIds, setExpandedMatchIds] = useState(new Set());
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);

    const toggleExpand = (matchId) => {
        setExpandedMatchIds(prev => {
            const next = new Set(prev);
            if (next.has(matchId)) {
                next.delete(matchId);
            } else {
                next.add(matchId);
            }
            return next;
        });
    };

    // Deep Dive State
    const [deepDiveReport, setDeepDiveReport] = useState(null);
    const [deepDiveMatchData, setDeepDiveMatchData] = useState(null);
    const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        champion: '',
        role: 'ALL',
        result: 'ALL'
    });

    const filteredMatches = useMemo(() => {
        if (!detailed_matches) return [];
        return detailed_matches.filter(match => {
            // Find the player's participant data
            const self = match.participants?.find(p => p.is_self);
            if (!self) return false; // Skip if player data not found

            const matchChamp = (self.champion_name || '').toLowerCase();
            const filterChamp = filters.champion.toLowerCase();
            const matchRole = (self.position || '').toUpperCase();
            const matchWin = self.win; // boolean

            if (filterChamp && !matchChamp.includes(filterChamp)) return false;
            if (filters.role !== 'ALL' && matchRole !== filters.role) return false;
            if (filters.result !== 'ALL') {
                const wantWin = filters.result === 'WIN';
                if (matchWin !== wantWin) return false;
            }
            return true;
        });
    }, [detailed_matches, filters]);

    const clearFilters = () => setFilters({ champion: '', role: 'ALL', result: 'ALL' });
    const hasActiveFilters = filters.champion || filters.role !== 'ALL' || filters.result !== 'ALL';

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredMatches.length / ITEMS_PER_PAGE);
    const displayedMatches = filteredMatches.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const [isUpdating, setIsUpdating] = useState(false);

    // Helper to parse champion sections from markdown
    const parseChampions = (text) => {
        if (!text) return [];
        const clean = cleanText(text).replace(/\r\n/g, '\n');
        // Split by ### headers, keeping line breaks in mind
        // We look for "### " at start of line
        const parts = clean.split(/(?=\n### )|^### /).map(p => p.trim()).filter(Boolean);

        return parts.map(part => {
            const lines = part.split('\n');
            const firstLine = lines[0].trim();

            if (firstLine.startsWith('### ')) {
                const title = firstLine.replace('### ', '').trim();
                const content = lines.slice(1).join('\n').trim();
                return { type: 'accordion', title, content };
            } else {
                // Heuristic: If first line is short and looks like a name (no markdown symbols), treat as accordion
                // This fixes cases where AI forgets '###' for the first item
                const isLikelyHeader = firstLine.length < 50 && !firstLine.match(/^[-*#>]/) && lines.length > 1;

                if (isLikelyHeader) {
                    return { type: 'accordion', title: firstLine, content: lines.slice(1).join('\n').trim() };
                }

                // Intro text or fallback -> Show as raw
                return { type: 'raw', content: part };
            }
        });
    };

    // Sub-component for individual champion accordion
    const ChampionAccordion = ({ title, content }) => {
        const [isOpen, setIsOpen] = useState(false); // Start collapsed
        return (
            <div className="border-b border-white/5 last:border-0">
                <div
                    className="flex items-center justify-between p-2 cursor-pointer hover:bg-white/5 transition-colors rounded"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className="text-sm font-bold text-violet-200 uppercase tracking-wide">{title}</span>
                    {isOpen ? <ChevronDown size={14} className="text-violet-400" /> : <ChevronRight size={14} className="text-violet-400" />}
                </div>
                {isOpen && (
                    <div className="px-2 pb-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
                    </div>
                )}
            </div>
        );
    };

    const handleUpdateClick = async () => {
        setIsUpdating(true);
        try {
            await onUpdate();
        } finally {
            // Keep spinning for a moment to show completion or just rely on re-render
            setTimeout(() => setIsUpdating(false), 2000);
        }
    };

    const handleDeepDive = async (matchId) => {
        setIsDeepDiveLoading(true);
        setDeepDiveReport(null); // Open modal immediately in loading state
        setDeepDiveMatchData(null);

        try {
            const response = await fetch(`${config.API_URL}/api/analyses/${filename}/deep_dive/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ match_id: matchId }),
            });

            const result = await response.json();
            if (result.report) {
                setDeepDiveReport(result.report);
                setDeepDiveMatchData(result.match_data);
            } else if (result.error) {
                setDeepDiveReport(`Error: ${result.error}`);
            } else {
                setDeepDiveReport("Failed to generate analysis. Please try again.");
            }
        } catch (error) {
            console.error("Deep dive error:", error);
            setDeepDiveReport(`Error: ${error.message}`);
        } finally {
            setIsDeepDiveLoading(false);
        }
    };

    // Custom Markdown Styling for Neural Link
    const markdownComponents = {
        h1: ({ node, ...props }) => <h3 className="text-base font-bold text-violet-300 mt-4 mb-2 uppercase tracking-wide border-b border-violet-500/20 pb-1" {...props} />,
        h2: ({ node, ...props }) => <h4 className="text-sm font-bold text-white mt-3 mb-1 uppercase tracking-wider" {...props} />,
        h3: ({ node, ...props }) => <h5 className="text-sm font-bold text-violet-200 mt-5 mb-2 pt-2 border-t border-white/10 uppercase tracking-wider" {...props} />,
        p: ({ node, ...props }) => <p className="text-slate-300 mb-2 leading-relaxed text-sm" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 my-2 marker:text-violet-500" {...props} />,
        li: ({ node, ...props }) => <li className="pl-1 text-slate-300 text-sm leading-relaxed" {...props} />,
        strong: ({ node, ...props }) => <strong className="text-cyan-300 font-bold" {...props} />,
        blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-violet-500/50 pl-3 italic text-slate-400 my-2 bg-violet-500/5 py-1 rounded-r text-sm" {...props} />,
    };

    // Helper to clean AI artifacts
    const cleanText = (text) => text ? text.replace(/^Markdown\.\s*/i, '') : '';

    const getTierColorText = (tier) => {
        if (!tier) return "text-slate-500";
        switch (tier.toUpperCase()) {
            case 'GOLD': return "text-yellow-500";
            case 'PLATINUM': return "text-cyan-400";
            case 'EMERALD': return "text-emerald-400";
            case 'DIAMOND': return "text-blue-400";
            case 'MASTER': return "text-purple-400";
            default: return "text-slate-400";
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0c2a] text-slate-200 font-sans relative pb-20">
            {/* Background Image with Overlay */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#0b0c2a]">
                {/* Simplified background: Just color, no expensive image blending if user has perf issues */}
                {/* Note: Keeping image but reducing composite cost by making overlay opaque if needed? 
                    Actually, just lowering image opacity is cheapest. */}
                <img
                    src={heroBg}
                    alt="Background"
                    className="w-full h-full object-cover object-top opacity-10"
                />
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto p-4 lg:p-6">

                {/* Header Navigation */}
                <div className="flex items-center justify-between mb-8">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium hidden md:inline">Find Summoner</span>
                    </button>

                    {/* Identity (Icon + Name + History) */}
                    <div className="flex items-center gap-2 md:gap-6">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="relative group">
                                <img
                                    src={`https://ddragon.leagueoflegends.com/cdn/${version || '14.23.1'}/img/profileicon/${data.summoner_info?.profileIconId || 29}.png`}
                                    alt="Summoner Icon"
                                    className="w-12 h-12 md:w-16 md:h-16 rounded-2xl border-2 border-violet-400/50 shadow-[0_0_15px_rgba(139,92,246,0.3)] group-hover:border-violet-400 transition-all"
                                />
                                <div className="absolute -bottom-1 -right-1 bg-[#0b0c2a] text-[10px] md:text-xs font-mono px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">
                                    {data.summoner_info?.summonerLevel || "30"}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                                    {data.game_name}
                                </h1>
                                <div className="text-slate-400 text-xs md:text-sm font-mono tracking-widest">#{data.tag_line}</div>
                            </div>
                        </div>

                        {/* Rank History Divider & List */}
                        {data.past_ranks && data.past_ranks.length > 0 && (
                            <>
                                <div className="h-10 w-px bg-white/10 hidden md:block"></div>
                                <div className="hidden md:flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Previous Seasons</span>
                                    <div className="flex gap-2">
                                        {data.past_ranks.slice(0, 3).map((s, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded border border-white/5 text-xs">
                                                <span className="text-slate-400 font-mono text-[10px]">{s.season}</span>
                                                <span className={`font-bold ${getTierColorText(s.tier.split(" ")[0])}`}>{s.tier}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={handleUpdateClick}
                        disabled={isUpdating}
                        className="flex items-center gap-2 bg-slate-800/50 hover:bg-violet-600/20 text-violet-300 hover:text-violet-200 px-4 py-2 rounded-lg font-bold text-xs transition-all border border-violet-500/30 hover:border-violet-400 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUpdating ? (
                            <>
                                <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></span>
                                <span className="hidden md:inline">Updating...</span>
                            </>
                        ) : (
                            <span className="hidden md:inline">Update Data</span>
                        )}
                        {!isUpdating && <span className="md:hidden text-xs">Update</span>}
                    </button>
                </div>

                {/* BENTO GRID LAYOUT */}
                <div className="space-y-6">

                    {/* TOP DECK: Key Stats Grid (4 Cols) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* 1. Rank Card (Scrollable for history) */}
                        <div className="col-span-1 h-64 lg:h-72">
                            <RankCard rankInfo={data.rank_info} pastRanks={data.past_ranks} />
                        </div>
                        {/* 2. Season Performance (Tier 3 Stats) */}
                        <div className="col-span-1 h-64 lg:h-72">
                            {/* Prefer Season Stats (Tier 3) if available, else fallback to Recent (Tier 2) */}
                            <RecentPerformanceCard
                                stats={
                                    data.season_stats?.champions
                                        ? data.season_stats.champions.map(c => ({
                                            champion: c.name,
                                            games: c.games,
                                            winrate: c.winrate / 100, // Convert 55.0 -> 0.55
                                            kda: c.kda
                                        }))
                                        : analysis.per_champion
                                }
                                title={data.season_stats ? "Season Performance" : "Recent Performance"}
                            />
                        </div>
                        {/* 3. Teammates */}
                        <div className="col-span-1 h-64 lg:h-72">
                            <MasteryCard masteryData={data.champion_mastery} />
                        </div>
                        {/* 4. Mastery (Swapped with Teammates in original? Checking original lines 146 vs 150. I will respect original order but ensuring scroll) */}
                        <div className="col-span-1 h-64 lg:h-72">
                            <TeammatesCard teammates={analysis.teammates} onPlayerClick={onPlayerClick} />
                        </div>
                    </div>

                    {/* MAIN DECK: Match History & Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* MATCH HISTORY FEED (2 Cols Wide) */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Filter Bar */}
                            <div className="glass-panel p-3 rounded-xl flex items-center justify-between">
                                <h2 className="text-lg font-bold text-white px-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                                    Battle Log
                                    <button
                                        onClick={() => setShowLegend(true)}
                                        className="ml-2 text-slate-500 hover:text-white transition-colors"
                                        title="View Tag Definitions"
                                    >
                                        <HelpCircle size={16} />
                                    </button>
                                </h2>
                                <div className="flex items-center gap-3">
                                    <div className="relative hidden md:block">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={filters.champion}
                                            onChange={(e) => setFilters({ ...filters, champion: e.target.value })}
                                            className="bg-black/40 border border-slate-700/50 rounded-md pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 w-32"
                                        />
                                    </div>
                                    <select
                                        value={filters.result}
                                        onChange={(e) => setFilters({ ...filters, result: e.target.value })}
                                        className="bg-slate-900 border border-slate-700/50 rounded-md px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 [color-scheme:dark] cursor-pointer hover:bg-slate-800 transition-colors"
                                    >
                                        <option value="ALL" className="bg-slate-900 text-slate-300">All Matches</option>
                                        <option value="WIN" className="bg-slate-900 text-slate-300">Wins</option>
                                        <option value="LOSS" className="bg-slate-900 text-slate-300">Losses</option>
                                    </select>
                                </div>
                            </div>

                            {/* List */}
                            <div className="space-y-3">
                                {displayedMatches.length === 0 ? (
                                    <div className="text-center py-20 text-slate-500 glass-panel rounded-xl">
                                        No matches found matching filters.
                                    </div>
                                ) : (
                                    <>
                                        {displayedMatches.map((match) => {
                                            const candidate = review_candidates?.find(c => c.match_id === match.match_id);
                                            return (
                                                <div key={match.match_id}>
                                                    <MatchSummaryCard
                                                        match={match}
                                                        puuid={data.puuid}
                                                        onExpand={() => toggleExpand(match.match_id)}
                                                        isExpanded={expandedMatchIds.has(match.match_id)}
                                                        onDeepDive={handleDeepDive}
                                                        isReviewCandidate={!!candidate}
                                                        reviewReason={candidate?.reasons?.[0]}
                                                        onPlayerClick={onPlayerClick}
                                                    />
                                                    {expandedMatchIds.has(match.match_id) && (
                                                        <MatchDetailView
                                                            match={match}
                                                            puuid={data.puuid}
                                                            onClose={() => toggleExpand(match.match_id)}
                                                            onPlayerClick={onPlayerClick}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Pagination Controls */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between p-3 glass-panel rounded-xl mt-4">
                                                <button
                                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                    disabled={currentPage === 1}
                                                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors uppercase tracking-wider"
                                                >
                                                    <ChevronLeft size={14} />
                                                    Prev
                                                </button>

                                                <div className="text-xs text-slate-500 font-mono">
                                                    Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-slate-400">{totalPages}</span>
                                                </div>

                                                <button
                                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                    disabled={currentPage === totalPages}
                                                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors uppercase tracking-wider"
                                                >
                                                    Next
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Summary & Coaching (1 Col Wide) */}
                        <div className="space-y-6">
                            {/* Summary Metrics (KDA, CS, etc) moved here */}
                            <SummaryCards summary={summary} analysis={analysis} />

                            {/* AI Coach Panel */}
                            {(data.coaching_report || data.coaching_report_markdown || data.ai_loading) && (() => {
                                const report = typeof data.coaching_report === 'object'
                                    ? data.coaching_report
                                    : { overview: data.coaching_report || data.coaching_report_markdown };

                                return (
                                    <div className="glass-panel rounded-xl p-5 border-t-2 border-t-violet-500 relative">
                                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 text-glow relative z-10">
                                            <span className="text-violet-400">Nexus</span> Neural Link

                                            {/* Weighted Badge (Moved here) */}
                                            {analysis.summary?.is_weighted && (
                                                <div className="group/tooltip relative ml-2">
                                                    <div className="cursor-help bg-violet-500/10 text-violet-300 text-[9px] px-1.5 py-0.5 rounded border border-violet-500/20 font-bold uppercase tracking-wider flex items-center gap-1">
                                                        <span>S{analysis.summary.season_filter} Weighted</span>
                                                    </div>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl text-xs text-slate-300 z-50 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity">
                                                        Analysis puts 2x weight on games from the current season (S{analysis.summary.season_filter}).
                                                    </div>
                                                </div>
                                            )}

                                            {data.ai_loading && (
                                                <span className="ml-auto text-[10px] font-mono text-violet-300 animate-pulse bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                                                    ANALYZING...
                                                </span>
                                            )}
                                        </h2>

                                        {/* Loading State Overlay */}
                                        {data.ai_loading && !report.overview && (
                                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin"></div>
                                                    <div className="absolute inset-0 rounded-full bg-violet-500/10 blur-md"></div>
                                                </div>
                                                <p className="text-xs text-violet-300 font-mono animate-pulse">Contacting Neural Network...</p>
                                            </div>
                                        )}

                                        {/* CACHED CONTENT (Visible while loading if available) */}
                                        {
                                            report.overview && (
                                                <div className={`mb-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar transition-opacity duration-500 ${data.ai_loading ? 'opacity-80' : 'opacity-100'}`}>
                                                    <ReactMarkdown components={markdownComponents}>{cleanText(report.overview)}</ReactMarkdown>
                                                </div>
                                            )
                                        }

                                        {/* Always show grid if we have cached report, even if loading */}
                                        {(report.champion_feedback || report.itemization_tips) && (
                                            <div className={`grid grid-cols-1 gap-3 transition-opacity duration-500 ${data.ai_loading ? 'opacity-80' : 'opacity-100'}`}>
                                                {report.champion_feedback && (
                                                    <div className="bg-black/20 rounded p-3 border border-white/5">
                                                        <h4 className="text-sm font-bold text-green-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 box-shadow-green-glow"></div>
                                                            Tactics
                                                        </h4>
                                                        <div className="space-y-1">
                                                            {parseChampions(report.champion_feedback).map((item, idx) => (
                                                                item.type === 'raw' ? (
                                                                    <div key={idx} className="mb-2 px-1">
                                                                        <ReactMarkdown components={markdownComponents}>{item.content}</ReactMarkdown>
                                                                    </div>
                                                                ) : (
                                                                    <ChampionAccordion key={idx} title={item.title} content={item.content} />
                                                                )
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {report.itemization_tips && (
                                                    <div className="bg-black/20 rounded p-3 border border-white/5">
                                                        <h4 className="text-sm font-bold text-yellow-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 box-shadow-yellow-glow"></div>
                                                            Logistics
                                                        </h4>
                                                        <div><ReactMarkdown components={markdownComponents}>{cleanText(report.itemization_tips)}</ReactMarkdown></div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Modals */}
                {
                    (deepDiveReport || isDeepDiveLoading) && (
                        <DeepDiveView
                            report={deepDiveReport}
                            matchData={deepDiveMatchData}
                            puuid={data.puuid}
                            isLoading={isDeepDiveLoading}
                            onClose={() => {
                                setDeepDiveReport(null);
                                setDeepDiveMatchData(null);
                                setIsDeepDiveLoading(false);
                            }}
                        />
                    )
                }

                {/* Legend Modal */}
                {showLegend && <GameTagLegend onClose={() => setShowLegend(false)} />}
            </div>
        </div>
    );
}

// Helper (moved from RankCard or can be shared but simpler to inline if imports tricky)
// Actually we import components so we are good.

