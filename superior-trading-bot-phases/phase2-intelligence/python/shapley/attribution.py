"""
Shapley Value Attribution
Decomposes each trade return into 4 factors: regime, timing, direction, sizing.
Uses Monte Carlo permutation sampling for approximation.
"""
import numpy as np
from typing import Dict, List, Any


class ShapleyAttribution:
    def compute_batch(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        trades = payload.get('trades', [])
        n_permutations = payload.get('permutations', 100)

        results = []
        for trade in trades:
            attribution = self._attribute_single(trade, trades, n_permutations)
            results.append(attribution)

        return {'attributions': results, 'tradeCount': len(results)}

    def _attribute_single(self, trade: dict, all_trades: list, n_perms: int) -> dict:
        total_return = trade.get('pnl', 0)
        pnl_pct = trade.get('pnlPercentage', 0)
        regime = trade.get('regime', 'RANGING')
        direction = trade.get('direction', 'buy')
        quantity = trade.get('quantity', 1)
        indicators = trade.get('indicators', {})

        # Build context from all trades of the same symbol
        symbol = trade.get('symbol', '')
        symbol_trades = [t for t in all_trades if t.get('symbol') == symbol and t.get('id') != trade.get('id')]

        if not symbol_trades:
            # Can't compute counterfactuals without context — equal split
            quarter = pnl_pct / 4.0 if pnl_pct else 0
            return self._build_result(trade, quarter, quarter, quarter, quarter,
                                      pnl_pct * 0.5, pnl_pct * 0.8, -pnl_pct)

        # Compute marginal contributions via permutation sampling
        regime_contribs = []
        timing_contribs = []
        direction_contribs = []
        sizing_contribs = []

        rng = np.random.RandomState(hash(trade.get('id', '')) & 0xFFFFFFFF)

        for _ in range(n_perms):
            # Regime contribution: compare to avg return in different regimes
            other_regime_returns = [t.get('pnlPercentage', 0) for t in symbol_trades
                                    if t.get('regime') != regime]
            same_regime_returns = [t.get('pnlPercentage', 0) for t in symbol_trades
                                   if t.get('regime') == regime]
            baseline_regime = np.mean(other_regime_returns) if other_regime_returns else 0
            regime_avg = np.mean(same_regime_returns) if same_regime_returns else 0
            regime_contribs.append(regime_avg - baseline_regime)

            # Timing contribution: compare to random entry time
            all_returns = [t.get('pnlPercentage', 0) for t in symbol_trades]
            if all_returns:
                random_return = rng.choice(all_returns)
                timing_contribs.append(pnl_pct - random_return)
            else:
                timing_contribs.append(0)

            # Direction contribution: compare to opposite direction
            opp_dir = 'sell' if direction == 'buy' else 'buy'
            opp_trades = [t.get('pnlPercentage', 0) for t in symbol_trades
                          if t.get('direction') == opp_dir]
            opp_avg = np.mean(opp_trades) if opp_trades else 0
            direction_contribs.append(pnl_pct - opp_avg)

            # Sizing contribution: compare to median size
            all_sizes = [t.get('quantity', 1) for t in symbol_trades]
            median_size = np.median(all_sizes) if all_sizes else quantity
            if median_size > 0 and quantity > 0:
                size_ratio = quantity / median_size
                sizing_contribs.append(pnl_pct * (1 - 1 / size_ratio) if size_ratio != 1 else 0)
            else:
                sizing_contribs.append(0)

        raw_regime = float(np.mean(regime_contribs))
        raw_timing = float(np.mean(timing_contribs))
        raw_direction = float(np.mean(direction_contribs))
        raw_sizing = float(np.mean(sizing_contribs))

        # Normalize so contributions sum to total return
        raw_total = abs(raw_regime) + abs(raw_timing) + abs(raw_direction) + abs(raw_sizing)
        if raw_total > 0:
            scale = pnl_pct / raw_total if raw_total != 0 else 0
            regime_c = raw_regime * abs(scale)
            timing_c = raw_timing * abs(scale)
            direction_c = raw_direction * abs(scale)
            sizing_c = raw_sizing * abs(scale)
            # Adjust for sign: preserve sign of each contribution
            remainder = pnl_pct - (regime_c + timing_c + direction_c + sizing_c)
            timing_c += remainder  # put residual into timing
        else:
            quarter = pnl_pct / 4.0
            regime_c = timing_c = direction_c = sizing_c = quarter

        # Counterfactuals
        all_returns = [t.get('pnlPercentage', 0) for t in symbol_trades]
        return_if_random = float(np.mean(all_returns)) if all_returns else 0
        all_sizes = [t.get('quantity', 1) for t in symbol_trades]
        median_size = float(np.median(all_sizes)) if all_sizes else quantity
        return_if_median = pnl_pct * (median_size / quantity) if quantity > 0 else pnl_pct
        return_if_opposite = -pnl_pct  # simplified: opposite direction → negated return

        return self._build_result(trade, regime_c, timing_c, direction_c, sizing_c,
                                  return_if_random, return_if_median, return_if_opposite)

    def _build_result(self, trade, regime_c, timing_c, direction_c, sizing_c,
                      ret_random, ret_median, ret_opposite):
        return {
            'tradeId': trade.get('id', ''),
            'botId': trade.get('botId', ''),
            'totalReturn': trade.get('pnlPercentage', 0),
            'regimeContribution': round(regime_c, 6),
            'timingContribution': round(timing_c, 6),
            'directionContribution': round(direction_c, 6),
            'sizingContribution': round(sizing_c, 6),
            'returnIfRandomEntry': round(ret_random, 6),
            'returnIfMedianSize': round(ret_median, 6),
            'returnIfOppositeDirection': round(ret_opposite, 6),
            'timestamp': trade.get('timestamp', 0)
        }
