#!/bin/bash

# Keycloak Health Check Script
# This script checks if Keycloak is ready to accept requests

# Get the HTTP port from environment variable or default to 8180
HTTP_PORT=${KC_HTTP_PORT:-8180}

# Check if Keycloak health endpoint is responding
if curl -f -s "http://localhost:${HTTP_PORT}/health" > /dev/null 2>&1; then
    echo "Keycloak is ready"
    exit 0
else
    echo "Keycloak is not ready"
    exit 1
fi 