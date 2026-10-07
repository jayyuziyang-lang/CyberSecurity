# =============================================================================
#  start-demo.ps1 -- 一键启动演示环境
# -----------------------------------------------------------------------------
#  双击 start-demo.bat 即可，不需要任何命令行操作。
#
#  自动完成：
#      1. 检查环境（Java / Node / Python / Maven）
#      2. 准备 PostgreSQL —— 四项探测，全都没有就自动下载免安装版
#      3. 第一次运行时自动建库 + 灌演示数据
#      4. 启动后端（:8080）
#      5. 启动网页服务 + /api 代理（:8081）
#      6. 打开浏览器
#
#  关掉那个黑窗口 = 结束演示，后端与网页服务一起停掉（数据库保持运行以便下次秒启）。
#
#  ---------------------------------------------------------------------------
#  三个已知坑，别删这段：
#
#  1) PostgreSQL 17 的 initdb 在【含中文的路径】下会失败：
#         FATAL: invalid byte sequence for encoding "UTF8"
#     PostgreSQL 16 没有这个问题。所以自动下载固定用 16.x，
#     且数据目录固定放 C:\Users\<用户名>\pgdata_cybersec（纯 ASCII）。
#
#  2) $ErrorActionPreference = 'Stop'  +  原生命令的 stderr 输出 = 脚本崩溃。
#     PowerShell 会把外部程序写到 stderr 的任何内容都当作错误记录，遇到 Stop
#     就抛异常终止。而 `java -version` 恰好把版本号写到 stderr —— 所以所有
#     外部命令都必须走下面的 Invoke-Native 包装，不能直接 `& java ...`。
#
#  3) 本文件必须保存为「带 BOM 的 UTF-8」。Windows PowerShell 5.1 会把无 BOM
#     的文件按 GBK 解码，中文注释变乱码并导致解析失败。
#     可用 tools/fix_ps1_encoding.ps1 修复。
# =============================================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# -SelfTest：自动跑完整个流程并自动关闭，用于交付前验证脚本本身
$SelfTest = $false
if ($args -contains '-SelfTest') { $SelfTest = $true; $env:CYBERSEC_DEMO_AUTOSTOP = '1' }

$PG_VERSION   = '16.9-1'
$PG_URL       = "https://get.enterprisedb.com/postgresql/postgresql-$PG_VERSION-windows-x64-binaries.zip"
# 免安装版 PostgreSQL 的安装位置。
# 【必须是纯 ASCII 路径】—— PostgreSQL 的 initdb 在含中文的目录下会失败：
#     FATAL: invalid byte sequence for encoding "UTF8": 0xd6 0xdc
# （0xd6 0xdc 是 GBK 的「中」字）。已实测：同一份 initdb.exe，
#   放在 D:\Desktop\周周\... 下必失败，放在 C:\Users\x\ 下正常。
# 所以刻意【不放】在项目目录里（项目路径常含中文，且这样还能给包瘦身 300MB）。
$PG_HOME      = Join-Path $env:USERPROFILE 'pgsql-portable'
$PG_DATA      = Join-Path $env:USERPROFILE 'pgdata_cybersec'
$DB_NAME      = 'cybersec_db'
$DB_USER      = 'postgres'
$DB_PASS      = '123456'
$BACKEND_PORT = 8080
$WEB_PORT     = 8081

# --------------------------------------------------------------- 基础工具函数
function Line { param($t) Write-Host ([string]$t) }
function Ok   { param($t) Write-Host ('  [OK]   ' + [string]$t) -ForegroundColor Green }
function Warn { param($t) Write-Host ('  [警告] ' + [string]$t) -ForegroundColor Yellow }
function Bad  { param($t) Write-Host ('  [错误] ' + [string]$t) -ForegroundColor Red }
function Step { param($t) Write-Host ("`n[" + [string]$t + "]") -ForegroundColor Cyan }

