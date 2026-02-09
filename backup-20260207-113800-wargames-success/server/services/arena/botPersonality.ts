// Bot Personality System - Archetype classification, trait extraction,
// personality-based naming, breeding compatibility, personality evolution
import type {
  StrategyDNA, Bot, BotPersonality, PersonalityArchetype,
  PersonalityTraits, BotGroupName,
} from './types';

// ===================== TRAIT EXTRACTION =====================

// Extract personality traits from DNA genes
export function extractTraits(dna: StrategyDNA): PersonalityTraits {
  const es = dna.entrySignals;
  const ps = dna.positionSizing;
  const ex = dna.exitStrategy;
  const rf = dna.regimeFilter;
  const tm = dna.timing;

  // Aggression: high risk, large positions, impatient, aggressive entries
  const aggression = clamp01(
    (ps.riskPerTrade - 0.005) / 0.045 * 0.3 +    // risk per trade (normalized)
    ps.maxPositionPercent * 0.25 +                  // position size
    (1 - tm.entryPatience) * 0.25 +                 // inverse patience
    (1 - (tm.decisionIntervalMs - 5000) / 55000) * 0.2, // fast decisions
  );

  // Patience: high patience, slow timeframe, wide stops/targets
  const patience = clamp01(
    tm.entryPatience * 0.35 +
    (tm.preferredTimeframe / 3) * 0.25 +            // longer timeframes
    ((tm.decisionIntervalMs - 5000) / 55000) * 0.2 +
    (ex.takeProfitAtr / 5) * 0.2,                   // wide targets
  );

  // Risk tolerance: high risk per trade, large positions, no trailing stops
  const riskTolerance = clamp01(
    (ps.riskPerTrade - 0.005) / 0.045 * 0.3 +
    ps.maxPositionPercent * 0.25 +
    (1 - (ex.trailingStopEnabled > 0.5 ? 0.8 : 0.2)) * 0.2 +
    (ex.stopLossAtr / 3) * 0.25,                    // wider stops = more risk tolerant
  );

  // Adaptability: regime awareness, correlation, multiple signal types
  const signalWeights = Object.values(es);
  const activeSignals = signalWeights.filter(w => w > 0.3).length;
  const adaptability = clamp01(
    rf.correlationAwareness * 0.25 +
    (1 - Math.abs(rf.trendFollowBias)) * 0.25 +     // neutral = more adaptive
    rf.volatilityPreference * 0.1 +
    rf.sessionPreference * 0.15 +
    (activeSignals / 13) * 0.25,                     // uses more signal types
  );

  // Conviction: pyramid enabled, wide take-profit, low partial exits
  const conviction = clamp01(
    (ps.pyramidEnabled > 0.5 ? 0.3 : 0) +
    (ex.takeProfitAtr / 5) * 0.25 +
    (1 - (ex.partialExitEnabled > 0.5 ? 0.6 : 0)) * 0.2 +
    ps.kellyFraction * 0.25,
  );

  // Technical depth: how many signal types are significantly weighted
  const strongSignals = signalWeights.filter(w => w > 0.5).length;
  const technicalDepth = clamp01(
    (strongSignals / 13) * 0.4 +
    (activeSignals / 13) * 0.3 +
    (es.ictOrderBlockBounce + es.ictFvgFill + es.breakOfStructure + es.changeOfCharacter) / 4 * 0.3,
  );

  return {
    aggression: round4(aggression),
    patience: round4(patience),
    riskTolerance: round4(riskTolerance),
    adaptability: round4(adaptability),
    conviction: round4(conviction),
    technicalDepth: round4(technicalDepth),
  };
}

// ===================== ARCHETYPE CLASSIFICATION =====================

interface ArchetypeProfile {
  archetype: PersonalityArchetype;
  dominantTraits: (keyof PersonalityTraits)[];
  signalPreferences: (keyof StrategyDNA['entrySignals'])[];
  description: string;
}

