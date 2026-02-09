"""
Regime x Archetype Performance Matrix
Builds a matrix showing how each archetype performs across market regimes.
"""
from typing import Dict, Any

REGIMES = ['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE',
           'BREAKOUT_UP', 'BREAKOUT_DOWN', 'EVENT_DRIVEN', 'QUIET']


class RegimeMatrixBuilder:
    def build(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        archetypes = payload.get('archetypes', [])
        bot_perf = payload.get('botPerformanceByRegime', {})

        if not archetypes:
            return {'cells': [], 'archetypeCount': 0, 'regimeCount': len(REGIMES)}

        cells = []
        for archetype in archetypes:
            arch_id = archetype.get('id', 0)
            members = archetype.get('memberBotIds', [])

            for regime in REGIMES:
                returns = []
                win_rates = []
                sharpes = []
                trade_counts = []

                for bot_id in members:
                    bp = bot_perf.get(bot_id, {})
                    rp = bp.get(regime, {})
                    tc = rp.get('tradeCount', 0)
                    if tc > 0:
                        returns.append(rp.get('avgReturn', 0))
                        win_rates.append(rp.get('winRate', 0))
                        sharpes.append(rp.get('sharpe', 0))
                        trade_counts.append(tc)

                total_trades = sum(trade_counts)
                cells.append({
                    'archetypeId': arch_id,
                    'regime': regime,
                    'avgReturn': round(sum(returns) / len(returns), 6) if returns else 0,
                    'winRate': round(sum(win_rates) / len(win_rates), 4) if win_rates else 0,
                    'tradeCount': total_trades,
                    'sharpe': round(sum(sharpes) / len(sharpes), 4) if sharpes else 0
                })

        return {
            'cells': cells,
            'archetypeCount': len(archetypes),
            'regimeCount': len(REGIMES)
        }
