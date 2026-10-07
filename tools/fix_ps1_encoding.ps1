# fix_ps1_encoding.ps1
# ---------------------------------------------------------------------------
# Repair PowerShell script encoding for Windows PowerShell 5.1.
#
# Usage:
#     powershell -ExecutionPolicy Bypass -File tools/fix_ps1_encoding.ps1
#
# WHY THIS EXISTS
#   Windows PowerShell 5.1 decodes .ps1 files WITHOUT a UTF-8 BOM using the
#   system ANSI codepage (GBK on zh-CN machines). Chinese comments/messages in
#   such a file are read as garbage, which can break parsing outright
#   ("The string is missing the terminator") or silently corrupt output.
#
#   Any editor that saves "UTF-8 without BOM" (VS Code default, many others)
#   will reintroduce this problem.
#
#   Note the deliberate irony: the Java sources in this project must be saved
#   WITHOUT a BOM (javac rejects '\ufeff' in AuthController.java /
#   ReportServiceImpl.java), while these .ps1 files must be saved WITH one.
#   Different tools, opposite requirements.
#
# This script is idempotent and only ever adds a BOM; it never removes one.
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$toolsDir = $PSScriptRoot
$utf8Bom  = New-Object System.Text.UTF8Encoding($true)
$fixed    = 0
$scanned  = 0

Get-ChildItem -LiteralPath $toolsDir -Filter *.ps1 | ForEach-Object {
    $path = $_.FullName
    $scanned++

    $head = @(Get-Content -LiteralPath $path -Encoding Byte -TotalCount 3)
    $hasBom = $head.Length -eq 3 -and $head[0] -eq 0xEF -and $head[1] -eq 0xBB -and $head[2] -eq 0xBF

    if ($hasBom) {
        Write-Host "  [ok]    $($_.Name)"
        return
    }

    # Read as raw bytes and decode explicitly, so the file's own content is
    # never passed through the ANSI codepage path.
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $text  = [System.Text.Encoding]::UTF8.GetString($bytes)
    [System.IO.File]::WriteAllText($path, $text, $utf8Bom)

    Write-Host "  [fixed] $($_.Name) - UTF-8 BOM added" -ForegroundColor Yellow
    $fixed++
}

Write-Host ""
Write-Host "Scanned $scanned script(s); repaired $fixed." -ForegroundColor Cyan
if ($fixed -eq 0) {
    Write-Host "RESULT: OK - all scripts already carry a UTF-8 BOM."
} else {
    Write-Host "RESULT: REPAIRED - re-run any script that previously misbehaved."
}
exit 0
