$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$release = Join-Path $workspace 'release'
$executable = Join-Path $workspace 'src-tauri\target\release\zhiliao-studio.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Run npm run bundle first.' }
if (-not (Test-Path -LiteralPath (Join-Path $workspace 'THIRD-PARTY-NOTICES.txt'))) { throw 'Generate third-party notices first.' }
$staging = Join-Path $release ('staging-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Copy-Item -LiteralPath $executable -Destination $staging
foreach ($name in @('README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.txt')) {
    Copy-Item -LiteralPath (Join-Path $workspace $name) -Destination $staging
}
$docs = Join-Path $staging 'docs'
New-Item -ItemType Directory -Path $docs | Out-Null
foreach ($name in @('README.en.md', 'README.fr.md', 'USER_GUIDE.md', 'PROTOCOL.md')) {
    Copy-Item -LiteralPath (Join-Path $workspace "docs\$name") -Destination $docs
}
Copy-Item -LiteralPath (Join-Path $workspace 'docs\assets') -Destination $docs -Recurse
$screenshots = Join-Path $docs 'screenshots'
New-Item -ItemType Directory -Path $screenshots | Out-Null
Copy-Item -LiteralPath (Join-Path $workspace 'docs\screenshots\dashboard-night.png') -Destination $screenshots
Copy-Item -LiteralPath (Join-Path $workspace 'docs\screenshots\themes-overview.png') -Destination $screenshots
$archive = Join-Path $release 'zhiliao-1.0.0-windows-x64-portable.zip'
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -Force
Get-FileHash -LiteralPath $archive -Algorithm SHA256 | Format-List
@((Get-FileHash -LiteralPath $archive -Algorithm SHA256), (Get-FileHash -LiteralPath $executable -Algorithm SHA256)) | ForEach-Object { "$($_.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($_.Path))" } | Set-Content -LiteralPath (Join-Path $release 'SHA256SUMS.txt') -Encoding utf8
Write-Output "Portable archive: $archive"
Write-Output "Unpacked files retained at: $staging"
