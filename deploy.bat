@echo off
REM Zero-downtime deployment script for iTaxi microservices on Windows

setlocal enabledelayedexpansion

echo 🚀 Starting zero-downtime deployment...

REM Configuration
set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=production

set BRANCH=%2
if "%BRANCH%"=="" set BRANCH=main

set DEPLOY_DIR=C:\inetpub\wwwroot\itaxi-%ENVIRONMENT%
set BACKUP_DIR=%DEPLOY_DIR%\backups
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set YEAR=%dt:~0,4%
set MONTH=%dt:~4,2%
set DAY=%dt:~6,2%
set HOUR=%dt:~8,2%
set MINUTE=%dt:~10,2%
set SECOND=%dt:~12,2%
set TIMESTAMP=%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%

REM Log function
:log
echo [INFO] [%DATE% %TIME%] - %*
goto :eof

:warn
echo [WARN] [%DATE% %TIME%] - %*
goto :eof

:error
echo [ERROR] [%DATE% %TIME%] - %*
goto :eof

REM Pre-flight checks
call :log "Checking dependencies..."

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    call :error "Git is not installed"
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    call :error "NPM is not installed"
    exit /b 1
)

REM Check if pm2 is installed
pm2 --version >nul 2>&1
if errorlevel 1 (
    call :error "PM2 is not installed"
    exit /b 1
)

call :log "All dependencies are available"

REM Backup current deployment
call :log "Creating backup of current deployment..."

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

set BACKUP_NAME=%BACKUP_DIR%\backup_%TIMESTAMP%.zip

if exist "%DEPLOY_DIR%\current" (
    powershell -Command "Compress-Archive -Path '%DEPLOY_DIR%\current\*' -DestinationPath '%BACKUP_NAME%' -Force"
    call :log "Backup created: %BACKUP_NAME%"
) else (
    call :warn "No current deployment to backup"
)

REM Pull latest code
call :log "Pulling latest code from branch: %BRANCH%"

if not exist "%DEPLOY_DIR%\release_%TIMESTAMP%" mkdir "%DEPLOY_DIR%\release_%TIMESTAMP%"

cd /d "%DEPLOY_DIR%\release_%TIMESTAMP%"

REM Clone or pull latest code
if exist ".git" (
    git fetch origin
    git checkout "%BRANCH%"
    git pull origin "%BRANCH%"
) else (
    git clone -b "%BRANCH%" https://github.com/your-org/itaxi.git .
)

call :log "Latest code pulled successfully"

REM Install dependencies
call :log "Installing dependencies..."

cd /d "%DEPLOY_DIR%\release_%TIMESTAMP%"

REM Install Node.js dependencies
call npm ci --production=false

REM Generate Prisma client
call npx prisma generate

call :log "Dependencies installed successfully"

REM Run database migrations
call :log "Running database migrations..."

cd /d "%DEPLOY_DIR%\release_%TIMESTAMP%"

REM Run Prisma migrations
call npx prisma migrate deploy

call :log "Database migrations completed"

REM Deploy with PM2
call :log "Deploying services with PM2..."

cd /d "%DEPLOY_DIR%\release_%TIMESTAMP%"

REM Reload PM2 configuration
call pm2 reload ecosystem.config.js --env "%ENVIRONMENT%"

REM Wait for services to restart
timeout /t 10 /nobreak >nul

REM Save PM2 configuration
call pm2 save

call :log "Services deployed successfully"

REM Test the new deployment
call :log "Testing new deployment..."

REM Wait a bit for services to start
timeout /t 15 /nobreak >nul

REM Test services individually
for %%p in (5000, 5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010) do (
    call :log "Testing service on port %%p"
    
    REM Use PowerShell to test the endpoint
    powershell -Command ^
        "$response = try { Invoke-RestMethod -Uri http://localhost:%%p/health -Method GET -TimeoutSec 10 } catch { $_ }; " ^
        "if ($?) { Write-Host '✓ Service on port %%p is healthy' } else { Write-Host '⚠ Service on port %%p may not be responding' }"
)

call :log "Deployment testing completed"

REM Make the new release the current one
REM Since Windows doesn't have symlinks in the same way, we'll copy the files
if exist "%DEPLOY_DIR%\current" rmdir /s /q "%DEPLOY_DIR%\current"
xcopy "%DEPLOY_DIR%\release_%TIMESTAMP%" "%DEPLOY_DIR%\current\" /E /I /H /Y

call :log "🎉 Deployment completed successfully!"
call :log "Current version: %TIMESTAMP%"

REM Clean up old releases (keep last 3)
cd /d "%DEPLOY_DIR%"
for /f "skip=3" %%i in ('dir /ad /o-n /b release_*') do rmdir /s /q "%%i"

echo Deployment process finished.
pause