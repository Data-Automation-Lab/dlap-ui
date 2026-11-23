@echo off
echo 🔍 DLAP Frontend Debug Build
echo ==============================

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

REM Check node version
echo 🔧 Node.js version:
node --version
echo.

REM Check npm version
echo 📦 NPM version:
npm --version
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo ⚠️  Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ npm install failed
        pause
        exit /b 1
    )
    echo.
)

echo 🔍 Checking for missing dependencies...
npm ls --depth=0
echo.

echo 🔧 Running TypeScript compiler check with detailed output...
npx tsc --noEmit --listFiles > tsc-output.txt 2>&1
if errorlevel 1 (
    echo ❌ TypeScript compilation FAILED
    echo 📄 Error details:
    type tsc-output.txt
    echo.
) else (
    echo ✅ TypeScript compilation: PASSED
)

echo 🏗️ Attempting to build project...
npm run build > build-output.txt 2>&1
if errorlevel 1 (
    echo ❌ Build FAILED
    echo 📄 Build error details:
    type build-output.txt
    echo.
) else (
    echo ✅ Build: PASSED
)

echo 🔍 Running ESLint with detailed output...
npm run lint > lint-output.txt 2>&1
if errorlevel 1 (
    echo ⚠️  ESLint found issues
    echo 📄 ESLint details:
    type lint-output.txt
    echo.
) else (
    echo ✅ ESLint: PASSED
)

echo.
echo 📊 Summary Files Created:
echo   - tsc-output.txt (TypeScript compilation details)
echo   - build-output.txt (Build process details)
echo   - lint-output.txt (ESLint results)
echo.
echo ✨ Debug build complete!
pause 