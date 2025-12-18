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

      if (match) {
        console.log("Found existing analysis, loading:", match.filename);
        handleSelect(match.filename);
        return;
      }

      // 2. If not found, trigger new analysis
      await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region
      });

      // 3. Fetch list again to find the new file
      const res2 = await axios.get(`${config.API_URL}/api/analyses/?_t=${Date.now()}`);
      const files2 = res2.data;
      // Fallback to latest but try to match first
      const match2 = files2.find(f =>
        f.riot_id.toLowerCase().replace(/#/g, '').replace(/\s/g, '') === targetId
      ) || (files2.length > 0 ? files2[0] : null);

      if (match2) {
        handleSelect(match2.filename);
      } else {
        setLoading(false);
        alert("Analysis completed but file not found.");
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
      await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount,
        region: region,
        force_refresh: true
      });
      // Refresh data silently
      refreshData(selectedFile);
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
