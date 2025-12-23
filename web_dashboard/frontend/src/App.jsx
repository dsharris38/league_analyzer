import { useState, useEffect } from 'react';
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
    const savedFile = localStorage.getItem('lastAnalysisFile');
    if (savedFile) {
      handleSelect(savedFile);
    }
  }, []);

  // Load existing analysis from cache/file
  const handleSelect = (filename) => {
    setSelectedFile(filename);
    localStorage.setItem('lastAnalysisFile', filename); // Persist
    setLoading(true);
    axios.get(`${config.API_URL}/api/analyses/${filename}/`)
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
          alert('Failed to load analysis');
          setSelectedFile(null);
        }
      });
  };

  // Run new analysis / Navigate to player (Optimized: Check First)
  const handleAnalyze = async (riotId, matchCount, region) => {
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
        call_ai: false // Key change: Disabled for first pass
      });

      // 3. Load Stage 1 Result
      // Re-fetch files list
      const res2 = await axios.get(`${config.API_URL}/api/analyses/?_t=${Date.now()}`);
      const files2 = res2.data;
      const match2 = files2.find(f =>
        f.riot_id.toLowerCase().replace(/#/g, '').replace(/\s/g, '') === targetId
      );

      if (match2) {
        // Load the dashboard with stats immediately
        saveToHistory(match2.riot_id, match2.region || region, match2.filename);
        await handleSelect(match2.filename);
        setLoading(false); // Validating success -> Unblock UI

        // 4. STAGE 2: AI Coach (Background)
        // Verify if we need AI (if cached file was old? no, we know it's new)
        // Just always call Stage 2 to hydrate AI. Smart Resume in backend handles data reuse.
        console.log("Triggering Background AI Analysis...");
        try {
          // Note: Backend 'Smart Resume' will see existing stats and skip fetching matches
          await axios.post(`${config.API_URL}/api/analyze/`, {
            riot_id: riotId,
            match_count: matchCount,
            region: region,
            call_ai: true,
            force_refresh: false // Use existing stats
          });

          console.log("AI Analysis Complete. Refreshing data...");
          // Reload the analysis file silently to get the new 'agent_payload.coaching_report'
          const refreshRes = await axios.get(`${config.API_URL}/api/analyses/${match2.filename}/?_t=${Date.now()}`);
          setAnalysisData(refreshRes.data);

        } catch (aiErr) {
          console.error("Background AI failed:", aiErr);
          // Optional: Show toast error? For now silent failure is okay, user sees stats.
        }

      } else {
        setLoading(false);
        const postDebug = postRes.data.debug || {};

        // Standard error with debug info for verification
        alert(`Analysis completed but file not found.\nDebug: DB=${postDebug.db_connected}, Verified=${postDebug.save_verified}, Count=${postDebug.db_doc_count}, SavedID=${postDebug.saved_id}`);
      }
    } catch (err) {
      console.error("Navigation error:", err);
      setLoading(false);
      alert("Failed to load player analysis.");
    }
  };

  const handleBack = () => {
    setSelectedFile(null);
    setAnalysisData(null);
    localStorage.removeItem('lastAnalysisFile');
  };

  // Silent refresh for updates
  const refreshData = (filename) => {
    axios.get(`${config.API_URL}/api/analyses/${filename}/`)
      .then(res => {
        setAnalysisData(res.data);
      })
      .catch(err => {
        console.error("Silent refresh failed:", err);
      });
  };

  const handleUpdate = async () => {
    // Re-run analysis for the current user
    if (!analysisData) return;
    const riotId = `${analysisData.game_name}#${analysisData.tag_line}`;
    const matchCount = analysisData.match_count_requested || 20;
    const region = analysisData.region || 'NA';

    // Do NOT set full screen loading. We want the dashboard to stay visible.
    // The DashboardView can show its own local loading state if needed.
    try {
      // STAGE 1: Update Matches instantly (No AI)
      await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region,
        force_refresh: true,
        call_ai: false
      });
      refreshData(selectedFile); // Show new matches immediately

      // STAGE 2: Run AI in background
      await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region,
        force_refresh: false, // Don't re-fetch matches, just run AI
        call_ai: true
      });
      refreshData(selectedFile); // Show new AI report
    } catch (err) {
      console.error(err);
      alert('Update failed');
    }
  };

  const handlePlayerClick = (riotId) => {
    // Navigate to player analysis
    const region = analysisData?.region || 'NA';
    handleAnalyze(riotId, 20, region);
  };


  if (loading) return (
    <div className="min-h-screen bg-[#0b0c2a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-violet-500"></div>
        <p className="text-violet-400 font-medium animate-pulse">Running Analysis...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0c2a] text-slate-100 font-sans">
      <BackendStatus />
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
    </div>
  );
}

export default App;
