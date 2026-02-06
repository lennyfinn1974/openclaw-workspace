#!/usr/bin/env python3
"""
Gateway Auto-Restart System
Handles automated gateway restart with proper logging and safety checks
"""

import subprocess
import sys
import os
import json
from datetime import datetime

LOG_FILE = os.path.expanduser("~/gateway-restarts.log")

def log_message(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"{timestamp}: {message}\n")
    print(f"{timestamp}: {message}")

def check_gateway_health():
    """Check if gateway is healthy via status command"""
    try:
        result = subprocess.run(['openclaw', 'gateway', 'status'], 
                              capture_output=True, text=True, timeout=10)
        return "RPC probe: ok" in result.stdout
    except Exception as e:
        log_message(f"Gateway health check failed: {e}")
        return False

def restart_gateway(reason="Health check failed"):
    """Restart gateway using OpenClaw's built-in restart"""
    try:
        log_message(f"🚨 RESTARTING GATEWAY: {reason}")
        
        # Using the gateway tool directly would be ideal, but we're in a script
        # So we'll use the OpenClaw CLI restart command
        result = subprocess.run(['openclaw', 'gateway', 'restart'], 
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            log_message("✅ Gateway restart command executed successfully")
            return True
        else:
            log_message(f"❌ Gateway restart failed: {result.stderr}")
            return False
            
    except Exception as e:
        log_message(f"❌ Gateway restart exception: {e}")
        return False

def main():
    if not check_gateway_health():
        log_message("Gateway health check failed - initiating restart")
        success = restart_gateway("Automated health check failure")
        if success:
            # Wait a moment and verify restart worked
            import time
            time.sleep(5)
            if check_gateway_health():
                log_message("✅ Gateway restart successful - health restored")
                return 0
            else:
                log_message("❌ Gateway restart failed - still unhealthy")
                return 1
        else:
            log_message("❌ Could not restart gateway")
            return 1
    else:
        log_message("✅ Gateway healthy - no action needed")
        return 0

if __name__ == "__main__":
    sys.exit(main())