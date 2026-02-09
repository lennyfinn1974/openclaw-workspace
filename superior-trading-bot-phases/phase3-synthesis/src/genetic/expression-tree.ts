/**
 * Expression Tree Engine — Core AST data structure for strategy representation.
 *
 * Strategies are expression trees that can be evolved (crossover, mutation),
 * evaluated against market data, and serialized for persistence.
 */

import {
  StrategyNode, NodeType, TreeEvalResult, ActionType,
  IndicatorFunction, ArithmeticOperator, ComparatorOperator,
  LogicalOperator, IndicatorSnapshot, MarketRegime,
} from '../types';

// ===================== NODE POOLS =====================

const INDICATORS: IndicatorFunction[] = [
  'RSI', 'MACD_HIST', 'BB_POSITION', 'ATR', 'VOLUME_RATIO',
  'TREND_STRENGTH', 'PRICE_VS_MA50', 'PRICE_VS_MA200',
  'MOMENTUM', 'ROC', 'CCI',
];

const ARITHMETIC_OPS: ArithmeticOperator[] = ['ADD', 'SUB', 'MUL', 'DIV', 'MAX', 'MIN', 'ABS'];
const COMPARATORS: ComparatorOperator[] = ['GT', 'LT', 'GTE', 'LTE', 'CROSS_ABOVE', 'CROSS_BELOW'];
const LOGICAL_OPS: LogicalOperator[] = ['AND', 'OR', 'NOT'];
const ACTIONS: ActionType[] = ['BUY', 'SELL', 'HOLD'];

