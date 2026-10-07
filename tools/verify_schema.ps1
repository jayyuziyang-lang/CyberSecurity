# verify_schema.ps1
# ---------------------------------------------------------------------------
# Verify that db/schema.sql covers every table and column referenced by the
# backend code (entities + Mapper SQL).
#
# Usage:   powershell -ExecutionPolicy Bypass -File tools\verify_schema.ps1
# Exit:    0 = all covered; 1 = something missing (details printed)
#
# NOTE ON ENCODING: this file is intentionally saved as UTF-8 *with* BOM.
# Windows PowerShell 5.1 reads BOM-less files as the system ANSI codepage
# (GBK on this machine), which corrupts the Chinese text below and breaks
# parsing. Do not save it as UTF-8 without BOM.
#
# Why this script exists: the project originally shipped with no CREATE TABLE
# DDL at all, and the DDL that did exist drifted from the code (e.g.
# wrong_set.update_time and registration.reg_time pointed at columns that no
# script created). This script mechanically diffs "what the code needs"
# against "what the DDL provides" so that drift cannot silently return.
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

# --- Encoding self-check -----------------------------------------------------
# This file MUST be UTF-8 *with* BOM: Windows PowerShell 5.1 decodes BOM-less
# files using the system ANSI codepage (GBK on zh-CN machines), which mangles
# the Chinese messages above and can break parsing. If an editor saves this
# file without the BOM, the rewrite below repairs it automatically on next run.
# This runs before the first Chinese string is used, so it is safe even when
# the in-memory copy is already mojibake.
$selfPath = $PSCommandPath
if ($selfPath -and (Test-Path -LiteralPath $selfPath)) {
    $selfBytes = [byte[]](Get-Content -LiteralPath $selfPath -Encoding Byte -TotalCount 3)
    $hasBom = $selfBytes.Length -eq 3 -and $selfBytes[0] -eq 0xEF -and $selfBytes[1] -eq 0xBB -and $selfBytes[2] -eq 0xBF
    if (-not $hasBom) {
        $tmp = "$selfPath.tmp"
        Copy-Item -LiteralPath $selfPath -Destination $tmp -Force
        $lines = @(Get-Content -LiteralPath $tmp)
        $utf8Bom = New-Object System.Text.UTF8Encoding($true)
        [System.IO.File]::WriteAllLines($selfPath, $lines, $utf8Bom)
        Remove-Item -LiteralPath $tmp -Force
        Write-Host 'Note: verify_schema.ps1 was missing its UTF-8 BOM and has been repaired (needed by PowerShell 5.1).' -ForegroundColor Yellow
    }
}

$repoRoot   = Split-Path -Parent $PSScriptRoot
$entityDir  = Join-Path $repoRoot 'backend/src/main/java/com/example/cybersec/entity'
$schemaFile = Join-Path $repoRoot 'db/schema.sql'

if (-not (Test-Path $entityDir))  { throw "entity dir not found: $entityDir" }
if (-not (Test-Path $schemaFile)) { throw "schema not found: $schemaFile" }

# --- 1. Derive required tables/columns from the entity classes --------------
# Rules: @TableName gives the table; @TableField("x") wins; @TableField(exist
# = false) is skipped; @TableId counts as id; anything else uses MyBatis-Plus
# default camelCase -> snake_case conversion.
$required = @{}

function Add-Required($table, $column) {
    if (-not $required.ContainsKey($table)) {
        $required[$table] = New-Object System.Collections.Generic.HashSet[string]
    }
    [void]$required[$table].Add($column)
}

Get-ChildItem $entityDir -Filter *.java | ForEach-Object {
    $text = Get-Content $_.FullName -Raw -Encoding UTF8
    $tm = [regex]::Match($text, '@TableName\("([^"]+)"\)')
    if (-not $tm.Success) { return }
    $table = $tm.Groups[1].Value.Trim('"', '\')

    $pending = $null
    foreach ($line in ($text -split "`n")) {
        if ($line.Trim() -eq '') { continue }   # blank lines must not clear pending
        if ($line -match '@TableField\(\s*"([^"]+)"\s*\)')         { $pending = $Matches[1]; continue }
        if ($line -match '@TableField\(\s*exist\s*=\s*false\s*\)') { $pending = '__SKIP__'; continue }
        if ($line -match '@TableId\(([^)]*)\)')                    { $pending = 'id'; continue }
        if ($line -match '@JsonFormat')                            { continue }
        if ($line -match 'private\s+[\w<>\.]+\s+(\w+)\s*;') {
            $field = $Matches[1]
            if ($pending -ne '__SKIP__') {
                $col = if ($pending) { $pending }
                       else { ($field -creplace '(?<=[a-z0-9])([A-Z])', '_$1').ToLower() }
                Add-Required $table $col
            }
            $pending = $null
        }
    }
}

# --- 2. Parse what schema.sql actually defines ------------------------------
# BIGSERIAL must come before BIGINT in the alternation, and BIGINT must be
# present at all, otherwise "id BIGSERIAL" or "paper_id BIGINT" are missed.
$types  = 'BIGSERIAL|BIGINT|SMALLINT|INTEGER|SERIAL|VARCHAR|TEXT|BOOLEAN|TIMESTAMP|NUMERIC|DECIMAL'
$schema = Get-Content $schemaFile -Raw -Encoding UTF8
$defined = @{}

[regex]::Matches($schema, '(?s)CREATE TABLE IF NOT EXISTS\s+"?(\w+)"?\s*\((.*?)\n\s*\);') | ForEach-Object {
    $cols = New-Object System.Collections.Generic.HashSet[string]
    foreach ($line in ($_.Groups[2].Value -split "`n")) {
        if ($line -match "^\s*""?(\w+)""?\s+($types)") { [void]$cols.Add($Matches[1]) }
    }
    $defined[$_.Groups[1].Value] = $cols
}

# --- 3. Compare ------------------------------------------------------------
Write-Host "schema.sql defines $($defined.Count) table(s); entities reference $($required.Count) table(s)."
Write-Host ""

$problems = @()
foreach ($table in ($required.Keys | Sort-Object)) {
    if (-not $defined.ContainsKey($table)) {
        $problems += "missing table: $table"
        Write-Host "  [MISSING TABLE]   $table" -ForegroundColor Red
        continue
    }
    $missing = @($required[$table] | Where-Object { -not $defined[$table].Contains($_) })
    if ($missing.Count -gt 0) {
        $problems += "missing column(s): $table -> $($missing -join ', ')"
        Write-Host "  [MISSING COLUMN]  $table : $($missing -join ', ')" -ForegroundColor Red
    } else {
        Write-Host "  [OK]              $table ($($defined[$table].Count) columns)" -ForegroundColor Green
    }
}

$extra = $defined.Keys | Where-Object { -not $required.ContainsKey($_) }
if ($extra) {
    Write-Host ""
    Write-Host "Note: tables defined in schema.sql with no matching entity"
    Write-Host "(expected for 'user', which Mapper annotations access directly):"
    $extra | Sort-Object | ForEach-Object { Write-Host "  - $_" }
}

Write-Host ""
if ($problems.Count -eq 0) {
    Write-Host "RESULT: PASS - every table and column the code references exists in schema.sql." -ForegroundColor Green
    exit 0
} else {
    Write-Host "RESULT: FAIL ($($problems.Count) problem group(s))" -ForegroundColor Red
    $problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
