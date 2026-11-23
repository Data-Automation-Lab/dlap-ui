@echo off
REM DLAP Frontend Linting Check Script (Windows)
REM This script runs ESLint on the frontend code and provides a summary

echo 🔍 DLAP Frontend Linting Check
echo ================================

REM Get the script directory and navigate to frontend
set SCRIPT_DIR=%~dp0
echo 📍 Script directory: %SCRIPT_DIR%

REM Navigate to frontend directory (script is in new-ui/scripts, so go up one level then to frontend)
cd /d "%SCRIPT_DIR%..\frontend"
if errorlevel 1 (
    echo ❌ Failed to navigate to frontend directory
    echo 🔍 Trying alternative path...
    cd /d "%SCRIPT_DIR%..\..\new-ui\frontend"
    if errorlevel 1 (
        echo ❌ Could not find frontend directory
        echo 💡 Please run this script from the new-ui/scripts directory
        pause
        exit /b 1
    )
)

echo 📁 Current directory: %CD%
echo 📄 Checking for package.json...
if not exist "package.json" (
    echo ❌ package.json not found in current directory
    echo 💡 Please ensure you're in the frontend directory
    pause
    exit /b 1
)
echo ✅ Found package.json
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo ⚠️  node_modules not found. Running npm install...
    npm install
    if errorlevel 1 (
        echo ❌ npm install failed
        pause
        exit /b 1
    )
    echo.
)

REM Run TypeScript compiler check
echo 🔧 Running TypeScript compiler check...
npx tsc --noEmit
if errorlevel 1 (
    echo ❌ TypeScript compilation: FAILED
) else (
    echo ✅ TypeScript compilation: PASSED
)
echo.

REM Run ESLint
echo 🔍 Running ESLint check...
npm run lint
if errorlevel 1 (
    echo ⚠️  ESLint check: WARNINGS/ERRORS FOUND
    echo.
    echo 💡 To auto-fix some issues, run:
    echo    npm run lint:fix
) else (
    echo ✅ ESLint check: PASSED
)
echo.

REM Check for common issues
echo 🔍 Checking for common issues...

REM Count TODO comments
set TODO_COUNT=0
for /f %%i in ('findstr /s /c:"TODO:" src\*.tsx src\*.ts 2^>nul ^| find /c /v ""') do set TODO_COUNT=%%i
echo 📝 TODO comments found: %TODO_COUNT%

REM Count console statements  
set CONSOLE_COUNT=0
for /f %%i in ('findstr /s /c:"console." src\*.tsx src\*.ts 2^>nul ^| find /c /v ""') do set CONSOLE_COUNT=%%i
echo 🖥️  Console statements found: %CONSOLE_COUNT%

REM Count any types
set ANY_COUNT=0
for /f %%i in ('findstr /s /c:": any" src\*.tsx src\*.ts 2^>nul ^| find /c /v ""') do set ANY_COUNT=%%i
echo ⚠️  Explicit 'any' types found: %ANY_COUNT%

echo.
echo ✨ Linting check complete!
echo.
echo 💡 Tips:
echo    - TODO comments are allowed during development
echo    - Console statements are allowed for debugging
echo    - Try to avoid 'any' types when possible
echo    - Use underscore prefix for unused variables: _unusedVar
echo.
pause 