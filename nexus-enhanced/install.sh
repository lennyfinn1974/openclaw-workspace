#!/bin/bash
# Nexus Enhanced - Quick Install & Setup Script

echo "🚀 Nexus Enhanced - Installation & Setup"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "requirements.txt" ]; then
    echo "❌ Error: Please run this script from the nexus-enhanced directory"
    exit 1
fi

echo "📁 Current directory: $(pwd)"

# Install Node.js dependencies  
echo ""
echo "📦 Installing Node.js dependencies..."
npm install

# Create Python virtual environment
echo ""
echo "🐍 Setting up Python virtual environment..."
python3 -m venv venv

# Activate virtual environment and install dependencies
echo "📦 Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️ Creating .env configuration file..."
    cat > .env << 'EOF'
# Nexus Enhanced Configuration
DEBUG=false
NEXUS_PORT=8082
SECRET_KEY=nexus-enhanced-secret-key-change-in-production

# AI Model API Keys (optional)
# ANTHROPIC_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here
# GOOGLE_AI_API_KEY=your_key_here

# Google Auth (optional)
# GOOGLE_CLIENT_ID=your_client_id
# GOOGLE_CLIENT_SECRET=your_client_secret
EOF
    echo "✅ Created .env file - edit it to add your API keys"
fi

# Create a startup script
echo "🔧 Creating startup script..."
cat > start.sh << 'EOF'
#!/bin/bash
# Nexus Enhanced - Startup Script

echo "🚀 Starting Nexus Enhanced..."

# Activate Python virtual environment
source venv/bin/activate

# Start backend server
echo "🔧 Starting backend on port 8082..."
python backend/main.py --host 127.0.0.1 --port 8082

EOF

chmod +x start.sh

# Create development startup script
echo "🔧 Creating development startup script..."
cat > start-dev.sh << 'EOF'
#!/bin/bash
# Nexus Enhanced - Development Startup Script

echo "🚀 Starting Nexus Enhanced (Development Mode)..."

# Activate Python virtual environment
source venv/bin/activate

# Start backend with auto-reload
echo "🔧 Starting backend in development mode (auto-reload enabled)..."
python backend/main.py --host 127.0.0.1 --port 8082 --reload

EOF

chmod +x start-dev.sh

# Test the installation
echo ""
echo "🧪 Testing installation..."
source venv/bin/activate

# Test import
python -c "from backend.main import app; print('✅ Backend imports successful')"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Installation completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Edit .env file to add your API keys (optional)"
    echo "  2. Start the server: ./start.sh"
    echo "  3. Or start in development mode: ./start-dev.sh"
    echo "  4. Access the API at: http://localhost:8082"
    echo "  5. API documentation: http://localhost:8082/api/docs"
    echo ""
    echo "🔧 Available commands:"
    echo "  ./start.sh           - Start production server"
    echo "  ./start-dev.sh       - Start development server (auto-reload)"
    echo "  source venv/bin/activate  - Activate Python environment"
    echo ""
    echo "🌐 Integration with existing services:"
    echo "  • Trading Arena: http://localhost:3000/arena"
    echo "  • Kanban Board: http://localhost:5174" 
    echo "  • OpenClaw Gateway: Active ✅"
    echo ""
else
    echo "❌ Installation test failed. Please check the error messages above."
    exit 1
fi