# 安全调用外部命令，返回 @{ Output = 文本; Code = 退出码 }
# 见文件头「已知坑 2)」：不这么包，java -version 就会让脚本崩掉。
function Invoke-Native {
    param([string]$Exe, [string[]]$Arguments)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $Exe @Arguments 2>&1 | Out-String
        return [pscustomobject]@{ Output = $out.Trim(); Code = $LASTEXITCODE }
    } catch {
        return [pscustomobject]@{ Output = [string]$_.Exception.Message; Code = -1 }
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Test-Port {
    param($Port)
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Test-PgReady {
    param([string]$BinDir)
    if (-not $BinDir) { return $false }
    $psql = Join-Path $BinDir 'psql.exe'
    if (-not (Test-Path $psql)) { return $false }
    $env:PGPASSWORD = $DB_PASS
    try {
        $r = Invoke-Native $psql @('-U', $DB_USER, '-h', '127.0.0.1', '-p', '5432', '-t', '-A', '-c', 'SELECT 1')
        return ($r.Code -eq 0)
    } finally {
        $env:PGPASSWORD = ''
    }
}

function Pause-Exit {
    param([int]$Code = 1)
    if (-not $SelfTest) { Read-Host '按回车键退出' }
    exit $Code
}

Line ''
Line '============================================================'
Line '   网络安全科普答题平台 -- 一键启动'
Line '============================================================'

# =============================================================== 1. 环境检查
Step '1/6 检查运行环境'

# --- Java（必需）---
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Bad '没有检测到 Java，后端无法运行。'
    Line ''
    Line '   请先安装 JDK 17（任选其一）：'
    Line '     winget install EclipseAdoptium.Temurin.17.JDK'
    Line '     https://mirrors.tuna.tsinghua.edu.cn/Adoptium/'
    Line ''
    Line '   装完后【重新打开一个窗口】再双击 start-demo.bat。'
    Pause-Exit 1
}
$jv = Invoke-Native 'java' @('-version')
Ok ('Java: ' + (($jv.Output -split "`n")[0]).Trim())

# --- 静态服务 + 代理：优先 Node，其次 Python ---
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$pyCmd   = Get-Command python -ErrorAction SilentlyContinue
$webServerScript = $null
if ($nodeCmd) {
    $webServerScript = Join-Path $root 'web-demo\serve_demo.js'
    $nv = Invoke-Native 'node' @('-v')
    Ok ('Node.js: ' + $nv.Output)
} elseif ($pyCmd) {
    $webServerScript = Join-Path $root 'web-demo\serve_demo.py'
    Ok ('Python: ' + $pyCmd.Source)
} else {
    Bad '既没有 Node.js 也没有 Python，无法启动网页服务。'
    Line ''
    Line '   装任意一个即可：'
    Line '     winget install OpenJS.NodeJS'
    Pause-Exit 1
}

# --- Maven：PATH -> 本地 wrapper 缓存 -> 项目自带 mvnw ---
$mvnPath = $null
$mvnOnPath = Get-Command mvn -ErrorAction SilentlyContinue
if ($mvnOnPath) {
    $mvnPath = $mvnOnPath.Source
} else {
    $dists = Join-Path $env:USERPROFILE '.m2\wrapper\dists'
    if (Test-Path $dists) {
        $found = Get-ChildItem $dists -Recurse -Filter 'mvn.cmd' -ErrorAction SilentlyContinue |
                 Sort-Object FullName -Descending | Select-Object -First 1
        if ($found) { $mvnPath = $found.FullName }
    }
    if (-not $mvnPath) {
        $wrapper = Join-Path $root 'backend\mvnw.cmd'
        if (Test-Path $wrapper) { $mvnPath = $wrapper }
    }
}
if (-not $mvnPath) {
    Bad '找不到 Maven，且项目自带的 backend\mvnw.cmd 也不存在。'
    Pause-Exit 1
}
Ok ('Maven: ' + $mvnPath)

# =========================================================== 2. 准备 PostgreSQL
Step '2/6 准备 PostgreSQL'

$pgBin = $null

if (Test-Port 5432) {
    # 本机已有数据库在跑，直接复用
    Warn '端口 5432 已有 PostgreSQL 在运行，直接复用。'
    $cands = @()
    $psqlOnPath = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlOnPath) { $cands += (Split-Path -Parent $psqlOnPath.Source) }
    $cands += (Join-Path $PG_HOME 'bin')
    Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | ForEach-Object { $cands += (Join-Path $_.FullName 'bin') }
    foreach ($c in $cands) {
        if ($c -and (Test-Path (Join-Path $c 'psql.exe'))) { $pgBin = $c; break }
    }
    if ($pgBin) {
        Ok ('psql: ' + $pgBin)
    } else {
        Warn '端口通但找不到 psql.exe，跳过建库步骤；若页面报错请手动导入 db/schema.sql。'
    }
} elseif (Test-Path (Join-Path $PG_HOME 'bin\pg_ctl.exe')) {
    Ok ('使用已下载的免安装 PostgreSQL: ' + $PG_HOME)
    $pgBin = Join-Path $PG_HOME 'bin'
} elseif (Get-Command pg_ctl -ErrorAction SilentlyContinue) {
    $pgBin = Split-Path -Parent (Get-Command pg_ctl).Source
    Ok ('使用系统 PostgreSQL: ' + $pgBin)
} else {
    Warn '本机没有可用的 PostgreSQL，将自动下载免安装版（约 300MB，只需一次）。'
    Line ''
    Line ("   下载地址: " + $PG_URL)
    Line ("   解压到  : " + $PG_HOME)
    Line ("   数据目录: " + $PG_DATA)
    Line ''

    # 下载 300MB 的包，网络抖动很常见，必须能重试。
    # 依次尝试 curl.exe（Win10 1803+ 自带，最稳，支持断点续传）
    # 和 Invoke-WebRequest（PowerShell 原生，作退路），各最多 3 次。
    #
    # 注意：curl 把进度写到 stderr。在 $ErrorActionPreference='Stop' 下
    # 直接用 `& curl` 会抛 NativeCommandError 中断脚本（见文件头「已知坑 2)」），
    # 所以这里同样必须走 Invoke-Native 包装。
    $zip = Join-Path $env:TEMP 'pgsql-portable.zip'
    $downloaded = $false
    $minSize = 100MB

    $curlExe = Join-Path $env:SystemRoot 'System32\curl.exe'
    if (Test-Path $curlExe) {
        for ($try = 1; $try -le 3 -and -not $downloaded; $try++) {
            Write-Host ('   下载中（curl，第 ' + $try + '/3 次，支持断点续传）...')
            $null = Invoke-Native $curlExe @('-L', '--fail', '--retry', '3', '--retry-delay', '3',
                                             '--silent', '--show-error', '-C', '-', '-o', $zip, $PG_URL)
            if ((Test-Path $zip) -and ((Get-Item $zip).Length -gt $minSize)) { $downloaded = $true }
        }
    }
    if (-not $downloaded) {
        for ($try = 1; $try -le 3 -and -not $downloaded; $try++) {
            try {
                $ProgressPreference = 'SilentlyContinue'
                Write-Host ('   下载中（PowerShell，第 ' + $try + '/3 次）...')
                Invoke-WebRequest -Uri $PG_URL -OutFile $zip -TimeoutSec 3600 -UseBasicParsing
                if ((Test-Path $zip) -and ((Get-Item $zip).Length -gt $minSize)) { $downloaded = $true }
            } catch {
                Write-Host ('      失败: ' + $_.Exception.Message)
                Start-Sleep -Seconds 3
            }
        }
    }

    if ($downloaded) {
        Write-Host ('   下载完成，' + [math]::Round((Get-Item $zip).Length / 1MB, 0) + ' MB')
    } else {
        Bad '下载失败（已重试多次）。'
        Line ''
        Line '   最省事的办法（推荐）：'
        Line '     用浏览器打开下面地址下载，解压后把里面的 pgsql 文件夹'
        Line ('     整个剪切到: ' + $PG_HOME)
        Line ('     ' + $PG_URL)
        Line '     然后重新双击 start-demo.bat —— 脚本会自动识别，不再下载。'
        Line ''
        Line '   其它选择：'
        Line '     winget install PostgreSQL.PostgreSQL.16   （正式安装版，需管理员）'
        Pause-Exit 1
    }

    Write-Host '   解压中（大文件较慢，请耐心）...'
    New-Item -ItemType Directory -Force -Path $PG_HOME | Out-Null
    try {
        $stageDir = Join-Path $env:USERPROFILE '_pgsql_stage'
        Remove-Item $stageDir -Recurse -Force -ErrorAction SilentlyContinue
        New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
        Expand-Archive -Path $zip -DestinationPath $stageDir -Force
    } catch {
        Bad ('解压失败: ' + $_.Exception.Message)
        Pause-Exit 1
    }
    # zip 内层目录名就是 pgsql；把它挪到 $PG_HOME
    if (-not (Test-Path (Join-Path $PG_HOME 'bin\pg_ctl.exe'))) {
        $inner = Get-ChildItem $stageDir -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($inner) {
            Remove-Item $PG_HOME -Recurse -Force -ErrorAction SilentlyContinue
            Move-Item $inner.FullName $PG_HOME -Force
        }
    }
    Remove-Item $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    $pgBin = Join-Path $PG_HOME 'bin'
    Ok 'PostgreSQL 免安装版已就绪'
}

