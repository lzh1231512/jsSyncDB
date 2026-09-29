$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $projectRoot
$tempRoot = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP 'jsSyncDBv2-integration'))
$tempParent = [System.IO.Path]::GetFullPath($env:TEMP)

if ([System.IO.Path]::GetDirectoryName($tempRoot) -ne $tempParent) {
    throw "Refusing to use an integration temp path outside TEMP: $tempRoot"
}

if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

$publishDirectory = Join-Path $tempRoot 'backend'
$hostDirectory = Join-Path $tempRoot 'host'
$standardOutputLog = Join-Path $tempRoot 'backend.stdout.log'
$standardErrorLog = Join-Path $tempRoot 'backend.stderr.log'
$serverProcess = $null
$failed = $false
$previousBaseUrl = $env:JSSYNCDB_INTEGRATION_BASE_URL
$previousHostRoot = $env:JSSYNCDB_INTEGRATION_HOST_ROOT
Push-Location $projectRoot

try {
    New-Item -ItemType Directory -Force -Path $publishDirectory, (Join-Path $hostDirectory 'wwwroot') | Out-Null

    $backendProject = Join-Path $repositoryRoot 'web-netcore\web-netcore.csproj'
    & dotnet publish $backendProject --configuration Release --output $publishDirectory --nologo
    if ($LASTEXITCODE -ne 0) {
        throw "Backend publish failed with exit code $LASTEXITCODE."
    }

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Client bundle build failed with exit code $LASTEXITCODE."
    }

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()
    $baseUrl = "http://127.0.0.1:$port"
    $env:JSSYNCDB_INTEGRATION_BASE_URL = $baseUrl
    $env:JSSYNCDB_INTEGRATION_HOST_ROOT = $hostDirectory

    $backendDll = Join-Path $publishDirectory 'web-netcore.dll'
    $argumentLine = '"{0}" --contentRoot "{1}" --urls "{2}"' -f $backendDll, $hostDirectory, $baseUrl
    $serverProcess = Start-Process `
        -FilePath 'dotnet' `
        -ArgumentList $argumentLine `
        -WorkingDirectory $publishDirectory `
        -RedirectStandardOutput $standardOutputLog `
        -RedirectStandardError $standardErrorLog `
        -PassThru `
        -WindowStyle Hidden

    & npm.cmd run test:integration:client
    if ($LASTEXITCODE -ne 0) {
        throw "JavaScript integration tests failed with exit code $LASTEXITCODE."
    }
}
catch {
    $failed = $true
    Write-Error $_
    if (Test-Path -LiteralPath $standardOutputLog) {
        Get-Content -LiteralPath $standardOutputLog -Tail 80
    }
    if (Test-Path -LiteralPath $standardErrorLog) {
        Get-Content -LiteralPath $standardErrorLog -Tail 80
    }
}
finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
        $serverProcess.WaitForExit()
    }

    if ($null -eq $previousBaseUrl) {
        Remove-Item Env:JSSYNCDB_INTEGRATION_BASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:JSSYNCDB_INTEGRATION_BASE_URL = $previousBaseUrl
    }
    if ($null -eq $previousHostRoot) {
        Remove-Item Env:JSSYNCDB_INTEGRATION_HOST_ROOT -ErrorAction SilentlyContinue
    }
    else {
        $env:JSSYNCDB_INTEGRATION_HOST_ROOT = $previousHostRoot
    }

    Pop-Location

    if ($failed) {
        Write-Host "Integration artifacts and backend logs retained at $tempRoot"
    }
    elseif (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}

if ($failed) {
    exit 1
}