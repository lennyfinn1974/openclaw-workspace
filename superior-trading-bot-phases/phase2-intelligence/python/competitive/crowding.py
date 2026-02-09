"""
Crowding Detection
Detects when 60%+ bots converge on same direction for a symbol.
Uses binomial test for statistical significance.
"""
import numpy as np
from scipy import stats
from typing import Dict, Any, List
from collections import defaultdict


class CrowdingDetector:
    def detect(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        recent_trades = payload.get('recentTrades', [])
        window_minutes = payload.get('windowMinutes', 5)
        threshold_ratio = payload.get('thresholdRatio', 0.6)
        total_bots = payload.get('totalBots', 21)

        if not recent_trades:
            return {'alerts': [], 'timestamp': 0}

        now = max(t.get('timestamp', 0) for t in recent_trades)
        window_start = now - (window_minutes * 60 * 1000)

        # Filter to window
        windowed = [t for t in recent_trades if t.get('timestamp', 0) >= window_start]

        # Group by symbol
        symbol_groups: Dict[str, List[dict]] = defaultdict(list)
        for t in windowed:
            symbol_groups[t.get('symbol', 'UNKNOWN')].append(t)

        alerts = []
        for symbol, trades in symbol_groups.items():
            # Deduplicate by botId (take latest trade per bot)
            latest_per_bot: Dict[str, dict] = {}
            for t in sorted(trades, key=lambda x: x.get('timestamp', 0)):
                latest_per_bot[t.get('botId', '')] = t

            bot_trades = list(latest_per_bot.values())
            n_active = len(bot_trades)
            if n_active < 3:
                continue

            # Count directions
            buy_bots = [t.get('botId') for t in bot_trades if t.get('direction') == 'buy']
            sell_bots = [t.get('botId') for t in bot_trades if t.get('direction') == 'sell']

            for direction, bots in [('buy', buy_bots), ('sell', sell_bots)]:
                k = len(bots)
                ratio = k / n_active

                if ratio < threshold_ratio:
                    continue

                # Binomial test: H0 = random (p=0.5), H1 = convergence
                p_value = float(stats.binomtest(k, n_active, 0.5, alternative='greater').pvalue)

                if p_value >= 0.05:
                    continue

                # Severity based on ratio
                if ratio >= 0.9:
                    severity = 'critical'
                elif ratio >= 0.8:
                    severity = 'high'
                elif ratio >= 0.7:
                    severity = 'medium'
                else:
                    severity = 'low'

                alerts.append({
                    'symbol': symbol,
                    'direction': direction,
                    'convergenceRatio': round(ratio, 4),
                    'botIds': bots,
                    'pValue': round(p_value, 6),
                    'severity': severity,
                    'windowMinutes': window_minutes,
                    'activeBots': n_active,
                    'totalBots': total_bots,
                    'timestamp': now
                })

        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        alerts.sort(key=lambda a: severity_order.get(a['severity'], 4))

        return {'alerts': alerts, 'alertCount': len(alerts), 'timestamp': now}
