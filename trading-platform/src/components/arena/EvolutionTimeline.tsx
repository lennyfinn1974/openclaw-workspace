'use client';

import { useArenaStore } from '@/stores/arenaStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import { GitBranch, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface GenerationData {
  generation: number;
  avgFitness: number;
  bestFitness: number;
  worstFitness: number;
  alphaAvg: number;
  betaAvg: number;
  gammaAvg: number;
}

export function EvolutionTimeline() {
  const { evolutionHistory, leaderboard, status } = useArenaStore();
  const [viewMode, setViewMode] = useState<'fitness' | 'groups'>('fitness');

  // Build generation data from evolution history
  const generationData: GenerationData[] = [];

  if (evolutionHistory.length > 0) {
    // Group evolution results by generation
    const byGen = new Map<number, typeof evolutionHistory>();
    for (const result of evolutionHistory) {
      const gen = result.generation;
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen)!.push(result);
    }

    for (const [gen, results] of byGen) {
      const fitnesses = results.map(r => r.avgFitnessAfter);
      generationData.push({
        generation: gen,
        avgFitness: fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length,
        bestFitness: Math.max(...fitnesses),
        worstFitness: Math.min(...fitnesses),
        alphaAvg: results.find(r => r.groupName === 'Alpha')?.avgFitnessAfter ?? 0,
        betaAvg: results.find(r => r.groupName === 'Beta')?.avgFitnessAfter ?? 0,
        gammaAvg: results.find(r => r.groupName === 'Gamma')?.avgFitnessAfter ?? 0,
      });
    }
  }

  // Add current generation from live leaderboard data
  if (leaderboard.length > 0) {
    const currentGen = status?.generation ?? (generationData.length > 0 ? generationData[generationData.length - 1].generation + 1 : 1);
    const fitnesses = leaderboard.map(e => e.fitness);
    const alphaEntries = leaderboard.filter(e => e.groupName === 'Alpha');
    const betaEntries = leaderboard.filter(e => e.groupName === 'Beta');
    const gammaEntries = leaderboard.filter(e => e.groupName === 'Gamma');

    generationData.push({
      generation: currentGen,
      avgFitness: fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length,
      bestFitness: Math.max(...fitnesses),
      worstFitness: Math.min(...fitnesses),
      alphaAvg: alphaEntries.length > 0 ? alphaEntries.reduce((s, e) => s + e.fitness, 0) / alphaEntries.length : 0,
      betaAvg: betaEntries.length > 0 ? betaEntries.reduce((s, e) => s + e.fitness, 0) / betaEntries.length : 0,
      gammaAvg: gammaEntries.length > 0 ? gammaEntries.reduce((s, e) => s + e.fitness, 0) / gammaEntries.length : 0,
    });
  }

  const formatFitness = (v: number) => `${(v * 100).toFixed(0)}`;

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-bold text-white">Evolution Timeline</span>
        </div>
        <div className="flex gap-1">
          {(['fitness', 'groups'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-1 text-[10px] rounded ${
                viewMode === mode ? 'bg-purple-600/30 text-purple-300' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {mode === 'fitness' ? 'Fitness Range' : 'By Group'}
            </button>
          ))}
        </div>
      </div>

      {generationData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
          <span className="text-xs">Run tournaments and evolve to see fitness trends</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          {viewMode === 'fitness' ? (
            <AreaChart data={generationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis
                dataKey="generation"
                tick={{ fill: '#666', fontSize: 10 }}
                label={{ value: 'Generation', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
              />
              <YAxis
                tickFormatter={formatFitness}
                tick={{ fill: '#666', fontSize: 10 }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number, name: string) => [`${(value * 100).toFixed(1)}`, name]}
              />
              <Area
                type="monotone"
                dataKey="worstFitness"
                stackId="range"
                stroke="transparent"
                fill="#4c1d95"
                fillOpacity={0.2}
                name="Worst"
              />
              <Area
                type="monotone"
                dataKey="avgFitness"
                stackId="avg"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
                strokeWidth={2}
                name="Average"
                dot={{ fill: '#8b5cf6', r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="bestFitness"
                stroke="#a78bfa"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                name="Best"
                dot={{ fill: '#a78bfa', r: 2 }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
            </AreaChart>
          ) : (
            <LineChart data={generationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis
                dataKey="generation"
                tick={{ fill: '#666', fontSize: 10 }}
                label={{ value: 'Generation', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
              />
              <YAxis
                tickFormatter={formatFitness}
                tick={{ fill: '#666', fontSize: 10 }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number, name: string) => [`${(value * 100).toFixed(1)}`, name]}
              />
              <Line type="monotone" dataKey="alphaAvg" stroke="#3b82f6" strokeWidth={2} name="Alpha (FX)" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="betaAvg" stroke="#22c55e" strokeWidth={2} name="Beta (Stocks)" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="gammaAvg" stroke="#f59e0b" strokeWidth={2} name="Gamma (Comm)" dot={{ r: 3 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