let nodeIdCounter = 0;
function nextNodeId(): string { return `n_${++nodeIdCounter}_${Date.now().toString(36)}`; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randFloat(min: number, max: number): number { return min + Math.random() * (max - min); }

export interface ExpressionTreeConfig {
  maxDepth: number;
  maxNodes: number;
  parsimonyCoefficient: number;
  constantRange: { min: number; max: number };
}

const DEFAULTS: ExpressionTreeConfig = {
  maxDepth: 7,
  maxNodes: 63,
  parsimonyCoefficient: 0.001,
  constantRange: { min: -100, max: 100 },
};

export class ExpressionTree {
  private cfg: ExpressionTreeConfig;

  constructor(config: Partial<ExpressionTreeConfig> = {}) {
    this.cfg = { ...DEFAULTS, ...config };
  }

  // ===================== GENERATION =====================

  generateRandom(maxDepth?: number): StrategyNode {
    const d = maxDepth ?? this.cfg.maxDepth;
    return this.genTree(0, d, Math.random() < 0.5 ? 'grow' : 'full');
  }

  private genTree(depth: number, maxD: number, method: 'grow' | 'full'): StrategyNode {
    if (depth >= maxD || (method === 'grow' && depth > 1 && Math.random() < 0.3)) {
      return this.genTerminal(depth);
    }
    if (depth === 0) return this.genConditionalAction(depth, maxD, method);
    return this.genInternal(depth, maxD, method);
  }

  private genConditionalAction(d: number, maxD: number, m: 'grow' | 'full'): StrategyNode {
    return {
      id: nextNodeId(), type: 'logical', value: 'IF_THEN_ELSE', depth: d,
      children: [this.genCondition(d + 1, maxD, m), this.genAction(), this.genAction()],
    };
  }

  private genCondition(d: number, maxD: number, m: 'grow' | 'full'): StrategyNode {
    if (d >= maxD - 1) return this.genComparison(d);
    if (Math.random() < 0.6 && d < maxD - 2) {
      const op = pick(LOGICAL_OPS.filter(o => o !== 'NOT'));
      return {
        id: nextNodeId(), type: 'logical', value: op, depth: d,
        children: [this.genCondition(d + 1, maxD, m), this.genCondition(d + 1, maxD, m)],
      };
    }
    return this.genComparison(d);
  }

  private genComparison(d: number): StrategyNode {
    return {
      id: nextNodeId(), type: 'comparator', value: pick(COMPARATORS), depth: d,
      children: [this.genIndicator(d + 1), this.genConstant(d + 1)],
    };
  }

  private genIndicator(d: number): StrategyNode {
    const ind = pick(INDICATORS);
    const params: Record<string, number> = {};
    if (['RSI', 'ATR', 'CCI', 'MOMENTUM', 'ROC'].includes(ind)) {
      params.period = Math.floor(randFloat(5, 50));
    }
    return { id: nextNodeId(), type: 'indicator', value: ind, params, depth: d };
  }

  private genConstant(d: number): StrategyNode {
    const v = Math.round(randFloat(this.cfg.constantRange.min, this.cfg.constantRange.max) * 100) / 100;
    return { id: nextNodeId(), type: 'constant', value: String(v), depth: d };
  }

  private genAction(): StrategyNode {
    return {
      id: nextNodeId(), type: 'action', value: pick(ACTIONS),
      params: { confidence: Math.round(randFloat(0.3, 1.0) * 100) / 100 },
    };
  }

  private genTerminal(d: number): StrategyNode {
    return Math.random() < 0.7 ? this.genIndicator(d) : this.genConstant(d);
  }

  private genInternal(d: number, maxD: number, m: 'grow' | 'full'): StrategyNode {
    const r = Math.random();
    if (r < 0.4) {
      const op = pick(ARITHMETIC_OPS.filter(o => o !== 'ABS' && o !== 'NEG'));
      return {
        id: nextNodeId(), type: 'operator', value: op, depth: d,
        children: [this.genTree(d + 1, maxD, m), this.genTree(d + 1, maxD, m)],
      };
    }
    if (r < 0.7) return this.genComparison(d);
    return this.genCondition(d, maxD, m);
  }

  // ===================== EVALUATION =====================

  evaluate(root: StrategyNode, indicators: IndicatorSnapshot, regime: MarketRegime): TreeEvalResult {
    let nodesEvaluated = 0;

    const evalNode = (node: StrategyNode): number | boolean | ActionType => {
      nodesEvaluated++;
      switch (node.type) {
        case 'indicator': return this.evalIndicator(node, indicators);
        case 'constant': return parseFloat(node.value);
        case 'operator': return this.evalArithmetic(node, evalNode);
        case 'comparator': return this.evalComparator(node, evalNode);
        case 'logical': return this.evalLogical(node, evalNode);
        case 'action': return node.value as ActionType;
        default: return 0;
      }
    };

    const result = evalNode(root);

    if (typeof result === 'string' && ['BUY', 'SELL', 'HOLD', 'CLOSE'].includes(result)) {
      const an = this.findActionNode(root, result as ActionType);
      return { action: result as ActionType, confidence: an?.params?.confidence ?? 0.5, signalStrength: 1.0, nodesEvaluated };
    }
    if (typeof result === 'boolean') {
      return { action: result ? 'BUY' : 'HOLD', confidence: 0.5, signalStrength: result ? 1.0 : 0.0, nodesEvaluated };
    }
    const n = Number(result) || 0;
    let action: ActionType = 'HOLD';
    if (n > 0.5) action = 'BUY';
    else if (n < -0.5) action = 'SELL';
    return { action, confidence: Math.min(1.0, Math.abs(n)), signalStrength: n, nodesEvaluated };
  }

  private evalIndicator(node: StrategyNode, ind: IndicatorSnapshot): number {
    const map: Record<string, number> = {
      RSI: ind.rsi14, MACD_HIST: ind.macdHist, BB_POSITION: ind.bbPosition,
      ATR: ind.atr14, VOLUME_RATIO: ind.volumeRatio, TREND_STRENGTH: ind.trendStrength,
      PRICE_VS_MA50: ind.priceVsMA50, PRICE_VS_MA200: ind.priceVsMA200,
      MOMENTUM: ind.macdHist, ROC: ind.priceVsMA50 * 100,
      CCI: (ind.rsi14 - 50) * 4, MFI: ind.rsi14,
    };
    return map[node.value] ?? 0;
  }

  private evalArithmetic(node: StrategyNode, evalNode: (n: StrategyNode) => number | boolean | ActionType): number {
    const ch = node.children || [];
    const l = Number(evalNode(ch[0])) || 0;
    const r = ch[1] ? Number(evalNode(ch[1])) || 0 : 0;
    switch (node.value as ArithmeticOperator) {
      case 'ADD': return l + r; case 'SUB': return l - r;
      case 'MUL': return l * r; case 'DIV': return r !== 0 ? l / r : 0;
      case 'MAX': return Math.max(l, r); case 'MIN': return Math.min(l, r);
      case 'ABS': return Math.abs(l); case 'NEG': return -l;
      default: return 0;
    }
  }

  private evalComparator(node: StrategyNode, evalNode: (n: StrategyNode) => number | boolean | ActionType): boolean {
    const ch = node.children || [];
    const l = Number(evalNode(ch[0])) || 0;
    const r = Number(evalNode(ch[1])) || 0;
    switch (node.value as ComparatorOperator) {
      case 'GT': return l > r; case 'LT': return l < r;
      case 'GTE': return l >= r; case 'LTE': return l <= r;
      case 'EQ': return Math.abs(l - r) < 0.001;
      case 'CROSS_ABOVE': return l > r; case 'CROSS_BELOW': return l < r;
      default: return false;
    }
  }

  private evalLogical(node: StrategyNode, evalNode: (n: StrategyNode) => number | boolean | ActionType): number | boolean | ActionType {
    const ch = node.children || [];
    if (node.value === 'IF_THEN_ELSE') {
      const cond = evalNode(ch[0]);
      const condBool = typeof cond === 'boolean' ? cond : Number(cond) > 0;
      return condBool ? evalNode(ch[1]) : evalNode(ch[2]);
    }
    const left = evalNode(ch[0]);
    const lb = typeof left === 'boolean' ? left : Number(left) > 0;
    switch (node.value as LogicalOperator) {
      case 'AND': { const r = evalNode(ch[1]); return lb && (typeof r === 'boolean' ? r : Number(r) > 0); }
      case 'OR': { const r = evalNode(ch[1]); return lb || (typeof r === 'boolean' ? r : Number(r) > 0); }
      case 'NOT': return !lb;
      case 'XOR': { const r = evalNode(ch[1]); return lb !== (typeof r === 'boolean' ? r : Number(r) > 0); }
      default: return false;
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

  crossover(p1: StrategyNode, p2: StrategyNode): [StrategyNode, StrategyNode] {
    const c1 = this.deepClone(p1);
    const c2 = this.deepClone(p2);
    const int1 = this.getAllNodes(c1).filter(n => n.children && n.children.length > 0);
    const int2 = this.getAllNodes(c2).filter(n => n.children && n.children.length > 0);
    if (int1.length === 0 || int2.length === 0) return [c1, c2];

    const pt1 = pick(int1);
    const pt2 = pick(int2);
    const tmp = { type: pt1.type, value: pt1.value, params: pt1.params, children: pt1.children };
    pt1.type = pt2.type; pt1.value = pt2.value; pt1.params = pt2.params; pt1.children = pt2.children;
    pt2.type = tmp.type; pt2.value = tmp.value; pt2.params = tmp.params; pt2.children = tmp.children;

    this.pruneToDepth(c1, this.cfg.maxDepth);
    this.pruneToDepth(c2, this.cfg.maxDepth);
    return [c1, c2];
  }

  mutate(tree: StrategyNode): StrategyNode {
    const clone = this.deepClone(tree);
    const nodes = this.getAllNodes(clone);
    if (nodes.length === 0) return clone;
    const target = pick(nodes);

    switch (target.type) {
      case 'indicator':
        target.value = pick(INDICATORS);
        if (target.params?.period) target.params.period = Math.floor(randFloat(5, 50));
        break;
      case 'constant': {
        const old = parseFloat(target.value);
        target.value = String(Math.round((old + randFloat(-10, 10)) * 100) / 100);
        break;
      }
      case 'comparator': target.value = pick(COMPARATORS); break;
      case 'operator': target.value = pick(ARITHMETIC_OPS); break;
      case 'logical':
        if (target.value !== 'IF_THEN_ELSE') target.value = pick(LOGICAL_OPS);
        break;
      case 'action':
        target.value = pick(ACTIONS);
        if (target.params) target.params.confidence = Math.round(randFloat(0.3, 1.0) * 100) / 100;
        break;
    }
    return clone;
  }

  subtreeMutate(tree: StrategyNode): StrategyNode {
    const clone = this.deepClone(tree);
    const internal = this.getAllNodes(clone).filter(n => n.children && n.children.length > 0);
    if (internal.length === 0) return clone;
    const target = pick(internal);
    const cd = this.getNodeDepth(clone, target.id) || 0;
    const remain = Math.max(2, this.cfg.maxDepth - cd);
    const sub = this.genTree(cd, cd + remain, 'grow');
    target.type = sub.type; target.value = sub.value; target.params = sub.params; target.children = sub.children;
    return clone;
  }

  hoistMutate(tree: StrategyNode): StrategyNode {
    const subs = this.getAllNodes(tree).filter(n => n.children && n.children.length > 0 && n.id !== tree.id);
    if (subs.length === 0) return this.deepClone(tree);
    return this.deepClone(pick(subs));
  }

  // ===================== UTILITIES =====================

  countNodes(node: StrategyNode): number {
    let c = 1;
    for (const ch of node.children || []) c += this.countNodes(ch);
    return c;
  }

  getDepth(node: StrategyNode): number {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(c => this.getDepth(c)));
  }

  getAllNodes(node: StrategyNode): StrategyNode[] {
    const nodes: StrategyNode[] = [node];
    for (const ch of node.children || []) nodes.push(...this.getAllNodes(ch));
    return nodes;
  }

  deepClone(node: StrategyNode): StrategyNode {
    return {
      id: nextNodeId(), type: node.type, value: node.value,
      params: node.params ? { ...node.params } : undefined,
      children: node.children?.map(c => this.deepClone(c)), depth: node.depth,
    };
  }

  pruneToDepth(node: StrategyNode, maxD: number, curD: number = 0): void {
    if (!node.children) return;
    if (curD >= maxD - 1) {
      node.children = node.children.map(() => this.genTerminal(curD + 1));
      return;
    }
    for (const ch of node.children) this.pruneToDepth(ch, maxD, curD + 1);
  }

  private getNodeDepth(root: StrategyNode, targetId: string, d: number = 0): number | null {
    if (root.id === targetId) return d;
    for (const ch of root.children || []) {
      const found = this.getNodeDepth(ch, targetId, d + 1);
      if (found !== null) return found;
    }
    return null;
  }

  complexityScore(node: StrategyNode): number {
    const nc = this.countNodes(node);
    const dp = this.getDepth(node);
    const ui = new Set(this.getAllNodes(node).filter(n => n.type === 'indicator').map(n => n.value)).size;
    return (nc * 0.5 + dp * 0.3) - (ui * 0.1);
  }

  isValid(node: StrategyNode): boolean {
    if (!node || !node.type || !node.value) return false;
    if (this.getDepth(node) > this.cfg.maxDepth) return false;
    if (this.countNodes(node) > this.cfg.maxNodes) return false;
    switch (node.type) {
      case 'indicator': case 'constant': case 'action': return true;
      case 'operator': return (node.children?.length || 0) >= 1;
      case 'comparator': return (node.children?.length || 0) === 2;
      case 'logical':
        if (node.value === 'NOT') return (node.children?.length || 0) === 1;
        if (node.value === 'IF_THEN_ELSE') return (node.children?.length || 0) === 3;
        return (node.children?.length || 0) === 2;
      default: return false;
    }
  }

  toString(node: StrategyNode, indent: string = ''): string {
    let r = `${indent}${node.type}:${node.value}`;
    if (node.params) r += `(${Object.entries(node.params).map(([k, v]) => `${k}=${v}`).join(',')})`;
    r += '\n';
    for (const ch of node.children || []) r += this.toString(ch, indent + '  ');
    return r;
  }

  serialize(node: StrategyNode): object {
    return { id: node.id, type: node.type, value: node.value, params: node.params, children: node.children?.map(c => this.serialize(c)) };
  }

  deserialize(obj: Record<string, unknown>): StrategyNode {
    return {
      id: (obj.id as string) || nextNodeId(), type: obj.type as NodeType, value: obj.value as string,
      params: obj.params as Record<string, number> | undefined,
      children: (obj.children as Record<string, unknown>[])?.map(c => this.deserialize(c)),
    };
  }
}
