# VPS Deployment Guide

This guide will help you deploy the Invotech Clinic application on your VPS using Docker.

## Prerequisites

- A VPS with Docker and Docker Compose installed
- SSH access to your VPS
- Domain name pointed to your VPS (optional, for HTTPS)

## Deployment Steps

### 1. Install Docker on Your VPS

If Docker is not already installed on your VPS, install it:

```bash
# Update packages
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
```

### 2. Transfer Your Application to VPS

Clone your repository or upload your application files to the VPS:

```bash
# Using git (recommended)
git clone <your-repository-url>
cd <your-project-directory>

# OR using rsync from your local machine
rsync -avz --exclude 'node_modules' --exclude '.git' ./ user@your-vps-ip:/path/to/app/
```

### 3. Configure Environment Variables

Create a `.env` file in your project root with your production configuration:

```bash
# Copy the example file
cp .env.production.example .env

# Edit with your actual values
nano .env
```

Make sure to update these critical values:
- `SESSION_SECRET`: Generate a secure random string (use: `openssl rand -base64 32`)
- Database credentials (if different from defaults)
- N8N webhook URLs (already configured in example)

### 4. Initialize the Database

Before starting the application, run the database migration:

```bash
# Run database migration (this will start postgres, run migration, and exit)
docker-compose --profile migration run --rm migrate

# Or if you need to force the migration
docker-compose --profile migration run --rm migrate sh -c "npm ci && npm run db:push -- --force"
```

### 5. Build and Start the Application

```bash
# Build and start all services
docker-compose up -d

# View logs to ensure everything is running
docker-compose logs -f
```

The application will be available at `http://your-vps-ip:5000`

### 6. Create Initial Admin User

You'll need to create your first admin user directly in the database or through an API call. You can use the PostgreSQL container:

```bash
# Access PostgreSQL (replace with your actual PGUSER and PGDATABASE from .env)
docker-compose exec postgres psql -U <your-pguser> -d <your-pgdatabase>

# Check if users table exists
\dt

# Insert an admin user (replace with your details)
-- You'll need to hash the password first using the API or another tool
```

Alternatively, you can create a temporary registration endpoint or use the API directly.

### 7. Configure Reverse Proxy (Recommended for Production)

For production, you should use a reverse proxy like Nginx with SSL:

```nginx
# /etc/nginx/sites-available/clinic
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable SSL with Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Useful Docker Commands

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f [service-name]

# Restart services
docker-compose restart

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Rebuild and restart after code changes
docker-compose up -d --build

# Access app container shell
docker-compose exec app sh

# Access database (replace clinicadmin with your PGUSER)
docker-compose exec postgres psql -U ${PGUSER} -d ${PGDATABASE}

# Run database migration
docker-compose --profile migration run --rm migrate

# Backup database (replace with your credentials)
docker-compose exec postgres pg_dump -U ${PGUSER} ${PGDATABASE} > backup.sql

# Restore database (replace with your credentials)
docker-compose exec -T postgres psql -U ${PGUSER} ${PGDATABASE} < backup.sql
```

## Updating Your Application

When you make changes to your code:

```bash
# Pull latest changes
git pull

# If schema changed, run migrations first
docker-compose --profile migration run --rm migrate

# Rebuild and restart
docker-compose up -d --build
```

## Monitoring and Maintenance

### View Application Logs
```bash
docker-compose logs -f app
```

### View Database Logs
```bash
docker-compose logs -f postgres
```

### Check Container Health
```bash
docker-compose ps
```

### Backup Strategy

Set up automated backups using a cron job:

```bash
# Create backup script (replace PGUSER and PGDATABASE with your values)
cat > /home/user/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
PGUSER="your-pguser"
PGDATABASE="your-pgdatabase"
docker-compose exec -T postgres pg_dump -U $PGUSER $PGDATABASE > /backups/clinic_backup_$DATE.sql
# Keep only last 7 days of backups
find /backups -name "clinic_backup_*.sql" -mtime +7 -delete
EOF

chmod +x /home/user/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/user/backup-db.sh
```

## Troubleshooting

### Application won't start
```bash
# Check logs
docker-compose logs app

# Common issues:
# - Database not ready: Wait a few seconds and restart
# - Port already in use: Change port in docker-compose.yml
```

### Database connection errors
```bash
# Verify database is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection (replace with your credentials)
docker-compose exec postgres psql -U <your-pguser> -d <your-pgdatabase> -c "SELECT 1"
```

### Cannot access from outside VPS
```bash
# Check firewall
sudo ufw status
sudo ufw allow 5000/tcp

# Or use nginx on port 80/443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Security Checklist

- [ ] **CRITICAL:** Rotate N8N webhook URLs (see SECURITY_NOTE.md)
- [ ] Changed `SESSION_SECRET` to a strong random value (use: `openssl rand -base64 32`)
- [ ] Changed `PGPASSWORD` to a strong random password
- [ ] Configured firewall (ufw) to only allow necessary ports (80, 443, and SSH)
- [ ] Set up SSL/HTTPS using Let's Encrypt
- [ ] Regular database backups configured
- [ ] Keep Docker images updated: `docker-compose pull && docker-compose up -d`
- [ ] Monitor logs for suspicious activity
- [ ] Database is not exposed to host (no port mapping in docker-compose.yml)
- [ ] Application runs as non-root user (uid 1001) in container
- [ ] Never commit `.env` file to version control
- [ ] PHI/PII data is never logged (production logs only show method/path/status/duration)

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `PGUSER` | PostgreSQL username | Yes | clinicadmin |
| `PGPASSWORD` | PostgreSQL password | Yes | your-secure-password |
| `PGDATABASE` | Database name | Yes | invotech_clinic_db |
| `PGHOST` | Database host | Yes | postgres |
| `PGPORT` | Database port | Yes | 5432 |
| `NODE_ENV` | Environment (production/development) | Yes | production |
| `PORT` | Application port | Yes | 5000 |
| `SESSION_SECRET` | JWT signing secret | Yes | - |
| `N8N_WEBHOOK_URL` | N8N WhatsApp webhook URL | Yes | - |
| `N8N_BIRTHDAY_WEBHOOK_URL` | N8N birthday webhook URL | Yes | - |

## Support

For issues or questions, refer to the application documentation or contact your development team.
