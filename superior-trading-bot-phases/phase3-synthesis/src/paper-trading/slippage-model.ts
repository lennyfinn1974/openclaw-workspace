/**
 * Realistic Slippage & Latency Simulation Model
 *
 * Models real-world execution imperfections:
 * - Market impact: larger orders move the price more
 * - Spread costs: bid-ask spread widens in volatile markets
 * - Volatility impact: high-volatility periods have worse fills
 * - Latency jitter: network delays with occasional spikes
 * - Commission costs: per-trade fees
 */

import { SlippageModelConfig, LatencyModelConfig } from '../types';

const DEFAULT_SLIPPAGE: SlippageModelConfig = {
  baseSlippageBps: 2,         // 0.02% base slippage
  volatilityMultiplier: 1.5,  // slippage scales 1.5x with ATR
  sizeImpactFactor: 0.5,      // larger positions get more slippage
  spreadBps: 5,               // 0.05% typical bid-ask spread
};

const DEFAULT_LATENCY: LatencyModelConfig = {
  baseLatencyMs: 50,          // 50ms base latency
  jitterMs: 20,               // ±20ms normal jitter
  spikeProb: 0.02,            // 2% chance of latency spike
  spikeMultiplier: 10,        // spikes are 10x normal
};

export interface SlippageResult {
  requestedPrice: number;
  filledPrice: number;
  slippageBps: number;
  slippageDollar: number;
  spreadCost: number;
  marketImpact: number;
  latencyMs: number;
  fillTimestamp: number;
}

export class SlippageModel {
  private slippageCfg: SlippageModelConfig;
  private latencyCfg: LatencyModelConfig;

  constructor(slippage?: Partial<SlippageModelConfig>, latency?: Partial<LatencyModelConfig>) {
    this.slippageCfg = { ...DEFAULT_SLIPPAGE, ...slippage };
    this.latencyCfg = { ...DEFAULT_LATENCY, ...latency };
  }

  /**
   * Simulate realistic order execution with slippage and latency.
   *
   * @param requestedPrice - Price when signal was generated
   * @param quantity - Number of units being traded
   * @param side - 'buy' or 'sell'
   * @param volatility - Current ATR or volatility measure (higher = more slippage)
   * @param volumeRatio - Current volume vs average (lower = more slippage)
   * @param timestamp - Signal generation time
   */
  simulateExecution(
    requestedPrice: number,
    quantity: number,
    side: 'buy' | 'sell',
    volatility: number,
    volumeRatio: number,
    timestamp: number,
  ): SlippageResult {
    // 1. Calculate latency
    const latencyMs = this.simulateLatency();
    const fillTimestamp = timestamp + latencyMs;

    // 2. Price drift during latency (random walk)
    const driftBps = this.simulatePriceDrift(latencyMs, volatility);

    // 3. Spread cost (widens with volatility, narrows with volume)
    const volSpreadMult = 1 + Math.max(0, volatility - 1) * 0.5;
    const liquidityDiscount = Math.max(0.5, Math.min(1.5, 1 / Math.max(volumeRatio, 0.1)));
    const spreadBps = this.slippageCfg.spreadBps * volSpreadMult * liquidityDiscount;

    // 4. Market impact (larger size = more impact)
    const sizeNormalized = Math.max(0, quantity) / 100; // normalize to 100-unit baseline
    const marketImpactBps = this.slippageCfg.sizeImpactFactor * Math.sqrt(sizeNormalized) * volatility;

    // 5. Base slippage (always exists)
    const baseSlipBps = this.slippageCfg.baseSlippageBps *
      (1 + (this.slippageCfg.volatilityMultiplier - 1) * Math.max(0, volatility - 1));

    // 6. Total slippage in basis points (always unfavorable to trader)
    const totalSlippageBps = spreadBps / 2 + marketImpactBps + baseSlipBps + Math.abs(driftBps);

    // 7. Calculate filled price
    const slippageFraction = totalSlippageBps / 10000;
    const slippageDollar = requestedPrice * slippageFraction;
    const spreadCost = requestedPrice * (spreadBps / 10000) / 2;
    const marketImpact = requestedPrice * (marketImpactBps / 10000);

    let filledPrice: number;
    if (side === 'buy') {
      filledPrice = requestedPrice * (1 + slippageFraction); // worse fill for buys
    } else {
      filledPrice = requestedPrice * (1 - slippageFraction); // worse fill for sells
    }

    return {
      requestedPrice,
      filledPrice,
      slippageBps: totalSlippageBps,
      slippageDollar,
      spreadCost,
      marketImpact,
      latencyMs,
      fillTimestamp,
    };
  }

  /**
   * Simulate network latency with jitter and occasional spikes.
   * Uses log-normal distribution for realistic latency modeling.
   */
  private simulateLatency(): number {
    // Check for spike
    if (Math.random() < this.latencyCfg.spikeProb) {
      return this.latencyCfg.baseLatencyMs * this.latencyCfg.spikeMultiplier *
        (0.5 + Math.random());
    }

    // Normal jitter: Box-Muller for Gaussian
    const u1 = Math.random();
    const u2 = Math.random();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const jitter = gaussian * this.latencyCfg.jitterMs;

    return Math.max(1, this.latencyCfg.baseLatencyMs + jitter);
  }

  /**
   * Simulate price drift during the latency period.
   * Longer latency + higher volatility = more drift.
   */
  private simulatePriceDrift(latencyMs: number, volatility: number): number {
    // Random walk: drift scales with sqrt(time) and volatility
    const timeFactor = Math.sqrt(latencyMs / 1000); // normalized to seconds
    const u1 = Math.random();
    const u2 = Math.random();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return gaussian * volatility * timeFactor * 2; // basis points
  }

  /**
   * Get expected slippage for position sizing decisions.
   */
  estimateSlippage(quantity: number, volatility: number, volumeRatio: number): number {
    const sizeNorm = quantity / 100;
    const impact = this.slippageCfg.sizeImpactFactor * Math.sqrt(sizeNorm) * volatility;
    const spread = this.slippageCfg.spreadBps * (1 + Math.max(0, volatility - 1) * 0.5);
    const base = this.slippageCfg.baseSlippageBps;
    return spread / 2 + impact + base;
  }
}
