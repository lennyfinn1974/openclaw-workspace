// IPC Protocol: Newline-delimited JSON over stdin/stdout

export interface IPCRequest {
  id: string;
  type: IPCRequestType;
  payload: any;
  timestamp: number;
}

export interface IPCResponse {
  id: string;
  type: string;
  success: boolean;
  payload: any;
  error?: string;
  processingTimeMs: number;
}

export type IPCRequestType =
  | 'health:ping'
  | 'shapley:batch'
  | 'patterns:extract_features'
  | 'patterns:cluster'
  | 'competitive:train'
  | 'competitive:predict'
  | 'competitive:predict_all'
  | 'competitive:crowding'
  | 'competitive:niches'
  | 'fingerprint:regime_matrix';

// ── Request Payloads ──

export interface ShapleyBatchPayload {
  trades: Array<{
    id: string;
    botId: string;
    symbol: string;
    direction: 'buy' | 'sell';
    quantity: number;
    price: number;
    timestamp: number;
    regime: string;
    pnl: number;
    pnlPercentage: number;
    holdingPeriodMinutes: number;
    indicators: {
      rsi14: number;
      macdHist: number;
      bbPosition: number;
      atr14: number;
      volumeRatio: number;
      trendStrength: number;
      priceVsMA50: number;
      priceVsMA200: number;
    };
  }>;
  permutations: number;  // default 100
}

export interface PatternExtractPayload {
  botTrades: Record<string, Array<{
    direction: 'buy' | 'sell';
    quantity: number;
    price: number;
    timestamp: number;
    regime: string;
    pnl?: number;
    holdingPeriodMinutes?: number;
    confidence?: number;
    indicators?: {
      rsi14: number;
      macdHist: number;
      bbPosition: number;
      atr14: number;
      volumeRatio: number;
      trendStrength: number;
      priceVsMA50: number;
      priceVsMA200: number;
    };
  }>>;
}

export interface PatternClusterPayload {
  features: Record<string, number[]>;  // botId -> 20D vector
  nNeighbors?: number;    // UMAP param, default 5
  minDist?: number;       // UMAP param, default 0.1
  minClusterSize?: number; // HDBSCAN param, default 3
}

export interface CompetitiveTrainPayload {
  botId: string;
  features: number[][];   // N x 20 feature matrix
  labels: number[];       // 0=buy, 1=sell, 2=hold
  sampleWeights?: number[];
}

export interface CompetitivePredictPayload {
  botId: string;
  features: number[];     // 20D feature vector for current state
}

export interface CompetitivePredictAllPayload {
  predictions: Record<string, number[]>;  // botId -> 20D features
}

export interface CrowdingPayload {
  recentTrades: Array<{
    botId: string;
    symbol: string;
    direction: 'buy' | 'sell';
    timestamp: number;
  }>;
  windowMinutes: number;     // default 5
  thresholdRatio: number;    // default 0.6
  totalBots: number;
}

export interface NichePayload {
  archetypes: Array<{
    id: number;
    memberBotIds: string[];
  }>;
  performanceByBotRegime: Record<string, Record<string, {
    avgReturn: number;
    tradeCount: number;
  }>>;
}

export interface RegimeMatrixPayload {
  archetypes: Array<{
    id: number;
    memberBotIds: string[];
  }>;
  botPerformanceByRegime: Record<string, Record<string, {
    avgReturn: number;
    winRate: number;
    tradeCount: number;
    sharpe: number;
  }>>;
}
