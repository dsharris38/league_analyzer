import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Loader2, Clock, ChevronRight, History } from 'lucide-react';
import config from '../config';

export default function Home({ onSelect, onAnalyze }) {
    const [riotId, setRiotId] = useState('');
    const [matchCount, setMatchCount] = useState(20);
    const [recentAnalyses, setRecentAnalyses] = useState([]);
    const [showRecent, setShowRecent] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState(null);
    const searchRef = useRef(null);

    useEffect(() => {
        // Fetch recent analyses for the dropdown
        axios.get(`${config.API_URL}/api/analyses/`)
            .then(res => setRecentAnalyses(res.data))
            .catch(err => console.error("Failed to load recent analyses", err));

        // Click outside handler
        function handleClickOutside(event) {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowRecent(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!riotId) return;

        // If user types exactly a cached name, we could load that? 
        // But usually search means "New Analysis" or "Find". 
        // For now, let's treat the big button as "Analyze/Update".
        // But if it's already in the list, maybe we should just load it?
        // Let's stick to consistent behavior: Search = Analyze/Update.
        // Actually, if we want to mimic U.GG, search usually brings you to the profile.
        // If it exists, we show it. If not, we analyze it.
        // For this app, "Analyze" is expensive (tokens/time).

        // Check if fully updated cache exists? 
        // Let's just run the analysis pipeline which now handles caching/updating logic or just overwrites.
        // User asked for "Update" button on profile, so search here should probably just be "Analyze New/Existing".

        await runAnalysis(riotId);
    };

    const runAnalysis = async (targetId) => {
        if (!targetId.includes('#')) {
            setAnalyzeError('Invalid Riot ID format. Use Name#TAG');
            return;
        }

        setAnalyzing(true);
        setAnalyzeError(null);

        try {
            await onAnalyze(targetId, matchCount);
        } catch (err) {
            setAnalyzeError(err.message || 'Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    // Filter recents based on input
    const filteredRecents = recentAnalyses.filter(file => {
        const name = file.riot_id !== 'Unknown' ? file.riot_id : file.filename;
        return name.toLowerCase().includes(riotId.toLowerCase());
    });

    return (
        <div className="min-h-screen bg-[#0b0c2a] text-white font-sans flex flex-col relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#1a1c4b] to-[#0b0c2a] z-0"></div>
            <div className="absolute top-[-100px] left-[-100px] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px]"></div>

            {/* Navbar Placeholder */}
            <div className="relative z-10 px-8 py-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">L</div>
                    <span className="text-xl font-bold tracking-tight">LeagueAnalyzer</span>
                </div>
            </div>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pb-32">
                <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-8 tracking-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        Master Your Gameplay
                    </span>
                </h1>

                <p className="text-slate-400 text-lg mb-12 text-center max-w-2xl">
                    AI-powered aesthetic analysis for League of Legends.
                    Deep dive into your mistakes, itemization, and macro with a single search.
                </p>

                {/* Search Container */}
                <div ref={searchRef} className="w-full max-w-2xl relative">
                    <form onSubmit={handleSearch} className="relative group z-20">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                            <Search className="h-6 w-6 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>

                        <input
                            type="text"
                            value={riotId}
                            onChange={(e) => {
                                setRiotId(e.target.value);
                                setShowRecent(true);
                            }}
                            onFocus={() => setShowRecent(true)}
                            placeholder="Search Yourself or a Champion (e.g. Faker#KR1)"
                            className="block w-full pl-14 pr-32 py-5 bg-white text-slate-900 placeholder:text-slate-400 border-none rounded-xl shadow-2xl focus:ring-4 focus:ring-blue-500/30 text-lg font-medium outline-none transition-shadow"
                        />

                        <div className="absolute inset-y-2 right-2 flex items-center gap-2">
                            <select
                                value={matchCount}
                                onChange={(e) => setMatchCount(Number(e.target.value))}
                                className="bg-slate-100 text-slate-600 text-sm font-medium rounded-lg px-3 py-2 border-none outline-none hover:bg-slate-200 cursor-pointer hidden sm:block"
                            >
                                <option value={10}>10 Games</option>
                                <option value={20}>20 Games</option>
                                <option value={30}>30 Games</option>
                            </select>

                            <button
                                type="submit"
                                disabled={analyzing}
                                className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg font-bold transition-colors shadow-lg shadow-blue-600/20"
                            >
                                {analyzing ? <Loader2 className="animate-spin" /> : "Analyze"}
                            </button>
                        </div>
                    </form>

                    {/* Recent Searches Dropdown */}
                    {showRecent && filteredRecents.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1c4b]/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-black/20">
                                Recent Searches
                            </div>
                            {filteredRecents.slice(0, 5).map((file) => (
                                <button
                                    key={file.filename}
                                    onClick={() => onSelect(file.filename)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-600/20 transition-colors border-b border-white/5 last:border-0 group text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-colors">
                                            <History size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-lg">
                                                {file.riot_id !== 'Unknown' ? file.riot_id : file.filename}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <span className="text-blue-400">{file.primary_role}</span>
                                                <span>•</span>
                                                <Clock size={12} />
                                                <span>{new Date(file.created).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-600 group-hover:text-white transition-colors" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {analyzeError && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm max-w-2xl w-full text-center">
                        {analyzeError}
                    </div>
                )}

            </main>
        </div>
    );
}
