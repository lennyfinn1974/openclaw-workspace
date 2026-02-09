/**
 * Expression Tree Engine - Core data structure for Genetic Programming
 * Layer 3: Strategy Synthesis
 *
 * Represents trading strategies as expression trees that can be
 * evolved, crossed over, mutated, and evaluated against market data.
 */

import { EventEmitter } from 'events';
import {
  StrategyNode, NodeType, ExpressionTreeConfig, TreeEvalResult,
  ActionType, IndicatorFunction, ArithmeticOperator, ComparatorOperator,
  LogicalOperator
} from '../types/synthesis';
import { IndicatorSnapshot, MarketRegime } from '../types/core';

// ===================== DEFAULT CONFIG =====================

const DEFAULT_TREE_CONFIG: ExpressionTreeConfig = {
  maxDepth: 7,
  maxNodes: 63,  // 2^7 - 1
  parsimonyCoefficient: 0.001,
  availableIndicators: [
    'RSI', 'MACD_HIST', 'BB_POSITION', 'ATR', 'VOLUME_RATIO',
    'TREND_STRENGTH', 'PRICE_VS_MA50', 'PRICE_VS_MA200',
    'MOMENTUM', 'ROC', 'CCI'
  ],
  constantRange: { min: -100, max: 100 },
  mutationRate: 0.15,
  crossoverRate: 0.7,
};

// ===================== NODE POOLS =====================

const INDICATORS: IndicatorFunction[] = [
  'RSI', 'MACD_HIST', 'BB_POSITION', 'ATR', 'VOLUME_RATIO',
  'TREND_STRENGTH', 'PRICE_VS_MA50', 'PRICE_VS_MA200',
  'MOMENTUM', 'ROC', 'CCI'
];

const ARITHMETIC_OPS: ArithmeticOperator[] = ['ADD', 'SUB', 'MUL', 'DIV', 'MAX', 'MIN', 'ABS'];
const COMPARATORS: ComparatorOperator[] = ['GT', 'LT', 'GTE', 'LTE', 'CROSS_ABOVE', 'CROSS_BELOW'];
const LOGICAL_OPS: LogicalOperator[] = ['AND', 'OR', 'NOT'];
const ACTIONS: ActionType[] = ['BUY', 'SELL', 'HOLD'];

// ===================== HELPER FUNCTIONS =====================

