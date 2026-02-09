// DNA Factory - Random generation, validation, and clamping for Strategy DNA
import type { StrategyDNA, EntrySignalWeights, IndicatorParams, PositionSizingParams, ExitStrategyParams, RegimeFilterParams, TimingParams } from './types';

// Gene range definitions: [min, max]
type GeneRange = [number, number];

const ENTRY_SIGNAL_RANGES: Record<keyof EntrySignalWeights, GeneRange> = {
  rsiOversold: [0, 1],
  rsiOverbought: [0, 1],
  macdCrossover: [0, 1],
  macdDivergence: [0, 1],
  maCrossover: [0, 1],
  ictOrderBlockBounce: [0, 1],
  ictFvgFill: [0, 1],
  breakOfStructure: [0, 1],
  changeOfCharacter: [0, 1],
  liquiditySweep: [0, 1],
  volumeSpike: [0, 1],
  meanReversion: [0, 1],
  momentumBreakout: [0, 1],
};

const INDICATOR_RANGES: Record<keyof IndicatorParams, GeneRange> = {
  rsiPeriod: [5, 30],
  rsiOversoldThreshold: [15, 40],
  rsiOverboughtThreshold: [60, 85],
  macdFast: [5, 20],
  macdSlow: [15, 40],
  macdSignal: [5, 15],
  maFastPeriod: [5, 30],
  maSlowPeriod: [20, 100],
  maType: [0, 1],
  obLookback: [20, 80],
  fvgLookback: [20, 80],
  volumeSpikeMultiplier: [1.2, 3.0],
  bollingerPeriod: [10, 30],
  bollingerStdDev: [1.0, 3.0],
};

const POSITION_SIZING_RANGES: Record<keyof PositionSizingParams, GeneRange> = {
  riskPerTrade: [0.005, 0.05],
  maxPositionPercent: [0.1, 0.5],
  maxOpenPositions: [1, 5],
  kellyFraction: [0.1, 0.5],
  pyramidEnabled: [0, 1],
  pyramidMaxAdds: [1, 3],
};

const EXIT_STRATEGY_RANGES: Record<keyof ExitStrategyParams, GeneRange> = {
  stopLossAtr: [0.5, 3.0],
  takeProfitAtr: [1.0, 5.0],
  trailingStopEnabled: [0, 1],
  trailingStopAtr: [0.5, 2.0],
  timeStopBars: [5, 50],
  partialExitEnabled: [0, 1],
  partialExitPercent: [0.25, 0.75],
  partialExitAtr: [0.5, 3.0],
};

const REGIME_FILTER_RANGES: Record<keyof RegimeFilterParams, GeneRange> = {
  trendFollowBias: [-1, 1],
  volatilityPreference: [0, 1],
  sessionPreference: [0, 1],
  correlationAwareness: [0, 1],
};

const TIMING_RANGES: Record<keyof TimingParams, GeneRange> = {
  preferredTimeframe: [0, 3],
  decisionIntervalMs: [5000, 60000],
  entryPatience: [0, 1],
};

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomGenes(ranges: Record<string, GeneRange>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, [min, max]] of Object.entries(ranges)) {
    result[key] = Number(randomInRange(min, max).toFixed(4));
  }
  return result;
}

function clampGenes(genes: Record<string, number>, ranges: Record<string, GeneRange>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, [min, max]] of Object.entries(ranges)) {
    result[key] = Number(clampValue(genes[key] ?? min, min, max).toFixed(4));
  }
  return result;
}

export function randomDNA(): StrategyDNA {
  return {
    entrySignals: randomGenes(ENTRY_SIGNAL_RANGES) as unknown as EntrySignalWeights,
    indicatorParams: randomGenes(INDICATOR_RANGES) as unknown as IndicatorParams,
    positionSizing: randomGenes(POSITION_SIZING_RANGES) as unknown as PositionSizingParams,
    exitStrategy: randomGenes(EXIT_STRATEGY_RANGES) as unknown as ExitStrategyParams,
    regimeFilter: randomGenes(REGIME_FILTER_RANGES) as unknown as RegimeFilterParams,
    timing: randomGenes(TIMING_RANGES) as unknown as TimingParams,
  };
}

export function clampDNA(dna: StrategyDNA): StrategyDNA {
  return {
    entrySignals: clampGenes(dna.entrySignals as unknown as Record<string, number>, ENTRY_SIGNAL_RANGES) as unknown as EntrySignalWeights,
    indicatorParams: clampGenes(dna.indicatorParams as unknown as Record<string, number>, INDICATOR_RANGES) as unknown as IndicatorParams,
    positionSizing: clampGenes(dna.positionSizing as unknown as Record<string, number>, POSITION_SIZING_RANGES) as unknown as PositionSizingParams,
    exitStrategy: clampGenes(dna.exitStrategy as unknown as Record<string, number>, EXIT_STRATEGY_RANGES) as unknown as ExitStrategyParams,
    regimeFilter: clampGenes(dna.regimeFilter as unknown as Record<string, number>, REGIME_FILTER_RANGES) as unknown as RegimeFilterParams,
    timing: clampGenes(dna.timing as unknown as Record<string, number>, TIMING_RANGES) as unknown as TimingParams,
  };
}