if ($pgBin) {
    $pgCtl    = Join-Path $pgBin 'pg_ctl.exe'
    $initDb   = Join-Path $pgBin 'initdb.exe'
    $psql     = Join-Path $pgBin 'psql.exe'
    $createdb = Join-Path $pgBin 'createdb.exe'
    $logFile  = Join-Path $env:USERPROFILE 'pgdata_cybersec_server.log'

    if (-not (Test-Path (Join-Path $PG_DATA 'PG_VERSION'))) {
        Write-Host '   首次运行：初始化数据库...'
        if (-not (Test-Path $initDb)) {
            Bad '找不到 initdb.exe，无法初始化数据库。'
            Pause-Exit 1
        }
        $env:LC_ALL = 'C'; $env:LANG = 'C'
        $null = Invoke-Native $initDb @('-D', $PG_DATA, '-U', $DB_USER, '--auth=trust', '--encoding=UTF8', '--locale=C')
        if (-not (Test-Path (Join-Path $PG_DATA 'PG_VERSION'))) {
            Bad '数据库初始化失败。'
            Line ('   可手动执行: initdb -D "' + $PG_DATA + '" -U ' + $DB_USER + ' --auth=trust --encoding=UTF8 --locale=C')
            Pause-Exit 1
        }
        Ok ('数据目录已初始化: ' + $PG_DATA)
    }

    if (-not (Test-Port 5432)) {
        Write-Host '   启动数据库服务...'
        Start-Process -FilePath $pgCtl `
            -ArgumentList '-D', $PG_DATA, '-l', $logFile, '-o', '"-p 5432"', 'start' `
            -WindowStyle Hidden
        $up = $false
        for ($i = 1; $i -le 20; $i++) {
            Start-Sleep -Seconds 2
            if (Test-PgReady $pgBin) { $up = $true; break }
        }
        if (-not $up) {
            Bad '数据库启动超时。日志末尾：'
            if (Test-Path $logFile) { Get-Content $logFile -Tail 12 | ForEach-Object { Line ('     ' + $_) } }
            Pause-Exit 1
        }
    }
    Ok '数据库服务运行中（端口 5432）'

    # 建库 + 建表 + 灌数据（幂等）
    $env:PGPASSWORD = $DB_PASS
    $env:PGCLIENTENCODING = 'UTF8'

    $list = (Invoke-Native $createdb @('-U', $DB_USER, '-h', '127.0.0.1', '-p', '5432', '-l')).Output
    if ($list -notmatch $DB_NAME) {
        Write-Host ('   创建数据库 ' + $DB_NAME + ' ...')
        $null = Invoke-Native $psql @('-U', $DB_USER, '-h', '127.0.0.1', '-p', '5432', '-d', 'postgres', '-c', "CREATE DATABASE $DB_NAME;")
    }

    $countSql = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
    $tblCount = ((Invoke-Native $psql @('-U', $DB_USER, '-h', '127.0.0.1', '-p', '5432', '-d', $DB_NAME, '-t', '-A', '-c', $countSql)).Output -replace '\s', '')

    if ($tblCount -ne '12') {
        Write-Host '   导入表结构 (db/schema.sql) ...'
        $r1 = Invoke-Native $psql @('-U', $DB_USER, '-h', '127.0.0.1', '-p', '5432', '-d', $DB_NAME, '-v', 'ON_ERROR_STOP=1', '-f', (Join-Path $root 'db\schema.sql'))
        if ($r1.Code -ne 0) {
            Bad 'db/schema.sql 执行失败：'
            $r1.Output -split "`n" | Select-Object -Last 8 | ForEach-Object { Line ('     ' + $_) }
            Pause-Exit 1
        }
        Write-Host '   导入演示数据 (db/seed.sql) ...'
        $r2 = Invoke-Native $psql @('-U', $DB_USER, '-h', '127.0.0.1', '-p', '5432', '-d', $DB_NAME, '-v', 'ON_ERROR_STOP=1', '-f', (Join-Path $root 'db\seed.sql'))
        if ($r2.Code -ne 0) {
            Bad 'db/seed.sql 执行失败：'
            $r2.Output -split "`n" | Select-Object -Last 8 | ForEach-Object { Line ('     ' + $_) }
            Pause-Exit 1
        }
        $tblCount = ((Invoke-Native $psql @('-U', $DB_USER, '-h', '127.0.0.1', '-p', '5432', '-d', $DB_NAME, '-t', '-A', '-c', $countSql)).Output -replace '\s', '')
        Ok ('数据库已初始化（' + $tblCount + ' 张表）')
    } else {
        Ok '数据库已存在（12 张表），跳过导入'
    }
    $env:PGPASSWORD = ''
}

