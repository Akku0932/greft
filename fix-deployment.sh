#!/bin/bash

echo "🔧 Fixing Greft Comics deployment..."

# Install required dependencies
echo "📦 Installing dependencies..."
npm install express cors node-fetch

# Create ecosystem config
echo "⚙️ Creating PM2 config..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'greft-comics-api',
    script: 'api-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
EOF

# Start API server
echo "🚀 Starting API server..."
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

echo "✅ Fix complete!"
echo "🌐 Your app should now work at: http://until-refuse.gl.at.ply.gg:48103/"
echo "🔍 Check API health: http://until-refuse.gl.at.ply.gg:48103/api/mp?p=popular-updates"
echo "📊 Monitor with: pm2 logs greft-comics-api"
