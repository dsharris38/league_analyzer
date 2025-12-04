import { useState } from 'react';
import axios from 'axios';
import AnalysisList from './components/AnalysisList';
import DashboardView from './components/DashboardView';
import config from './config';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const handleBack = () => {
    setSelectedFile(null);
    setAnalysisData(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {!analysisData ? (
        <AnalysisList onSelect={handleSelect} />
      ) : (
        <DashboardView data={analysisData} filename={selectedFile} onBack={handleBack} />
      )}
    </div>
  );
}

export default App;
