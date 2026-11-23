#!/bin/bash

# DLAP Frontend Linting Check Script
# This script runs ESLint on the frontend code and provides a summary

echo "🔍 DLAP Frontend Linting Check"
echo "================================"

# Navigate to frontend directory
cd "$(dirname "$0")/../frontend" || exit 1

echo "📁 Current directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Running npm install..."
    npm install
    echo ""
fi

# Run TypeScript compiler check
echo "🔧 Running TypeScript compiler check..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation: PASSED"
else
    echo "❌ TypeScript compilation: FAILED"
fi
echo ""

# Run ESLint
echo "🔍 Running ESLint check..."
if npm run lint; then
    echo "✅ ESLint check: PASSED"
else
    echo "⚠️  ESLint check: WARNINGS/ERRORS FOUND"
    echo ""
    echo "💡 To auto-fix some issues, run:"
    echo "   npm run lint:fix"
fi
echo ""

# Check for common issues
echo "🔍 Checking for common issues..."

# Check for TODO comments
TODO_COUNT=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -c "TODO:" 2>/dev/null | awk -F: '{sum += $2} END {print sum+0}')
echo "📝 TODO comments found: $TODO_COUNT"

# Check for console statements
CONSOLE_COUNT=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -c "console\." 2>/dev/null | awk -F: '{sum += $2} END {print sum+0}')
echo "🖥️  Console statements found: $CONSOLE_COUNT"

# Check for any types
ANY_COUNT=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -c ": any" 2>/dev/null | awk -F: '{sum += $2} END {print sum+0}')
echo "⚠️  Explicit 'any' types found: $ANY_COUNT"

echo ""
echo "✨ Linting check complete!"
echo ""
echo "💡 Tips:"
echo "   - TODO comments are allowed during development"
echo "   - Console statements are allowed for debugging"
echo "   - Try to avoid 'any' types when possible"
echo "   - Use underscore prefix for unused variables: _unusedVar" 