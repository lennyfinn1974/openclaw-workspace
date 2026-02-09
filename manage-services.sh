#!/bin/bash
# OpenClaw Services Management Script

LAUNCHD_DIR="$HOME/Library/LaunchAgents"
SERVICES=(
    "com.openclaw.gateway"
    "com.openclaw.nexus-agent"
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
        echo "  Port 3002 (Kanban API): $(curl -s http://localhost:3002/health > /dev/null && echo '✅ Active' || echo '❌ Down')" 
        echo "  Port 5174 (Kanban UI): $(curl -s http://localhost:5174 > /dev/null && echo '✅ Active' || echo '❌ Down')"
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
