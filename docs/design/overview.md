# UI Overhaul for Microservice Platform

## Project Overview

This project focuses on creating a modern, responsive user interface for our microservice-based platform using Subframe components and pages. The redesigned UI will unify the user experience across all microservices, providing a consistent look and feel while improving usability and accessibility.

## Goals

1. **Unified User Experience**: Create a cohesive design language across all microservices.
2. **Modern Component Library**: Build a reusable component library using Subframe.
3. **Responsive Design**: Ensure all interfaces work well on desktop, tablet, and mobile devices.
4. **Performance Optimization**: Improve load times and interactivity over the current UI.
5. **Accessibility Compliance**: Meet WCAG 2.1 AA standards for accessibility.
6. **Seamless Integration**: Maintain compatibility with existing microservice APIs.
7. **Developer Experience**: Streamline the process for developers to create new UI components.

## Technology Stack

The project uses the following technologies:

- **Frontend**:
  - React 18.x
  - TypeScript
  - Tailwind CSS 3.x
  - Subframe for UI design and component generation
  
- **Build & Deployment**:
  - Gradle for build automation
  - Spring Boot for backend server (where applicable)
  - Docker for containerization
  - CI/CD pipeline using GitHub Actions or Jenkins (TBD)

## Architecture

The UI overhaul follows a client-side rendering architecture with the following components:

1. **Subframe Components**: Core UI building blocks designed in Subframe
2. **React Application**: Main application that consumes Subframe components
3. **API Layer**: Interfaces with existing microservices
4. **Authentication Service**: Handles user authentication and authorization
5. **Routing**: Client-side routing for navigation between different sections

## Project Structure

```
dlap-ui/
├── src/                           # Source code
│   ├── main/
│   │   ├── java/                  # Java source files
│   │   └── resources/             # Server-side resources
│   └── test/                      # Test code
├── frontend/                      # Frontend code
│   ├── .subframe/                 # Subframe configuration
│   ├── public/                    # Static assets
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Page components
│   │   ├── ui/                    # Subframe-generated components
│   │   ├── utils/                 # Utility functions
│   │   ├── App.tsx                # Main application component
│   │   └── index.tsx              # Entry point
│   ├── package.json               # NPM package configuration
│   └── tailwind.config.js         # Tailwind configuration
├── docs/                          # Documentation
│   └── design/                    # Design documentation
├── build.gradle                   # Gradle build file
├── settings.gradle                # Gradle settings
└── README.md                      # Project overview
```

## Build & Development

### Prerequisites

- JDK 17 or higher
- Node.js 18 or higher
- Gradle 8.x or higher
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/dlap-ui.git
   cd dlap-ui
   ```

2. Update the Subframe project ID in `frontend/.subframe/sync.json` with your actual project ID.

3. Build the project:
   ```bash
   ./gradlew build
   ```

### Development Workflow

1. **Subframe Design**: Create/update UI components in Subframe.

2. **Sync Components**: Sync Subframe components to the local codebase:
   ```bash
   ./gradlew syncSubframeComponents
   ```

3. **Run Development Server**: Start the frontend development server:
   ```bash
   cd frontend
   npm run start
   ```

4. **Full Stack Development**: For full stack development with the Spring Boot backend:
   ```bash
   ./gradlew bootRun
   ```

5. **Testing**: Run tests:
   ```bash
   ./gradlew test         # Backend tests
   ./gradlew frontendTest # Frontend tests
   ```

## Deployment

### Production Build

To create a production build:

```bash
./gradlew build
```

This will:
1. Build the React application
2. Incorporate the built assets into the Spring Boot application
3. Create an executable JAR file

### Deployment Options

#### Option 1: Standalone JAR

Deploy the generated JAR file to your server:

```bash
java -jar build/libs/dlap-ui-0.1.0-SNAPSHOT.jar
```

#### Option 2: Docker

Build and run as a Docker container:

```bash
# Build Docker image
docker build -t dlap-ui:latest .

# Run container
docker run -p 8080:8080 dlap-ui:latest
```

#### Option 3: Kubernetes

Deploy to a Kubernetes cluster using the provided Helm chart:

```bash
helm install dlap-ui ./kubernetes/helm/dlap-ui
```

## Monitoring & Maintenance

- Application metrics are exposed via Spring Actuator
- Logging is done using SLF4J and Logback
- Error tracking through Sentry integration
- Performance monitoring via New Relic/Datadog (TBD)

## Roadmap

| Phase | Timeline | Features |
|-------|----------|----------|
| 1     | Q1 2024  | Core components, authentication flows |
| 2     | Q2 2024  | Dashboard, user management interfaces |
| 3     | Q3 2024  | Advanced data visualizations, reporting |
| 4     | Q4 2024  | Mobile optimizations, offline capabilities |

## Team

- Product Owner: [Name]
- Tech Lead: [Name]
- UX Designer: [Name]
- Frontend Developers: [Names]
- Backend Developers: [Names]

## Additional Resources

- [Subframe Documentation](https://docs.subframe.com)
- [Design System Guidelines]()
- [API Documentation]()
- [Accessibility Requirements]() 