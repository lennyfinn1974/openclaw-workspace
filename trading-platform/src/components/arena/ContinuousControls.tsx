// Continuous Arena Controls - Real-time market-driven tournament management
import React, { useState, useEffect } from 'react';
import { Play, Pause, Settings, Zap, TrendingUp, Clock, Target, Gauge } from 'lucide-react';

interface ContinuousConfig {
  minRoundDurationMs: number;
  maxRoundDurationMs: number;
  evolutionTriggerThreshold: number;
  evolutionCooldownMs: number;
  profitThresholdPercent: number;
  maxDrawdownThreshold: number;
}

interface ContinuousStatus {
  isRunning: boolean;
  config: ContinuousConfig;
  groups: {
    name: string;
    isActive: boolean;
    canTrade: boolean;
    sessionName: string;
    volatilityMultiplier: number;
    currentTournament?: string;
    nextEvolution: number;
    performanceSnapshots: number;
    lastBestProfit: number;
    lastAvgProfit: number;
  }[];
  nextUpdateIn: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8101';

export function ContinuousControls() {
  const [status, setStatus] = useState<ContinuousStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [configValues, setConfigValues] = useState<ContinuousConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/continuous-arena/status`);
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch continuous arena status');
      console.error('Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Control actions
  const startContinuous = async () => {
    try {
      const response = await fetch(`${API_URL}/api/continuous-arena/start`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        fetchStatus();
      } else {
        setError(result.error || 'Failed to start continuous arena');
      }
    } catch (err) {
      setError('Failed to start continuous arena');
    }
  };

  const stopContinuous = async () => {
    try {
      const response = await fetch(`${API_URL}/api/continuous-arena/stop`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        fetchStatus();
      } else {
        setError(result.error || 'Failed to stop continuous arena');
      }
    } catch (err) {
      setError('Failed to stop continuous arena');
    }
  };

  const triggerEvolution = async (groupName?: string) => {
    try {
      const response = await fetch(`${API_URL}/api/continuous-arena/evolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupName ? { groupName } : {}),
      });
      const result = await response.json();
      if (result.success) {
        // Status will update automatically
      } else {
        setError(result.error || 'Failed to trigger evolution');
      }
    } catch (err) {
      setError('Failed to trigger evolution');
    }
  };

  // Configuration management
  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/api/continuous-arena/config`);
      const config = await response.json();
      setConfigValues(config);
    } catch (err) {
      setError('Failed to fetch configuration');
    }
  };

  const updateConfig = async () => {
    if (!configValues) return;

    try {
      const response = await fetch(`${API_URL}/api/continuous-arena/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configValues),
      });
      const result = await response.json();
      if (result.success) {
        setShowConfig(false);
        fetchStatus();
      } else {
        setError(result.error || 'Failed to update configuration');
      }
    } catch (err) {
      setError('Failed to update configuration');
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getStatusColor = (isActive: boolean, canTrade: boolean): string => {
    if (isActive && canTrade) return 'text-green-400';
    if (canTrade) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusIcon = (isActive: boolean, canTrade: boolean) => {
    if (isActive && canTrade) return <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />;
    if (canTrade) return <div className="w-2 h-2 bg-yellow-400 rounded-full" />;
    return <div className="w-2 h-2 bg-red-400 rounded-full" />;
  };

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-bold text-white">Continuous Arena</span>
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
            status.isRunning 
              ? 'bg-green-600/20 text-green-400' 
              : 'bg-gray-600/20 text-gray-400'
          }`}>
            {status.isRunning ? 'ACTIVE' : 'STOPPED'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowConfig(true); fetchConfig(); }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-300 transition-colors rounded hover:bg-gray-700/50"
          >
            <Settings className="w-3 h-3" />
            Config
          </button>
          
          {status.isRunning ? (
            <button
              onClick={stopContinuous}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
            >
              <Pause className="w-3 h-3" />
              Stop
            </button>
          ) : (
            <button
              onClick={startContinuous}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
            >
              <Play className="w-3 h-3" />
              Start
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-600/20 border-b border-red-600/30">
          <p className="text-red-400 text-xs">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-200 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Group Status Grid */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {status.groups.map((group) => (
            <div
              key={group.name}
              className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{group.name}</span>
                  {getStatusIcon(group.isActive, group.canTrade)}
                </div>
                
                <button
                  onClick={() => triggerEvolution(group.name)}
                  disabled={!status.isRunning || !group.canTrade}
                  className="p-1 text-purple-400 hover:text-purple-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                  title="Manual Evolution"
                >
                  <Zap className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Session:</span>
                  <span className={getStatusColor(group.isActive, group.canTrade)}>
                    {group.sessionName}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Volatility:</span>
                  <span className="text-white">{group.volatilityMultiplier.toFixed(1)}x</span>
                </div>
                
                {group.currentTournament && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tournament:</span>
                    <span className="text-cyan-400">Active</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-400">Best Profit:</span>
                  <span className={group.lastBestProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatPercent(group.lastBestProfit)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Profit:</span>
                  <span className={group.lastAvgProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatPercent(group.lastAvgProfit)}
                  </span>
                </div>

                {group.nextEvolution > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Next Evolution:</span>
                    <span className="text-yellow-400">{group.nextEvolution}m</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-400">Snapshots:</span>
                  <span className="text-gray-300">{group.performanceSnapshots}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Global Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800">
          <div className="text-xs text-gray-400">
            Next update in {status.nextUpdateIn}s
          </div>
          
          <button
            onClick={() => triggerEvolution()}
            disabled={!status.isRunning}
            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors rounded hover:bg-purple-500/10"
          >
            <Zap className="w-3 h-3" />
            Evolve All Groups
          </button>
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfig && configValues && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Min Round Duration (minutes)
                </label>
                <input
                  type="number"
                  value={Math.floor(configValues.minRoundDurationMs / 60000)}
                  onChange={(e) => setConfigValues({
                    ...configValues,
                    minRoundDurationMs: parseInt(e.target.value) * 60000
                  })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Max Round Duration (minutes)
                </label>
                <input
                  type="number"
                  value={Math.floor(configValues.maxRoundDurationMs / 60000)}
                  onChange={(e) => setConfigValues({
                    ...configValues,
                    maxRoundDurationMs: parseInt(e.target.value) * 60000
                  })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Evolution Trigger Threshold (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={configValues.evolutionTriggerThreshold}
                  onChange={(e) => setConfigValues({
                    ...configValues,
                    evolutionTriggerThreshold: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Profit Threshold (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={configValues.profitThresholdPercent}
                  onChange={(e) => setConfigValues({
                    ...configValues,
                    profitThresholdPercent: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Max Drawdown Threshold (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={configValues.maxDrawdownThreshold}
                  onChange={(e) => setConfigValues({
                    ...configValues,
                    maxDrawdownThreshold: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                onClick={updateConfig}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-medium transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}