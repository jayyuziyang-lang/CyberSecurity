# =============================================================================
#  pack.ps1 -- build the deliverable source zip
# -----------------------------------------------------------------------------
#  Usage:
#      powershell -ExecutionPolicy Bypass -File tools/pack.ps1
#
#  Output:
#      CyberSecurity-<yyyyMMdd>.zip   (written next to the project folder)
#
#  设计原则 / Design notes:
#    1. 排除「本机生成、别人不需要」的东西：
#       target/（58MB 构建产物，且里面的绝对路径写死为本机路径，必须排除）
#       .idea/ + *.iml（本机 IDE 配置，含本机数据库结构快照，会让别人困惑）
#    2. 保留 mvnw / mvnw.cmd / .mvn/wrapper/maven-wrapper.properties
#       —— 收件人不必预装 Maven，wrapper 会自行下载。
#    3. 打完包后**重新解压到临时目录**，在干净副本上跑完整校验
#       （编译 + 结构一致性 + 小程序自检 + 算法验证），
#       验证的是「别人拿到这个 zip 能跑」，而不是「我本机能跑」。
#
#  ENCODING: this file must be saved as UTF-8 *with* BOM, because Windows
#  PowerShell 5.1 decodes BOM-less files with the system ANSI codepage and the
#  Chinese comments below would turn to garbage, breaking the parse.
#  All runtime strings are deliberately ASCII-only so that even if the encoding
#  slips again, only comments are affected -- never behaviour.
#  Run tools/fix_ps1_encoding.ps1 to repair this file if needed.
# =============================================================================

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir   = Split-Path -Parent $repoRoot
$name     = 'CyberSecurity'
$stamp    = Get-Date -Format 'yyyyMMdd'
$zipPath  = Join-Path $outDir "$name-$stamp.zip"

Write-Host "=== 1/4  clean generated artifacts ===" -ForegroundColor Cyan
foreach ($rel in @('backend\target', 'backend\.idea')) {
    $p = Join-Path $repoRoot $rel
    if (Test-Path $p) { Remove-Item $p -Recurse -Force; Write-Host "  removed $rel" }
}
Get-ChildItem $repoRoot -Recurse -File -Filter *.iml | ForEach-Object {
    Remove-Item $_.FullName -Force; Write-Host "  removed $($_.Name)"
}

Write-Host ""
Write-Host "=== 2/4  stage a clean copy and zip it ===" -ForegroundColor Cyan
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$stage     = Join-Path ([System.IO.Path]::GetTempPath()) ("pack-" + [guid]::NewGuid().ToString('N'))
$stageProj = Join-Path $stage $name
New-Item -ItemType Directory -Force -Path $stageProj | Out-Null

$excludeDirs  = @('target', '.idea', 'node_modules', '.git')
$excludeFiles = @('*.iml', '*.log')

Get-ChildItem $repoRoot -Recurse -Force | ForEach-Object {
    $rel   = $_.FullName.Substring($repoRoot.Length + 1)
    $parts = $rel -split '[\\/]'

    $skipDir = $false
    foreach ($d in $parts) { if ($excludeDirs -contains $d) { $skipDir = $true } }
    if ($skipDir) { return }

    $dest = Join-Path $stageProj $rel
    if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
    } else {
        foreach ($pat in $excludeFiles) { if ($_.Name -like $pat) { return } }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
        Copy-Item $_.FullName -Destination $dest -Force
    }
}

Compress-Archive -Path $stageProj -DestinationPath $zipPath -CompressionLevel Optimal -Force
Remove-Item $stage -Recurse -Force

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "=== 3/4  inspect the archive ===" -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip     = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$entries = $zip.Entries

Write-Host "  zip:   $zipPath"
Write-Host "  size:  $sizeMB MB, entries: $($entries.Count)"

$leak = @($entries | Where-Object {
    $_.FullName -match '(^|/)(target|\.idea|node_modules)/' -or $_.Name -like '*.iml'
})
if ($leak.Count -gt 0) {
    Write-Host "  [FAIL] host-only files leaked into the package:"
    $leak | Select-Object -First 10 | ForEach-Object { Write-Host "    $($_.FullName)" }
    $zip.Dispose()
    exit 1
}
Write-Host "  [OK]   no target/ .idea/ *.iml leakage"
$zip.Dispose()

Write-Host ""
Write-Host "=== 4/4  re-extract and verify on the clean copy ===" -ForegroundColor Cyan

$verify = Join-Path ([System.IO.Path]::GetTempPath()) ("verify-" + [guid]::NewGuid().ToString('N'))
Expand-Archive -Path $zipPath -DestinationPath $verify -Force
$vProj = Join-Path $verify $name

$results = @()
function Add-Result($label, $passed) {
    $script:results += [pscustomobject]@{ Label = $label; Pass = [bool]$passed }
}

