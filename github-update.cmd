@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "REPO=ko9ma7/pyeong-plan-studio"
set "TAG=v1.2.0"
set "TMP=%TEMP%\pyeong-plan-studio-update-%RANDOM%-%RANDOM%"

echo [CHECK] GitHub update %TAG%
where git >nul 2>&1 || (echo [ERROR] Git is not installed.& pause & exit /b 1)
where gh >nul 2>&1 || (echo [ERROR] GitHub CLI gh is not installed.& pause & exit /b 1)
gh auth status >nul 2>&1 || (echo [ERROR] GitHub login is required. Run: gh auth login& pause & exit /b 1)
if not exist "index.html" (echo [ERROR] Run this CMD inside the project folder.& pause & exit /b 1)

if exist "%TMP%" rmdir /s /q "%TMP%"
echo [CHECK] Cloning existing repository
gh repo clone "%REPO%" "%TMP%" || (echo [ERROR] Clone failed.& pause & exit /b 1)

for %%D in (src public scripts .github) do (
  if exist "%TMP%\%%D" rmdir /s /q "%TMP%\%%D"
  if exist "%%D" xcopy "%%D" "%TMP%\%%D\" /E /I /Y >nul
)
for %%F in (index.html package.json package-lock.json README.md LICENSE .gitignore .gitattributes github-bootstrap.cmd github-update.cmd) do (
  if exist "%%F" copy /Y "%%F" "%TMP%\%%F" >nul
)

cd /d "%TMP%"
git add -A || goto :fail
for /f %%C in ('git diff --cached --name-only ^| find /c /v ""') do set "COUNT=%%C"
if "%COUNT%"=="0" (
  echo [OK] No source changes to upload.
) else (
  echo [CHECK] Committing %COUNT% changed files
  git commit -m "feat: add editable floor-plan template library" || goto :fail
  echo [CHECK] Pushing main
  git push origin main || goto :fail
  echo [OK] Source update pushed
)

echo [CHECK] Starting Pages deployment
gh workflow run deploy.yml --ref main -R "%REPO%" >nul 2>&1
for /f "usebackq tokens=*" %%R in (`gh run list -R "%REPO%" --workflow deploy.yml --branch main --limit 1 --json databaseId --jq ".[0].databaseId"`) do set "RUNID=%%R"
if defined RUNID gh run watch %RUNID% -R "%REPO%" --exit-status

for /f %%T in ('git tag -l "%TAG%"') do set "HAS_TAG=%%T"
if not defined HAS_TAG (
  git tag "%TAG%"
  git push origin "%TAG%"
  gh release create "%TAG%" -R "%REPO%" --title "%TAG%" --notes "Built-in editable apartment, house, factory and office template library." >nul 2>&1
)

echo.
echo [OK] Update completed
echo Repository: https://github.com/%REPO%
echo Pages:      https://ko9ma7.github.io/pyeong-plan-studio/
cd /d "%~dp0"
rmdir /s /q "%TMP%" >nul 2>&1
pause
exit /b 0

:fail
echo [ERROR] Update failed. The temporary clone remains here:
echo %TMP%
pause
exit /b 1