# ================================================================ 3. 启动后端
Step ('3/6 启动后端（端口 ' + $BACKEND_PORT + '）')

$backendJob = $null
if (Test-Port $BACKEND_PORT) {
    Warn ('端口 ' + $BACKEND_PORT + ' 已被占用，复用已在运行的后端。')
} else {
    Line '   正在编译并启动，首次运行需下载依赖（1-3 分钟）...'
    $backendLog = Join-Path $env:TEMP 'cybersec-backend.log'
    if (Test-Path $backendLog) { Remove-Item $backendLog -Force }
    Start-Process -FilePath $mvnPath `
        -ArgumentList '-B', '-DskipTests', 'spring-boot:run' `
        -WorkingDirectory (Join-Path $root 'backend') `
        -RedirectStandardOutput $backendLog -RedirectStandardError "$backendLog.err" `
        -WindowStyle Hidden

    $ready = $false
    for ($i = 1; $i -le 60; $i++) {
        Start-Sleep -Seconds 3
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$BACKEND_PORT/api/news/list" -TimeoutSec 4 -UseBasicParsing
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch {
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -ge 400) { $ready = $true; break }
        }
        if (Test-Path $backendLog) {
            $tail = Get-Content $backendLog -Tail 20 -ErrorAction SilentlyContinue
            if ($tail -match 'APPLICATION FAILED TO START|BUILD FAILURE') { break }
        }
        Write-Host ('      等待后端启动... ' + ($i * 3) + 's')
    }

    if ($ready) {
        Ok '后端已就绪'
    } else {
        Bad '后端启动失败。日志末尾：'
        if (Test-Path $backendLog) { Get-Content $backendLog -Tail 15 | ForEach-Object { Line ('     ' + $_) } }
        Line ''
        Line '   最常见的两个原因：'
        Line '     * 数据库没起来（看上面数据库步骤是否报错）'
        Line '     * 端口 8080 被别的程序占用'
        Pause-Exit 1
    }
}

