import { useState } from 'react';
import axios from 'axios';
// import AnalysisList from './components/AnalysisList'; // Deprecated
import Home from './components/Home';
import DashboardView from './components/DashboardView';
import config from './config';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load existing analysis from cache/file
  const handleSelect = (filename) => {
    setSelectedFile(filename);
    setLoading(true);
    axios.get(`${config.API_URL}/api/analyses/${filename}/`)
      .then(res => {
        setAnalysisData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
        alert('Failed to load analysis');
        setSelectedFile(null);
      });
  };

  // Run new analysis
  const handleAnalyze = async (riotId, matchCount) => {
    // This is passed to Home to run the POST request
    // After POST succeeds, we reload the list or just try to load the file?
    // The backend POST returns { status: 'success', riot_id: ... }
    // It saves the file as league_analysis_{riot_id}.json (likely).
    // We can then try to load it immediately.

    // First, trigger the analysis
    await axios.post(`${config.API_URL}/api/analyze/`, {
      riot_id: riotId,
      match_count: matchCount
    });

    // Construct probable filename
    // Note: The backend sanitizes filenames. We might need a delay or a lookup.
    // For simplicity, we can fetch the list and find the newest one, OR just rely on the user to click it in "Recent".
    // Better UX: Auto-load the result. 
    // Let's assume the standard naming convention: league_analysis_{riot_id_sanitized}.json

    // Actually, asking the backend for the "latest" for this user would be best but we don't have that endpoint.
    // Let's just find it in the list of reliable recent files.
    const res = await axios.get(`${config.API_URL}/api/analyses/`);
    const files = res.data;
    // Find file matching riotId (approx)
    // The list endpoint returns { riot_id: ... }
    const match = files.find(f => f.riot_id.toLowerCase() === riotId.toLowerCase()) || files[0];
    if (match) {
      handleSelect(match.filename);
    }
  };

  const handleBack = () => {
    setSelectedFile(null);
    setAnalysisData(null);
  };

  const handleUpdate = async () => {
    // Re-run analysis for the current user
    if (!analysisData) return;
    const riotId = `${analysisData.game_name}#${analysisData.tag_line}`;
    const matchCount = analysisData.match_count_requested || 20;

    setLoading(true);
    try {
      await axios.post(`${config.API_URL}/api/analyze/`, {
        riot_id: riotId,
        match_count: matchCount
      });
      // Refresh data
      // We need to re-fetch the specific file. 
      // Since the filename usually stays the same if riot_id is same, just re-call handleSelect
      handleSelect(selectedFile);
    } catch (err) {
      console.error(err);
      alert('Update failed');
      setLoading(false);
    }
  };


  if (loading) return (
    <div className="min-h-screen bg-[#0b0c2a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-violet-500"></div>
        <p className="text-violet-400 font-medium animate-pulse">Running Analysis...</p>
      </div>
    </div>
  );
}

return (
  <div className="min-h-screen bg-[#0b0c2a] text-slate-100 font-sans">
    {!analysisData ? (
      <Home onSelect={handleSelect} onAnalyze={handleAnalyze} />
    ) : (
      <DashboardView
        data={analysisData}
        filename={selectedFile}
        onBack={handleBack}
        onUpdate={handleUpdate}
      />
    )}
  </div>
);
}

export default App;
