#!/usr/bin/env pwsh
# Build the image and run Prelegal in a container on http://localhost:8000
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    docker build -t prelegal:latest .
    docker rm -f prelegal 2>$null | Out-Null

    $envArg = if (Test-Path (Join-Path $root '.env')) { @('--env-file', '.env') } else { @() }

    docker run -d --name prelegal -p 8000:8000 -v prelegal-data:/app/backend/data @envArg prelegal:latest | Out-Null
    Write-Host 'Prelegal is running at http://localhost:8000'
}
finally {
    Pop-Location
}
