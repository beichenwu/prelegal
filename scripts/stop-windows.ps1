#!/usr/bin/env pwsh
# Stop and remove the Prelegal container.
$ErrorActionPreference = 'Stop'

docker rm -f prelegal 2>$null | Out-Null
Write-Host 'Prelegal stopped.'
