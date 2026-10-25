$ErrorActionPreference = 'Stop'
node (Join-Path $PSScriptRoot 'package-release.mjs') @args
exit $LASTEXITCODE
