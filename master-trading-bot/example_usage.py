"""
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
        print("\n⏹️ Trading stopped by user")
        
    finally:
        # Get final performance summary
        summary = bot.stop_trading()
        
        print("\n" + "=" * 50)
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
