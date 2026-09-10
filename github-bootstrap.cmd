@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem ============================================================
rem ONE FILE ONLY: pure Windows CMD, no PowerShell helper.
rem Edit only these values if you want different repository data.
rem ============================================================
set "REPO_NAME=pyeong-plan-studio"
set "REPO_DESCRIPTION=Floor plan, site boundary, area and pyeong calculator for GitHub Pages"
set "VISIBILITY=public"
set "TOPICS=floor-plan area-calculator architecture svg-editor github-pages korean-webapp"
set "INITIAL_TAG=v1.0.0"
set "INITIAL_COMMIT=feat: release site and building floor-plan studio"
set "LOG=%CD%\github-bootstrap.log"

>"%LOG%" echo [%date% %time%] Bootstrap started
call :log CHECK "Starting GitHub bootstrap"

rem ----- Project files -------------------------------------------------
call :log CHECK "Checking project files"
if not exist "index.html" (
  set "FAIL_MSG=Missing index.html. Extract the full ZIP first."
  set "RECOVERY=Run this CMD from the floorplan-calculator folder."
  goto :failed
)
if not exist "package.json" (
  set "FAIL_MSG=Missing package.json. Extract the full ZIP first."
  set "RECOVERY=Run this CMD from the floorplan-calculator folder."
  goto :failed
)
if not exist ".gitignore" (
  set "FAIL_MSG=Missing .gitignore. Extract the full ZIP first."
  set "RECOVERY=Run this CMD from the floorplan-calculator folder."
  goto :failed
)
if not exist ".github\workflows\deploy.yml" (
  set "FAIL_MSG=Missing deploy workflow. Extract the full ZIP first."
  set "RECOVERY=Run this CMD from the floorplan-calculator folder."
  goto :failed
)
if "%REPO_NAME%"=="" (
  set "FAIL_MSG=REPO_NAME is empty."
  set "RECOVERY=Set REPO_NAME near the top of github-bootstrap.cmd."
  goto :failed
)
call :log OK "Project files look complete"

rem ----- Required programs ---------------------------------------------
call :log CHECK "Checking Git"
where git >nul 2>&1
if errorlevel 1 (
  set "FAIL_MSG=Git is not installed."
  set "RECOVERY=winget install --id Git.Git -e --source winget"
  goto :failed
)
for /f "delims=" %%V in ('git --version 2^>nul') do if not defined GIT_VERSION set "GIT_VERSION=%%V"
call :log OK "!GIT_VERSION!"

call :log CHECK "Checking GitHub CLI"
where gh >nul 2>&1
if errorlevel 1 (
  set "FAIL_MSG=GitHub CLI is not installed."
  set "RECOVERY=winget install --id GitHub.cli -e --source winget"
  goto :failed
)
for /f "delims=" %%V in ('gh --version 2^>nul') do if not defined GH_VERSION set "GH_VERSION=%%V"
call :log OK "!GH_VERSION!"

rem ----- GitHub login --------------------------------------------------
call :log CHECK "Checking GitHub login"
gh auth status >nul 2>&1
if errorlevel 1 (
  call :log WARN "GitHub login is required. Browser login will start."
  gh auth login --hostname github.com --git-protocol https --web
  if errorlevel 1 (
    set "FAIL_MSG=GitHub login failed or was cancelled."
    set "RECOVERY=gh auth login --hostname github.com --git-protocol https --web"
    goto :failed
  )
)
for /f "usebackq delims=" %%U in (`gh api user --jq .login 2^>nul`) do if not defined OWNER set "OWNER=%%U"
if not defined OWNER (
  set "FAIL_MSG=Could not read the GitHub username."
  set "RECOVERY=gh auth status"
  goto :failed
)
call :log OK "Logged in as !OWNER!"
gh auth setup-git >nul 2>&1

set "TARGET=!OWNER!/%REPO_NAME%"
set "REPO_URL=https://github.com/!TARGET!"
set "ORIGIN_URL=!REPO_URL!.git"
if /I "%REPO_NAME%"=="!OWNER!.github.io" (
  set "DEPLOY_URL=https://!OWNER!.github.io/"
) else (
  set "DEPLOY_URL=https://!OWNER!.github.io/%REPO_NAME%/"
)
call :log OK "Target repository: !TARGET!"

