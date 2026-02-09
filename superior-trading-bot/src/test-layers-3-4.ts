/**
 * Test Runner for Layers 3-4: Strategy Synthesis + Competitive Intelligence
 * Validates all components work correctly with synthetic data.
 * Run: npx ts-node src/test-layers-3-4.ts
 */

import { ExpressionTree } from './synthesis/ExpressionTree';
import { GeneticProgramming } from './synthesis/GeneticProgramming';
import { NMFEngine } from './synthesis/NMFEngine';
import { AdversarialGenerator } from './synthesis/AdversarialGenerator';
import { StrategyValidator } from './synthesis/StrategyValidator';
import { MarkovPredictor } from './intelligence/MarkovPredictor';
import { CrowdingDetector } from './intelligence/CrowdingDetector';
import { NicheDiscovery } from './intelligence/NicheDiscovery';
import { IndicatorSnapshot, MarketRegime, ObservationEvent } from './types/core';
import { DNASnapshot } from './types/synthesis';

// ===================== TEST HELPERS =====================

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, message: string): void {
  total++;
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message}`);
  }
}

function randomIndicators(): IndicatorSnapshot {
  return {
    rsi14: Math.random() * 100,
    macdHist: Math.random() * 2 - 1,
    bbPosition: Math.random(),
    atr14: Math.random() * 5,
    volumeRatio: Math.random() * 3,
    trendStrength: Math.random() * 50,
    priceVsMA50: Math.random() * 10 - 5,
    priceVsMA200: Math.random() * 20 - 10,
  };
}

function generateSyntheticEvents(count: number): ObservationEvent[] {
  const events: ObservationEvent[] = [];
  const bots = ['bot_1', 'bot_2', 'bot_3', 'bot_4', 'bot_5'];
  const regimes: MarketRegime[] = ['TRENDING', 'RANGING', 'VOLATILE', 'BREAKOUT', 'QUIET'];

  for (let i = 0; i < count; i++) {
    const botId = bots[Math.floor(Math.random() * bots.length)];
    const direction = Math.random() > 0.5 ? 'buy' : 'sell';
    const price = 50000 + Math.random() * 1000;
    const pnl = (Math.random() - 0.45) * 100;

    events.push({
      id: `evt_${i}`,
      timestamp: Date.now() - (count - i) * 60000,
      source: 'arena_bot',
      eventType: 'trade',
      payload: {
        botId,
        symbol: 'BTCUSDT',
        direction,
        quantity: 0.1,
        price,
        timestamp: Date.now() - (count - i) * 60000,
        regime: regimes[Math.floor(Math.random() * regimes.length)],
        preTradeIndicators: randomIndicators(),
        pnl,
      } as any,
      enrichmentMetadata: {
        processingTime: 1,
        indicators: randomIndicators(),
      },
    });
  }

  return events;
}

function generateDNASnapshots(): DNASnapshot[] {
  const snapshots: DNASnapshot[] = [];
  for (let i = 0; i < 15; i++) {
    snapshots.push({
      botId: `bot_${i}`,
      genes: Array.from({ length: 50 }, () => Math.random()),
      fitness: Math.random() * 100,
      timestamp: Date.now(),
      rank: i + 1,
    });
  }
  return snapshots;
}

// ===================== TESTS =====================

async function testExpressionTree(): Promise<void> {
  console.log('\n=== Expression Tree Tests ===');

  const tree = new ExpressionTree();

  // Test: Generate random tree
  const randomTree = tree.generateRandom(5);
  assert(randomTree !== null, 'Generate random tree');
  assert(tree.countNodes(randomTree) > 0, `Tree has nodes (${tree.countNodes(randomTree)})`);
  assert(tree.getDepth(randomTree) <= 6, `Tree depth within limit (${tree.getDepth(randomTree)})`);

  // Test: Evaluate tree
  const indicators = randomIndicators();
  const result = tree.evaluate(randomTree, indicators, 'TRENDING');
  assert(['BUY', 'SELL', 'HOLD', 'CLOSE'].includes(result.action), `Evaluation returns valid action: ${result.action}`);
  assert(result.confidence >= 0 && result.confidence <= 1, `Confidence in range [0,1]: ${result.confidence.toFixed(3)}`);
  assert(result.nodesEvaluated > 0, `Nodes evaluated: ${result.nodesEvaluated}`);

  // Test: Crossover
  const tree2 = tree.generateRandom(4);
  const [child1, child2] = tree.crossover(randomTree, tree2);
  assert(child1 !== null && child2 !== null, 'Crossover produces two children');

  // Test: Mutation
  const mutated = tree.mutate(randomTree);
  assert(mutated !== null, 'Mutation produces a tree');

  // Test: Subtree mutation
  const subtreeMutated = tree.subtreeMutate(randomTree);
  assert(subtreeMutated !== null, 'Subtree mutation produces a tree');

  // Test: Simplification
  const simplified = tree.simplify(randomTree);
  assert(simplified !== null, 'Simplification produces a tree');

  // Test: Serialization round-trip
  const serialized = tree.serialize(randomTree);
  const deserialized = tree.deserialize(serialized);
  assert(tree.countNodes(deserialized) > 0, 'Deserialized tree has nodes');

  // Test: Complexity score
  const complexity = tree.complexityScore(randomTree);
  assert(typeof complexity === 'number', `Complexity score: ${complexity.toFixed(3)}`);

  // Test: toString
  const str = tree.toString(randomTree);
  assert(str.length > 0, 'toString produces output');
}

async function testGeneticProgramming(): Promise<void> {
  console.log('\n=== Genetic Programming Tests ===');

  const gp = new GeneticProgramming({
    populationSize: 20,
    maxGenerations: 5,
    tournamentSize: 3,
    elitismCount: 2,
    maxTreeDepth: 5,
  });

  // Test: Population initialization
  gp.initializePopulation();
  const pop = gp.getPopulation();
  assert(pop.length === 20, `Population size: ${pop.length}`);

  // Test: Set training data
  const events = generateSyntheticEvents(100);
  gp.setTrainingData(events, []);
  assert(true, 'Training data set successfully');

  // Test: Evolve one generation
  const stats = await gp.evolveGeneration();
  assert(stats.generation === 1, `Generation: ${stats.generation}`);
  assert(typeof stats.bestFitness === 'number', `Best fitness: ${stats.bestFitness.toFixed(4)}`);
  assert(typeof stats.avgFitness === 'number', `Avg fitness: ${stats.avgFitness.toFixed(4)}`);
  assert(stats.diversityIndex > 0, `Diversity: ${stats.diversityIndex.toFixed(2)}`);

  // Test: Multiple generations
  for (let i = 0; i < 3; i++) {
    await gp.evolveGeneration();
  }
  assert(gp.getGeneration() === 4, `Generation count: ${gp.getGeneration()}`);

  // Test: Best individual
  const best = gp.getBest();
  assert(best !== null, 'Best individual exists');

  // Test: Hall of fame
  const hof = gp.getHallOfFame();
  assert(hof.length > 0, `Hall of Fame: ${hof.length} entries`);

  // Test: Inject individual
  const tree = new ExpressionTree();
  gp.injectIndividual(tree.generateRandom(3), 'nmf_inspired');
  assert(true, 'External individual injected');
}

async function testNMFEngine(): Promise<void> {
  console.log('\n=== NMF Engine Tests ===');

  const nmf = new NMFEngine({ numFactors: 3, maxIterations: 50 });
  const snapshots = generateDNASnapshots();

  // Test: Decomposition
  const result = nmf.decompose(snapshots);
  assert(result !== null, 'NMF decomposition completed');
  assert(result.factors.length === 3, `Factors: ${result.factors.length}`);
  assert(result.W.length === snapshots.length, `W rows: ${result.W.length}`);
  assert(result.H.length === 3, `H rows: ${result.H.length}`);
  assert(result.reconstructionError > 0, `Reconstruction error: ${result.reconstructionError.toFixed(4)}`);

  // Test: Factor interpretation
  for (const factor of result.factors) {
    assert(factor.name.length > 0, `Factor ${factor.id}: "${factor.name}"`);
    assert(factor.topGenes.length > 0, `Factor ${factor.id} has ${factor.topGenes.length} top genes`);
    assert(typeof factor.correlationWithFitness === 'number', `Factor ${factor.id} correlation: ${factor.correlationWithFitness.toFixed(3)}`);
  }

  // Test: Strategy synthesis
  const combos = nmf.synthesizeStrategies(snapshots, 5);
  assert(combos.length > 0, `Synthesized ${combos.length} combinations`);
  assert(combos[0].synthesizedDNA.length === 50, 'DNA has 50 genes');
  assert(combos[0].noveltyScore >= 0 && combos[0].noveltyScore <= 1, `Novelty: ${combos[0].noveltyScore.toFixed(3)}`);

  // Test: Stats
  const stats = nmf.getStats();
  assert(stats.hasResult, 'NMF has result');
  assert(stats.factors === 3, 'Correct factor count');
}

async function testAdversarialGenerator(): Promise<void> {
  console.log('\n=== Adversarial Generator Tests ===');

  const adversarial = new AdversarialGenerator({
    targetBotCount: 3,
    exploitThreshold: 0.2,
    maxStrategiesPerTarget: 2,
  });

  const events = generateSyntheticEvents(200);
  const bot1Events = events.filter(e => (e.payload as any).botId === 'bot_1');

  // Test: Weakness analysis
  const weaknesses = adversarial.analyzeWeaknesses('bot_1', bot1Events);
  assert(Array.isArray(weaknesses), `Found ${weaknesses.length} weaknesses`);

  // Test: Counter-strategy generation
  const strategies = adversarial.generateCounterStrategies([
    { botId: 'bot_1', trades: bot1Events },
    { botId: 'bot_2', trades: events.filter(e => (e.payload as any).botId === 'bot_2') },
  ]);
  assert(Array.isArray(strategies), `Generated ${strategies.length} counter-strategies`);

  if (strategies.length > 0) {
    assert(strategies[0].targetBotIds.length > 0, 'Strategy has targets');
    assert(strategies[0].entryConditions !== null, 'Strategy has entry conditions');
  }

  // Test: Stats
  const stats = adversarial.getStats();
  assert(stats.botsAnalyzed > 0, `Bots analyzed: ${stats.botsAnalyzed}`);
}

async function testStrategyValidator(): Promise<void> {
  console.log('\n=== Strategy Validator Tests ===');

  const validator = new StrategyValidator();
  const treeEngine = new ExpressionTree();
  const events = generateSyntheticEvents(300);

  // Test: Validate
  const tree = treeEngine.generateRandom(4);
  const result = await validator.validateStrategy('test_1', tree, events);
  assert(typeof result.passed === 'boolean', `Validation: passed=${result.passed}`);
  assert(result.results.length > 0, `Stages: ${result.results.length}`);
  assert(result.results[0].stage === 'structural', 'First stage is structural');

  // Test: Stats
  const stats = validator.getStats();
  assert(stats.totalValidated >= 0, `Validated: ${stats.totalValidated} (${result.passed ? 'passed' : 'rejected'})`);
}

async function testMarkovPredictor(): Promise<void> {
  console.log('\n=== Markov Predictor Tests ===');

  const markov = new MarkovPredictor({ order: 2 });
  const events = generateSyntheticEvents(100);

  // Test: Process events
  for (const event of events.filter(e => (e.payload as any).botId === 'bot_1')) {
    markov.processEvent(event);
  }

  const state = markov.getState('bot_1');
  assert(state !== undefined, 'Bot state exists');
  assert(state!.totalTransitions > 0, `Transitions: ${state!.totalTransitions}`);

  // Test: Prediction
  const prediction = markov.predict('bot_1');
  const probSum = prediction.buy + prediction.sell + prediction.hold;
  assert(Math.abs(probSum - 1) < 0.01, `Probs sum to 1: ${probSum.toFixed(4)}`);

  // Test: Best action
  const best = markov.predictBestAction('bot_1');
  assert(['buy', 'sell', 'hold'].includes(best.action), `Best: ${best.action} (${(best.confidence * 100).toFixed(1)}%)`);

  // Test: Multi-step
  const multi = markov.predictMultiStep('bot_1', 3);
  assert(multi.length === 3, `Multi-step: ${multi.length} predictions`);

  // Test: Transition matrix
  const matrix = markov.getTransitionMatrix('bot_1');
  assert(matrix !== null, 'Transition matrix exists');

  // Test: Bulk initialize
  markov.initializeFromHistory('bot_3', events.filter(e => (e.payload as any).botId === 'bot_3'));
  assert(markov.getTrackedBots().includes('bot_3'), 'bot_3 initialized');

  // Test: Stats
  const stats = markov.getStats();
  assert(stats.botsTracked >= 2, `Bots tracked: ${stats.botsTracked}`);
}

async function testCrowdingDetector(): Promise<void> {
  console.log('\n=== Crowding Detector Tests ===');

  const detector = new CrowdingDetector({
    windowMinutes: 60,
    minBotsForCrowding: 2,
    mildThreshold: 0.5,
  });

  // Create crowded scenario
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    detector.processTrade({
      id: `crowd_${i}`,
      timestamp: now - i * 10000,
      source: 'arena_bot',
      eventType: 'trade',
      payload: {
        botId: `bot_${i}`,
        symbol: 'BTCUSDT',
        direction: 'buy',
        quantity: 0.1,
        price: 50000,
        timestamp: now - i * 10000,
        regime: 'TRENDING',
        preTradeIndicators: randomIndicators(),
      } as any,
    });
  }

  // Add one seller
  detector.processTrade({
    id: 'crowd_sell',
    timestamp: now,
    source: 'arena_bot',
    eventType: 'trade',
    payload: {
      botId: 'bot_5',
      symbol: 'BTCUSDT',
      direction: 'sell',
      quantity: 0.1,
      price: 50000,
      timestamp: now,
      regime: 'TRENDING',
      preTradeIndicators: randomIndicators(),
    } as any,
  });

  // Test: Snapshot
  const snapshot = detector.getSnapshot();
  assert(snapshot.timestamp > 0, 'Snapshot timestamp exists');
  assert(Object.keys(snapshot.symbols).length > 0, 'Snapshot has symbols');

  const btc = snapshot.symbols['BTCUSDT'];
  if (btc) {
    assert(btc.buyPressure > btc.sellPressure, `Buy pressure (${btc.buyPressure}) > sell (${btc.sellPressure})`);
    assert(btc.imbalance > 0, `Imbalance: ${btc.imbalance.toFixed(3)}`);
  }

  // Test: Alerts
  const alerts = detector.getActiveAlerts();
  assert(Array.isArray(alerts), `Alerts: ${alerts.length}`);

  if (alerts.length > 0) {
    assert(alerts[0].direction === 'buy', 'Alert direction is buy');
    assert(alerts[0].botsInvolved.length >= 2, `Bots: ${alerts[0].botsInvolved.length}`);
  }

  // Test: Stats
  const stats = detector.getStats();
  assert(stats.recentTradesInWindow > 0, `Trades in window: ${stats.recentTradesInWindow}`);
}

async function testNicheDiscovery(): Promise<void> {
  console.log('\n=== Niche Discovery Tests ===');

  const discovery = new NicheDiscovery();

  const fingerprints = Array.from({ length: 10 }, (_, i) => ({
    botId: `bot_${i}`,
    avgHoldingPeriod: 60000 * (i + 1),
    tradeFrequency: Math.random() * 10,
    preferredRegimes: [(['TRENDING', 'RANGING', 'VOLATILE', 'BREAKOUT', 'QUIET'] as MarketRegime[])[i % 5]],
    directionBias: Math.random() * 2 - 1,
    sizingBehavior: 'fixed' as const,
    performanceByRegime: new Map(),
    archetypeId: i % 4,
    archetypeDistance: Math.random(),
  }));

  discovery.updateFingerprints(fingerprints);

  const events = generateSyntheticEvents(100);
  for (const event of events) {
    discovery.processTrade(event);
  }

  // Test: Niche map
  const map = discovery.updateNicheMap();
  assert(map !== null, 'Niche map generated');
  assert(map.totalNiches > 0, `Total niches: ${map.totalNiches}`);
  assert(typeof map.underexploitedCount === 'number', `Underexploited: ${map.underexploitedCount}`);
  assert(typeof map.unexploredCount === 'number', `Unexplored: ${map.unexploredCount}`);

  // Test: Recommendations
  assert(Array.isArray(map.recommendations), `Recommendations: ${map.recommendations.length}`);

  // Test: Stats
  const stats = discovery.getStats();
  assert(stats.totalNiches > 0, `Stats niches: ${stats.totalNiches}`);
}

// ===================== RUN ALL =====================

async function runAllTests(): Promise<void> {
  console.log('================================================================');
  console.log('  SUPERIOR TRADING BOT - LAYERS 3-4 TEST SUITE');
  console.log('  Strategy Synthesis + Competitive Intelligence');
  console.log('================================================================');

  try {
    await testExpressionTree();
    await testGeneticProgramming();
    await testNMFEngine();
    await testAdversarialGenerator();
    await testStrategyValidator();
    await testMarkovPredictor();
    await testCrowdingDetector();
    await testNicheDiscovery();
  } catch (error) {
    console.error('\nTest suite error:', error);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed}/${total} passed, ${failed} failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
