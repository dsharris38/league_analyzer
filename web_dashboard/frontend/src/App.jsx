import React, { useState, useEffect } from 'react';
import axios from 'axios';
// import AnalysisList from './components/AnalysisList'; // Deprecated
import Home from './components/Home';
import DashboardView from './components/DashboardView';
import BackendStatus from './components/BackendStatus';
import config from './config';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load persistent session from URL Hash
  useEffect(() => {
    // 1. Check URL Hash (Priority)
    const loadFromHash = () => {
      const hash = window.location.hash.slice(1); // Remove #
      if (hash && hash.startsWith('league_analysis_')) {
        console.log("Loading from URL Hash:", hash);
        handleSelect(decodeURIComponent(hash), false); // Pass false to avoid recursive hash update? Or just let it be idempotent.
      } else {
        // If hash is empty, ensure we are at Home
        if (selectedFile) {
          setSelectedFile(null);
          setAnalysisData(null);
        }
      }
    };

    // Load on mount
    loadFromHash();

    // Listen for hash changes (e.g. Back button)
    window.addEventListener('hashchange', loadFromHash);
    return () => window.removeEventListener('hashchange', loadFromHash);
  }, []); // Only bind listener once, loadFromHash handles current state

  // Load existing analysis from cache/file
  const handleSelect = (filename, updateHash = true) => {
    console.log("Selecting file:", filename);
    setSelectedFile(filename);

    // Update URL Hash for persistence
    if (updateHash) {
      window.location.hash = encodeURIComponent(filename);
    }

    setLoading(true);
    axios.get(`${config.API_URL}/api/analyses/${encodeURIComponent(filename)}/`)
      .then(res => {
        setAnalysisData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
        // If load fails, clear hash to return to home
        alert("Failed to load analysis: " + (err.response?.data?.error || err.message));
        if (err.response && err.response.status === 404) {
          window.location.hash = "";
          setSelectedFile(null);
        } else {
          // Don't clear for transient errors, but might need manual retry
          // window.location.hash = "";
          setSelectedFile(null);
        }
      });
  };

  // Run new analysis / Navigate to player (Optimized: Check First)
  const handleAnalyze = async (riotId, matchCount, region, puuid = null) => {
    // 1. Optimistic Lookup: Check if we have ANY data for this user
    try {
      const lookupRes = await axios.get(`${config.API_URL}/api/lookup/`, {
        params: { riot_id: riotId }
      });

      if (lookupRes.data.found) {
        console.log("Optimistic Cache Hit! Loading immediately:", lookupRes.data.filename);

        // A. Load the cached dashboard instantly
        handleSelect(lookupRes.data.filename);

        // B. Trigger Background Refresh (Silent)
        console.log("Triggering background refresh...");
        // Non-blocking async call
        performBackgroundUpdate(riotId, matchCount, region, puuid, lookupRes.data.filename);
        return;
      }
    } catch (err) {
      console.warn("Optimistic lookup check failed (proceeding to normal flow):", err);
    }

    // 2. Normal Flow (No cache found)
    setLoading(true);

    try {
      // Ensure saveToHistory is available
      const saveToHistory = (entryRiotId, entryRegion, entryFilename) => {
        try {
          const newEntry = {
            riot_id: entryRiotId,
            filename: entryFilename,
            region: entryRegion,
            created: Date.now() / 1000,
            timestamp: Date.now()
          };
          const raw = localStorage.getItem('searchHistory');
          const prev = raw ? JSON.parse(raw) : [];
          const filtered = prev.filter(p => p.riot_id.toLowerCase().replace(/#/g, '').replace(/\s/g, '') !== entryRiotId.toLowerCase().replace(/#/g, '').replace(/\s/g, ''));
          const updated = [newEntry, ...filtered].slice(0, 10);
          localStorage.setItem('searchHistory', JSON.stringify(updated));
        } catch (storageErr) {
          console.error("Failed to save history", storageErr);
        }
      };

      // Run new analysis
      console.log("Starting new analysis for:", riotId);
      const analyzeResponse = await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region,
        puuid: puuid,
        call_ai: true,
        use_timeline: true
      });

      console.log("Analysis initiated:", analyzeResponse.data);
      const { filename } = analyzeResponse.data;

      saveToHistory(riotId, region, filename);
      handleSelect(filename);

    } catch (err) {
      console.error("Analysis Error:", err);
      setLoading(false);
      alert(err.response?.data?.error || "Analysis failed. Please check inputs.");
    }
  };

  // Helper for duplicate logic
  const performBackgroundUpdate = async (riotId, matchCount, region, puuid, filename) => {
    try {
      // STAGE 1 (Matches)
      // We set a longer timeout (60s) to avoid client-side "Network Error" when backend is slow but working
      await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region,
        force_refresh: true, // Force new fetch
        call_ai: false,      // Fast stage first
        use_timeline: true,
        puuid: puuid
      }, { timeout: 60000 }); // 60s timeout for Stage 1

      refreshData(filename);

      // STAGE 2 (AI)
      // AI can take longer, so we set a very generous timeout
      await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region,
        force_refresh: true,
        call_ai: true,     // Full AI
        use_timeline: true,
        puuid: puuid
      }, { timeout: 120000 }); // 120s timeout for Stage 2

      refreshData(filename);
      console.log("Background update complete for", riotId);

    } catch (e) {
      console.error("Background update failed (Network/Timeout?):", e);
      // Even if it failed, maybe the DB updated? Try refreshing one last time.
      // This handles the "Server finished but response timed out" case.
      refreshData(filename);
    }
  };

  const handleBack = () => {
    setSelectedFile(null);
    setAnalysisData(null);
    window.location.hash = ""; // Clear Hash
  };

  // Silent refresh for updates
  const refreshData = (filename) => {
    axios.get(`${config.API_URL}/api/analyses/${encodeURIComponent(filename)}/?_t=${Date.now()}`)
      .then(res => {
        setAnalysisData(res.data);
      })
      .catch(err => {
        console.error("Silent refresh failed:", err);
      });
  };

  const handleUpdate = async () => {
    // Re-run analysis for the current user
    if (!analysisData) {
      console.error("handleUpdate: No analysisData available");
      return;
    }

    // Fix: Prefer 'riot_id' property if available, fallback to composition only if needed.
    // Use optional chaining to prevent 'undefined#undefined'
    const riotId = analysisData.riot_id ||
      (analysisData.game_name && analysisData.tag_line ? `${analysisData.game_name}#${analysisData.tag_line}` : null);

    if (!riotId) {
      alert("Error: Invalid Analysis Data (Missing Riot ID). Cannot update.");
      return;
    }

    // Force 50 matches per user requirement (Dashboard size)
    // Backend handles historical backfill for stats separately
    const matchCount = 50;
    const region = analysisData.region || 'NA';
    const puuid = analysisData.summoner_info?.puuid || analysisData.puuid;

    console.log("handleUpdate: Starting update", { riotId, matchCount, region, puuid, selectedFile });

    // Do NOT set full screen loading. We want the dashboard to stay visible.
    // The DashboardView can show its own local loading state if needed.
    try {
      // STAGE 1: Update Matches instantly (No AI)
      console.log("handleUpdate: Stage 1 - Fetching matches (call_ai=false, use_timeline=true)");
      const stage1Response = await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region,
        force_refresh: true,
        call_ai: false,
        use_timeline: true, // Re-enabled: User wants full data
        puuid: puuid
      });
      console.log("handleUpdate: Stage 1 response:", stage1Response.status, stage1Response.data);

      console.log("handleUpdate: Refreshing data after Stage 1");
      refreshData(selectedFile); // Show new matches immediately

      // STAGE 2: Full Analysis (AI + Timelines)
      if (analysisData.game_name && analysisData.tag_line) {
        console.log("handleUpdate: Stage 2 - Running AI Analysis (call_ai=true)");
        const res = await axios.post(`${config.API_URL}/api/analyze/`, {
          riot_id: riotId,
          match_count: matchCount,
          region: region,
          force_refresh: true,
          call_ai: true,
          use_timeline: true,
          puuid: puuid
        }, { timeout: 300000 }); // 5 Minute Timeout (prevent "Taking Forever" failure)

        console.log("handleUpdate: Stage 2 complete", res.status, res.data);
      }

      console.log("handleUpdate: Refreshing data after Stage 2");
      refreshData(selectedFile); // Show new AI report

      console.log("handleUpdate: Update completed successfully");
    } catch (err) {
      console.error("handleUpdate: Error occurred", err);
      console.error("handleUpdate: Error response:", err.response?.status, err.response?.data);
      console.error("handleUpdate: Error message:", err.message);
      alert(`Update failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const handlePlayerClick = (riotId, puuid = null) => {
    // Navigate to player analysis
    const region = analysisData?.region || 'NA';
    handleAnalyze(riotId, 20, region, puuid);
  };


  if (loading) return (
    <div className="min-h-screen bg-[#0b0c2a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-violet-500"></div>
        <p className="text-violet-400 font-medium animate-pulse">Running Analysis...</p>
      </div>
    </div>
  );

  // Global Error Boundary to catch "Blank Page" crashes
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      console.error("Uncaught Error:", error, errorInfo);
      this.setState({ errorInfo });
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="min-h-screen bg-[#0b0c2a] flex items-center justify-center p-8 text-white font-mono">
            <div className="bg-slate-900 border border-red-500/50 rounded-xl p-8 max-w-2xl shadow-2xl">
              <h1 className="text-2xl font-bold text-red-500 mb-4 flex items-center gap-2">
                <span className="text-3xl">☠️</span> Dashboard Crashed
              </h1>
              <p className="text-slate-300 mb-6">
                Something went wrong while rendering the interface.
                <br />
                Please share the error below with the developer.
              </p>

              <div className="bg-black/50 p-4 rounded-lg border border-red-500/20 overflow-auto max-h-64 mb-6">
                <div className="text-red-400 font-bold mb-2">{this.state.error && this.state.error.toString()}</div>
                <div className="text-slate-500 text-xs whitespace-pre-wrap">
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </div>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        );
      }

      return this.props.children;
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0c2a] text-slate-100 font-sans">
      <BackendStatus />
      <ErrorBoundary>
        {!analysisData ? (
          <Home onSelect={handleSelect} onAnalyze={handleAnalyze} />
        ) : (
          <DashboardView
            data={analysisData}
            filename={selectedFile}
            onBack={handleBack}
            onUpdate={handleUpdate}
            onPlayerClick={handlePlayerClick}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}

export default App;
