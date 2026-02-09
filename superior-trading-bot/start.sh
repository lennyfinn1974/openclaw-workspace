#!/bin/bash

# Superior Trading Bot - Layer 1 Observation Engine Startup Script

echo "🚀 Superior Trading Bot - Layer 1 Observation Engine"
echo "====================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$MAJOR_VERSION" -lt "18" ]; then
    echo -e "${RED}❌ Node.js 18+ required, found v$NODE_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js v$NODE_VERSION${NC}"

# Check TypeScript
if ! command -v tsc &> /dev/null; then
    echo -e "${YELLOW}⚠️  TypeScript not found globally, using local version${NC}"
fi

# Check if arena is running
echo -e "${BLUE}🔍 Checking arena connection...${NC}"
if curl -s --connect-timeout 3 http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Arena platform detected on localhost:3000${NC}"
else
    echo -e "${YELLOW}⚠️  Arena platform not detected on localhost:3000${NC}"
    echo -e "${YELLOW}   Observation engine will continue to attempt connection${NC}"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Build TypeScript
echo -e "${BLUE}🔨 Building TypeScript...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build completed${NC}"

# Check if ports are available
echo -e "${BLUE}🔍 Checking port availability...${NC}"

if lsof -Pi :8083 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 8083 is already in use${NC}"
    echo -e "   Dashboard may not start correctly"
else
    echo -e "${GREEN}✅ Port 8083 available for dashboard${NC}"
fi

# Create logs directory
mkdir -p logs

echo ""
echo -e "${GREEN}🎯 Starting Superior Trading Bot Layer 1...${NC}"
echo ""
echo -e "${BLUE}📡 Arena Connection:${NC} ws://localhost:3000"
echo -e "${BLUE}📊 Dashboard:${NC} http://localhost:8083"
echo -e "${BLUE}🔍 Status:${NC} Observing and enriching all arena events"
echo -e "${BLUE}💾 Buffer:${NC} 10,000 events with O(log n) queries"
echo -e "${BLUE}🧠 Intelligence:${NC} Real-time indicator enrichment + regime detection"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the system gracefully${NC}"
echo ""

# Start the application
node dist/index.js 2>&1 | tee logs/observation-engine-$(date +%Y%m%d-%H%M%S).log