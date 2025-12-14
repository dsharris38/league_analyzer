import { useState, useEffect } from 'react';
import config from '../config';

const BackendStatus = () => {
    const [status, setStatus] = useState('checking'); // 'online', 'offline', 'checking'

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch(`${config.API_URL}/api/health/`);
                if (res.ok) {
                    setStatus('online');
                } else {
                    setStatus('offline');
                }
            } catch (e) {
                setStatus('offline');
            }
        };

        // Initial check
        checkHealth();

        // Poll every 30 seconds
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    if (status === 'online') return null; // Invisible when online

    return (
        <div className="fixed bottom-4 right-4 z-50 bg-red-900/90 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm animate-pulse">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-sm font-medium">Backend Offline (Fallback Mode)</span>
        </div>
    );
};

export default BackendStatus;
