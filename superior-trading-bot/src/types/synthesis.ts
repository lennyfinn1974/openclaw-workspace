/**
 * Types for Layers 3-4: Strategy Synthesis + Competitive Intelligence
 * Superior Trading Bot - Meta-Cognitive Trading System
 * Phase 1: ANALYSIS ONLY - no live trading
 */

import { MarketRegime, IndicatorSnapshot, TradeDirection } from './core';

// ===================== EXPRESSION TREE TYPES =====================

export type NodeType = 'indicator' | 'operator' | 'comparator' | 'logical' | 'constant' | 'action';

export type IndicatorFunction =
  | 'RSI' | 'MACD_HIST' | 'BB_POSITION' | 'ATR'
  | 'VOLUME_RATIO' | 'TREND_STRENGTH' | 'PRICE_VS_MA50' | 'PRICE_VS_MA200'
  | 'EMA' | 'SMA' | 'STOCH_K' | 'STOCH_D' | 'WILLIAMS_R'
  | 'MOMENTUM' | 'ROC' | 'CCI' | 'MFI';

export type ArithmeticOperator = 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MAX' | 'MIN' | 'ABS' | 'NEG';
export type ComparatorOperator = 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ' | 'CROSS_ABOVE' | 'CROSS_BELOW';
export type LogicalOperator = 'AND' | 'OR' | 'NOT' | 'XOR';
export type ActionType = 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';

export interface StrategyNode {
  id: string;
  type: NodeType;
  value: string;
  params?: Record<string, number>;
  children?: StrategyNode[];
  depth?: number;
}

export interface ExpressionTreeConfig {
  maxDepth: number;
  maxNodes: number;
  parsimonyCoefficient: number;  // complexity penalty in fitness
  availableIndicators: IndicatorFunction[];
  constantRange: { min: number; max: number };
  mutationRate: number;
  crossoverRate: number;
}

export interface TreeEvalResult {
  action: ActionType;
  confidence: number;
  signalStrength: number;
  nodesEvaluated: number;
}

// ===================== GENETIC PROGRAMMING TYPES =====================

export interface GPConfig {
  populationSize: number;
  maxGenerations: number;
  tournamentSize: number;
  elitismCount: number;
  crossoverRate: number;
  mutationRate: number;
  reproductionRate: number;
  maxTreeDepth: number;
  maxTreeNodes: number;
  parsimonyPressure: number;
  fitnessThreshold: number;
  stagnationLimit: number;        // generations without improvement before restart
  diversityThreshold: number;     // minimum population diversity
}

export interface GPIndividual {
  id: string;
  tree: StrategyNode;
  fitness: number;
  adjustedFitness: number;        // fitness after parsimony penalty
  generation: number;
  parentIds: string[];
  nodeCount: number;
  depth: number;

  // Performance metrics from backtesting
  metrics: StrategyMetrics;

  // Lineage tracking
  createdBy: 'random' | 'crossover' | 'mutation' | 'adversarial' | 'nmf_inspired';
  createdAt: number;
}

export interface StrategyMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  avgHoldingPeriod: number;
  avgReturn: number;
  volatility: number;
  calmarRatio: number;
  sortinoRatio: number;

  // Regime breakdown
  returnByRegime: Record<string, number>;
  tradeCountByRegime: Record<string, number>;

  // Walk-forward results
  inSampleReturn: number;
  outOfSampleReturn: number;
  degradationRatio: number;   // out-of-sample / in-sample (>0.5 is good)

  // Anti-overfitting
  complexityPenalty: number;
  effectiveFitness: number;   // fitness - complexityPenalty
}

export interface GPPopulationStats {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  medianFitness: number;
  worstFitness: number;
  diversityIndex: number;     // unique tree structures / population size
  avgNodeCount: number;
  avgDepth: number;
  speciesCount: number;       // distinct strategy archetypes
  stagnationCounter: number;
}

// ===================== NMF TYPES =====================

export interface NMFConfig {
  numFactors: number;           // k: number of latent factors to extract
  maxIterations: number;
  convergenceThreshold: number;
  regularization: number;       // L2 regularization strength
  initMethod: 'random' | 'nndsvd' | 'nndsvda';
}

export interface NMFResult {
  W: number[][];                // Bot-factor weights (21 x k)
  H: number[][];                // Factor-gene loadings (k x 50)
  factors: LatentFactor[];
  reconstructionError: number;
  iterations: number;
  converged: boolean;
}

export interface LatentFactor {
  id: number;
  name: string;                 // auto-generated descriptive name
  geneLoadings: number[];       // which genes this factor activates
  topGenes: { index: number; loading: number; name: string }[];
  botWeights: { botId: string; weight: number }[];
  correlationWithFitness: number;
  interpretation: string;       // human-readable description
}

