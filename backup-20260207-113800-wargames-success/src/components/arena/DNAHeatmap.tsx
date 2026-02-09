'use client';

import type { Bot, EntrySignalWeights } from '@/types/arena';

const SIGNAL_LABELS: Record<keyof EntrySignalWeights, string> = {
  rsiOversold: 'RSI OS', rsiOverbought: 'RSI OB', macdCrossover: 'MACD X',
  macdDivergence: 'MACD D', maCrossover: 'MA X', ictOrderBlockBounce: 'OB',
  ictFvgFill: 'FVG', breakOfStructure: 'BOS', changeOfCharacter: 'CHoCH',
  liquiditySweep: 'Liq', volumeSpike: 'Vol', meanReversion: 'MR', momentumBreakout: 'Mom',
};

function valueToColor(value: number): string {
  // 0 = dark blue, 0.5 = purple, 1 = bright magenta
  const r = Math.round(value * 200 + 30);
  const g = Math.round(30);
  const b = Math.round((1 - value) * 100 + 100);
  return `rgb(${r}, ${g}, ${b})`;
}

interface DNAHeatmapProps {
  bots: Bot[];
}

export function DNAHeatmap({ bots }: DNAHeatmapProps) {
  const genes = Object.keys(SIGNAL_LABELS) as (keyof EntrySignalWeights)[];

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4 overflow-x-auto">
      <div className="text-sm font-bold text-white mb-3">DNA Heatmap</div>
      <div className="min-w-[600px]">
        {/* Header row */}
        <div className="flex gap-0.5 mb-1">
          <div className="w-24 shrink-0" />
          {genes.map(gene => (
            <div key={gene} className="flex-1 text-center">
              <span className="text-[8px] text-gray-500 writing-vertical">{SIGNAL_LABELS[gene]}</span>
            </div>
          ))}
        </div>

        {/* Bot rows */}
        {bots.map(bot => (
          <div key={bot.id} className="flex gap-0.5 mb-0.5">
            <div className="w-24 shrink-0 text-[10px] text-gray-400 truncate flex items-center">{bot.name}</div>
            {genes.map(gene => {
              const value = bot.dna.entrySignals[gene];
              return (
                <div
                  key={gene}
                  className="flex-1 h-6 rounded-sm flex items-center justify-center"
                  style={{ backgroundColor: valueToColor(value) }}
                  title={`${bot.name} - ${SIGNAL_LABELS[gene]}: ${(value * 100).toFixed(0)}%`}
                >
                  <span className="text-[8px] text-white/70">{(value * 100).toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
