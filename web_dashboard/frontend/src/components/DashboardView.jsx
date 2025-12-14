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
import { ArrowLeft, ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react';
import config from '../config';
import { getVersion, initDataDragon } from '../utils/dataDragon';
import heroBg from '../assets/hero_bg.jpg';

export default function DashboardView({ data, filename, onBack, onUpdate }) {
    const { analysis, coaching_report_markdown } = data;
    const version = getVersion();
    const [dataReady, setDataReady] = useState(false);

    useEffect(() => {
        initDataDragon().then(() => setDataReady(true));
    }, []);

    if (!analysis) {
        return <div className="p-8 text-center text-slate-400 text-lg">Analysis data is missing or corrupt.</div>;
    }

    const { summary, per_champion, detailed_matches, review_candidates } = analysis;
    const [expandedMatchId, setExpandedMatchId] = useState(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);

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

    return (
        <div className="min-h-screen bg-[#0b0c2a] text-slate-200 font-sans relative pb-20">
            {/* Background Image with Overlay */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <img
                    src={heroBg}
                    alt="Background"
                    className="w-full h-full object-cover object-top opacity-20"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0b0c2a]/80 via-[#0b0c2a]/90 to-[#0b0c2a]"></div>
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto p-4 lg:p-6">

                {/* Header Navigation */}
                <div className="flex items-center justify-between mb-8">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">Find Summoner</span>
                    </button>

                    {/* Identity (Icon + Name) */}
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <img
                                src={`https://ddragon.leagueoflegends.com/cdn/${version || '14.23.1'}/img/profileicon/${data.summoner_info?.profileIconId || 29}.png`}
                                alt="Summoner Icon"
                                className="w-16 h-16 rounded-full border-2 border-violet-400/50 shadow-[0_0_15px_rgba(139,92,246,0.3)] group-hover:border-violet-400 transition-all"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-[#0b0c2a] text-xs font-mono px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">
                                {data.summoner_info?.summonerLevel || "30"}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-4xl font-black text-white tracking-tight">
                                {data.game_name}
                            </h1>
                            <div className="text-slate-400 text-sm font-mono tracking-widest">#{data.tag_line}</div>
                        </div>
                    </div>

                    <button onClick={onUpdate} className="flex items-center gap-2 bg-slate-800/50 hover:bg-violet-600/20 text-violet-300 hover:text-violet-200 px-4 py-2 rounded-lg font-bold text-xs transition-all border border-violet-500/30 hover:border-violet-400 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                        Update Data
                    </button>
                </div>

                {/* BENTO GRID LAYOUT */}
                <div className="space-y-6">

                    {/* TOP DECK: Key Stats Grid (4 Cols) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. Rank Card (Scrollable for history) */}
                        <div className="col-span-1 h-64 lg:h-72">
                            <RankCard rankInfo={data.rank_info} pastRanks={data.past_ranks} />
                        </div>
                        {/* 2. Recent Performance (Scrollable) */}
                        <div className="col-span-1 h-64 lg:h-72">
                            <RecentPerformanceCard recentStats={analysis.recent_performance} />
                        </div>
                        {/* 3. Teammates */}
                        <div className="col-span-1 h-64 lg:h-72">
                            <MasteryCard masteryData={data.champion_mastery} />
                        </div>
                        {/* 4. Mastery (Swapped with Teammates in original? Checking original lines 146 vs 150. I will respect original order but ensuring scroll) */}
                        <div className="col-span-1 h-64 lg:h-72">
                            <TeammatesCard teammates={analysis.teammates} />
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
                                        className="bg-black/40 border border-slate-700/50 rounded-md px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                                    >
                                        <option value="ALL">All Matches</option>
                                        <option value="WIN">Wins</option>
                                        <option value="LOSS">Losses</option>
                                    </select>
                                </div>
                            </div>

                            {/* List */}
                            <div className="space-y-3">
                                {filteredMatches.length === 0 ? (
                                    <div className="text-center py-20 text-slate-500 glass-panel rounded-xl">
                                        No matches found matching filters.
                                    </div>
                                ) : (
                                    filteredMatches.map((match) => {
                                        const candidate = review_candidates?.find(c => c.match_id === match.match_id);
                                        return (
                                            <div key={match.match_id}>
                                                <MatchSummaryCard
                                                    match={match}
                                                    puuid={data.puuid}
                                                    onExpand={() => setExpandedMatchId(expandedMatchId === match.match_id ? null : match.match_id)}
                                                    onDeepDive={handleDeepDive}
                                                    isReviewCandidate={!!candidate}
                                                    reviewReason={candidate?.reasons?.[0]}
                                                />
                                                {expandedMatchId === match.match_id && (
                                                    <MatchDetailView
                                                        match={match}
                                                        puuid={data.puuid}
                                                        onClose={() => setExpandedMatchId(null)}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Summary & Coaching (1 Col Wide) */}
                        <div className="space-y-6">
                            {/* Summary Metrics (KDA, CS, etc) moved here */}
                            <SummaryCards summary={summary} analysis={analysis} />

                            {/* AI Coach Panel */}
                            {(data.coaching_report || data.coaching_report_markdown) && (() => {
                                const report = typeof data.coaching_report === 'object'
                                    ? data.coaching_report
                                    : { overview: data.coaching_report || data.coaching_report_markdown };

                                return (
                                    <div className="glass-panel rounded-xl p-5 border-t-2 border-t-violet-500">
                                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 text-glow">
                                            <span className="text-violet-400">Nexus</span> Neural Link
                                        </h2>

                                        {
                                            report.overview && (
                                                <div className="prose-coaching text-xs mb-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                    <ReactMarkdown>{report.overview}</ReactMarkdown>
                                                </div>
                                            )
                                        }

                                        <div className="grid grid-cols-1 gap-3">
                                            {report.champion_feedback && (
                                                <div className="bg-black/20 rounded p-3 border border-white/5">
                                                    <h4 className="text-[10px] font-bold text-green-400 mb-1 uppercase tracking-wider">Tactics</h4>
                                                    <div className="prose-coaching text-xs"><ReactMarkdown>{report.champion_feedback}</ReactMarkdown></div>
                                                </div>
                                            )}
                                            {report.itemization_tips && (
                                                <div className="bg-black/20 rounded p-3 border border-white/5">
                                                    <h4 className="text-[10px] font-bold text-yellow-400 mb-1 uppercase tracking-wider">Logistics</h4>
                                                    <div className="prose-coaching text-xs"><ReactMarkdown>{report.itemization_tips}</ReactMarkdown></div>
                                                </div>
                                            )}
                                        </div>
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
            </div>
        </div>
    );
}

// Helper (moved from RankCard or can be shared but simpler to inline if imports tricky)
// Actually we import components so we are good.

