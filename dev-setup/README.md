# Data Automation Lab - Development Setup

> **Older material, not verified against this release.** This page dates from the time the UI was
> developed on its own. Statements such as "production-ready" below describe intent at that time,
> not a tested result. The supported way to run the UI is the quickstart of the main repository
> (https://github.com/Data-Automation-Lab/dlap).

This directory contains the development setup for the Data Automation Lab UI, including Keycloak authentication with pre-configured dummy users.

## Quick Start

1. **Start Keycloak with Docker Compose:**
   ```bash
   # From the project root directory
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Wait for Keycloak to start** (usually takes 30-60 seconds)
   - Check logs: `docker-compose -f docker-compose.dev.yml logs -f keycloak`
   - Keycloak will be available at: http://localhost:8080

3. **Start the React application:**
   ```bash
   cd frontend
   npm start
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Keycloak Admin Console: http://localhost:8080/admin (admin/admin123)

## Pre-configured Users

The development setup includes the following dummy users for testing different roles:

| Username | Password | Role | Name | Email | Department |
|----------|----------|------|------|-------|------------|
| `admin` | `admin123` | admin | System Administrator | admin@dlap.dev | IT Operations |
| `cdo` | `cdo123` | cdo | Sarah Chen | sarah.chen@dlap.dev | Executive |
| `director` | `director123` | director | Michael Rodriguez | michael.rodriguez@dlap.dev | Engineering |
| `engineer` | `engineer123` | engineer | Emily Johnson | emily.johnson@dlap.dev | Data Engineering |
| `scientist` | `scientist123` | scientist | David Kim | david.kim@dlap.dev | Data Science |
| `viewer` | `viewer123` | viewer | Lisa Wang | lisa.wang@dlap.dev | Business Intelligence |

## Role-Based Dashboard Access

Each user will be redirected to their appropriate dashboard after login:

- **admin** → Admin Dashboard with system management features
- **cdo** → CDO Dashboard with governance metrics and executive insights
- **director** → Director Dashboard with team and policy oversight
- **engineer** → Data Engineer Dashboard with technical tools and datasets
- **scientist** → Data Engineer Dashboard with research and analysis tools
- **viewer** → Data Engineer Dashboard with read-only access

## Keycloak Configuration

The realm configuration includes:

- **Realm**: `dlap`
- **Client ID**: `dlap-ui`
- **Redirect URIs**: `http://localhost:3000/*`
- **Roles**: admin, cdo, director, engineer, scientist, viewer
- **Token Lifespan**: 1 hour (3600 seconds)
- **Session Timeout**: 30 minutes idle, 10 hours max

## Development Commands

```bash
# Start Keycloak
docker-compose -f docker-compose.dev.yml up -d

# Stop Keycloak
docker-compose -f docker-compose.dev.yml down

# View Keycloak logs
docker-compose -f docker-compose.dev.yml logs -f keycloak

# Reset Keycloak data (removes all users and configuration)
docker-compose -f docker-compose.dev.yml down -v
rm -rf dev-setup/keycloak-data/*

# Access Keycloak admin console
# URL: http://localhost:8080/admin
# Username: admin
# Password: admin123
```

## Troubleshooting

### Keycloak not starting
- Check if port 8080 is available: `netstat -an | grep 8080`
- Check Docker logs: `docker-compose -f docker-compose.dev.yml logs keycloak`

### Authentication redirects to wrong URL
- Verify the Keycloak configuration in `frontend/src/keycloak.ts`
- Check that the client redirect URIs include your frontend URL

### Users not found
- Verify the realm import was successful in Keycloak admin console
- Check that the realm file is in `dev-setup/keycloak-import/dlap-realm.json`

### Token expired errors
- Tokens expire after 1 hour by default
- Refresh the page to get a new token
- Check token settings in Keycloak admin console

## Production Notes

For production deployment:

1. Use a proper database (PostgreSQL) instead of H2
2. Enable SSL/HTTPS
3. Use environment variables for configuration
4. Set up proper backup and monitoring
5. Configure email settings for password reset
6. Enable brute force protection
7. Set up proper session management

## File Structure

```
dev-setup/
├── README.md                           # This file
├── keycloak-import/
│   └── dlap-realm.json               # Realm configuration with users and roles
└── keycloak-data/                     # Keycloak data directory (auto-created)
``` 