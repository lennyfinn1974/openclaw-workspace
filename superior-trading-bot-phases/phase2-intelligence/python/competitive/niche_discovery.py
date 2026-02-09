"""
Niche Discovery
For each (archetype, regime) cell — classifies as underexploited, overcrowded, unexplored, or balanced.
"""
from typing import Dict, Any, List

REGIMES = ['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE',
           'BREAKOUT_UP', 'BREAKOUT_DOWN', 'EVENT_DRIVEN', 'QUIET']


class NicheDiscovery:
    def analyze(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        archetypes = payload.get('archetypes', [])
        perf_by_bot_regime = payload.get('performanceByBotRegime', {})

        if not archetypes:
            return {'cells': [], 'timestamp': 0}

        total_bots = sum(len(a.get('memberBotIds', [])) for a in archetypes)
        cells = []

        for archetype in archetypes:
            arch_id = archetype.get('id', 0)
            members = archetype.get('memberBotIds', [])

            for regime in REGIMES:
                # Gather performance data for members in this regime
                returns = []
                trade_counts = []
                for bot_id in members:
                    bot_perf = perf_by_bot_regime.get(bot_id, {})
                    regime_perf = bot_perf.get(regime, {})
                    avg_ret = regime_perf.get('avgReturn', 0)
                    tc = regime_perf.get('tradeCount', 0)
                    if tc > 0:
                        returns.append(avg_ret)
                        trade_counts.append(tc)

                bot_count = len(returns)
                total_trades = sum(trade_counts)
                avg_performance = sum(returns) / len(returns) if returns else 0

                # Classification logic
                if bot_count == 0 and total_trades == 0:
                    classification = 'unexplored'
                    opportunity_score = 0.8  # high opportunity — unknown territory
                elif bot_count <= 1 and avg_performance > 0:
                    classification = 'underexploited'
                    opportunity_score = 0.9  # high opportunity — good returns, few players
                elif bot_count >= len(members) * 0.6 and avg_performance < 0:
                    classification = 'overcrowded'
                    opportunity_score = 0.1  # low opportunity — too many, negative returns
                elif bot_count >= len(members) * 0.6:
                    classification = 'overcrowded'
                    opportunity_score = 0.3  # moderate — many players but positive
                elif avg_performance > 0:
                    classification = 'underexploited'
                    opportunity_score = 0.7
                else:
                    classification = 'balanced'
                    opportunity_score = 0.5

                cells.append({
                    'archetypeId': arch_id,
                    'regime': regime,
                    'classification': classification,
                    'botCount': bot_count,
                    'avgPerformance': round(avg_performance, 6),
                    'totalTrades': total_trades,
                    'opportunityScore': round(opportunity_score, 4)
                })

        # Sort by opportunity score descending
        cells.sort(key=lambda c: c['opportunityScore'], reverse=True)

        return {
            'cells': cells,
            'totalCells': len(cells),
            'underexploited': sum(1 for c in cells if c['classification'] == 'underexploited'),
            'overcrowded': sum(1 for c in cells if c['classification'] == 'overcrowded'),
            'unexplored': sum(1 for c in cells if c['classification'] == 'unexplored'),
            'balanced': sum(1 for c in cells if c['classification'] == 'balanced'),
            'timestamp': 0
        }
