"""
20D Behavioral Feature Vector Extraction
Extracts per-bot behavioral features from trade history.
"""
import numpy as np
from typing import Dict, Any, List

REGIMES = ['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE',
           'BREAKOUT_UP', 'BREAKOUT_DOWN', 'EVENT_DRIVEN', 'QUIET']


class FeatureExtractor:
    def extract(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Extract 20D feature vectors from bot trade histories."""
        bot_trades = payload.get('botTrades', {})
        features = {}

        for bot_id, trades in bot_trades.items():
            if len(trades) < 3:
                continue
            vec = self._extract_bot(trades)
            features[bot_id] = vec

        return {'features': features, 'botCount': len(features), 'dimensions': 20}

    def _extract_bot(self, trades: List[dict]) -> List[float]:
        n = len(trades)
        timestamps = [t.get('timestamp', 0) for t in trades]
        directions = [t.get('direction', 'buy') for t in trades]
        quantities = [t.get('quantity', 1.0) for t in trades]
        regimes = [t.get('regime', 'RANGING') for t in trades]
        pnls = [t.get('pnl', 0.0) for t in trades]
        holding_periods = [t.get('holdingPeriodMinutes', 0.0) for t in trades]
        confidences = [t.get('confidence', 0.5) for t in trades if t.get('confidence') is not None]

        # 1. Trade frequency (trades per hour)
        time_span_hours = (max(timestamps) - min(timestamps)) / 3600000 if n > 1 else 1
        trade_freq = n / max(time_span_hours, 0.001)

        # 2. Avg holding period
        valid_hp = [h for h in holding_periods if h > 0]
        avg_holding = float(np.mean(valid_hp)) if valid_hp else 0

        # 3. Holding period std dev
        hp_std = float(np.std(valid_hp)) if len(valid_hp) > 1 else 0

        # 4. Direction bias (-1 to +1)
        buy_count = sum(1 for d in directions if d == 'buy')
        direction_bias = (2 * buy_count / n) - 1

        # 5. Direction switch rate
        switches = sum(1 for i in range(1, n) if directions[i] != directions[i - 1])
        switch_rate = switches / max(n - 1, 1)

        # 6-7. Position size stats
        avg_size = float(np.mean(quantities))
        size_var = float(np.var(quantities)) if n > 1 else 0

        # 8-11. Regime affinities (fraction of trades in each major regime)
        regime_counts = {}
        for r in regimes:
            regime_counts[r] = regime_counts.get(r, 0) + 1
        trending_up = regime_counts.get('TRENDING_UP', 0) / n
        trending_down = regime_counts.get('TRENDING_DOWN', 0) / n
        ranging = regime_counts.get('RANGING', 0) / n
        volatile = regime_counts.get('VOLATILE', 0) / n

        # 12-15. Indicator entry patterns (averages)
        indicators = [t.get('indicators', {}) for t in trades if t.get('indicators')]
        if indicators:
            avg_rsi = float(np.mean([ind.get('rsi14', 50) for ind in indicators]))
            avg_bb = float(np.mean([ind.get('bbPosition', 0.5) for ind in indicators]))
            avg_macd = float(np.mean([ind.get('macdHist', 0) for ind in indicators]))
            avg_trend = float(np.mean([ind.get('trendStrength', 0) for ind in indicators]))
        else:
            avg_rsi, avg_bb, avg_macd, avg_trend = 50.0, 0.5, 0.0, 0.0

        # 16. Win rate
        trades_with_pnl = [p for p in pnls if p != 0]
        wins = sum(1 for p in trades_with_pnl if p > 0)
        win_rate = wins / max(len(trades_with_pnl), 1)

        # 17. Average return
        avg_return = float(np.mean(pnls)) if pnls else 0

        # 18. Sharpe proxy (mean/std of returns)
        if len(pnls) > 1:
            std_return = float(np.std(pnls))
            sharpe_proxy = avg_return / std_return if std_return > 0 else 0
        else:
            sharpe_proxy = 0

        # 19. Max drawdown (cumulative)
        cum_pnl = np.cumsum(pnls)
        peak = np.maximum.accumulate(cum_pnl)
        drawdowns = peak - cum_pnl
        max_dd = float(np.max(drawdowns)) if len(drawdowns) > 0 else 0

        # 20. Avg confidence
        avg_conf = float(np.mean(confidences)) if confidences else 0.5

        return [
            trade_freq,         # 0
            avg_holding,        # 1
            hp_std,             # 2
            direction_bias,     # 3
            switch_rate,        # 4
            avg_size,           # 5
            size_var,           # 6
            trending_up,        # 7
            trending_down,      # 8
            ranging,            # 9
            volatile,           # 10
            avg_rsi,            # 11
            avg_bb,             # 12
            avg_macd,           # 13
            avg_trend,          # 14
            win_rate,           # 15
            avg_return,         # 16
            sharpe_proxy,       # 17
            max_dd,             # 18
            avg_conf,           # 19
        ]