rem ----- Always isolate Git to this exact project folder ---------------
call :log CHECK "Preparing project-local Git repository"
if not exist ".git\" (
  git init -b main . >>"%LOG%" 2>&1
  if errorlevel 1 (
    git init . >>"%LOG%" 2>&1
    if errorlevel 1 (
      set "FAIL_MSG=git init failed."
      set "RECOVERY=git init -b main ."
      goto :failed
    )
    git branch -M main >>"%LOG%" 2>&1
    if errorlevel 1 (
      set "FAIL_MSG=Could not set main branch."
      set "RECOVERY=git branch -M main"
      goto :failed
    )
  )
  call :log OK "Created a local Git repository in this folder"
) else (
  call :log OK "Project-local .git folder already exists"
)

for %%R in ("%CD%") do set "PROJECT_ROOT=%%~fR"
set "GIT_ROOT="
for /f "delims=" %%R in ('git rev-parse --show-toplevel 2^>nul') do if not defined GIT_ROOT set "GIT_ROOT=%%R"
if not defined GIT_ROOT (
  set "FAIL_MSG=Could not determine Git root."
  set "RECOVERY=git rev-parse --show-toplevel"
  goto :failed
)
set "GIT_ROOT=!GIT_ROOT:/=\!"
if /I not "!GIT_ROOT!"=="!PROJECT_ROOT!" (
  set "FAIL_MSG=Git root is not this project folder: !GIT_ROOT!"
  set "RECOVERY=Delete only this project's .git folder, then rerun this CMD."
  goto :failed
)
git config core.longpaths true >nul 2>&1
call :log OK "Git root is safely isolated to this project folder"

rem ----- Branch and identity -------------------------------------------
git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
  git symbolic-ref HEAD refs/heads/main >>"%LOG%" 2>&1
  if errorlevel 1 (
    set "FAIL_MSG=Could not set the initial main branch."
    set "RECOVERY=git symbolic-ref HEAD refs/heads/main"
    goto :failed
  )
) else (
  git branch -M main >>"%LOG%" 2>&1
  if errorlevel 1 (
    set "FAIL_MSG=Could not rename the branch to main."
    set "RECOVERY=git branch -M main"
    goto :failed
  )
)

set "GIT_NAME="
for /f "delims=" %%N in ('git config --get user.name 2^>nul') do if not defined GIT_NAME set "GIT_NAME=%%N"
if not defined GIT_NAME git config user.name "!OWNER!" >>"%LOG%" 2>&1
set "GIT_EMAIL="
for /f "delims=" %%E in ('git config --get user.email 2^>nul') do if not defined GIT_EMAIL set "GIT_EMAIL=%%E"
if not defined GIT_EMAIL git config user.email "!OWNER!@users.noreply.github.com" >>"%LOG%" 2>&1
call :log OK "Git identity is configured"

rem ----- Fast local build: no package installation ---------------------
where node >nul 2>&1
if errorlevel 1 (
  call :log WARN "Node.js is not installed locally. GitHub Actions will build remotely."
) else (
  call :log CHECK "Running local build"
  call npm run build
  if errorlevel 1 (
    set "FAIL_MSG=Local build failed."
    set "RECOVERY=npm run build"
    goto :failed
  )
  call :log OK "Local build passed"
)

rem ----- Create or reuse the GitHub repository -------------------------
call :log CHECK "Checking GitHub repository !TARGET!"
gh repo view "!TARGET!" --json nameWithOwner >nul 2>&1
if errorlevel 1 (
  call :log INFO "Repository does not exist yet. Creating it now."
  if /I "%VISIBILITY%"=="private" (
    gh repo create "!TARGET!" --private --description "%REPO_DESCRIPTION%"
  ) else (
    gh repo create "!TARGET!" --public --description "%REPO_DESCRIPTION%"
  )
  if errorlevel 1 (
    set "FAIL_MSG=Repository creation failed."
    set "RECOVERY=gh repo create !TARGET! --public"
    goto :failed
  )
  call :log OK "Repository created"
) else (
  call :log OK "Repository already exists"
)

