#!/usr/bin/env python3
import time
import subprocess
import json
from datetime import datetime

def check_agent_processes():
    """Check for agents by ID and related processes"""
    processes = subprocess.run(['ps', 'aux'], capture_output=True, text=True).stdout
    
    agents_found = {
        '2033': False,
        '2034': False, 
        '2036': False
    }
    
    for line in processes.split('\n'):
        for agent_id in agents_found.keys():
            if agent_id in line:
                agents_found[agent_id] = True
                
    return agents_found

def check_trading_platform_status():
    """Check trading platform processes"""
    processes = subprocess.run(['ps', 'aux'], capture_output=True, text=True).stdout
    trading_processes = []
    
    for line in processes.split('\n'):
        if 'trading-platform' in line or 'node_modules/.bin/concurrently' in line:
            trading_processes.append(line.strip())
            
    return trading_processes

def monitor_loop():
    """Main monitoring loop"""
    print("🚀 STARTING SUPERIOR TRADING BOT AGENT MONITORING")
    print("Target Agents: 2033 (Layers 1-2), 2034 (Layers 3-4), 2036 (Layers 5-7)")
    print("Monitoring interval: 2 minutes")
    print("=" * 60)
    
    while True:
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # Check for target agents
        agents = check_agent_processes()
        trading_procs = check_trading_platform_status()
        
        # Report status
        print(f"\n[{timestamp}] STATUS CHECK:")
        print(f"  Agent 2033 (Observation+Patterns): {'✅ FOUND' if agents['2033'] else '❌ NOT FOUND'}")
        print(f"  Agent 2034 (Synthesis+Intelligence): {'✅ FOUND' if agents['2034'] else '❌ NOT FOUND'}")
        print(f"  Agent 2036 (Allocator+Risk+Dashboard): {'✅ FOUND' if agents['2036'] else '❌ NOT FOUND'}")
        print(f"  Trading Platform Processes: {len(trading_procs)} active")
        
        # Alert if any agents are found
        active_agents = [aid for aid, found in agents.items() if found]
        if active_agents:
            print(f"🔥 ALERT: Agents {', '.join(active_agents)} are now ACTIVE!")
            
        # Wait 2 minutes
        time.sleep(120)

if __name__ == "__main__":
    monitor_loop()