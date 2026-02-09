"""
Enhanced Strategy Arsenal for Master Trading Bot
8-Strategy dynamic selection system with Lorentzian ML integration

ENHANCEMENT: Physics-based pattern recognition integrated for
superior strategy selection and trade optimization

Author: Aries AI Assistant
Date: February 7, 2026 (Enhanced February 8, 2026)
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
import logging
from datetime import datetime

import regime_detector
import lorentzian_classifier 
import feature_engineering
import pandas as pd

MarketRegime = regime_detector.MarketRegime


class TradingStrategy(Enum):
    """Available trading strategies"""
    MOMENTUM_BREAKOUT = "momentum_breakout"
    PULLBACK_RETRACEMENT = "pullback_retracement"  
    RANGE_TRADING = "range_trading"
    SCALPING = "scalping"
    MOMENTUM_REVERSAL = "momentum_reversal"
    BREAKDOWN_SHORTS = "breakdown_shorts"
    RESISTANCE_SHORTS = "resistance_shorts"
    MEAN_REVERSION = "mean_reversion"


@dataclass
class TradingOpportunity:
    """Container for trading opportunities with ML enhancement"""
    symbol: str
    strategy: TradingStrategy
    direction: str  # 'LONG' or 'SHORT'
    entry_price: float
    stop_loss: float
    target_price: float
    confidence: float
    risk_reward_ratio: float
    recommended_leverage: float
    market_regime: MarketRegime
    signals: Dict
    timestamp: datetime
    
    # Enhanced ML fields
    ml_confidence: float = 0.0
    ml_pattern_score: float = 0.0
    lorentzian_signal: float = 0.0
    physics_momentum: float = 0.0
    spacetime_alignment: bool = False


class StrategyArsenal:
    """
    Enhanced 8-Strategy Arsenal for Master Trading Bot
    
    Implements the complete research framework with ML enhancement:
    - 4 LONG strategies: Momentum Breakout, Pullback, Range Trading, Scalping  
    - 4 SHORT strategies: Momentum Reversal, Breakdown, Resistance Shorts, Mean Reversion
    - Dynamic strategy selection based on market regime
    - ICT/Qullamaggie/Warsh Shock integration
    - Lorentzian ML pattern recognition enhancement
    - Physics-based trade optimization
    """
    
    def __init__(
        self, 
        ict_analyzer: bool = True,
        qullamaggie_sizing: bool = True, 
        warsh_shock: bool = True,
        enable_ml: bool = True
    ):
        """Initialize enhanced strategy arsenal with ML integration"""
        
        self.ict_analyzer = ict_analyzer
        self.enable_ml = enable_ml
        self.qullamaggie_sizing = qullamaggie_sizing
        self.warsh_shock = warsh_shock
        
        # Initialize Lorentzian ML system
        if self.enable_ml:
            self.lorentzian_classifier = lorentzian_classifier.LorentzianClassifier(neighbors_count=8)
            self.ml_signal_generator = lorentzian_classifier.LorentzianSignalGenerator(self.lorentzian_classifier)
            self.feature_engineer = feature_engineering.FeatureEngineer()
            self.ml_history = []
        
        # Strategy performance tracking
        self.strategy_performance = {strategy: {'wins': 0, 'losses': 0, 'total_pnl': 0.0} 
                                   for strategy in TradingStrategy}
        
        # Strategy-regime mapping (from research)
        self.optimal_strategies = {
            MarketRegime.TRENDING: [
                TradingStrategy.MOMENTUM_BREAKOUT,
                TradingStrategy.PULLBACK_RETRACEMENT
            ],
            MarketRegime.RANGING: [
                TradingStrategy.RANGE_TRADING,
                TradingStrategy.RESISTANCE_SHORTS
            ],
            MarketRegime.VOLATILE: [
                TradingStrategy.SCALPING,
                TradingStrategy.MOMENTUM_REVERSAL
            ],
            MarketRegime.BREAKOUT: [
                TradingStrategy.MOMENTUM_BREAKOUT,
                TradingStrategy.BREAKDOWN_SHORTS
            ],
            MarketRegime.EVENT_DRIVEN: [
                TradingStrategy.MOMENTUM_REVERSAL,
                TradingStrategy.MEAN_REVERSION
            ]
        }
        
        # Leverage limits per strategy (from research framework)
        self.strategy_leverage = {
            TradingStrategy.MOMENTUM_BREAKOUT: 2.0,
            TradingStrategy.PULLBACK_RETRACEMENT: 2.5,
            TradingStrategy.RANGE_TRADING: 1.5,
            TradingStrategy.SCALPING: 3.0,
            TradingStrategy.MOMENTUM_REVERSAL: 2.0,
            TradingStrategy.BREAKDOWN_SHORTS: 2.0,
            TradingStrategy.RESISTANCE_SHORTS: 1.5,
            TradingStrategy.MEAN_REVERSION: 2.0
        }
        
        self.logger = logging.getLogger('StrategyArsenal')
    
    def get_optimal_strategy(
        self, 
        regime: MarketRegime, 
        current_strategy: Optional[TradingStrategy] = None
    ) -> TradingStrategy:
        """
        Get optimal strategy for current market regime
        
        Args:
            regime: Current market regime
            current_strategy: Currently active strategy
            
        Returns:
            Optimal strategy for the regime
        """
        
        # Get strategies suitable for this regime
        suitable_strategies = self.optimal_strategies.get(regime, [])
        
        if not suitable_strategies:
            self.logger.warning(f"No strategies defined for regime {regime}")
            return current_strategy or TradingStrategy.RANGE_TRADING
        
        # If current strategy is suitable, keep it (avoid unnecessary switching)
        if current_strategy in suitable_strategies:
            return current_strategy
        
        # Select best performing strategy for this regime
        best_strategy = self._select_best_performing_strategy(suitable_strategies)
        return best_strategy
    
    def _select_best_performing_strategy(self, strategies: List[TradingStrategy]) -> TradingStrategy:
        """Select best performing strategy from list"""
        
        best_strategy = strategies[0]
        best_score = -float('inf')
        
        for strategy in strategies:
            performance = self.strategy_performance[strategy]
            total_trades = performance['wins'] + performance['losses']
            
            if total_trades == 0:
                # No history, use default ranking
                score = 0.5
            else:
                win_rate = performance['wins'] / total_trades
                avg_pnl = performance['total_pnl'] / total_trades
                score = win_rate * 0.6 + (avg_pnl / 100) * 0.4  # Weighted score
            
            if score > best_score:
                best_score = score
                best_strategy = strategy
        
        return best_strategy
    
    def scan_opportunities(
        self, 
        strategy: TradingStrategy,
        regime: MarketRegime,
        current_positions: Dict,
        symbols: List[str] = None
    ) -> List[TradingOpportunity]:
        """
        Scan for trading opportunities using specified strategy
        
        Args:
            strategy: Trading strategy to use
            regime: Current market regime  
            current_positions: Current open positions
            symbols: List of symbols to scan (default: predefined list)
            
        Returns:
            List of trading opportunities
        """
        
        if symbols is None:
            symbols = self._get_default_symbols()
        
        opportunities = []
        
        for symbol in symbols:
            try:
                # Skip if already have position in this symbol
                if self._has_position_in_symbol(symbol, current_positions):
                    continue
                
                # Get market data for symbol
                market_data = self._get_market_data(symbol)
                
                # Scan using specific strategy
                opportunity = self._scan_strategy_opportunity(
                    strategy, symbol, market_data, regime
                )
                
                if opportunity:
                    opportunities.append(opportunity)
                    
            except Exception as e:
                self.logger.error(f"Error scanning {symbol} with {strategy}: {e}")
        
        # Sort by confidence and risk-reward
        opportunities.sort(key=lambda x: x.confidence * x.risk_reward_ratio, reverse=True)
        
        return opportunities[:5]  # Return top 5 opportunities
    
    def _get_default_symbols(self) -> List[str]:
        """Get default symbols for scanning"""
        return ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META']
    
    def _has_position_in_symbol(self, symbol: str, current_positions: Dict) -> bool:
        """Check if already have position in symbol"""
        for position in current_positions.values():
            if position.get('opportunity', {}).get('symbol') == symbol:
                return True
        return False
    
    def _get_market_data(self, symbol: str) -> Dict:
        """Get market data for symbol (simulated for now)"""
        return {
            'symbol': symbol,
            'price': 100.0 + np.random.randn() * 10,
            'volume': np.random.randint(1000, 10000),
            'price_history': np.random.randn(50) * 5 + 100,
            'volume_history': np.random.randint(500, 5000, 50),
            'timestamp': datetime.now()
        }
    
    def _scan_strategy_opportunity(
        self, 
        strategy: TradingStrategy,
        symbol: str,
        market_data: Dict,
        regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """Enhanced strategy scanning with Lorentzian ML integration"""
        
        # Get base opportunity from traditional strategy scanner
        base_opportunity = self._scan_traditional_strategy(strategy, symbol, market_data, regime)
        
        if not base_opportunity:
            return None
        
        # Enhance with Lorentzian ML analysis
        if self.enable_ml:
            enhanced_opportunity = self._enhance_with_ml_analysis(
                base_opportunity, market_data, symbol
            )
            return enhanced_opportunity
        
        return base_opportunity
    
    def _scan_traditional_strategy(
        self,
        strategy: TradingStrategy,
        symbol: str,
        market_data: Dict,
        regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """Original strategy scanning without ML enhancement"""
        
        # Dispatch to specific strategy scanner
        strategy_scanners = {
            TradingStrategy.MOMENTUM_BREAKOUT: self._scan_momentum_breakout,
            TradingStrategy.PULLBACK_RETRACEMENT: self._scan_pullback_retracement,
            TradingStrategy.RANGE_TRADING: self._scan_range_trading,
            TradingStrategy.SCALPING: self._scan_scalping,
            TradingStrategy.MOMENTUM_REVERSAL: self._scan_momentum_reversal,
            TradingStrategy.BREAKDOWN_SHORTS: self._scan_breakdown_shorts,
            TradingStrategy.RESISTANCE_SHORTS: self._scan_resistance_shorts,
            TradingStrategy.MEAN_REVERSION: self._scan_mean_reversion
        }
        
        scanner = strategy_scanners.get(strategy)
        if not scanner:
            self.logger.error(f"No scanner implemented for strategy {strategy}")
            return None
        
        return scanner(symbol, market_data, regime)
    
    def _enhance_with_ml_analysis(
        self,
        base_opportunity: TradingOpportunity,
        market_data: Dict,
        symbol: str
    ) -> TradingOpportunity:
        """
        Enhance trading opportunity with Lorentzian ML analysis
        
        Uses physics-based pattern recognition to validate and optimize trades
        """
        try:
            # Prepare data for ML analysis
            ml_signals = self._get_ml_signals(market_data, symbol)
            
            # Calculate ML confidence adjustment
            ml_confidence = ml_signals.get('confidence', 0.0)
            ml_signal = ml_signals.get('signal_strength', 0.0)
            physics_momentum = ml_signals.get('physics_momentum', 0.0)
            
            # Determine space-time alignment
            direction_match = self._check_direction_alignment(
                base_opportunity.direction, ml_signal
            )
            
            # Enhanced confidence calculation
            # Combine traditional confidence with ML insights
            original_confidence = base_opportunity.confidence
            
            if direction_match:
                # ML confirms traditional analysis
                enhanced_confidence = min(1.0, original_confidence * (1 + ml_confidence * 0.5))
                ml_bonus = 0.1  # 10% leverage bonus for alignment
            else:
                # ML contradicts traditional analysis - reduce confidence
                enhanced_confidence = original_confidence * (1 - ml_confidence * 0.3)
                ml_bonus = -0.05  # Reduce leverage for contradiction
            
            # Physics-based leverage adjustment
            physics_leverage_bonus = min(0.1, physics_momentum * 0.2)
            
            # Calculate final enhanced values
            final_confidence = max(0.1, min(1.0, enhanced_confidence))
            
            # Adjust leverage based on ML insights
            enhanced_leverage = min(
                self.strategy_leverage[base_opportunity.strategy],
                base_opportunity.recommended_leverage * (1 + ml_bonus + physics_leverage_bonus)
            )
            
            # Create enhanced opportunity
            enhanced_opportunity = TradingOpportunity(
                symbol=base_opportunity.symbol,
                strategy=base_opportunity.strategy,
                direction=base_opportunity.direction,
                entry_price=base_opportunity.entry_price,
                stop_loss=base_opportunity.stop_loss,
                target_price=base_opportunity.target_price,
                confidence=final_confidence,
                risk_reward_ratio=base_opportunity.risk_reward_ratio,
                recommended_leverage=enhanced_leverage,
                market_regime=base_opportunity.market_regime,
                signals=base_opportunity.signals,
                timestamp=base_opportunity.timestamp,
                # Enhanced ML fields
                ml_confidence=ml_confidence,
                ml_pattern_score=ml_signal,
                lorentzian_signal=ml_signal,
                physics_momentum=physics_momentum,
                spacetime_alignment=direction_match
            )
            
            # Log ML enhancement
            self.logger.info(f"ML Enhanced {symbol}: confidence {original_confidence:.2f}->{final_confidence:.2f}, "
                           f"leverage {base_opportunity.recommended_leverage:.2f}->{enhanced_leverage:.2f}, "
                           f"alignment: {direction_match}")
            
            return enhanced_opportunity
            
        except Exception as e:
            self.logger.error(f"Error in ML enhancement for {symbol}: {e}")
            # Return original opportunity if ML enhancement fails
            return base_opportunity
    
    def _get_ml_signals(self, market_data: Dict, symbol: str) -> Dict:
        """Get Lorentzian ML signals for the given market data"""
        try:
            # Convert market data to DataFrame format
            prices = np.array(market_data['price_history'])
            volumes = np.array(market_data.get('volume_history', [1000] * len(prices)))
            
            # Create OHLCV DataFrame (simplified)
            df = pd.DataFrame({
                'open': prices,
                'high': prices * 1.01,
                'low': prices * 0.99,
                'close': prices,
                'volume': volumes
            })
            
            # Get current ML signal
            ml_result = self.ml_signal_generator.get_current_signal(df)
            
            return {
                'confidence': ml_result.get('confidence', 0.0),
                'signal_strength': ml_result.get('signal', 0.0),
                'classification': ml_result.get('classification', 'uncertain'),
                'physics_momentum': self._calculate_physics_momentum_simple(df)
            }
            
        except Exception as e:
            self.logger.error(f"Error getting ML signals for {symbol}: {e}")
            return {
                'confidence': 0.0,
                'signal_strength': 0.0,
                'classification': 'uncertain',
                'physics_momentum': 0.0
            }
    
    def _check_direction_alignment(self, trade_direction: str, ml_signal: float) -> bool:
        """Check if traditional trade direction aligns with ML signal"""
        if trade_direction.upper() == 'LONG':
            return ml_signal > 0.1  # ML suggests bullish
        elif trade_direction.upper() == 'SHORT':
            return ml_signal < -0.1  # ML suggests bearish
        else:
            return False
    
    def _calculate_physics_momentum_simple(self, df: pd.DataFrame) -> float:
        """Simple physics momentum calculation"""
        try:
            if len(df) < 3:
                return 0.0
            
            # Price velocity (rate of change)
            velocity = df['close'].pct_change().iloc[-5:].mean()
            
            # Price acceleration (change in velocity)
            acceleration = df['close'].pct_change().diff().iloc[-3:].mean()
            
            # Combined momentum (like kinetic energy)
            momentum = np.sqrt(velocity**2 + acceleration**2) if not np.isnan(velocity + acceleration) else 0.0
            
            return max(0, min(1, momentum * 100))  # Normalize to 0-1
            
        except Exception:
            return 0.0
    
    # ==================== LONG STRATEGIES ====================
    
    def _scan_momentum_breakout(
        self, symbol: str, data: Dict, regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """LONG: Momentum Breakout Strategy (Trending Markets, 2:1 leverage)"""
        
        prices = np.array(data['price_history'])
        volumes = np.array(data['volume_history'])
        current_price = data['price']
        
        if len(prices) < 20:
            return None
        
        # Find consolidation resistance
        recent_high = np.max(prices[-20:])
        volume_avg = np.mean(volumes[-20:])
        current_volume = data['volume']
        
        # Breakout conditions
        price_breakout = current_price > recent_high * 1.001  # 0.1% above resistance
        volume_confirmation = current_volume > volume_avg * 1.5  # 50% above average
        
        if not (price_breakout and volume_confirmation):
            return None
        
        # Calculate levels
        consolidation_low = np.min(prices[-20:])
        breakout_range = recent_high - consolidation_low
        
        entry_price = current_price
        stop_loss = recent_high * 0.995  # Tight stop below breakout level
        target_price = current_price + (breakout_range * 1.5)  # Measured move
        
        risk_reward = (target_price - entry_price) / (entry_price - stop_loss)
        
        if risk_reward < 1.5:  # Minimum R:R requirement
            return None
        
        confidence = min(0.9, 0.3 + (current_volume / volume_avg) * 0.2 + 
                        (current_price / recent_high - 1) * 100)
        
        return TradingOpportunity(
            symbol=symbol,
            strategy=TradingStrategy.MOMENTUM_BREAKOUT,
            direction='LONG',
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence=confidence,
            risk_reward_ratio=risk_reward,
            recommended_leverage=2.0,
            market_regime=regime,
            signals={
                'breakout_level': recent_high,
                'volume_ratio': current_volume / volume_avg,
                'consolidation_range': breakout_range
            },
            timestamp=datetime.now()
        )
    
    def _scan_pullback_retracement(
        self, symbol: str, data: Dict, regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """LONG: Pullback/Retracement Strategy (Trending Markets, 2-3:1 leverage)"""
        
        prices = np.array(data['price_history'])
        current_price = data['price']
        
        if len(prices) < 30:
            return None
        
        # Identify trend
        sma_short = np.mean(prices[-10:])
        sma_long = np.mean(prices[-30:])
        
        if sma_short <= sma_long:  # Not in uptrend
            return None
        
        # Find recent swing high and low
        recent_high = np.max(prices[-20:])
        recent_low = np.min(prices[-10:])  # More recent low
        
        # Calculate retracement level
        swing_range = recent_high - recent_low
        retracement_38 = recent_high - (swing_range * 0.382)
        retracement_50 = recent_high - (swing_range * 0.500)
        
        # Check if price is in retracement zone and bouncing
        in_retracement_zone = retracement_50 <= current_price <= retracement_38
        bounce_signal = current_price > np.mean(prices[-3:])  # Simple bounce detection
        
        if not (in_retracement_zone and bounce_signal):
            return None
        
        entry_price = current_price
        stop_loss = recent_low * 0.995  # Below recent swing low
        target_price = recent_high * 1.02  # Above previous high
        
        risk_reward = (target_price - entry_price) / (entry_price - stop_loss)
        
        if risk_reward < 1.8:
            return None
        
        confidence = min(0.85, 0.4 + (recent_high / sma_long - 1) * 2)  # Trend strength
        
        return TradingOpportunity(
            symbol=symbol,
            strategy=TradingStrategy.PULLBACK_RETRACEMENT,
            direction='LONG',
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence=confidence,
            risk_reward_ratio=risk_reward,
            recommended_leverage=2.5,
            market_regime=regime,
            signals={
                'retracement_level': (recent_high - current_price) / swing_range,
                'trend_strength': sma_short / sma_long,
                'swing_high': recent_high,
                'swing_low': recent_low
            },
            timestamp=datetime.now()
        )
    
    def _scan_range_trading(
        self, symbol: str, data: Dict, regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """LONG: Range Trading Strategy (Sideways Markets, 1.5:1 leverage)"""
        
        prices = np.array(data['price_history'])
        current_price = data['price']
        
        if len(prices) < 30:
            return None
        
        # Identify range boundaries
        range_high = np.max(prices[-30:])
        range_low = np.min(prices[-30:])
        range_size = range_high - range_low
        
        # Check if it's actually a range (not too wide)
        if range_size / np.mean(prices[-30:]) > 0.1:  # Range too wide
            return None
        
        # Check if near support
        support_zone = range_low + (range_size * 0.1)  # Bottom 10% of range
        near_support = current_price <= support_zone
        
        # Look for bounce signals
        bounce_signal = current_price > np.min(prices[-5:])
        
        if not (near_support and bounce_signal):
            return None
        
        entry_price = current_price
        stop_loss = range_low * 0.995  # Tight stop below support
        target_price = range_high * 0.99  # Near resistance
        
        risk_reward = (target_price - entry_price) / (entry_price - stop_loss)
        
        if risk_reward < 2.0:
            return None
        
        confidence = min(0.8, 0.5 + (support_zone - current_price) / range_size)
        
        return TradingOpportunity(
            symbol=symbol,
            strategy=TradingStrategy.RANGE_TRADING,
            direction='LONG',
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence=confidence,
            risk_reward_ratio=risk_reward,
            recommended_leverage=1.5,
            market_regime=regime,
            signals={
                'range_high': range_high,
                'range_low': range_low,
                'range_position': (current_price - range_low) / range_size,
                'range_size_pct': range_size / np.mean(prices[-30:])
            },
            timestamp=datetime.now()
        )
    
    def _scan_scalping(
        self, symbol: str, data: Dict, regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """LONG: Scalping Strategy (High Volume, 3:1+ leverage)"""
        
        prices = np.array(data['price_history'])
        volumes = np.array(data['volume_history'])
        current_price = data['price']
        current_volume = data['volume']
        
        if len(prices) < 10:
            return None
        
        # Look for micro breakouts with volume spikes
        recent_prices = prices[-10:]
        micro_resistance = np.max(recent_prices[:-2])  # Exclude last 2 candles
        volume_avg = np.mean(volumes[-10:])
        
        # Micro breakout conditions
        micro_breakout = current_price > micro_resistance * 1.0005  # 0.05% breakout
        volume_spike = current_volume > volume_avg * 1.8
        
        if not (micro_breakout and volume_spike):
            return None
        
        # Scalping levels (tight)
        entry_price = current_price
        stop_loss = current_price * 0.9995  # 0.05% stop loss
        target_price = current_price * 1.0015  # 0.15% target (3:1 R:R)
        
        risk_reward = (target_price - entry_price) / (entry_price - stop_loss)
        
        confidence = min(0.75, 0.3 + (current_volume / volume_avg) * 0.2)
        
        return TradingOpportunity(
            symbol=symbol,
            strategy=TradingStrategy.SCALPING,
            direction='LONG',
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence=confidence,
            risk_reward_ratio=risk_reward,
            recommended_leverage=3.0,
            market_regime=regime,
            signals={
                'micro_resistance': micro_resistance,
                'volume_ratio': current_volume / volume_avg,
                'breakout_magnitude': current_price / micro_resistance - 1
            },
            timestamp=datetime.now()
        )
    
    # ==================== SHORT STRATEGIES ====================
    
    def _scan_momentum_reversal(
        self, symbol: str, data: Dict, regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """SHORT: Momentum Reversal Strategy (Overbought Conditions, 2:1 leverage)"""
        
        prices = np.array(data['price_history'])
        volumes = np.array(data['volume_history'])
        current_price = data['price']
        
        if len(prices) < 20:
            return None
        
        # Look for parabolic move exhaustion
        recent_gain = (current_price / prices[-10]) - 1  # 10-period gain
        volume_avg = np.mean(volumes[-10:])
        current_volume = data['volume']
        
        # Parabolic conditions
        parabolic_move = recent_gain > 0.05  # 5% gain in 10 periods
        volume_climax = current_volume > volume_avg * 2.0
        
        # Simple RSI-like overbought
        price_changes = np.diff(prices[-14:])
        gains = price_changes[price_changes > 0]
        losses = np.abs(price_changes[price_changes < 0])
        
        if len(gains) == 0:
            rsi = 0
        elif len(losses) == 0:
            rsi = 100
        else:
            avg_gain = np.mean(gains)
            avg_loss = np.mean(losses)
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
        
        overbought = rsi > 75
        
        if not (parabolic_move and volume_climax and overbought):
            return None
        
        entry_price = current_price
        stop_loss = current_price * 1.02  # 2% above current price
        target_price = current_price * 0.95  # 5% retracement target
        
        risk_reward = (entry_price - target_price) / (stop_loss - entry_price)
        
        if risk_reward < 1.5:
            return None
        
        confidence = min(0.85, 0.4 + recent_gain + (rsi - 75) / 25 * 0.3)
        
        return TradingOpportunity(
            symbol=symbol,
            strategy=TradingStrategy.MOMENTUM_REVERSAL,
            direction='SHORT',
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence=confidence,
            risk_reward_ratio=risk_reward,
            recommended_leverage=2.0,
            market_regime=regime,
            signals={
                'recent_gain': recent_gain,
                'rsi': rsi,
                'volume_ratio': current_volume / volume_avg,
                'parabolic_magnitude': recent_gain
            },
            timestamp=datetime.now()
        )
    
    def _scan_breakdown_shorts(
        self, symbol: str, data: Dict, regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """SHORT: Breakdown Shorts Strategy (Bearish Breakouts, 2:1 leverage)"""
        
        prices = np.array(data['price_history'])
        volumes = np.array(data['volume_history'])
        current_price = data['price']
        
        if len(prices) < 20:
            return None
        
        # Find support level
        support_level = np.min(prices[-20:])
        volume_avg = np.mean(volumes[-20:])
        current_volume = data['volume']
        
        # Breakdown conditions
        breakdown = current_price < support_level * 0.999  # Below support
        volume_confirmation = current_volume > volume_avg * 1.3
        
        if not (breakdown and volume_confirmation):
            return None
        
        # Calculate measured move target
        recent_high = np.max(prices[-20:])
        breakdown_range = recent_high - support_level
        
        entry_price = current_price
        stop_loss = support_level * 1.005  # Above broken support (now resistance)
        target_price = current_price - breakdown_range  # Measured move down
        
        risk_reward = (entry_price - target_price) / (stop_loss - entry_price)
        
        if risk_reward < 1.8:
            return None
        
        confidence = min(0.9, 0.4 + (current_volume / volume_avg) * 0.2)
        
        return TradingOpportunity(
            symbol=symbol,
            strategy=TradingStrategy.BREAKDOWN_SHORTS,
            direction='SHORT',
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence=confidence,
            risk_reward_ratio=risk_reward,
            recommended_leverage=2.0,
            market_regime=regime,
            signals={
                'support_level': support_level,
                'breakdown_magnitude': (support_level - current_price) / support_level,
                'volume_ratio': current_volume / volume_avg,
                'measured_move': breakdown_range
            },
            timestamp=datetime.now()
        )
    
    def _scan_resistance_shorts(
        self, symbol: str, data: Dict, regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """SHORT: Resistance Shorts Strategy (Range rejection, 1.5:1 leverage)"""
        
        prices = np.array(data['price_history'])
        current_price = data['price']
        
        if len(prices) < 30:
            return None
        
        # Identify range
        range_high = np.max(prices[-30:])
        range_low = np.min(prices[-30:])
        range_size = range_high - range_low
        
        # Near resistance
        resistance_zone = range_high - (range_size * 0.1)  # Top 10% of range
        near_resistance = current_price >= resistance_zone
        
        # Look for rejection signals
        rejection_signal = current_price < np.max(prices[-3:])  # Recent high rejection
        
        if not (near_resistance and rejection_signal):
            return None
        
        entry_price = current_price
        stop_loss = range_high * 1.005  # Above resistance
        target_price = range_low * 1.01  # Near support
        
        risk_reward = (entry_price - target_price) / (stop_loss - entry_price)
        
        if risk_reward < 2.0:
            return None
        
        confidence = min(0.8, 0.5 + (current_price - resistance_zone) / range_size)
        
        return TradingOpportunity(
            symbol=symbol,
            strategy=TradingStrategy.RESISTANCE_SHORTS,
            direction='SHORT',
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence=confidence,
            risk_reward_ratio=risk_reward,
            recommended_leverage=1.5,
            market_regime=regime,
            signals={
                'range_high': range_high,
                'range_low': range_low,
                'resistance_distance': (range_high - current_price) / range_size,
                'rejection_magnitude': (np.max(prices[-3:]) - current_price) / current_price
            },
            timestamp=datetime.now()
        )
    
    def _scan_mean_reversion(
        self, symbol: str, data: Dict, regime: MarketRegime
    ) -> Optional[TradingOpportunity]:
        """SHORT: Mean Reversion Strategy (Dead cat bounce shorts, 2:1 leverage)"""
        
        prices = np.array(data['price_history'])
        current_price = data['price']
        
        if len(prices) < 30:
            return None
        
        # Check if in downtrend
        sma_short = np.mean(prices[-10:])
        sma_long = np.mean(prices[-30:])
        
        if sma_short >= sma_long:  # Not in downtrend
            return None
        
        # Find recent bounce to resistance
        recent_low = np.min(prices[-15:])
        bounce_magnitude = (current_price / recent_low) - 1
        
        # Look for bounce to key resistance levels
        key_resistance = np.mean(prices[-30:-15])  # Resistance from earlier period
        near_resistance = abs(current_price - key_resistance) / key_resistance < 0.02
        
        # Dead cat bounce conditions
        weak_bounce = 0.02 <= bounce_magnitude <= 0.08  # 2-8% bounce
        at_resistance = near_resistance
        
        if not (weak_bounce and at_resistance):
            return None
        
        entry_price = current_price
        stop_loss = key_resistance * 1.02  # Above resistance
        target_price = recent_low * 0.98  # Below recent low
        
        risk_reward = (entry_price - target_price) / (stop_loss - entry_price)
        
        if risk_reward < 1.5:
            return None
        
        confidence = min(0.8, 0.3 + bounce_magnitude * 5 + (sma_long / sma_short - 1) * 2)
        
        return TradingOpportunity(
            symbol=symbol,
            strategy=TradingStrategy.MEAN_REVERSION,
            direction='SHORT',
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence=confidence,
            risk_reward_ratio=risk_reward,
            recommended_leverage=2.0,
            market_regime=regime,
            signals={
                'bounce_magnitude': bounce_magnitude,
                'downtrend_strength': sma_long / sma_short - 1,
                'resistance_level': key_resistance,
                'recent_low': recent_low
            },
            timestamp=datetime.now()
        )
    
    def update_strategy_performance(
        self, 
        strategy: TradingStrategy, 
        won: bool, 
        pnl: float
    ):
        """Update strategy performance tracking"""
        
        performance = self.strategy_performance[strategy]
        
        if won:
            performance['wins'] += 1
        else:
            performance['losses'] += 1
        
        performance['total_pnl'] += pnl
        
        self.logger.info(f"Updated performance for {strategy}: {performance}")
    
    def get_strategy_performance(self) -> Dict:
        """Get comprehensive strategy performance statistics"""
        
        performance_summary = {}
        
        for strategy, perf in self.strategy_performance.items():
            total_trades = perf['wins'] + perf['losses']
            win_rate = perf['wins'] / max(total_trades, 1)
            avg_pnl = perf['total_pnl'] / max(total_trades, 1)
            
            performance_summary[strategy.value] = {
                'total_trades': total_trades,
                'wins': perf['wins'],
                'losses': perf['losses'],
                'win_rate': win_rate,
                'total_pnl': perf['total_pnl'],
                'avg_pnl': avg_pnl,
                'max_leverage': self.strategy_leverage[strategy]
            }
        
        return performance_summary
    
    def get_recommended_leverage(
        self, 
        strategy: TradingStrategy, 
        regime: MarketRegime,
        volatility_adjustment: float = 1.0
    ) -> float:
        """Get recommended leverage for strategy considering market conditions"""
        
        base_leverage = self.strategy_leverage[strategy]
        
        # Adjust for market regime
        regime_adjustments = {
            MarketRegime.VOLATILE: 0.75,    # Reduce leverage in volatile markets
            MarketRegime.EVENT_DRIVEN: 0.5, # Very conservative during events
            MarketRegime.UNCERTAIN: 0.5,    # Conservative when uncertain
            MarketRegime.TRENDING: 1.0,     # Full leverage in trends
            MarketRegime.RANGING: 0.85,     # Slightly reduced in ranges
            MarketRegime.BREAKOUT: 1.0      # Full leverage on breakouts
        }
        
        regime_factor = regime_adjustments.get(regime, 1.0)
        adjusted_leverage = base_leverage * regime_factor * volatility_adjustment
        
        return max(1.0, min(adjusted_leverage, 3.0))  # Clamp between 1:1 and 3:1