export interface DNASnapshot {
  botId: string;
  genes: number[];              // 50+ gene values
  fitness: number;
  timestamp: number;
  rank: number;
}

export interface FactorCombination {
  id: string;
  factorWeights: number[];      // weights for each latent factor
  synthesizedDNA: number[];     // resulting gene values
  noveltyScore: number;         // how different from existing bots
  expectedFitness: number;      // predicted from factor-fitness correlations
  source: 'amplification' | 'novel_combination' | 'gap_filling';
}

// ===================== ADVERSARIAL GENERATION TYPES =====================

export interface AdversarialConfig {
  targetBotCount: number;       // how many top bots to target
  lookbackPeriods: number;      // periods to analyze
  exploitThreshold: number;     // minimum weakness severity to target
  maxStrategiesPerTarget: number;
}

export interface BotWeakness {
  botId: string;
  weakness: string;
  regime: MarketRegime;
  conditions: WeaknessConditions;
  severity: number;             // 0-1, higher = more exploitable
  frequency: number;            // how often conditions occur
  expectedEdge: number;         // expected advantage per occurrence
  sampleSize: number;
  confidence: number;
}

export interface WeaknessIndicatorCondition {
  rsi?: { min?: number; max?: number };
  macd?: { direction?: 'positive' | 'negative'; threshold?: number };
  volume?: { minRatio?: number; maxRatio?: number };
  atr?: { min?: number; max?: number };
  trend?: { min?: number; max?: number };
}

export interface WeaknessConditions {
  regime?: MarketRegime;
  indicators?: WeaknessIndicatorCondition;
  timeOfDay?: { start: number; end: number };
  volatilityState?: 'low' | 'normal' | 'high' | 'extreme';
  precedingAction?: TradeDirection;
}

export interface AdversarialStrategy {
  id: string;
  targetBotIds: string[];
  weaknessesExploited: BotWeakness[];
  entryConditions: StrategyNode;
  exitConditions: StrategyNode;
  expectedEdge: number;
  simulatedReturn: number;
  confidence: number;
  createdAt: number;
}

// ===================== STRATEGY VALIDATION TYPES =====================

export type ValidationStage = 'structural' | 'walk_forward' | 'regime_stress' | 'paper_trading' | 'approved' | 'rejected';

export interface ValidationResult {
  strategyId: string;
  stage: ValidationStage;
  passed: boolean;
  score: number;
  details: Record<string, unknown>;
  testedAt: number;
}

export interface WalkForwardResult {
  folds: WalkForwardFold[];
  avgInSampleReturn: number;
  avgOutOfSampleReturn: number;
  degradationRatio: number;
  profitableFolds: number;
  totalFolds: number;
  passed: boolean;
}

export interface WalkForwardFold {
  foldIndex: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  inSampleReturn: number;
  outOfSampleReturn: number;
  inSampleSharpe: number;
  outOfSampleSharpe: number;
  tradeCount: number;
}

export interface RegimeStressResult {
  regimeResults: Record<string, {
    return: number;
    maxDrawdown: number;
    tradeCount: number;
    winRate: number;
    passed: boolean;
  }>;
  maxLossInAnyRegime: number;
  profitableRegimes: number;
  passed: boolean;
}

export interface StrategyLifecycle {
  strategyId: string;
  stage: 'birth' | 'paper_trading' | 'incubation' | 'growth' | 'maturity' | 'decay' | 'retired';
  createdAt: number;
  lastUpdated: number;
  promotionHistory: { from: string; to: string; at: number; reason: string }[];
  currentAllocation: number;
  lifetimeReturn: number;
  validationResults: ValidationResult[];
}

// ===================== COMPETITIVE INTELLIGENCE TYPES =====================

export type PredictedAction = 'buy' | 'sell' | 'hold';

export interface ActionProbability {
  buy: number;
  sell: number;
  hold: number;
}

export interface BotPrediction {
  botId: string;
  timestamp: number;
  nextLikelyAction: PredictedAction;
  confidence: number;
  predictedSymbol: string;
  reasoning: string;

  // Ensemble components
  markovPrediction: ActionProbability;
  gradientBoostPrediction: ActionProbability;
  dnaBasedPrediction: ActionProbability | null;

  // Ensemble weights (learned)
  ensembleWeights: {
    markov: number;
    gradientBoost: number;
    dnaBased: number;
  };
}

export interface MarkovState {
  botId: string;
  order: number;                              // Markov chain order (1 or 2)
  transitionMatrix: Map<string, ActionProbability>;  // state -> next action probs
  stateHistory: PredictedAction[];
  totalTransitions: number;
  lastUpdated: number;
}

