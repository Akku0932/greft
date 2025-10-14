#!/bin/bash

echo "🚀 Quick Deploy Script for Greft Comics"
echo "URL: http://key-switching.gl.at.ply.gg:2942/"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Create PM2 ecosystem file
echo "⚙️ Creating PM2 configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'greft-comics',
    script: 'api-server-esm.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 2942,
      BASE_URL: 'http://key-switching.gl.at.ply.gg:2942'
    }
  }]
}
EOF

# Stop existing PM2 process if running
echo "🛑 Stopping existing processes..."
pm2 stop greft-comics 2>/dev/null || true
pm2 delete greft-comics 2>/dev/null || true

# Start the application
echo "🚀 Starting application..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app is now running at:"
echo "   http://key-switching.gl.at.ply.gg:2942/"
echo ""
echo "🔍 Test API health:"
echo "   http://key-switching.gl.at.ply.gg:2942/api/mp?p=popular-updates"
echo ""
echo "📊 Monitor with:"
echo "   pm2 logs greft-comics"
echo "   pm2 status"
echo ""
echo "🔄 To restart:"
echo "   pm2 restart greft-comics"
echo ""
echo "🛑 To stop:"
echo "   pm2 stop greft-comics"
