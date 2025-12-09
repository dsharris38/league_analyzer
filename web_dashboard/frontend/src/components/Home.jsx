import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Loader2, Clock, ChevronRight, History } from 'lucide-react';
import config from '../config';
import heroBg from '../assets/hero_bg.jpg';

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
        } catch (error) {
            console.error('Analysis failed:', error);
            const errorMsg = error.response?.data?.error || error.message || "Unknown error occurred";
            setAnalyzeError(`Failed to start analysis: ${errorMsg}`);
            setAnalyzing(false);
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
        <div className="min-h-screen bg-dark-bg text-cornsilk font-sans flex flex-col relative overflow-hidden">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
                <img
                    src={heroBg}
                    alt="Background"
                    className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-dark-bg/60 via-dark-bg/80 to-dark-bg"></div>
            </div>

            {/* Navbar Placeholder */}
            <div className="relative z-10 px-8 py-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-rose-vale/80 rounded-lg flex items-center justify-center font-bold text-xl text-cornsilk border border-cornsilk/20">L</div>
                    <span className="text-xl font-bold tracking-tight">LeagueAnalyzer</span>
                </div>
            </div>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pb-32">
                <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-8 tracking-tight font-serif">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-vale to-cornsilk drop-shadow-sm">
                        Master Your Gameplay
                    </span>
                </h1>

                <p className="text-cornsilk/60 text-lg mb-12 text-center max-w-2xl font-light">
                    AI-powered aesthetic analysis for League of Legends.
                    Deep dive into your mistakes, itemization, and macro with a single search.
                </p>

                {/* Search Container */}
                <div ref={searchRef} className="w-full max-w-2xl relative">
                    <form onSubmit={handleSearch} className="relative group z-20">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                            <Search className="h-6 w-6 text-rose-vale/50 group-focus-within:text-rose-vale transition-colors" />
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
                            className="block w-full pl-14 pr-32 py-5 bg-cornsilk/5 backdrop-blur-md border border-rose-vale/20 text-cornsilk placeholder:text-cornsilk/30 rounded-xl shadow-2xl focus:ring-2 focus:ring-rose-vale/50 focus:border-rose-vale/50 text-lg font-medium outline-none transition-all"
                        />

                        <div className="absolute inset-y-2 right-2 flex items-center gap-2">
                            <select
                                value={matchCount}
                                onChange={(e) => setMatchCount(Number(e.target.value))}
                                className="bg-dark-bg/50 border border-cornsilk/10 text-cornsilk/70 text-sm font-medium rounded-lg px-3 py-2 outline-none hover:bg-rose-vale/10 hover:text-cornsilk cursor-pointer hidden sm:block transition-colors"
                            >
                                <option value={10}>10 Games</option>
                                <option value={20}>20 Games</option>
                                <option value={30}>30 Games</option>
                            </select>

                            <button
                                type="submit"
                                disabled={analyzing}
                                className="bg-rose-vale hover:bg-rose-vale/90 text-cornsilk border border-cornsilk/20 p-3 rounded-lg font-bold transition-all shadow-lg shadow-rose-vale/20"
                            >
                                {analyzing ? <Loader2 className="animate-spin" /> : "Analyze"}
                            </button>
                        </div>
                    </form>

                    {/* Recent Searches Dropdown */}
                    {showRecent && filteredRecents.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-bg/95 backdrop-blur-xl border border-rose-vale/20 rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-2 text-xs font-bold text-rose-vale uppercase tracking-wider bg-rose-vale/5">
                                Recent Searches
                            </div>
                            {filteredRecents.slice(0, 5).map((file) => (
                                <button
                                    key={file.filename}
                                    onClick={() => onSelect(file.filename)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-rose-vale/10 transition-colors border-b border-rose-vale/10 last:border-0 group text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-rose-vale/10 border border-rose-vale/20 flex items-center justify-center text-rose-vale group-hover:text-cornsilk group-hover:bg-rose-vale transition-colors">
                                            <History size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-cornsilk text-lg font-serif">
                                                {file.riot_id !== 'Unknown' ? file.riot_id : file.filename}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-cornsilk/50">
                                                <span className="text-rose-vale/80 font-medium">{file.primary_role}</span>
                                                <span>•</span>
                                                <Clock size={12} />
                                                <span>{new Date(file.created).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-rose-vale/50 group-hover:text-cornsilk transition-colors" />
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
