import { useState, useEffect } from 'react';
import axios from 'axios';

interface VersionInfo {
  version: string;
  lastUpdated: string;
  latestReleaseNotes?: {
    id: number;
    version: string;
    notes: string;
    release_date: string;
    created_at: string;
  } | null;
}

export const useVersion = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await axios.get('/api/version');
        setVersionInfo(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch version:', err);
        setError('Failed to load version');
        // Fallback to a default version
        setVersionInfo({
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  return { versionInfo, loading, error };
};
