@echo off
echo 🔍 Simple DLAP Frontend Lint Check
echo ====================================

REM Navigate to the frontend directory
echo 📁 Navigating to frontend directory...
cd /d "E:\Dev\eclipse-workspace\dlap\microservices-dlap\new-ui\frontend"

REM Check if we're in the right place
if not exist "package.json" (
    echo ❌ Could not find package.json
    echo 💡 Make sure the path is correct
    pause
    exit /b 1
)

echo ✅ Found package.json in: %CD%
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo ⚠️  Installing dependencies...
    npm install
    echo.
)

echo 🔧 Running TypeScript check...
npx tsc --noEmit
echo.

echo 🔍 Running ESLint...
npm run lint
echo.

echo ✨ Lint check complete!
pause 