const ARCHETYPE_PROFILES: ArchetypeProfile[] = [
  {
    archetype: 'TrendSurfer',
    dominantTraits: ['patience', 'conviction'],
    signalPreferences: ['maCrossover', 'breakOfStructure', 'momentumBreakout'],
    description: 'Rides long trends with patience and conviction, entering on MA crossovers and BOS',
  },
  {
    archetype: 'MeanReverter',
    dominantTraits: ['patience', 'technicalDepth'],
    signalPreferences: ['rsiOversold', 'rsiOverbought', 'meanReversion'],
    description: 'Fades extremes using RSI and mean reversion, waiting for price to snap back',
  },
  {
    archetype: 'Scalper',
    dominantTraits: ['aggression'],
    signalPreferences: ['volumeSpike', 'momentumBreakout', 'macdCrossover'],
    description: 'Fast in, fast out with tight stops and quick decision intervals',
  },
  {
    archetype: 'SwingTrader',
    dominantTraits: ['patience', 'riskTolerance'],
    signalPreferences: ['maCrossover', 'ictFvgFill', 'macdDivergence'],
    description: 'Holds positions for multiple bars, wide stops and targets, letting trades breathe',
  },
  {
    archetype: 'Contrarian',
    dominantTraits: ['conviction', 'riskTolerance'],
    signalPreferences: ['changeOfCharacter', 'liquiditySweep', 'rsiOversold'],
    description: 'Trades against the crowd, buying fear and selling greed after liquidity sweeps',
  },
  {
    archetype: 'MomentumChaser',
    dominantTraits: ['aggression', 'conviction'],
    signalPreferences: ['momentumBreakout', 'volumeSpike', 'breakOfStructure'],
    description: 'Aggressively chases momentum with pyramiding and strong breakout signals',
  },
  {
    archetype: 'ValueHunter',
    dominantTraits: ['technicalDepth', 'patience'],
    signalPreferences: ['ictOrderBlockBounce', 'ictFvgFill', 'liquiditySweep'],
    description: 'Hunts value at institutional levels using ICT methodology and deep technical analysis',
  },
  {
    archetype: 'Sentinel',
    dominantTraits: ['adaptability'],
    signalPreferences: ['macdCrossover', 'rsiOversold', 'rsiOverbought'],
    description: 'Conservative guardian with low risk, small positions, and trailing stops for capital preservation',
  },
];

// Classify a bot's DNA into the closest archetype
export function classifyArchetype(dna: StrategyDNA): PersonalityArchetype {
  const traits = extractTraits(dna);
  const es = dna.entrySignals;

  let bestArchetype: PersonalityArchetype = 'Sentinel';
  let bestScore = -Infinity;

  for (const profile of ARCHETYPE_PROFILES) {
    let score = 0;

    // Score based on dominant trait alignment
    for (const traitName of profile.dominantTraits) {
      score += traits[traitName] * 2;
    }

    // Score based on signal preferences
    for (const signalName of profile.signalPreferences) {
      score += (es[signalName] || 0) * 1.5;
    }

    // Archetype-specific bonuses
    switch (profile.archetype) {
      case 'TrendSurfer':
        score += dna.regimeFilter.trendFollowBias * 1.5;
        break;
      case 'Contrarian':
        score -= dna.regimeFilter.trendFollowBias * 1.5; // negative bias preferred
        break;
      case 'Scalper':
        score += (3 - dna.timing.preferredTimeframe) * 0.5; // fast timeframe
        score += (60000 - dna.timing.decisionIntervalMs) / 60000 * 1.0;
        break;
      case 'SwingTrader':
        score += dna.timing.preferredTimeframe * 0.5; // slow timeframe
        score += dna.exitStrategy.takeProfitAtr / 5 * 1.0;
        break;
      case 'MomentumChaser':
        score += (dna.positionSizing.pyramidEnabled > 0.5 ? 1.5 : 0);
        break;
      case 'Sentinel':
        score += (1 - traits.riskTolerance) * 1.5;
        score += (dna.exitStrategy.trailingStopEnabled > 0.5 ? 1.0 : 0);
        break;
    }

    if (score > bestScore) {
      bestScore = score;
      bestArchetype = profile.archetype;
    }
  }

  return bestArchetype;
}

// Get the top 3 dominant entry signals from DNA
export function getDominantSignals(dna: StrategyDNA): string[] {
  const signals = Object.entries(dna.entrySignals) as [string, number][];
  signals.sort((a, b) => b[1] - a[1]);
  return signals.slice(0, 3).map(([name]) => name);
}

// ===================== PERSONALITY CONSTRUCTION =====================

