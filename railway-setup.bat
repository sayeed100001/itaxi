@echo off
echo ========================================
echo Railway Backend Deployment Setup
echo ========================================
echo.

echo Step 1: Open Railway Dashboard
echo URL: https://railway.com/project/5f760a51-1e1c-4312-b094-6f4273519734
echo.
echo Step 2: Click "+ New" button
echo Step 3: Select "GitHub Repo"
echo Step 4: Choose "sayeed100001/itaxi"
echo Step 5: Wait for deployment to complete
echo.
echo Step 6: Click on the new service
echo Step 7: Go to "Settings" tab
echo Step 8: Click "Generate Domain" to get public URL
echo.
echo Step 9: Copy the domain URL (e.g., https://itaxi-backend-production.up.railway.app)
echo.
echo Step 10: Run the following commands:
echo   vercel env add VITE_API_URL production
echo   [Paste Railway URL]
echo.
echo   vercel env add VITE_SOCKET_URL production
echo   [Paste Railway URL]
echo.
echo   vercel --prod
echo.
echo ========================================
echo Your iTaxi app will be fully working!
echo ========================================
pause
