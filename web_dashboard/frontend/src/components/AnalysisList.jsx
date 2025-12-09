import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Clock, ChevronRight, Plus, X, Loader2 } from 'lucide-react';
import config from '../config';

export default function AnalysisList({ onSelect }) {
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Analysis Modal State
    const [showModal, setShowModal] = useState(false);
    const [riotId, setRiotId] = useState('');
    const [matchCount, setMatchCount] = useState(20);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState(null);

    const fetchAnalyses = () => {
        setLoading(true);
        axios.get(`${config.API_URL}/api/analyses/`)
            .then(res => {
                setAnalyses(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError('Failed to load analyses');
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchAnalyses();
    }, []);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!riotId.includes('#')) {
            setAnalyzeError('Invalid Riot ID format. Use Name#TAG');
            return;
        }

        setAnalyzing(true);
        setAnalyzeError(null);

        try {
            await axios.post(`${config.API_URL}/api/analyze/`, {
                riot_id: riotId,
                match_count: matchCount
            });
            setShowModal(false);
            setRiotId('');
            fetchAnalyses(); // Refresh list
        } catch (err) {
            console.error(err);
            setAnalyzeError(err.response?.data?.error || 'Analysis failed. Check backend logs.');
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading && !analyses.length) return <div className="p-8 text-center text-slate-400">Loading analyses...</div>;
    if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white">Recent Analyses</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors font-serif shadow-lg shadow-blue-500/20"
                >
                    <Plus size={20} />
                    New Analysis
                </button>
            </div>

            {analyses.length === 0 ? (
                <div className="text-center p-12 bg-slate-800 rounded-xl border border-slate-700">
                    <p className="text-slate-400">No analysis files found.</p>
                    <p className="text-sm text-slate-500 mt-2">Run a new analysis to get started.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {analyses.map((file) => (
                        <button
                            key={file.filename}
                            onClick={() => onSelect(file.filename)}
                            className="group flex items-center justify-between p-5 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-700/50 hover:border-blue-500/40 rounded-xl transition-all w-full text-left backdrop-blur-sm"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 group-hover:text-white group-hover:bg-blue-500/20 transition-colors">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-white/80 group-hover:text-white font-serif">
                                        {file.riot_id !== 'Unknown' ? file.riot_id : file.filename.replace('league_analysis_', '').replace('.json', '').replace(/_/g, '#')}
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                                        <span className="text-blue-400 font-medium">{file.primary_role}</span>
                                        <span className="w-1 h-1 bg-slate-600 rounded-full mx-1"></span>
                                        <span>{file.match_count} Games</span>
                                        <span className="w-1 h-1 bg-slate-600 rounded-full mx-1"></span>
                                        <Clock size={14} />
                                        <span>{new Date(file.created).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                        </button>
                    ))}
                </div>
            )}

            {/* Analysis Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl w-full max-w-md p-6 shadow-2xl shadow-blue-500/10">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">New Analysis</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAnalyze} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Riot ID (Name#TAG)</label>
                                <input
                                    type="text"
                                    value={riotId}
                                    onChange={(e) => setRiotId(e.target.value)}
                                    placeholder="Faker#KR1"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Matches to Analyze</label>
                                <select
                                    value={matchCount}
                                    onChange={(e) => setMatchCount(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value={10}>10 Games</option>
                                    <option value={20}>20 Games</option>
                                    <option value={30}>30 Games</option>
                                    <option value={50}>50 Games</option>
                                </select>
                            </div>

                            {analyzeError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                                    {analyzeError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={analyzing}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-serif"
                            >
                                {analyzing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Analyzing...
                                    </>
                                ) : (
                                    'Start Analysis'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
