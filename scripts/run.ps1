[CmdletBinding()]
param([ValidateSet('dev','build','preview','test','typecheck','assets','compile:targets','check:assets','check:mission','test:browser')][string]$Command = 'dev')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskMinimum = [version](Get-Content -LiteralPath (Join-Path $taskRoot '.node-version') -Raw).Trim()
$taskPathNode = (Get-Command node -ErrorAction SilentlyContinue).Source
$taskBundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$taskNode = $null
foreach ($taskCandidate in @($taskPathNode, $taskBundledNode) | Select-Object -Unique) {
  if (-not $taskCandidate -or -not (Test-Path -LiteralPath $taskCandidate)) { continue }
  $taskVersion = & $taskCandidate -p 'process.versions.node'
  $taskParsedVersion = $null
  if ($LASTEXITCODE -eq 0 -and [version]::TryParse($taskVersion, [ref]$taskParsedVersion)) {
    if ($taskParsedVersion.Major -eq 24 -and $taskParsedVersion -ge $taskMinimum) { $taskNode = $taskCandidate; break }
  }
}
if (-not $taskNode) { throw "Node.js 24.x ($taskMinimum or later) is required. Update Node.js to the version in .node-version." }
Write-Verbose "Using Node.js $taskVersion ($taskNode)"
Push-Location -LiteralPath $taskRoot
try {
  switch ($Command) {
    'dev' { & $taskNode node_modules/vite/bin/vite.js --host 127.0.0.1 }
    'preview' { & $taskNode node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 }
    'typecheck' { & $taskNode node_modules/typescript/bin/tsc --noEmit }
    'build' { & $taskNode node_modules/typescript/bin/tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & $taskNode node_modules/vite/bin/vite.js build }
    'test' { & $taskNode node_modules/vitest/vitest.mjs run }
    'assets' { & $taskNode scripts/generate-assets.mjs }
    'compile:targets' { & $taskNode scripts/compile-targets.mjs }
    'check:assets' { & $taskNode scripts/check-assets.mjs }
    'check:mission' { & $taskNode scripts/check-mission-balance.mjs }
    'test:browser' { & $taskNode scripts/browser-smoke.mjs }
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
