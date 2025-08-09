'use client';

import { useState, useEffect } from 'react';
import { getHealth } from '@/lib/api';
import type { HealthData } from '@/lib/types';
import LoadingSpinner from './LoadingSpinner';
import toast from 'react-hot-toast';

export default function Health() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getHealth();
        setHealthData(data);
      } catch (err) {
        console.error('Error fetching health data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch health data');
        toast.error('Failed to fetch health data');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  const refreshHealth = () => {
    setLoading(true);
    setError(null);
    getHealth()
      .then(data => {
        setHealthData(data);
        toast.success('Health data refreshed');
      })
      .catch(err => {
        console.error('Error refreshing health data:', err);
        setError(err instanceof Error ? err.message : 'Failed to refresh health data');
        toast.error('Failed to refresh health data');
      })
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Health Check</h2>
          <button
            onClick={refreshHealth}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Retry
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 font-medium">Error:</p>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Health Check</h2>
        <button
          onClick={refreshHealth}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>
      
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(healthData, null, 2)}
        </pre>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
} 