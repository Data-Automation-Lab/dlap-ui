# DLAP Frontend Linting Setup

## Overview

This document explains the ESLint configuration and linting setup for the DLAP frontend application. The configuration is designed to maintain code quality while being practical for development.

## ESLint Configuration

### Location
- **Configuration File**: `frontend/.eslintrc.js`
- **Package Scripts**: Added to `frontend/package.json`

### Key Rules Configured

#### Development-Friendly Rules
```javascript
// Allow TODO comments during development
'no-warning-comments': 'off'

// Allow console statements for debugging and logging
'no-console': 'off'

// Allow alert() for temporary notifications
'no-alert': 'warn'
```

#### TypeScript Rules
```javascript
// Allow any type for error handling during development
'@typescript-eslint/no-explicit-any': 'warn'

// Allow non-null assertions
'@typescript-eslint/no-non-null-assertion': 'warn'

// Allow empty interfaces for type definitions
'@typescript-eslint/no-empty-interface': 'warn'
```

#### React Rules
```javascript
// Relax some React rules for development
'react-hooks/exhaustive-deps': 'warn'
```

#### Variable Rules
```javascript
// Allow unused variables if they start with underscore
'@typescript-eslint/no-unused-vars': [
  'warn',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_'
  }
]
```

## Available Scripts

### NPM Scripts
```bash
# Run linting check
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Run TypeScript compiler check
npx tsc --noEmit
```

### Helper Scripts
```bash
# Windows
scripts/lint-check.bat

# Linux/Mac
scripts/lint-check.sh
```

## Common Linting Issues and Solutions

### 1. TODO Comments
**Issue**: ESLint warns about TODO comments
**Solution**: Configured as `off` - TODO comments are allowed during development

### 2. Console Statements
**Issue**: ESLint warns about `console.log`, `console.error`
**Solution**: Configured as `off` - Console statements are allowed for debugging

### 3. Unused Variables
**Issue**: Variables declared but not used
**Solution**: Prefix unused variables with underscore:
```typescript
// Instead of:
const unusedVar = getValue();

// Use:
const _unusedVar = getValue();
```

### 4. Any Types
**Issue**: Using `any` type reduces type safety
**Solution**: Try to use specific types when possible:
```typescript
// Instead of:
const data: any = response.data;

// Use:
interface ResponseData {
  id: string;
  name: string;
}
const data: ResponseData = response.data;
```

### 5. useEffect Dependencies
**Issue**: Missing dependencies in useEffect
**Solution**: Add all dependencies or use ESLint disable comment:
```typescript
// Add dependencies:
useEffect(() => {
  fetchData();
}, [fetchData]);

// Or disable for specific case:
useEffect(() => {
  fetchData();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

## Best Practices

### 1. Type Safety
- Prefer specific types over `any`
- Use interfaces for complex objects
- Leverage TypeScript's type inference

### 2. Error Handling
```typescript
// Good error handling with proper typing
try {
  await apiCall();
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error('API Error:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 3. Component Props
```typescript
// Define proper interfaces for props
interface ComponentProps {
  title: string;
  onAction?: () => void;
  data: DataType[];
}

const Component: React.FC<ComponentProps> = ({ title, onAction, data }) => {
  // Component implementation
};
```

### 4. Event Handlers
```typescript
// Proper event handler typing
const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  setValue(event.target.value);
};
```

## Running Linting Checks

### Manual Check
```bash
cd frontend
npm run lint
```

### Auto-fix Issues
```bash
cd frontend
npm run lint:fix
```

### Comprehensive Check (Windows)
```bash
scripts\lint-check.bat
```

### Comprehensive Check (Linux/Mac)
```bash
./scripts/lint-check.sh
```

## Integration with Build Process

The linting is integrated into the build process:
- **Development**: Warnings are shown but don't block development
- **Build**: Serious errors will fail the build
- **CI/CD**: Linting checks should be part of the pipeline

## Troubleshooting

### Common Issues

1. **ESLint not found**
   ```bash
   npm install
   ```

2. **TypeScript errors**
   ```bash
   npx tsc --noEmit
   ```

3. **Configuration conflicts**
   - Ensure only one ESLint config exists (`.eslintrc.js`)
   - Remove inline `eslintConfig` from `package.json`

### Getting Help

1. Check this documentation
2. Run the helper scripts for detailed analysis
3. Review the ESLint configuration in `.eslintrc.js`
4. Check the TypeScript configuration in `tsconfig.json`

## Summary

The DLAP frontend linting setup is configured to:
- ✅ Maintain code quality
- ✅ Allow development flexibility
- ✅ Provide helpful warnings without blocking development
- ✅ Support TypeScript best practices
- ✅ Enable easy debugging and development

The configuration strikes a balance between code quality and development productivity, making it suitable for the DLAP project's development phase. 