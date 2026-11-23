# Data Automation Lab UI - Frontend Setup & Deployment Guide

> **Older material, not verified against this release.** This page dates from the time the UI was
> developed on its own. Statements such as "production-ready" below describe intent at that time,
> not a tested result. The supported way to run the UI is the quickstart of the main repository
> (https://github.com/Data-Automation-Lab/dlap).

This guide provides comprehensive instructions for running the Data Automation Lab UI frontend in different environments.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Development Environment](#development-environment)
- [Test Environment](#test-environment)
- [Production Environment](#production-environment)
- [Docker Infrastructure Setup](#docker-infrastructure-setup)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Node.js**: v16.x or higher
- **npm**: v8.x or higher (or yarn/pnpm/bun as alternative)
- **Git**: Latest version
- **Modern Browser**: Chrome, Firefox, Safari, or Edge
- **Docker**: Latest version (for infrastructure services)
- **Docker Compose**: v2.x or higher

### Project Dependencies
- **React**: v18.x with TypeScript
- **Tailwind CSS**: v3.x (Subframe compatible)
- **React Router DOM**: v6.x for client-side routing
- **Keycloak JS**: For authentication integration
- **Axios**: For API communication
- **Subframe Components**: UI component library

## Development Environment

### Initial Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Data-Automation-Lab/dlap-ui.git
   cd ui
   ```

2. **Navigate to Frontend Directory**
   ```bash
   cd frontend
   ```

3. **Install Dependencies**
   ```bash
   # Using npm (default)
   npm install
   
   # Or using yarn
   yarn install
   
   # Or using pnpm
   pnpm install
   
   # Or using bun
   bun install
   ```

4. **Sync Subframe Components**
   ```bash
   # Sync all Subframe components with project ID
   npx @subframe/cli@latest sync -all
   
   # Or if you have the CLI installed globally
   subframe sync -all
   ```

### Infrastructure Setup (Keycloak)

Before running the frontend, you need to start the Keycloak authentication server:

1. **Navigate to Docker Directory**
   ```bash
   cd ../src/main/docker
   ```

2. **Start Keycloak (File-based Database)**
   ```bash
   # Start Keycloak with file-based database (fastest startup)
   docker-compose -f docker-compose.dev.yml up keycloak
   
   # Or start in background
   docker-compose -f docker-compose.dev.yml up -d keycloak
   ```

3. **Verify Keycloak is Running**
   - **Keycloak Admin Console**: http://localhost:8080/admin
     - Username: `admin`
     - Password: `admin123`
     - Purpose: To manage Keycloak configuration
   - **Application Login**: Through your frontend app
     - Test users: See table below (all have password `admin`)
     - Purpose: To log into the Data Automation Lab application

**Why File-based Database for Development?**
- **Fast Startup**: No external database dependencies
- **Simple Setup**: Single container deployment
- **Data Persistence**: Data persists between container restarts
- **Perfect for Development**: Ideal for local development and testing

### 🔑 **Important: Two Different Login Systems**

#### Keycloak Admin Console (for managing Keycloak)
- **URL**: http://localhost:8080/admin
- **Credentials**: `admin` / `admin123`
- **Purpose**: To manage Keycloak configuration, realms, users, etc.

#### Application Login (for your frontend app)
- **URL**: Through your React application login page
- **Credentials**: Use test users below (all have password `admin`)
- **Purpose**: To log into the Data Automation Lab application

### Test Users Available

The realm comes pre-configured with test users (**password: `admin`**):

| Username | Password | Role | Email | Full Name |
|----------|----------|------|-------|-----------|
| admin | `admin` | ROLE_ADMIN | admin@dalab.com | Admin Administrator |
| cdo | `admin` | ROLE_CDO | cdo@dalab.com | Sarah Johnson |
| director | `admin` | ROLE_DIRECTOR | director@dalab.com | Michael Chen |
| dataengineer | `admin` | ROLE_DATA_ENGINEER | dataengineer@dalab.com | Emily Rodriguez |
| datascientist | `admin` | ROLE_DATA_SCIENTIST | datascientist@dalab.com | David Kumar |

### Environment Configuration

1. **Navigate Back to Frontend Directory**
   ```bash
   cd ../../../frontend
   ```

2. **Create Development Environment File**
   ```bash
   cp .env.example .env.development.local
   ```

3. **Configure Development Variables**
   ```env
   # .env.development.local
   REACT_APP_ENV=development
   REACT_APP_API_BASE_URL=http://localhost:3001/api
   REACT_APP_KEYCLOAK_URL=http://localhost:8080
   REACT_APP_KEYCLOAK_REALM=dlap
   REACT_APP_KEYCLOAK_CLIENT_ID=dlap-ui
   REACT_APP_DEBUG=true
   REACT_APP_LOG_LEVEL=debug
   ```

### Running Development Server

```bash
# Start development server
npm start

# Or with specific port
PORT=3000 npm start

# Or using yarn
yarn start

# Or using pnpm
pnpm start

# Or using bun
bun start
```

**Development Server Features:**
- **Hot Reload**: Automatic browser refresh on code changes
- **Source Maps**: Enabled for debugging
- **Error Overlay**: In-browser error display
- **Fast Refresh**: React Fast Refresh for component state preservation
- **Default URL**: http://localhost:3000

### Development Workflow

1. **Start Infrastructure**: Start Keycloak using Docker Compose
2. **Code Changes**: Edit files in `src/` directory
3. **Component Updates**: Use Subframe CLI to sync component changes
4. **Linting**: Run `npm run lint` to check code quality
5. **Type Checking**: Run `npm run type-check` for TypeScript validation
6. **Testing**: Run `npm test` for unit tests

### Development Tools

```bash
# Linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Testing
npm test
npm run test:coverage

# Build verification
npm run build
```

## Test Environment

### Infrastructure Setup

1. **Navigate to Docker Directory**
   ```bash
   cd src/main/docker
   ```

2. **Start Test Infrastructure**
   ```bash
   # Start test environment with file-based database
   docker-compose -f docker-compose.test.yml up -d
   ```

3. **Verify Test Keycloak**
   - URL: http://localhost:8082
   - Username: `admin`
   - Password: `admin_test_123`

**Test Environment Features:**
- **File-based Database**: Fast startup, isolated test data
- **Separate Port**: Runs on port 8082 to avoid conflicts
- **Test Configuration**: Optimized for automated testing
- **Same Test Users**: Uses the same realm with test users

### Setup for Testing

1. **Install Test Dependencies**
   ```bash
   cd frontend
   npm install --include=dev
   ```

2. **Configure Test Environment**
   ```env
   # .env.test.local
   REACT_APP_ENV=test
   REACT_APP_API_BASE_URL=https://api-test.dalab.com/api
   REACT_APP_KEYCLOAK_URL=http://localhost:8082
   REACT_APP_KEYCLOAK_REALM=dlap
   REACT_APP_KEYCLOAK_CLIENT_ID=dlap-ui
   REACT_APP_DEBUG=false
   REACT_APP_LOG_LEVEL=warn
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testNamePattern="ComponentName"

# Run tests for specific directory
npm test -- src/components/

# Run E2E tests (if configured)
npm run test:e2e
```

### Test Environment Deployment

```bash
# Build for test environment
npm run build:test

# Or with environment-specific build
REACT_APP_ENV=test npm run build

# Serve built files locally for testing
npx serve -s build -l 3000

# Deploy to test server (example with Docker)
docker build -t dlap-ui:test .
docker run -p 3000:80 dlap-ui:test
```

### Test Environment Features
- **Mock APIs**: Configured mock endpoints for testing
- **Test Data**: Predefined test datasets
- **Authentication**: Test Keycloak realm with test users
- **Error Simulation**: Controlled error scenarios for testing
- **Performance Monitoring**: Basic performance metrics collection

## Production Environment

### Infrastructure Setup

1. **Navigate to Docker Directory**
   ```bash
   cd src/main/docker
   ```

2. **Create Production Environment File**
   ```bash
   cp env.prod.example .env
   ```

3. **Update Environment Variables**
   ```bash
   # Edit .env file with production values
   nano .env
   ```

4. **Start Production Infrastructure**
   ```bash
   # Core services
   docker-compose -f docker-compose.prod.yml up -d
   
   # With Nginx reverse proxy
   docker-compose -f docker-compose.prod.yml --profile nginx up -d
   
   # With Redis session storage
   docker-compose -f docker-compose.prod.yml --profile redis up -d
   ```

### Pre-Production Checklist

- [ ] All tests passing
- [ ] Linting errors resolved
- [ ] TypeScript compilation successful
- [ ] Environment variables configured
- [ ] Keycloak production realm configured
- [ ] API endpoints verified
- [ ] Performance optimization completed
- [ ] Security review completed
- [ ] SSL certificates installed
- [ ] Database backups configured

### Production Build

```bash
# Navigate to frontend directory
cd frontend

# Create optimized production build
npm run build

# Or with production environment
REACT_APP_ENV=production npm run build

# Verify build
npm run build:analyze
```

### Production Environment Configuration

```env
# .env.production.local
REACT_APP_ENV=production
REACT_APP_API_BASE_URL=https://api.dalab.com/api
REACT_APP_KEYCLOAK_URL=https://auth.dalab.com
REACT_APP_KEYCLOAK_REALM=dlap
REACT_APP_KEYCLOAK_CLIENT_ID=dlap-ui
REACT_APP_DEBUG=false
REACT_APP_LOG_LEVEL=error
GENERATE_SOURCEMAP=false
```

### Production Deployment Options

#### Option 1: Static File Hosting (Recommended)

```bash
# Build the application
npm run build

# Deploy to static hosting (AWS S3, Netlify, Vercel, etc.)
# Example with AWS S3
aws s3 sync build/ s3://your-bucket-name --delete

# Example with Netlify CLI
netlify deploy --prod --dir=build

# Example with Vercel CLI
vercel --prod
```

#### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build and run Docker container
docker build -t dlap-ui:latest .
docker run -p 80:80 dlap-ui:latest
```

#### Option 3: Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dlap-ui
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dlap-ui
  template:
    metadata:
      labels:
        app: dlap-ui
    spec:
      containers:
      - name: dlap-ui
        image: dlap-ui:latest
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_ENV
          value: "production"
---
apiVersion: v1
kind: Service
metadata:
  name: dlap-ui-service
spec:
  selector:
    app: dlap-ui
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

### Production Monitoring

```bash
# Health check endpoint
curl https://your-domain.com/health

# Performance monitoring
npm run build:analyze

# Bundle size analysis
npx webpack-bundle-analyzer build/static/js/*.js
```

## Docker Infrastructure Setup

The project includes comprehensive Docker configurations for all environments located in `src/main/docker/`.

### Quick Start Commands

```bash
# Navigate to Docker directory
cd src/main/docker

# Development (file-based database)
docker-compose -f docker-compose.dev.yml up keycloak

# Development (with PostgreSQL)
docker-compose -f docker-compose.dev.yml --profile postgres up

# Test environment
docker-compose -f docker-compose.test.yml up

# Production environment
docker-compose -f docker-compose.prod.yml up -d
```

### Available Services

#### Development Environment
- **Keycloak**: Port 8080 (file-based database)
- **Keycloak + PostgreSQL**: Port 8081 (with PostgreSQL)
- **PostgreSQL**: Port 5432

#### Test Environment
- **Keycloak**: Port 8082
- **PostgreSQL**: Port 5433
- **Frontend Test Container**: Port 3001 (optional)

#### Production Environment
- **Keycloak**: Port 8080/8443 (HTTP/HTTPS)
- **PostgreSQL**: Port 5432
- **Nginx**: Port 80/443 (optional)
- **Redis**: Port 6379 (optional)

### Docker Configuration Files

```
src/main/docker/
├── docker-compose.dev.yml      # Development environment
├── docker-compose.test.yml     # Test environment
├── docker-compose.prod.yml     # Production environment
├── env.dev.example             # Development environment variables
├── env.prod.example            # Production environment variables
├── keycloak-health-check.sh    # Health check script
├── keycloak-import/            # Realm configuration files
├── postgres-init/              # Database initialization scripts
├── ssl-certs/                  # SSL certificates (production)
└── nginx/                      # Nginx configuration files
```

### Keycloak Configuration

The Keycloak setup has been fixed to resolve the startup issue:

**Fixed Configuration:**
- Uses `KC_DB: dev-file` instead of deprecated `h2`
- Includes custom health check script
- Proper port configuration with `KC_HTTP_PORT` and `KC_HTTPS_PORT`
- Scripts feature enabled with `KC_FEATURES: scripts`

**Access Information:**
- **Development**: http://localhost:8080 (admin/admin123)
- **Test**: http://localhost:8082 (admin/admin_test_123)
- **Production**: https://auth.dalab.com (configured via environment)

### Managing Docker Services

```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# Stop services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f keycloak

# Check service status
docker-compose -f docker-compose.dev.yml ps

# Restart specific service
docker-compose -f docker-compose.dev.yml restart keycloak
```

For detailed Docker setup instructions, see `src/main/docker/README.md`.

## Environment Variables

### Required Variables

| Variable | Development | Test | Production | Description |
|----------|-------------|------|------------|-------------|
| `REACT_APP_ENV` | development | test | production | Environment identifier |
| `REACT_APP_API_BASE_URL` | http://localhost:3001/api | https://api-test.dalab.com/api | https://api.dalab.com/api | Backend API base URL |
| `REACT_APP_KEYCLOAK_URL` | http://localhost:8080 | http://localhost:8082 | https://auth.dalab.com | Keycloak server URL |
| `REACT_APP_KEYCLOAK_REALM` | dlap | dlap | dlap | Keycloak realm name |
| `REACT_APP_KEYCLOAK_CLIENT_ID` | dlap-ui | dlap-ui | dlap-ui | Keycloak client ID |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_DEBUG` | false | Enable debug mode |
| `REACT_APP_LOG_LEVEL` | error | Logging level (debug, info, warn, error) |
| `GENERATE_SOURCEMAP` | true | Generate source maps for debugging |
| `PORT` | 3000 | Development server port |
| `BROWSER` | default | Browser to open (none to disable) |

### Environment File Priority

1. `.env.development.local`, `.env.test.local`, `.env.production.local`
2. `.env.local`
3. `.env.development`, `.env.test`, `.env.production`
4. `.env`

## Troubleshooting

### Common Issues

#### 1. Keycloak Startup Issues

**Error**: `Invalid value for option 'kc.db': h2`

**Solution**: The Docker configuration has been updated to use `dev-file`:
```bash
# Navigate to Docker directory and restart
cd src/main/docker
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up keycloak
```

#### 2. Node Modules Issues
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 3. Subframe Component Sync Issues
```bash
# Re-sync Subframe components
npx @subframe/cli@latest sync -all

# Check Subframe authentication
npx @subframe/cli@latest auth
```

#### 4. TypeScript Compilation Errors
```bash
# Check TypeScript configuration
npm run type-check

# Clear TypeScript cache
rm -rf node_modules/.cache
```

#### 5. Build Failures
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Clear build cache
rm -rf build
npm run build
```

#### 6. Docker/Keycloak Issues

**Port Conflicts:**
```bash
# Check what's using the port (Windows)
netstat -ano | findstr :8080

# Kill process (Windows)
taskkill /PID <PID> /F

# Check what's using the port (Linux/Mac)
lsof -i :8080

# Kill process (Linux/Mac)
kill -9 <PID>
```

**Container Issues:**
```bash
# Check container status
docker-compose -f src/main/docker/docker-compose.dev.yml ps

# View container logs
docker-compose -f src/main/docker/docker-compose.dev.yml logs keycloak

# Restart containers
docker-compose -f src/main/docker/docker-compose.dev.yml restart

# Clean up containers and volumes
docker-compose -f src/main/docker/docker-compose.dev.yml down -v
```

#### 7. Authentication Issues
- Verify Keycloak server is running and accessible
- Check realm and client configuration
- Ensure redirect URIs are properly configured
- Verify CORS settings in Keycloak

#### 8. API Connection Issues
- Check API server status
- Verify CORS configuration on backend
- Check network connectivity
- Validate JWT token format and expiration

### Performance Optimization

#### Bundle Size Optimization
```bash
# Analyze bundle size
npm run build:analyze

# Use dynamic imports for code splitting
const LazyComponent = React.lazy(() => import('./LazyComponent'));

# Optimize images and assets
npm install --save-dev imagemin-webpack-plugin
```

#### Runtime Performance
```bash
# Enable React Profiler in development
REACT_APP_PROFILER=true npm start

# Monitor performance metrics
npm install --save web-vitals
```

### Debugging

#### Development Debugging
```bash
# Enable verbose logging
REACT_APP_LOG_LEVEL=debug npm start

# Use React Developer Tools
# Install browser extension for React DevTools
```

#### Production Debugging
```bash
# Enable source maps for production debugging
GENERATE_SOURCEMAP=true npm run build

# Use error tracking service (Sentry, LogRocket, etc.)
npm install @sentry/react
```

### Support

For additional support:
- Check the project's GitHub Issues
- Check Docker setup documentation at `src/main/docker/README.md`
- Contact the development team

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintainer**: Data Automation Lab Team 