export interface GradientBoostModel {
  botId: string;
  trees: DecisionTreeNode[];
  learningRate: number;
  featureImportance: Record<string, number>;
  trainingSize: number;
  accuracy: number;
  lastRetrained: number;
}

export interface DecisionTreeNode {
  featureIndex: number;
  threshold: number;
  left?: DecisionTreeNode;
  right?: DecisionTreeNode;
  prediction?: ActionProbability;
  samples: number;
}

// ===================== CROWDING DETECTION TYPES =====================

export type CrowdingSeverity = 'none' | 'mild' | 'moderate' | 'severe' | 'extreme';

export interface CrowdingAlert {
  id: string;
  symbol: string;
  direction: TradeDirection;
  severity: CrowdingSeverity;
  imbalanceRatio: number;       // 0-1, higher = more crowded
  botsInvolved: string[];
  smartMoneyBots: string[];     // consistently early movers
  dumbMoneyBots: string[];      // consistently late movers
  recommendation: 'FADE' | 'AVOID' | 'FOLLOW_SMART_MONEY' | 'NEUTRAL';
  estimatedReversalProb: number;
  detectedAt: number;
  windowMinutes: number;
}

export interface SmartMoneyScore {
  botId: string;
  earlyMoverScore: number;      // how often first to enter profitable trades
  contrarianScore: number;      // how often bets against crowd successfully
  exitTimingScore: number;      // quality of exit timing
  overallScore: number;
  classification: 'smart_money' | 'neutral' | 'dumb_money';
  sampleSize: number;
}

export interface CrowdingSnapshot {
  timestamp: number;
  symbols: Record<string, {
    buyPressure: number;        // count of recent buys
    sellPressure: number;
    netPressure: number;
    uniqueBuyers: string[];
    uniqueSellers: string[];
    imbalance: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;
  overallCrowdingLevel: CrowdingSeverity;
}

// ===================== NICHE DISCOVERY TYPES =====================

export type NicheStatus = 'underexploited' | 'overcrowded' | 'unexplored' | 'balanced';

export interface NicheOpportunity {
  id: string;
  regime: MarketRegime;
  archetypeId: number;
  archetypeName: string;
  status: NicheStatus;
  coverage: number;             // number of bots in this niche
  avgPerformance: number;       // average return of bots here
  estimatedCapacity: number;    // max bots before crowding
  opportunityScore: number;     // higher = more attractive
  conditions: string;           // human-readable description
  discoveredAt: number;
}

export interface NicheMap {
  timestamp: number;
  niches: NicheOpportunity[];
  totalNiches: number;
  underexploitedCount: number;
  overcrowdedCount: number;
  unexploredCount: number;
  recommendations: NicheRecommendation[];
}

export interface NicheRecommendation {
  niche: NicheOpportunity;
  action: 'enter' | 'exit' | 'increase' | 'decrease' | 'explore';
  priority: number;             // 1-10
  reasoning: string;
  estimatedEdge: number;
}

// ===================== SYNTHESIS ENGINE TYPES =====================

export interface SynthesisConfig {
  gp: GPConfig;
  nmf: NMFConfig;
  adversarial: AdversarialConfig;
  tree: ExpressionTreeConfig;

  // General synthesis params
  synthesisInterval: number;     // ms between synthesis cycles
  maxActiveStrategies: number;
  minValidationScore: number;
  strategyDecayHalfLife: number; // trades before performance decays
}

export interface SynthesisStatus {
  active: boolean;
  generation: number;
  strategiesGenerated: number;
  strategiesValidated: number;
  strategiesApproved: number;
  strategiesRetired: number;
  activeStrategies: number;
  bestStrategyFitness: number;
  avgStrategyFitness: number;
  nmfFactorsExtracted: number;
  adversarialStrategies: number;
  lastSynthesisAt: number;
}

// ===================== COMPETITIVE INTELLIGENCE ENGINE TYPES =====================

export interface CompetitiveIntelConfig {
  predictionUpdateInterval: number;  // ms
  crowdingWindowMinutes: number;
  nicheUpdateInterval: number;       // ms
  markovOrder: number;               // 1 or 2
  minTradesForPrediction: number;
  smartMoneyThreshold: number;
  retrainInterval: number;           // trades between model retraining
}

export interface CompetitiveIntelStatus {
  active: boolean;
  botsTracked: number;
  predictionsGenerated: number;
  predictionAccuracy: number;
  crowdingAlerts: number;
  activeCrowdingAlerts: number;
  nichesDiscovered: number;
  underexploitedNiches: number;
  smartMoneyBots: string[];
  lastUpdateAt: number;
}
