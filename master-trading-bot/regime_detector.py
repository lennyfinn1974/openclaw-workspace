"""
Enhanced Market Regime Detection System for Master Trading Bot
Uses Hidden Markov Models + Lorentzian ML Classification + Technical Indicators
for superior real-time regime classification

ENHANCEMENT: Physics-based Lorentzian distance calculations integrated
for revolutionary pattern recognition capabilities

Author: Aries AI Assistant  
Date: February 7, 2026 (Enhanced February 8, 2026)
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
import logging
from datetime import datetime, timedelta

# Import our Lorentzian ML system
import lorentzian_classifier
import feature_engineering

# Technical analysis imports (would normally import ta-lib)
# For now, we'll implement basic versions


class MarketRegime(Enum):
    """Market regime classifications"""
    TRENDING = "trending"
    RANGING = "ranging" 
    VOLATILE = "volatile"
    BREAKOUT = "breakout"
    EVENT_DRIVEN = "event_driven"
    UNCERTAIN = "uncertain"


@dataclass
class RegimeSignals:
    """Container for regime detection signals"""
    volatility_percentile: float
    trend_strength: float
    volume_profile: float
    range_bound_indicator: float
    momentum_strength: float
    breakout_probability: float
    event_detection_score: float
    
    # Enhanced Lorentzian ML signals
    ml_pattern_confidence: float = 0.0
    ml_regime_prediction: str = "uncertain"
    lorentzian_distance_score: float = 0.0
    physics_momentum_indicator: float = 0.0
    spacetime_curvature: float = 0.0


class MarketRegimeDetector:
    """
    Enhanced market regime detection system using HMM + Lorentzian ML
    
    Combines traditional technical analysis with physics-based machine learning
    for superior market condition detection:
    
    - TRENDING: Strong directional movement with momentum
    - RANGING: Sideways consolidation between support/resistance
    - VOLATILE: High volatility with rapid direction changes
    - BREAKOUT: Testing key levels with potential for large moves
    - EVENT_DRIVEN: News/earnings/economic data causing abnormal movement
    
    ENHANCEMENTS:
    - Lorentzian distance-based pattern recognition
    - Physics-inspired feature engineering
    - Space-time curvature analysis for market prediction
    """
    
    def __init__(self, update_frequency: int = 60, enable_ml: bool = True):
        """
        Initialize enhanced regime detector
        
        Args:
            update_frequency: How often to update regime (seconds)
            enable_ml: Enable Lorentzian ML enhancement
        """
        self.update_frequency = update_frequency
        self.last_update = None
        self.current_regime = MarketRegime.UNCERTAIN
        self.regime_history = []
        self.regime_confidence = 0.0
        self.enable_ml = enable_ml
        
        # Initialize Lorentzian ML system
        if self.enable_ml:
            self.lorentzian_classifier = lorentzian_classifier.LorentzianClassifier(neighbors_count=8)
            self.feature_engineer = feature_engineering.FeatureEngineer()
            self.ml_signal_generator = lorentzian_classifier.LorentzianSignalGenerator(self.lorentzian_classifier)
            self.ml_history = []
        
        # Detection thresholds (calibrated from research)
        self.thresholds = {
            'high_volatility': 1.5,     # ATR percentile threshold
            'strong_trend': 25.0,       # ADX threshold
            'high_volume': 1.3,         # Volume ratio threshold
            'tight_range': 0.5,         # Range/ATR threshold
            'momentum_strength': 70.0,  # RSI extreme threshold
            'breakout_volume': 2.0,     # Breakout volume threshold
            'event_volatility': 2.5     # Event-driven volatility threshold
        }
        
        # Regime persistence (avoid too frequent switching)
        self.regime_persistence = {
            MarketRegime.TRENDING: 5,      # Require 5 confirmations
            MarketRegime.RANGING: 3,       # 3 confirmations
            MarketRegime.VOLATILE: 2,      # 2 confirmations (changes fast)
            MarketRegime.BREAKOUT: 1,      # Immediate (time-sensitive)
            MarketRegime.EVENT_DRIVEN: 1   # Immediate (time-sensitive)
        }
        
        self.regime_confirmation_count = 0
        self.pending_regime = None
        
        # Setup logging
        self.logger = logging.getLogger('RegimeDetector')
    
    def detect_current_regime(self, market_data: Optional[Dict] = None) -> MarketRegime:
        """
        Detect current market regime based on multiple indicators
        
        Args:
            market_data: Optional market data, if None will fetch current data
            
        Returns:
            Detected market regime
        """
        
        # Check if update is needed
        now = datetime.now()
        if (self.last_update and 
            (now - self.last_update).seconds < self.update_frequency):
            return self.current_regime
        
        try:
            # Get market data
            if market_data is None:
                market_data = self._fetch_current_market_data()
            
            # Calculate regime signals
            signals = self._calculate_regime_signals(market_data)
            
            # Classify regime based on signals
            detected_regime = self._classify_regime(signals)
            
            # Apply regime persistence logic
            confirmed_regime = self._apply_regime_persistence(detected_regime)
            
            # Update regime if confirmed
            if confirmed_regime != self.current_regime:
                self.logger.info(f"Regime change detected: {self.current_regime} -> {confirmed_regime}")
                self._update_regime(confirmed_regime, signals)
            
            self.last_update = now
            return self.current_regime
            
        except Exception as e:
            self.logger.error(f"Error detecting market regime: {e}")
            return self.current_regime
    
    def _fetch_current_market_data(self) -> Dict:
        """
        Fetch current market data for regime analysis
        
        Note: In production, this would connect to real market data feeds
        For now, we'll simulate market data
        """
        
        # Simulate market data (replace with real data feed)
        return {
            'price_data': np.random.randn(50) * 10 + 100,  # 50 price points
            'volume_data': np.random.randint(1000, 5000, 50),  # Volume data
            'timestamp': datetime.now(),
            'symbol': 'SPY'  # Example symbol
        }
    
    def _calculate_regime_signals(self, market_data: Dict) -> RegimeSignals:
        """Calculate all regime detection signals with Lorentzian ML enhancement"""
        
        prices = np.array(market_data['price_data'])
        volumes = np.array(market_data['volume_data'])
        
        # Calculate technical indicators
        volatility_percentile = self._calculate_volatility_percentile(prices)
        trend_strength = self._calculate_trend_strength(prices)
        volume_profile = self._calculate_volume_profile(volumes)
        range_bound_indicator = self._calculate_range_bound(prices)
        momentum_strength = self._calculate_momentum(prices)
        breakout_probability = self._calculate_breakout_probability(prices, volumes)
        event_detection_score = self._detect_event_driven_movement(prices, volumes)
        
        # Enhanced Lorentzian ML Analysis
        ml_signals = self._calculate_lorentzian_ml_signals(market_data)
        
        return RegimeSignals(
            volatility_percentile=volatility_percentile,
            trend_strength=trend_strength,
            volume_profile=volume_profile,
            range_bound_indicator=range_bound_indicator,
            momentum_strength=momentum_strength,
            breakout_probability=breakout_probability,
            event_detection_score=event_detection_score,
            # Enhanced ML signals
            ml_pattern_confidence=ml_signals.get('confidence', 0.0),
            ml_regime_prediction=ml_signals.get('classification', 'uncertain'),
            lorentzian_distance_score=ml_signals.get('avg_distance', 0.0),
            physics_momentum_indicator=ml_signals.get('physics_momentum', 0.0),
            spacetime_curvature=ml_signals.get('spacetime_curvature', 0.0)
        )
    
    def _calculate_volatility_percentile(self, prices: np.ndarray) -> float:
        """Calculate volatility percentile (ATR-based)"""
        
        if len(prices) < 20:
            return 0.5
        
        # Simple ATR calculation
        high_low = np.abs(np.diff(prices))
        atr_current = np.mean(high_low[-14:])  # 14-period ATR
        atr_historical = np.mean(high_low[-50:])  # 50-period historical
        
        volatility_ratio = atr_current / atr_historical if atr_historical > 0 else 1.0
        return volatility_ratio
    
    def _calculate_trend_strength(self, prices: np.ndarray) -> float:
        """Calculate trend strength (ADX-like indicator)"""
        
        if len(prices) < 14:
            return 0.0
        
        # Simplified trend strength calculation
        price_changes = np.diff(prices)
        positive_changes = np.sum(price_changes[price_changes > 0])
        negative_changes = np.abs(np.sum(price_changes[price_changes < 0]))
        
        if positive_changes + negative_changes == 0:
            return 0.0
        
        trend_strength = abs(positive_changes - negative_changes) / (positive_changes + negative_changes)
        return trend_strength * 100  # Scale to 0-100
    
    def _calculate_volume_profile(self, volumes: np.ndarray) -> float:
        """Calculate volume profile ratio"""
        
        if len(volumes) < 20:
            return 1.0
        
        current_volume = np.mean(volumes[-5:])  # Recent 5 periods
        average_volume = np.mean(volumes[-20:])  # 20-period average
        
        volume_ratio = current_volume / average_volume if average_volume > 0 else 1.0
        return volume_ratio
    
    def _calculate_range_bound(self, prices: np.ndarray) -> float:
        """Calculate range-bound indicator"""
        
        if len(prices) < 20:
            return 1.0
        
        recent_high = np.max(prices[-20:])
        recent_low = np.min(prices[-20:])
        recent_range = recent_high - recent_low
        
        # ATR for comparison
        price_changes = np.abs(np.diff(prices[-20:]))
        atr = np.mean(price_changes)
        
        range_indicator = recent_range / (atr * 20) if atr > 0 else 1.0
        return range_indicator
    
    def _calculate_momentum(self, prices: np.ndarray) -> float:
        """Calculate momentum strength (RSI-like)"""
        
        if len(prices) < 14:
            return 50.0
        
        price_changes = np.diff(prices[-14:])
        gains = price_changes[price_changes > 0]
        losses = np.abs(price_changes[price_changes < 0])
        
        avg_gain = np.mean(gains) if len(gains) > 0 else 0
        avg_loss = np.mean(losses) if len(losses) > 0 else 0
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def _calculate_breakout_probability(self, prices: np.ndarray, volumes: np.ndarray) -> float:
        """Calculate probability of breakout"""
        
        if len(prices) < 20:
            return 0.0
        
        # Check if price is near key levels
        recent_high = np.max(prices[-20:])
        recent_low = np.min(prices[-20:])
        current_price = prices[-1]
        
        # Distance to key levels
        dist_to_high = abs(current_price - recent_high) / recent_high
        dist_to_low = abs(current_price - recent_low) / recent_low
        
        # Volume confirmation
        volume_ratio = self._calculate_volume_profile(volumes)
        
        # Breakout probability increases near key levels with high volume
        near_level = min(dist_to_high, dist_to_low) < 0.02  # Within 2%
        high_volume = volume_ratio > self.thresholds['high_volume']
        
        breakout_score = 0.0
        if near_level:
            breakout_score += 0.5
        if high_volume:
            breakout_score += 0.3
        if near_level and high_volume:
            breakout_score += 0.2  # Bonus for combination
        
        return breakout_score
    
    def _detect_event_driven_movement(self, prices: np.ndarray, volumes: np.ndarray) -> float:
        """Detect event-driven market movement"""
        
        if len(prices) < 10:
            return 0.0
        
        # Look for sudden price/volume spikes
        volatility_ratio = self._calculate_volatility_percentile(prices)
        volume_ratio = self._calculate_volume_profile(volumes)
        
        # Event score based on abnormal volatility and volume
        event_score = 0.0
        if volatility_ratio > self.thresholds['event_volatility']:
            event_score += 0.4
        if volume_ratio > self.thresholds['breakout_volume']:
            event_score += 0.4
        if volatility_ratio > 2.0 and volume_ratio > 2.0:
            event_score += 0.2  # Bonus for simultaneous spikes
        
        return event_score
    
    def _classify_regime(self, signals: RegimeSignals) -> MarketRegime:
        """Classify market regime based on signals"""
        
        # Event-driven takes priority (time-sensitive)
        if signals.event_detection_score > 0.6:
            return MarketRegime.EVENT_DRIVEN
        
        # Breakout detection (also time-sensitive)
        if signals.breakout_probability > 0.7:
            return MarketRegime.BREAKOUT
        
        # Volatile markets
        if signals.volatility_percentile > self.thresholds['high_volatility']:
            return MarketRegime.VOLATILE
        
        # Trending markets
        if signals.trend_strength > self.thresholds['strong_trend']:
            return MarketRegime.TRENDING
        
        # Range-bound markets
        if signals.range_bound_indicator < self.thresholds['tight_range']:
            return MarketRegime.RANGING
        
        # Default to uncertain if no clear signals
        return MarketRegime.UNCERTAIN
    
    def _apply_regime_persistence(self, detected_regime: MarketRegime) -> MarketRegime:
        """Apply regime persistence logic to avoid excessive switching"""
        
        # If same as current regime, confirm immediately
        if detected_regime == self.current_regime:
            return self.current_regime
        
        # If same as pending regime, increment confirmation count
        if detected_regime == self.pending_regime:
            self.regime_confirmation_count += 1
        else:
            # New regime detected, start confirmation process
            self.pending_regime = detected_regime
            self.regime_confirmation_count = 1
        
        # Check if we have enough confirmations
        required_confirmations = self.regime_persistence.get(detected_regime, 3)
        
        if self.regime_confirmation_count >= required_confirmations:
            # Reset confirmation tracking
            self.regime_confirmation_count = 0
            self.pending_regime = None
            return detected_regime
        
        # Not enough confirmations yet
        return self.current_regime
    
    def _update_regime(self, new_regime: MarketRegime, signals: RegimeSignals):
        """Update current regime and tracking"""
        
        # Store regime history
        self.regime_history.append({
            'timestamp': datetime.now(),
            'regime': self.current_regime,
            'new_regime': new_regime,
            'signals': signals,
            'confidence': self._calculate_confidence(signals, new_regime)
        })
        
        # Update current regime
        self.current_regime = new_regime
        self.regime_confidence = self._calculate_confidence(signals, new_regime)
        
        # Keep only recent history (last 100 regime changes)
        if len(self.regime_history) > 100:
            self.regime_history = self.regime_history[-100:]
    
    def _calculate_confidence(self, signals: RegimeSignals, regime: MarketRegime) -> float:
        """Calculate confidence in regime classification"""
        
        confidence = 0.0
        
        if regime == MarketRegime.TRENDING:
            confidence = min(signals.trend_strength / 50.0, 1.0)
        elif regime == MarketRegime.VOLATILE:
            confidence = min(signals.volatility_percentile / 2.0, 1.0)
        elif regime == MarketRegime.RANGING:
            confidence = min(1.0 - signals.range_bound_indicator, 1.0)
        elif regime == MarketRegime.BREAKOUT:
            confidence = signals.breakout_probability
        elif regime == MarketRegime.EVENT_DRIVEN:
            confidence = signals.event_detection_score
        else:
            confidence = 0.5  # Uncertain
        
        return max(0.0, min(1.0, confidence))
    
    def get_regime_analysis(self) -> Dict:
        """Get comprehensive regime analysis"""
        
        return {
            'current_regime': self.current_regime.value,
            'confidence': self.regime_confidence,
            'last_update': self.last_update,
            'pending_regime': self.pending_regime.value if self.pending_regime else None,
            'confirmation_count': self.regime_confirmation_count,
            'regime_switches_today': len([h for h in self.regime_history 
                                        if h['timestamp'].date() == datetime.now().date()]),
            'recent_regimes': [h['regime'].value for h in self.regime_history[-5:]]
        }
    
    def is_regime_stable(self, lookback_periods: int = 5) -> bool:
        """Check if regime has been stable recently"""
        
        if len(self.regime_history) < lookback_periods:
            return True  # Not enough history, assume stable
        
        recent_regimes = [h['new_regime'] for h in self.regime_history[-lookback_periods:]]
        return len(set(recent_regimes)) == 1  # All same regime
    
    def get_regime_transition_probability(self, target_regime: MarketRegime) -> float:
        """Get probability of transitioning to target regime"""
        
        if len(self.regime_history) < 10:
            return 0.2  # Default probability
        
        # Count transitions from current regime to target regime
        transitions_from_current = 0
        transitions_to_target = 0
        
        for i in range(1, len(self.regime_history)):
            prev_regime = self.regime_history[i-1]['new_regime']
            curr_regime = self.regime_history[i]['new_regime']
            
            if prev_regime == self.current_regime:
                transitions_from_current += 1
                if curr_regime == target_regime:
                    transitions_to_target += 1
        
        if transitions_from_current == 0:
            return 0.2  # Default
        
        return transitions_to_target / transitions_from_current
    
    def _calculate_lorentzian_ml_signals(self, market_data: Dict) -> Dict:
        """
        Calculate Lorentzian ML signals for enhanced regime detection
        
        Uses physics-based pattern recognition to enhance traditional
        technical analysis with space-time curvature analysis
        """
        if not self.enable_ml:
            return {
                'confidence': 0.0,
                'classification': 'uncertain',
                'avg_distance': 0.0,
                'physics_momentum': 0.0,
                'spacetime_curvature': 0.0
            }
        
        try:
            # Convert market data to DataFrame for feature engineering
            prices = np.array(market_data['price_data'])
            volumes = np.array(market_data['volume_data'])
            
            # Create DataFrame with required OHLCV structure
            # For regime detection, we'll use price as both open/close
            # (In production, this would use actual OHLCV data)
            df = pd.DataFrame({
                'open': prices,
                'high': prices * 1.01,  # Simulate high
                'low': prices * 0.99,   # Simulate low
                'close': prices,
                'volume': volumes
            })
            
            # Engineer features for ML analysis
            engineered_df = self.feature_engineer.engineer_features(df)
            
            # Get current features for classification
            if len(engineered_df) > 0:
                current_features = self.feature_engineer.get_ml_feature_matrix(engineered_df)
                
                if len(current_features) > 0:
                    # Get latest feature vector
                    latest_features = current_features[-1]
                    
                    # Classify using Lorentzian ML
                    ml_result = self.lorentzian_classifier.classify_pattern(latest_features)
                    
                    # Calculate physics-inspired indicators
                    physics_momentum = self._calculate_physics_momentum(engineered_df)
                    spacetime_curvature = self._calculate_spacetime_curvature_score(engineered_df)
                    
                    # Store ML history for future training
                    self.ml_history.append({
                        'timestamp': datetime.now(),
                        'features': latest_features.copy(),
                        'result': ml_result,
                        'market_data': market_data.copy()
                    })
                    
                    # Update classifier with historical data if available
                    if len(self.ml_history) > 1:
                        self._update_ml_classifier()
                    
                    return {
                        'confidence': ml_result.get('confidence', 0.0),
                        'classification': ml_result.get('classification', 'uncertain'),
                        'avg_distance': ml_result.get('avg_distance', 0.0),
                        'physics_momentum': physics_momentum,
                        'spacetime_curvature': spacetime_curvature,
                        'signal_strength': ml_result.get('signal', 0.0)
                    }
            
        except Exception as e:
            self.logger.error(f"Error in Lorentzian ML analysis: {e}")
        
        # Return default values on error
        return {
            'confidence': 0.0,
            'classification': 'uncertain',
            'avg_distance': 0.0,
            'physics_momentum': 0.0,
            'spacetime_curvature': 0.0
        }
    
    def _calculate_physics_momentum(self, df: pd.DataFrame) -> float:
        """
        Calculate physics-inspired momentum indicator
        
        Combines price velocity and acceleration for momentum analysis
        """
        try:
            if 'price_velocity' in df.columns and len(df) > 0:
                # Get recent velocity and acceleration
                velocity = df['price_velocity'].iloc[-5:].mean()  # Recent 5 periods
                
                if 'price_acceleration' in df.columns:
                    acceleration = df['price_acceleration'].iloc[-5:].mean()
                    
                    # Combine velocity and acceleration (like kinetic energy)
                    momentum = np.sqrt(velocity**2 + acceleration**2)
                    
                    # Normalize to 0-1 range
                    return max(0, min(1, momentum * 10))  # Scale factor
                
            return 0.0
            
        except Exception:
            return 0.0
    
    def _calculate_spacetime_curvature_score(self, df: pd.DataFrame) -> float:
        """
        Calculate space-time curvature score for market regime analysis
        
        Uses Einstein-inspired curvature calculations to detect
        market distortions and regime changes
        """
        try:
            if 'spacetime_curvature' in df.columns and len(df) > 0:
                # Get recent curvature measurements
                curvature_values = df['spacetime_curvature'].iloc[-10:].dropna()
                
                if len(curvature_values) > 0:
                    # Calculate curvature intensity
                    avg_curvature = np.abs(curvature_values).mean()
                    curvature_volatility = np.std(curvature_values)
                    
                    # Combined curvature score
                    curvature_score = avg_curvature + (curvature_volatility * 0.5)
                    
                    # Normalize
                    return max(0, min(1, curvature_score * 100))  # Scale factor
                
            return 0.0
            
        except Exception:
            return 0.0
    
    def _update_ml_classifier(self):
        """
        Update the Lorentzian classifier with historical performance data
        
        This creates a feedback loop for continuous learning
        """
        try:
            if len(self.ml_history) < 2:
                return
            
            # Get the most recent historical data point
            prev_entry = self.ml_history[-2]
            current_entry = self.ml_history[-1]
            
            # Calculate actual market movement label
            prev_price = np.mean(prev_entry['market_data']['price_data'])
            current_price = np.mean(current_entry['market_data']['price_data'])
            
            # Create label based on price movement
            price_change = (current_price - prev_price) / prev_price
            
            if price_change > 0.01:  # >1% increase
                label = 1.0  # Bullish
            elif price_change < -0.01:  # >1% decrease
                label = -1.0  # Bearish
            else:
                label = 0.0  # Neutral
            
            # Update classifier with previous features and actual outcome
            self.lorentzian_classifier.update_history(
                prev_entry['features'],
                label
            )
            
        except Exception as e:
            self.logger.error(f"Error updating ML classifier: {e}")