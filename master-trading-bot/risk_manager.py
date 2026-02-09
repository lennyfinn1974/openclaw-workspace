"""
Dynamic Risk Management System for Master Trading Bot
Implements Qullamaggie position sizing + volatility-adjusted leverage

Author: Aries AI Assistant  
Date: February 7, 2026
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
import logging
from datetime import datetime

from regime_detector import MarketRegime
from strategy_arsenal import TradingStrategy, TradingOpportunity


@dataclass
class RiskAssessment:
    """Container for trade risk assessment"""
    approved: bool
    reason: str
    position_size: float
    recommended_leverage: float
    max_loss: float
    portfolio_risk: float
    correlation_risk: float
    volatility_adjustment: float
    stop_distance: float


class DynamicRiskManager:
    """
    Advanced risk management system implementing research framework:
    - Qullamaggie position sizing (0.3-0.5% base risk per trade)  
    - Dynamic leverage based on market volatility and strategy
    - Correlation management across positions
    - Volatility-adjusted position sizing
    - Maximum drawdown protection
    """
    
    def __init__(
        self,
        base_risk: float = 0.01,      # 1% base risk per trade
        max_risk: float = 0.02,       # 2% maximum risk per trade  
        leverage_limits: Dict = None
    ):
        """Initialize dynamic risk manager"""
        
        self.base_risk = base_risk
        self.max_risk = max_risk
        
        # Default leverage limits by regime
        self.leverage_limits = leverage_limits or {
            "trending": 2.0,
            "volatile": 1.5,
            "ranging": 1.5,
            "event_driven": 1.0,
            "uncertain": 1.0
        }
        
        # Risk management parameters
        self.max_positions = 5
        self.max_correlation = 0.7
        self.max_single_position = 0.1  # 10% of capital max
        self.max_total_exposure = 2.0   # 200% total leverage max
        
        # Volatility thresholds
        self.volatility_thresholds = {
            'low': 1.0,      # Normal position sizing
            'medium': 1.2,   # 20% higher volatility  
            'high': 2.0,     # 100% higher volatility
            'extreme': 3.0   # 200% higher volatility
        }
        
        # Position correlation tracking
        self.position_correlations = {}
        
        self.logger = logging.getLogger('RiskManager')
    
    def evaluate_trade(
        self,
        opportunity: TradingOpportunity,
        current_capital: float,
        current_positions: Dict,
        market_regime: MarketRegime
    ) -> RiskAssessment:
        """
        Evaluate trade opportunity and provide risk assessment
        
        Args:
            opportunity: Trading opportunity to evaluate
            current_capital: Current account capital
            current_positions: Dictionary of current positions
            market_regime: Current market regime
            
        Returns:
            Risk assessment with approval/rejection and sizing
        """
        
        try:
            # Step 1: Basic risk checks
            basic_check = self._basic_risk_checks(opportunity, current_positions)
            if not basic_check['approved']:
                return RiskAssessment(
                    approved=False,
                    reason=basic_check['reason'],
                    position_size=0.0,
                    recommended_leverage=1.0,
                    max_loss=0.0,
                    portfolio_risk=0.0,
                    correlation_risk=0.0,
                    volatility_adjustment=1.0,
                    stop_distance=0.0
                )
            
            # Step 2: Calculate volatility adjustment
            volatility_adj = self._calculate_volatility_adjustment(opportunity)
            
            # Step 3: Determine base position size using Qullamaggie method
            base_position_size = self._calculate_base_position_size(
                opportunity, current_capital, volatility_adj
            )
            
            # Step 4: Apply leverage based on regime and strategy
            leverage = self._calculate_dynamic_leverage(
                opportunity, market_regime, volatility_adj
            )
            
            # Step 5: Correlation risk assessment
            correlation_risk = self._assess_correlation_risk(
                opportunity, current_positions
            )
            
            # Step 6: Portfolio risk assessment
            portfolio_risk = self._assess_portfolio_risk(
                base_position_size, leverage, current_capital, current_positions
            )
            
            # Step 7: Final position size adjustment
            final_position_size = self._apply_final_adjustments(
                base_position_size, leverage, correlation_risk, portfolio_risk
            )
            
            # Step 8: Final approval check
            max_loss = self._calculate_max_loss(opportunity, final_position_size)
            
            approved = self._final_approval_check(
                final_position_size, max_loss, current_capital, portfolio_risk
            )
            
            if not approved['approved']:
                return RiskAssessment(
                    approved=False,
                    reason=approved['reason'],
                    position_size=0.0,
                    recommended_leverage=leverage,
                    max_loss=max_loss,
                    portfolio_risk=portfolio_risk,
                    correlation_risk=correlation_risk,
                    volatility_adjustment=volatility_adj,
                    stop_distance=abs(opportunity.entry_price - opportunity.stop_loss)
                )
            
            self.logger.info(f"Trade approved: {opportunity.symbol} {opportunity.direction} "
                           f"Size: {final_position_size:.2f} Leverage: {leverage:.1f}x")
            
            return RiskAssessment(
                approved=True,
                reason="Trade approved with dynamic risk management",
                position_size=final_position_size,
                recommended_leverage=leverage,
                max_loss=max_loss,
                portfolio_risk=portfolio_risk,
                correlation_risk=correlation_risk,
                volatility_adjustment=volatility_adj,
                stop_distance=abs(opportunity.entry_price - opportunity.stop_loss)
            )
            
        except Exception as e:
            self.logger.error(f"Error in risk evaluation: {e}")
            return RiskAssessment(
                approved=False,
                reason=f"Risk evaluation error: {e}",
                position_size=0.0,
                recommended_leverage=1.0,
                max_loss=0.0,
                portfolio_risk=0.0,
                correlation_risk=0.0,
                volatility_adjustment=1.0,
                stop_distance=0.0
            )
    
    def _basic_risk_checks(
        self, 
        opportunity: TradingOpportunity, 
        current_positions: Dict
    ) -> Dict:
        """Perform basic risk checks"""
        
        # Check maximum positions limit
        if len(current_positions) >= self.max_positions:
            return {
                'approved': False,
                'reason': f"Maximum positions ({self.max_positions}) already held"
            }
        
        # Check minimum risk/reward ratio
        if opportunity.risk_reward_ratio < 1.5:
            return {
                'approved': False,
                'reason': f"Risk/reward ratio too low: {opportunity.risk_reward_ratio:.2f}"
            }
        
        # Check confidence threshold
        if opportunity.confidence < 0.3:
            return {
                'approved': False,
                'reason': f"Confidence too low: {opportunity.confidence:.2f}"
            }
        
        # Check stop loss distance
        stop_distance = abs(opportunity.entry_price - opportunity.stop_loss) / opportunity.entry_price
        if stop_distance > 0.05:  # 5% maximum stop loss
            return {
                'approved': False,
                'reason': f"Stop loss too wide: {stop_distance:.2%}"
            }
        
        return {'approved': True, 'reason': 'Basic checks passed'}
    
    def _calculate_volatility_adjustment(self, opportunity: TradingOpportunity) -> float:
        """Calculate volatility adjustment factor"""
        
        # Get volatility indicators from opportunity signals
        signals = opportunity.signals
        
        # Extract volatility measures (would be more sophisticated in production)
        volatility_ratio = signals.get('volatility_ratio', 1.0)
        volume_ratio = signals.get('volume_ratio', 1.0)
        
        # Classify volatility regime
        if volatility_ratio >= self.volatility_thresholds['extreme']:
            volatility_class = 'extreme'
            adjustment = 0.25  # Very small positions in extreme volatility
        elif volatility_ratio >= self.volatility_thresholds['high']:
            volatility_class = 'high'
            adjustment = 0.5   # Reduced positions in high volatility
        elif volatility_ratio >= self.volatility_thresholds['medium']:
            volatility_class = 'medium'
            adjustment = 0.75  # Slightly reduced positions
        else:
            volatility_class = 'low'
            adjustment = 1.0   # Full positions in low volatility
        
        # Volume factor (high volume = more confidence = larger size)
        volume_factor = min(1.2, max(0.8, volume_ratio / 2.0))
        
        final_adjustment = adjustment * volume_factor
        
        self.logger.debug(f"Volatility adjustment: {volatility_class} -> {final_adjustment:.2f}")
        
        return final_adjustment
    
    def _calculate_base_position_size(
        self,
        opportunity: TradingOpportunity,
        current_capital: float,
        volatility_adjustment: float
    ) -> float:
        """Calculate base position size using Qullamaggie methodology"""
        
        # Base risk amount (Qullamaggie: 0.3-0.5% per trade, we use 1% base)
        confidence_multiplier = max(0.3, min(1.5, opportunity.confidence * 2))
        risk_amount = current_capital * self.base_risk * confidence_multiplier * volatility_adjustment
        
        # Stop loss distance
        stop_distance = abs(opportunity.entry_price - opportunity.stop_loss)
        
        # Position size = Risk Amount / Stop Distance  
        position_size = risk_amount / stop_distance
        
        # Apply maximum single position limit
        max_position_value = current_capital * self.max_single_position
        max_shares = max_position_value / opportunity.entry_price
        
        position_size = min(position_size, max_shares)
        
        self.logger.debug(f"Base position size: {position_size:.0f} shares "
                         f"(Risk: ${risk_amount:.2f}, Stop: ${stop_distance:.2f})")
        
        return position_size
    
    def _calculate_dynamic_leverage(
        self,
        opportunity: TradingOpportunity,
        market_regime: MarketRegime,
        volatility_adjustment: float
    ) -> float:
        """Calculate dynamic leverage based on regime and strategy"""
        
        # Base leverage from strategy
        base_leverage = opportunity.recommended_leverage
        
        # Regime-based adjustment
        regime_key = market_regime.value
        regime_limit = self.leverage_limits.get(regime_key, 1.0)
        regime_adjusted = min(base_leverage, regime_limit)
        
        # Volatility adjustment (reduce leverage in high volatility)
        volatility_factor = max(0.5, min(1.0, volatility_adjustment))
        
        # Confidence adjustment
        confidence_factor = max(0.7, min(1.2, opportunity.confidence * 1.5))
        
        # Final leverage calculation
        final_leverage = regime_adjusted * volatility_factor * confidence_factor
        
        # Clamp to reasonable bounds
        final_leverage = max(1.0, min(final_leverage, 3.0))
        
        self.logger.debug(f"Dynamic leverage: base={base_leverage} regime={regime_limit} "
                         f"vol={volatility_factor:.2f} conf={confidence_factor:.2f} "
                         f"final={final_leverage:.2f}")
        
        return final_leverage
    
    def _assess_correlation_risk(
        self,
        opportunity: TradingOpportunity,
        current_positions: Dict
    ) -> float:
        """Assess correlation risk with existing positions"""
        
        if not current_positions:
            return 0.0  # No correlation risk with no positions
        
        # Simple correlation assessment (would be more sophisticated in production)
        correlation_score = 0.0
        
        for position in current_positions.values():
            existing_opportunity = position.get('opportunity')
            if not existing_opportunity:
                continue
            
            # Same direction correlation
            if (opportunity.direction == existing_opportunity.direction and
                opportunity.strategy == existing_opportunity.strategy):
                correlation_score += 0.3
            
            # Market regime correlation  
            if opportunity.market_regime == existing_opportunity.market_regime:
                correlation_score += 0.2
            
            # Sector correlation (simplified - same symbol = high correlation)
            if opportunity.symbol == existing_opportunity.symbol:
                correlation_score += 0.8
        
        # Normalize correlation score
        max_correlation = len(current_positions) * 1.3  # Theoretical maximum
        normalized_correlation = min(1.0, correlation_score / max_correlation)
        
        self.logger.debug(f"Correlation risk: {normalized_correlation:.2f}")
        
        return normalized_correlation
    
    def _assess_portfolio_risk(
        self,
        position_size: float,
        leverage: float,
        current_capital: float,
        current_positions: Dict
    ) -> float:
        """Assess overall portfolio risk"""
        
        # Calculate current total exposure
        current_exposure = 0.0
        for position in current_positions.values():
            risk_assessment = position.get('risk_assessment', {})
            pos_size = risk_assessment.get('position_size', 0.0)
            pos_leverage = risk_assessment.get('recommended_leverage', 1.0)
            current_exposure += pos_size * pos_leverage
        
        # Add new position exposure
        new_exposure = position_size * leverage
        total_exposure = current_exposure + new_exposure
        
        # Calculate exposure as percentage of capital
        exposure_ratio = total_exposure / current_capital
        
        # Portfolio risk score based on total exposure
        if exposure_ratio > 2.5:  # 250% exposure
            portfolio_risk = 1.0
        elif exposure_ratio > 2.0:  # 200% exposure
            portfolio_risk = 0.8
        elif exposure_ratio > 1.5:  # 150% exposure
            portfolio_risk = 0.6
        elif exposure_ratio > 1.0:  # 100% exposure
            portfolio_risk = 0.4
        else:
            portfolio_risk = 0.2
        
        self.logger.debug(f"Portfolio risk: {portfolio_risk:.2f} (exposure: {exposure_ratio:.1f}x)")
        
        return portfolio_risk
    
    def _apply_final_adjustments(
        self,
        base_position_size: float,
        leverage: float,
        correlation_risk: float,
        portfolio_risk: float
    ) -> float:
        """Apply final adjustments to position size"""
        
        # Correlation adjustment (reduce size if high correlation)
        correlation_factor = max(0.5, 1.0 - correlation_risk * 0.5)
        
        # Portfolio risk adjustment (reduce size if high portfolio risk)
        portfolio_factor = max(0.3, 1.0 - portfolio_risk * 0.7)
        
        # Apply adjustments
        adjusted_size = base_position_size * correlation_factor * portfolio_factor
        
        self.logger.debug(f"Final adjustments: base={base_position_size:.0f} "
                         f"corr_factor={correlation_factor:.2f} "
                         f"portfolio_factor={portfolio_factor:.2f} "
                         f"final={adjusted_size:.0f}")
        
        return adjusted_size
    
    def _calculate_max_loss(
        self,
        opportunity: TradingOpportunity,
        position_size: float
    ) -> float:
        """Calculate maximum potential loss"""
        
        stop_distance = abs(opportunity.entry_price - opportunity.stop_loss)
        max_loss = position_size * stop_distance
        
        return max_loss
    
    def _final_approval_check(
        self,
        position_size: float,
        max_loss: float,
        current_capital: float,
        portfolio_risk: float
    ) -> Dict:
        """Final approval check before trade execution"""
        
        # Check maximum loss as percentage of capital
        max_loss_pct = max_loss / current_capital
        
        if max_loss_pct > self.max_risk:
            return {
                'approved': False,
                'reason': f"Max loss too high: {max_loss_pct:.2%} > {self.max_risk:.2%}"
            }
        
        # Check portfolio risk threshold
        if portfolio_risk > 0.9:  # 90% portfolio risk threshold
            return {
                'approved': False,
                'reason': f"Portfolio risk too high: {portfolio_risk:.2f}"
            }
        
        # Check minimum position size (avoid tiny positions)
        if position_size < 10:  # Minimum 10 shares/units
            return {
                'approved': False,
                'reason': f"Position size too small: {position_size:.0f}"
            }
        
        return {'approved': True, 'reason': 'Final checks passed'}
    
    def update_position_performance(
        self,
        position_id: str,
        pnl: float,
        strategy: TradingStrategy
    ):
        """Update position performance for risk model learning"""
        
        # This would typically update machine learning models
        # For now, we'll just log the performance
        
        self.logger.info(f"Position {position_id} closed: PnL=${pnl:.2f} Strategy={strategy.value}")
        
        # Future implementation: Update volatility models, correlation matrices, etc.
    
    def get_portfolio_summary(
        self, 
        current_positions: Dict, 
        current_capital: float
    ) -> Dict:
        """Get comprehensive portfolio risk summary"""
        
        if not current_positions:
            return {
                'total_positions': 0,
                'total_exposure': 0.0,
                'exposure_ratio': 0.0,
                'max_single_risk': 0.0,
                'total_max_loss': 0.0,
                'portfolio_risk_score': 0.0,
                'available_capacity': self.max_positions
            }
        
        total_exposure = 0.0
        total_max_loss = 0.0
        max_single_risk = 0.0
        
        for position in current_positions.values():
            risk_assessment = position.get('risk_assessment', {})
            pos_size = risk_assessment.get('position_size', 0.0)
            leverage = risk_assessment.get('recommended_leverage', 1.0)
            max_loss = risk_assessment.get('max_loss', 0.0)
            
            exposure = pos_size * leverage
            total_exposure += exposure
            total_max_loss += max_loss
            max_single_risk = max(max_single_risk, max_loss / current_capital)
        
        exposure_ratio = total_exposure / current_capital
        
        # Calculate overall portfolio risk score
        risk_factors = [
            len(current_positions) / self.max_positions,  # Position count factor
            exposure_ratio / self.max_total_exposure,      # Leverage factor
            total_max_loss / (current_capital * self.max_risk * 5),  # Max loss factor
        ]
        
        portfolio_risk_score = min(1.0, np.mean(risk_factors))
        
        return {
            'total_positions': len(current_positions),
            'total_exposure': total_exposure,
            'exposure_ratio': exposure_ratio,
            'max_single_risk': max_single_risk,
            'total_max_loss': total_max_loss,
            'total_max_loss_pct': total_max_loss / current_capital,
            'portfolio_risk_score': portfolio_risk_score,
            'available_capacity': self.max_positions - len(current_positions)
        }
    
    def adjust_risk_parameters(
        self,
        market_volatility: float,
        recent_performance: Dict
    ):
        """Dynamically adjust risk parameters based on market conditions and performance"""
        
        # Adjust base risk based on recent performance
        win_rate = recent_performance.get('win_rate', 0.5)
        avg_pnl = recent_performance.get('avg_pnl', 0.0)
        
        # Increase risk if performing well, decrease if performing poorly
        if win_rate > 0.65 and avg_pnl > 0:
            risk_multiplier = min(1.2, 1.0 + (win_rate - 0.5) * 0.4)
        elif win_rate < 0.4 or avg_pnl < 0:
            risk_multiplier = max(0.5, 1.0 - (0.5 - win_rate) * 0.4)
        else:
            risk_multiplier = 1.0
        
        # Adjust for market volatility
        volatility_multiplier = max(0.5, 1.0 / market_volatility)
        
        # Apply adjustments
        old_base_risk = self.base_risk
        self.base_risk = min(self.max_risk * 0.5, 
                           old_base_risk * risk_multiplier * volatility_multiplier)
        
        self.logger.info(f"Risk parameters adjusted: base_risk {old_base_risk:.3f} -> {self.base_risk:.3f}")
    
    def emergency_risk_reduction(self, drawdown_pct: float):
        """Emergency risk reduction during high drawdown periods"""
        
        if drawdown_pct > 0.15:  # 15% drawdown
            # Severely reduce risk
            self.base_risk *= 0.3
            self.max_positions = max(2, self.max_positions // 2)
            self.logger.warning(f"Emergency risk reduction activated: drawdown {drawdown_pct:.1%}")
            
        elif drawdown_pct > 0.10:  # 10% drawdown
            # Moderate risk reduction
            self.base_risk *= 0.5
            self.max_positions = max(3, int(self.max_positions * 0.7))
            self.logger.warning(f"Moderate risk reduction activated: drawdown {drawdown_pct:.1%}")
    
    def reset_risk_parameters(self):
        """Reset risk parameters to defaults after drawdown recovery"""
        
        self.base_risk = 0.01  # Reset to 1%
        self.max_positions = 5
        self.logger.info("Risk parameters reset to defaults")