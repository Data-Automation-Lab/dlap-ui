@echo off
echo 🔍 DLAP Git Changes Comparison
echo =================================

REM Navigate to the new-ui directory
cd /d "E:\Dev\eclipse-workspace\dlap\microservices-dlap\new-ui"

echo 📁 Current directory: %CD%
echo.

echo 🔍 Git Status:
git status --porcelain
echo.

echo 📊 Recent Commits:
git log --oneline -10
echo.

echo 🔍 Modified Files Summary:
echo ===========================
git status --porcelain | findstr "^.M\|^M"
echo.

echo 🔍 Files Changed in Last Commit:
git diff --name-only HEAD~1
echo.

echo 📄 Checking specific frontend files...
echo ======================================

if exist "frontend\src\pages\EventCenter.tsx" (
    echo ✅ EventCenter.tsx exists
) else (
    echo ❌ EventCenter.tsx missing
)

if exist "frontend\src\pages\EventAnalytics.tsx" (
    echo ✅ EventAnalytics.tsx exists
) else (
    echo ❌ EventAnalytics.tsx missing
)

if exist "frontend\src\pages\EventSubscriptions.tsx" (
    echo ✅ EventSubscriptions.tsx exists
) else (
    echo ❌ EventSubscriptions.tsx missing
)

if exist "frontend\src\utils\eventCenterApi.ts" (
    echo ✅ eventCenterApi.ts exists
) else (
    echo ❌ eventCenterApi.ts missing
)

echo.
echo 🔍 Package.json differences (if any):
echo =====================================
git diff HEAD~1 frontend/package.json
echo.

echo 🔍 TypeScript config differences (if any):
echo ==========================================
git diff HEAD~1 frontend/tsconfig.json
echo.

echo ✨ Git comparison complete!
pause 