# --- 4.1 required files present -------------------------------------------
$required = @(
    'backend/pom.xml',
    'backend/mvnw',
    'backend/mvnw.cmd',
    'backend/.mvn/wrapper/maven-wrapper.properties',
    'backend/README.md',
    'README.md',
    'start-demo.ps1',
    'start-demo.bat',
    'reset-demo.bat',
    'db/reset-demo.sql',
    'docs/现场演示清单.md',
    'web-demo/serve_demo.js',
    'web-demo/mock-server.js',
    'docs/远程演示手册.md',
    'web-demo/index.html',
    'web-demo/serve_demo.py',
    'web-demo/js/api.js',
    'web-demo/js/app.js',
    'web-demo/css/style.css',
    'docs/项目分析与落地方案.md',
    'docs/智能化模块-小程序预览版.html',
    'db/schema.sql',
    'docker-compose.yml',
    'backend/Dockerfile',
    '.github/workflows/deploy-pages.yml',
    '.github/workflows/ci.yml',
    'docs/部署上手指南.md',
    'db/seed.sql',
    'db/legacy/README.txt',
    'frontend/app.json',
    'frontend/project.config.json',
    'frontend/utils/config.js',
    'frontend/pages/intelligent/diagnosis.js',
    'frontend/pages/intelligent/practice.js',
    'tools/verify_schema.ps1',
    'tools/validate_miniprogram.js',
    'tools/verify_mastery_algorithm.js',
    'tools/fix_ps1_encoding.ps1'
)
$missing = @()
foreach ($r in $required) {
    if (-not (Test-Path (Join-Path $vProj $r))) { $missing += $r }
}
Add-Result "required files present ($($required.Count))" ($missing.Count -eq 0)
if ($missing.Count -gt 0) { $missing | ForEach-Object { Write-Host "    missing: $_" -ForegroundColor Red } }

# --- 4.2 compile the clean copy -------------------------------------------
# Resolve Maven robustly: PATH first, then any Maven already unpacked in the
# local wrapper cache (common on machines that only ever used mvnw), then the
# project's own mvnw.cmd as a last resort.
function Resolve-Maven {
    $onPath = Get-Command mvn -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }

    $dists = Join-Path $env:USERPROFILE '.m2\wrapper\dists'
    if (Test-Path $dists) {
        $found = Get-ChildItem $dists -Recurse -Filter 'mvn.cmd' -ErrorAction SilentlyContinue |
                 Sort-Object FullName -Descending | Select-Object -First 1
        if ($found) { return $found.FullName }
    }

    $wrapper = Join-Path $vProj 'backend\mvnw.cmd'
    if (Test-Path $wrapper) { return $wrapper }

    return $null
}

$mvnPath = Resolve-Maven
if ($mvnPath) {
    Write-Host "  using maven: $mvnPath"
    Push-Location (Join-Path $vProj 'backend')
    $compileOut = (& $mvnPath -o -B -DskipTests compile 2>&1 | Out-String)
    Pop-Location
    # Offline mode can fail purely because the local repository lacks an
    # artifact. That is an environment limitation, not a package defect,
    # so retry once with network access before declaring failure.
    if ($compileOut -notmatch 'BUILD SUCCESS') {
        Write-Host "  offline compile failed; retrying with network access..." -ForegroundColor Yellow
        Push-Location (Join-Path $vProj 'backend')
        $compileOut = (& $mvnPath -B -DskipTests compile 2>&1 | Out-String)
        Pop-Location
    }
    $passed = $compileOut -match 'BUILD SUCCESS'
    Add-Result 'mvn compile (clean copy)' $passed
    if (-not $passed) {
        ($compileOut -split "`n" | Select-String -Pattern 'ERROR' | Select-Object -First 5) |
            ForEach-Object { Write-Host "    $($_.Line.Trim())" -ForegroundColor Red }
    }
} else {
    Write-Host "    (skipped: no maven on PATH, in ~/.m2/wrapper/dists, or as mvnw.cmd)" -ForegroundColor Yellow
}

# --- 4.3 schema coverage ---------------------------------------------------
Push-Location $vProj
$schemaOut = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $vProj 'tools/verify_schema.ps1') 2>&1 | Out-String)
Pop-Location
Add-Result 'schema coverage check' ($schemaOut -match 'RESULT: PASS')

# --- 4.4 mini program static check ----------------------------------------
Push-Location $vProj
$mpOut = (& node (Join-Path $vProj 'tools/validate_miniprogram.js') 2>&1 | Out-String)
Pop-Location
Add-Result 'mini program static check' ($mpOut -match 'RESULT: PASS')

# --- 4.5 mastery algorithm invariants -------------------------------------
Push-Location $vProj
$algoOut = (& node (Join-Path $vProj 'tools/verify_mastery_algorithm.js') 2>&1 | Out-String)
Pop-Location
Add-Result 'mastery algorithm check' ($algoOut -match 'RESULT: PASS')

Remove-Item $verify -Recurse -Force

Write-Host ""
$failed = 0
foreach ($r in $results) {
    if ($r.Pass) {
        Write-Host ("  [OK]   " + $r.Label) -ForegroundColor Green
    } else {
        Write-Host ("  [FAIL] " + $r.Label) -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host ("PACK OK -> " + $zipPath + "  (" + $sizeMB + " MB)") -ForegroundColor Green
    exit 0
} else {
    Write-Host ("PACK FAILED - " + $failed + " check(s) did not pass") -ForegroundColor Red
    exit 1
}
