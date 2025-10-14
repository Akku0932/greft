# 🚀 Complete Ubuntu Setup Guide for Greft Comics

## Your App URL: http://key-switching.gl.at.ply.gg:2942/

---

## Step 1: Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx (optional, for reverse proxy)
sudo apt install nginx -y
```

---

## Step 2: Deploy Your App

```bash
# Create app directory
sudo mkdir -p /var/www/greft-comics
sudo chown -R $USER:$USER /var/www/greft-comics

# Upload your project files to /var/www/greft-comics/
# You can use scp, rsync, or git clone

# Navigate to project directory
cd /var/www/greft-comics

# Install dependencies
npm install

# Build the application
npm run build
```

---

## Step 3: Start the Application

### Option A: Direct Start (Simple)
```bash
# Start the server directly
PORT=2942 node api-server-esm.js
```

### Option B: PM2 (Recommended for Production)
```bash
# Create PM2 ecosystem file
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

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

---

## Step 4: Firewall Configuration

```bash
# Allow your specific port
sudo ufw allow 2942

# Allow SSH (if not already allowed)
sudo ufw allow ssh

# Enable firewall
sudo ufw enable
```

---

## Step 5: Test Your Deployment

### Health Checks:
- **Main App**: http://key-switching.gl.at.ply.gg:2942/
- **API Health**: http://key-switching.gl.at.ply.gg:2942/api/mp?p=popular-updates
- **Health Endpoint**: http://key-switching.gl.at.ply.gg:2942/health

### Expected Results:
- Main app should load with manga data
- API health should return JSON data
- All images should load properly

---

## Step 6: Monitoring & Management

### PM2 Commands:
```bash
# View logs
pm2 logs greft-comics

# Restart app
pm2 restart greft-comics

# Stop app
pm2 stop greft-comics

# View status
pm2 status

# Monitor resources
pm2 monit
```

### Manual Commands:
```bash
# Check if port is listening
sudo netstat -tlnp | grep :2942

# Check process
ps aux | grep node

# Kill process if needed
sudo pkill -f api-server-esm.js
```

---

## Step 7: Domain Setup (When You Get One)

When you get a domain, simply update the environment variable:

```bash
# Update PM2 with new domain
pm2 set greft-comics:BASE_URL https://yourdomain.com

# Or restart with new environment
pm2 restart greft-comics --update-env
```

Or update the `ecosystem.config.js`:
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 2942,
  BASE_URL: 'https://yourdomain.com'  // Change this
}
```

---

## Step 8: Nginx Reverse Proxy (Optional)

If you want to use Nginx as a reverse proxy:

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/greft-comics
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name key-switching.gl.at.ply.gg;  # Your domain
    
    location / {
        proxy_pass http://localhost:2942;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/greft-comics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Troubleshooting

### App Not Loading Data:
1. Check if the server is running: `pm2 status`
2. Check logs: `pm2 logs greft-comics`
3. Test API directly: `curl http://localhost:2942/api/mp?p=popular-updates`

### Port Issues:
1. Check if port is open: `sudo netstat -tlnp | grep :2942`
2. Check firewall: `sudo ufw status`
3. Try a different port: `PORT=3000 node api-server-esm.js`

### Build Issues:
1. Clear node_modules: `rm -rf node_modules package-lock.json`
2. Reinstall: `npm install`
3. Rebuild: `npm run build`

### Memory Issues:
1. Check memory usage: `pm2 monit`
2. Restart app: `pm2 restart greft-comics`
3. Increase memory limit in ecosystem.config.js

---

## Quick Commands Summary

```bash
# Deploy and start
cd /var/www/greft-comics
npm install
npm run build
pm2 start ecosystem.config.js

# Monitor
pm2 logs greft-comics
pm2 status

# Restart
pm2 restart greft-comics

# Stop
pm2 stop greft-comics
```

---

## Your App URLs:
- **Main App**: http://key-switching.gl.at.ply.gg:2942/
- **API Health**: http://key-switching.gl.at.ply.gg:2942/api/mp?p=popular-updates
- **Health Check**: http://key-switching.gl.at.ply.gg:2942/health

**🎉 Your Greft Comics app should now be fully functional!**
