#!/bin/bash

# Data Automation Lab - Development Environment Startup Script

set -e

echo "🚀 Starting Data Automation Lab Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Start Keycloak
echo "📦 Starting Keycloak..."
docker-compose -f src/main/docker/docker-compose.dev.yml up -d

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak to start..."
timeout=60
counter=0
while ! curl -s http://localhost:8180/health > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo "❌ Keycloak failed to start within $timeout seconds"
        echo "📋 Check logs with: docker-compose -f docker-compose.dev.yml logs keycloak"
        exit 1
    fi
    echo "   Waiting... ($counter/$timeout seconds)"
    sleep 2
    counter=$((counter + 2))
done

echo "✅ Keycloak is ready!"
echo ""
echo "🔐 Keycloak Admin Console: http://localhost:8180/admin"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "👥 Pre-configured test users:"
echo "   admin/admin123 (System Administrator)"
echo "   cdo/cdo123 (Chief Data Officer)"
echo "   director/director123 (Director)"
echo "   engineer/engineer123 (Data Engineer)"
echo "   scientist/scientist123 (Data Scientist)"
echo "   viewer/viewer123 (Viewer)"
echo ""

# Check if we're in the frontend directory
if [ -f "package.json" ] && [ -d "src" ]; then
    echo "📱 Starting React application..."
    npm start
elif [ -d "frontend" ]; then
    echo "📱 Starting React application..."
    cd frontend
    npm start
else
    echo "⚠️  React application not found. Please run 'npm start' from the frontend directory."
    echo ""
    echo "🌐 Once the React app is running, access it at: http://localhost:3000"
fi 