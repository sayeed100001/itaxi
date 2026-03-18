param(
  [switch]$Build,
  [string]$Output = "release\\itaxi.zip"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseDir = Join-Path $repoRoot "release"
$stagingDir = Join-Path $releaseDir "_staging"
$zipPath = Join-Path $repoRoot $Output

Write-Host "iTaxi packaging..." -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host "Zip:  $zipPath"

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

Push-Location $repoRoot
try {
  if ($Build) {
    Write-Host "Building frontend (dist/)..." -ForegroundColor Cyan
    npm run build
  }

  $excludeDirs = @(
    ".git",
    ".github",
    "node_modules",
    ".vercel",
    "logs",
    "release",
    "migrated_prompt_history",
    ".qodo",
    ".qoder",
    "public\\uploads",
    "dist\\uploads"
  )

  $excludeFiles = @(
    ".env",
    ".env*",
    "*.log",
    "server-log.txt",
    ".DS_Store",
    "Thumbs.db",
    "comprehensive-test.js",
    "comprehensive-test.cjs",
    "integration-test.js",
    "integration-test-result.json",
    "INTEGRATION-TEST-FINAL.js",
    "test-*.js",
    "fix-and-test.sh",
    "push-fixes.sh",
    "railway-setup.bat"
  )

  $robocopyArgs = @(
    "$repoRoot",
    "$stagingDir",
    "/E",
    "/NFL", "/NDL", "/NJH", "/NJS", "/NP",
    "/XD"
  ) + $excludeDirs + @(
    "/XF"
  ) + $excludeFiles

  $null = & robocopy @robocopyArgs
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE"
  }

  # Ensure .env.example is included (we exclude .env* above).
  if (Test-Path (Join-Path $repoRoot ".env.example")) {
    Copy-Item -Force (Join-Path $repoRoot ".env.example") (Join-Path $stagingDir ".env.example")
  }

  $removePaths = @(
    ".github",
    "dist\\uploads",
    "public\\uploads",
    "comprehensive-test.cjs",
    "comprehensive-test.js",
    "integration-test.js",
    "integration-test-result.json",
    "INTEGRATION-TEST-FINAL.js",
    "fix-and-test.sh",
    "push-fixes.sh",
    "railway-setup.bat"
  )

  foreach ($relativePath in $removePaths) {
    $targetPath = Join-Path $stagingDir $relativePath
    if (Test-Path $targetPath) {
      Remove-Item $targetPath -Recurse -Force
    }
  }

  Get-ChildItem -Path $stagingDir -Filter "test-*.js" -File -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
  }

  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Write-Host "Creating zip..." -ForegroundColor Cyan
  Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -Force

  $zipItem = Get-Item $zipPath
  Write-Host "Done: $($zipItem.FullName) ($([Math]::Round($zipItem.Length / 1MB, 2)) MB)" -ForegroundColor Green
  if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Recurse -Force
  }
}
finally {
  Pop-Location
}
