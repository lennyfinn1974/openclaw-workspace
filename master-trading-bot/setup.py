"""
Master Trading Bot Setup Script
Built with Enhanced Sovereign BLD Architecture - February 7, 2026

Quick setup and configuration for the adaptive trading system
"""

import os
import sys
import subprocess
import logging
from pathlib import Path

def setup_master_bot():
    """Setup Master Trading Bot environment"""
    
    print("🚀 Master Trading Bot Setup")
    print("=" * 50)
    
    # Create necessary directories
    directories = [
        'logs',
        'data',
        'backtest_results',
        'live_data',
        'config'
    ]
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"✅ Created directory: {directory}")
    
    # Install requirements
    print("\n📦 Installing requirements...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], 
                      check=True)
        print("✅ Requirements installed successfully")
    except subprocess.CalledProcessError:
        print("⚠️ Some requirements may have failed to install")
    
    # Create default configuration
    create_default_config()
    
    # Create example usage script
    create_example_script()
    
    print("\n🎯 Setup Complete!")
    print(f"📁 Master Bot installed in: {os.getcwd()}")
    print("\n🚀 To start trading:")
    print("   python example_usage.py")
    print("\n📊 To run backtests:")
    print("   python -c \"from master_bot import MasterTradingBot; bot = MasterTradingBot(); bot.backtest()\"")

def create_default_config():
    """Create default configuration file"""
    
    config_content = """# Master Trading Bot Configuration
# Built with Enhanced Sovereign BLD Architecture

# Risk Management
BASE_RISK_PER_TRADE = 0.01        # 1% base risk
MAX_RISK_PER_TRADE = 0.02         # 2% maximum risk
MAX_POSITIONS = 5                 # Maximum concurrent positions
MAX_CORRELATION = 0.7             # Maximum position correlation

# Leverage Limits by Market Regime
LEVERAGE_TRENDING = 2.0           # Trending markets
LEVERAGE_VOLATILE = 1.5           # Volatile markets  
LEVERAGE_RANGING = 1.5            # Range-bound markets
LEVERAGE_EVENT_DRIVEN = 1.0       # Event-driven markets
LEVERAGE_UNCERTAIN = 1.0          # Uncertain conditions

# Strategy Performance Tracking
PERFORMANCE_LOOKBACK = 100        # Trades to consider for performance
MIN_CONFIDENCE = 0.3              # Minimum confidence for trades
MIN_RISK_REWARD = 1.5             # Minimum risk/reward ratio

# Market Data
DEFAULT_SYMBOLS = ["SPY", "QQQ", "IWM", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META"]
UPDATE_FREQUENCY = 60             # Market regime update frequency (seconds)

# Competition Mode
COMPETITOR_BOTS = 21              # Number of static bots to compete against
COMPETITIVE_MODE = True           # Enable competition tracking

# Logging
LOG_LEVEL = "INFO"
LOG_FILE = "logs/master_bot.log"
PERFORMANCE_LOG = "logs/performance.log"

# Emergency Risk Management
MAX_DRAWDOWN_WARNING = 0.10       # 10% drawdown warning
MAX_DRAWDOWN_EMERGENCY = 0.15     # 15% drawdown emergency stop
"""
    
    with open('config/master_bot.conf', 'w') as f:
        f.write(config_content)
    
    print("✅ Created default configuration: config/master_bot.conf")

def create_example_script():
    """Create example usage script"""
    
    example_content = '''"""
Master Trading Bot - Example Usage
Built with Enhanced Sovereign BLD Architecture

This script demonstrates how to use the Master Trading Bot
to compete against 21 static trading bots using adaptive strategies.
"""

from master_bot import MasterTradingBot
import logging

def main():
    """Run Master Trading Bot in competitive mode"""
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('logs/master_bot.log'),
            logging.StreamHandler()
        ]
    )
    
    print("🚀 Master Trading Bot - Competitive Mode")
    print("=" * 50)
    print("🎯 Mission: Beat 21 static bots with adaptive intelligence")
    print("⚡ Features: 8-strategy arsenal + dynamic regime detection")
    print("🛡️ Risk: Qullamaggie sizing + volatility-adjusted leverage")
    print()
    
    # Initialize Master Bot
    bot = MasterTradingBot(
        capital=100000,                    # $100k starting capital
        ict_analyzer=True,                 # Use ICT framework
        qullamaggie_sizing=True,           # Use proven position sizing
        warsh_shock_detection=True         # Event-driven awareness
    )
    
    try:
        # Start competitive trading
        print("🏁 Starting competitive trading...")
        bot.start_competitive_mode(competitor_bots=21)
        
    except KeyboardInterrupt:
        print("\\n⏹️ Trading stopped by user")
        
    finally:
        # Get final performance summary
        summary = bot.stop_trading()
        
        print("\\n" + "=" * 50)
        print("📊 FINAL PERFORMANCE SUMMARY")
        print("=" * 50)
        
        for key, value in summary.items():
            if isinstance(value, float):
                if 'pct' in key.lower() or 'rate' in key.lower() or 'return' in key.lower():
                    print(f"{key:20}: {value:6.2f}%")
                else:
                    print(f"{key:20}: {value:10,.2f}")
            else:
                print(f"{key:20}: {value}")

if __name__ == "__main__":
    main()
'''
    
    with open('example_usage.py', 'w') as f:
        f.write(example_content)
    
    print("✅ Created example script: example_usage.py")

if __name__ == "__main__":
    setup_master_bot()