export function validateDNA(dna: StrategyDNA): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all gene categories exist
  if (!dna.entrySignals) errors.push('Missing entrySignals');
  if (!dna.indicatorParams) errors.push('Missing indicatorParams');
  if (!dna.positionSizing) errors.push('Missing positionSizing');
  if (!dna.exitStrategy) errors.push('Missing exitStrategy');
  if (!dna.regimeFilter) errors.push('Missing regimeFilter');
  if (!dna.timing) errors.push('Missing timing');

  if (errors.length > 0) return { valid: false, errors };

  // Validate ranges
  const checkRange = (category: string, genes: Record<string, number>, ranges: Record<string, GeneRange>) => {
    for (const [key, [min, max]] of Object.entries(ranges)) {
      const val = genes[key];
      if (val === undefined || val === null) {
        errors.push(`${category}.${key} is missing`);
      } else if (typeof val !== 'number' || isNaN(val)) {
        errors.push(`${category}.${key} is not a valid number`);
      } else if (val < min - 0.001 || val > max + 0.001) {
        errors.push(`${category}.${key} = ${val} out of range [${min}, ${max}]`);
      }
    }
  };

  checkRange('entrySignals', dna.entrySignals as unknown as Record<string, number>, ENTRY_SIGNAL_RANGES);
  checkRange('indicatorParams', dna.indicatorParams as unknown as Record<string, number>, INDICATOR_RANGES);
  checkRange('positionSizing', dna.positionSizing as unknown as Record<string, number>, POSITION_SIZING_RANGES);
  checkRange('exitStrategy', dna.exitStrategy as unknown as Record<string, number>, EXIT_STRATEGY_RANGES);
  checkRange('regimeFilter', dna.regimeFilter as unknown as Record<string, number>, REGIME_FILTER_RANGES);
  checkRange('timing', dna.timing as unknown as Record<string, number>, TIMING_RANGES);

  // Cross-gene constraints
  if (dna.indicatorParams.macdFast >= dna.indicatorParams.macdSlow) {
    errors.push('MACD fast period must be less than slow period');
  }
  if (dna.indicatorParams.maFastPeriod >= dna.indicatorParams.maSlowPeriod) {
    errors.push('MA fast period must be less than slow period');
  }
  if (dna.exitStrategy.stopLossAtr >= dna.exitStrategy.takeProfitAtr) {
    errors.push('Stop loss ATR should be less than take profit ATR');
  }

  return { valid: errors.length === 0, errors };
}

export function serializeDNA(dna: StrategyDNA): string {
  return JSON.stringify(dna);
}

export function deserializeDNA(json: string): StrategyDNA {
  return JSON.parse(json) as StrategyDNA;
}

// Get all gene ranges for UI display
export function getAllGeneRanges(): Record<string, Record<string, GeneRange>> {
  return {
    entrySignals: ENTRY_SIGNAL_RANGES,
    indicatorParams: INDICATOR_RANGES,
    positionSizing: POSITION_SIZING_RANGES,
    exitStrategy: EXIT_STRATEGY_RANGES,
    regimeFilter: REGIME_FILTER_RANGES,
    timing: TIMING_RANGES,
  };
}

// Flatten DNA to array of numbers (for crossover/mutation)
export function dnaToArray(dna: StrategyDNA): number[] {
  return [
    ...Object.values(dna.entrySignals),
    ...Object.values(dna.indicatorParams),
    ...Object.values(dna.positionSizing),
    ...Object.values(dna.exitStrategy),
    ...Object.values(dna.regimeFilter),
    ...Object.values(dna.timing),
  ];
}

// Reconstruct DNA from flat array
export function arrayToDNA(arr: number[]): StrategyDNA {
  let i = 0;
  const take = (n: number) => arr.slice(i, i += n);

  const esKeys = Object.keys(ENTRY_SIGNAL_RANGES);
  const ipKeys = Object.keys(INDICATOR_RANGES);
  const psKeys = Object.keys(POSITION_SIZING_RANGES);
  const exKeys = Object.keys(EXIT_STRATEGY_RANGES);
  const rfKeys = Object.keys(REGIME_FILTER_RANGES);
  const tmKeys = Object.keys(TIMING_RANGES);

  const toObj = (keys: string[], vals: number[]) => {
    const obj: Record<string, number> = {};
    keys.forEach((k, idx) => { obj[k] = vals[idx]; });
    return obj;
  };

  return {
    entrySignals: toObj(esKeys, take(esKeys.length)) as any,
    indicatorParams: toObj(ipKeys, take(ipKeys.length)) as any,
    positionSizing: toObj(psKeys, take(psKeys.length)) as any,
    exitStrategy: toObj(exKeys, take(exKeys.length)) as any,
    regimeFilter: toObj(rfKeys, take(rfKeys.length)) as any,
    timing: toObj(tmKeys, take(tmKeys.length)) as any,
  };
}
