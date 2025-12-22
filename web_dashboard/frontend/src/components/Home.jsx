import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Loader2, Clock, ChevronRight, History } from 'lucide-react';
import config from '../config';
import heroBg from '../assets/hero_bg.jpg';

export default function Home({ onSelect, onAnalyze }) {
    const [riotId, setRiotId] = useState('');
    const [matchCount, setMatchCount] = useState(20);
    const [region, setRegion] = useState('NA');
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
            await onAnalyze(targetId, matchCount, region);
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
        <div className="min-h-screen bg-dark-bg text-white font-sans flex flex-col relative overflow-hidden">
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
                    <div className="w-8 h-8 bg-violet-600/80 rounded-lg flex items-center justify-center font-bold text-xl text-white border border-white/20">L</div>
                    <span className="text-xl font-bold tracking-tight text-white">LeagueAnalyzer</span>
                </div>
            </div>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pb-32">
                <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-8 tracking-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-white drop-shadow-sm">
                        Master Your Gameplay
                    </span>
                </h1>

                <p className="text-cornsilk/60 text-lg mb-12 text-center max-w-2xl font-light">
                    Advanced performance analytics for League of Legends.
                    Get objective insights into your macro, combat, and vision control.
                </p>

                {/* Search Container */}
                <div ref={searchRef} className="w-full max-w-2xl relative">
                    <form onSubmit={handleSearch} className="relative group z-20">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                            <Search className="h-6 w-6 text-violet-400/50 group-focus-within:text-violet-400 transition-colors" />
                        </div>

                        <input
                            type="text"
                            value={riotId}
                            onChange={(e) => {
                                setRiotId(e.target.value);
                                setShowRecent(true);
                            }}
                            onFocus={() => setShowRecent(true)}
                            placeholder="Search Name#Tag"
                            className="block w-full pl-14 pr-40 md:pr-64 py-5 bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder:text-slate-400 rounded-xl shadow-2xl focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 text-lg font-medium outline-none transition-all"
                        />

                        <div className="absolute inset-y-2 right-2 flex items-center gap-2">
                            <select
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                                className="bg-slate-900 border border-white/10 text-slate-300 text-sm font-medium rounded-lg px-2 py-2 outline-none hover:bg-violet-500/10 hover:text-white cursor-pointer transition-colors focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark] focus:bg-slate-900"
                            >
                                <option value="NA" className="bg-slate-900 text-slate-300">NA</option>
                                <option value="EUW" className="bg-slate-900 text-slate-300">EUW</option>
                                <option value="EUNE" className="bg-slate-900 text-slate-300">EUNE</option>
                                <option value="KR" className="bg-slate-900 text-slate-300">KR</option>
                                <option value="BR" className="bg-slate-900 text-slate-300">BR</option>
                                <option value="LAN" className="bg-slate-900 text-slate-300">LAN</option>
                                <option value="LAS" className="bg-slate-900 text-slate-300">LAS</option>
                                <option value="OCE" className="bg-slate-900 text-slate-300">OCE</option>
                                <option value="TR" className="bg-slate-900 text-slate-300">TR</option>
                                <option value="RU" className="bg-slate-900 text-slate-300">RU</option>
                                <option value="JP" className="bg-slate-900 text-slate-300">JP</option>
                                <option value="PH" className="bg-slate-900 text-slate-300">PH</option>
                                <option value="SG" className="bg-slate-900 text-slate-300">SG</option>
                                <option value="TH" className="bg-slate-900 text-slate-300">TH</option>
                                <option value="TW" className="bg-slate-900 text-slate-300">TW</option>
                                <option value="VN" className="bg-slate-900 text-slate-300">VN</option>
                            </select>



                            <button
                                type="submit"
                                disabled={analyzing}
                                className="bg-violet-600 hover:bg-violet-500 text-white border border-white/20 p-3 rounded-lg font-bold transition-all shadow-lg shadow-violet-500/20"
                            >
                                {analyzing ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <>
                                        <span className="hidden md:inline">Analyze</span>
                                        <Search className="md:hidden" size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Recent Searches Dropdown */}
                    {showRecent && filteredRecents.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-2 text-xs font-bold text-violet-400 uppercase tracking-wider bg-violet-500/5">
                                Recent Searches
                            </div>
                            {filteredRecents.slice(0, 5).map((file) => (
                                <button
                                    key={file.filename}
                                    onClick={() => onSelect(file.filename)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-violet-500/10 transition-colors border-b border-white/5 last:border-0 group text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:text-white group-hover:bg-violet-600 transition-colors">
                                            <History size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors">
                                                {file.riot_id !== 'Unknown' ? file.riot_id : file.filename}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="text-violet-400 font-medium">{file.primary_role}</span>
                                                <span>•</span>
                                                <Clock size={12} />
                                                <span>{new Date(file.created * 1000).toLocaleDateString()}</span>
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

                {/* DEBUG FOOTER */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/20 hover:text-white/50 transition-colors">
                    Backend: {config.API_URL}
                </div>

            </main>
        </div>
    );
}