rem ----- Remote --------------------------------------------------------
call :log CHECK "Configuring origin remote"
set "CURRENT_ORIGIN="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do if not defined CURRENT_ORIGIN set "CURRENT_ORIGIN=%%R"
if not defined CURRENT_ORIGIN (
  git remote add origin "!ORIGIN_URL!" >>"%LOG%" 2>&1
  if errorlevel 1 (
    set "FAIL_MSG=Could not add origin remote."
    set "RECOVERY=git remote add origin !ORIGIN_URL!"
    goto :failed
  )
) else if /I not "!CURRENT_ORIGIN!"=="!ORIGIN_URL!" (
  git remote set-url origin "!ORIGIN_URL!" >>"%LOG%" 2>&1
  if errorlevel 1 (
    set "FAIL_MSG=Could not update origin remote."
    set "RECOVERY=git remote set-url origin !ORIGIN_URL!"
    goto :failed
  )
)
call :log OK "origin = !ORIGIN_URL!"

rem ----- Stage only this repository -----------------------------------
call :log CHECK "Staging project files"
git add -A .
if errorlevel 1 (
  set "FAIL_MSG=git add failed."
  set "RECOVERY=git status"
  goto :failed
)

set /a STAGED_COUNT=0
set "BAD_STAGE="
for /f "delims=" %%F in ('git diff --cached --name-only 2^>nul') do (
  set /a STAGED_COUNT+=1
  set "STAGED_FILE=%%F"
  echo(!STAGED_FILE!| findstr /I /C:".cache/" /C:"codex-runtimes" /C:"node_modules/" >nul && set "BAD_STAGE=1"
)
if defined BAD_STAGE (
  git reset >nul 2>&1
  set "FAIL_MSG=Safety stop: runtime/cache files were staged."
  set "RECOVERY=Check .gitignore, then run this CMD again."
  goto :failed
)

if !STAGED_COUNT! EQU 0 (
  git rev-parse --verify HEAD >nul 2>&1
  if errorlevel 1 (
    set "FAIL_MSG=No project files were staged for the first commit."
    set "RECOVERY=git status --short"
    goto :failed
  )
  call :log OK "No new files need committing"
) else (
  call :log OK "Staged !STAGED_COUNT! project files"
  git rev-parse --verify HEAD >nul 2>&1
  if errorlevel 1 (
    git commit -m "%INITIAL_COMMIT%"
  ) else (
    git commit -m "chore: update floor-plan studio"
  )
  if errorlevel 1 (
    set "FAIL_MSG=git commit failed."
    set "RECOVERY=git status"
    goto :failed
  )
  call :log OK "Commit created"
)

rem ----- Push ----------------------------------------------------------
call :log CHECK "Pushing main branch to GitHub"
git push -u origin main
if errorlevel 1 (
  set "FAIL_MSG=git push failed."
  set "RECOVERY=git push -u origin main"
  goto :failed
)
call :log OK "Source uploaded: !REPO_URL!"

rem ----- GitHub About: description, website, topics -------------------
call :log CHECK "Updating GitHub About metadata"
gh repo edit "!TARGET!" --description "%REPO_DESCRIPTION%" --homepage "!DEPLOY_URL!" --default-branch main
if errorlevel 1 call :log WARN "Description/homepage update failed; continuing with deployment."
for %%T in (%TOPICS%) do gh repo edit "!TARGET!" --add-topic "%%T" >nul 2>&1
call :log OK "About metadata step completed"

rem ----- GitHub Pages --------------------------------------------------
call :log CHECK "Enabling GitHub Pages with Actions"
gh api "repos/!TARGET!/pages" >nul 2>&1
if errorlevel 1 (
  gh api -X POST "repos/!TARGET!/pages" -f "build_type=workflow" >nul
  if errorlevel 1 (
    set "FAIL_MSG=Could not enable GitHub Pages."
    set "RECOVERY=gh api -X POST repos/!TARGET!/pages -f build_type=workflow"
    goto :failed
  )
) else (
  gh api -X PUT "repos/!TARGET!/pages" -f "build_type=workflow" >nul 2>&1
)
call :log OK "GitHub Pages is configured"

rem ----- Start a clean deployment run after Pages is enabled ----------
call :log CHECK "Starting deployment workflow"
gh workflow run deploy.yml -R "!TARGET!" --ref main
if errorlevel 1 (
  set "FAIL_MSG=Could not start deploy.yml."
  set "RECOVERY=gh workflow run deploy.yml -R !TARGET! --ref main"
  goto :failed
)
timeout /t 5 /nobreak >nul

set "RUN_ID="
for /f "delims=" %%I in ('gh run list -R "!TARGET!" --workflow deploy.yml --branch main --event workflow_dispatch --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul') do if not defined RUN_ID set "RUN_ID=%%I"
if not defined RUN_ID (
  timeout /t 4 /nobreak >nul
  for /f "delims=" %%I in ('gh run list -R "!TARGET!" --workflow deploy.yml --branch main --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul') do if not defined RUN_ID set "RUN_ID=%%I"
)
if not defined RUN_ID (
  set "FAIL_MSG=Could not find the deployment run."
  set "RECOVERY=gh run list -R !TARGET! --workflow deploy.yml"
  goto :failed
)
call :log CHECK "Watching GitHub Actions run !RUN_ID!"
gh run watch "!RUN_ID!" -R "!TARGET!" --compact --exit-status
if errorlevel 1 (
  set "FAIL_MSG=GitHub Pages deployment failed."
  set "RECOVERY=gh run view !RUN_ID! -R !TARGET! --log-failed"
  goto :failed
)

set "PAGE_URL="
for /f "delims=" %%P in ('gh api "repos/!TARGET!/pages" --jq .html_url 2^>nul') do if not defined PAGE_URL set "PAGE_URL=%%P"
if defined PAGE_URL set "DEPLOY_URL=!PAGE_URL!"
call :log OK "Deployment succeeded: !DEPLOY_URL!"

rem ----- Initial tag and release --------------------------------------
call :log CHECK "Checking initial release %INITIAL_TAG%"
gh release view "%INITIAL_TAG%" -R "!TARGET!" >nul 2>&1
if errorlevel 1 (
  git fetch --tags origin >nul 2>&1
  git rev-parse -q --verify "refs/tags/%INITIAL_TAG%" >nul 2>&1
  if errorlevel 1 (
    git tag -a "%INITIAL_TAG%" -m "Initial stable release"
    if errorlevel 1 (
      set "FAIL_MSG=Could not create tag %INITIAL_TAG%."
      set "RECOVERY=git tag -a %INITIAL_TAG% -m release"
      goto :failed
    )
    git push origin "%INITIAL_TAG%"
    if errorlevel 1 (
      set "FAIL_MSG=Could not push tag %INITIAL_TAG%."
      set "RECOVERY=git push origin %INITIAL_TAG%"
      goto :failed
    )
  )
  gh release create "%INITIAL_TAG%" -R "!TARGET!" --title "%INITIAL_TAG%" --notes "Initial stable release of Pyeong Plan Studio."
  if errorlevel 1 call :log WARN "Release creation failed; source and Pages are already deployed."
) else (
  call :log OK "Release already exists"
)

call :log OK "Bootstrap completed"
echo.
echo Repository: !REPO_URL!
echo Pages:      !DEPLOY_URL!
echo Log:        %LOG%
echo.
pause
exit /b 0

:failed
call :log ERROR "!FAIL_MSG!"
if defined RECOVERY (
  echo Recovery: !RECOVERY!
  >>"%LOG%" echo Recovery: !RECOVERY!
)
echo [INFO] No automatic software installation was attempted.
echo [INFO] Fix the issue above, then run this CMD again.
echo [INFO] Log: %LOG%
echo.
pause
exit /b 1

:log
set "LEVEL=%~1"
set "MESSAGE=%~2"
echo [%LEVEL%] %MESSAGE%
>>"%LOG%" echo [%date% %time%] [%LEVEL%] %MESSAGE%
exit /b 0
