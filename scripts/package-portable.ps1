$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$release = Join-Path $workspace 'release'
$executable = Join-Path $workspace 'src-tauri\target\release\zhiliao-studio.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Run npm run bundle first.' }
if (-not (Test-Path -LiteralPath (Join-Path $workspace 'THIRD-PARTY-NOTICES.txt'))) { throw 'Generate third-party notices first.' }
$staging = Join-Path $release ('staging-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Copy-Item -LiteralPath $executable -Destination $staging
Copy-Item -LiteralPath (Join-Path $workspace 'README.md'), (Join-Path $workspace 'THIRD-PARTY-NOTICES.txt') -Destination $staging
$docs = Join-Path $staging 'docs'
New-Item -ItemType Directory -Path $docs | Out-Null
foreach ($name in @('USER_GUIDE.md', 'PROTOCOL.md', 'ACCEPTANCE.md', 'VERIFICATION.md', 'UI_DESIGN.md')) {
    Copy-Item -LiteralPath (Join-Path $workspace "docs\$name") -Destination $docs
}
Copy-Item -LiteralPath (Join-Path $workspace 'docs\screenshots') -Destination $docs -Recurse
Get-ChildItem -LiteralPath (Join-Path $workspace 'docs') -Filter 'com9-*-report.json' | Copy-Item -Destination $docs
$archive = Join-Path $release 'zhiliao-1.0.0-windows-x64-portable.zip'
Compress-Archive -LiteralPath (Join-Path $staging 'zhiliao-studio.exe'), (Join-Path $staging 'README.md'), (Join-Path $staging 'THIRD-PARTY-NOTICES.txt'), $docs -DestinationPath $archive -Force
Get-FileHash -LiteralPath $archive -Algorithm SHA256 | Format-List
@((Get-FileHash -LiteralPath $archive -Algorithm SHA256), (Get-FileHash -LiteralPath $executable -Algorithm SHA256)) | ForEach-Object { "$($_.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($_.Path))" } | Set-Content -LiteralPath (Join-Path $release 'SHA256SUMS.txt') -Encoding utf8
Write-Output "Portable archive: $archive"
Write-Output "Unpacked files retained at: $staging"