// Build full personality profile for a bot
export function buildPersonality(dna: StrategyDNA): BotPersonality {
  const archetype = classifyArchetype(dna);
  const traits = extractTraits(dna);
  const dominantSignals = getDominantSignals(dna);

  return {
    archetype,
    traits,
    dominantSignals,
    description: generateDescription(archetype, traits, dominantSignals),
  };
}

// Generate a human-readable personality description
function generateDescription(
  archetype: PersonalityArchetype,
  traits: PersonalityTraits,
  dominantSignals: string[],
): string {
  const profile = ARCHETYPE_PROFILES.find(p => p.archetype === archetype)!;
  const parts: string[] = [profile.description];

  // Add trait color
  const traitDescriptions: string[] = [];
  if (traits.aggression > 0.7) traitDescriptions.push('highly aggressive');
  else if (traits.aggression < 0.3) traitDescriptions.push('cautious');

  if (traits.patience > 0.7) traitDescriptions.push('very patient');
  else if (traits.patience < 0.3) traitDescriptions.push('impulsive');

  if (traits.riskTolerance > 0.7) traitDescriptions.push('risk-seeking');
  else if (traits.riskTolerance < 0.3) traitDescriptions.push('risk-averse');

  if (traits.conviction > 0.7) traitDescriptions.push('high conviction');

  if (traitDescriptions.length > 0) {
    parts.push(`Style: ${traitDescriptions.join(', ')}.`);
  }

  // Signal focus
  const readableSignals = dominantSignals.map(s => SIGNAL_READABLE[s] || s);
  parts.push(`Primary signals: ${readableSignals.join(', ')}.`);

  return parts.join(' ');
}

const SIGNAL_READABLE: Record<string, string> = {
  rsiOversold: 'RSI oversold',
  rsiOverbought: 'RSI overbought',
  macdCrossover: 'MACD crossover',
  macdDivergence: 'MACD divergence',
  maCrossover: 'MA crossover',
  ictOrderBlockBounce: 'Order block bounce',
  ictFvgFill: 'FVG fill',
  breakOfStructure: 'Break of structure',
  changeOfCharacter: 'Change of character',
  liquiditySweep: 'Liquidity sweep',
  volumeSpike: 'Volume spike',
  meanReversion: 'Mean reversion',
  momentumBreakout: 'Momentum breakout',
};

// ===================== BREEDING COMPATIBILITY =====================

// Some personality pairings produce more diverse offspring (hybrid vigor)
const COMPATIBILITY_MATRIX: Record<PersonalityArchetype, Record<PersonalityArchetype, number>> = {
  TrendSurfer:    { TrendSurfer: 0.5, MeanReverter: 0.9, Scalper: 0.7, SwingTrader: 0.8, Contrarian: 1.0, MomentumChaser: 0.6, ValueHunter: 0.8, Sentinel: 0.7 },
  MeanReverter:   { TrendSurfer: 0.9, MeanReverter: 0.4, Scalper: 0.6, SwingTrader: 0.7, Contrarian: 0.8, MomentumChaser: 0.9, ValueHunter: 0.7, Sentinel: 0.6 },
  Scalper:        { TrendSurfer: 0.7, MeanReverter: 0.6, Scalper: 0.3, SwingTrader: 0.9, Contrarian: 0.7, MomentumChaser: 0.5, ValueHunter: 0.8, Sentinel: 0.8 },
  SwingTrader:    { TrendSurfer: 0.8, MeanReverter: 0.7, Scalper: 0.9, SwingTrader: 0.4, Contrarian: 0.8, MomentumChaser: 0.7, ValueHunter: 0.6, Sentinel: 0.7 },
  Contrarian:     { TrendSurfer: 1.0, MeanReverter: 0.8, Scalper: 0.7, SwingTrader: 0.8, Contrarian: 0.3, MomentumChaser: 0.9, ValueHunter: 0.7, Sentinel: 0.8 },
  MomentumChaser: { TrendSurfer: 0.6, MeanReverter: 0.9, Scalper: 0.5, SwingTrader: 0.7, Contrarian: 0.9, MomentumChaser: 0.3, ValueHunter: 0.8, Sentinel: 0.9 },
  ValueHunter:    { TrendSurfer: 0.8, MeanReverter: 0.7, Scalper: 0.8, SwingTrader: 0.6, Contrarian: 0.7, MomentumChaser: 0.8, ValueHunter: 0.4, Sentinel: 0.6 },
  Sentinel:       { TrendSurfer: 0.7, MeanReverter: 0.6, Scalper: 0.8, SwingTrader: 0.7, Contrarian: 0.8, MomentumChaser: 0.9, ValueHunter: 0.6, Sentinel: 0.3 },
};