let nodeIdCounter = 0;
function nextNodeId(): string {
  return `n_${++nodeIdCounter}_${Date.now().toString(36)}`;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ===================== EXPRESSION TREE CLASS =====================

export class ExpressionTree {
  private config: ExpressionTreeConfig;

  constructor(config: Partial<ExpressionTreeConfig> = {}) {
    this.config = { ...DEFAULT_TREE_CONFIG, ...config };
  }

  // ===================== TREE GENERATION =====================

  /**
   * Generate a random strategy tree using ramped half-and-half initialization.
   * Half trees use "grow" (variable depth), half use "full" (max depth at leaves).
   */
  generateRandom(maxDepth?: number): StrategyNode {
    const depth = maxDepth || this.config.maxDepth;
    const method = Math.random() < 0.5 ? 'grow' : 'full';
    return this.generateTree(0, depth, method);
  }

  private generateTree(currentDepth: number, maxDepth: number, method: 'grow' | 'full'): StrategyNode {
    // At max depth or leaf decision in grow mode, return terminal
    if (currentDepth >= maxDepth || (method === 'grow' && currentDepth > 1 && Math.random() < 0.3)) {
      return this.generateTerminal(currentDepth);
    }

    // Root level: generate a conditional action tree
    if (currentDepth === 0) {
      return this.generateConditionalAction(currentDepth, maxDepth, method);
    }

    // Internal nodes: operators and comparators
    return this.generateInternalNode(currentDepth, maxDepth, method);
  }

  private generateConditionalAction(depth: number, maxDepth: number, method: 'grow' | 'full'): StrategyNode {
    // Strategy structure: IF condition THEN action
    const condition = this.generateCondition(depth + 1, maxDepth, method);
    const thenAction = this.generateActionNode();
    const elseAction = this.generateActionNode();

    return {
      id: nextNodeId(),
      type: 'logical',
      value: 'IF_THEN_ELSE',
      children: [condition, thenAction, elseAction],
      depth,
    };
  }

  private generateCondition(depth: number, maxDepth: number, method: 'grow' | 'full'): StrategyNode {
    if (depth >= maxDepth - 1) {
      return this.generateSimpleComparison(depth);
    }

    // Compound condition with logical operator
    if (Math.random() < 0.6 && depth < maxDepth - 2) {
      const op = randomElement(LOGICAL_OPS.filter(o => o !== 'NOT'));
      return {
        id: nextNodeId(),
        type: 'logical',
        value: op,
        children: [
          this.generateCondition(depth + 1, maxDepth, method),
          this.generateCondition(depth + 1, maxDepth, method),
        ],
        depth,
      };
    }

    return this.generateSimpleComparison(depth);
  }

  private generateSimpleComparison(depth: number): StrategyNode {
    const comparator = randomElement(COMPARATORS);
    const indicator = this.generateIndicatorNode(depth + 1);
    const threshold = this.generateConstantNode(depth + 1);

    return {
      id: nextNodeId(),
      type: 'comparator',
      value: comparator,
      children: [indicator, threshold],
      depth,
    };
  }

  private generateIndicatorNode(depth: number): StrategyNode {
    const indicator = randomElement(INDICATORS);
    const params: Record<string, number> = {};

    // Add period parameter for applicable indicators
    if (['RSI', 'ATR', 'CCI', 'MOMENTUM', 'ROC'].includes(indicator)) {
      params.period = Math.floor(randomFloat(5, 50));
    }

    return {
      id: nextNodeId(),
      type: 'indicator',
      value: indicator,
      params,
      depth,
    };
  }

  private generateConstantNode(depth: number): StrategyNode {
    const value = Math.round(randomFloat(this.config.constantRange.min, this.config.constantRange.max) * 100) / 100;
    return {
      id: nextNodeId(),
      type: 'constant',
      value: String(value),
      depth,
    };
  }

  private generateActionNode(): StrategyNode {
    const action = randomElement(ACTIONS);
    const params: Record<string, number> = {
      confidence: Math.round(randomFloat(0.3, 1.0) * 100) / 100,
    };

    return {
      id: nextNodeId(),
      type: 'action',
      value: action,
      params,
    };
  }

  private generateTerminal(depth: number): StrategyNode {
    return Math.random() < 0.7
      ? this.generateIndicatorNode(depth)
      : this.generateConstantNode(depth);
  }

  private generateInternalNode(depth: number, maxDepth: number, method: 'grow' | 'full'): StrategyNode {
    const roll = Math.random();

    if (roll < 0.4) {
      // Arithmetic operation on indicators
      const op = randomElement(ARITHMETIC_OPS.filter(o => o !== 'ABS' && o !== 'NEG'));
      return {
        id: nextNodeId(),
        type: 'operator',
        value: op,
        children: [
          this.generateTree(depth + 1, maxDepth, method),
          this.generateTree(depth + 1, maxDepth, method),
        ],
        depth,
      };
    } else if (roll < 0.7) {
      // Comparison
      return this.generateSimpleComparison(depth);
    } else {
      // Logical combination
      return this.generateCondition(depth, maxDepth, method);
    }
  }

  // ===================== TREE EVALUATION =====================

  /**
   * Evaluate a strategy tree against current market indicators.
   * Returns the action decision with confidence.
   */
  evaluate(root: StrategyNode, indicators: IndicatorSnapshot, regime: MarketRegime): TreeEvalResult {
    let nodesEvaluated = 0;

    const evalNode = (node: StrategyNode): number | boolean | ActionType => {
      nodesEvaluated++;

      switch (node.type) {
        case 'indicator':
          return this.evalIndicator(node, indicators);

        case 'constant':
          return parseFloat(node.value);

        case 'operator':
          return this.evalArithmetic(node, indicators, evalNode);

        case 'comparator':
          return this.evalComparator(node, indicators, evalNode);

        case 'logical':
          return this.evalLogical(node, indicators, regime, evalNode);

        case 'action':
          return node.value as ActionType;

        default:
          return 0;
      }
    };

    const result = evalNode(root);

    // Interpret root result
    if (typeof result === 'string' && ['BUY', 'SELL', 'HOLD', 'CLOSE'].includes(result)) {
      const actionNode = this.findActionNode(root, result as ActionType);
      return {
        action: result as ActionType,
        confidence: actionNode?.params?.confidence ?? 0.5,
        signalStrength: 1.0,
        nodesEvaluated,
      };
    }

    // Boolean result from condition — map to action
    if (typeof result === 'boolean') {
      return {
        action: result ? 'BUY' : 'HOLD',
        confidence: 0.5,
        signalStrength: result ? 1.0 : 0.0,
        nodesEvaluated,
      };
    }

    // Numeric result — threshold to action
    const numResult = Number(result) || 0;
    let action: ActionType = 'HOLD';
    if (numResult > 0.5) action = 'BUY';
    else if (numResult < -0.5) action = 'SELL';

    return {
      action,
      confidence: Math.min(1.0, Math.abs(numResult)),
      signalStrength: numResult,
      nodesEvaluated,
    };
  }

  private evalIndicator(node: StrategyNode, indicators: IndicatorSnapshot): number {
    const map: Record<string, number> = {
      'RSI': indicators.rsi14,
      'MACD_HIST': indicators.macdHist,
      'BB_POSITION': indicators.bbPosition,
      'ATR': indicators.atr14,
      'VOLUME_RATIO': indicators.volumeRatio,
      'TREND_STRENGTH': indicators.trendStrength,
      'PRICE_VS_MA50': indicators.priceVsMA50,
      'PRICE_VS_MA200': indicators.priceVsMA200,
      'MOMENTUM': indicators.macdHist,     // approximate
      'ROC': indicators.priceVsMA50 * 100, // approximate
      'CCI': (indicators.rsi14 - 50) * 4,  // approximate mapping
      'MFI': indicators.rsi14,             // approximate
    };
    return map[node.value] ?? 0;
  }

  private evalArithmetic(
    node: StrategyNode,
    indicators: IndicatorSnapshot,
    evalNode: (n: StrategyNode) => number | boolean | ActionType
  ): number {
    const children = node.children || [];
    const left = Number(evalNode(children[0])) || 0;
    const right = children[1] ? Number(evalNode(children[1])) || 0 : 0;

    switch (node.value as ArithmeticOperator) {
      case 'ADD': return left + right;
      case 'SUB': return left - right;
      case 'MUL': return left * right;
      case 'DIV': return right !== 0 ? left / right : 0; // protected division
      case 'MAX': return Math.max(left, right);
      case 'MIN': return Math.min(left, right);
      case 'ABS': return Math.abs(left);
      case 'NEG': return -left;
      default: return 0;
    }
  }

  private evalComparator(
    node: StrategyNode,
    indicators: IndicatorSnapshot,
    evalNode: (n: StrategyNode) => number | boolean | ActionType
  ): boolean {
    const children = node.children || [];
    const left = Number(evalNode(children[0])) || 0;
    const right = Number(evalNode(children[1])) || 0;

    switch (node.value as ComparatorOperator) {
      case 'GT': return left > right;
      case 'LT': return left < right;
      case 'GTE': return left >= right;
      case 'LTE': return left <= right;
      case 'EQ': return Math.abs(left - right) < 0.001;
      case 'CROSS_ABOVE': return left > right; // simplified, needs history for true crossover
      case 'CROSS_BELOW': return left < right;
      default: return false;
    }
  }

  private evalLogical(
    node: StrategyNode,
    indicators: IndicatorSnapshot,
    regime: MarketRegime,
    evalNode: (n: StrategyNode) => number | boolean | ActionType
  ): number | boolean | ActionType {
    const children = node.children || [];

    if (node.value === 'IF_THEN_ELSE') {
      const condition = evalNode(children[0]);
      const condBool = typeof condition === 'boolean' ? condition : Number(condition) > 0;
      return condBool ? evalNode(children[1]) : evalNode(children[2]);
    }

    const left = evalNode(children[0]);
    const leftBool = typeof left === 'boolean' ? left : Number(left) > 0;

    switch (node.value as LogicalOperator) {
      case 'AND': {
        const right = evalNode(children[1]);
        const rightBool = typeof right === 'boolean' ? right : Number(right) > 0;
        return leftBool && rightBool;
      }
      case 'OR': {
        const right = evalNode(children[1]);
        const rightBool = typeof right === 'boolean' ? right : Number(right) > 0;
        return leftBool || rightBool;
      }
      case 'NOT':
        return !leftBool;
      case 'XOR': {
        const right = evalNode(children[1]);
        const rightBool = typeof right === 'boolean' ? right : Number(right) > 0;
        return leftBool !== rightBool;
      }
      default:
        return false;
    }
  }

  private findActionNode(node: StrategyNode, action: ActionType): StrategyNode | null {
    if (node.type === 'action' && node.value === action) return node;
    for (const child of node.children || []) {
      const found = this.findActionNode(child, action);
      if (found) return found;
    }
    return null;
  }

  // ===================== GENETIC OPERATORS =====================

  /**
   * Subtree crossover: swap random subtrees between two parents.
   */
  crossover(parent1: StrategyNode, parent2: StrategyNode): [StrategyNode, StrategyNode] {
    const child1 = this.deepClone(parent1);
    const child2 = this.deepClone(parent2);

    const nodes1 = this.getAllNodes(child1);
    const nodes2 = this.getAllNodes(child2);

    // Select crossover points (prefer internal nodes)
    const internalNodes1 = nodes1.filter(n => n.children && n.children.length > 0);
    const internalNodes2 = nodes2.filter(n => n.children && n.children.length > 0);

    if (internalNodes1.length === 0 || internalNodes2.length === 0) {
      return [child1, child2]; // can't cross over leaf-only trees
    }

    const point1 = randomElement(internalNodes1);
    const point2 = randomElement(internalNodes2);

    // Swap subtrees by swapping all properties
    const temp = {
      type: point1.type,
      value: point1.value,
      params: point1.params,
      children: point1.children,
    };

    point1.type = point2.type;
    point1.value = point2.value;
    point1.params = point2.params;
    point1.children = point2.children;

    point2.type = temp.type;
    point2.value = temp.value;
    point2.params = temp.params;
    point2.children = temp.children;

    // Enforce depth limits
    this.pruneToDepth(child1, this.config.maxDepth);
    this.pruneToDepth(child2, this.config.maxDepth);

    return [child1, child2];
  }

  /**
   * Point mutation: randomly modify a single node.
   */
  mutate(tree: StrategyNode): StrategyNode {
    const clone = this.deepClone(tree);
    const nodes = this.getAllNodes(clone);

    if (nodes.length === 0) return clone;

    const target = randomElement(nodes);

    switch (target.type) {
      case 'indicator':
        // Swap to different indicator
        target.value = randomElement(INDICATORS);
        if (target.params?.period) {
          target.params.period = Math.floor(randomFloat(5, 50));
        }
        break;

      case 'constant':
        // Perturb constant value
        const oldVal = parseFloat(target.value);
        const perturbation = randomFloat(-10, 10);
        target.value = String(Math.round((oldVal + perturbation) * 100) / 100);
        break;

      case 'comparator':
        target.value = randomElement(COMPARATORS);
        break;

      case 'operator':
        target.value = randomElement(ARITHMETIC_OPS);
        break;

      case 'logical':
        if (target.value !== 'IF_THEN_ELSE') {
          target.value = randomElement(LOGICAL_OPS);
        }
        break;

      case 'action':
        target.value = randomElement(ACTIONS);
        if (target.params) {
          target.params.confidence = Math.round(randomFloat(0.3, 1.0) * 100) / 100;
        }
        break;
    }

    return clone;
  }

  /**
   * Subtree mutation: replace a random subtree with a new random one.
   */
  subtreeMutate(tree: StrategyNode): StrategyNode {
    const clone = this.deepClone(tree);
    const nodes = this.getAllNodes(clone);
    const internalNodes = nodes.filter(n => n.children && n.children.length > 0);

    if (internalNodes.length === 0) return clone;

    const target = randomElement(internalNodes);
    const currentDepth = this.getNodeDepth(clone, target.id) || 0;
    const remainingDepth = Math.max(2, this.config.maxDepth - currentDepth);

    // Replace with new random subtree
    const newSubtree = this.generateTree(currentDepth, currentDepth + remainingDepth, 'grow');
    target.type = newSubtree.type;
    target.value = newSubtree.value;
    target.params = newSubtree.params;
    target.children = newSubtree.children;

    return clone;
  }

  /**
   * Hoist mutation: replace tree with one of its subtrees (simplification).
   */
  hoistMutate(tree: StrategyNode): StrategyNode {
    const nodes = this.getAllNodes(tree);
    const subtrees = nodes.filter(n => n.children && n.children.length > 0 && n.id !== tree.id);

    if (subtrees.length === 0) return this.deepClone(tree);

    return this.deepClone(randomElement(subtrees));
  }

  // ===================== TREE UTILITIES =====================

  /** Count all nodes in tree */
  countNodes(node: StrategyNode): number {
    let count = 1;
    for (const child of node.children || []) {
      count += this.countNodes(child);
    }
    return count;
  }

  /** Get maximum depth of tree */
  getDepth(node: StrategyNode): number {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(c => this.getDepth(c)));
  }

  /** Get all nodes as flat array */
  getAllNodes(node: StrategyNode): StrategyNode[] {
    const nodes: StrategyNode[] = [node];
    for (const child of node.children || []) {
      nodes.push(...this.getAllNodes(child));
    }
    return nodes;
  }

  /** Deep clone a tree */
  deepClone(node: StrategyNode): StrategyNode {
    return {
      id: nextNodeId(),
      type: node.type,
      value: node.value,
      params: node.params ? { ...node.params } : undefined,
      children: node.children?.map(c => this.deepClone(c)),
      depth: node.depth,
    };
  }

  /** Prune tree to maximum depth, replacing deep subtrees with terminals */
  pruneToDepth(node: StrategyNode, maxDepth: number, currentDepth: number = 0): void {
    if (!node.children) return;

    if (currentDepth >= maxDepth - 1) {
      // Replace children with terminals
      node.children = node.children.map(() => this.generateTerminal(currentDepth + 1));
      return;
    }

    for (const child of node.children) {
      this.pruneToDepth(child, maxDepth, currentDepth + 1);
    }
  }

  /** Get depth of a specific node by ID */
  private getNodeDepth(root: StrategyNode, targetId: string, depth: number = 0): number | null {
    if (root.id === targetId) return depth;
    for (const child of root.children || []) {
      const found = this.getNodeDepth(child, targetId, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }

  /** Semantic equivalence check for pruning redundant comparisons */
  simplify(node: StrategyNode): StrategyNode {
    const clone = this.deepClone(node);
    return this.simplifyNode(clone);
  }

  private simplifyNode(node: StrategyNode): StrategyNode {
    if (!node.children) return node;

    // Recursively simplify children first
    node.children = node.children.map(c => this.simplifyNode(c));

    // Simplify AND with redundant comparisons
    if (node.type === 'logical' && node.value === 'AND') {
      const [left, right] = node.children;
      if (left && right && this.isRedundantComparison(left, right)) {
        return this.selectStricterComparison(left, right);
      }
    }

    // Simplify double NOT
    if (node.type === 'logical' && node.value === 'NOT') {
      const child = node.children[0];
      if (child?.type === 'logical' && child.value === 'NOT') {
        return child.children?.[0] || node;
      }
    }

    // Simplify constant comparisons
    if (node.type === 'comparator' && node.children.every(c => c.type === 'constant')) {
      const left = parseFloat(node.children[0].value);
      const right = parseFloat(node.children[1].value);
      const result = this.evalConstantComparison(node.value as ComparatorOperator, left, right);
      return {
        id: nextNodeId(),
        type: 'constant',
        value: result ? '1' : '0',
      };
    }

    return node;
  }

  private isRedundantComparison(a: StrategyNode, b: StrategyNode): boolean {
    if (a.type !== 'comparator' || b.type !== 'comparator') return false;
    if (!a.children || !b.children) return false;

    // Check if both compare the same indicator to constants
    const aIndicator = a.children[0]?.type === 'indicator' ? a.children[0].value : null;
    const bIndicator = b.children[0]?.type === 'indicator' ? b.children[0].value : null;

    return aIndicator !== null && aIndicator === bIndicator;
  }

  private selectStricterComparison(a: StrategyNode, b: StrategyNode): StrategyNode {
    // If both are GT/GTE on same indicator, keep the higher threshold
    const aThreshold = a.children?.[1]?.type === 'constant' ? parseFloat(a.children[1].value) : 0;
    const bThreshold = b.children?.[1]?.type === 'constant' ? parseFloat(b.children[1].value) : 0;

    if (['GT', 'GTE'].includes(a.value) && ['GT', 'GTE'].includes(b.value)) {
      return aThreshold > bThreshold ? a : b;
    }
    if (['LT', 'LTE'].includes(a.value) && ['LT', 'LTE'].includes(b.value)) {
      return aThreshold < bThreshold ? a : b;
    }

    return a; // fallback: keep first
  }

  private evalConstantComparison(op: ComparatorOperator, left: number, right: number): boolean {
    switch (op) {
      case 'GT': return left > right;
      case 'LT': return left < right;
      case 'GTE': return left >= right;
      case 'LTE': return left <= right;
      case 'EQ': return Math.abs(left - right) < 0.001;
      default: return false;
    }
  }

  // ===================== SERIALIZATION =====================

  /** Serialize tree to human-readable string */
  toString(node: StrategyNode, indent: string = ''): string {
    let result = `${indent}${node.type}:${node.value}`;
    if (node.params) {
      result += `(${Object.entries(node.params).map(([k, v]) => `${k}=${v}`).join(',')})`;
    }
    result += '\n';

    for (const child of node.children || []) {
      result += this.toString(child, indent + '  ');
    }
    return result;
  }

  /** Serialize tree to JSON-safe object */
  serialize(node: StrategyNode): object {
    return {
      id: node.id,
      type: node.type,
      value: node.value,
      params: node.params,
      children: node.children?.map(c => this.serialize(c)),
    };
  }

  /** Deserialize from JSON object */
  deserialize(obj: any): StrategyNode {
    return {
      id: obj.id || nextNodeId(),
      type: obj.type,
      value: obj.value,
      params: obj.params,
      children: obj.children?.map((c: any) => this.deserialize(c)),
    };
  }

  /** Calculate tree complexity score (for parsimony pressure) */
  complexityScore(node: StrategyNode): number {
    const nodeCount = this.countNodes(node);
    const depth = this.getDepth(node);
    const uniqueIndicators = new Set(
      this.getAllNodes(node)
        .filter(n => n.type === 'indicator')
        .map(n => n.value)
    ).size;

    // Penalize large trees but reward indicator diversity
    return (nodeCount * 0.5 + depth * 0.3) - (uniqueIndicators * 0.1);
  }

  /** Check structural validity of tree */
  isValid(node: StrategyNode): boolean {
    if (!node || !node.type || !node.value) return false;

    // Check depth limit
    if (this.getDepth(node) > this.config.maxDepth) return false;

    // Check node count limit
    if (this.countNodes(node) > this.config.maxNodes) return false;

    // Validate children based on node type
    switch (node.type) {
      case 'indicator':
      case 'constant':
        return true; // terminals have no children

      case 'operator':
        return (node.children?.length || 0) >= 1;

      case 'comparator':
        return (node.children?.length || 0) === 2;

      case 'logical':
        if (node.value === 'NOT') return (node.children?.length || 0) === 1;
        if (node.value === 'IF_THEN_ELSE') return (node.children?.length || 0) === 3;
        return (node.children?.length || 0) === 2;

      case 'action':
        return true;

      default:
        return false;
    }
  }
}

export default ExpressionTree;
