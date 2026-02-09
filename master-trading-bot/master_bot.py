"""
Master Trading Bot - Adaptive Strategy Framework
Built with Enhanced Sovereign BLD Architecture
Designed to compete against 21 static trading bots

Author: Aries AI Assistant
Date: February 7, 2026
"""

import numpy as np
import pandas as pd
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

# Import our framework components
from regime_detector import MarketRegimeDetector, MarketRegime
from strategy_arsenal import StrategyArsenal
from risk_manager import DynamicRiskManager
from execution_engine import ExecutionEngine
from performance_monitor import PerformanceMonitor
from bot_comparator import BotComparator


class MasterTradingBot:
    """
    Adaptive Master Trading Bot with 8-strategy arsenal and regime detection
    
    Designed to outperform static trading bots through:
    - Real-time market regime detection
    - Dynamic strategy selection
    - Adaptive leverage management
    - Continuous performance optimization
    """
    
    def __init__(
        self,
        capital: float = 100000,
        ict_analyzer: bool = True,
        qullamaggie_sizing: bool = True,
        warsh_shock_detection: bool = True,
        config: Dict = None
    ):
        """Initialize Master Bot with adaptive framework"""
        
        # Core configuration
        self.capital = capital
        self.initial_capital = capital
        self.config = config or self._default_config()
        
        # Initialize framework components
        self.regime_detector = MarketRegimeDetector(
            update_frequency=self.config['regime_update_frequency']
        )
        self.strategy_arsenal = StrategyArsenal(
            ict_analyzer=ict_analyzer,
            qullamaggie_sizing=qullamaggie_sizing,
            warsh_shock=warsh_shock_detection
        )
        self.risk_manager = DynamicRiskManager(
            base_risk=self.config['base_risk_per_trade'],
            max_risk=self.config['max_risk_per_trade'],
            leverage_limits=self.config['leverage_limits']
        )
        self.execution_engine = ExecutionEngine()
        self.performance_monitor = PerformanceMonitor()
        self.bot_comparator = BotComparator()
        
        # Trading state
        self.current_positions = {}
        self.current_regime = MarketRegime.UNCERTAIN
        self.active_strategy = None
        self.last_regime_update = None
        self.last_strategy_switch = None
        
        # Performance tracking
        self.trades_executed = 0
        self.wins = 0
        self.losses = 0
        self.total_pnl = 0.0
        self.max_drawdown = 0.0
        self.regime_switches = 0
        
        # Competition tracking
        self.competitor_bots = []
        self.competitive_mode = False
        
        # Setup logging
        self._setup_logging()
        
        self.logger.info(f"Master Trading Bot initialized with ${capital:,.2f} capital")
        
    def _default_config(self) -> Dict:
        """Default configuration for Master Bot"""
        return {
            "base_risk_per_trade": 0.01,     # 1% base risk per trade
            "max_risk_per_trade": 0.02,      # 2% maximum risk per trade
            "leverage_limits": {
                "trending": 2.0,      # 2:1 leverage in trending markets
                "volatile": 1.5,      # 1.5:1 leverage in volatile markets
                "ranging": 1.5,       # 1.5:1 leverage in ranging markets
                "event_driven": 1.0,  # 1:1 leverage during events
                "uncertain": 1.0      # 1:1 leverage when uncertain
            },
            "regime_update_frequency": 60,    # Update regime every 60 seconds
            "strategy_switch_cooldown": 300,  # 5 minutes between strategy switches
            "max_positions": 5,               # Maximum concurrent positions
            "correlation_limit": 0.7,         # Maximum position correlation
            "stop_loss_buffer": 1.5,          # Stop loss ATR multiple
            "take_profit_multiple": 2.0       # Risk/reward ratio
        }
    
    def _setup_logging(self):
        """Setup comprehensive logging system"""
        self.logger = logging.getLogger('MasterBot')
        self.logger.setLevel(logging.INFO)
        
        # Create file handler
        handler = logging.FileHandler(f'master_bot_{datetime.now().strftime("%Y%m%d")}.log')
        handler.setLevel(logging.INFO)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        
        self.logger.addHandler(handler)
    
    def start_competitive_mode(self, competitor_bots: int = 21):
        """Start competitive trading mode against static bots"""
        self.competitive_mode = True
        self.competitor_bots = [f"StaticBot_{i+1}" for i in range(competitor_bots)]
        
        self.logger.info(f"Starting competitive mode against {competitor_bots} static bots")
        self.bot_comparator.initialize_competition(self.competitor_bots)
        
        # Start main trading loop
        self._main_trading_loop()
    
    def _main_trading_loop(self):
        """Main adaptive trading loop with regime detection and strategy switching"""
        
        self.logger.info("Master Bot main trading loop started")
        
        while True:
            try:
                # Step 1: Update market regime
                self._update_market_regime()
                
                # Step 2: Select optimal strategy for current regime
                self._select_optimal_strategy()
                
                # Step 3: Scan for trading opportunities
                opportunities = self._scan_opportunities()
                
                # Step 4: Evaluate and execute trades
                for opportunity in opportunities:
                    self._evaluate_and_execute_trade(opportunity)
                
                # Step 5: Manage existing positions
                self._manage_positions()
                
                # Step 6: Update performance metrics
                self._update_performance_metrics()
                
                # Step 7: Compare against competitor bots
                if self.competitive_mode:
                    self._update_competition_metrics()
                
                # Brief pause before next iteration
                time.sleep(1)
                
            except KeyboardInterrupt:
                self.logger.info("Trading loop interrupted by user")
                break
            except Exception as e:
                self.logger.error(f"Error in main trading loop: {e}")
                time.sleep(5)  # Brief pause on error
    
    def _update_market_regime(self):
        """Update current market regime using detection system"""
        
        # Check if update is needed
        now = datetime.now()
        if (self.last_regime_update and 
            (now - self.last_regime_update).seconds < self.config['regime_update_frequency']):
            return
        
        # Detect current regime
        new_regime = self.regime_detector.detect_current_regime()
        
        # Check for regime change
        if new_regime != self.current_regime:
            self.logger.info(f"Market regime changed: {self.current_regime} -> {new_regime}")
            self.current_regime = new_regime
            self.regime_switches += 1
            
            # Strategy may need to change with regime
            self._trigger_strategy_reevaluation()
        
        self.last_regime_update = now
    
    def _select_optimal_strategy(self):
        """Select optimal strategy based on current market regime"""
        
        # Check strategy switch cooldown
        now = datetime.now()
        if (self.last_strategy_switch and 
            (now - self.last_strategy_switch).seconds < self.config['strategy_switch_cooldown']):
            return
        
        # Get optimal strategy for current regime
        optimal_strategy = self.strategy_arsenal.get_optimal_strategy(
            regime=self.current_regime,
            current_strategy=self.active_strategy
        )
        
        # Switch strategy if different and beneficial
        if optimal_strategy != self.active_strategy:
            self.logger.info(f"Strategy switch: {self.active_strategy} -> {optimal_strategy}")
            self.active_strategy = optimal_strategy
            self.last_strategy_switch = now
    
    def _trigger_strategy_reevaluation(self):
        """Force strategy reevaluation after regime change"""
        self.last_strategy_switch = None  # Reset cooldown
        self._select_optimal_strategy()
    
    def _scan_opportunities(self) -> List[Dict]:
        """Scan for trading opportunities using active strategy"""
        
        if not self.active_strategy:
            return []
        
        # Get opportunities from strategy arsenal
        opportunities = self.strategy_arsenal.scan_opportunities(
            strategy=self.active_strategy,
            regime=self.current_regime,
            current_positions=self.current_positions
        )
        
        return opportunities
    
    def _evaluate_and_execute_trade(self, opportunity: Dict):
        """Evaluate trade opportunity and execute if viable"""
        
        try:
            # Risk management evaluation
            risk_assessment = self.risk_manager.evaluate_trade(
                opportunity=opportunity,
                current_capital=self.capital,
                current_positions=self.current_positions,
                market_regime=self.current_regime
            )
            
            if not risk_assessment['approved']:
                self.logger.debug(f"Trade rejected: {risk_assessment['reason']}")
                return
            
            # Execute trade
            execution_result = self.execution_engine.execute_trade(
                opportunity=opportunity,
                risk_assessment=risk_assessment
            )
            
            if execution_result['success']:
                # Update position tracking
                position_id = execution_result['position_id']
                self.current_positions[position_id] = {
                    'opportunity': opportunity,
                    'risk_assessment': risk_assessment,
                    'execution_result': execution_result,
                    'entry_time': datetime.now(),
                    'strategy': self.active_strategy,
                    'regime': self.current_regime
                }
                
                self.trades_executed += 1
                self.logger.info(f"Trade executed: {execution_result}")
                
        except Exception as e:
            self.logger.error(f"Error evaluating/executing trade: {e}")
    
    def _manage_positions(self):
        """Manage existing positions with dynamic stops and targets"""
        
        positions_to_close = []
        
        for position_id, position in self.current_positions.items():
            try:
                # Get current position status
                current_status = self.execution_engine.get_position_status(position_id)
                
                # Check for stop loss or take profit
                if current_status['should_close']:
                    close_result = self.execution_engine.close_position(position_id)
                    
                    if close_result['success']:
                        # Update performance tracking
                        pnl = close_result['pnl']
                        self.total_pnl += pnl
                        
                        if pnl > 0:
                            self.wins += 1
                        else:
                            self.losses += 1
                        
                        positions_to_close.append(position_id)
                        self.logger.info(f"Position closed: {close_result}")
                
            except Exception as e:
                self.logger.error(f"Error managing position {position_id}: {e}")
        
        # Remove closed positions
        for position_id in positions_to_close:
            del self.current_positions[position_id]
    
    def _update_performance_metrics(self):
        """Update comprehensive performance metrics"""
        
        # Calculate current performance
        current_capital = self.capital + self.total_pnl
        total_return = (current_capital / self.initial_capital - 1) * 100
        
        # Update drawdown
        if current_capital < self.initial_capital:
            drawdown = (1 - current_capital / self.initial_capital) * 100
            self.max_drawdown = max(self.max_drawdown, drawdown)
        
        # Update performance monitor
        self.performance_monitor.update_metrics({
            'total_return': total_return,
            'total_trades': self.trades_executed,
            'wins': self.wins,
            'losses': self.losses,
            'win_rate': self.wins / max(self.trades_executed, 1),
            'total_pnl': self.total_pnl,
            'max_drawdown': self.max_drawdown,
            'current_regime': self.current_regime.value,
            'active_strategy': self.active_strategy,
            'regime_switches': self.regime_switches,
            'open_positions': len(self.current_positions)
        })
    
    def _update_competition_metrics(self):
        """Update competitive performance against static bots"""
        
        if not self.competitive_mode:
            return
        
        # Get current performance
        performance = self.performance_monitor.get_current_performance()
        
        # Update bot comparator
        self.bot_comparator.update_master_bot_performance(performance)
        
        # Log competitive status periodically
        if self.trades_executed % 10 == 0:  # Every 10 trades
            ranking = self.bot_comparator.get_current_ranking()
            self.logger.info(f"Competitive ranking: {ranking}")
    
    def get_performance_summary(self) -> Dict:
        """Get comprehensive performance summary"""
        
        current_capital = self.capital + self.total_pnl
        
        return {
            'initial_capital': self.initial_capital,
            'current_capital': current_capital,
            'total_return': (current_capital / self.initial_capital - 1) * 100,
            'total_pnl': self.total_pnl,
            'trades_executed': self.trades_executed,
            'wins': self.wins,
            'losses': self.losses,
            'win_rate': self.wins / max(self.trades_executed, 1) * 100,
            'max_drawdown': self.max_drawdown,
            'current_regime': self.current_regime.value,
            'active_strategy': self.active_strategy,
            'regime_switches': self.regime_switches,
            'open_positions': len(self.current_positions),
            'competitive_ranking': self.bot_comparator.get_current_ranking() if self.competitive_mode else None
        }
    
    def stop_trading(self):
        """Gracefully stop trading and close all positions"""
        
        self.logger.info("Stopping Master Bot trading...")
        
        # Close all open positions
        for position_id in list(self.current_positions.keys()):
            try:
                close_result = self.execution_engine.close_position(position_id)
                if close_result['success']:
                    self.logger.info(f"Position {position_id} closed during shutdown")
            except Exception as e:
                self.logger.error(f"Error closing position {position_id}: {e}")
        
        # Final performance update
        self._update_performance_metrics()
        
        # Get final summary
        final_summary = self.get_performance_summary()
        self.logger.info(f"Final performance summary: {final_summary}")
        
        return final_summary


if __name__ == "__main__":
    # Example usage
    bot = MasterTradingBot(capital=100000)
    
    try:
        # Start competitive mode against 21 static bots
        bot.start_competitive_mode(competitor_bots=21)
    except KeyboardInterrupt:
        print("Bot stopped by user")
    finally:
        summary = bot.stop_trading()
        print(f"Final Summary: {summary}")