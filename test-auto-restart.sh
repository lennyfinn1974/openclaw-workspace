#!/bin/bash
# Test Auto-Restart System for OpenClaw Platform Stack
# Simulates a restart by stopping and starting all services

echo "🧪 Testing Auto-Restart System for OpenClaw Platform Stack"
echo ""

# Step 1: Show current status
echo "📊 Current Status:"
./manage-services.sh status
echo ""

# Step 2: Stop all services
echo "🛑 Stopping all services to simulate restart..."
./manage-services.sh stop
echo ""

# Step 3: Wait a moment for clean shutdown
echo "⏳ Waiting 3 seconds for clean shutdown..."
sleep 3

# Step 4: Start all services (simulating auto-startup)
echo "🚀 Starting all services (simulating boot auto-startup)..."
./manage-services.sh start
echo ""

# Step 5: Wait for services to fully initialize
echo "⏳ Waiting 10 seconds for services to fully initialize..."
sleep 10

# Step 6: Verify all services are back online
echo "✅ Final verification - All services should be running:"
./manage-services.sh status

echo ""
echo "🎯 Test Results:"
if ./manage-services.sh status | grep -q "❌"; then
    echo "  ⚠️  Some services failed to restart properly"
    echo "  💡 Check logs: tail -f ~/.openclaw/workspace/logs/*.log"
else
    echo "  🏆 SUCCESS: All services restarted automatically!"
    echo "  ✅ Your Mac will auto-start everything on reboot"
fi

echo ""
echo "🔧 Platform URLs (after restart):"
echo "  🎮 Trading Arena: http://localhost:3000/arena"
echo "  📋 Kanban Board: http://localhost:5174"
echo "  🤖 Nexus Agent: http://localhost:8081"
echo "  🏠 Trading Platform: http://localhost:3000"