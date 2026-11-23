@echo off
echo 🔧 DLAP Frontend Quick Fix
echo ============================

REM Navigate to the frontend directory
cd /d "E:\Dev\eclipse-workspace\dlap\microservices-dlap\new-ui\frontend"

echo 📁 Current directory: %CD%
echo.

echo 🧹 Cleaning previous builds...
if exist "build" rmdir /s /q build
if exist "node_modules\.cache" rmdir /s /q node_modules\.cache
echo ✅ Cleaned build artifacts
echo.

echo 📦 Reinstalling dependencies...
npm install
if errorlevel 1 (
    echo ❌ npm install failed, trying to fix...
    npm cache clean --force
    rmdir /s /q node_modules
    npm install
)
echo.

echo 🔧 Fixing potential dependency issues...
npm audit fix --force
echo.

echo 🎨 Checking if all Subframe components are available...
npm list @subframe/core
echo.

echo 📊 Checking date-fns...
npm list date-fns
echo.

echo 🔐 Checking axios...
npm list axios
echo.

echo ⚛️ Checking React Router...
npm list react-router-dom
echo.

echo 🎯 Testing TypeScript compilation...
npx tsc --noEmit
if errorlevel 1 (
    echo ❌ TypeScript errors found
    echo 💡 Check the errors above for specific issues
) else (
    echo ✅ TypeScript compilation successful
)
echo.

echo 🏗️ Testing build...
npm run build
if errorlevel 1 (
    echo ❌ Build failed
    echo 💡 Check the errors above for specific issues
) else (
    echo ✅ Build successful
)
echo.

echo ✨ Quick fix complete!
pause 