// Get breeding compatibility between two bots (higher = more diverse offspring)
export function breedingCompatibility(bot1: Bot, bot2: Bot): number {
  const p1 = classifyArchetype(bot1.dna);
  const p2 = classifyArchetype(bot2.dna);
  return COMPATIBILITY_MATRIX[p1][p2];
}

// Compatibility-weighted parent selection: bias toward complementary personalities
export function selectCompatibleParent(
  candidate: Bot,
  population: { bot: Bot; fitness: number }[],
): Bot {
  const candidateArchetype = classifyArchetype(candidate.dna);

  // Weight selection by compatibility * fitness
  let bestScore = -Infinity;
  let bestBot = population[0].bot;

  for (const { bot, fitness } of population) {
    if (bot.id === candidate.id) continue;
    const otherArchetype = classifyArchetype(bot.dna);
    const compatibility = COMPATIBILITY_MATRIX[candidateArchetype][otherArchetype];
    const score = fitness * (0.7 + compatibility * 0.3); // fitness-primary, compatibility-boost
    if (score > bestScore) {
      bestScore = score;
      bestBot = bot;
    }
  }

  return bestBot;
}

// ===================== PERSONALITY EVOLUTION TRACKING =====================

// Track how personality distribution changes over generations
export function getPersonalityDistribution(bots: Bot[]): Record<PersonalityArchetype, number> {
  const dist: Record<string, number> = {};
  for (const archetype of ['TrendSurfer', 'MeanReverter', 'Scalper', 'SwingTrader', 'Contrarian', 'MomentumChaser', 'ValueHunter', 'Sentinel']) {
    dist[archetype] = 0;
  }

  for (const bot of bots) {
    const arch = classifyArchetype(bot.dna);
    dist[arch] = (dist[arch] || 0) + 1;
  }

  return dist as Record<PersonalityArchetype, number>;
}

// Get personality summaries for all bots
export function getPersonalitySummaries(bots: Bot[]): Map<string, BotPersonality> {
  const map = new Map<string, BotPersonality>();
  for (const bot of bots) {
    map.set(bot.id, buildPersonality(bot.dna));
  }
  return map;
}

// ===================== PERSONALITY-ENHANCED NAMING =====================

const ARCHETYPE_TITLES: Record<PersonalityArchetype, string[]> = {
  TrendSurfer:    ['Tide Rider', 'Wave Master', 'Current Chaser', 'Flow Walker'],
  MeanReverter:   ['Bounce Hunter', 'Snap Back', 'Rubber Band', 'Equilibrium Seeker'],
  Scalper:        ['Quick Draw', 'Flash Trader', 'Razor Edge', 'Speed Demon'],
  SwingTrader:    ['Patient Eagle', 'Long Horizon', 'Steady Hand', 'Arc Tracer'],
  Contrarian:     ['Devil Advocate', 'Counter Strike', 'Rebel Mind', 'Inverse Oracle'],
  MomentumChaser: ['Rocket Rider', 'Force Multiplier', 'Blast Wave', 'Surge Captain'],
  ValueHunter:    ['Deep Diver', 'Smart Money', 'Price Archaeologist', 'Level Seeker'],
  Sentinel:       ['Iron Guard', 'Shield Wall', 'Safe Haven', 'Capital Knight'],
};

// Generate a personality-flavored title for a bot
export function getPersonalityTitle(personality: BotPersonality): string {
  const titles = ARCHETYPE_TITLES[personality.archetype];
  // Deterministic pick based on trait hash
  const hash = Math.abs(
    personality.traits.aggression * 1000 +
    personality.traits.patience * 100 +
    personality.traits.riskTolerance * 10
  );
  const idx = Math.floor(hash) % titles.length;
  return titles[idx];
}

// ===================== HELPERS =====================

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round4(v: number): number {
  return Number(v.toFixed(4));
}
