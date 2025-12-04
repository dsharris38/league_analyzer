import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import SummaryCards from './SummaryCards';
import MatchSummaryCard from './MatchSummaryCard';
import MatchDetailView from './MatchDetailView';
import DeepDiveView from './DeepDiveView';
import { ArrowLeft, ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react';
import config from '../config';

export default function DashboardView({ data, filename, onBack }) {
    const { analysis, coaching_report_markdown } = data;

    if (!analysis) {
        return <div className="p-8 text-center text-slate-400">Analysis data is missing or corrupt.</div>;
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
        <div className="max-w-7xl mx-auto p-6 relative">
            {/* Deep Dive Modal */}
            {(deepDiveReport || isDeepDiveLoading) && (
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
            )}

            <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft size={20} />
                Back to List
            </button>

            <div className="flex items-center justify-between mb-6 bg-slate-800/80 p-4 rounded-xl border border-slate-700/50 backdrop-blur-md shadow-lg">
                <div className="flex items-center gap-4">
                    {/* Profile Icon & Level */}
                    <div className="relative group">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-600 shadow-md group-hover:border-blue-500 transition-colors duration-300">
                            <img
                                src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/${data.summoner_info?.profile_icon_id || 29}.png`}
                                alt="Profile"
                                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                            />
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700 shadow-sm">
                            {data.summoner_info?.level || 0}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-baseline gap-2 mb-0.5">
                            <h1 className="text-2xl font-bold text-white tracking-tight">{data.game_name}</h1>
                            <span className="text-sm text-slate-500 font-light">#{data.tag_line}</span>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                            {/* Rank Info */}
                            {(() => {
                                const solo = data.rank_info?.find(r => r.queueType === "RANKED_SOLO_5x5");
                                if (solo) {
                                    return (
                                        <div className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded-md border border-white/5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]"></div>
                                            <span className="text-slate-300 font-medium">Solo</span>
                                            <span className="text-white font-bold">{solo.tier} {solo.rank}</span>
                                            <span className="text-slate-500">{solo.leaguePoints} LP</span>
                                        </div>
                                    );
                                }
                                return <div className="text-slate-500 text-xs">Unranked</div>;
                            })()}

                            <div className="text-slate-500">
                                <span className="text-white font-bold">{data.match_count_requested}</span> Games Analyzed
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <SummaryCards summary={summary} analysis={analysis} />

            <div className="mt-8 space-y-8">

                {/* Champion Performance Cards - Compact Grid */}
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Champion Performance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {per_champion && per_champion.map((champ) => (
                            <div key={champ.champion} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 hover:bg-slate-800 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                                {/* Subtle background gradient based on winrate */}
                                <div className={`absolute inset-0 opacity-5 ${champ.winrate >= 0.5 ? 'bg-gradient-to-br from-green-500 to-transparent' : 'bg-gradient-to-br from-red-500 to-transparent'}`}></div>

                                <div className="flex items-center gap-3 relative z-10">
                                    {/* Compact Portrait */}
                                    <div className="relative w-10 h-10 shrink-0">
                                        <img
                                            src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/${champ.champion === "FiddleSticks" ? "Fiddlesticks" : champ.champion}.png`}
                                            alt={champ.champion}
                                            className="w-full h-full rounded-md object-cover border border-slate-600 shadow-sm"
                                            onError={(e) => { e.target.src = "https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/29.png" }}
                                        />
                                        <div className={`absolute -bottom-1 -right-1 px-1 rounded text-[8px] font-bold border border-slate-900 shadow-sm ${champ.winrate >= 0.5 ? 'bg-green-500 text-green-950' : 'bg-red-500 text-white'
                                            }`}>
                                            {(champ.winrate * 100).toFixed(0)}%
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-sm font-bold text-white truncate">{champ.champion}</h4>
                                            <span className="text-[10px] text-slate-500">{champ.games} G</span>
                                        </div>

                                        {/* Mini Stats Row */}
                                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                                            <div className="flex items-center gap-1 bg-slate-900/40 px-1.5 py-0.5 rounded border border-white/5">
                                                <span className="text-slate-500">KDA</span>
                                                <span className={`font-medium ${champ.avg_kda >= 3 ? 'text-blue-300' : 'text-slate-300'}`}>
                                                    {champ.avg_kda.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 bg-slate-900/40 px-1.5 py-0.5 rounded border border-white/5">
                                                <span className="text-slate-500">CS</span>
                                                <span className={`font-medium ${champ.cs_per_min >= 7 ? 'text-yellow-300' : 'text-slate-300'}`}>
                                                    {champ.cs_per_min.toFixed(1)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Match History List */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            className="flex items-center gap-2 text-xl font-bold text-white hover:text-blue-400 transition-colors"
                        >
                            Match History
                            {isHistoryOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                        </button>
                    </div>

                    {isHistoryOpen && (
                        <div className="space-y-4">
                            {/* Filter Bar */}
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-wrap gap-4 items-center">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Filter size={18} />
                                    <span className="text-sm font-medium">Filters:</span>
                                </div>

                                {/* Champion Search */}
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Champion..."
                                        value={filters.champion}
                                        onChange={(e) => setFilters({ ...filters, champion: e.target.value })}
                                        className="bg-slate-900 border border-slate-700 rounded-md pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-40"
                                    />
                                </div>

                                {/* Role Select */}
                                <select
                                    value={filters.role}
                                    onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                                    className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="ALL">All Roles</option>
                                    <option value="TOP">Top</option>
                                    <option value="JUNGLE">Jungle</option>
                                    <option value="MIDDLE">Mid</option>
                                    <option value="BOTTOM">Bot</option>
                                    <option value="UTILITY">Support</option>
                                </select>

                                {/* Result Select */}
                                <select
                                    value={filters.result}
                                    onChange={(e) => setFilters({ ...filters, result: e.target.value })}
                                    className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="ALL">All Results</option>
                                    <option value="WIN">Win</option>
                                    <option value="LOSS">Loss</option>
                                </select>

                                {hasActiveFilters && (
                                    <button
                                        onClick={clearFilters}
                                        className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                                    >
                                        <X size={14} />
                                        Clear
                                    </button>
                                )}
                            </div>

                            <div className="space-y-0">
                                {filteredMatches.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        No matches found matching filters.
                                    </div>
                                ) : (
                                    filteredMatches.map((match) => {
                                        // Check if this match is a review candidate
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
                                                    <MatchDetailView match={match} puuid={data.puuid} />
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Coaching Report Cards */}
                {(data.coaching_report || data.coaching_report_markdown) && (() => {
                    const report = typeof data.coaching_report === 'object'
                        ? data.coaching_report
                        : { overview: data.coaching_report || data.coaching_report_markdown };

                    return (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <h2 className="text-xl font-bold text-white">AI Coaching Report</h2>
                            </div>

                            {/* Overview Card */}
                            {report.overview && (
                                <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                                    <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                                        <h3 className="text-lg font-bold text-blue-400">Strategic Overview</h3>
                                    </div>
                                    <div className="p-6 prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-white prose-strong:text-white">
                                        <ReactMarkdown>{report.overview}</ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Champion Feedback */}
                                {report.champion_feedback && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                                        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                                            <h3 className="text-lg font-bold text-green-400">Champion Specifics</h3>
                                        </div>
                                        <div className="p-6 prose prose-invert max-w-none text-sm prose-p:text-slate-300 prose-headings:text-white prose-strong:text-white flex-1">
                                            <ReactMarkdown>{report.champion_feedback}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {/* Itemization */}
                                {report.itemization_tips && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                                        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                                            <h3 className="text-lg font-bold text-yellow-400">Itemization & Builds</h3>
                                        </div>
                                        <div className="p-6 prose prose-invert max-w-none text-sm prose-p:text-slate-300 prose-headings:text-white prose-strong:text-white flex-1">
                                            <ReactMarkdown>{report.itemization_tips}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {/* Goals */}
                                {report.goals && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                                        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                                            <h3 className="text-lg font-bold text-purple-400">Focus Goals</h3>
                                        </div>
                                        <div className="p-6 prose prose-invert max-w-none text-sm prose-p:text-slate-300 prose-headings:text-white prose-strong:text-white flex-1">
                                            <ReactMarkdown>{report.goals}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
