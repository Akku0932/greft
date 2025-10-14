# Deploy Greft Comics to Ubuntu Server

## Prerequisites
- Ubuntu 20.04+ server
- Node.js 18+ installed
- Nginx installed
- Domain name (optional but recommended)

## Step 1: Install Node.js and Nginx

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Nginx
sudo apt install nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 2: Upload and Build the Application

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

# Install PM2 for process management
sudo npm install -g pm2
```

## Step 3: Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/greft-comics
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain
    
    # API proxy to Express server
    location /api/ {
        proxy_pass http://localhost:3001;
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
    
    # Serve static files
    root /var/www/greft-comics/dist;
    index index.html;
    
    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

Enable the site:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/greft-comics /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 4: Set up SSL with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 5: Set up PM2 for Process Management

```bash
# Create ecosystem file
nano /var/www/greft-comics/ecosystem.config.js
```

Add this to `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'greft-comics-api',
    script: 'api-server.js',
    cwd: '/var/www/greft-comics',
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
```

Start the API server:

```bash
# Start the API server with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

## Step 6: Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Allow SSH (if not already allowed)
sudo ufw allow ssh

# Enable firewall
sudo ufw enable
```

## Step 7: Environment Variables

Make sure your environment variables are set correctly. Create a `.env` file in your project root:

```bash
nano /var/www/greft-comics/.env
```

Add your Supabase configuration:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 8: Auto-deployment Script (Optional)

Create a deployment script:

```bash
nano /var/www/greft-comics/deploy.sh
```

Add this content:

```bash
#!/bin/bash
echo "Starting deployment..."

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build the application
npm run build

# Restart services
sudo systemctl reload nginx

echo "Deployment completed!"
```

Make it executable:

```bash
chmod +x /var/www/greft-comics/deploy.sh
```

## Troubleshooting

### Check Nginx status:
```bash
sudo systemctl status nginx
```

### Check Nginx logs:
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Check if port 80 is open:
```bash
sudo netstat -tlnp | grep :80
```

### Test the build locally:
```bash
npm run preview
```

## File Permissions

Make sure the web server can read the files:

```bash
sudo chown -R www-data:www-data /var/www/greft-comics/dist
sudo chmod -R 755 /var/www/greft-comics/dist
```

## Notes

1. Replace `your-domain.com` with your actual domain name
2. Make sure your domain points to your server's IP address
3. The application will be available at `http://your-domain.com` or `https://your-domain.com` (with SSL)
4. All client-side routing will work correctly with the Nginx configuration
5. Static assets will be cached for better performance
