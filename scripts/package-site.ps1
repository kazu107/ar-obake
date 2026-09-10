param([string]$ArchiveName = 'ar-obake-site.tar.gz')
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$taskArtifacts = Join-Path $taskRoot '.artifacts'
$taskStage = Join-Path $taskArtifacts 'site-package'
$taskDist = [System.IO.Path]::GetFullPath((Join-Path $taskStage 'dist'))
if (-not $taskDist.StartsWith($taskArtifacts + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Package staging escaped workspace artifacts.' }
$taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $taskNode)) { $taskNode = (Get-Command node).Source }
$taskHelper = Join-Path $env:USERPROFILE '.codex\plugins\cache\openai-bundled\sites\0.1.57\skills\sites-hosting\scripts\prepare-site-build.cjs'
if (-not (Test-Path -LiteralPath $taskHelper)) { throw 'Sites packaging helper not found. Locate the installed Sites plugin first.' }
New-Item -ItemType Directory -Force -Path $taskStage | Out-Null
# Windows equivalent of package-site.sh: invoke the same validator/stager after
# checking its recursive-delete destination, then use native tar. Keep staging.
Write-Output "Verified staging target: $taskDist"
& $taskNode $taskHelper $taskRoot $taskDist
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$taskArchive = Join-Path $taskArtifacts ([System.IO.Path]::GetFileName($ArchiveName))
tar -C $taskStage -czf $taskArchive dist
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$taskEntries = @(tar -tzf $taskArchive)
if ($LASTEXITCODE -ne 0 -or $taskEntries -notcontains 'dist/.openai/hosting.json' -or $taskEntries -notcontains 'dist/index.html' -or $taskEntries -notcontains 'dist/ar.html') { throw 'Package validation failed.' }
Write-Output $taskArchive
