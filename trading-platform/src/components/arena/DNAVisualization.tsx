'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { StrategyDNA, EntrySignalWeights } from '@/types/arena';

interface DNAVisualizationProps {
  dna: StrategyDNA;
  label?: string;
  color?: string;
  compact?: boolean;
}

const SIGNAL_LABELS: Record<keyof EntrySignalWeights, string> = {
  rsiOversold: 'RSI OS',
  rsiOverbought: 'RSI OB',
  macdCrossover: 'MACD X',
  macdDivergence: 'MACD Div',
  maCrossover: 'MA X',
  ictOrderBlockBounce: 'OB',
  ictFvgFill: 'FVG',
  breakOfStructure: 'BOS',
  changeOfCharacter: 'CHoCH',
  liquiditySweep: 'Liq',
  volumeSpike: 'Vol',
  meanReversion: 'MR',
  momentumBreakout: 'Mom',
};

export function DNAVisualization({ dna, label, color = '#8b5cf6', compact = false }: DNAVisualizationProps) {
  const data = Object.entries(dna.entrySignals).map(([key, value]) => ({
    signal: SIGNAL_LABELS[key as keyof EntrySignalWeights] || key,
    value: Number((value * 100).toFixed(0)),
    fullMark: 100,
  }));

  return (
    <div className={compact ? '' : 'bg-[#0f0f0f] rounded-xl border border-gray-800 p-3'}>
      {!compact && label && (
        <div className="text-xs font-bold text-white mb-2">{label}</div>
      )}
      <ResponsiveContainer width="100%" height={compact ? 180 : 250}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius={compact ? 60 : 80}>
          <PolarGrid stroke="#333" />
          <PolarAngleAxis dataKey="signal" tick={{ fill: '#888', fontSize: 9 }} />
          <PolarRadiusAxis tick={false} domain={[0, 100]} />
          <Radar
            name={label || 'DNA'}
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#fff' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
