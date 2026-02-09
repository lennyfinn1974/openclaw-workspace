"""
Advanced Feature Engineering for Lorentzian ML System
Multi-dimensional feature space construction for superior pattern recognition

Integrates with Master Bot's existing technical analysis framework
while adding physics-based ML enhancement capabilities.

Author: Aries AI (OpenClaw)  
Date: February 8, 2026
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

class FeatureEngineer:
    """
    Advanced feature engineering system for financial ML
    Creates multi-dimensional feature spaces optimized for Lorentzian distance calculations
    """
    
    def __init__(self, lookback_period: int = 2000):
        """
        Initialize Feature Engineer
        
        Args:
            lookback_period: Historical data lookback for feature calculations
        """
        self.lookback_period = lookback_period
        self.feature_cache = {}
        
    def engineer_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Create comprehensive feature set for ML classification
        
        Args:
            data: OHLCV DataFrame
            
        Returns:
            DataFrame with engineered features
        """
        features = data.copy()
        
        # Core Technical Features
        features = self._add_momentum_features(features)
        features = self._add_trend_features(features)
        features = self._add_volatility_features(features)
        features = self._add_volume_features(features)
        features = self._add_pattern_features(features)
        
        # Advanced ML Features
        features = self._add_regime_features(features)
        features = self._add_cross_timeframe_features(features)
        features = self._add_statistical_features(features)
        
        # Physics-inspired Features
        features = self._add_physics_features(features)
        
        return features
    
    def _add_momentum_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add momentum-based features"""
        # RSI variations
        df['rsi_14'] = self._calculate_rsi(df['close'], 14)
        df['rsi_21'] = self._calculate_rsi(df['close'], 21)
        df['rsi_divergence'] = df['rsi_14'] - df['rsi_21']
        
        # Stochastic variations
        df['stoch_k'], df['stoch_d'] = self._calculate_stochastic(df, 14, 3)
        df['stoch_momentum'] = df['stoch_k'] - df['stoch_d']
        
        # Williams %R
        df['williams_r'] = self._calculate_williams_r(df, 14)
        
        # Rate of Change
        df['roc_10'] = df['close'].pct_change(10) * 100
        df['roc_20'] = df['close'].pct_change(20) * 100
        
        return df
    
    def _add_trend_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add trend-based features"""
        # Moving averages
        df['sma_20'] = df['close'].rolling(window=20).mean()
        df['sma_50'] = df['close'].rolling(window=50).mean()
        df['sma_200'] = df['close'].rolling(window=200).mean()
        
        df['ema_12'] = df['close'].ewm(span=12).mean()
        df['ema_26'] = df['close'].ewm(span=26).mean()
        
        # MA relationships
        df['price_vs_sma20'] = (df['close'] - df['sma_20']) / df['sma_20'] * 100
        df['sma20_vs_sma50'] = (df['sma_20'] - df['sma_50']) / df['sma_50'] * 100
        
        # MACD system
        df['macd'] = df['ema_12'] - df['ema_26']
        df['macd_signal'] = df['macd'].ewm(span=9).mean()
        df['macd_histogram'] = df['macd'] - df['macd_signal']
        
        # ADX system
        df['adx'] = self._calculate_adx(df, 14)
        df['di_plus'], df['di_minus'] = self._calculate_directional_indicators(df, 14)
        df['di_spread'] = df['di_plus'] - df['di_minus']
        
        return df
    
    def _add_volatility_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add volatility-based features"""
        # Bollinger Bands
        sma_20 = df['close'].rolling(window=20).mean()
        std_20 = df['close'].rolling(window=20).std()
        df['bb_upper'] = sma_20 + (std_20 * 2)
        df['bb_lower'] = sma_20 - (std_20 * 2)
        df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])
        df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / sma_20 * 100
        
        # Average True Range
        df['atr'] = self._calculate_atr(df, 14)
        df['atr_ratio'] = df['atr'] / df['close'] * 100
        
        # Volatility ratio
        df['volatility'] = df['close'].rolling(window=20).std()
        df['volatility_ratio'] = df['volatility'] / df['volatility'].rolling(window=50).mean()
        
        return df
    
    def _add_volume_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add volume-based features"""
        if 'volume' in df.columns:
            # Volume moving averages
            df['volume_sma_20'] = df['volume'].rolling(window=20).mean()
            df['volume_ratio'] = df['volume'] / df['volume_sma_20']
            
            # On Balance Volume
            df['obv'] = (df['volume'] * np.sign(df['close'].diff())).cumsum()
            df['obv_sma'] = df['obv'].rolling(window=10).mean()
            
            # Volume Price Trend
            df['vpt'] = (df['volume'] * df['close'].pct_change()).cumsum()
        else:
            # Fill with neutral values if volume not available
            df['volume_ratio'] = 1.0
            df['obv'] = 0.0
            df['obv_sma'] = 0.0
            df['vpt'] = 0.0
        
        return df
    
    def _add_pattern_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add pattern recognition features"""
        # Candlestick patterns (simplified)
        df['doji'] = self._detect_doji(df)
        df['hammer'] = self._detect_hammer(df)
        df['engulfing'] = self._detect_engulfing(df)
        
        # Price action patterns
        df['higher_high'] = self._detect_higher_high(df)
        df['lower_low'] = self._detect_lower_low(df)
        df['breakout'] = self._detect_breakout(df)
        
        return df
    
    def _add_regime_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add market regime features"""
        # Trend strength
        df['trend_strength'] = np.abs(df['price_vs_sma20']) * (df['adx'] / 100)
        
        # Market efficiency (random walk test)
        df['efficiency_ratio'] = self._calculate_efficiency_ratio(df, 10)
        
        # Fractal dimension (complexity measure)
        df['fractal_dimension'] = self._calculate_fractal_dimension(df, 20)
        
        return df
    
    def _add_cross_timeframe_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add cross-timeframe analysis features"""
        # Weekly and monthly trend alignment
        # (Simplified - assumes daily data)
        
        # Weekly trend (5-day approximation)
        df['weekly_trend'] = np.sign(df['close'].rolling(window=5).mean().diff())
        
        # Monthly trend (20-day approximation)  
        df['monthly_trend'] = np.sign(df['close'].rolling(window=20).mean().diff())
        
        # Trend alignment score
        daily_trend = np.sign(df['close'].diff())
        df['trend_alignment'] = (daily_trend + df['weekly_trend'] + df['monthly_trend']) / 3
        
        return df
    
    def _add_statistical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add statistical analysis features"""
        # Skewness and kurtosis
        returns = df['close'].pct_change()
        df['returns_skew'] = returns.rolling(window=20).skew()
        df['returns_kurtosis'] = returns.rolling(window=20).kurt()
        
        # Z-score
        df['price_zscore'] = (df['close'] - df['close'].rolling(window=20).mean()) / df['close'].rolling(window=20).std()
        
        # Hurst exponent (trend persistence)
        df['hurst_exponent'] = self._calculate_hurst_exponent(df, 50)
        
        return df
    
    def _add_physics_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add physics-inspired features for Lorentzian distance"""
        # Momentum (price velocity)
        df['price_velocity'] = df['close'].diff() / df['close'].shift()
        
        # Acceleration (change in velocity)
        df['price_acceleration'] = df['price_velocity'].diff()
        
        # Energy-like measure (kinetic + potential)
        df['market_energy'] = df['price_velocity']**2 + (df['price_zscore']**2) * 0.5
        
        # Wave interference patterns
        df['wave_interference'] = np.sin(2 * np.pi * np.arange(len(df)) / 20) + np.sin(2 * np.pi * np.arange(len(df)) / 50)
        
        # Space-time curvature analog
        df['spacetime_curvature'] = self._calculate_spacetime_curvature(df)
        
        return df
    
    def get_ml_feature_matrix(self, df: pd.DataFrame, 
                             feature_list: Optional[List[str]] = None) -> np.ndarray:
        """
        Extract feature matrix optimized for ML classification
        
        Args:
            df: DataFrame with engineered features
            feature_list: Specific features to extract (None for default set)
            
        Returns:
            Normalized feature matrix
        """
        if feature_list is None:
            # Default optimal feature set for Lorentzian classification
            feature_list = [
                'rsi_14',
                'macd_histogram', 
                'bb_position',
                'adx',
                'price_velocity',
                'trend_strength',
                'efficiency_ratio',
                'volume_ratio',
                'price_zscore',
                'spacetime_curvature'
            ]
        
        # Extract and normalize features
        feature_matrix = df[feature_list].fillna(0).values
        
        # Z-score normalization for each feature
        for i in range(feature_matrix.shape[1]):
            column = feature_matrix[:, i]
            if np.std(column) > 0:
                feature_matrix[:, i] = (column - np.mean(column)) / np.std(column)
        
        return feature_matrix
    
    # Technical indicator calculation methods
    def _calculate_rsi(self, prices: pd.Series, period: int) -> pd.Series:
        """Calculate RSI"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def _calculate_stochastic(self, df: pd.DataFrame, k_period: int, d_period: int) -> Tuple[pd.Series, pd.Series]:
        """Calculate Stochastic oscillator"""
        low_min = df['low'].rolling(window=k_period).min()
        high_max = df['high'].rolling(window=k_period).max()
        
        k_percent = 100 * ((df['close'] - low_min) / (high_max - low_min))
        d_percent = k_percent.rolling(window=d_period).mean()
        
        return k_percent, d_percent
    
    def _calculate_williams_r(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate Williams %R"""
        high_max = df['high'].rolling(window=period).max()
        low_min = df['low'].rolling(window=period).min()
        
        williams_r = -100 * ((high_max - df['close']) / (high_max - low_min))
        return williams_r
    
    def _calculate_atr(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate Average True Range"""
        high, low, close = df['high'], df['low'], df['close']
        
        tr1 = high - low
        tr2 = (high - close.shift()).abs()
        tr3 = (low - close.shift()).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        atr = tr.rolling(window=period).mean()
        return atr
    
    def _calculate_adx(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate ADX"""
        high, low, close = df['high'], df['low'], df['close']
        
        # True Range
        tr = self._calculate_atr(df, 1)
        
        # Directional Movement
        dm_plus = np.where((high.diff() > low.diff().abs()) & (high.diff() > 0), high.diff(), 0)
        dm_minus = np.where((low.diff().abs() > high.diff()) & (low.diff() < 0), low.diff().abs(), 0)
        
        dm_plus = pd.Series(dm_plus, index=df.index)
        dm_minus = pd.Series(dm_minus, index=df.index)
        
        # Smoothed values
        atr = tr.rolling(window=period).mean()
        di_plus = 100 * (dm_plus.rolling(window=period).mean() / atr)
        di_minus = 100 * (dm_minus.rolling(window=period).mean() / atr)
        
        # ADX
        dx = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus)
        adx = dx.rolling(window=period).mean()
        
        return adx
    
    def _calculate_directional_indicators(self, df: pd.DataFrame, period: int) -> Tuple[pd.Series, pd.Series]:
        """Calculate +DI and -DI"""
        high, low, close = df['high'], df['low'], df['close']
        
        # True Range
        tr = self._calculate_atr(df, 1)
        
        # Directional Movement
        dm_plus = np.where((high.diff() > low.diff().abs()) & (high.diff() > 0), high.diff(), 0)
        dm_minus = np.where((low.diff().abs() > high.diff()) & (low.diff() < 0), low.diff().abs(), 0)
        
        dm_plus = pd.Series(dm_plus, index=df.index)
        dm_minus = pd.Series(dm_minus, index=df.index)
        
        # Smoothed values
        atr = tr.rolling(window=period).mean()
        di_plus = 100 * (dm_plus.rolling(window=period).mean() / atr)
        di_minus = 100 * (dm_minus.rolling(window=period).mean() / atr)
        
        return di_plus, di_minus
    
    # Pattern detection methods
    def _detect_doji(self, df: pd.DataFrame, threshold: float = 0.1) -> pd.Series:
        """Detect doji patterns"""
        body_size = np.abs(df['close'] - df['open']) / df['open']
        return (body_size < threshold).astype(int)
    
    def _detect_hammer(self, df: pd.DataFrame) -> pd.Series:
        """Detect hammer patterns"""
        body_size = np.abs(df['close'] - df['open'])
        lower_shadow = df[['open', 'close']].min(axis=1) - df['low']
        upper_shadow = df['high'] - df[['open', 'close']].max(axis=1)
        
        hammer = ((lower_shadow > 2 * body_size) & 
                 (upper_shadow < body_size)).astype(int)
        return hammer
    
    def _detect_engulfing(self, df: pd.DataFrame) -> pd.Series:
        """Detect engulfing patterns"""
        prev_body_size = np.abs(df['close'].shift() - df['open'].shift())
        curr_body_size = np.abs(df['close'] - df['open'])
        
        engulfing = (curr_body_size > prev_body_size * 1.5).astype(int)
        return engulfing
    
    def _detect_higher_high(self, df: pd.DataFrame, lookback: int = 5) -> pd.Series:
        """Detect higher highs"""
        rolling_max = df['high'].rolling(window=lookback).max()
        higher_high = (df['high'] > rolling_max.shift()).astype(int)
        return higher_high
    
    def _detect_lower_low(self, df: pd.DataFrame, lookback: int = 5) -> pd.Series:
        """Detect lower lows"""
        rolling_min = df['low'].rolling(window=lookback).min()
        lower_low = (df['low'] < rolling_min.shift()).astype(int)
        return lower_low
    
    def _detect_breakout(self, df: pd.DataFrame, period: int = 20) -> pd.Series:
        """Detect breakout patterns"""
        high_max = df['high'].rolling(window=period).max()
        low_min = df['low'].rolling(window=period).min()
        
        breakout_up = (df['close'] > high_max.shift()).astype(int)
        breakout_down = (df['close'] < low_min.shift()).astype(int) * -1
        
        return breakout_up + breakout_down
    
    # Advanced calculation methods
    def _calculate_efficiency_ratio(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate Kaufman's Efficiency Ratio"""
        price_change = np.abs(df['close'] - df['close'].shift(period))
        volatility = np.abs(df['close'].diff()).rolling(window=period).sum()
        
        efficiency_ratio = price_change / (volatility + 1e-8)
        return efficiency_ratio
    
    def _calculate_fractal_dimension(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate fractal dimension (complexity measure)"""
        # Simplified fractal dimension using Higuchi method
        returns = df['close'].pct_change().dropna()
        
        fractal_dims = []
        for i in range(period, len(returns)):
            window_returns = returns.iloc[i-period:i]
            
            # Calculate fractal dimension
            N = len(window_returns)
            L = []
            
            for k in range(1, min(6, N//2)):  # Use multiple k values
                Lk = 0
                for m in range(k):
                    series = window_returns.iloc[m::k].values
                    if len(series) > 1:
                        Lk += np.sum(np.abs(np.diff(series)))
                
                if Lk > 0:
                    L.append(np.log(Lk / k))
            
            if len(L) > 1:
                # Linear regression to find fractal dimension
                k_vals = np.log(range(1, len(L) + 1))
                fractal_dim = -np.polyfit(k_vals, L, 1)[0]
                fractal_dims.append(fractal_dim)
            else:
                fractal_dims.append(1.5)  # Default fractal dimension
        
        # Pad with default values
        result = [1.5] * period + fractal_dims
        # Ensure correct length
        while len(result) < len(df):
            result.append(1.5)
        result = result[:len(df)]  # Trim if too long
        return pd.Series(result, index=df.index)
    
    def _calculate_hurst_exponent(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate Hurst exponent (trend persistence measure)"""
        returns = df['close'].pct_change().dropna()
        
        hurst_values = []
        for i in range(period, len(returns)):
            window_returns = returns.iloc[i-period:i].values
            
            # R/S analysis
            mean_return = np.mean(window_returns)
            deviations = window_returns - mean_return
            cumulative_deviations = np.cumsum(deviations)
            
            R = np.max(cumulative_deviations) - np.min(cumulative_deviations)
            S = np.std(window_returns)
            
            if S > 0:
                rs_ratio = R / S
                hurst = np.log(rs_ratio) / np.log(period)
                hurst_values.append(max(0, min(1, hurst)))  # Clamp between 0 and 1
            else:
                hurst_values.append(0.5)  # Random walk default
        
        # Pad with default values
        result = [0.5] * period + hurst_values
        # Ensure correct length
        while len(result) < len(df):
            result.append(0.5)
        result = result[:len(df)]  # Trim if too long
        return pd.Series(result, index=df.index)
    
    def _calculate_spacetime_curvature(self, df: pd.DataFrame) -> pd.Series:
        """
        Calculate space-time curvature analog for financial markets
        Physics-inspired feature for Lorentzian distance calculations
        """
        # Price as position in space-time
        price_velocity = df['close'].diff()
        price_acceleration = price_velocity.diff()
        
        # Volume as mass-energy density
        if 'volume' in df.columns:
            volume_normalized = df['volume'] / df['volume'].rolling(window=20).mean()
        else:
            volume_normalized = pd.Series(1.0, index=df.index)
        
        # Curvature calculation (simplified Einstein field equation analog)
        # R_μν - (1/2)g_μν R = 8πG T_μν
        # Simplified as: curvature ∝ acceleration / (price * volume_density)
        
        curvature = price_acceleration / (df['close'] * volume_normalized + 1e-8)
        
        # Smooth and normalize
        curvature = curvature.rolling(window=5).mean()
        
        return curvature

if __name__ == "__main__":
    print("🔧 Advanced Feature Engineering System Initialized")
    print("Multi-dimensional feature space construction ready")
    
    # Test feature engineer
    engineer = FeatureEngineer()
    print(f"✅ Feature Engineer configured with {engineer.lookback_period} period lookback")
    print("✅ Technical, statistical, and physics-inspired features available")
    print("🚀 Ready for Lorentzian ML integration!")