'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Bot, EntrySignalWeights } from '@/types/arena';

const SIGNAL_LABELS: Record<keyof EntrySignalWeights, string> = {
  rsiOversold: 'RSI OS', rsiOverbought: 'RSI OB', macdCrossover: 'MACD X',
  macdDivergence: 'MACD Div', maCrossover: 'MA X', ictOrderBlockBounce: 'OB',
  ictFvgFill: 'FVG', breakOfStructure: 'BOS', changeOfCharacter: 'CHoCH',
  liquiditySweep: 'Liq', volumeSpike: 'Vol', meanReversion: 'MR', momentumBreakout: 'Mom',
};

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b'];

interface DNAComparisonViewProps {
  bots: Bot[];
}

export function DNAComparisonView({ bots }: DNAComparisonViewProps) {
  if (bots.length === 0) return null;

  const keys = Object.keys(bots[0].dna.entrySignals) as (keyof EntrySignalWeights)[];

  const data = keys.map(key => {
    const point: Record<string, unknown> = { signal: SIGNAL_LABELS[key] };
    bots.forEach((bot, i) => {
      point[bot.name] = Number((bot.dna.entrySignals[key] * 100).toFixed(0));
    });
    return point;
  });

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
      <div className="text-sm font-bold text-white mb-3">DNA Comparison</div>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid stroke="#333" />
          <PolarAngleAxis dataKey="signal" tick={{ fill: '#888', fontSize: 9 }} />
          <PolarRadiusAxis tick={false} domain={[0, 100]} />
          {bots.map((bot, i) => (
            <Radar
              key={bot.id}
              name={bot.name}
              dataKey={bot.name}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, color: '#aaa' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
