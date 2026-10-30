import React, { useEffect, useState } from 'react';
import { Activity, Server, ShieldCheck, Database } from 'lucide-react';
import { apiClient } from './services/api';

interface HealthData {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: string;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch backend system health status on mount
    const checkBackend = async () => {
      try {
        const response = await apiClient.get<HealthData>('/health');
        setHealth(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to backend API');
      } finally {
        setLoading(false);
      }
    };

    checkBackend();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-blue-500" />
          <span className="font-bold text-lg tracking-tight">DevPulse</span>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
            v1.0.0-scaffold
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Environment Scaffold</h1>
          <p className="text-slate-400 text-sm mt-1">
            Core foundations initialized for layered Node.js / Express backend and React frontend.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Server className="h-4 w-4 text-blue-400" />
              <span className="text-xs uppercase font-medium tracking-wider">Backend API</span>
            </div>
            <div className="text-xl font-semibold">
              {loading ? (
                <span className="text-slate-500 text-base font-normal">Checking status...</span>
              ) : error ? (
                <span className="text-red-400 text-base font-normal">Disconnected</span>
              ) : (
                <span className="text-emerald-400">Operational</span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {health ? `Uptime: ${health.uptimeSeconds}s` : 'Waiting for backend server on port 5000'}
            </p>
          </div>

          <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Database className="h-4 w-4 text-emerald-400" />
              <span className="text-xs uppercase font-medium tracking-wider">MongoDB</span>
            </div>
            <div className="text-xl font-semibold">
              {health?.database.status === 'connected' ? (
                <span className="text-emerald-400">Connected</span>
              ) : (
                <span className="text-amber-400">Standby</span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Local docker MongoDB container (port 27017)
            </p>
          </div>

          <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-3">
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              <span className="text-xs uppercase font-medium tracking-wider">Heap Memory</span>
            </div>
            <div className="text-xl font-semibold">
              {health ? `${health.memory.heapUsedMB} MB` : '--'}
            </div>
            <p className="text-xs text-slate-400">
              Allocated process memory footprint
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

