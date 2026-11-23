@echo off
REM Data Automation Lab - Development Environment Startup Script (Windows)

echo 🚀 Starting Data Automation Lab Development Environment...

REM Store the current directory
set "CURRENT_DIR=%CD%"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose and try again.
    pause
    exit /b 1
)

REM Check if the Docker Compose file exists
if not exist "src\main\docker\docker-compose.dev.yml" (
    echo ❌ Docker Compose file not found at src\main\docker\docker-compose.dev.yml
    echo 📋 Please make sure you are running this script from the project root directory.
    pause
    exit /b 1
)

REM Stop any existing containers
echo 📦 Stopping any existing containers...
docker-compose -f src\main\docker\docker-compose.dev.yml down

REM Start Keycloak and other services
echo 📦 Starting development services...
docker-compose -f src\main\docker\docker-compose.dev.yml up -d

REM Wait for Keycloak to be ready
echo ⏳ Waiting for Keycloak to start...
set timeout=180
set counter=0

:wait_loop
REM Try both health endpoints
curl -s http://localhost:8180/health >nul 2>&1
if errorlevel 1 (
    curl -s http://localhost:8180/health/ready >nul 2>&1
    if errorlevel 1 (
        if %counter% geq %timeout% (
            echo ❌ Keycloak failed to start within %timeout% seconds
            echo 📋 Checking Keycloak logs...
            docker-compose -f src\main\docker\docker-compose.dev.yml logs keycloak
            echo.
            echo 📋 Please check if:
            echo    1. Port 8180 is not in use by another application
            echo    2. Docker has enough resources allocated
            echo    3. No other Keycloak instance is running
            pause
            exit /b 1
        )
        echo    Waiting... (%counter%/%timeout% seconds)
        timeout /t 2 /nobreak >nul
        set /a counter+=2
        goto wait_loop
    )
)

echo ✅ Keycloak is ready!
echo.
echo 🔐 Keycloak Admin Console: http://localhost:8180/admin
echo    Username: admin
echo    Password: admin123
echo.
echo 👥 Pre-configured test users:
echo    admin/admin123 (System Administrator)
echo    cdo/cdo123 (Chief Data Officer)
echo    director/director123 (Director)
echo    engineer/engineer123 (Data Engineer)
echo    scientist/scientist123 (Data Scientist)
echo    viewer/viewer123 (Viewer)
echo.

REM Start the frontend application
echo 📱 Starting React application...

REM Try to find the frontend directory
set "FRONTEND_DIR=%CURRENT_DIR%\frontend"
if not exist "%FRONTEND_DIR%" (
    echo ❌ Frontend directory not found at %FRONTEND_DIR%
    pause
    exit /b 1
)

REM Change to frontend directory and start the application
cd "%FRONTEND_DIR%"

REM Check if node_modules exists, if not run npm install
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Start the React application
echo 🚀 Starting React development server...
start "" "http://localhost:3000"
call npm start

REM Return to original directory
cd "%CURRENT_DIR%" 