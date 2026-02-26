# VPS Backup & Deployment Guide
**Remtullah Medical Laboratory System**

This guide explains how to backup your entire system (files + database) and deploy it on your VPS.

---

## Table of Contents
1. [Quick Backup Overview](#quick-backup-overview)
2. [Complete System Backup](#complete-system-backup)
3. [Database Backup](#database-backup)
4. [VPS Deployment](#vps-deployment)
5. [Automated Backup Script](#automated-backup-script)
6. [Restore Procedures](#restore-procedures)

---

## Quick Backup Overview

Your system has **two main components** to backup:

1. **Application Files** - All source code, configurations, and assets
2. **Database** - All data (patients, visits, tests, inventory, etc.)

---

## Complete System Backup

### Method 1: Export Application Files (Current System)

Create a ZIP archive of the entire project:

```bash
# Navigate to your project directory
cd /path/to/project

# Create backup with timestamp
tar -czf remtullah-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.vite' \
  --exclude='*.log' \
  .

# Or use zip
zip -r remtullah-backup-$(date +%Y%m%d-%H%M%S).zip . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x ".vite/*" \
  -x "*.log"
```

### Method 2: Export from Git Repository

If using Git:

```bash
# Clone your repository
git clone <your-repo-url> remtullah-backup
cd remtullah-backup

# Create archive
tar -czf ../remtullah-app-$(date +%Y%m%d).tar.gz .
```

### Essential Files to Include

✅ **Must Include:**
- `/src` - All source code
- `/supabase/migrations` - Database schema history
- `/supabase/functions` - Edge functions
- `package.json` & `package-lock.json` - Dependencies
- `vite.config.ts`, `tsconfig.json` - Build configs
- `tailwind.config.js`, `postcss.config.js` - Styling
- `.env.example` - Environment template

❌ **Exclude (will regenerate):**
- `node_modules` - Install with npm
- `dist` - Build output
- `.vite` - Vite cache
- `.git` - Version control (optional)

---

## Database Backup

### Option 1: Export via Supabase Dashboard (Recommended)

1. **Login to Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to your project**
3. **Go to Database > Backups**
4. **Download backup** (includes schema + data)

### Option 2: Export Using pg_dump (Complete Backup)

```bash
# Export entire database (schema + data)
pg_dump \
  --host=db.rjjxheikbfzrmdvjfrva.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --file=remtullah-db-$(date +%Y%m%d-%H%M%S).sql

# Compress the backup
gzip remtullah-db-$(date +%Y%m%d-%H%M%S).sql
```

You'll need:
- Database host: `db.rjjxheikbfzrmdvjfrva.supabase.co`
- Database password: (from Supabase project settings)
- Port: `5432`

### Option 3: Export Schema Only (No Data)

```bash
# Export only the schema structure
pg_dump \
  --host=db.rjjxheikbfzrmdvjfrva.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema-only \
  --no-owner \
  --no-acl \
  --file=remtullah-schema-$(date +%Y%m%d).sql
```

### Option 4: Export Data Only (No Schema)

```bash
# Export only the data
pg_dump \
  --host=db.rjjxheikbfzrmdvjfrva.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --data-only \
  --no-owner \
  --no-acl \
  --file=remtullah-data-$(date +%Y%m%d).sql
```

### Option 5: Use Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref rjjxheikbfzrmdvjfrva

# Pull current schema
supabase db pull

# Dump database
supabase db dump --file remtullah-backup-$(date +%Y%m%d).sql
```

---

## VPS Deployment

### Prerequisites

Your VPS needs:
- **Node.js 18+** and **npm**
- **PostgreSQL 14+** (or use managed Supabase)
- **Nginx** (web server)
- **PM2** (process manager)
- **SSL certificate** (Let's Encrypt)

### Step 1: Prepare VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL (if not using Supabase)
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential
```

### Step 2: Upload Application Files

```bash
# On your local machine, upload files to VPS
scp remtullah-backup-20260226.tar.gz user@your-vps-ip:/home/user/

# Or use rsync for incremental sync
rsync -avz --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  ./ user@your-vps-ip:/var/www/remtullah/
```

### Step 3: Setup Application on VPS

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Extract backup
cd /var/www
sudo mkdir -p remtullah
cd remtullah
sudo tar -xzf ~/remtullah-backup-20260226.tar.gz

# Set ownership
sudo chown -R $USER:$USER /var/www/remtullah

# Install dependencies
npm ci --production

# Create .env file
cp .env.example .env
nano .env
```

### Step 4: Configure Environment Variables

Edit `/var/www/remtullah/.env`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://rjjxheikbfzrmdvjfrva.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Production Settings
NODE_ENV=production
```

### Step 5: Build Application

```bash
# Build for production
npm run build

# Test the build
npm run preview
```

This creates optimized files in `/var/www/remtullah/dist/`

### Step 6: Setup Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/remtullah
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/remtullah/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/remtullah /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 7: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is setup automatically
# Test renewal
sudo certbot renew --dry-run
```

### Step 8: Database Setup

#### Option A: Use Existing Supabase (Recommended)

No additional setup needed. Your app connects to Supabase cloud.

#### Option B: Restore to Local PostgreSQL

```bash
# Create database
sudo -u postgres createdb remtullah

# Restore from backup
sudo -u postgres psql remtullah < remtullah-db-backup.sql

# Update .env to use local database
VITE_SUPABASE_URL=http://localhost:54321
```

### Step 9: Setup Auto-Deployment Script

Create deployment script:

```bash
nano /var/www/remtullah/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest code (if using git)
# git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build application
echo "🏗️  Building application..."
npm run build

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment complete!"
```

Make executable:

```bash
chmod +x /var/www/remtullah/deploy.sh
```

---

## Automated Backup Script

### Create Backup Script on VPS

```bash
nano /home/user/backup-remtullah.sh
```

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/home/user/backups"
APP_DIR="/var/www/remtullah"
DB_HOST="db.rjjxheikbfzrmdvjfrva.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

echo "🔄 Starting backup process..."

# 1. Backup Application Files
echo "📁 Backing up application files..."
tar -czf $BACKUP_DIR/app-backup-$DATE.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  -C $APP_DIR .

# 2. Backup Database
echo "🗄️  Backing up database..."
export PGPASSWORD="your_db_password"
pg_dump \
  --host=$DB_HOST \
  --port=5432 \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --no-owner \
  --no-acl \
  --file=$BACKUP_DIR/db-backup-$DATE.sql

# Compress database backup
gzip $BACKUP_DIR/db-backup-$DATE.sql

# 3. Create combined backup
echo "📦 Creating combined backup..."
tar -czf $BACKUP_DIR/complete-backup-$DATE.tar.gz \
  -C $BACKUP_DIR \
  app-backup-$DATE.tar.gz \
  db-backup-$DATE.sql.gz

# 4. Cleanup old backups
echo "🧹 Cleaning up old backups (older than $RETENTION_DAYS days)..."
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 5. Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/complete-backup-$DATE.tar.gz s3://your-bucket/
# rclone copy $BACKUP_DIR/complete-backup-$DATE.tar.gz remote:backups/

echo "✅ Backup completed: complete-backup-$DATE.tar.gz"
echo "📊 Backup size: $(du -h $BACKUP_DIR/complete-backup-$DATE.tar.gz | cut -f1)"
```

Make executable:

```bash
chmod +x /home/user/backup-remtullah.sh
```

### Schedule Automatic Backups

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /home/user/backup-remtullah.sh >> /home/user/backup.log 2>&1

# Or weekly on Sundays at 3 AM
0 3 * * 0 /home/user/backup-remtullah.sh >> /home/user/backup.log 2>&1
```

---

## Restore Procedures

### Restore Application Files

```bash
# Extract backup
cd /var/www/remtullah
tar -xzf /home/user/backups/app-backup-20260226.tar.gz

# Install dependencies
npm ci

# Build
npm run build

# Restart Nginx
sudo systemctl restart nginx
```

### Restore Database

```bash
# From compressed backup
gunzip -c /home/user/backups/db-backup-20260226.sql.gz | \
  psql -h db.rjjxheikbfzrmdvjfrva.supabase.co \
       -U postgres \
       -d postgres

# Or from uncompressed
psql -h db.rjjxheikbfzrmdvjfrva.supabase.co \
     -U postgres \
     -d postgres \
     -f /home/user/backups/db-backup-20260226.sql
```

### Emergency Full Restore

```bash
# 1. Extract complete backup
cd /tmp
tar -xzf /home/user/backups/complete-backup-20260226.tar.gz

# 2. Restore application
cd /var/www/remtullah
tar -xzf /tmp/app-backup-20260226.tar.gz
npm ci
npm run build

# 3. Restore database
gunzip -c /tmp/db-backup-20260226.sql.gz | \
  psql -h db.rjjxheikbfzrmdvjfrva.supabase.co -U postgres -d postgres

# 4. Restart services
sudo systemctl restart nginx
```

---

## Backup Best Practices

### 1. Multiple Backup Locations

Store backups in:
- ✅ VPS local storage
- ✅ Cloud storage (AWS S3, Google Cloud, DigitalOcean Spaces)
- ✅ External server
- ✅ Local machine

### 2. Test Restores Regularly

```bash
# Monthly restore test
./backup-remtullah.sh
# Then restore to test environment
```

### 3. Monitor Backup Success

```bash
# Check backup logs
tail -f /home/user/backup.log

# Check backup size trends
ls -lh /home/user/backups/
```

### 4. Backup Before Changes

Always backup before:
- Major updates
- Database migrations
- Configuration changes
- Server maintenance

---

## Quick Reference Commands

```bash
# Manual backup
./backup-remtullah.sh

# Check backup size
du -sh /home/user/backups/*

# List backups
ls -lh /home/user/backups/

# Restore latest backup
LATEST=$(ls -t /home/user/backups/complete-backup-*.tar.gz | head -1)
tar -xzf $LATEST -C /tmp/restore

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Rebuild application
cd /var/www/remtullah && npm run build

# Check disk space
df -h
```

---

## Troubleshooting

### Problem: Backup fails with "disk full"

```bash
# Check disk space
df -h

# Clean old backups
find /home/user/backups -mtime +7 -delete

# Clean system cache
sudo apt clean
```

### Problem: Database restore fails

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h db.rjjxheikbfzrmdvjfrva.supabase.co -U postgres -d postgres -c "SELECT 1"

# Check backup file integrity
gunzip -t db-backup-20260226.sql.gz
```

### Problem: Application won't build

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Build again
npm run build
```

---

## Security Checklist

- [ ] Database passwords stored securely (not in scripts)
- [ ] Backup directory has restricted permissions (700)
- [ ] SSL certificate installed and auto-renewing
- [ ] Firewall configured (UFW or iptables)
- [ ] SSH key-based authentication enabled
- [ ] Regular security updates applied
- [ ] Backup files encrypted (optional but recommended)

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Nginx Docs**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/
- **PostgreSQL Backup**: https://www.postgresql.org/docs/current/backup.html

---

**Last Updated**: 2026-02-26
**Version**: 1.0
