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

  // Load persistent session
  useEffect(() => {
    // Check for saved analysis but DO NOT auto-load it.
    // User prefers landing on the search page first.
    // const savedFile = localStorage.getItem('lastAnalysisFile');
    // if (savedFile) {
    //    // Add timeout to prevent infinite loading
    //    const timeoutId = setTimeout(() => {
    //      console.warn('Auto-load timeout - clearing cache');
    //      localStorage.removeItem('lastAnalysisFile');
    //      setLoading(false);
    //      setSelectedFile(null);
    //    }, 30000); // 30 second timeout

    //    // Clear timeout if load succeeds
    //    const originalHandleSelect = handleSelect;
    //    handleSelect(savedFile);

    //    // Clean up timeout on unmount
    //    return () => clearTimeout(timeoutId);
    // }
  }, []);

  // Load existing analysis from cache/file
  const handleSelect = (filename) => {
    setSelectedFile(filename);
    localStorage.setItem('lastAnalysisFile', filename); // Persist
    setLoading(true);
    axios.get(`${config.API_URL}/api/analyses/${encodeURIComponent(filename)}/`)
      .then(res => {
        setAnalysisData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
        // If load fails (file deleted), clear cache
        if (err.response && err.response.status === 404) {
          localStorage.removeItem('lastAnalysisFile');
          setSelectedFile(null);
        } else {
          // Don't alert on auto-load failures, just clear
          localStorage.removeItem('lastAnalysisFile');
          setSelectedFile(null);
        }
      });
  };

  // Run new analysis / Navigate to player (Optimized: Check First)
  const handleAnalyze = async (riotId, matchCount, region, puuid = null) => {
    setLoading(true);

    try {
      // 1. Check if analysis already exists (Fast Switch)
      const res = await axios.get(`${config.API_URL}/api/analyses/?_t=${Date.now()}`);
      const files = res.data;

      const targetId = riotId.toLowerCase().replace(/#/g, '').replace(/\s/g, '');
      const match = files.find(f =>
        f.riot_id.toLowerCase().replace(/#/g, '').replace(/\s/g, '') === targetId
      );

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

      if (match) {
        console.log("Found existing analysis, loading:", match.filename);
        saveToHistory(match.riot_id, match.region || region, match.filename);
        handleSelect(match.filename);
        return;
      }

      // 2. STAGE 1: Stats Only (Fastest) -> Get user into dashboard ASAP
      // call_ai: false
      const postRes = await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region,
        call_ai: false, // Key change: Disabled for first pass
        puuid: puuid
      });

      // 3. Load Stage 1 Result
      // ... (existing logic to find/load file) ...
      // Re-fetch files list
      const res2 = await axios.get(`${config.API_URL}/api/analyses/?_t=${Date.now()}`);
      const files2 = res2.data;
      const match2 = files2.find(f =>
        f.riot_id.toLowerCase().replace(/#/g, '').replace(/\s/g, '') === targetId
      );

      let filenameToLoad = null;

      if (match2) {
        filenameToLoad = match2.filename;
        saveToHistory(match2.riot_id, match2.region || region, match2.filename);
      } else {
        // Fallback: Manually construct filename
        console.warn("Analysis file not found in list, attempting manual fallback...");
        filenameToLoad = `league_analysis_${riotId.replace('#', '_')}.json`;
        saveToHistory(riotId, region, filenameToLoad);
      }

      if (filenameToLoad) {
        // Load the dashboard with stats immediately
        await handleSelect(filenameToLoad);
        setLoading(false); // Validating success -> Unblock UI

        // 4. STAGE 2: AI Coach (Background)
        console.log("Triggering Background AI Analysis...");
        try {
          await axios.post(`${config.API_URL}/api/analyze/`, {
            riot_id: riotId,
            match_count: matchCount,
            region: region,
            call_ai: true,
            force_refresh: false, // Use existing stats
            puuid: puuid
          });

          console.log("AI Analysis Complete. Refreshing data...");
          // Reload the analysis file silently
          const refreshRes = await axios.get(`${config.API_URL}/api/analyses/${encodeURIComponent(filenameToLoad)}/?_t=${Date.now()}`);
          setAnalysisData(refreshRes.data);

        } catch (aiErr) {
          console.error("Background AI failed:", aiErr);
        }
      } else {
        throw new Error("Could not resolve filename for analysis.");
      }

    } catch (err) {
      console.error("Navigation error:", err);
      setLoading(false);

      // Detailed error alert check
      if (err.response && err.response.data && err.response.data.error) {
        alert(`Analysis Failed: ${err.response.data.error}`);
      } else {
        alert("Failed to load player analysis. Please try again or check console.");
      }
    }
  };

  const handleBack = () => {
    setSelectedFile(null);
    setAnalysisData(null);
    localStorage.removeItem('lastAnalysisFile');
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
