#!/bin/bash
# Zero-downtime deployment script for iTaxi microservices

set -e  # Exit on any error

echo "🚀 Starting zero-downtime deployment..."

# Configuration
ENVIRONMENT=${1:-production}
BRANCH=${2:-main}
DEPLOY_DIR="/var/www/itaxi-$ENVIRONMENT"
BACKUP_DIR="$DEPLOY_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log function
log() {
    echo -e "${GREEN}[INFO]$(tput sgr0) $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

warn() {
    echo -e "${YELLOW}[WARN]$(tput sgr0) $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

error() {
    echo -e "${RED}[ERROR]$(tput sgr0) $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Pre-flight checks
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v git &> /dev/null; then
        error "Git is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        error "NPM is not installed"
        exit 1
    fi
    
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed"
        exit 1
    fi
    
    log "All dependencies are available"
}

# Backup current deployment
create_backup() {
    log "Creating backup of current deployment..."
    
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
    fi
    
    BACKUP_NAME="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
    
    if [ -d "$DEPLOY_DIR/current" ]; then
        tar -czf "$BACKUP_NAME" -C "$DEPLOY_DIR" current
        log "Backup created: $BACKUP_NAME"
    else
        warn "No current deployment to backup"
    fi
}

# Pull latest code
pull_latest_code() {
    log "Pulling latest code from branch: $BRANCH"
    
    if [ ! -d "$DEPLOY_DIR/release_$TIMESTAMP" ]; then
        mkdir -p "$DEPLOY_DIR/release_$TIMESTAMP"
    fi
    
    cd "$DEPLOY_DIR/release_$TIMESTAMP"
    
    # Clone or pull latest code
    if [ -d ".git" ]; then
        git fetch origin
        git checkout "$BRANCH"
        git pull origin "$BRANCH"
    else
        git clone -b "$BRANCH" https://github.com/your-org/itaxi.git .
    fi
    
    log "Latest code pulled successfully"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    cd "$DEPLOY_DIR/release_$TIMESTAMP"
    
    # Install Node.js dependencies
    npm ci --production=false
    
    # Generate Prisma client
    npx prisma generate
    
    log "Dependencies installed successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$DEPLOY_DIR/release_$TIMESTAMP"
    
    # Run Prisma migrations
    npx prisma migrate deploy
    
    log "Database migrations completed"
}

# Test the new deployment
test_deployment() {
    log "Testing new deployment..."
    
    cd "$DEPLOY_DIR/release_$TIMESTAMP"
    
    # Run basic health checks
    for service_port in 5000 5001 5002 5003 5004 5005 5006 5007 5008 5009 5010; do
        log "Testing service on port $service_port"
        
        # Try to reach the health endpoint
        if curl -sf "http://localhost:$service_port/health" > /dev/null 2>&1; then
            log "✓ Service on port $service_port is healthy"
        else
            warn "⚠ Service on port $service_port may not be ready yet, waiting..."
            sleep 5
            
            if curl -sf "http://localhost:$service_port/health" > /dev/null 2>&1; then
                log "✓ Service on port $service_port is now healthy"
            else
                error "✗ Service on port $service_port is not responding"
            fi
        fi
    done
    
    log "Deployment testing completed"
}

# Deploy with PM2
deploy_with_pm2() {
    log "Deploying services with PM2..."
    
    cd "$DEPLOY_DIR/release_$TIMESTAMP"
    
    # Reload PM2 configuration
    pm2 reload ecosystem.config.js --env "$ENVIRONMENT"
    
    # Wait for services to restart
    sleep 10
    
    # Save PM2 configuration
    pm2 save
    
    log "Services deployed successfully"
}

# Rollback function
rollback() {
    error "Rolling back deployment..."
    
    # Find the previous backup
    PREVIOUS_BACKUP=$(ls -t "$BACKUP_DIR"/backup_* 2>/dev/null | head -n 1)
    
    if [ -z "$PREVIOUS_BACKUP" ]; then
        error "No previous backup found, cannot rollback"
        exit 1
    fi
    
    log "Restoring from backup: $PREVIOUS_BACKUP"
    
    # Stop current services
    pm2 stop all
    
    # Extract backup
    mkdir -p "$DEPLOY_DIR/current_temp"
    tar -xzf "$PREVIOUS_BACKUP" -C "$DEPLOY_DIR/current_temp"
    
    # Move to current
    rm -rf "$DEPLOY_DIR/current"
    mv "$DEPLOY_DIR/current_temp/current" "$DEPLOY_DIR/current"
    
    # Restart with previous version
    cd "$DEPLOY_DIR/current"
    pm2 startOrReload ecosystem.config.js --env "$ENVIRONMENT"
    
    error "Rollback completed"
    exit 1
}

# Main deployment process
main() {
    log "Starting deployment process for environment: $ENVIRONMENT"
    
    # Set trap to handle errors and rollback if needed
    trap rollback ERR
    
    check_dependencies
    create_backup
    pull_latest_code
    install_dependencies
    run_migrations
    deploy_with_pm2
    test_deployment
    
    # Make the new release the current one
    ln -sfn "$DEPLOY_DIR/release_$TIMESTAMP" "$DEPLOY_DIR/current"
    
    # Clean up old releases (keep last 3)
    cd "$DEPLOY_DIR"
    ls -rd release_* 2>/dev/null | tail -n +4 | xargs -d '\n' -r rm -rf --
    
    log "🎉 Deployment completed successfully!"
    log "Current version: $TIMESTAMP"
    
    # Remove trap since deployment was successful
    trap - ERR
}

# Execute main function
main