# ============================================================ 4. 启动网页服务
Step ('4/6 启动网页服务（端口 ' + $WEB_PORT + '）')

$webJob = $null
if (Test-Port $WEB_PORT) {
    Warn ('端口 ' + $WEB_PORT + ' 已被占用，复用已在运行的网页服务。')
} else {
    if ($nodeCmd) {
        $webJob = Start-Process -FilePath $nodeCmd.Source `
            -ArgumentList $webServerScript, "$WEB_PORT", "$BACKEND_PORT" `
            -PassThru -WindowStyle Hidden
    } else {
        $webJob = Start-Process -FilePath $pyCmd.Source `
            -ArgumentList $webServerScript, "$WEB_PORT", "$BACKEND_PORT", '0.0.0.0' `
            -PassThru -WindowStyle Hidden
    }
    Start-Sleep -Seconds 3
    if (Test-Port $WEB_PORT) {
        Ok '网页服务已启动（含 /api 代理）'
    } else {
        Bad '网页服务启动失败。'
        Pause-Exit 1
    }
}

# ============================================================== 5. 打开浏览器
Step '5/6 打开浏览器'
$url = "http://127.0.0.1:$WEB_PORT/"
try { Start-Process $url; Ok $url } catch { Warn ('请手动打开: ' + $url) }

# ================================================================== 6. 完成
Step '6/6 就绪'
Line ''
Line '============================================================'
Line '   启动完成，可以开始演示了'
Line '============================================================'
Line ''
Line ('   本机访问:  ' + $url)

$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.PrefixOrigin -ne 'WellKnown' } |
       Select-Object -ExpandProperty IPAddress -Unique
if ($ips) {
    Line '   局域网内其他设备:'
    foreach ($ip in $ips) { Line ('       http://' + $ip + ':' + $WEB_PORT + '/') }
    Line ''
}
Line '   演示账号:'
Line '       student1 / 123456    学生，有错题记录（看诊断效果用这个）'
Line '       admin    / admin123  管理员'
Line '       student2 / 123456    学生，未实名'
Line ''
Line ('   要给异地客户看？加内网穿透指向 ' + $WEB_PORT + ' 端口即可，详见 docs/远程演示手册.md')
Line ''
Line '   ---------------------------------------------------------------'
Line '   演示结束后回到本窗口，按任意键即可关闭后端与网页服务。'
Line '   ---------------------------------------------------------------'
Line ''

if ($SelfTest) {
    Line '   [SelfTest] 4 秒后自动关闭...'
    Start-Sleep -Seconds 4
} else {
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}

Line ''
Line '正在关闭服务...'
foreach ($job in @($backendJob, $webJob)) {
    if ($job -and -not $job.HasExited) {
        try { Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
}
foreach ($port in @($BACKEND_PORT, $WEB_PORT)) {
    Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } catch { } }
}
Ok '已关闭。数据库保持运行，下次启动更快。'
Line ''
if ($SelfTest) { exit 0 }
