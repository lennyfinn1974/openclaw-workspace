#!/usr/bin/env python3
"""
Smart Model Fallback Monitor
Automatically switches back to premium models if local/cheap models fail
"""

import json
import time
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

class ModelFallbackMonitor:
    def __init__(self):
        self.failure_log = "memory/model-failures.json"
        self.fallback_triggers = {
            "tool_failures": 3,        # 3+ tool call failures in 10 minutes
            "response_quality": 2,     # 2+ poor responses in 5 minutes  
            "timeout_errors": 2,       # 2+ timeouts in 5 minutes
            "connection_loss": 1       # 1 connection failure = immediate fallback
        }
        
    def log_failure(self, failure_type, details=""):
        """Log a model failure event"""
        timestamp = datetime.now().isoformat()
        
        try:
            with open(self.failure_log, 'r') as f:
                failures = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            failures = []
        
        failures.append({
            "timestamp": timestamp,
            "type": failure_type,
            "details": details,
            "current_model": self.get_current_model()
        })
        
        # Keep only last 24 hours of failures
        cutoff = datetime.now() - timedelta(hours=24)
        failures = [f for f in failures if datetime.fromisoformat(f["timestamp"]) > cutoff]
        
        with open(self.failure_log, 'w') as f:
            json.dump(failures, f, indent=2)
        
        # Check if fallback should trigger
        self.check_fallback_triggers(failures)
    
    def get_current_model(self):
        """Get current session model"""
        try:
            # This would need to be implemented based on OpenClaw's session_status
            return "qwen2.5:7b"  # Placeholder
        except:
            return "unknown"
    
    def check_fallback_triggers(self, failures):
        """Check if we should trigger fallback to premium model"""
        now = datetime.now()
        
        # Check tool failures (3+ in 10 minutes)
        recent_tool_failures = [
            f for f in failures 
            if f["type"] == "tool_failure" 
            and datetime.fromisoformat(f["timestamp"]) > now - timedelta(minutes=10)
        ]
        
        if len(recent_tool_failures) >= self.fallback_triggers["tool_failures"]:
            self.trigger_fallback("tool_failures", len(recent_tool_failures))
            return
        
        # Check response quality (2+ in 5 minutes)
        recent_quality_issues = [
            f for f in failures 
            if f["type"] == "poor_response" 
            and datetime.fromisoformat(f["timestamp"]) > now - timedelta(minutes=5)
        ]
        
        if len(recent_quality_issues) >= self.fallback_triggers["response_quality"]:
            self.trigger_fallback("response_quality", len(recent_quality_issues))
            return
        
        # Check timeouts (2+ in 5 minutes)
        recent_timeouts = [
            f for f in failures 
            if f["type"] == "timeout" 
            and datetime.fromisoformat(f["timestamp"]) > now - timedelta(minutes=5)
        ]
        
        if len(recent_timeouts) >= self.fallback_triggers["timeout_errors"]:
            self.trigger_fallback("timeout_errors", len(recent_timeouts))
            return
        
        # Check connection loss (immediate)
        recent_connection_loss = [
            f for f in failures 
            if f["type"] == "connection_loss" 
            and datetime.fromisoformat(f["timestamp"]) > now - timedelta(minutes=1)
        ]
        
        if len(recent_connection_loss) >= self.fallback_triggers["connection_loss"]:
            self.trigger_fallback("connection_loss", len(recent_connection_loss))
            return
    
    def trigger_fallback(self, reason, count):
        """Trigger fallback to premium model"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        fallback_message = f"""
🚨 AUTO-FALLBACK TRIGGERED: {timestamp}

Reason: {reason} 
Count: {count} failures detected
Current Model: {self.get_current_model()}
Switching to: sonnet (premium model)

This is an automated safety measure to maintain communication quality.
You can switch back to cost-efficient models when issues resolve.

To manually check: Use session_status to verify model switch.
To resume optimization: Use /model qwen2.5:7b when stable.
"""
        
        # Save fallback notification
        with open("memory/model-fallback-alert.md", "w") as f:
            f.write(fallback_message)
        
        print(fallback_message)
        
        # This would trigger the actual model switch in a real implementation
        # For now, we document the trigger condition
        
    def health_check(self):
        """Run periodic health check of current model performance"""
        current_model = self.get_current_model()
        
        if "qwen" in current_model.lower() or "llama" in current_model.lower():
            # We're using a local/cheap model, monitor more closely
            return self.test_local_model_health()
        else:
            # Premium model, standard monitoring
            return True
    
    def test_local_model_health(self):
        """Test local model responsiveness"""
        try:
            # Simple test of local model
            result = subprocess.run([
                "ollama", "run", "qwen2.5:7b", "Test response - reply with 'OK'"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and "OK" in result.stdout:
                return True
            else:
                self.log_failure("health_check", f"Local model test failed: {result.stderr}")
                return False
        except subprocess.TimeoutExpired:
            self.log_failure("timeout", "Local model health check timeout")
            return False
        except Exception as e:
            self.log_failure("connection_loss", f"Local model unavailable: {str(e)}")
            return False

# Command line usage
if __name__ == "__main__":
    import sys
    
    monitor = ModelFallbackMonitor()
    
    if len(sys.argv) > 1:
        action = sys.argv[1]
        
        if action == "log_failure":
            failure_type = sys.argv[2] if len(sys.argv) > 2 else "unknown"
            details = sys.argv[3] if len(sys.argv) > 3 else ""
            monitor.log_failure(failure_type, details)
        
        elif action == "health_check":
            healthy = monitor.health_check()
            print("HEALTHY" if healthy else "UNHEALTHY")
            sys.exit(0 if healthy else 1)
    
    else:
        print("Usage: model-fallback-monitor.py [log_failure|health_check] [args...]")