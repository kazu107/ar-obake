param([ValidateSet('dev','build','preview','test','typecheck','assets','compile:targets','check:assets','check:mission','test:browser')][string]$Command = 'dev')
$ErrorActionPreference = 'Stop'
$taskNode = (Get-Command node -ErrorAction SilentlyContinue).Source
$taskBundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (Test-Path -LiteralPath $taskBundledNode) { $taskNode = $taskBundledNode }
if (-not $taskNode) { throw 'Node.js 24.19.0 or later is required.' }
$taskVersion = & $taskNode -p 'process.versions.node'
if ([version]$taskVersion -lt [version]'24.19.0') { throw "Node.js 24.19.0 or later is required (found $taskVersion)." }
$taskRoot = Split-Path -Parent $PSScriptRoot
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
