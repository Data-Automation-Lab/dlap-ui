# DLAP New-UI Docker Setup

> **Older material, not verified against this release.** This page dates from the time the UI was
> developed on its own. Statements such as "production-ready" below describe intent at that time,
> not a tested result. The supported way to run the UI is the quickstart of the main repository
> (https://github.com/Data-Automation-Lab/dlap).

This directory contains Docker Compose configurations for the DLAP New-UI development, testing, and production environments.

## Overview

The new-ui docker setup has been refactored to provide:
- **Complete infrastructure** for each environment
- **Environment-specific optimizations**
- **Consistent port mapping** across environments
- **Clear separation** from main project docker setup

## Directory Structure

```
new-ui/src/main/docker/
├── docker-compose.dev.yml    # Development environment
├── docker-compose.prod.yml   # Production environment  
├── docker-compose.test.yml   # Testing environment
├── keycloak-import/          # Keycloak realm configuration
├── keycloak-health-check.sh  # Keycloak health check script
└── README.md                 # This file
```

## Environments

### Development Environment (`docker-compose.dev.yml`)

**Purpose**: Complete development environment for new-ui with all infrastructure services.

**Services**:
- PostgreSQL (port 5432)
- Keycloak (port 8180) - **UI-specific port**
- Kafka + Zookeeper (ports 9092, 2181)
- Kafka UI (port 8080)
- Redis (port 6379)
- Kafka topic initializer

**Key Features**:
- Development-optimized resource allocation
- Social login support (Google/Facebook)
- Complete DLAP topic creation
- Health checks and monitoring
- Volume persistence

**Usage**:
```bash
cd new-ui/src/main/docker
docker-compose -f docker-compose.dev.yml up -d
```

**Access**:
- Keycloak Admin Console: http://localhost:8180/admin
- Kafka UI: http://localhost:8080
- PostgreSQL: localhost:5432

### Production Environment (`docker-compose.prod.yml`)

**Purpose**: Production-ready infrastructure with security and performance optimizations.

**Services**:
- PostgreSQL with production tuning
- Keycloak with database backend
- Kafka cluster with production settings
- Redis with persistence and memory management
- Comprehensive monitoring and logging

**Key Features**:
- Environment variable configuration
- Resource limits and reservations
- Production-grade security settings
- SSL/TLS support
- Performance optimizations
- High availability configurations

**Usage**:
```bash
# Set environment variables first
export POSTGRES_PASSWORD=your_secure_password
export KEYCLOAK_ADMIN_PASSWORD=your_admin_password
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_CLIENT_SECRET=your_google_client_secret

cd new-ui/src/main/docker
docker-compose -f docker-compose.prod.yml up -d
```

### Test Environment (`docker-compose.test.yml`)

**Purpose**: Lightweight testing environment for CI/CD and automated testing.

**Services**:
- PostgreSQL (test database)
- Keycloak (test realm)
- Redis (in-memory only)
- Optional Kafka (profile: kafka)
- Frontend test container (profile: frontend)
- Mock API server (profile: mock)

**Key Features**:
- Minimal resource usage
- Fast startup times
- Profile-based service activation
- Test data seeding
- Mock configurations

**Usage**:
```bash
# Basic testing setup
cd new-ui/src/main/docker
docker-compose -f docker-compose.test.yml up -d

# With Kafka for event testing
docker-compose -f docker-compose.test.yml --profile kafka up -d

# With frontend testing
docker-compose -f docker-compose.test.yml --profile frontend up -d

# Full testing environment
docker-compose -f docker-compose.test.yml --profile kafka --profile frontend --profile mock up -d
```

## Port Mapping

### Development Ports
- PostgreSQL: 5432
- Keycloak: 8180 (HTTP), 8443 (HTTPS)
- Kafka: 9092
- Kafka UI: 8080
- Zookeeper: 2181
- Redis: 6379

### Production Ports
- PostgreSQL: 5432 (configurable)
- Keycloak: 8180 (configurable)
- Kafka: 9092 (configurable)
- Zookeeper: 2181 (configurable)
- Redis: 6379 (configurable)

### Test Ports
- PostgreSQL: 5433
- Keycloak: 8082
- Kafka: 9094
- Zookeeper: 2182
- Redis: 6380
- Frontend: 3001
- Mock API: 8090

## Migration from Old Setup

### Before (Issues)
- Redundant docker-compose files
- Port conflicts (Keycloak 9080 vs 8180)
- Incomplete infrastructure in new-ui
- Inconsistent naming conventions
- Mixed responsibilities

### After (Improvements)
- ✅ Single source of truth per environment
- ✅ Consistent port mapping (Keycloak on 8180)
- ✅ Complete infrastructure in each environment
- ✅ Environment-specific optimizations
- ✅ Clear separation of concerns

### Migration Steps
1. **Stop old containers**: `docker-compose down` (from main directory)
2. **Use new-ui specific files**: Always use `-f` flag
3. **Update frontend configuration**: Point to port 8180 for Keycloak
4. **Use environment variables**: For production configuration

## Environment Variables

### Development
- Optional: Social login credentials
- Defaults provided for all required variables

### Production
Required environment variables:
```bash
POSTGRES_PASSWORD=your_secure_password
KEYCLOAK_ADMIN_PASSWORD=your_admin_password
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

Optional configuration:
```bash
POSTGRES_PORT=5432
KEYCLOAK_HTTP_PORT=8180
KEYCLOAK_HTTPS_PORT=8443
KAFKA_PORT=9092
REDIS_PORT=6379
KC_HOSTNAME=your.domain.com
KC_LOG_LEVEL=INFO
```

### Testing
- Minimal configuration required
- Mock values provided for social login
- Test-optimized settings

## Best Practices

### Development
1. Always use explicit file specification:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. Check service health:
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

3. View logs:
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f keycloak
   ```

### Production
1. Set all required environment variables
2. Use external volumes for persistence
3. Implement proper backup strategies
4. Monitor resource usage
5. Configure SSL certificates

### Testing
1. Use profiles to control service activation
2. Clean up after tests:
   ```bash
   docker-compose -f docker-compose.test.yml down -v
   ```

3. Use different ports to avoid conflicts

## Troubleshooting

### Common Issues

**Q: Keycloak still starts on port 9080**
A: Make sure you're using the correct docker-compose file:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Q: Port conflicts**
A: Check if services from main docker-compose are running:
```bash
docker ps
docker-compose down  # Stop main project containers
```

**Q: Permission issues with volumes**
A: Ensure proper file permissions:
```bash
chmod +x keycloak-health-check.sh
```

**Q: Services not starting**
A: Check logs and health status:
```bash
docker-compose -f docker-compose.dev.yml logs
docker-compose -f docker-compose.dev.yml ps
```

### Health Checks
All services include comprehensive health checks. Monitor with:
```bash
# Check all services
docker-compose -f docker-compose.dev.yml ps

# Detailed health information
docker inspect dlap-keycloak-dev | grep Health -A 10
```

## Integration with Deployment Module

The new-ui docker configurations complement the deployment module structure:

- `deployment/environments/dev/` - Environment-specific microservice deployment
- `deployment/platform/` - Platform service configurations
- `new-ui/src/main/docker/` - UI-specific infrastructure

This separation allows for:
- Independent UI development
- Flexible deployment strategies
- Environment-specific optimizations
- Clear responsibility boundaries

## Future Enhancements

Planned improvements:
- [ ] Docker Swarm support for production
- [ ] Kubernetes deployment configurations
- [ ] Monitoring stack integration (Prometheus/Grafana)
- [ ] Log aggregation (ELK stack)
- [ ] Backup and restore scripts
- [ ] CI/CD pipeline integration
- [ ] Security scanning integration
- [ ] Performance monitoring

## Support

For issues and questions:
1. Check the logs first
2. Verify environment variables
3. Ensure port availability
4. Review this documentation
5. Check the main project documentation

## Related Documentation

- [Social Login Setup](../../../../docs/social-login-setup.md)
- [Deployment Documentation](../../../../deployment/README.md) 
1. **Create production environment file:**
   ```bash
   cp env.prod.example .env
   ```

2. **Update environment variables with secure values:**
   ```bash
   # Edit .env file with production values
   nano .env
   ```

3. **Start production environment:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Environment Configurations

### Development (docker-compose.dev.yml)

**Configuration:**
- **Keycloak**: Port 8080 (HTTP), 8443 (HTTPS)
- **Database**: File-based (dev-file) - Fast startup, data persists in Docker volume
- **Admin**: admin/admin123
- **Features**: Scripts enabled for development

**Services:**
- `keycloak`: Keycloak service with file-based database

**Advantages:**
- Fast startup time
- No external database dependencies
- Perfect for development and testing
- Data persists between container restarts

### Test (docker-compose.test.yml)

**Configuration:**
- **Keycloak**: Port 8082 (HTTP), 8445 (HTTPS)
- **Database**: File-based (dev-file) - Isolated test environment
- **Admin**: admin/admin_test_123
- **Features**: Optimized for testing

**Services:**
- `keycloak`: Keycloak with test configuration
- `frontend-test`: Optional frontend test container

**Advantages:**
- Isolated test environment
- Fast test execution
- No database setup required

### Production (docker-compose.prod.yml)

**Configuration:**
- **Keycloak**: Port 8080 (HTTP), 8443 (HTTPS)
- **Database**: PostgreSQL - Production-ready with clustering support
- **Security**: HTTPS enforced, strict hostname validation
- **Performance**: Optimized startup, resource limits

**Services:**
- `postgres`: PostgreSQL with production settings
- `keycloak`: Keycloak with PostgreSQL backend
- `nginx`: Reverse proxy (profile: nginx)
- `redis`: Session storage (profile: redis)

**Advantages:**
- Production-ready database
- Data persistence and backup capabilities
- Clustering and high availability support
- Advanced security features

## Database Configuration Summary

| Environment | Database Type | Port | Use Case |
|-------------|---------------|------|----------|
| Development | dev-file | 8080 | Fast development, local testing |
| Test | dev-file | 8082 | Automated testing, CI/CD |
| Production | PostgreSQL | 8080/8443 | Production deployment, clustering |

## Usage Examples

### Start Development Environment

```bash
# Start Keycloak with file database
docker-compose -f docker-compose.dev.yml up keycloak

# Start in background
docker-compose -f docker-compose.dev.yml up -d
```

### Start Test Environment

```bash
# All test services
docker-compose -f docker-compose.test.yml up

# With frontend testing
docker-compose -f docker-compose.test.yml --profile frontend up
```

### Start Production Environment

```bash
# Core services (PostgreSQL + Keycloak)
docker-compose -f docker-compose.prod.yml up -d

# With Nginx reverse proxy
docker-compose -f docker-compose.prod.yml --profile nginx up -d

# With Redis session storage
docker-compose -f docker-compose.prod.yml --profile redis up -d

# All services
docker-compose -f docker-compose.prod.yml --profile nginx --profile redis up -d
```

### Stop Services

```bash
# Stop and remove containers
docker-compose -f docker-compose.dev.yml down

# Stop and remove containers with volumes
docker-compose -f docker-compose.dev.yml down -v
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs

# Specific service
docker-compose -f docker-compose.dev.yml logs keycloak

# Follow logs
docker-compose -f docker-compose.dev.yml logs -f keycloak
```

## Realm Configuration

The Data Automation Lab realm (`dlap`) is automatically imported with:

### 🔑 **Important: Two Different Login Systems**

#### 1. Keycloak Admin Console (for managing Keycloak)
- **URL**: http://localhost:8080/admin
- **Username**: `admin`
- **Password**: `admin123`
- **Purpose**: To manage Keycloak configuration, realms, users, etc.

#### 2. Application Login (for Data Automation Lab UI)
- **URL**: Through your frontend application
- **Test Users**: See table below (all have password `admin`)
- **Purpose**: To log into the Data Automation Lab application

### Test Users (Password: `admin`)

| Username | Role | Email | Full Name |
|----------|------|-------|-----------|
| admin | ROLE_ADMIN | admin@dalab.com | Admin Administrator |
| cdo | ROLE_CDO | cdo@dalab.com | Sarah Johnson |
| director | ROLE_DIRECTOR | director@dalab.com | Michael Chen |
| dataengineer | ROLE_DATA_ENGINEER | dataengineer@dalab.com | Emily Rodriguez |
| datascientist | ROLE_DATA_SCIENTIST | datascientist@dalab.com | David Kumar |

### Client Configuration

- **Client ID**: `dlap-ui`
- **Redirect URIs**: Configured for localhost development
- **Public Client**: Suitable for frontend applications

See `keycloak-import/README.md` for detailed realm configuration.

## Configuration Files

### Environment Variables

Create `.env` file from examples and customize:

```bash
# Development
cp env.dev.example .env

# Production  
cp env.prod.example .env
```

**Key Variables:**
- `KEYCLOAK_ADMIN`: Admin username
- `KEYCLOAK_ADMIN_PASSWORD`: Admin password
- `POSTGRES_PASSWORD`: Database password
- `KEYCLOAK_HOSTNAME`: Public hostname for Keycloak

### Keycloak Realm Import

Place realm configuration files in `keycloak-import/` directory:

```
keycloak-import/
├── dlap-realm.json           # Main realm configuration
├── dlap-test-realm.json      # Test realm configuration
└── users.json                 # User import file
```

### PostgreSQL Initialization

Place SQL scripts in `postgres-init/` directory:

```
postgres-init/
├── 01-init-database.sql       # Database initialization
├── 02-create-users.sql        # User creation
└── 03-grant-permissions.sql   # Permission setup
```

### SSL Certificates (Production)

Place SSL certificates in `ssl-certs/` directory:

```
ssl-certs/
├── server.crt.pem            # Certificate file
├── server.key.pem            # Private key file
└── ca-bundle.crt             # Certificate authority bundle
```

## Health Checks

All services include health checks:

### Keycloak Health Check

The `keycloak-health-check.sh` script checks:
- Service availability on configured port
- Health endpoint response
- Ready state confirmation

### PostgreSQL Health Check

Built-in health check using `pg_isready`:
- Database connection availability
- Service responsiveness

### Manual Health Check

```bash
# Keycloak
curl http://localhost:8080/health/ready

# PostgreSQL
docker exec dlap-postgres-dev pg_isready -U keycloak
```

## Troubleshooting

### Common Issues

#### 1. Keycloak Startup Failure

**Error**: `Invalid value for option 'kc.db': h2`

**Solution**: Use `dev-file` instead of `h2` for development:
```yaml
environment:
  KC_DB: dev-file
```

#### 2. Port Conflicts

**Error**: `Port already in use`

**Solution**: Change ports in docker-compose file or stop conflicting services:
```bash
# Check what's using the port
netstat -ano | findstr :8080

# Kill process (Windows)
taskkill /PID <PID> /F
```

#### 3. Permission Issues

**Error**: `Permission denied` for health check script

**Solution**: Ensure script is executable:
```bash
# Linux/Mac
chmod +x keycloak-health-check.sh

# Windows (in Git Bash)
git update-index --chmod=+x keycloak-health-check.sh
```

#### 4. Database Connection Issues

**Error**: `Connection refused` to PostgreSQL

**Solution**: 
1. Ensure PostgreSQL is healthy before starting Keycloak
2. Check network connectivity
3. Verify database credentials

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker exec -it dlap-postgres-dev psql -U keycloak -d keycloak
```

#### 5. Volume Mount Issues

**Error**: `No such file or directory` for volume mounts

**Solution**: Create required directories:
```bash
mkdir -p keycloak-import postgres-init ssl-certs nginx/conf.d
```

### Debugging Commands

```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs [service-name]

# Execute commands in container
docker exec -it dlap-keycloak-dev bash

# Check network connectivity
docker network ls
docker network inspect dlap-dev

# View container resource usage
docker stats
```

### Performance Tuning

#### Development Environment

```yaml
# Reduce resource usage
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

#### Production Environment

```yaml
# Optimize for production
environment:
  KC_CACHE: ispn
  KC_CACHE_STACK: kubernetes
  
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
```

## Security Considerations

### Development

- Default passwords are used for convenience
- HTTP is enabled for local development
- Hostname validation is disabled

### Production

- **Change all default passwords**
- **Use HTTPS only**
- **Enable hostname validation**
- **Use external secrets management**
- **Regular security updates**
- **Network isolation**
- **Resource limits**

### Best Practices

1. **Secrets Management**: Use Docker secrets or external secret management
2. **Network Security**: Use custom networks with restricted access
3. **Resource Limits**: Set appropriate CPU and memory limits
4. **Monitoring**: Enable health checks and monitoring
5. **Backups**: Regular database and configuration backups
6. **Updates**: Keep images updated with security patches

## Integration with Frontend

The frontend application connects to Keycloak using these environment variables:

```env
# Development
REACT_APP_ENV: test
REACT_APP_API_BASE_URL: http://backend-test:8080/api
REACT_APP_KEYCLOAK_URL=http://localhost:8080
REACT_APP_KEYCLOAK_REALM=dlap
REACT_APP_KEYCLOAK_CLIENT_ID=dlap-ui

# Test
REACT_APP_KEYCLOAK_URL=http://localhost:8082
REACT_APP_KEYCLOAK_REALM=dlap
REACT_APP_KEYCLOAK_CLIENT_ID=dlap-ui

# Production
REACT_APP_KEYCLOAK_URL=https://auth.dalab.com
REACT_APP_KEYCLOAK_REALM=dlap
REACT_APP_KEYCLOAK_CLIENT_ID=dlap-ui
```

## Support

For additional support:
- Check container logs: `docker-compose logs [service]`
- Review Keycloak documentation: https://www.keycloak.org/documentation
- Check PostgreSQL logs for database issues
- Verify network connectivity between services

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintainer**: Data Automation Lab Team 