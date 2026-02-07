#!/bin/bash
# Auto-Startup System Installer for OpenClaw Platform Stack
# Creates macOS launchd services for automatic restart on boot

echo "🚀 Installing Auto-Startup System for OpenClaw Platform Stack"

# Define workspace path
WORKSPACE="/Users/lennyfinn/.openclaw/workspace"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"

# Ensure LaunchAgents directory exists
mkdir -p "$LAUNCHD_DIR"

echo "📁 Creating startup services..."

# 1. OpenClaw Gateway Service
cat > "$LAUNCHD_DIR/com.openclaw.gateway.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/openclaw</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/Users/lennyfinn/.openclaw/workspace/logs/gateway-error.log</string>
    <key>StandardOutPath</key>
    <string>/Users/lennyfinn/.openclaw/workspace/logs/gateway.log</string>
    <key>WorkingDirectory</key>
    <string>/Users/lennyfinn/.openclaw/workspace</string>
</dict>
</plist>
EOF

# 2. Trading Platform (Arena) Service
cat > "$LAUNCHD_DIR/com.openclaw.trading-platform.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.trading-platform</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/npm</string>
        <string>run</string>
        <string>dev</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/Users/lennyfinn/.openclaw/workspace/logs/trading-platform-error.log</string>
    <key>StandardOutPath</key>
    <string>/Users/lennyfinn/.openclaw/workspace/logs/trading-platform.log</string>
    <key>WorkingDirectory</key>
    <string>/Users/lennyfinn/.openclaw/workspace/trading-platform</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

# 3. Hybrid Kanban Platform Service  
cat > "$LAUNCHD_DIR/com.openclaw.hybrid-kanban.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.hybrid-kanban</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/npm</string>
        <string>run</string>
        <string>dev:full</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/Users/lennyfinn/.openclaw/workspace/logs/hybrid-kanban-error.log</string>
    <key>StandardOutPath</key>
    <string>/Users/lennyfinn/.openclaw/workspace/logs/hybrid-kanban.log</string>
    <key>WorkingDirectory</key>
    <string>/Users/lennyfinn/.openclaw/workspace/hybrid-kanban-platform</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

# 4. Sovereign Core Service
cat > "$LAUNCHD_DIR/com.openclaw.sovereign-core.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.sovereign-core</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/lennyfinn/.openclaw/workspace/sovereign-core/venv/bin/python</string>
        <string>server.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/Users/lennyfinn/.openclaw/workspace/logs/sovereign-core-error.log</string>
    <key>StandardOutPath</key>
    <string>/Users/lennyfinn/.openclaw/workspace/logs/sovereign-core.log</string>
    <key>WorkingDirectory</key>
    <string>/Users/lennyfinn/.openclaw/workspace/sovereign-core</string>
</dict>
</plist>
EOF

# Create logs directory if it doesn't exist
mkdir -p "$WORKSPACE/logs"

echo "🔧 Loading services into launchd..."

# Load all services
launchctl load "$LAUNCHD_DIR/com.openclaw.gateway.plist"
launchctl load "$LAUNCHD_DIR/com.openclaw.trading-platform.plist" 
launchctl load "$LAUNCHD_DIR/com.openclaw.hybrid-kanban.plist"
launchctl load "$LAUNCHD_DIR/com.openclaw.sovereign-core.plist"

echo "✅ Auto-startup system installed successfully!"
echo ""
echo "📊 Services Status:"
launchctl list | grep "com.openclaw"

echo ""
echo "🔍 Service Management Commands:"
echo "  View logs: tail -f ~/.openclaw/workspace/logs/*.log"
echo "  Stop service: launchctl unload ~/Library/LaunchAgents/com.openclaw.[service].plist"
echo "  Start service: launchctl load ~/Library/LaunchAgents/com.openclaw.[service].plist"
echo "  Restart service: launchctl unload [file] && launchctl load [file]"
echo ""
echo "🚀 All services will now start automatically on Mac restart!"

# Create management script for easy control
cat > "$WORKSPACE/manage-services.sh" << 'EOF'
#!/bin/bash
# OpenClaw Services Management Script

LAUNCHD_DIR="$HOME/Library/LaunchAgents"
SERVICES=(
    "com.openclaw.gateway"
    "com.openclaw.trading-platform" 
    "com.openclaw.hybrid-kanban"
    "com.openclaw.sovereign-core"
)

case "$1" in
    "start")
        echo "🚀 Starting all OpenClaw services..."
        for service in "${SERVICES[@]}"; do
            launchctl load "$LAUNCHD_DIR/$service.plist" 2>/dev/null
            echo "  ✅ $service"
        done
        ;;
    "stop")
        echo "🛑 Stopping all OpenClaw services..."
        for service in "${SERVICES[@]}"; do
            launchctl unload "$LAUNCHD_DIR/$service.plist" 2>/dev/null
            echo "  ⏹️  $service"
        done
        ;;
    "restart")
        echo "🔄 Restarting all OpenClaw services..."
        for service in "${SERVICES[@]}"; do
            launchctl unload "$LAUNCHD_DIR/$service.plist" 2>/dev/null
            launchctl load "$LAUNCHD_DIR/$service.plist" 2>/dev/null
            echo "  🔄 $service"
        done
        ;;
    "status")
        echo "📊 OpenClaw Services Status:"
        for service in "${SERVICES[@]}"; do
            if launchctl list | grep -q "$service"; then
                echo "  ✅ $service - Running"
            else
                echo "  ❌ $service - Stopped"
            fi
        done
        echo ""
        echo "🌐 Port Status:"
        echo "  Port 3000 (Arena): $(curl -s http://localhost:3000 > /dev/null && echo '✅ Active' || echo '❌ Down')"
        echo "  Port 3001 (Kanban): $(curl -s http://localhost:3001 > /dev/null && echo '✅ Active' || echo '❌ Down')"
        echo "  Port 8081 (Nexus): $(curl -s http://localhost:8081 > /dev/null && echo '✅ Active' || echo '❌ Down')"
        ;;
    "logs")
        echo "📝 Tailing all service logs..."
        tail -f ~/.openclaw/workspace/logs/*.log
        ;;
    *)
        echo "OpenClaw Services Manager"
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services"
        echo "  stop    - Stop all services"  
        echo "  restart - Restart all services"
        echo "  status  - Show service and port status"
        echo "  logs    - Tail all service logs"
        ;;
esac
EOF

chmod +x "$WORKSPACE/manage-services.sh"

echo "🎛️  Service manager created: $WORKSPACE/manage-services.sh"
echo "   Usage: ./manage-services.sh {start|stop|restart|status|logs}"